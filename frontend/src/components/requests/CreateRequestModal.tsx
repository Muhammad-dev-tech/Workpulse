import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { X, Plus, AlertCircle, Paperclip, Upload } from 'lucide-react';
import { Department } from '../../types';

interface CreateRequestModalProps {
  departments: Department[];
  onClose: () => void;
  onCreated: () => void;
}

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({
  departments,
  onClose,
  onCreated
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || 'dept-it');
  const [requestTypeId, setRequestTypeId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState<{ fileName: string; fileSize: number; fileType: string; fileUrl: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const selectedDept = departments.find(d => d.id === departmentId);
  const availableRequestTypes = selectedDept?.requestTypes || [];

  // When department changes, pick first request type
  useEffect(() => {
    if (availableRequestTypes.length > 0) {
      setRequestTypeId(availableRequestTypes[0].id);
      if (availableRequestTypes[0].defaultPriority) {
        setPriority(availableRequestTypes[0].defaultPriority);
      }
    } else {
      setRequestTypeId('');
    }
  }, [departmentId]);

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
      setError('Please provide a title and detailed description.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const newReq = await api.createRequest({
        title: title.trim(),
        description: description.trim(),
        departmentId,
        requestTypeId: requestTypeId || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="glass-dropdown relative w-full max-w-xl rounded-3xl border border-slate-800 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create New Operational Request</h2>
              <p className="text-xs text-slate-400">Initiate a formal workflow with tracking and accountability.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Request Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Software Installation - Developer IDE Suite"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Target Department *</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Configured Request Type</label>
              <select
                value={requestTypeId}
                onChange={(e) => handleRequestTypeChange(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Priority Tier</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Target Due Date (SLA)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-white focus:border-indigo-500 focus:outline-none"
              >
              </input>
            </div>
          </div>

          {/* Approval Routing Policy Indicator */}
          {(() => {
            const selectedRt = availableRequestTypes.find(t => t.id === requestTypeId);
            const isGov = selectedRt?.approvalPolicy === 'EXECUTIVE_ONLY' ||
              selectedRt?.requiresApproval ||
              selectedRt?.name?.toLowerCase().includes('approval') ||
              selectedRt?.name?.toLowerCase().includes('access') ||
              selectedRt?.name?.toLowerCase().includes('rectif');
            return (
              <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-xs transition-colors ${
                isGov
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              }`}>
                <span className="font-bold text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded border border-current shrink-0">
                  {isGov ? 'Executive Gate' : 'Direct Dispatch'}
                </span>
                <span className="text-[11px] leading-relaxed">
                  {isGov
                    ? 'Requires Super Admin / Executive sign-off before operational dispatch.'
                    : 'Dispatches directly to target operational department queue without executive bottlenecks.'}
                </span>
              </div>
            );
          })()}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Detailed Description & Justification *</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State the business requirement, machine specifications, or problem to solve..."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Optional Attachment */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-indigo-400" />
                <span>Supporting Document / Proof (Optional)</span>
              </span>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg transition"
              >
                <Upload className="h-3 w-3" />
                <span>{attachment ? 'Change File' : 'Select File'}</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {attachment ? (
              <div className="flex items-center justify-between rounded-lg bg-indigo-950/40 border border-indigo-500/30 p-2 text-xs">
                <span className="font-semibold text-indigo-200 truncate">{attachment.fileName}</span>
                <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                  {Math.round(attachment.fileSize / 1024)} KB
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 leading-normal">
                Attach receipts, quotations, official letters, or scanned registration slips.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition disabled:opacity-50 active:scale-95"
            >
              {isSubmitting ? 'Creating...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
