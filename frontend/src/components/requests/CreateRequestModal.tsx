import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { X, Plus, AlertCircle, Paperclip, Upload, Trash2 } from 'lucide-react';
import { Department, UserPersona } from '../../types';
import { getTerminology } from '../../terminology';

interface CreateRequestModalProps {
  departments: Department[];
  currentUser?: UserPersona | null;
  initialDepartmentId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({
  departments,
  currentUser,
  initialDepartmentId,
  onClose,
  onCreated
}) => {
  const terms = getTerminology(currentUser?.organizationType, currentUser?.organizationName);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState(initialDepartmentId || departments[0]?.id || '');
  const [requestTypeId, setRequestTypeId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState<{ fileName: string; fileSize: number; fileType: string; fileUrl: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const selectedDept = departments.find(d => d.id === departmentId);
  const availableRequestTypes = selectedDept?.requestTypes || [];

  useEffect(() => {
    if (availableRequestTypes.length > 0) {
      if (!requestTypeId || !availableRequestTypes.some(t => t.id === requestTypeId)) {
        setRequestTypeId(availableRequestTypes[0].id);
        if (availableRequestTypes[0].defaultPriority) {
          setPriority(availableRequestTypes[0].defaultPriority);
        }
      }
    } else {
      setRequestTypeId('');
    }
  }, [departmentId, availableRequestTypes.length]);

  const handleRequestTypeChange = (rtId: string) => {
    setRequestTypeId(rtId);
    const rt = availableRequestTypes.find(t => t.id === rtId);
    if (rt && rt.defaultPriority) {
      setPriority(rt.defaultPriority);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        fileUrl: (reader.result as string) || ''
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Please provide a title and description.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const selectedRt = availableRequestTypes.find(t => t.id === requestTypeId);
      const policy = selectedRt?.approvalPolicy || selectedDept?.approvalPolicy || (selectedDept?.requiresApproval ? 'DEPT_MANAGER' : 'DIRECT');

      const newReq = await api.createRequest({
        title: title.trim(),
        description: description.trim(),
        departmentId,
        requestTypeId: requestTypeId || undefined,
        approvalPolicy: policy,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined
      });

      if (attachment) {
        await api.addAttachment(newReq.id, attachment);
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 sm:p-6 shadow-lg space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">New Request</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Broken projector in Room 402"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">{terms.unit} *</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
              >
                {departments.length === 0 ? (
                  <option value="">No {terms.units.toLowerCase()} configured</option>
                ) : (
                  departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Request Type</label>
              <select
                value={requestTypeId}
                onChange={(e) => handleRequestTypeChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
              >
                {availableRequestTypes.length > 0 ? (
                  availableRequestTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))
                ) : (
                  <option value="">General Request</option>
                )}
              </select>
            </div>
          </div>

          {/* Department Request Policy Callout */}
          {selectedDept && (
            <div className={`rounded-lg p-2.5 text-[11px] leading-relaxed border ${
              (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ORG_ADMIN' || currentUser?.role === 'DEAN')
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : selectedDept.approvalPolicy === 'DEAN'
                ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300'
                : selectedDept.approvalPolicy === 'EXECUTIVE_ONLY'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                : selectedDept.approvalPolicy === 'MULTI_TIER_CHAIN'
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                : (selectedDept.approvalPolicy === 'DEPT_MANAGER' || selectedDept.requiresApproval)
                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300'
            }`}>
              {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ORG_ADMIN' || currentUser?.role === 'DEAN') ? (
                <div className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">⚡ Direct Dispatch:</span>
                  <span>
                    As {terms.roles[currentUser.role] || currentUser.role}, your requisition bypasses pre-approval gating and lands directly in the {selectedDept.name} active operational queue.
                  </span>
                </div>
              ) : selectedDept.approvalPolicy === 'DEAN' ? (
                <div className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">🏛️ {terms.roles.DEAN} Sign-Off:</span>
                  <span>
                    Requests to {selectedDept.name} are reviewed & authorized directly by the {terms.roles.DEAN} of {selectedDept.faculty || terms.division}. Does not require {terms.roles.SUPER_ADMIN} approval.
                  </span>
                </div>
              ) : selectedDept.approvalPolicy === 'EXECUTIVE_ONLY' ? (
                <div className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">👑 Executive Gating:</span>
                  <span>
                    Requisitions to {selectedDept.name} require direct authorization by the {terms.roles.SUPER_ADMIN} ({terms.roles.ORG_ADMIN}).
                  </span>
                </div>
              ) : selectedDept.approvalPolicy === 'MULTI_TIER_CHAIN' ? (
                <div className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">🔗 Multi-Tier Governance:</span>
                  <span>
                    This requisition routes sequentially through {terms.roles.MANAGER} → {terms.roles.DEAN} → {terms.roles.SUPER_ADMIN} before active dispatch.
                  </span>
                </div>
              ) : (selectedDept.approvalPolicy === 'DEPT_MANAGER' || selectedDept.requiresApproval) ? (
                <div className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">⏳ {terms.roles.MANAGER} Pre-Approval:</span>
                  <span>
                    Requests to {selectedDept.name} require review and authorization by the {terms.roles.MANAGER} before being scheduled for execution.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">⚡ Direct Routing:</span>
                  <span>
                    {selectedDept.name} accepts direct operational requisitions without pre-approval delays.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
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
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Description *</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide relevant details or context..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Attachment section */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 text-xs font-medium">
                <Paperclip className="h-3.5 w-3.5" />
                <span>Supporting Document (Optional)</span>
              </span>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded transition"
              >
                <Upload className="h-3 w-3" />
                <span>{attachment ? 'Replace' : 'Upload'}</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {attachment && (
              <div className="flex items-center justify-between rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 text-xs">
                <span className="font-medium text-slate-900 dark:text-slate-200 truncate">{attachment.fileName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">
                    {Math.round(attachment.fileSize / 1024)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 font-semibold text-white shadow-xs transition disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
