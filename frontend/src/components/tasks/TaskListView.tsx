import React, { useState } from 'react';
import { CheckCircle2, Clock, Play, AlertCircle, FileText, CheckSquare, ExternalLink } from 'lucide-react';
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
      alert(err.message || 'Failed to start task');
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
      {/* Subheader and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-indigo-400" />
            <span>Operational Tasks</span>
            <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
              {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            {currentUser?.role === 'EMPLOYEE'
              ? 'Tasks assigned directly to you by department managers.'
              : 'Active operational work dispatched across department requests.'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800 text-xs">
          {['ALL', 'TODO', 'IN_PROGRESS', 'COMPLETED'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                filterStatus === s
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-500 space-y-1">
          <CheckSquare className="h-6 w-6 mx-auto text-slate-600" />
          <p className="text-sm font-medium">No tasks found matching this criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map((task) => {
            const isMyTask = task.assigneeId === currentUser?.id;
            const canAction = isMyTask || currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ORG_ADMIN';

            return (
              <div
                key={task.id}
                className="glass-panel rounded-2xl border border-slate-800 p-4 space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">{task.taskId}</span>
                      <button
                        onClick={() => onOpenRequest(task.requestId)}
                        className="flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-400 hover:text-indigo-300 transition"
                      >
                        <span>{task.requestId}</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                    <h4 className="text-sm font-bold text-white leading-snug">{task.title}</h4>
                  </div>

                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    task.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : task.status === 'IN_PROGRESS'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>

                {task.description && (
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Assignee:</span>
                    <strong className="text-slate-300">{task.assigneeName}</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Type:</span>
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 text-slate-300 border border-slate-800">
                      {task.taskType}
                    </span>
                  </div>
                </div>

                {task.resultNotes && (
                  <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5 text-xs text-slate-300 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resolution Notes:</span>
                    <p className="text-[11px] text-emerald-300">{task.resultNotes}</p>
                  </div>
                )}

                {/* Task Actions */}
                {canAction && task.status !== 'COMPLETED' && (
                  <div className="pt-2 flex items-center justify-end gap-2">
                    {task.status === 'TODO' && (
                      <button
                        onClick={() => handleStartTask(task)}
                        disabled={updating}
                        className="flex items-center gap-1.5 rounded-xl bg-cyan-600/20 border border-cyan-500/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-600/30 transition"
                      >
                        <Play className="h-3.5 w-3.5" />
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
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 transition"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Mark Completed</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Inline Complete Notes Dialog */}
                {completingTaskId === task.id && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-2 mt-2">
                    <label className="text-[11px] font-semibold text-emerald-300">
                      Resolution Notes & Verification
                    </label>
                    <textarea
                      value={resultNotes}
                      onChange={(e) => setResultNotes(e.target.value)}
                      placeholder="e.g. Verified license server ping, created AWS IAM token, and validated client machine."
                      rows={2}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setCompletingTaskId(null)}
                        className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCompleteTask(task)}
                        disabled={updating}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-500"
                      >
                        {updating ? 'Saving...' : 'Submit Resolution'}
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
