import React, { useState } from 'react';
import { X, Landmark, UserCheck } from 'lucide-react';
import { api } from '../../services/api';
import { UserPersona } from '../../types';
import { getTerminology } from '../../terminology';

interface CreateFacultyModalProps {
  personas: UserPersona[];
  currentUser?: UserPersona | null;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateFacultyModal: React.FC<CreateFacultyModalProps> = ({
  personas,
  currentUser,
  onClose,
  onCreated
}) => {
  const terms = getTerminology(currentUser?.organizationType, currentUser?.organizationName);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [deanId, setDeanId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(`${terms.division} name is required.`);
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      await api.createFaculty({
        name: name.trim(),
        code: code.trim().toUpperCase() || undefined,
        description: description.trim() || undefined,
        deanId: deanId || undefined
      });

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || `Failed to create ${terms.division.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 sm:p-6 shadow-xl space-y-4 my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <Landmark className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Create New {terms.division}
              </h2>
              <p className="text-xs text-slate-500">
                Establish a high-level academic faculty or organizational division
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

        {error && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Faculty Name and Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-slate-700 dark:text-slate-300 font-medium">
                {terms.division} Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g. ${terms.division} of Science / Engineering`}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-700 dark:text-slate-300 font-medium">Code (e.g. FSC)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="FSC"
                maxLength={8}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 focus:outline-none uppercase"
              />
            </div>
          </div>

          {/* Appoint Dean */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Appointed {terms.roles.DEAN} (Optional)</span>
              </label>
              <span className="text-[10px] text-slate-400">Can be appointed now or later</span>
            </div>
            <select
              value={deanId}
              onChange={(e) => setDeanId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="">-- Assign {terms.roles.DEAN} Later --</option>
              {personas
                .filter(p => p.role !== 'SUPER_ADMIN' && p.role !== 'ORG_ADMIN')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role}{p.faculty ? ` — ${p.faculty}` : ''})
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
              Appointing a member as {terms.roles.DEAN} grants them divisional oversight and approval authority for all {terms.units.toLowerCase()} grouped under this {terms.division.toLowerCase()}.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Academic scope, faculties, or divisional coverage...`}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Guidance Note */}
          <div className="rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/80 p-3 text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1">
            <span className="font-semibold block">🏛️ Organizational Hierarchy:</span>
            <p>
              Once created, this {terms.division.toLowerCase()} will appear as a parent grouping in the {terms.unit} Setup directory. You can create {terms.units.toLowerCase()} directly under it, and its appointed {terms.roles.DEAN} can sign off on requests without requiring {terms.roles.SUPER_ADMIN} sign-off.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 font-semibold text-white shadow-xs transition disabled:opacity-50"
            >
              {submitting ? 'Creating...' : `Create ${terms.division}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
