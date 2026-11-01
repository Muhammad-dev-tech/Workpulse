import React from 'react';
import {
  Radar,
  Inbox,
  Layers,
  CheckSquare,
  Building2,
  GitBranch,
  BarChart3,
  Plus,
  Shield,
  Briefcase,
  Globe,
  Users,
  X,
  GraduationCap
} from 'lucide-react';
import { UserPersona } from '../../types';
import { getTerminology } from '../../terminology';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenCreate: () => void;
  onOpenPulseAi?: () => void;
  currentUser: UserPersona | null;
  pendingCount?: number;
  approvalsCount?: number;
  tasksCount?: number;
  pulseAiOpen?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenCreate,
  currentUser,
  pendingCount = 0,
  approvalsCount = 0,
  tasksCount = 0,
  mobileOpen = false,
  onCloseMobile
}) => {
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isOrgAdmin = currentUser?.role === 'ORG_ADMIN';
  const isDean = currentUser?.role === 'DEAN';
  const isManager = currentUser?.role === 'MANAGER';
  const isEmployee = currentUser?.role === 'EMPLOYEE';
  const isExecutiveTier = isSuperAdmin || isOrgAdmin || isDean;

  const terms = getTerminology(currentUser?.organizationType, currentUser?.organizationName, currentUser);

  // Operational items
  const operationalItems = [
    ...(isDean ? [
      { id: 'faculty-hub', label: `${terms.division} Hub`, icon: GraduationCap }
    ] : []),
    { id: 'radar', label: 'Pending Radar', icon: Radar, badge: pendingCount > 0 ? pendingCount : null },
    ...(!isExecutiveTier ? [
      { id: 'tasks', label: isEmployee ? 'Assigned Tasks' : `${terms.unit} Tasks`, icon: CheckSquare, badge: tasksCount > 0 ? tasksCount : null }
    ] : []),
    { id: 'my-requests', label: 'My Requests', icon: Inbox },
    ...((isSuperAdmin || isOrgAdmin || isDean || isManager) ? [
      { id: 'all-requests', label: isManager ? `${terms.unit} Requests` : isDean ? `${terms.division} Requests` : 'All Requests', icon: Layers }
    ] : []),
    ...((isSuperAdmin || isOrgAdmin || isDean || isManager) ? [
      {
        id: 'approvals',
        label: isDean ? `${terms.roles.DEAN} Approvals` : isManager ? `${terms.unit} Approvals` : 'Approvals',
        icon: Briefcase,
        badge: approvalsCount > 0 ? approvalsCount : null
      }
    ] : [])
  ];

  // Administration items
  const managementItems = [
    ...(isSuperAdmin ? [
      { id: 'organizations', label: 'All Organizations', icon: Globe }
    ] : []),
    ...((isSuperAdmin || isOrgAdmin) ? [
      { id: 'members', label: terms.label === 'University' ? 'University Staff & Roles' : `${terms.label} Members & Roles`, icon: Users },
      { id: 'departments', label: `${terms.unit} Setup`, icon: Building2 }
    ] : (isManager || isDean) ? [
      { id: 'departments', label: terms.units, icon: Building2 }
    ] : []),
    ...((isSuperAdmin || isOrgAdmin) ? [
      { id: 'workflows', label: 'Workflow Engine', icon: GitBranch }
    ] : []),
    ...((isSuperAdmin || isOrgAdmin || isDean) ? [
      { id: 'audit', label: 'Audit Trail', icon: Shield }
    ] : []),
    ...((isSuperAdmin || isOrgAdmin || isDean || isManager) ? [
      { id: 'analytics', label: 'Operational Analytics', icon: BarChart3 }
    ] : [])
  ];

  const handleItemClick = (id: string) => {
    onSelectTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between p-4 space-y-6">
      <div className="space-y-5">
        {/* Mobile Header with close button */}
        <div className="flex lg:hidden items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Navigation</span>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Primary Action Button */}
        <button
          onClick={() => {
            onOpenCreate();
            if (onCloseMobile) onCloseMobile();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Request</span>
        </button>

        {/* Operational Section */}
        <div className="space-y-1">
          <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Workflows
          </div>
          {operationalItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 transition ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== null && item.badge !== undefined && item.badge > 0 && (
                  <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold shrink-0 ${
                    item.id === 'approvals'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Management & Governance Section */}
        {managementItems.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Administration
            </div>
            {managementItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`h-4 w-4 shrink-0 transition ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Context Footer */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-2.5 text-xs space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <span>Active Tenant</span>
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {currentUser?.organizationName || 'System'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] lg:flex shrink-0 transition-colors">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={onCloseMobile}
          />
          <aside className="fixed inset-y-0 left-0 w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] shadow-xl animate-in slide-in-from-left duration-200 z-50">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
};
