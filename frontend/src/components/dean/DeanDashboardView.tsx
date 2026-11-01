import React, { useState } from 'react';
import { 
  GraduationCap, Building2, Users, CheckCircle2, Clock, AlertCircle, Plus, 
  Search, ShieldCheck, ChevronRight, Layers, ArrowUpRight, Zap, FileText, Filter
} from 'lucide-react';
import { Department, Faculty, RequestItem, UserPersona } from '../../types';
import { getTerminology, cleanDeptDescription } from '../../terminology';
import { ReassignHodModal } from '../departments/ReassignHodModal';

interface DeanDashboardViewProps {
  currentUser: UserPersona;
  faculty: Faculty | null;
  allFaculties?: Faculty[];
  departments: Department[];
  members: UserPersona[];
  requests: RequestItem[];
  onOpenRequest: (requestId: string) => void;
  onOpenCreateRequest: (preselectedDeptId?: string) => void;
  onOpenCreateDept: (facultyName?: string) => void;
  onRefreshData: () => void;
  onApproveRequest?: (requestId: string, stepId: string) => void;
  onRejectRequest?: (requestId: string, stepId: string) => void;
}

export const DeanDashboardView: React.FC<DeanDashboardViewProps> = ({
  currentUser,
  faculty,
  allFaculties,
  departments,
  members,
  requests,
  onOpenRequest,
  onOpenCreateRequest,
  onOpenCreateDept,
  onRefreshData,
  onApproveRequest,
  onRejectRequest
}) => {
  const terms = getTerminology(currentUser.organizationType, currentUser.organizationName, currentUser);
  const [activeTab, setActiveTab] = useState<'departments' | 'staff' | 'approvals' | 'radar'>('departments');
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedDeptForHodChange, setSelectedDeptForHodChange] = useState<Department | null>(null);

  // Compile all available faculties across system (from allFaculties or distinct departments)
  const availableFaculties: Faculty[] = React.useMemo(() => {
    const list: Faculty[] = allFaculties ? [...allFaculties] : [];
    departments.forEach(d => {
      if (d.faculty && d.faculty.trim() && !list.some(f => f.name.toLowerCase() === d.faculty!.toLowerCase())) {
        list.push({
          id: `fac-${d.faculty.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          organizationId: currentUser.organizationId || '',
          name: d.faculty.trim(),
          code: d.faculty.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 4)
        });
      }
    });
    return list;
  }, [allFaculties, departments, currentUser.organizationId]);

  // Determine initial selected faculty:
  // 1. Explicitly passed prop `faculty`
  // 2. Faculty where deanId matches currentUser.id
  // 3. Faculty matching currentUser.faculty
  // 4. Faculty matching currentUser.name
  // 5. First faculty in availableFaculties
  const resolvedInitialFaculty = React.useMemo(() => {
    return (
      faculty ||
      availableFaculties.find(f => f.deanId === currentUser.id) ||
      availableFaculties.find(f => currentUser.faculty && f.name.toLowerCase().trim() === currentUser.faculty.toLowerCase().trim()) ||
      availableFaculties.find(f => f.deanName && f.deanName.toLowerCase().trim() === currentUser.name.toLowerCase().trim()) ||
      (availableFaculties.length > 0 ? availableFaculties[0] : null)
    );
  }, [faculty, availableFaculties, currentUser]);

  const [selectedFacultyName, setSelectedFacultyName] = useState<string>(
    resolvedInitialFaculty?.name || currentUser.faculty || ''
  );

  React.useEffect(() => {
    if (resolvedInitialFaculty?.name && (!selectedFacultyName || selectedFacultyName.startsWith('General '))) {
      setSelectedFacultyName(resolvedInitialFaculty.name);
    }
  }, [resolvedInitialFaculty?.name]);

  const activeFaculty = 
    availableFaculties.find(f => f.name.toLowerCase().trim() === (selectedFacultyName || resolvedInitialFaculty?.name || '').toLowerCase().trim()) ||
    resolvedInitialFaculty;

  const facultyName = activeFaculty?.name || selectedFacultyName || resolvedInitialFaculty?.name || currentUser.faculty || 'General ' + terms.division;
  const facultyCode = activeFaculty?.code || facultyName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 4);

  // Filter departments strictly under this Dean's faculty
  const facultyDepartments = departments.filter((d) => {
    if (!d.faculty) return false;
    return d.faculty.toLowerCase().trim() === facultyName.toLowerCase().trim();
  });

  const facultyDeptIds = new Set(facultyDepartments.map(d => d.id));

  // Filter members belonging to departments in this faculty
  const facultyMembers = members.filter((m) => {
    if (m.departmentId && facultyDeptIds.has(m.departmentId)) return true;
    if (m.faculty && m.faculty.toLowerCase().trim() === facultyName.toLowerCase().trim()) return true;
    return false;
  });

  // Requisitions under this faculty
  const facultyRequests = requests.filter((r) => {
    if (facultyDeptIds.has(r.departmentId)) return true;
    if (r.faculty && r.faculty.toLowerCase().trim() === facultyName.toLowerCase().trim()) return true;
    return false;
  });

  // Pending Dean Approvals
  const pendingDeanApprovals = requests.filter((r) => {
    if (r.status !== 'PENDING_APPROVAL') return false;
    if (r.stepId === 'approval-dean') return true;
    if (facultyDeptIds.has(r.departmentId) && r.currentStepName?.toLowerCase().includes('dean')) return true;
    return false;
  });

  // Active in-progress requisitions
  const activeWorkflows = facultyRequests.filter(r => r.status === 'ACTIVE' || (r.status as string) === 'IN_PROGRESS' || r.status === 'WAITING');

  const filteredStaff = facultyMembers.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(staffSearch.toLowerCase()) ||
      (m.departmentName && m.departmentName.toLowerCase().includes(staffSearch.toLowerCase()));

    const matchesDept = selectedDeptFilter === 'ALL' || m.departmentId === selectedDeptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Faculty Executive Banner */}
      <div className="rounded-2xl border border-purple-200/80 dark:border-purple-900/60 bg-gradient-to-br from-purple-50/70 via-white to-slate-50 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-950 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-600/20 shrink-0">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold tracking-wider text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                  {terms.division} Governance
                </span>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-semibold">
                  {facultyCode}
                </span>
                {availableFaculties.length > 1 && (
                  <select
                    value={facultyName}
                    onChange={(e) => setSelectedFacultyName(e.target.value)}
                    className="text-xs font-semibold bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-lg px-2 py-0.5 text-purple-700 dark:text-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs"
                  >
                    {availableFaculties.map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.name} ({f.code || 'FAC'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {facultyName}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>{terms.roles.DEAN}: <strong className="text-purple-700 dark:text-purple-300 font-semibold">{currentUser.name}</strong></span>
                <span>•</span>
                <span>{currentUser.organizationName || 'University Headquarters'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => onOpenCreateRequest()}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 text-xs font-semibold shadow-xs transition"
            >
              <Zap className="h-4 w-4" />
              <span>+ Faculty Requisition</span>
            </button>
            <button
              onClick={() => onOpenCreateDept(facultyName)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 text-xs font-semibold shadow-xs transition"
            >
              <Plus className="h-4 w-4 text-purple-600" />
              <span>Add {terms.unit}</span>
            </button>
          </div>
        </div>

        {/* Faculty Metric KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-purple-100 dark:border-purple-950/80">
          <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/80 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Departments</span>
              <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {facultyDepartments.length}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Under {terms.roles.DEAN} oversight</span>
          </div>

          <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/80 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Academic Staff</span>
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {facultyMembers.length}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Across all {facultyDepartments.length} units</span>
          </div>

          <div className={`rounded-xl border p-3.5 shadow-2xs ${
            pendingDeanApprovals.length > 0
              ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
              : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/70 dark:border-slate-800/80'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-medium ${pendingDeanApprovals.length > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-slate-500'}`}>
                Dean Approvals
              </span>
              <Clock className={`h-4 w-4 ${pendingDeanApprovals.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            </div>
            <div className={`text-2xl font-black mt-1 ${pendingDeanApprovals.length > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
              {pendingDeanApprovals.length}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {pendingDeanApprovals.length > 0 ? 'Action required by Dean' : 'No pending queue'}
            </span>
          </div>

          <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/80 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Active Workflows</span>
              <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {activeWorkflows.length}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">In active execution</span>
          </div>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
          <button
            onClick={() => setActiveTab('departments')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition ${
              activeTab === 'departments'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Departments & HODs ({facultyDepartments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition ${
              activeTab === 'staff'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Academic Staff ({facultyMembers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition ${
              activeTab === 'approvals'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Dean Approvals</span>
            {pendingDeanApprovals.length > 0 && (
              <span className="h-5 min-w-[20px] px-1 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                {pendingDeanApprovals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('radar')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition ${
              activeTab === 'radar'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Faculty Requisitions ({facultyRequests.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: DEPARTMENTS & HOD LEADERSHIP */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Academic Departments under {facultyName}
              </h3>
              <p className="text-xs text-slate-500">
                Manage department leadership, HOD tenure turnover, promotions, and operational queues
              </p>
            </div>
            <button
              onClick={() => onOpenCreateDept(facultyName)}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Department</span>
            </button>
          </div>

          {facultyDepartments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-400 space-y-3">
              <Building2 className="h-8 w-8 mx-auto text-slate-300" />
              <p>No departments have been grouped under {facultyName} yet.</p>
              <button
                onClick={() => onOpenCreateDept(facultyName)}
                className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
              >
                + Create the first department for this faculty
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {facultyDepartments.map((dept) => {
                const deptReqs = requests.filter(r => r.departmentId === dept.id);
                const deptStaff = members.filter(m => m.departmentId === dept.id);

                return (
                  <div
                    key={dept.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3 flex flex-col justify-between hover:border-purple-300 dark:hover:border-purple-800 transition"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{dept.name}</h4>
                            <span className="font-mono text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800">
                              {dept.code}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                            {cleanDeptDescription(dept.description) || 'Academic department'}
                          </p>
                        </div>
                      </div>

                      {/* HOD Leadership Card */}
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-2.5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            {terms.roles.MANAGER}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block mt-0.5">
                            {dept.managerName || (
                              <span className="text-amber-600 dark:text-amber-400 font-normal italic">Unassigned (Vacant)</span>
                            )}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedDeptForHodChange(dept)}
                          className="rounded-md border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 hover:bg-purple-50 dark:hover:bg-purple-950/60 px-2.5 py-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 transition shadow-2xs"
                        >
                          Change HOD
                        </button>
                      </div>

                      {/* Metrics bar */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500">Staff: <strong className="text-slate-800 dark:text-slate-200">{deptStaff.length}</strong></span>
                        <span className="text-slate-500">Queue: <strong className="text-slate-800 dark:text-slate-200">{deptReqs.length}</strong></span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        Policy: {dept.approvalPolicy || 'DIRECT'}
                      </span>
                      <button
                        onClick={() => onOpenCreateRequest(dept.id)}
                        className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
                      >
                        <span>Submit to {dept.code}</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FACULTY STAFF DIRECTORY */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Academic & Technical Staff Roster
                </h3>
                <p className="text-xs text-slate-500">
                  Staff members assigned across all departments in {facultyName}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    placeholder="Search staff name or email..."
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-600"
                  />
                </div>

                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="ALL">All Departments</option>
                  {facultyDepartments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Member</th>
                    <th className="py-2.5 px-3">Role / Position</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStaff.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={staff.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(staff.name)}`}
                            alt={staff.name}
                            className="h-7 w-7 rounded-full object-cover bg-slate-200"
                          />
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {staff.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {staff.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          staff.role === 'DEAN'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200'
                            : staff.role === 'MANAGER'
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200'
                        }`}>
                          {staff.role === 'MANAGER' ? terms.roles.MANAGER : staff.role === 'DEAN' ? terms.roles.DEAN : terms.roles.EMPLOYEE}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {staff.departmentName || 'Faculty Office'}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        {staff.role !== 'DEAN' && staff.role !== 'SUPER_ADMIN' && staff.role !== 'ORG_ADMIN' && (
                          <button
                            onClick={() => {
                              const dept = facultyDepartments.find(d => d.id === staff.departmentId);
                              if (dept) setSelectedDeptForHodChange(dept);
                            }}
                            className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                          >
                            Assign / Promote
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEAN APPROVALS RADAR */}
      {/* TAB 3: DEAN APPROVALS RADAR */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Requisitions Awaiting Dean Approval
                </h3>
                <p className="text-xs text-slate-500">
                  Per governance policy, Dean-approved requisitions dispatch directly to target HOD execution queues without requiring Vice-Chancellor escalation.
                </p>
              </div>
              {pendingDeanApprovals.length > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {pendingDeanApprovals.length} Pending
                </span>
              )}
            </div>

            {pendingDeanApprovals.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">All caught up!</p>
                <p>There are no requisitions currently waiting for Dean approval.</p>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {pendingDeanApprovals.map((req) => {
                  const pendingApproval = req.approvals?.find(a => a.status === 'PENDING');
                  const targetApprovalId = pendingApproval?.id || (req as any).approvalId || 'approval-dean';

                  return (
                    <div
                      key={req.id}
                      className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/80 p-4 hover:border-purple-300 dark:hover:border-purple-500/40 hover:bg-white dark:hover:bg-slate-800/80 transition-all shadow-2xs hover:shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {req.title}
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-950/70 px-2 py-0.5 rounded border border-purple-200/60 dark:border-purple-800/60">
                            {req.customId || req.id}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700">
                            {req.departmentName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                          {req.description}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                          <span>Submitted by: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{req.requesterName}</strong></span>
                          <span>•</span>
                          <span>Priority: <strong className="text-slate-800 dark:text-slate-200 font-semibold uppercase">{req.priority}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onOpenRequest(req.id)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-2xs"
                        >
                          Inspect
                        </button>

                        {onRejectRequest && (
                          <button
                            onClick={() => onRejectRequest(req.id, targetApprovalId)}
                            className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-3.5 py-1.5 text-xs font-semibold transition shadow-2xs"
                          >
                            Reject
                          </button>
                        )}

                        {onApproveRequest && (
                          <button
                            onClick={() => onApproveRequest(req.id, targetApprovalId)}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-4 py-1.5 text-xs font-semibold shadow-xs hover:shadow transition flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Approve & Dispatch</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: FACULTY REQUISITIONS RADAR */}
      {activeTab === 'radar' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              All Requisitions across {facultyName}
            </h3>
            <span className="text-xs text-slate-400">
              Total {facultyRequests.length} requisitions
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {facultyRequests.map((r) => (
              <div
                key={r.id}
                onClick={() => onOpenRequest(r.id)}
                className="py-3 px-2 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-850 cursor-pointer rounded-lg transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">{r.title}</span>
                    <span className="text-[10px] font-mono text-slate-400">{r.customId}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    {r.departmentName} • By {r.requesterName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {r.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HOD Turnover / Reassignment Modal */}
      {selectedDeptForHodChange && (
        <ReassignHodModal
          department={selectedDeptForHodChange}
          personas={members}
          currentUser={currentUser}
          onClose={() => setSelectedDeptForHodChange(null)}
          onSuccess={() => {
            setSelectedDeptForHodChange(null);
            onRefreshData();
          }}
        />
      )}
    </div>
  );
};
