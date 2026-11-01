import React, { useState } from 'react';
import { X, CheckSquare } from 'lucide-react';
import { api } from '../../services/api';
import { RequestItem, UserPersona, Department } from '../../types';
import { getTerminology } from '../../terminology';

interface AssignTaskModalProps {
  request: RequestItem;
  department?: Department;
  personas: UserPersona[];
  currentUser?: UserPersona | null;
  onClose: () => void;
  onAssigned: () => void;
}

export const AssignTaskModal: React.FC<AssignTaskModalProps> = ({
  request,
  department,
  personas,
  currentUser,
  onClose,
  onAssigned
}) => {
  const terms = getTerminology(currentUser?.organizationType, currentUser?.organizationName, currentUser);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState(department?.taskTypes[0] || 'Diagnose issue');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const deptEmployeeIds = new Set(department?.employeeIds || []);
  const eligibleAssignees = personas.filter(p =>
    p.id !== currentUser?.id &&
    p.role !== 'SUPER_ADMIN' &&
    p.role !== 'ORG_ADMIN' &&
    p.role !== 'DEAN' &&
    (p.departmentId === request.departmentId || deptEmployeeIds.has(p.id))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !assigneeId) {
      setError('Task title and assignee are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      await api.createTask({
        requestId: request.requestId,
        title: title.trim(),
        description: description.trim(),
        taskType,
        assigneeId,
        dueDate: dueDate || undefined
      });

      onAssigned();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to assign task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 sm:p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Assign Task</h3>
            <p className="text-xs text-slate-500">{request.requestId}: {request.title}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Inspect projector power unit"
              required
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Task Type</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
              >
                {(department?.taskTypes || ['Diagnose issue', 'Install software', 'Reset account', 'Resolve technical problem']).map((tt) => (
                  <option key={tt} value={tt}>{tt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Assignee *</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
              >
                <option value="">
                  {eligibleAssignees.length === 0
                    ? `-- No staff in ${request.departmentName || terms.unit} --`
                    : '-- Select Member --'}
                </option>
                {eligibleAssignees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({terms.roles[p.role] || p.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Instructions</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions or diagnostic notes..."
              rows={2}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Target Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 font-semibold text-white shadow-xs disabled:opacity-50 transition"
            >
              {submitting ? 'Assigning...' : 'Assign Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
