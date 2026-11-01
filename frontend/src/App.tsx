import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { PendingRadar } from './components/radar/PendingRadar';
import { RequestCard } from './components/requests/RequestCard';
import { RequestDetailModal } from './components/requests/RequestDetailModal';
import { WhyIsThisStuckModal } from './components/requests/WhyIsThisStuckModal';
import { CreateRequestModal } from './components/requests/CreateRequestModal';
import { CreateDepartmentModal } from './components/departments/CreateDepartmentModal';
import { CreateFacultyModal } from './components/departments/CreateFacultyModal';
import { DeanDashboardView } from './components/dean/DeanDashboardView';
import { ReassignHodModal } from './components/departments/ReassignHodModal';
import { ReassignDeanModal } from './components/departments/ReassignDeanModal';
import { TaskListView } from './components/tasks/TaskListView';
import { AuditLogView } from './components/audit/AuditLogView';
import { PulseAiDrawer } from './components/ai/PulseAiDrawer';
import { AuthPage } from './components/auth/AuthPage';
import { PlatformOrganizationsView } from './components/admin/PlatformOrganizationsView';
import { OrganizationMembersView } from './components/admin/OrganizationMembersView';
import { RequestItem, PendingRadarData, UserPersona, Department, Faculty, TaskItem } from './types';
import { api } from './services/api';
import { getTerminology, cleanDeptDescription } from './terminology';
import {
  Plus,
  Building2,
  RefreshCw,
  GitBranch,
  Landmark,
  ShieldCheck,
  Layers,
  UserCheck,
  X
} from 'lucide-react';

