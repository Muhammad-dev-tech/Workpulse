import React, { useState } from 'react';
import { X, Plus, Trash2, Building, ShieldCheck, CheckCircle2, UserCheck } from 'lucide-react';
import { api } from '../../services/api';
import { UserPersona } from '../../types';

interface CreateDepartmentModalProps {
  personas: UserPersona[];
  onClose: () => void;
  onCreated: () => void;
}

export const CreateDepartmentModal: React.FC<CreateDepartmentModalProps> = ({
  personas,
  onClose,
  onCreated
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');

  // Dynamic lists
  const [responsibilities, setResponsibilities] = useState<string[]>([
    'Technical Support',
    'Software Management',
    'Account Management'
  ]);
  const [newResp, setNewResp] = useState('');

  const [requestTypes, setRequestTypes] = useState<{ name: string; priority: string; approvalPolicy: string }[]>([
    { name: 'Technical Support', priority: 'HIGH', approvalPolicy: 'DIRECT' },
    { name: 'Software Installation', priority: 'MEDIUM', approvalPolicy: 'DIRECT' },
    { name: 'Account Access', priority: 'HIGH', approvalPolicy: 'EXECUTIVE_ONLY' }
  ]);
  const [newReqType, setNewReqType] = useState('');
  const [newReqPriority, setNewReqPriority] = useState('MEDIUM');
  const [newReqPolicy, setNewReqPolicy] = useState('DIRECT');

  const [taskTypes, setTaskTypes] = useState<string[]>([
    'Diagnose issue',
    'Install software',
    'Reset account',
    'Resolve technical problem'
  ]);
  const [newTaskType, setNewTaskType] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddResponsibility = () => {
    if (!newResp.trim()) return;
    if (!responsibilities.includes(newResp.trim())) {
      setResponsibilities([...responsibilities, newResp.trim()]);
    }
    setNewResp('');
  };

  const handleRemoveResponsibility = (idx: number) => {
    setResponsibilities(responsibilities.filter((_, i) => i !== idx));
  };

  const handleAddRequestType = () => {
    if (!newReqType.trim()) return;
    setRequestTypes([...requestTypes, { name: newReqType.trim(), priority: newReqPriority, approvalPolicy: newReqPolicy }]);
    setNewReqType('');
    setNewReqPolicy('DIRECT');
  };

  const handleRemoveRequestType = (idx: number) => {
    setRequestTypes(requestTypes.filter((_, i) => i !== idx));
  };

  const handleAddTaskType = () => {
    if (!newTaskType.trim()) return;
    if (!taskTypes.includes(newTaskType.trim())) {
      setTaskTypes([...taskTypes, newTaskType.trim()]);
    }
    setNewTaskType('');
  };

  const handleRemoveTaskType = (idx: number) => {
    setTaskTypes(taskTypes.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError('Department Name and Code are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      await api.createDepartment({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || `Operational department for ${name.trim()}`,
        managerId: managerId || undefined,
        responsibilities,
        requestTypes: requestTypes.map((rt, i) => ({
          id: `rt-${code.toLowerCase()}-${i + 1}`,
          name: rt.name,
          defaultPriority: rt.priority as any,
          approvalPolicy: rt.approvalPolicy as any,
          requiresApproval: rt.approvalPolicy !== 'DIRECT'
        })),
        taskTypes
      });

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create department');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0f172a] p-6 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400 border border-indigo-500/20">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Administrative Department Setup</h3>
              <p className="text-xs text-slate-400">Configure organizational unit, manager, responsibilities, request & task types</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-300">Department Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Information Technology"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Code (e.g. IT, FIN) *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="IT"
                required
                maxLength={6}
                className="w-full uppercase rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description & Operational Scope</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Technical support, infrastructure, software management, and account provisioning..."
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Manager Assignment */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
              <span>Assign Department Manager (from Eligible Users)</span>
            </label>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="">-- Select Registered User as Manager --</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.email}) — Current Role: {p.role}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              Backend will validate assignment, promote user to <strong>MANAGER</strong>, and bind their operational dashboard scope.
            </p>
          </div>

          {/* Department Responsibilities */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <label className="text-xs font-semibold text-slate-300">Department Responsibilities</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newResp}
                onChange={(e) => setNewResp(e.target.value)}
                placeholder="e.g. Software Management"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddResponsibility(); } }}
              />
              <button
                type="button"
                onClick={handleAddResponsibility}
                className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {responsibilities.map((resp, idx) => (
                <span key={idx} className="flex items-center gap-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs text-indigo-300">
                  {resp}
                  <button type="button" onClick={() => handleRemoveResponsibility(idx)} className="text-slate-400 hover:text-rose-400">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Configurable Request Types */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <label className="text-xs font-semibold text-slate-300">Configured Request Types</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newReqType}
                onChange={(e) => setNewReqType(e.target.value)}
                placeholder="e.g. Software Installation"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddRequestType(); } }}
              />
              <select
                value={newReqPriority}
                onChange={(e) => setNewReqPriority(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <select
                value={newReqPolicy}
                onChange={(e) => setNewReqPolicy(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-xs text-white focus:outline-none"
                title="Approval Policy"
              >
                <option value="DIRECT">Direct</option>
                <option value="DEPT_MANAGER">Manager Approval</option>
                <option value="EXECUTIVE_ONLY">Executive Only</option>
                <option value="MULTI_TIER_CHAIN">Multi-Tier</option>
              </select>
              <button
                type="button"
                onClick={handleAddRequestType}
                className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {requestTypes.map((rt, idx) => (
                <span key={idx} className="flex items-center gap-1 rounded-lg bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 text-xs text-purple-300">
                  {rt.name}
                  <span className="text-[10px] text-slate-400">({rt.priority})</span>
                  {rt.approvalPolicy !== 'DIRECT' && (
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 rounded">
                      {rt.approvalPolicy === 'EXECUTIVE_ONLY' ? 'Exec' : rt.approvalPolicy === 'DEPT_MANAGER' ? 'Mgr' : 'Chain'}
                    </span>
                  )}
                  <button type="button" onClick={() => handleRemoveRequestType(idx)} className="text-slate-400 hover:text-rose-400">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Configurable Task Types */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <label className="text-xs font-semibold text-slate-300">Operational Task Types</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskType}
                onChange={(e) => setNewTaskType(e.target.value)}
                placeholder="e.g. Install software"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTaskType(); } }}
              />
              <button
                type="button"
                onClick={handleAddTaskType}
                className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {taskTypes.map((tt, idx) => (
                <span key={idx} className="flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs text-emerald-300">
                  {tt}
                  <button type="button" onClick={() => handleRemoveTaskType(idx)} className="text-slate-400 hover:text-rose-400">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              {submitting ? 'Creating...' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
