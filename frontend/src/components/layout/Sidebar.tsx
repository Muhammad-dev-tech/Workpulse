import React from 'react';
import {
  Radar,
  Inbox,
  Layers,
  CheckSquare,
  Building2,
  GitBranch,
  Bot,
  Database,
  BarChart3,
  Plus,
  Shield,
  Briefcase
} from 'lucide-react';
import { UserPersona } from '../../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenCreate: () => void;
  onOpenPulseAi: () => void;
  currentUser: UserPersona | null;
  pendingCount?: number;
  approvalsCount?: number;
  tasksCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenCreate,
  onOpenPulseAi,
  currentUser,
  pendingCount = 0,
  approvalsCount = 0,
  tasksCount = 0
}) => {
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isOrgAdmin = currentUser?.role === 'ORG_ADMIN';
  const isManager = currentUser?.role === 'MANAGER';
  const isEmployee = currentUser?.role === 'EMPLOYEE';

  const menuItems = [
    { id: 'radar', label: 'Pending Radar', icon: Radar, badge: pendingCount > 0 ? pendingCount : null, color: 'text-cyan-400' },
    { id: 'tasks', label: isEmployee ? 'My Assigned Tasks' : 'Operational Tasks', icon: CheckSquare, badge: tasksCount > 0 ? tasksCount : null, color: 'text-indigo-400' },
    { id: 'my-requests', label: 'My Requests', icon: Inbox },
    { id: 'all-requests', label: isManager ? 'Department Requests' : 'All Requests', icon: Layers },
    { id: 'approvals', label: 'Approvals', icon: Briefcase, badge: approvalsCount > 0 ? approvalsCount : null, color: 'text-amber-400' },
    { id: 'departments', label: (isSuperAdmin || isOrgAdmin) ? 'Department Setup' : 'Departments', icon: Building2 },
    { id: 'workflows', label: 'Workflow Engine', icon: GitBranch },
    ...((isSuperAdmin || isOrgAdmin || isManager) ? [{ id: 'audit', label: 'Audit Trail', icon: Shield }] : []),
    { id: 'analytics', label: 'Operational Analytics', icon: BarChart3 }
  ];

  return (
    <aside className="hidden w-64 flex-col border-r border-slate-800 bg-[#0b0f19] p-4 lg:flex justify-between shrink-0">
      <div className="space-y-5">
        {/* Create Request CTA */}
        <button
          onClick={onOpenCreate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 active:scale-98"
        >
          <Plus className="h-4 w-4" />
          <span>New Request</span>
        </button>

        {/* Navigation Items */}
        <nav className="space-y-1">
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            WorkPulse Navigation
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition ${
                  isActive
                    ? 'bg-slate-800/90 text-white shadow-sm ring-1 ring-white/10'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 transition ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && item.badge !== undefined && item.badge > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    item.id === 'radar' ? 'bg-cyan-500/20 text-cyan-300' :
                    item.id === 'tasks' ? 'bg-indigo-500/20 text-indigo-300' :
                    'bg-amber-500/20 text-amber-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Pulse AI dedicated shortcut */}
        <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-indigo-950/40 to-slate-900/60 p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
            <Bot className="h-4 w-4 text-cyan-400" />
            <span>Pulse AI Copilot</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Authorized query engine: <em>"How many IT requests are pending?"</em>
          </p>
          <button
            onClick={onOpenPulseAi}
            className="w-full rounded-lg bg-indigo-500/20 border border-indigo-500/30 py-1.5 text-center text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/30"
          >
            Launch Assistant
          </button>
        </div>
      </div>

      {/* Scope status */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-xs space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-emerald-400" />
            <span>Security Scope</span>
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>
        <p className="text-[10px] text-slate-400">
          Role: <strong className="text-white">{currentUser?.role}</strong>
        </p>
        <p className="text-[10px] text-slate-400 truncate">
          Dept: <strong className="text-white">{currentUser?.departmentId || 'All (Admin)'}</strong>
        </p>
      </div>
    </aside>
  );
};