export const App: React.FC = () => {
  // Application State
  const [personas, setPersonas] = useState<UserPersona[]>([]);
  const [currentUser, setCurrentUser] = useState<UserPersona | null>(null);
  const [radar, setRadar] = useState<PendingRadarData | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [currentTab, setCurrentTab] = useState('radar');
  const [searchQuery, setSearchQuery] = useState('');
  const [radarFilter, setRadarFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentOrgScope, setCurrentOrgScopeState] = useState<string>(() => api.getActiveOrgScope() || 'ALL');
  const [availableOrgs, setAvailableOrgs] = useState<Array<{ id: string; name: string; orgType?: string }>>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals & Panels State
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedDetailRequest, setSelectedDetailRequest] = useState<RequestItem | null>(null);
  const [stuckRequest, setStuckRequest] = useState<RequestItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDeptModalOpen, setCreateDeptModalOpen] = useState(false);
  const [createFacultyModalOpen, setCreateFacultyModalOpen] = useState(false);
  const [initialFacultyForCreateDept, setInitialFacultyForCreateDept] = useState('');
  const [reassignHodDept, setReassignHodDept] = useState<Department | null>(null);
  const [reassignDeanFaculty, setReassignDeanFaculty] = useState<Faculty | null>(null);
  const [preselectedDeptId, setPreselectedDeptId] = useState<string | undefined>(undefined);
  const [pulseAiOpen, setPulseAiOpen] = useState(false);
  const [pulseAiInitialPrompt, setPulseAiInitialPrompt] = useState<string | undefined>(undefined);

  // Automatic system theme synchronization
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => {
      if (mediaQuery.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    updateTheme();
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, []);

  // Initialize data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Enforce role-based tab boundaries
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'EMPLOYEE' && ['departments', 'workflows', 'approvals', 'all-requests', 'analytics', 'audit'].includes(currentTab)) {
      setCurrentTab('my-requests');
    } else if (currentUser.role === 'MANAGER' && ['departments', 'workflows', 'audit'].includes(currentTab)) {
      setCurrentTab('all-requests');
    } else if (currentUser.role === 'DEAN' && ['workflows', 'tasks'].includes(currentTab)) {
      setCurrentTab('faculty-hub');
    } else if ((currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ORG_ADMIN') && currentTab === 'tasks') {
      setCurrentTab('radar');
    }
  }, [currentUser?.role, currentTab]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const me = await api.getMe();
      if (me) {
        setCurrentUser(me);
        if (me.role === 'EMPLOYEE') {
          setCurrentTab('my-requests');
        } else if (me.role === 'DEAN') {
          setCurrentTab('faculty-hub');
        } else if (me.role === 'MANAGER') {
          setCurrentTab('all-requests');
        } else {
          setCurrentTab('radar');
        }
        try {
          const [fetchedPersonas, fetchedOrgs] = await Promise.all([
            api.getPersonas().catch(() => []),
            api.getOrganizations().catch(() => [])
          ]);
          setPersonas(fetchedPersonas);
          setAvailableOrgs(fetchedOrgs);
        } catch {}
        await refreshData();
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Initialization error:', err);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOrgScopeChange = async (newOrgId: string) => {
    api.setActiveOrgScope(newOrgId);
    setCurrentOrgScopeState(newOrgId);
    await refreshData();
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setRequests([]);
    setTasks([]);
    setRadar(null);
  };

  const refreshData = async () => {
    try {
      const [meData, radarData, reqData, taskData, deptData, facultiesData] = await Promise.all([
        api.getMe().catch(() => null),
        api.getRadar(),
        api.getRequests(),
        api.getTasks(),
        api.getDepartments(),
        api.getFaculties().catch(() => [])
      ]);
      if (meData) {
        setCurrentUser(meData);
      }
      setRadar(radarData);
      setRequests(reqData);
      setTasks(taskData);
      setDepartments(deptData);
      setFaculties(facultiesData || []);

      if (selectedRequestId) {
        const updated = await api.getRequestById(selectedRequestId);
        setSelectedDetailRequest(updated);
      }
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  const handleOpenDetails = async (id: string) => {
    try {
      const req = await api.getRequestById(id);
      setSelectedRequestId(id);
      setSelectedDetailRequest(req);
    } catch (err: any) {
      alert(err.message || 'Error loading request');
    }
  };

  // Filtered requests computation
  const filteredRequests = requests.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        r.requestId.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.waitingOn && r.waitingOn.toLowerCase().includes(q)) ||
        (r.departmentName && r.departmentName.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (currentTab === 'my-requests') {
      if (r.requesterId !== currentUser?.id) return false;
    }
    if (currentTab === 'approvals') {
      if (r.status !== 'PENDING_APPROVAL') return false;
    }

    if (radarFilter === 'overdue') {
      const now = new Date();
      return r.dueDate && new Date(r.dueDate) < now && r.status !== 'COMPLETED';
    }
    if (radarFilter === 'waiting') {
      return r.status === 'WAITING' || !!r.waitingOn;
    }
    if (radarFilter === 'approvals') {
      return r.status === 'PENDING_APPROVAL';
    }
    if (radarFilter === 'assigned-me') {
      return r.assigneeId === currentUser?.id || (r.tasks && r.tasks.some(t => t.assigneeId === currentUser?.id));
    }
    if (radarFilter === 'completed-today') {
      return r.status === 'COMPLETED';
    }

    return true;
  });

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isOrgAdmin = currentUser?.role === 'ORG_ADMIN';
  const isDean = currentUser?.role === 'DEAN';
  const isManager = currentUser?.role === 'MANAGER';
  const isEmployee = currentUser?.role === 'EMPLOYEE';

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <span className="text-xs font-medium text-slate-500">Loading WorkPulse...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthPage
        onLoginSuccess={async (user) => {
          setCurrentUser(user);
          if (user.role === 'EMPLOYEE') {
            setCurrentTab('my-requests');
          } else if (user.role === 'DEAN') {
            setCurrentTab('faculty-hub');
          } else if (user.role === 'MANAGER') {
            setCurrentTab('all-requests');
          } else {
            setCurrentTab('radar');
          }
          try {
            const fetchedPersonas = await api.getPersonas();
            setPersonas(fetchedPersonas);
          } catch {}
          await refreshData();
        }}
      />
    );
  }

  const terms = getTerminology(currentUser?.organizationType, currentUser?.organizationName, currentUser);

  const handleProfileUpdated = (updatedUser: UserPersona) => {
    setCurrentUser(updatedUser);
    setPersonas(prev => prev.map(p => p.id === updatedUser.id ? { ...p, ...updatedUser } : p));
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 font-sans transition-colors">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onOpenPulseAi={() => {
          setPulseAiInitialPrompt(undefined);
          setPulseAiOpen(true);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenRequest={handleOpenDetails}
        onLogout={handleLogout}
        currentOrgScope={currentOrgScope}
        onOrgScopeChange={handleOrgScopeChange}
        availableOrgs={availableOrgs}
        onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
        mobileMenuOpen={mobileMenuOpen}
        onProfileUpdated={handleProfileUpdated}
      />

      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setRadarFilter('');
          }}
          onOpenCreate={() => setCreateModalOpen(true)}
          currentUser={currentUser}
          pendingCount={radar?.waitingCount || 0}
          approvalsCount={radar?.pendingApprovalCount || 0}
          tasksCount={(isSuperAdmin || isOrgAdmin || isDean) ? 0 : tasks.filter(t => t.status !== 'COMPLETED').length}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 space-y-5 max-w-7xl mx-auto w-full">
          {/* Top Operational Alert / Radar Header */}
          {currentTab === 'radar' && (
            <PendingRadar
              radar={radar}
              currentUser={currentUser}
              activeFilter={radarFilter}
              onFilterSelect={setRadarFilter}
            />
          )}

          {/* Clean Setup Prompt when no departments exist */}
          {departments.length === 0 && (isSuperAdmin || isOrgAdmin) && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  No {terms.units.toLowerCase()} configured
                </h3>
                <p className="text-xs text-slate-500">
                  Set up {terms.units.toLowerCase()} to designate {terms.roles.MANAGER.toLowerCase()}s and begin receiving requests.
                </p>
              </div>
              <button
                onClick={() => setCreateDeptModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create {terms.unit}</span>
              </button>
            </div>
          )}

          {/* Section Toolbar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-white capitalize">
                {currentTab === 'members'
                  ? `${terms.label} Members & Roles`
                  : currentTab === 'departments'
                  ? `${terms.unit} Setup`
                  : currentTab.replace('-', ' ')}
              </h2>

              {isManager && currentTab === 'all-requests' && (() => {
                const myDept = departments.find(d => d.id === currentUser?.departmentId);
                return (
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    {myDept ? myDept.name : terms.unit}
                  </span>
                );
              })()}

              {radarFilter && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 dark:text-emerald-300 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5">
                  <span>Filter: {radarFilter}</span>
                  <button onClick={() => setRadarFilter('')} className="text-emerald-600 hover:text-emerald-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {currentTab !== 'audit' && currentTab !== 'tasks' && currentTab !== 'departments' && currentTab !== 'workflows' && currentTab !== 'members' && (
                <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  {filteredRequests.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refreshData}
                title="Refresh Live Data"
                className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>

              {(isSuperAdmin || isOrgAdmin) && currentTab === 'departments' && (
                <>
                  <button
                    onClick={() => setCreateFacultyModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition"
                  >
                    <Landmark className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Create {terms.division}</span>
                  </button>
                  <button
                    onClick={() => {
                      setInitialFacultyForCreateDept('');
                      setCreateDeptModalOpen(true);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1 text-xs font-semibold text-white shadow-xs transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create {terms.unit}</span>
                  </button>
                </>
              )}

              <button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1 text-xs font-semibold text-white shadow-xs transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Request</span>
              </button>
            </div>
          </div>

          {/* Tasks Tab View */}
          {currentTab === 'tasks' && !isSuperAdmin && !isOrgAdmin && !isDean && (
            <TaskListView
              tasks={tasks}
              currentUser={currentUser}
              onRefresh={refreshData}
              onOpenRequest={handleOpenDetails}
            />
          )}

          {/* Dean's Faculty Governance Hub */}
          {currentTab === 'faculty-hub' && isDean && (() => {
            const deanFaculty =
              faculties.find(f => f.deanId === currentUser.id) ||
              faculties.find(f => currentUser.faculty && f.name.toLowerCase().trim() === currentUser.faculty.toLowerCase().trim()) ||
              faculties.find(f => f.deanName && f.deanName.toLowerCase().trim() === currentUser.name.toLowerCase().trim()) ||
              (faculties.length === 1 ? faculties[0] : null) ||
              faculties[0] ||
              (currentUser.faculty ? { id: `fac-${currentUser.faculty.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, name: currentUser.faculty, code: '', organizationId: currentUser.organizationId || '' } : null);

            return (
              <DeanDashboardView
                currentUser={currentUser}
                faculty={deanFaculty}
                allFaculties={faculties}
                departments={departments}
                members={personas}
                requests={requests}
                onOpenRequest={handleOpenDetails}
                onOpenCreateRequest={(deptId) => {
                  setPreselectedDeptId(deptId);
                  setCreateModalOpen(true);
                }}
                onOpenCreateDept={(facultyName) => {
                  setInitialFacultyForCreateDept(facultyName || deanFaculty?.name || currentUser.faculty || '');
                  setCreateDeptModalOpen(true);
                }}
                onRefreshData={refreshData}
                onApproveRequest={async (reqId, stepId) => {
                  try {
                    await api.decideApproval(reqId, stepId, 'APPROVED');
                    await refreshData();
                  } catch (err: any) {
                    alert(err.message || 'Failed to approve request');
                  }
                }}
                onRejectRequest={async (reqId, stepId) => {
                  try {
                    await api.decideApproval(reqId, stepId, 'REJECTED', 'Rejected by Dean');
                    await refreshData();
                  } catch (err: any) {
                    alert(err.message || 'Failed to reject request');
                  }
                }}
              />
            );
          })()}

          {/* Audit Trail View */}
          {currentTab === 'audit' && (
            <AuditLogView currentUser={currentUser} />
          )}

          {/* Members & Roles Tab View */}
          {currentTab === 'members' && (isSuperAdmin || isOrgAdmin) && currentUser && (
            <OrganizationMembersView
              currentUser={currentUser}
              departments={departments}
              onRefreshPersonas={async () => {
                const fetched = await api.getPersonas().catch(() => []);
                setPersonas(fetched);
              }}
              onCurrentUserUpdated={(updated) => setCurrentUser(updated)}
            />
          )}

          {/* Platform Organizations Tab View */}
          {currentTab === 'organizations' && currentUser?.role === 'SUPER_ADMIN' && (
            <PlatformOrganizationsView
              currentUser={currentUser}
              onSelectOrg={(orgId) => {
                handleOrgScopeChange(orgId);
                setCurrentTab('radar');
              }}
            />
          )}

          {/* Workflows Tab View */}
          {currentTab === 'workflows' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    WF-IT-SUPPORT
                  </span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    ACTIVE
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">IT Support & Provisioning</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Submission -&gt; Manager Review -&gt; Assigned Technician -&gt; Verification -&gt; Completed.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  {['1. Submission', '2. Manager Review', '3. Resolution', '4. Verification'].map((step, idx) => (
                    <span key={idx} className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-slate-700 dark:text-slate-300">
                      {step}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    WF-HARDWARE
                  </span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    ACTIVE
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Hardware Replacement</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Diagnostic -&gt; Manager Approval -&gt; Procurement Quotation -&gt; PO Approval -&gt; Delivery.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  {['1. Approval', '2. Diagnosis', '3. Quotation', '4. Finance PO', '5. Delivery'].map((step, idx) => (
                    <span key={idx} className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-slate-700 dark:text-slate-300">
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Departments Tab View: Organized by Faculty / Unit Hierarchy */}
          {currentTab === 'departments' && (() => {
            const getPolicyBadge = (policy?: string) => {
              switch (policy) {
                case 'DEAN':
                  return {
                    label: `${terms.roles.DEAN} Approval`,
                    sub: 'No VC Req.',
                    className: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                  };
                case 'EXECUTIVE_ONLY':
                  return {
                    label: `${terms.roles.ORG_ADMIN} Approval`,
                    sub: 'Executive Sign-Off',
                    className: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  };
                case 'MULTI_TIER_CHAIN':
                  return {
                    label: 'Multi-Tier Chain',
                    sub: 'HOD → Dean → VC',
                    className: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  };
                case 'DEPT_MANAGER':
                case 'APPROVAL_REQUIRED':
                  return {
                    label: `${terms.roles.MANAGER} Pre-Approval`,
                    sub: 'Gated',
                    className: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  };
                case 'DIRECT':
                default:
                  return {
                    label: 'Direct Access',
                    sub: 'Immediate',
                    className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  };
              }
            };

            // Compile all faculties (from API plus any distinct dept.faculty)
            const allFacultyNamesSet = new Set<string>();
            faculties.forEach(f => allFacultyNamesSet.add(f.name));
            departments.forEach(d => {
              if (d.faculty && d.faculty.trim()) allFacultyNamesSet.add(d.faculty.trim());
            });

            const facultyGroups = Array.from(allFacultyNamesSet).map(facName => {
              const facMeta = faculties.find(f => f.name.toLowerCase() === facName.toLowerCase());
              const depts = departments.filter(d => d.faculty && d.faculty.toLowerCase() === facName.toLowerCase());
              const deanUser = personas.find(p => p.role === 'DEAN' && p.faculty && p.faculty.toLowerCase() === facName.toLowerCase()) ||
                               (facMeta?.deanId ? personas.find(p => p.id === facMeta.deanId) : undefined);
              return {
                name: facName,
                code: facMeta?.code || facName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4),
                description: facMeta?.description,
                deanUser,
                depts
              };
            });

            // Independent / Central Units (no faculty assigned or unassociated)
            const centralDepts = departments.filter(d => !d.faculty || !allFacultyNamesSet.has(d.faculty));

            const hasAnyStructure = facultyGroups.length > 0 || centralDepts.length > 0;

            if (!hasAnyStructure) {
              return (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center space-y-3 bg-white dark:bg-slate-900 shadow-xs">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto">
                    <Landmark className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      No {terms.division.toLowerCase()}s or {terms.unit.toLowerCase()}s configured
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      Start by establishing a {terms.division} (e.g. Faculty of Science) or creating independent {terms.unit.toLowerCase()}s (e.g. MIS, Registry) to begin routing institutional workflows.
                    </p>
                  </div>
                  {(isSuperAdmin || isOrgAdmin) && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => setCreateFacultyModalOpen(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition"
                      >
                        <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Create {terms.division}</span>
                      </button>
                      <button
                        onClick={() => {
                          setInitialFacultyForCreateDept('');
                          setCreateDeptModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Create {terms.unit}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {/* Faculty Groups with Nested Departments */}
                {facultyGroups.map((faculty) => (
                  <div
                    key={faculty.name}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
                  >
                    {/* Faculty Banner */}
                    <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                          <Landmark className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              {faculty.name}
                            </h3>
                            <span className="font-mono text-[10px] text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 px-1.5 py-0.2 rounded font-semibold">
                              {faculty.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                            {faculty.deanUser ? (
                              <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                <span>{terms.roles.DEAN}:</span>
                                <strong className="text-purple-700 dark:text-purple-300 font-semibold">
                                  {faculty.deanUser.name}
                                </strong>
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                No {terms.roles.DEAN} assigned
                              </span>
                            )}
                            {(isSuperAdmin || isOrgAdmin) && (
                              <button
                                type="button"
                                onClick={() => setReassignDeanFaculty({
                                  name: faculty.name,
                                  code: faculty.code,
                                  description: faculty.description,
                                  deanId: faculty.deanUser?.id,
                                  organizationId: currentUser?.organizationId || ''
                                })}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline ml-1"
                                title={`Appoint or Change ${terms.roles.DEAN} (Retirement / Promotion)`}
                              >
                                <UserCheck className="h-3 w-3" />
                                <span>{faculty.deanUser ? 'Change Dean' : 'Appoint Dean'}</span>
                              </button>
                            )}
                            {faculty.description && (
                              <span className="hidden md:inline text-slate-400">
                                • {faculty.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {faculty.depts.length} {faculty.depts.length === 1 ? terms.unit : `${terms.unit}s`}
                        </span>
                        {(isSuperAdmin || isOrgAdmin) && (
                          <button
                            onClick={() => {
                              setInitialFacultyForCreateDept(faculty.name);
                              setCreateDeptModalOpen(true);
                            }}
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add {terms.unit}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Departments under this Faculty */}
                    <div className="p-4 sm:p-5">
                      {faculty.depts.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-400 space-y-1.5">
                          <p>No {terms.unit.toLowerCase()}s grouped under {faculty.name} yet.</p>
                          {(isSuperAdmin || isOrgAdmin) && (
                            <button
                              onClick={() => {
                                setInitialFacultyForCreateDept(faculty.name);
                                setCreateDeptModalOpen(true);
                              }}
                              className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                            >
                              + Add first {terms.unit.toLowerCase()} under this {terms.division.toLowerCase()}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {faculty.depts.map((dept) => {
                            const deptRequests = requests.filter(r => r.departmentId === dept.id);
                            const waiting = deptRequests.filter(r => r.status === 'WAITING' || !!r.waitingOn);
                            const badge = getPolicyBadge(dept.approvalPolicy);

                            return (
                              <div
                                key={dept.id}
                                className="rounded-lg p-4 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs space-y-3 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{dept.name}</h4>
                                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                        {dept.code}
                                      </span>
                                    </div>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
                                      {badge.label}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-500">
                                      {terms.roles.MANAGER}: <strong className="text-slate-700 dark:text-slate-300">{dept.managerName || 'Unassigned'}</strong>
                                    </span>
                                    {(isSuperAdmin || isOrgAdmin || (isDean && currentUser?.faculty?.toLowerCase() === faculty.name.toLowerCase())) && (
                                      <button
                                        type="button"
                                        onClick={() => setReassignHodDept(dept)}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline"
                                        title={`Change ${terms.roles.MANAGER} / HOD (Retirement / Promotion)`}
                                      >
                                        <UserCheck className="h-3 w-3" />
                                        <span>{dept.managerName ? 'Change HOD' : 'Assign HOD'}</span>
                                      </button>
                                    )}
                                  </div>

                                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                    {cleanDeptDescription(dept.description)}
                                  </p>

                                  {dept.requestTypes.length > 0 && (
                                    <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Request Types</span>
                                      <div className="flex flex-wrap gap-1">
                                        {dept.requestTypes.map((rt) => (
                                          <span key={rt.id} className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-slate-300">
                                            {rt.name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                                  <span>Queue: <strong className="text-slate-800 dark:text-slate-200">{deptRequests.length}</strong></span>
                                  <span>Waiting: <strong className={waiting.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}>{waiting.length}</strong></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Central Administration & Institutional Units */}
                {centralDepts.length > 0 && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                    {/* Central Units Banner */}
                    <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              Central Administration & Institutional Units
                            </h3>
                            <span className="font-mono text-[10px] text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 px-1.5 py-0.2 rounded font-semibold">
                              DIRECT
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Operational units operating directly under Executive Management (e.g. MIS, Registry, Security, Works)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {centralDepts.length} {centralDepts.length === 1 ? terms.unit : `${terms.unit}s`}
                        </span>
                        {(isSuperAdmin || isOrgAdmin) && (
                          <button
                            onClick={() => {
                              setInitialFacultyForCreateDept('');
                              setCreateDeptModalOpen(true);
                            }}
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add {terms.unit}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Central Units Grid */}
                    <div className="p-4 sm:p-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {centralDepts.map((dept) => {
                          const deptRequests = requests.filter(r => r.departmentId === dept.id);
                          const waiting = deptRequests.filter(r => r.status === 'WAITING' || !!r.waitingOn);
                          const badge = getPolicyBadge(dept.approvalPolicy);

                          return (
                            <div
                              key={dept.id}
                              className="rounded-lg p-4 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs space-y-3 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{dept.name}</h4>
                                    <span className="font-mono text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                      {dept.code}
                                    </span>
                                  </div>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
                                    {badge.label}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500">
                                    {terms.roles.MANAGER}: <strong className="text-slate-700 dark:text-slate-300">{dept.managerName || 'Unassigned'}</strong>
                                  </span>
                                  {(isSuperAdmin || isOrgAdmin) && (
                                    <button
                                      type="button"
                                      onClick={() => setReassignHodDept(dept)}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline"
                                      title={`Change ${terms.roles.MANAGER} / Head of Unit (Retirement / Promotion)`}
                                    >
                                      <UserCheck className="h-3 w-3" />
                                      <span>{dept.managerName ? 'Change Head' : 'Assign Head'}</span>
                                    </button>
                                  )}
                                </div>

                                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                  {cleanDeptDescription(dept.description)}
                                </p>

                                {dept.requestTypes.length > 0 && (
                                  <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Request Types</span>
                                    <div className="flex flex-wrap gap-1">
                                      {dept.requestTypes.map((rt) => (
                                        <span key={rt.id} className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-slate-300">
                                          {rt.name}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                                <span>Queue: <strong className="text-slate-800 dark:text-slate-200">{deptRequests.length}</strong></span>
                                <span>Waiting: <strong className={waiting.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}>{waiting.length}</strong></span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Analytics Tab View */}
          {currentTab === 'analytics' && (() => {
            const activeReqs = requests.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
            const completedReqs = requests.filter(r => r.status === 'COMPLETED');
            const overdueReqs = activeReqs.filter(r => r.dueDate && new Date(r.dueDate) < new Date());
            const waitingReqs = activeReqs.filter(r => r.status === 'WAITING' || !!r.waitingOn);
            const pendingApprovalReqs = activeReqs.filter(r => r.status === 'PENDING_APPROVAL');
            const slaHealthPct = activeReqs.length > 0
              ? Math.round(((activeReqs.length - overdueReqs.length) / activeReqs.length) * 100)
              : 100;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Active Requests</span>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{activeReqs.length}</div>
                    <span className="text-[11px] text-slate-400">{overdueReqs.length} overdue</span>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Pending Approvals</span>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{pendingApprovalReqs.length}</div>
                    <span className="text-[11px] text-slate-400">Awaiting sign-off</span>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Waiting Blockers</span>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{waitingReqs.length}</div>
                    <span className="text-[11px] text-slate-400">External dependencies</span>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">SLA Health</span>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{slaHealthPct}%</div>
                    <span className="text-[11px] text-slate-400">{completedReqs.length} resolved</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Requests Grid (Main Feed) */}
          {(currentTab === 'radar' || currentTab === 'my-requests' || currentTab === 'all-requests' || currentTab === 'approvals') && (
            <>
              {filteredRequests.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center text-slate-500 space-y-1">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">No requests match this view.</p>
                  <p className="text-[11px] text-slate-400">
                    {isEmployee ? 'Submit a new request to get started.' : 'Try adjusting the search or filters.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredRequests.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onOpenDetails={handleOpenDetails}
                      onWhyStuck={(req) => setStuckRequest(req)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals & Panels */}
      <RequestDetailModal
        request={selectedDetailRequest}
        currentUser={currentUser}
        personas={personas}
        departments={departments}
        onClose={() => {
          setSelectedRequestId(null);
          setSelectedDetailRequest(null);
        }}
        onRefresh={refreshData}
      />

      <WhyIsThisStuckModal
        request={stuckRequest}
        onClose={() => setStuckRequest(null)}
        onViewDetails={(id) => {
          setStuckRequest(null);
          handleOpenDetails(id);
        }}
      />

      {createModalOpen && (
        <CreateRequestModal
          departments={departments}
          currentUser={currentUser}
          initialDepartmentId={preselectedDeptId}
          onClose={() => {
            setCreateModalOpen(false);
            setPreselectedDeptId(undefined);
          }}
          onCreated={refreshData}
        />
      )}

      {createDeptModalOpen && (
        <CreateDepartmentModal
          personas={personas}
          currentUser={currentUser}
          faculties={faculties}
          initialFaculty={initialFacultyForCreateDept}
          onClose={() => setCreateDeptModalOpen(false)}
          onCreated={refreshData}
        />
      )}

      {createFacultyModalOpen && (
        <CreateFacultyModal
          personas={personas}
          currentUser={currentUser}
          onClose={() => setCreateFacultyModalOpen(false)}
          onCreated={refreshData}
        />
      )}

      {reassignHodDept && currentUser && (
        <ReassignHodModal
          department={reassignHodDept}
          personas={personas}
          currentUser={currentUser}
          onClose={() => setReassignHodDept(null)}
          onSuccess={() => {
            setReassignHodDept(null);
            refreshData();
          }}
        />
      )}

      {reassignDeanFaculty && currentUser && (
        <ReassignDeanModal
          faculty={reassignDeanFaculty}
          personas={personas}
          currentUser={currentUser}
          onClose={() => setReassignDeanFaculty(null)}
          onSuccess={() => {
            setReassignDeanFaculty(null);
            refreshData();
          }}
        />
      )}

      <PulseAiDrawer
        isOpen={pulseAiOpen}
        onClose={() => setPulseAiOpen(false)}
        currentUser={currentUser}
        initialPrompt={pulseAiInitialPrompt}
        onSelectRequest={(id) => handleOpenDetails(id)}
      />
    </div>
  );
};

export default App;
