import React, { useState, useEffect } from 'react';
import { AdminOrganizationSummary, AdminStats, UserPersona } from '../../types';
import { api, setActiveOrgScope } from '../../services/api';
import {
  Building2,
  Users,
  Layers,
  Shield,
  ArrowRight,
  RefreshCw,
  GraduationCap,
  BookOpen,
  Stethoscope,
  Landmark,
  Heart
} from 'lucide-react';

const ORG_TYPE_ICONS: Record<string, React.ElementType> = {
  COMPANY: Building2,
  UNIVERSITY: GraduationCap,
  SCHOOL: BookOpen,
  HOSPITAL: Stethoscope,
  GOVERNMENT: Landmark,
  NGO: Heart
};

interface PlatformOrganizationsViewProps {
  currentUser: UserPersona;
  onSelectOrg: (orgId: string) => void;
}

export const PlatformOrganizationsView: React.FC<PlatformOrganizationsViewProps> = ({
  currentUser,
  onSelectOrg
}) => {
  const [organizations, setOrganizations] = useState<AdminOrganizationSummary[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [orgsData, statsData] = await Promise.all([
        api.getAdminOrganizations(),
        api.getAdminStats()
      ]);
      setOrganizations(orgsData);
      setStats(statsData);
    } catch (err: any) {
      console.error('Failed to load platform organizations:', err);
      setError(err.message || 'Failed to load organization directory.');
    } finally {
      setLoading(false);
    }
  };

  const handleInspectOrg = (orgId: string) => {
    setActiveOrgScope(orgId);
    onSelectOrg(orgId);
  };

  return (
    <div className="space-y-5">
      {/* Platform Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Organizations Directory
          </h1>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
            Platform Super Admin
          </span>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Platform KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Organizations</span>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.totalOrganizations ?? organizations.length}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Total Users</span>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.totalUsers ?? '—'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Total Requests</span>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.totalRequests ?? '—'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Super Admin</span>
          <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white truncate">
            {currentUser.email}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Organizations Directory Grid */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-slate-500 text-xs">
            Loading organizations...
          </div>
        ) : organizations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-slate-500 text-xs">
            No organizations registered.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {organizations.map((org) => {
              const Icon = ORG_TYPE_ICONS[org.orgType] || Building2;
              return (
                <div
                  key={org.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col justify-between space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {org.name}
                          </h3>
                          <span className="font-mono text-[10px] text-slate-400">
                            {org.slug} · {org.orgType}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Admin summary */}
                    <div className="rounded border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-2 text-xs">
                      <span className="text-[10px] text-slate-400 block">Lead Administrator</span>
                      {org.admin ? (
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-semibold text-slate-900 dark:text-white truncate text-[11px]">{org.admin.name}</span>
                          <span className="text-[10px] text-slate-500 truncate ml-2">{org.admin.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                      )}
                    </div>

                    {/* Counts */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{org.stats.departmentsCount}</span>
                        <span className="text-[10px] text-slate-400">Departments</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{org.stats.usersCount}</span>
                        <span className="text-[10px] text-slate-400">Users</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{org.stats.requestsCount}</span>
                        <span className="text-[10px] text-slate-400">Requests</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleInspectOrg(org.id)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition"
                  >
                    <span>Inspect Organization</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
