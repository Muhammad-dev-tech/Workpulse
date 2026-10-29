import React, { useState } from 'react';
import { X, Plus, Trash2, Building2, CheckCircle2, Shield, Landmark, Zap, ShieldCheck, GraduationCap, Crown, Layers, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { UserPersona, Faculty, ApprovalPolicy } from '../../types';
import { getTerminology } from '../../terminology';

interface CreateDepartmentModalProps {
  personas: UserPersona[];
  currentUser?: UserPersona | null;
  faculties?: Faculty[];
  initialFaculty?: string;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateDepartmentModal: React.FC<CreateDepartmentModalProps> = ({
  personas,
  currentUser,
  faculties = [],
  initialFaculty = '',
  onClose,
  onCreated
}) => {
  const terms = getTerminology(currentUser?.organizationType, currentUser?.organizationName);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState<string>(initialFaculty);
  const [isCreatingNewFaculty, setIsCreatingNewFaculty] = useState(false);
  const [newFacultyName, setNewFacultyName] = useState('');

  const [deptApprovalPolicy, setDeptApprovalPolicy] = useState<ApprovalPolicy>('DIRECT');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');

  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [newResp, setNewResp] = useState('');

  const [requestTypes, setRequestTypes] = useState<{ name: string; priority: string }[]>([]);
  const [newReqType, setNewReqType] = useState('');
  const [newReqPriority, setNewReqPriority] = useState('MEDIUM');

  const [taskTypes, setTaskTypes] = useState<string[]>([]);
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
    setRequestTypes([...requestTypes, { name: newReqType.trim(), priority: newReqPriority }]);
    setNewReqType('');
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
      setError(`${terms.unit} name and code are required.`);
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // Determine final faculty
      let finalFaculty = isCreatingNewFaculty ? newFacultyName.trim() : selectedFaculty.trim();
      if (!finalFaculty) {
        setError(`Every ${terms.unit.toLowerCase()} must be assigned to a parent ${terms.division.toLowerCase()}. Please select or create a ${terms.division.toLowerCase()}.`);
        setSubmitting(false);
        return;
      }

      if (isCreatingNewFaculty && newFacultyName.trim()) {
        try {
          await api.createFaculty({ name: newFacultyName.trim() });
        } catch {
          // If already exists or error, continue with the name
        }
      }

      const finalRequestTypes = [...requestTypes];
      if (newReqType.trim()) {
        finalRequestTypes.push({
          name: newReqType.trim(),
          priority: newReqPriority
        });
      }

      const finalResponsibilities = [...responsibilities];
      if (newResp.trim() && !finalResponsibilities.includes(newResp.trim())) {
        finalResponsibilities.push(newResp.trim());
      }

      const finalTaskTypes = [...taskTypes];
      if (newTaskType.trim() && !finalTaskTypes.includes(newTaskType.trim())) {
        finalTaskTypes.push(newTaskType.trim());
      }

      await api.createDepartment({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || `${terms.unit} for ${name.trim()}`,
        faculty: finalFaculty,
        approvalPolicy: deptApprovalPolicy,
        requiresApproval: deptApprovalPolicy !== 'DIRECT',
        managerId: managerId || undefined,
        responsibilities: finalResponsibilities,
        requestTypes: finalRequestTypes.map((rt, i) => ({
          id: `rt-${code.toLowerCase()}-${i + 1}`,
          name: rt.name,
          defaultPriority: rt.priority as any,
          approvalPolicy: deptApprovalPolicy,
          requiresApproval: deptApprovalPolicy !== 'DIRECT'
        })),
        taskTypes: finalTaskTypes
      });

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || `Failed to create ${terms.unit.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  };

  const policyCards: {
    id: ApprovalPolicy;
    title: string;
    badge: string;
    badgeColor: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'DIRECT',
      title: 'Direct Access',
      badge: 'Instant',
      badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      description: `Dispatches directly to ${terms.unit.toLowerCase()} queue without pre-approval.`,
      icon: Zap
    },
    {
      id: 'DEPT_MANAGER',
      title: `${terms.roles.MANAGER}`,
      badge: 'Unit Gate',
      badgeColor: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      description: `Requires review and approval by the ${terms.roles.MANAGER}.`,
      icon: ShieldCheck
    },
    {
      id: 'DEAN',
      title: `${terms.roles.DEAN} Approval`,
      badge: 'Faculty Gate',
      badgeColor: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      description: `Approved by Dean directly (no VC sign-off needed).`,
      icon: GraduationCap
    },
    {
      id: 'EXECUTIVE_ONLY',
      title: `${terms.roles.ORG_ADMIN} Approval`,
      badge: 'Executive',
      badgeColor: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      description: `High-authority requisitions requiring ${terms.roles.ORG_ADMIN} sign-off.`,
      icon: Crown
    },
    {
      id: 'MULTI_TIER_CHAIN',
      title: 'Multi-Tier Chain',
      badge: '3 Stages',
      badgeColor: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      description: `Sequential: ${terms.roles.MANAGER} → ${terms.roles.DEAN} → ${terms.roles.ORG_ADMIN}.`,
      icon: Layers
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl overflow-hidden my-auto">
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Create New {terms.unit}</h2>
              <p className="text-xs text-slate-500">Academic department identity, parent faculty, and approval routing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mx-4 sm:mx-6 mt-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 text-xs text-rose-700 dark:text-rose-300 shrink-0">
            {error}
          </div>
        )}

        {/* Scrollable Form Body */}
        <form id="create-dept-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* Prominent Department Name Input */}
          <div className="space-y-1.5 bg-slate-50/70 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
            <label className="text-slate-900 dark:text-white font-bold text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>{terms.unit} Name *</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold px-1.5 py-0.2 rounded">Required</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">e.g. Department of Computer Science</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Department of Computer Science"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none shadow-2xs"
              required
              autoFocus
            />
          </div>

          {/* Department Code and Mandatory Parent Faculty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                {terms.unit} Code *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. CSC or MIS"
                maxLength={8}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 focus:outline-none uppercase"
                required
              />
            </div>

            {/* Mandatory Faculty Selection */}
            <div className="space-y-1">
              <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-between">
                <span>Parent {terms.division} * (Mandatory)</span>
                {!isCreatingNewFaculty && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewFaculty(true);
                      setSelectedFaculty('');
                    }}
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-normal"
                  >
                    + New {terms.division}
                  </button>
                )}
              </label>

              {!isCreatingNewFaculty ? (
                <select
                  value={selectedFaculty}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      setIsCreatingNewFaculty(true);
                      setSelectedFaculty('');
                    } else {
                      setSelectedFaculty(e.target.value);
                    }
                  }}
                  required
                  className={`w-full rounded-lg border bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none ${
                    !selectedFaculty
                      ? 'border-amber-400 dark:border-amber-600'
                      : 'border-slate-300 dark:border-slate-700 focus:border-emerald-600'
                  }`}
                >
                  <option value="">-- Select Parent {terms.division} (Required) --</option>
                  {faculties.map((f) => (
                    <option key={f.id || f.name} value={f.name}>
                      🏛️ {f.name} {f.deanName ? `(Dean: ${f.deanName})` : ''}
                    </option>
                  ))}
                  <option value="__NEW__">+ Add New {terms.division}...</option>
                </select>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newFacultyName}
                    onChange={(e) => setNewFacultyName(e.target.value)}
                    placeholder={`e.g. ${terms.division} of Science`}
                    className="flex-1 rounded-lg border border-emerald-400 dark:border-emerald-600 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewFaculty(false);
                      setNewFacultyName('');
                    }}
                    className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Appointed Head of Department & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                Appointed {terms.roles.MANAGER}
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="">-- Assign {terms.roles.MANAGER} Later --</option>
                {personas
                  .filter(p => p.role !== 'SUPER_ADMIN' && p.role !== 'ORG_ADMIN')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Operational activities of this ${terms.unit.toLowerCase()}...`}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* SINGLE CLEAN POLICY MANAGER: ALL APPROVAL TIERS */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="text-slate-800 dark:text-slate-200 font-bold text-xs">
                Request Dispatch Policy *
              </label>
              <p className="text-[10px] text-slate-500">
                Inbound requisition approval rule for this {terms.unit.toLowerCase()}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {policyCards.map((card, idx) => {
                const isSelected = deptApprovalPolicy === card.id;
                const isWide = idx === 4; // Multi-Tier Chain spans 2 columns
                const Icon = card.icon;

                return (
                  <div
                    key={card.id}
                    onClick={() => setDeptApprovalPolicy(card.id)}
                    className={`group flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isWide ? 'sm:col-span-2' : ''
                    } ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/25 ring-1 ring-emerald-500/25 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className={`flex h-7 w-7 items-center justify-center rounded-md shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200/80 dark:group-hover:bg-slate-750'
                    }`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                          {card.title}
                        </span>
                        <span className={`text-[9px] font-medium px-1.5 py-0.2 rounded-full border shrink-0 ${card.badgeColor}`}>
                          {card.badge}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {card.description}
                      </p>
                    </div>

                    <div className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-600'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                    }`}>
                      {isSelected && <div className="h-1 w-1 rounded-full bg-white" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 px-3 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>Executive Exemption:</strong> {terms.roles.ORG_ADMIN} and {terms.roles.DEAN} requisitions bypass approval and route directly.
              </span>
            </div>
          </div>

          {/* Responsibilities */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Responsibilities</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newResp}
                onChange={(e) => setNewResp(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddResponsibility(); } }}
                placeholder="e.g. Network infrastructure maintenance"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddResponsibility}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Add
              </button>
            </div>
            {responsibilities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {responsibilities.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                    <span>{r}</span>
                    <button type="button" onClick={() => handleRemoveResponsibility(i)} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Request Types (Clean: Redundant policy dropdown removed) */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 dark:text-slate-300 font-medium">Request Types</label>
              <span className="text-[10px] text-slate-400">Inherits {terms.unit} dispatch policy above</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newReqType}
                onChange={(e) => setNewReqType(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddRequestType(); } }}
                placeholder="e.g. Equipment Request"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
              />
              <select
                value={newReqPriority}
                onChange={(e) => setNewReqPriority(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <button
                type="button"
                onClick={handleAddRequestType}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Add
              </button>
            </div>
            {requestTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {requestTypes.map((rt, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                    <span>{rt.name}</span>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase font-mono">{rt.priority}</span>
                    <button type="button" onClick={() => handleRemoveRequestType(i)} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Task Types */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Task Types</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskType}
                onChange={(e) => setNewTaskType(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTaskType(); } }}
                placeholder="e.g. Hardware diagnostic"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddTaskType}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Add
              </button>
            </div>
            {taskTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {taskTypes.map((tt, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                    <span>{tt}</span>
                    <button type="button" onClick={() => handleRemoveTaskType(i)} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Sticky Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 p-3.5 sm:p-4 bg-slate-50/80 dark:bg-slate-950/80 shrink-0">
          <div className="text-[11px] text-slate-500">
            {selectedFaculty || newFacultyName ? (
              <span>Parent: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{selectedFaculty || newFacultyName}</strong></span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium">⚠️ Parent {terms.division.toLowerCase()} required</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-dept-form"
              disabled={submitting || !name.trim() || !code.trim() || (!selectedFaculty && !newFacultyName.trim())}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white shadow-xs transition"
            >
              {submitting ? 'Creating Department...' : `Create ${terms.unit}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
