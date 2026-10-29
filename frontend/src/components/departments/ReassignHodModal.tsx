import React, { useState } from 'react';
import { X, ShieldCheck, UserMinus, UserCheck, AlertCircle, Check } from 'lucide-react';
import { Department, UserPersona } from '../../types';
import { api } from '../../services/api';
import { getTerminology } from '../../terminology';

interface ReassignHodModalProps {
  department: Department;
  personas: UserPersona[];
  currentUser: UserPersona;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReassignHodModal: React.FC<ReassignHodModalProps> = ({
  department,
  personas,
  currentUser,
  onClose,
  onSuccess
}) => {
  const terms = getTerminology(currentUser.organizationType, currentUser.organizationName);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [actionType, setActionType] = useState<'REASSIGN' | 'VACATE'>('REASSIGN');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter candidates eligible for HOD (academic staff / lecturers, excluding Super Admin / Org Admin)
  const candidates = personas.filter(
    (p) => p.role !== 'SUPER_ADMIN' && p.role !== 'ORG_ADMIN' && p.id !== department.managerId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      if (actionType === 'VACATE') {
        await api.reassignDepartmentManager(department.id, null);
        setFeedback({
          type: 'success',
          message: `${terms.roles.MANAGER} position for ${department.name} has been vacated. Former leadership transitioned to regular ${terms.roles.EMPLOYEE}.`
        });
      } else {
        if (!selectedUserId) {
          setFeedback({ type: 'error', message: `Please select a new ${terms.roles.MANAGER} candidate.` });
          setSubmitting(false);
          return;
        }
        await api.reassignDepartmentManager(department.id, selectedUserId);
        const newMgr = personas.find(p => p.id === selectedUserId);
        setFeedback({
          type: 'success',
          message: `Successfully appointed ${newMgr?.name || 'new candidate'} as ${terms.roles.MANAGER} for ${department.name}. Former leadership transitioned to ${terms.roles.EMPLOYEE}.`
        });
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update leadership.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Leadership Turnover & Promotion
              </h3>
              <p className="text-xs text-slate-500">
                Manage {terms.roles.MANAGER} appointment for <strong className="text-slate-800 dark:text-slate-200">{department.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Current Leadership Status Callout */}
        <div className="px-5 pt-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium uppercase tracking-wider">
                Current {terms.roles.MANAGER}
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block">
                {department.managerName || 'No active ' + terms.roles.MANAGER + ' assigned'}
              </span>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              department.managerId
                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            }`}>
              {department.managerId ? 'Active In Office' : 'Vacant Position'}
            </span>
          </div>
        </div>

        {feedback && (
          <div className="mx-5 mt-3">
            <div
              className={`rounded-lg p-3 text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {feedback.type === 'success' ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Action Mode Selection */}
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-semibold block">
              Turnover Scenario *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                onClick={() => setActionType('REASSIGN')}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  actionType === 'REASSIGN'
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <UserCheck className={`h-4 w-4 mt-0.5 shrink-0 ${actionType === 'REASSIGN' ? 'text-blue-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold text-xs block text-slate-900 dark:text-white">
                    Appoint Successor
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                    Promote new staff & step down predecessor to regular staff.
                  </span>
                </div>
              </label>

              <label
                onClick={() => setActionType('VACATE')}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  actionType === 'VACATE'
                    ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/30 ring-1 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <UserMinus className={`h-4 w-4 mt-0.5 shrink-0 ${actionType === 'VACATE' ? 'text-amber-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold text-xs block text-slate-900 dark:text-white">
                    Retirement / Vacate
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                    Step down current HOD without appointing an immediate successor.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {actionType === 'REASSIGN' && (
            <div className="space-y-1.5 animate-in fade-in">
              <label className="text-slate-700 dark:text-slate-300 font-semibold block">
                Select Successor {terms.roles.MANAGER} *
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required={actionType === 'REASSIGN'}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
              >
                <option value="">-- Choose Candidate from Academic Staff --</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email}) {c.departmentName ? `— Dept: ${c.departmentName}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 leading-normal">
                Selecting this candidate automatically promotes them to {terms.roles.MANAGER} of {department.name}. If a predecessor exists, their role automatically transitions back to regular {terms.roles.EMPLOYEE}.
              </p>
            </div>
          )}

          {actionType === 'VACATE' && (
            <div className="rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 p-3 text-xs text-amber-800 dark:text-amber-300 leading-normal">
              <strong>Leadership Transition Note:</strong> The current {terms.roles.MANAGER} ({department.managerName || 'Unassigned'}) will step down and be registered as regular academic staff ({terms.roles.EMPLOYEE}). The department will operate with open queue triage until a new HOD is appointed.
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (actionType === 'REASSIGN' && !selectedUserId)}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white shadow-xs transition"
            >
              {submitting ? 'Applying Leadership Change...' : actionType === 'VACATE' ? 'Confirm Step Down' : 'Appoint New ' + terms.roles.MANAGER}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
