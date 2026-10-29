import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Shield,
  Building2,
  Check,
  X,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Filter
} from 'lucide-react';
import { UserPersona, Department, UserRole } from '../../types';
import { getTerminology } from '../../terminology';
import { api } from '../../services/api';

interface OrganizationMembersViewProps {
  currentUser: UserPersona;
  departments: Department[];
  onRefreshPersonas?: () => void;
  onCurrentUserUpdated?: (user: UserPersona) => void;
}

export const OrganizationMembersView: React.FC<OrganizationMembersViewProps> = ({
  currentUser,
  departments,
  onRefreshPersonas,
  onCurrentUserUpdated
}) => {
  const [members, setMembers] = useState<UserPersona[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [selectedMember, setSelectedMember] = useState<UserPersona | null>(null);

  // Modal State
  const [appointRole, setAppointRole] = useState<UserRole>('EMPLOYEE');
  const [appointDeptId, setAppointDeptId] = useState<string>('');
  const [appointFaculty, setAppointFaculty] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const terms = getTerminology(currentUser.organizationType, currentUser.organizationName);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await api.getMembers();
      setMembers(data);
    } catch (err: any) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [currentUser.organizationId]);

  const openAppointModal = (member: UserPersona) => {
    if (member.id === currentUser.id) return;
    setSelectedMember(member);
    setAppointRole(member.role);
    setAppointDeptId(member.departmentId || '');
    setAppointFaculty(member.faculty || '');
    setFeedback(null);
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    // Strict validation
    if (appointRole === 'MANAGER' && !appointDeptId) {
      setFeedback({
        type: 'error',
        message: `Selecting a ${terms.unit} is mandatory when appointing a ${terms.roles.MANAGER}.`
      });
      return;
    }

    if (appointRole === 'DEAN' && !appointFaculty.trim()) {
      setFeedback({
        type: 'error',
        message: `Assigning a ${terms.division} is mandatory when appointing a ${terms.roles.DEAN}.`
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await api.updateMemberRole(
        selectedMember.id,
        appointRole,
        appointDeptId || undefined,
        appointFaculty.trim() || undefined
      );
      setFeedback({
        type: 'success',
        message: `Successfully appointed ${selectedMember.name} as ${terms.roles[appointRole] || appointRole}.`
      });

      // Refresh members list
      await loadMembers();

      if (onRefreshPersonas) {
        onRefreshPersonas();
      }

      // If user modified their own account, update session user
      if (selectedMember.id === currentUser.id && onCurrentUserUpdated) {
        onCurrentUserUpdated(res.data);
      }

      setTimeout(() => {
        setSelectedMember(null);
        setFeedback(null);
      }, 1200);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update member position.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.departmentName && m.departmentName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole =
      roleFilter === 'ALL'
        ? true
        : roleFilter === 'EMPLOYEE'
        ? m.role === 'EMPLOYEE'
        : roleFilter === 'MANAGER'
        ? m.role === 'MANAGER'
        : roleFilter === 'DEAN'
        ? m.role === 'DEAN'
        : roleFilter === 'ADMIN'
        ? m.role === 'ORG_ADMIN' || m.role === 'SUPER_ADMIN'
        : true;

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-xs font-semibold border border-purple-200 dark:border-purple-800">
            <Shield className="h-3 w-3" />
            <span>Root Super Admin</span>
          </span>
        );
      case 'ORG_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-xs font-semibold border border-blue-200 dark:border-blue-800">
            <Shield className="h-3 w-3" />
            <span>{terms.roles.ORG_ADMIN}</span>
          </span>
        );
      case 'DEAN':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold border border-amber-200 dark:border-amber-800">
            <span>{terms.roles.DEAN}</span>
          </span>
        );
      case 'MANAGER':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
            <span>{terms.roles.MANAGER}</span>
          </span>
        );
      case 'OPERATOR':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 text-xs font-medium border border-cyan-200 dark:border-cyan-800">
            <span>{terms.roles.OPERATOR}</span>
          </span>
        );
      case 'EMPLOYEE':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-xs font-medium">
            <span>{terms.roles.EMPLOYEE}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* View Header */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                <Users className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {terms.label} Members & Organizational Roles
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              All new users joining this organization begin at the entry level ({terms.roles.EMPLOYEE}).
              As an Administrator, you can appoint representatives, assign department leadership, and grant operational rights.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {members.length} {members.length === 1 ? 'Member' : 'Members'}
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or department..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                roleFilter === 'ALL'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setRoleFilter('EMPLOYEE')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                roleFilter === 'EMPLOYEE'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {terms.roles.EMPLOYEE}
            </button>
            <button
              onClick={() => setRoleFilter('MANAGER')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                roleFilter === 'MANAGER'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {terms.roles.MANAGER}
            </button>
            <button
              onClick={() => setRoleFilter('DEAN')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                roleFilter === 'DEAN'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {terms.roles.DEAN}
            </button>
            <button
              onClick={() => setRoleFilter('ADMIN')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                roleFilter === 'ADMIN'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Admin
            </button>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mb-2" />
            <p>Loading members directory...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No members found</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {searchQuery ? 'Try clearing your search query' : 'New users who sign up will appear here automatically.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Current Position</th>
                  <th className="py-3 px-4">Assigned {terms.unit}</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                {filteredMembers.map((member) => {
                  const isRootSuperAdmin = member.email === 'admin@acme.com';
                  const isCaller = member.id === currentUser.id;

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={member.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.name)}`}
                            alt={member.name}
                            className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 object-cover"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {member.name}
                              </span>
                              {isCaller && (
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.2 rounded">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {member.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {getRoleBadge(member.role)}
                      </td>

                      <td className="py-3 px-4">
                        {member.role === 'DEAN' ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-semibold text-amber-900 dark:text-amber-300">
                              {member.faculty || 'General ' + terms.division}
                            </span>
                            <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded font-semibold">
                              {terms.division}
                            </span>
                          </div>
                        ) : member.departmentName ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-medium text-slate-900 dark:text-slate-200">
                              {member.departmentName}
                            </span>
                            {member.departmentCode && (
                              <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-slate-500">
                                {member.departmentCode}
                              </span>
                            )}
                            {member.role === 'MANAGER' && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold">
                                Head
                              </span>
                            )}
                          </div>
                        ) : member.role === 'ORG_ADMIN' ? (
                          <span className="text-blue-700 dark:text-blue-300 text-xs font-medium">Institution-Wide</span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {member.createdAt
                          ? new Date(member.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : '—'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isRootSuperAdmin ? (
                          <span className="text-[11px] text-slate-400 italic">
                            Platform Root
                          </span>
                        ) : isCaller ? (
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {terms.roles.ORG_ADMIN} (You)
                          </span>
                        ) : member.role === 'ORG_ADMIN' && currentUser.role !== 'SUPER_ADMIN' ? (
                          <span className="text-[11px] text-slate-400 italic">
                            {terms.roles.ORG_ADMIN}
                          </span>
                        ) : (
                          <button
                            onClick={() => openAppointModal(member)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-emerald-600 dark:hover:border-emerald-500 transition shadow-2xs"
                          >
                            <span>Appoint Position</span>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Appoint Position Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Appoint Organizational Position
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure role and {terms.unit.toLowerCase()} assignment for <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedMember.name}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {feedback && (
              <div
                className={`rounded-lg p-3 text-xs flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {feedback.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <span>{feedback.message}</span>
              </div>
            )}

            <form onSubmit={handleSaveAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Appointed Position *
                </label>
                <div className="space-y-2">
                  {[
                    {
                      role: 'EMPLOYEE' as UserRole,
                      title: terms.roles.EMPLOYEE,
                      desc: `Standard operational worker (${terms.roles.EMPLOYEE}). Can submit requests, view assigned tasks, and participate in discussion threads.`
                    },
                    {
                      role: 'MANAGER' as UserRole,
                      title: terms.roles.MANAGER,
                      desc: `Department leadership (${terms.roles.MANAGER}). Reviews ${terms.unit} requests, manages workflows, issues approvals, and delegates tasks.`
                    },
                    {
                      role: 'DEAN' as UserRole,
                      title: terms.roles.DEAN,
                      desc: `Tier-2 executive authority (${terms.roles.DEAN}). Oversees ${terms.division} operations, high-tier stage approvals, and division radar.`
                    },
                    {
                      role: 'OPERATOR' as UserRole,
                      title: terms.roles.OPERATOR,
                      desc: `Technical specialist (${terms.roles.OPERATOR}). Receives and resolves assigned tasks across department workflows.`
                    },
                    ...(currentUser.role === 'SUPER_ADMIN' ? [
                      {
                        role: 'ORG_ADMIN' as UserRole,
                        title: terms.roles.ORG_ADMIN,
                        desc: `Organization Head (${terms.roles.ORG_ADMIN}). Full administrative oversight over organization configurations, workflows, and member positions.`
                      }
                    ] : [])
                  ].map((item) => {
                    const active = appointRole === item.role;
                    return (
                      <label
                        key={item.role}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
                          active
                            ? 'border-emerald-600 bg-emerald-50/50 dark:border-emerald-500 dark:bg-emerald-950/30'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="appointedRole"
                          value={item.role}
                          checked={active}
                          onChange={() => setAppointRole(item.role)}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {item.title}
                            </span>
                            {active && (
                              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Assignment based on role */}
              {appointRole === 'DEAN' ? (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Assigned {terms.division} *
                  </label>
                  <input
                    type="text"
                    required
                    value={appointFaculty}
                    onChange={(e) => setAppointFaculty(e.target.value)}
                    placeholder={`e.g. ${terms.division} of Science, Engineering, or Medicine`}
                    list="faculties-list"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-xs text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  />
                  <datalist id="faculties-list">
                    {Array.from(new Set(departments.map(d => d.faculty).filter(Boolean))).map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Assigning a {terms.division.toLowerCase()} establishes divisional oversight and executive authority for this {terms.roles.DEAN}.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Assigned {terms.unit} {appointRole === 'MANAGER' ? '*' : '(Optional)'}
                  </label>
                  <select
                    value={appointDeptId}
                    onChange={(e) => setAppointDeptId(e.target.value)}
                    required={appointRole === 'MANAGER'}
                    className={`w-full rounded-lg border bg-white dark:bg-slate-950 py-2 px-3 text-xs text-slate-900 dark:text-white focus:outline-none ${
                      appointRole === 'MANAGER' && !appointDeptId
                        ? 'border-amber-400 dark:border-amber-600'
                        : 'border-slate-300 dark:border-slate-700 focus:border-emerald-600'
                    }`}
                  >
                    <option value="">
                      {appointRole === 'MANAGER'
                        ? `-- Select Mandatory ${terms.unit} --`
                        : 'None / General Organization'}
                    </option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code}){d.faculty ? ` — ${d.faculty}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {appointRole === 'MANAGER'
                      ? `Mandatory: Head of Department must be assigned to lead a specific ${terms.unit.toLowerCase()}.`
                      : `Assigning a ${terms.unit.toLowerCase()} scopes operational queues, tasks, and member visibility.`}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedMember(null)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (appointRole === 'MANAGER' && !appointDeptId) || (appointRole === 'DEAN' && !appointFaculty.trim())}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white shadow-xs transition"
                >
                  {submitting ? 'Saving Appointment...' : 'Save Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
