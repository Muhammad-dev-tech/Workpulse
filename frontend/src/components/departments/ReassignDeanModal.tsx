import React, { useState } from 'react';
import { X, GraduationCap, UserMinus, UserCheck, AlertCircle, Check } from 'lucide-react';
import { Faculty, UserPersona } from '../../types';
import { api } from '../../services/api';
import { getTerminology } from '../../terminology';

interface ReassignDeanModalProps {
  faculty: Faculty;
  personas: UserPersona[];
  currentUser: UserPersona;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReassignDeanModal: React.FC<ReassignDeanModalProps> = ({
  faculty,
  personas,
  currentUser,
  onClose,
  onSuccess
}) => {
  const terms = getTerminology(currentUser.organizationType, currentUser.organizationName, currentUser);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [actionType, setActionType] = useState<'REASSIGN' | 'VACATE'>('REASSIGN');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Candidates for Dean: senior academic members, professors, or existing lecturers (exclude Super Admin / Org Admin)
  const candidates = personas.filter(
    (p) => p.role !== 'SUPER_ADMIN' && p.role !== 'ORG_ADMIN' && p.id !== faculty.deanId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      if (actionType === 'VACATE') {
        await api.reassignFacultyDean(faculty.name, null);
        setFeedback({
          type: 'success',
          message: `${terms.roles.DEAN} position for ${faculty.name} has been vacated. Former Dean transitioned to regular academic staff.`
        });
      } else {
        if (!selectedUserId) {
          setFeedback({ type: 'error', message: `Please select a new ${terms.roles.DEAN} candidate.` });
          setSubmitting(false);
          return;
        }
        await api.reassignFacultyDean(faculty.name, selectedUserId);
        const newDean = personas.find(p => p.id === selectedUserId);
        setFeedback({
          type: 'success',
          message: `Successfully appointed ${newDean?.name || 'candidate'} as ${terms.roles.DEAN} of ${faculty.name}. Former Dean transitioned back to academic staff.`
        });
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update Dean leadership.' });
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Faculty Executive Leadership Turnover
              </h3>
              <p className="text-xs text-slate-500">
                Manage {terms.roles.DEAN} appointment for <strong className="text-slate-800 dark:text-slate-200">{faculty.name}</strong>
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

        {/* Current Dean Status Callout */}
        <div className="px-5 pt-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium uppercase tracking-wider">
                Current {terms.roles.DEAN}
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block">
                {faculty.deanName || 'No ' + terms.roles.DEAN + ' currently assigned'}
              </span>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              faculty.deanId
                ? 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            }`}>
              {faculty.deanId ? 'Active In Office' : 'Vacant Position'}
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
              Turnover Reason / Scenario *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                onClick={() => setActionType('REASSIGN')}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  actionType === 'REASSIGN'
                    ? 'border-purple-500 bg-purple-50/40 dark:bg-purple-950/30 ring-1 ring-purple-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <UserCheck className={`h-4 w-4 mt-0.5 shrink-0 ${actionType === 'REASSIGN' ? 'text-purple-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold text-xs block text-slate-900 dark:text-white">
                    Appoint Successor
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                    Appoint new Dean & transition predecessor back to department staff.
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
                    Retirement / Tenure End
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                    Step down current Dean without immediate successor.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {actionType === 'REASSIGN' && (
            <div className="space-y-1.5 animate-in fade-in">
              <label className="text-slate-700 dark:text-slate-300 font-semibold block">
                Select Successor {terms.roles.DEAN} *
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required={actionType === 'REASSIGN'}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-purple-600 focus:outline-none"
              >
                <option value="">-- Choose Candidate from Senior Academic Staff --</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email}) {c.departmentName ? `— Dept: ${c.departmentName}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 leading-normal">
                Promoting this candidate assigns them divisional executive authority over {faculty.name}. The previous Dean will automatically transition back to professorial / academic staff.
              </p>
            </div>
          )}

          {actionType === 'VACATE' && (
            <div className="rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 p-3 text-xs text-amber-800 dark:text-amber-300 leading-normal">
              <strong>Retirement / Step Down Notice:</strong> The current {terms.roles.DEAN} ({faculty.deanName || 'Unassigned'}) will conclude their tenure and be designated as regular academic staff ({terms.roles.EMPLOYEE}). Faculty operations and tier-2 approvals will escalate directly to the Vice-Chancellor until a new Dean is appointed.
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
              className="rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white shadow-xs transition"
            >
              {submitting ? 'Applying Leadership Change...' : actionType === 'VACATE' ? 'Confirm Step Down' : 'Appoint New ' + terms.roles.DEAN}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
