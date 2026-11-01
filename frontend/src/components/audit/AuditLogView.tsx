import React, { useState, useEffect } from 'react';
import { Shield, Search, RefreshCw, CheckCircle2, Filter, Building2, UserCheck, Layers, FileText } from 'lucide-react';
import { AuditLog, UserPersona } from '../../types';
import { api } from '../../services/api';
import { getTerminology } from '../../terminology';

interface AuditLogViewProps {
  currentUser?: UserPersona | null;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ currentUser }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionCategory, setActionCategory] = useState<'ALL' | 'REQUESTS' | 'APPROVALS' | 'GOVERNANCE' | 'ROLES'>('ALL');

  const terms = getTerminology(currentUser?.organizationType, currentUser?.organizationName, currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isOrgAdmin = currentUser?.role === 'ORG_ADMIN';
  const isDean = currentUser?.role === 'DEAN';
  const isManager = currentUser?.role === 'MANAGER';

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs({ limit: 150 });
      setLogs(data);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const act = log.action.toUpperCase();
    if (actionCategory === 'REQUESTS' && !act.includes('REQUEST')) return false;
    if (actionCategory === 'APPROVALS' && !act.includes('APPROV') && !act.includes('REJECT') && !act.includes('ESCALAT')) return false;
    if (actionCategory === 'GOVERNANCE' && !act.includes('DEPARTMENT') && !act.includes('FACULTY') && !act.includes('MANAGER') && !act.includes('DEAN')) return false;
    if (actionCategory === 'ROLES' && !act.includes('ROLE') && !act.includes('USER') && !act.includes('APPOINT') && !act.includes('VACAT')) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        log.actorName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.resourceType.toLowerCase().includes(q) ||
        log.resourceId.toLowerCase().includes(q) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Scope Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              <span>Audit Trail</span>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                {filteredLogs.length} events
              </span>
            </h3>

            {isOrgAdmin && (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                {terms.label === 'University' ? 'Vice-Chancellor Institutional Oversight' : 'Institution-Wide Executive Oversight'}
              </span>
            )}
            {isSuperAdmin && (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                Platform Global Scope
              </span>
            )}
            {isDean && (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                {terms.division} Scope: {currentUser?.faculty || 'Faculty Operations'}
              </span>
            )}
            {isManager && (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                {terms.unit} Scope: {currentUser?.departmentName || 'Department Operations'}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-1">
            {isSuperAdmin || isOrgAdmin
              ? `Full institutional governance log spanning all ${terms.division.toLowerCase()}s, ${terms.units.toLowerCase()}, role appointments, and executive administration.`
              : isDean
              ? `Filtered governance trail strictly restricted to requests, approvals, departmental changes, and personnel under ${currentUser?.faculty || 'your assigned ' + terms.division.toLowerCase()}.`
              : `Operational trail restricted to events within your assigned ${terms.unit.toLowerCase()}.`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search audit trail..."
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <button
            onClick={loadLogs}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 text-[11px] font-medium mr-1 flex items-center gap-1">
          <Filter className="h-3 w-3" /> Filter:
        </span>
        {(['ALL', 'REQUESTS', 'APPROVALS', 'GOVERNANCE', 'ROLES'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActionCategory(cat)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
              actionCategory === cat
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {cat === 'ALL'
              ? 'All Events'
              : cat === 'REQUESTS'
              ? 'Requests'
              : cat === 'APPROVALS'
              ? 'Approvals'
              : cat === 'GOVERNANCE'
              ? `${terms.division} & ${terms.units}`
              : 'Appointments & Roles'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading audit records...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 text-xs">
          No audit records found matching search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5">Actor</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Target</th>
                <th className="px-4 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-800/60 font-mono text-[11px]">
              {filteredLogs.map((log) => {
                return (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-sans">
                        <strong className="text-slate-900 dark:text-white font-medium">{log.actorName}</strong>
                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] text-slate-600 dark:text-slate-400">
                          {log.actorRole}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="rounded px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <span className="text-slate-400">{log.resourceType}:</span>{' '}
                      <strong className="text-slate-900 dark:text-white font-medium">{log.resourceId}</strong>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate font-mono text-[10px]">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
