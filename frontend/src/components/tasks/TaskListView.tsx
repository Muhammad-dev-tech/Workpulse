import React, { useState } from 'react';
import { CheckCircle2, Play, CheckSquare, ExternalLink } from 'lucide-react';
import { TaskItem, UserPersona } from '../../types';
import { api } from '../../services/api';

interface TaskListViewProps {
  tasks: TaskItem[];
  currentUser: UserPersona | null;
  onRefresh: () => void;
  onOpenRequest: (requestId: string) => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  currentUser,
  onRefresh,
  onOpenRequest
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [resultNotes, setResultNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'ALL') return true;
    return t.status === filterStatus;
  });

  const handleStartTask = async (task: TaskItem) => {
    try {
      setUpdating(true);
      await api.updateTask(task.id, { status: 'IN_PROGRESS' });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update task');
    } finally {
      setUpdating(false);
    }
  };

  const handleCompleteTask = async (task: TaskItem) => {
    try {
      setUpdating(true);
      await api.updateTask(task.id, {
        status: 'COMPLETED',
        resultNotes: resultNotes.trim() || 'Work completed as instructed.'
      });
      setCompletingTaskId(null);
      setResultNotes('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to complete task');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Tasks</span>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              {filteredTasks.length}
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
          {['ALL', 'TODO', 'IN_PROGRESS', 'COMPLETED'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                filterStatus === s
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 text-xs">
          No tasks found matching this criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredTasks.map((task) => {
            const isMyTask = task.assigneeId === currentUser?.id;
            const canAction = isMyTask || currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ORG_ADMIN';

            return (
              <div
                key={task.id}
                className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                        {task.taskId}
                      </span>
                      <button
                        onClick={() => onOpenRequest(task.requestId)}
                        className="flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                      >
                        <span>{task.requestId}</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate pt-1">{task.title}</h4>
                  </div>

                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                    task.status === 'COMPLETED'
                      ? 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      : task.status === 'IN_PROGRESS'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                  }`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>

                {task.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
                  <span>Assignee: <strong className="text-slate-700 dark:text-slate-300">{task.assigneeName}</strong></span>
                  <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-slate-600 dark:text-slate-300">
                    {task.taskType}
                  </span>
                </div>

                {task.resultNotes && (
                  <div className="rounded-md bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 p-2 text-xs space-y-0.5">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Resolution</span>
                    <p className="text-[11px] text-slate-800 dark:text-slate-200">{task.resultNotes}</p>
                  </div>
                )}

                {canAction && task.status !== 'COMPLETED' && (
                  <div className="pt-2 flex items-center justify-end gap-2">
                    {task.status === 'TODO' && (
                      <button
                        onClick={() => handleStartTask(task)}
                        disabled={updating}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition"
                      >
                        <Play className="h-3 w-3" />
                        <span>Start Working</span>
                      </button>
                    )}

                    {task.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => {
                          setCompletingTaskId(task.id);
                          setResultNotes('');
                        }}
                        disabled={updating}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Mark Completed</span>
                      </button>
                    )}
                  </div>
                )}

                {completingTaskId === task.id && (
                  <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 space-y-2 mt-2">
                    <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Resolution Notes
                    </label>
                    <textarea
                      value={resultNotes}
                      onChange={(e) => setResultNotes(e.target.value)}
                      placeholder="e.g. Inspected, replaced fuse, and verified operation."
                      rows={2}
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setCompletingTaskId(null)}
                        className="rounded-md border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCompleteTask(task)}
                        disabled={updating}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        {updating ? 'Saving...' : 'Confirm Completion'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
