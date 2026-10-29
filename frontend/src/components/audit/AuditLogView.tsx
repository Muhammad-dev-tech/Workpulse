import React, { useState, useEffect } from 'react';
import { Shield, Search, RefreshCw } from 'lucide-react';
import { AuditLog } from '../../types';
import { api } from '../../services/api';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs({ limit: 100 });
      setLogs(data);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'ALL' && !log.action.includes(actionFilter)) return false;
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
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Audit Trail</span>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              {filteredLogs.length} events
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
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
