import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { PendingRadar } from './components/radar/PendingRadar';
import { RequestCard } from './components/requests/RequestCard';
import { RequestDetailModal } from './components/requests/RequestDetailModal';
import { WhyIsThisStuckModal } from './components/requests/WhyIsThisStuckModal';
import { CreateRequestModal } from './components/requests/CreateRequestModal';
import { CreateDepartmentModal } from './components/departments/CreateDepartmentModal';
import { TaskListView } from './components/tasks/TaskListView';
import { AuditLogView } from './components/audit/AuditLogView';
import { Section33ScenarioBar } from './components/guided/Section33ScenarioBar';
import { PulseAiDrawer } from './components/ai/PulseAiDrawer';
import { AuthPage } from './components/auth/AuthPage';
import { RequestItem, PendingRadarData, UserPersona, Department, TaskItem } from './types';
import { api } from './services/api';
import {
  Plus,
  Layers,
  Building,
  CheckCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Shield,
  Briefcase,
  GitBranch,
  UserCheck,
  CheckSquare
} from 'lucide-react';

export const App: React.FC = () => {
  // Application State
  const [personas, setPersonas] = useState<UserPersona[]>([]);
  const [currentUser, setCurrentUser] = useState<UserPersona | null>(null);
  const [radar, setRadar] = useState<PendingRadarData | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentTab, setCurrentTab] = useState('radar');
  const [searchQuery, setSearchQuery] = useState('');
  const [radarFilter, setRadarFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals & Panels State
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedDetailRequest, setSelectedDetailRequest] = useState<RequestItem | null>(null);
  const [stuckRequest, setStuckRequest] = useState<RequestItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDeptModalOpen, setCreateDeptModalOpen] = useState(false);
  const [pulseAiOpen, setPulseAiOpen] = useState(false);
  const [pulseAiInitialPrompt, setPulseAiInitialPrompt] = useState<string | undefined>(undefined);

  // Initialize data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const me = await api.getMe();
      if (me) {
        setCurrentUser(me);
        try {
          const fetchedPersonas = await api.getPersonas();
          setPersonas(fetchedPersonas);
        } catch {}
        await refreshData();
      } else {
        setCurrentUser(null);
      }
    } catch (err: any) {
      console.error('Initialization error:', err);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setRequests([]);
    setTasks([]);
    setRadar(null);
  };

  const handleResetData = async () => {
    if (!window.confirm('Are you sure you want to wipe all demo workflow data? This will clear all requests, tasks, notifications, and audit records so you can start 100% fresh with your own real operational data.')) {
      return;
    }
    try {
      setLoading(true);
      await api.resetData({ wipeDepartments: false });
      await refreshData();
      alert('✨ Demo records successfully wiped! You now have a clean slate to create your own departments, requests, and workflows.');
    } catch (err: any) {
      alert(err.message || 'Failed to wipe data.');
    } finally {
      setLoading(false);
    }
  };

  const switchPersona = async (email: string) => {
    try {
      const loginRes = await api.login(email);
      setCurrentUser(loginRes.user);
      await refreshData();
    } catch (err: any) {
      console.error('Persona switch failed:', err);
    }
  };

  const refreshData = async () => {
    try {
      const [radarData, reqData, taskData, deptData] = await Promise.all([
        api.getRadar(),
        api.getRequests(),
        api.getTasks(),
        api.getDepartments()
      ]);
      setRadar(radarData);
      setRequests(reqData);
      setTasks(taskData);
      setDepartments(deptData);

      // If detail modal open, refresh it as well
      if (selectedRequestId) {
        const updated = await api.getRequestById(selectedRequestId);
        setSelectedDetailRequest(updated);
      }
    } catch (err: any) {
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

  const handleOpenPulseAiWithPrompt = (prompt: string) => {
    setPulseAiInitialPrompt(prompt);
    setPulseAiOpen(true);
  };

  // Filtered requests computation
  const filteredRequests = requests.filter((r) => {
    // Search query filter
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

    // Tab filter
    if (currentTab === 'my-requests') {
      if (r.requesterId !== currentUser?.id) return false;
    }
    if (currentTab === 'approvals') {
      if (r.status !== 'PENDING_APPROVAL') return false;
    }

    // Pending Radar Metric Filter
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
  const isManager = currentUser?.role === 'MANAGER';
  const isEmployee = currentUser?.role === 'EMPLOYEE';

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#07090e] text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-xs font-semibold text-slate-400">Loading WorkPulse...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthPage
        onLoginSuccess={async (user) => {
          setCurrentUser(user);
          try {
            const fetchedPersonas = await api.getPersonas();
            setPersonas(fetchedPersonas);
          } catch {}
          await refreshData();
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0f19] text-slate-100 font-sans">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        personas={personas}
        onSelectPersona={switchPersona}
        onOpenPulseAi={() => {
          setPulseAiInitialPrompt(undefined);
          setPulseAiOpen(true);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenRequest={handleOpenDetails}
        onLogout={handleLogout}
        onResetData={handleResetData}
      />

      {/* Section 33 Interactive Scenario Controller Bar */}
      <Section33ScenarioBar
        currentUser={currentUser}
        personas={personas}
        onSwitchPersona={switchPersona}
        onRefreshData={refreshData}
        onOpenPulseAiWithPrompt={handleOpenPulseAiWithPrompt}
        onOpenRequest={handleOpenDetails}
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
          onOpenPulseAi={() => {
            setPulseAiInitialPrompt(undefined);
            setPulseAiOpen(true);
          }}
          currentUser={currentUser}
          pendingCount={radar?.waitingCount || 0}
          approvalsCount={radar?.pendingApprovalCount || 0}
          tasksCount={tasks.filter(t => t.status !== 'COMPLETED').length}
        />

        {/* Main Workspace Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Top Operational Alert / Radar Header */}
          {currentTab === 'radar' && (
            <PendingRadar
              radar={radar}
              activeFilter={radarFilter}
              onFilterSelect={setRadarFilter}
            />
          )}

          {/* Clean Slate Onboarding Banner */}
          {departments.length === 0 && (
            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-6 backdrop-blur-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-base font-bold text-white">Welcome to your Fresh Workspace!</h3>
                  </div>
                  <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                    Zero demo clutter. You are ready to start with your own organizational structure. Set up your departments (e.g. IT, Computer Science, Registry, Finance, Operations) and define their custom request types.
                  </p>
                </div>
                <button
                  onClick={() => setCreateDeptModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-2.5 text-xs font-bold text-white shadow-glow-indigo transition hover:brightness-110 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Department</span>
                </button>
              </div>
            </div>
          )}

          {/* Section Heading & Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white capitalize flex items-center gap-2">
                <span>{currentTab.replace('-', ' ')}</span>
                {isManager && currentTab === 'all-requests' && (
                  <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                    IT Department Scope
                  </span>
                )}
                {radarFilter && (
                  <span className="text-xs font-semibold text-indigo-400 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5">
                    Filter: {radarFilter}
                  </span>
                )}
              </h2>
              {currentTab !== 'audit' && currentTab !== 'tasks' && currentTab !== 'departments' && currentTab !== 'workflows' && (
                <span className="text-xs font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full">
                  {filteredRequests.length} {filteredRequests.length === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refreshData}
                title="Refresh Live Data"
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>

              {(isSuperAdmin || isOrgAdmin) && currentTab === 'departments' && (
                <button
                  onClick={() => setCreateDeptModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Create Department</span>
                </button>
              )}

              <button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition"
              >
                <Plus className="h-4 w-4" />
                <span>New Request</span>
              </button>
            </div>
          </div>

          {/* Tasks Tab View (Section 9, 15, 33) */}
          {currentTab === 'tasks' && (
            <TaskListView
              tasks={tasks}
              currentUser={currentUser}
              onRefresh={refreshData}
              onOpenRequest={handleOpenDetails}
            />
          )}

          {/* Audit Trail View (Section 24) */}
          {currentTab === 'audit' && (
            <AuditLogView />
          )}

          {/* Workflows Tab View */}
          {currentTab === 'workflows' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-indigo-400">WF-IT-SUPPORT</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">ACTIVE</span>
                </div>
                <h3 className="text-base font-bold text-white">IT Technical Support & Provisioning</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Employee submits request -&gt; IT Manager reviews -&gt; Task assigned to technician -&gt; Technician works -&gt; Manager verifies -&gt; Completed.
                </p>
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Workflow Stages</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {['1. Employee Submission', '2. IT Manager Review & Task Assignment', '3. Technician Work & Resolution', '4. Manager Final Verification'].map((step, idx) => (
                      <span key={idx} className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-slate-300">
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-purple-400">WF-HARDWARE</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">ACTIVE</span>
                </div>
                <h3 className="text-base font-bold text-white">Hardware Procurement & Replacement</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enterprise sequence for employee laptop diagnostic, manager review, procurement quotation, finance PO approval, and asset handoff.
                </p>
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Workflow Stages</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {['1. Manager Approval', '2. IT Diagnosis', '3. Procurement Quotation', '4. Finance PO', '5. Vendor Delivery'].map((step, idx) => (
                      <span key={idx} className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-slate-300">
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Departments Tab View (Configuration-Driven) */}
          {currentTab === 'departments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Configured Organizational Departments</h3>
                  <p className="text-xs text-slate-400">
                    Departments define responsibilities, request types, task types, and assigned managers.
                  </p>
                </div>
                {(isSuperAdmin || isOrgAdmin) && (
                  <button
                    onClick={() => setCreateDeptModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Department</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {departments.map((dept) => {
                  const deptRequests = requests.filter(r => r.departmentId === dept.id);
                  const waiting = deptRequests.filter(r => r.status === 'WAITING' || !!r.waitingOn);
                  const isUserInDept = currentUser?.departmentId === dept.id;

                  return (
                    <div key={dept.id} className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-white">{dept.name}</h3>
                              <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                {dept.code}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                              Manager: <strong className="text-slate-200">{dept.managerName || 'Unassigned'}</strong>
                            </span>
                          </div>
                          {isUserInDept && (
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                              Your Dept
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          {dept.description}
                        </p>

                        {/* Responsibilities Chips */}
                        <div className="space-y-1 pt-2 border-t border-slate-800/80">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Responsibilities:</span>
                          <div className="flex flex-wrap gap-1">
                            {dept.responsibilities.map((resp, i) => (
                              <span key={i} className="rounded bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300 border border-slate-800">
                                {resp}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Configured Request Types */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Request Types:</span>
                          <div className="flex flex-wrap gap-1">
                            {dept.requestTypes.map((rt) => (
                              <span key={rt.id} className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300 border border-purple-500/20">
                                {rt.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Configured Task Types */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Task Types:</span>
                          <div className="flex flex-wrap gap-1">
                            {dept.taskTypes.map((tt, i) => (
                              <span key={i} className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300 border border-emerald-500/20">
                                {tt}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span>Active Queue: <strong className="text-white">{deptRequests.length}</strong></span>
                        <span>Waiting Blockers: <strong className={waiting.length > 0 ? 'text-amber-400' : 'text-emerald-400'}>{waiting.length}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Analytics Tab View */}
          {currentTab === 'analytics' && (() => {
            const activeReqs = requests.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
            const completedReqs = requests.filter(r => r.status === 'COMPLETED');
            const overdueReqs = activeReqs.filter(r => r.dueDate && new Date(r.dueDate) < new Date());
            const waitingReqs = activeReqs.filter(r => r.status === 'WAITING' || !!r.waitingOn);
            const pendingApprovalReqs = activeReqs.filter(r => r.status === 'PENDING_APPROVAL');
            const completedTasks = tasks.filter(t => t.status === 'COMPLETED');
            const slaHealthPct = activeReqs.length > 0
              ? Math.round(((activeReqs.length - overdueReqs.length) / activeReqs.length) * 100)
              : 100;

            const statusGroups = [
              { label: 'Active', count: activeReqs.filter(r => r.status === 'ACTIVE').length, color: 'bg-blue-500', text: 'text-blue-400' },
              { label: 'Pending Approval', count: pendingApprovalReqs.length, color: 'bg-purple-500', text: 'text-purple-400' },
              { label: 'Waiting', count: waitingReqs.length, color: 'bg-amber-500', text: 'text-amber-400' },
              { label: 'Completed', count: completedReqs.length, color: 'bg-emerald-500', text: 'text-emerald-400' },
            ];
            const maxStatus = Math.max(...statusGroups.map(s => s.count), 1);

            const deptWorkload = departments.map(d => ({
              name: d.name,
              code: d.code,
              active: activeReqs.filter(r => r.departmentId === d.id).length,
              waiting: waitingReqs.filter(r => r.departmentId === d.id).length
            })).filter(d => d.active > 0 || d.waiting > 0);
            const maxDept = Math.max(...deptWorkload.map(d => d.active), 1);

            return (
              <div className="space-y-6">
                {/* KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Active Requests', value: activeReqs.length, sub: `${overdueReqs.length} overdue`, subColor: overdueReqs.length > 0 ? 'text-red-400' : 'text-emerald-400', accent: 'border-indigo-500/30 bg-indigo-500/5' },
                    { label: 'Pending Approvals', value: pendingApprovalReqs.length, sub: 'Awaiting executive sign-off', subColor: 'text-purple-400', accent: 'border-purple-500/30 bg-purple-500/5' },
                    { label: 'Waiting Blockers', value: waitingReqs.length, sub: 'External dependencies', subColor: 'text-amber-400', accent: 'border-amber-500/30 bg-amber-500/5' },
                    { label: 'Completed Today', value: completedReqs.filter(r => r.completedAt && new Date(r.completedAt).toDateString() === new Date().toDateString()).length, sub: `${completedReqs.length} total resolved`, subColor: 'text-emerald-400', accent: 'border-emerald-500/30 bg-emerald-500/5' },
                  ].map((kpi, i) => (
                    <div key={i} className={`rounded-2xl border p-4 space-y-1 ${kpi.accent}`}>
                      <span className="text-[11px] text-slate-400 font-medium">{kpi.label}</span>
                      <div className="text-3xl font-black text-white">{kpi.value}</div>
                      <span className={`text-[10px] font-semibold ${kpi.subColor}`}>{kpi.sub}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SLA Health Gauge */}
                  <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">SLA Health</h3>
                      <p className="text-[11px] text-slate-400">Percentage of active requests within SLA deadline</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="relative h-24 w-24 shrink-0">
                        <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1e293b" strokeWidth="3" />
                          <circle
                            cx="18" cy="18" r="15.915" fill="none"
                            stroke={slaHealthPct >= 80 ? '#10b981' : slaHealthPct >= 50 ? '#f59e0b' : '#ef4444'}
                            strokeWidth="3.5"
                            strokeDasharray={`${slaHealthPct} ${100 - slaHealthPct}`}
                            strokeLinecap="round"
                            className="transition-all duration-700"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-xl font-black ${slaHealthPct >= 80 ? 'text-emerald-400' : slaHealthPct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                            {slaHealthPct}%
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="text-slate-300">On-time: <strong className="text-white">{activeReqs.length - overdueReqs.length}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500 shrink-0"></span>
                          <span className="text-slate-300">Overdue: <strong className="text-red-400">{overdueReqs.length}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-slate-500 shrink-0"></span>
                          <span className="text-slate-300">Tasks done: <strong className="text-white">{completedTasks.length}/{tasks.length}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Request Status Distribution */}
                  <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Request Lifecycle</h3>
                      <p className="text-[11px] text-slate-400">Distribution across workflow stages</p>
                    </div>
                    <div className="space-y-3">
                      {statusGroups.map(sg => (
                        <div key={sg.label} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-300 font-medium">{sg.label}</span>
                            <span className={`font-bold ${sg.text}`}>{sg.count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${sg.color} transition-all duration-700`}
                              style={{ width: `${maxStatus > 0 ? (sg.count / maxStatus) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Department Workload Chart */}
                  {deptWorkload.length > 0 && (
                    <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4 md:col-span-2">
                      <div>
                        <h3 className="text-sm font-bold text-white">Department Workload Distribution</h3>
                        <p className="text-[11px] text-slate-400">Active requests per department queue</p>
                      </div>
                      <div className="space-y-3">
                        {deptWorkload.map(dw => (
                          <div key={dw.code} className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="flex items-center gap-2">
                                <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 text-[10px]">{dw.code}</span>
                                <span className="text-slate-300">{dw.name}</span>
                                {dw.waiting > 0 && (
                                  <span className="text-amber-400 font-semibold text-[10px]">({dw.waiting} waiting)</span>
                                )}
                              </span>
                              <span className="font-bold text-white">{dw.active}</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden flex">
                              <div
                                className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                                style={{ width: `${maxDept > 0 ? ((dw.active - dw.waiting) / maxDept) * 100 : 0}%` }}
                              />
                              {dw.waiting > 0 && (
                                <div
                                  className="h-full bg-amber-500/80"
                                  style={{ width: `${maxDept > 0 ? (dw.waiting / maxDept) * 100 : 0}%` }}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-4 pt-1 text-[10px]">
                          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-indigo-500 inline-block"></span> Active</span>
                          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-amber-500 inline-block"></span> Waiting</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Requests Grid (Main Feed) */}
          {(currentTab === 'radar' || currentTab === 'my-requests' || currentTab === 'all-requests' || currentTab === 'approvals') && (
            <>
              {filteredRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-500 space-y-2">
                  <Layers className="h-8 w-8 mx-auto text-slate-600" />
                  <p className="text-sm font-medium">No requests match the current view criteria.</p>
                  <p className="text-xs text-slate-400">
                    {isEmployee ? 'You can submit a request using "+ New Request" button.' : 'Try clearing filters or search query.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
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
          onClose={() => setCreateModalOpen(false)}
          onCreated={refreshData}
        />
      )}

      {createDeptModalOpen && (
        <CreateDepartmentModal
          personas={personas}
          onClose={() => setCreateDeptModalOpen(false)}
          onCreated={refreshData}
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
