import React from 'react';
import { RequestItem } from '../../types';
import { AlertCircle, Clock, ArrowRight, User, Building, X, ExternalLink } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="glass-dropdown relative w-full max-w-lg rounded-3xl p-6 border border-amber-500/30 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-400">{request.requestId}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  Bottleneck Analysis
                </span>
              </div>
              <h2 className="text-base font-bold text-white leading-tight mt-0.5">{request.title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Bottleneck Spotlight */}
        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-slate-900/80 to-slate-950 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
              Exact Progress Blocker
            </span>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              Since {request.waitingSince ? new Date(request.waitingSince).toLocaleDateString() : 'recent'}
            </span>
          </div>

          <div className="text-lg font-extrabold text-white">
            Waiting on: <span className="text-amber-300 underline decoration-amber-500/50">{request.waitingOn || 'Vendor response'}</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            The request cannot move forward to next stage until the external quotation is received and validated by the Procurement team.
          </p>
        </div>

        {/* Diagnostic Breakdown */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Operational Handoff Context</h4>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-1">
              <span className="text-[11px] text-slate-400 block">Current Stage</span>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-indigo-400" />
                {request.departmentName || 'Procurement'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-1">
              <span className="text-[11px] text-slate-400 block">Assigned Owner</span>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-cyan-400" />
                {request.assigneeName || 'Ibrahim Al-Mansoor'}
              </div>
            </div>
          </div>

          {previousTransition && (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-xs flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                <ArrowRight className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-slate-400 block text-[10px]">Previous Stage Hand-off</span>
                <span className="font-medium text-slate-200 block truncate">{previousTransition.title}: {previousTransition.details}</span>
              </div>
            </div>
          )}
        </div>

        {/* Next Action & CTA */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-xs text-slate-400">
            Next Action: <strong className="text-white">Procurement is waiting for supplier quotation</strong>
          </span>
          <button
            onClick={() => {
              onClose();
              onViewDetails(request.id);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition"
          >
            <span>Open Full Details</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
