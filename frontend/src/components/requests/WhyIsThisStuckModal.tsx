import React from 'react';
import { RequestItem } from '../../types';
import { AlertCircle, Clock, Building2, User, X, ArrowRight } from 'lucide-react';

interface WhyIsThisStuckModalProps {
  request: RequestItem | null;
  onClose: () => void;
  onViewDetails: (id: string) => void;
}

export const WhyIsThisStuckModal: React.FC<WhyIsThisStuckModalProps> = ({
  request,
  onClose,
  onViewDetails
}) => {
  if (!request) return null;

  const previousTransition = request.timeline
    .filter(t => t.eventType === 'STAGE_TRANSITION' || t.eventType === 'APPROVAL')
    .slice(-1)[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md rounded-xl p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {request.requestId}
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">Bottleneck Details</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Blocker Card */}
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-400 font-medium">
            <span>Progress Blocker</span>
            <span className="flex items-center gap-1 text-slate-500">
              <Clock className="h-3 w-3" />
              <span>Since {request.waitingSince ? new Date(request.waitingSince).toLocaleDateString() : 'recent'}</span>
            </span>
          </div>
          <div className="text-sm font-bold text-amber-950 dark:text-amber-100">
            Waiting on: {request.waitingOn || 'Pending external response'}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            This request cannot advance to the next workflow stage until this item is resolved.
          </p>
        </div>

        {/* Operational Context */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-2.5 space-y-0.5">
            <span className="text-[10px] text-slate-400">Department</span>
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <Building2 className="h-3 w-3 text-slate-400" />
              <span className="truncate">{request.departmentName}</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-2.5 space-y-0.5">
            <span className="text-[10px] text-slate-400">Assigned Owner</span>
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <User className="h-3 w-3 text-slate-400" />
              <span className="truncate">{request.assigneeName || 'Unassigned'}</span>
            </div>
          </div>
        </div>

        {previousTransition && (
          <div className="rounded-lg border border-slate-150 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/30 p-2.5 text-xs flex items-center gap-2">
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block">Previous Action</span>
              <span className="text-slate-700 dark:text-slate-300 truncate block font-medium">
                {previousTransition.title}: {previousTransition.details}
              </span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onViewDetails(request.id);
            }}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition"
          >
            Open Request Details
          </button>
        </div>
      </div>
    </div>
  );
};
