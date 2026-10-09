import React, { useState, useEffect } from 'react';
import { UserPersona, NotificationItem } from '../../types';
import { Bot, Search, Bell, Sparkles, ChevronDown, Shield, Users, Check, ExternalLink, LogOut, Trash2 } from 'lucide-react';
import { api } from '../../services/api';

interface NavbarProps {
  currentUser: UserPersona | null;
  personas: UserPersona[];
  onSelectPersona: (email: string) => void;
  onOpenPulseAi: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenRequest?: (requestId: string) => void;
  onLogout?: () => void;
  onResetData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  personas,
  onSelectPersona,
  onOpenPulseAi,
  searchQuery,
  onSearchChange,
  onOpenRequest,
  onLogout,
  onResetData
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
    } catch (err) {
      console.error('Failed to load notifications:', err);
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
      case 'SUPER_ADMIN': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'ORG_ADMIN': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'MANAGER': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'OPERATOR': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default: return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-[#0b0f19]/80 px-6 backdrop-blur-md">
      {/* Brand & Organization */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 shadow-glow-indigo">
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-tight text-white text-base">WorkPulse</span>
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/30">
              ACME CORP
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Workflow & Operational Visibility</span>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative hidden w-80 lg:w-96 md:block">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search requests (REQ-XXXX, software, quotation)..."
          className="w-full rounded-xl border border-slate-700/60 bg-slate-900/60 py-2 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-400 transition-colors focus:border-indigo-500 focus:bg-slate-900 focus:outline-none"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Pulse AI Button */}
        <button
          onClick={onOpenPulseAi}
          className="group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 px-3.5 py-2 text-xs font-semibold text-white shadow-glow-indigo transition-all duration-200 hover:shadow-glow-cyan active:scale-95"
        >
          <Bot className="h-4 w-4 text-cyan-200 transition-transform group-hover:rotate-12" />
          <span>Pulse AI</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
          </span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setDropdownOpen(false);
            }}
            className="relative rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-slate-300 hover:text-white hover:border-slate-700 transition"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="glass-dropdown absolute right-0 mt-2 w-80 rounded-2xl p-3 z-50 animate-in fade-in zoom-in-95 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 text-[10px]">
                      {unreadCount} new
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1.5 divide-y divide-slate-800/40">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">No notifications yet.</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleMarkAsRead(n.id, n.link)}
                      className={`pt-1.5 first:pt-0 p-2 rounded-xl text-left cursor-pointer transition text-xs ${
                        !n.read ? 'bg-indigo-950/30 border border-indigo-500/20' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-white text-[11px]">{n.title}</strong>
                        {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">{n.message}</p>
                      <span className="text-[9px] text-slate-500 mt-1 block">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Persona Switcher for RBAC Demonstration */}
        <div className="relative">
          <button
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-1.5 pr-3 text-left transition hover:border-slate-700 active:scale-98"
          >
            <img
              src={currentUser?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&fit=crop"}
              alt={currentUser?.name || "User"}
              className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/10"
            />
            <div className="hidden flex-col sm:flex">
              <span className="text-xs font-medium text-slate-200 leading-tight">{currentUser?.name}</span>
              <span className={`text-[9px] uppercase font-bold tracking-wider px-1 rounded border inline-block w-fit mt-0.5 ${getRoleBadge(currentUser?.role || '')}`}>
                {currentUser?.role}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-1" />
          </button>

          {/* Persona Menu */}
          {dropdownOpen && (
            <div className="glass-dropdown absolute right-0 mt-2 w-80 rounded-2xl p-2 z-50 animate-in fade-in zoom-in-95 border border-slate-800">
              <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Switch Role / User (RBAC Enforced)</span>
                </span>
              </div>
              <div className="mt-1 max-h-80 overflow-y-auto space-y-1">
                {personas.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectPersona(p.email);
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition text-xs ${
                      currentUser?.id === p.id
                        ? 'bg-indigo-600/20 text-white font-medium border border-indigo-500/30'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <img src={p.avatarUrl} alt={p.name} className="h-7 w-7 rounded-lg object-cover shrink-0" />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate font-semibold text-slate-100">{p.name}</span>
                      <span className="text-[10px] text-slate-400 truncate">{p.email}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold shrink-0 ${getRoleBadge(p.role)}`}>
                      {p.role.split('_')[0]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Actions Footer */}
              <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1">
                {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ORG_ADMIN') && onResetData && (
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onResetData();
                    }}
                    className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold text-amber-400/90 hover:bg-amber-500/10 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-amber-400" />
                    <span>Wipe Demo Data (Start Afresh)</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold text-rose-400/90 hover:bg-rose-500/10 transition"
                  >
                    <LogOut className="h-3.5 w-3.5 text-rose-400" />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
