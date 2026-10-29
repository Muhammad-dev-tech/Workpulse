import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { UserPersona, UserRole } from '../../types';
import { Mail, Lock, User, AlertCircle, Building2, GraduationCap, BookOpen, Stethoscope, Landmark, Heart, Check, Activity } from 'lucide-react';
import { ORG_TYPE_OPTIONS, OrganizationType, getTerminology, inferOrgTypeFromName } from '../../terminology';

const ORG_TYPE_ICONS: Record<OrganizationType, React.ElementType> = {
  COMPANY: Building2,
  UNIVERSITY: GraduationCap,
  SCHOOL: BookOpen,
  HOSPITAL: Stethoscope,
  GOVERNMENT: Landmark,
  NGO: Heart
};

interface AuthPageProps {
  onLoginSuccess: (user: UserPersona) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [orgMode, setOrgMode] = useState<'create' | 'join'>('create');
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrganizationType>('COMPANY');
  const [orgTypeManuallySelected, setOrgTypeManuallySelected] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [availableOrgs, setAvailableOrgs] = useState<Array<{ id: string; name: string; orgType?: string }>>([]);
  const [regRole, setRegRole] = useState<UserRole>('EMPLOYEE');
  const [regDeptId, setRegDeptId] = useState('');
  const [availableDepts, setAvailableDepts] = useState<Array<{ id: string; name: string; code: string }>>([]);

  const createTerms = getTerminology(orgType, orgName);
  const joinTerms = getTerminology(availableOrgs.find(o => o.id === selectedOrgId)?.orgType);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const orgs = await api.getOrganizations();
      setAvailableOrgs(orgs);
      if (orgs.length > 0) {
        setSelectedOrgId(orgs[0].id);
        loadDepartments(orgs[0].id);
      }
    } catch {
      // Handled
    }
  };

  const loadDepartments = async (orgId: string) => {
    if (!orgId) {
      setAvailableDepts([]);
      return;
    }
    try {
      const depts = await api.getPublicDepartments(orgId);
      setAvailableDepts(depts);
      if (depts.length > 0) {
        setRegDeptId(depts[0].id);
      } else {
        setRegDeptId('');
      }
    } catch {
      setAvailableDepts([]);
    }
  };

  useEffect(() => {
    if (selectedOrgId && orgMode === 'join') {
      loadDepartments(selectedOrgId);
    }
  }, [selectedOrgId, orgMode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setError('Enter your email address.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(loginEmail.trim(), loginPassword);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError('Please fill in all required fields.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (orgMode === 'create' && !orgName.trim()) {
      setError('Please enter your organization name.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const inferred = inferOrgTypeFromName(orgName);
      const effectiveOrgType = orgTypeManuallySelected
        ? orgType
        : (inferred !== 'COMPANY' ? inferred : orgType);

      const res = await api.register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        organizationName: orgMode === 'create' ? orgName.trim() : undefined,
        organizationType: orgMode === 'create' ? effectiveOrgType : undefined,
        organizationId: orgMode === 'join' ? selectedOrgId : undefined,
        role: orgMode === 'create' ? 'ORG_ADMIN' : 'EMPLOYEE',
        departmentId: orgMode === 'join' && regDeptId ? regDeptId : undefined
      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check details or try another email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 transition-colors">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs mb-3">
            <Activity className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">WorkPulse</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organizational Workflow System
          </p>
        </div>

        {/* Card Box */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs">
          {/* Tabs */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1 mb-5">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); }}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                tab === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(null); }}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                tab === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2 px-4 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50 mt-2"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Registration Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Work Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="jane@organization.com"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password (min 6 characters)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Organization Mode Choice */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOrgMode('create')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold border transition ${
                      orgMode === 'create'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    New Organization
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrgMode('join')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold border transition ${
                      orgMode === 'join'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Join Existing
                  </button>
                </div>

                {orgMode === 'create' ? (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Organization Type
                      </label>
                      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Organization type">
                        {ORG_TYPE_OPTIONS.map((type) => {
                          const Icon = ORG_TYPE_ICONS[type];
                          const active = orgType === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => {
                                setOrgType(type);
                                setOrgTypeManuallySelected(true);
                              }}
                              className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] font-medium transition ${
                                active
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-200 font-semibold'
                                  : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span>{getTerminology(type).label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {createTerms.label} Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={orgName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOrgName(val);
                          if (!orgTypeManuallySelected && val.trim()) {
                            const inferred = inferOrgTypeFromName(val);
                            if (inferred !== 'COMPANY') {
                              setOrgType(inferred);
                            }
                          }
                        }}
                        placeholder={createTerms.namePlaceholder}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Select Organization *
                      </label>
                      {availableOrgs.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No existing organizations found.</p>
                      ) : (
                        <select
                          value={selectedOrgId}
                          onChange={(e) => setSelectedOrgId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-xs text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                        >
                          {availableOrgs.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Assigned Position
                      </label>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {joinTerms.roles.EMPLOYEE}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded">
                          Standard Entry Level
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        All members enter as {joinTerms.roles.EMPLOYEE}. Supervisory appointments (such as {joinTerms.roles.MANAGER} or {joinTerms.roles.DEAN}) are designated by your Organization Administrator.
                      </p>
                    </div>

                    {availableDepts.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          {joinTerms.unit} (optional)
                        </label>
                        <select
                          value={regDeptId}
                          onChange={(e) => setRegDeptId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-xs text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">None</option>
                          {availableDepts.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2 px-4 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50 mt-2"
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
