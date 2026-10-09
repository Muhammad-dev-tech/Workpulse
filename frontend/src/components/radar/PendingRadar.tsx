import React from 'react';
import { PendingRadarData } from '../../types';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Hourglass,
  ArrowUpRight,
  TrendingUp,
  Building,
  UserCheck
} from 'lucide-react';

interface PendingRadarProps {
  radar: PendingRadarData | null;
  onFilterSelect: (filter: string) => void;
  activeFilter: string;
}

export const PendingRadar: React.FC<PendingRadarProps> = ({
  radar,
  onFilterSelect,
  activeFilter
}) => {
  if (!radar) return null;

  const statCards = [
    {
      id: 'active',
      title: 'Total Active Work',
      count: radar.totalActive,
      icon: TrendingUp,
      color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400',
      description: 'Active cross-departmental tasks'
    },
    {
      id: 'overdue',
      title: 'Overdue Items',
      count: radar.overdueCount,
      icon: AlertTriangle,
      color: 'from-rose-500/20 to-red-500/10 border-rose-500/30 text-rose-400',
      description: 'Past SLA target resolution'
    },
    {
      id: 'waiting',
      title: 'Waiting on Blockers',
      count: radar.waitingCount,
      icon: Hourglass,
      color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-400',
      description: 'External or supplier dependencies'
    },
    {
      id: 'approvals',
      title: 'Awaiting Approvals',
      count: radar.pendingApprovalCount,
      icon: Clock,
      color: 'from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-400',
      description: 'Manager/Finance sign-offs'
    },
    {
      id: 'assigned-me',
      title: 'Assigned to Me',
      count: radar.assignedToMeCount,
      icon: UserCheck,
      color: 'from-cyan-500/20 to-teal-500/10 border-cyan-500/30 text-cyan-400',
      description: 'Your direct actionable tasks'
    },
    {
      id: 'completed-today',
      title: 'Completed Today',
      count: radar.completedTodayCount,
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30 text-emerald-400',
      description: 'Successfully closed workflows'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Title and Pulse Indicator */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Pending Radar</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-400">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping"></span>
              Live Operational Picture
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time status of organizational pipelines, bottlenecks, and departmental workloads.
          </p>
        </div>
      </div>

      {/* Grid of Key Radar Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const isSelected = activeFilter === stat.id;
          return (
            <button
              key={stat.id}
              onClick={() => onFilterSelect(isSelected ? '' : stat.id)}
              className={`glass-card flex flex-col justify-between rounded-2xl p-4 text-left transition-all duration-200 border bg-gradient-to-br ${stat.color} ${
                isSelected ? 'ring-2 ring-indigo-400 shadow-glow-indigo' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 opacity-90" />
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 opacity-60" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold tracking-tight text-white block">
                  {stat.count}
                </span>
                <span className="text-[11px] font-medium text-slate-300 block line-clamp-1">
                  {stat.title}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Department Workload Distribution Bars */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Department Workload Distribution</h3>
          </div>
          <span className="text-[11px] text-slate-400">Active tasks vs. Blocked</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          {radar.departmentWorkload.map((dept) => {
            const hasWaiting = dept.waiting > 0;
            return (
              <div key={dept.id} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">{dept.name}</span>
                  <span className="text-[10px] font-bold text-slate-400">{dept.code}</span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-400">Active Requests:</span>
                  <span className="font-bold text-white">{dept.totalActive}</span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden flex">
                  <div
                    className="bg-indigo-500 h-full transition-all"
                    style={{ width: `${Math.min(100, (dept.totalActive / 6) * 100)}%` }}
                  />
                  {hasWaiting && (
                    <div
                      className="bg-amber-500 h-full"
                      style={{ width: `${Math.min(100, (dept.waiting / dept.totalActive) * 100)}%` }}
                    />
                  )}
                </div>
                {hasWaiting ? (
                  <span className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
                    <Hourglass className="h-3 w-3" /> {dept.waiting} waiting on blockers
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Pipeline running smoothly
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
