import React from 'react';
import { RequestItem } from '../../types';
import {
  Clock,
  User,
  Building2,
  Hourglass,
  HelpCircle,
  AlertTriangle,
  ChevronRight,
  Shield,
  CheckSquare
} from 'lucide-react';

interface RequestCardProps {
  request: RequestItem;
  onOpenDetails: (id: string) => void;
  onWhyStuck: (req: RequestItem) => void;
}

export const RequestCard: React.FC<RequestCardProps> = ({
  request,
  onOpenDetails,
  onWhyStuck
}) => {
  const now = new Date();
  const isOverdue = request.dueDate && new Date(request.dueDate) < now && request.status !== 'COMPLETED';
  const isPendingApproval = request.status === 'PENDING_APPROVAL';
  const activeTasks = request.tasks ? request.tasks.filter(t => t.status !== 'COMPLETED') : [];

  // SLA countdown
  const getSlaInfo = () => {
    if (!request.dueDate || request.status === 'COMPLETED' || request.status === 'CANCELLED') return null;
    const dueDate = new Date(request.dueDate);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffMs < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: 'text-rose-600 dark:text-rose-400 font-semibold' };
    if (diffHours < 24) return { label: `${diffHours}h left`, color: 'text-amber-700 dark:text-amber-400 font-semibold' };
    return { label: `${diffDays}d left`, color: 'text-slate-500 dark:text-slate-400' };
  };

  const slaInfo = getSlaInfo();

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900';
      case 'HIGH':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
      case 'MEDIUM':
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700';
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'WAITING':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      case 'PENDING_APPROVAL':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'COMPLETED':
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  return (
    <div className="rounded-lg p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between space-y-3">
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            {request.requestId}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getPriorityBadge(request.priority)}`}>
            {request.priority}
          </span>
          {isOverdue && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
              <AlertTriangle className="h-3 w-3" /> Overdue
            </span>
          )}
          {isPendingApproval && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900">
              <Shield className="h-3 w-3" /> Awaiting Sign-off
            </span>
          )}
        </div>

        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadge(request.status)}`}>
          {request.status.replace('_', ' ')}
        </span>
      </div>

      {/* Main Content */}
      <div>
        <h3
          onClick={() => onOpenDetails(request.id)}
          className="text-sm font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer line-clamp-1"
        >
          {request.title}
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
          {request.description}
        </p>
      </div>

      {/* Waiting On Bottleneck Notice */}
      {request.waitingOn && (
        <div className="rounded-md border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <Hourglass className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-amber-900 dark:text-amber-200 text-xs truncate">
              <strong>Waiting on:</strong> {request.waitingOn}
            </span>
          </div>
          <button
            onClick={() => onWhyStuck(request)}
            className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:underline shrink-0 ml-2"
          >
            <HelpCircle className="h-3 w-3" />
            <span>Why stuck?</span>
          </button>
        </div>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1" title="Department">
            <Building2 className="h-3 w-3 text-slate-400" />
            <span className="text-[11px]">{request.departmentName}</span>
          </div>
          <div className="flex items-center gap-1" title="Assignee">
            <User className="h-3 w-3 text-slate-400" />
            <span className="text-[11px]">{request.assigneeName || 'Unassigned'}</span>
          </div>
          {activeTasks.length > 0 && (
            <div className="flex items-center gap-1" title="Active Tasks">
              <CheckSquare className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {slaInfo && (
            <div className={`flex items-center gap-1 ${slaInfo.color}`} title="SLA Deadline">
              <Clock className="h-3 w-3" />
              <span className="text-[11px]">{slaInfo.label}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => onOpenDetails(request.id)}
          className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition shrink-0"
        >
          <span>View</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
