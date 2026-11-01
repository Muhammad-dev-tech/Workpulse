import React, { useState, useEffect } from 'react';
import { UserPersona, NotificationItem } from '../../types';
import { Bot, Search, Bell, ChevronDown, LogOut, Globe, Menu, X, Activity, Building2, Shield, User, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { getTerminology } from '../../terminology';

interface NavbarProps {
  currentUser: UserPersona | null;
  onOpenPulseAi: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenRequest?: (requestId: string) => void;
  onLogout?: () => void;
  currentOrgScope?: string;
  onOrgScopeChange?: (orgId: string) => void;
  availableOrgs?: Array<{ id: string; name: string; orgType?: string }>;
  onToggleMobileMenu?: () => void;
  mobileMenuOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onOpenPulseAi,
  searchQuery,
  onSearchChange,
  onOpenRequest,
  onLogout,
  currentOrgScope = 'ALL',
  onOrgScopeChange,
  availableOrgs = [],
  onToggleMobileMenu,
  mobileMenuOpen = false
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (currentUser) {
      loadNotifications();
    }
  }, [currentUser]);

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch {
      // Handled gracefully
    }
  };

  const handleMarkAsRead = async (id: string, link?: string) => {
    await api.markNotificationRead(id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    if (link && onOpenRequest) {
      onOpenRequest(link);
      setNotifOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-semibold';
      case 'ORG_ADMIN':
        return 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
      case 'DEAN':
        return 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      case 'MANAGER':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'OPERATOR':
        return 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const terms = getTerminology(currentUser?.organizationType, currentUser?.organizationName, currentUser);

  const getRoleTitle = (role: string) => {
    if (role === 'SUPER_ADMIN') return 'Platform Super Admin';
    return terms.roles[role as keyof typeof terms.roles] || role;
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b0f19]/95 px-4 sm:px-6 backdrop-blur-sm transition-colors">
      {/* Left: Mobile Toggle & Brand */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="flex lg:hidden items-center justify-center h-8 w-8 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs shrink-0">
            <Activity className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-slate-900 dark:text-white text-sm">WorkPulse</span>
              {currentUser?.role === 'SUPER_ADMIN' ? (
                <div className="flex items-center gap-1.5 ml-1">
                  <Globe className="h-3 w-3 text-indigo-500 shrink-0" />
                  <select
                    value={currentOrgScope || 'ALL'}
                    onChange={(e) => onOrgScopeChange && onOrgScopeChange(e.target.value)}
                    className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer max-w-[160px] sm:max-w-[200px] truncate"
                    title="Platform Super Admin Organization View"
                  >
                    <option value="ALL">All Organizations</option>
                    {(availableOrgs || []).map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="hidden sm:inline-block rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase tracking-wide">
                  {currentUser?.organizationName || (terms.label === 'University' ? 'ZANGINA UNIVERSITY' : `${terms.label.toUpperCase()} WORKSPACE`)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Center: Search Field */}
      <div className="relative hidden w-72 md:block lg:w-96">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-3.5 w-3.5 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search requests, reference IDs, departments..."
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/60 py-1.5 pl-8 pr-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 transition-colors focus:border-emerald-600 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Pulse AI Button */}
        <button
          onClick={onOpenPulseAi}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition"
          title="Open Pulse AI Assistant"
        >
          <Bot className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">Pulse AI</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setDropdownOpen(false);
            }}
            className="relative rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setNotifOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-lg z-50 p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 text-[10px] font-semibold border border-emerald-200 dark:border-emerald-800">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/40">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkAsRead(n.id, n.link)}
                        className={`pt-2 first:pt-0 p-2 rounded-lg text-left cursor-pointer transition text-xs ${
                          !n.read
                            ? 'bg-slate-50 dark:bg-slate-800/60 font-medium'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-900 dark:text-white text-[11px]">{n.title}</strong>
                          {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0"></span>}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">{n.message}</p>
                        <span className="text-[9px] text-slate-400 mt-1 block">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Profile Button & Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 sm:pr-2.5 text-left transition hover:border-slate-300 dark:hover:border-slate-700"
            aria-label="User profile menu"
          >
            <img
              src={currentUser?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&fit=crop"}
              alt={currentUser?.name || "User"}
              className="h-7 w-7 rounded-md object-cover ring-1 ring-slate-200 dark:ring-slate-700"
            />
            <div className="hidden flex-col sm:flex">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight truncate max-w-[120px]">
                {currentUser?.name}
              </span>
              <span className={`text-[9px] px-1 rounded inline-block w-fit mt-0.5 ${getRoleBadge(currentUser?.role || '')}`}>
                {getRoleTitle(currentUser?.role || '')}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400 ml-0.5" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xl z-50 p-3.5 space-y-3">
                {/* Header: Avatar, Name, Email, Role Title */}
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <img
                    src={currentUser?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser?.name || "User")}`}
                    alt={currentUser?.name || "User"}
                    className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {currentUser?.name}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {currentUser?.email}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md w-fit mt-1 border ${
                      currentUser?.role === 'SUPER_ADMIN'
                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                        : currentUser?.role === 'ORG_ADMIN'
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                        : currentUser?.role === 'DEAN'
                        ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                        : currentUser?.role === 'MANAGER'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}>
                      {getRoleTitle(currentUser?.role || '')}
                    </span>
                  </div>
                </div>

                {/* Role-Specific Context & Scope Details */}
                <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/80 p-2.5 space-y-2 text-xs">
                  {currentUser?.organizationName && (
                    <div className={`flex items-center justify-between text-[11px] ${
                      currentUser?.role !== 'ORG_ADMIN' ? 'pb-1.5 border-b border-slate-200/60 dark:border-slate-800/60' : ''
                    }`}>
                      <span className="text-slate-500 dark:text-slate-400">Organization:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[155px]">
                        {currentUser.organizationName}
                      </span>
                    </div>
                  )}

                  {currentUser?.role === 'SUPER_ADMIN' ? (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Privilege:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        Multi-Tenant Authority
                      </span>
                    </div>
                  ) : currentUser?.role === 'ORG_ADMIN' ? (
                    null
                  ) : currentUser?.role === 'DEAN' ? (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Assigned {terms.division}:</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-300 truncate max-w-[155px]">
                        {currentUser.faculty || 'General ' + terms.division}
                      </span>
                    </div>
                  ) : currentUser?.role === 'MANAGER' ? (
                    <>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">Assigned {terms.unit}:</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300 truncate max-w-[155px]">
                          {currentUser.departmentName || (currentUser.departmentId ? currentUser.departmentId.replace('dept-', '').toUpperCase() : 'Unassigned')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">Position:</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          Head of {terms.unit}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">Assigned {terms.unit}:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[155px]">
                          {currentUser?.departmentName || (currentUser?.departmentId ? currentUser.departmentId.replace('dept-', '').toUpperCase() : 'General Member')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">Access Level:</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {getRoleTitle(currentUser?.role || '')}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Sign Out Action */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  {onLogout && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
