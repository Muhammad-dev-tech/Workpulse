import React from 'react';
import { RequestItem } from '../../types';
import {
  Clock,
  User,
  Building,
  Hourglass,
  HelpCircle,
  AlertTriangle,
  ChevronRight,
  Shield,
  CheckSquare,
  Calendar
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

  // SLA countdown calculation
  const getSlaInfo = () => {
    if (!request.dueDate || request.status === 'COMPLETED' || request.status === 'CANCELLED') return null;
    const dueDate = new Date(request.dueDate);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffMs < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: 'text-red-400' };
    if (diffHours < 4) return { label: `${diffHours}h left`, color: 'text-red-400' };
    if (diffHours < 24) return { label: `${diffHours}h left`, color: 'text-amber-400' };
    if (diffDays < 3) return { label: `${diffDays}d left`, color: 'text-amber-400' };
    return { label: `${diffDays}d left`, color: 'text-slate-400' };
  };

  const slaInfo = getSlaInfo();

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'HIGH': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'MEDIUM': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'WAITING': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'PENDING_APPROVAL': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'ACTIVE': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'COMPLETED': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'REJECTED': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'APPROVED': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      default: return 'bg-slate-700/40 text-slate-300 border-slate-600/30';
    }
  };

  const getBorderAccent = () => {
    if (isOverdue) return 'border-red-500/40 hover:border-red-500/60';
    if (isPendingApproval) return 'border-purple-500/30 hover:border-purple-500/50';
    if (request.status === 'WAITING') return 'border-amber-500/30 hover:border-amber-500/50';
    return 'border-slate-800 hover:border-indigo-500/40';
  };

  return (
    <div className={`glass-card rounded-2xl p-5 border transition flex flex-col justify-between space-y-4 ${getBorderAccent()}`}>
      {/* Top Meta: Request ID, Priority, Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
            {request.requestId}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getPriorityBadge(request.priority)}`}>
            {request.priority}
          </span>
          {isOverdue && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-red-500/20 text-red-300 border-red-500/40 animate-pulse">
              <AlertTriangle className="h-3 w-3" /> Overdue
            </span>
          )}
          {isPendingApproval && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-purple-500/20 text-purple-300 border-purple-500/30">
              <Shield className="h-3 w-3" /> Awaiting Sign-Off
            </span>
          )}
        </div>

        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shrink-0 ${getStatusBadge(request.status)}`}>
          {request.status.replace('_', ' ')}
        </span>
      </div>

      {/* Main Content: Title & Description */}
      <div>
        <h3
          onClick={() => onOpenDetails(request.id)}
          className="text-base font-bold text-white hover:text-indigo-300 transition cursor-pointer line-clamp-1"
        >
          {request.title}
        </h3>
        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
          {request.description}
        </p>
      </div>

      {/* Signature Feature: Waiting On Bottleneck Banner */}
      {request.waitingOn && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Hourglass className="h-4 w-4 text-amber-400 shrink-0 animate-spin-slow" />
            <span className="text-amber-200 text-xs truncate">
              <strong>Waiting on:</strong> {request.waitingOn}
            </span>
          </div>
          <button
            onClick={() => onWhyStuck(request)}
            className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/40 px-2 py-1 rounded-lg transition shrink-0 ml-2"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Why stuck?</span>
          </button>
        </div>
      )}

      {/* Footer Info: Department, Assignee, SLA, Tasks & View Action */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5" title="Department">
            <Building className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[11px] text-slate-300">{request.departmentName}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Assignee">
            <User className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[11px] text-slate-300">{request.assigneeName || 'Unassigned'}</span>
          </div>
          {activeTasks.length > 0 && (
            <div className="flex items-center gap-1" title="Active Tasks">
              <CheckSquare className="h-3.5 w-3.5 text-cyan-500" />
              <span className="text-[11px] text-cyan-400 font-semibold">{activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {slaInfo && (
            <div className={`flex items-center gap-1 ${slaInfo.color}`} title="SLA Deadline">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold">{slaInfo.label}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => onOpenDetails(request.id)}
          className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition shrink-0"
        >
          <span>Details</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
