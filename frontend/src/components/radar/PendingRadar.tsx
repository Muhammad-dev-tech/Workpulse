import React from 'react';
import { PendingRadarData, UserPersona } from '../../types';
import { getTerminology } from '../../terminology';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Hourglass,
  TrendingUp,
  Building2,
  UserCheck
} from 'lucide-react';

interface PendingRadarProps {
  radar: PendingRadarData | null;
  currentUser?: UserPersona | null;
  onFilterSelect: (filter: string) => void;
  activeFilter: string;
}

export const PendingRadar: React.FC<PendingRadarProps> = ({
  radar,
  currentUser,
  onFilterSelect,
  activeFilter
}) => {
  const terms = getTerminology(currentUser?.organizationType, currentUser?.organizationName, currentUser);
  if (!radar) return null;

  const statCards = [
    {
      id: 'active',
      title: 'Active Work',
      count: radar.totalActive,
      icon: TrendingUp,
      iconBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
    },
    {
      id: 'overdue',
      title: 'Overdue',
      count: radar.overdueCount,
      icon: AlertTriangle,
      iconBg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
    },
    {
      id: 'waiting',
      title: 'Waiting on Blockers',
      count: radar.waitingCount,
      icon: Hourglass,
      iconBg: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
    },
    {
      id: 'approvals',
      title: 'Pending Approvals',
      count: radar.pendingApprovalCount,
      icon: Clock,
      iconBg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
    },
    {
      id: 'assigned-me',
      title: 'Assigned to Me',
      count: radar.assignedToMeCount,
      icon: UserCheck,
      iconBg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    },
    {
      id: 'completed-today',
      title: 'Completed Today',
      count: radar.completedTodayCount,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const isSelected = activeFilter === stat.id;
          return (
            <button
              key={stat.id}
              onClick={() => onFilterSelect(isSelected ? '' : stat.id)}
              className={`flex flex-col justify-between rounded-lg p-3 text-left transition border bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 ${
                isSelected
                  ? 'border-emerald-600 dark:border-emerald-500 ring-1 ring-emerald-600 dark:ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                  {stat.title}
                </span>
                <div className={`p-1.5 rounded-md ${stat.iconBg}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {stat.count}
              </div>
            </button>
          );
        })}
      </div>

      {/* Department Workload Distribution */}
      {radar.departmentWorkload.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span>{terms.unit} Workloads</span>
            </h3>
            <span className="text-[11px] text-slate-500">Active vs Waiting</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {radar.departmentWorkload.map((dept) => {
              const hasWaiting = dept.waiting > 0;
              return (
                <div
                  key={dept.id}
                  className="rounded-lg border border-slate-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-900 dark:text-slate-200 truncate">{dept.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">{dept.code}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                    <div
                      className="bg-emerald-600 h-full transition-all"
                      style={{ width: `${Math.min(100, (dept.totalActive / 6) * 100)}%` }}
                    />
                    {hasWaiting && (
                      <div
                        className="bg-amber-500 h-full"
                        style={{ width: `${Math.min(100, (dept.waiting / dept.totalActive) * 100)}%` }}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{dept.totalActive} active</span>
                    {hasWaiting ? (
                      <span className="text-amber-700 dark:text-amber-400 font-medium">{dept.waiting} waiting</span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">On track</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
