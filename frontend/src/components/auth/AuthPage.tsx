import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { UserPersona } from '../../types';
import { Shield, Mail, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';

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
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [availableOrgs, setAvailableOrgs] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const orgs = await api.getOrganizations();
      setAvailableOrgs(orgs);
      if (orgs.length > 0) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch {
      // Ignored
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setError('Please enter your email address.');
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
      setError('Please fill in all required registration fields.');
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
      const res = await api.register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        organizationName: orgMode === 'create' ? orgName.trim() : undefined,
        organizationId: orgMode === 'join' ? selectedOrgId : undefined
      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try a different email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#07090e] p-4 sm:p-6 overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-cyan-600/15 blur-[128px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-purple-600/10 blur-[150px]" />

      <div className="relative w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-glow-indigo mb-4 ring-1 ring-white/20">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-950/80 backdrop-blur-sm">
              <svg className="h-7 w-7 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">WorkPulse</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Enterprise Operational Visibility & Activity Platform
          </p>
        </div>

        {/* Card Box */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 sm:p-8 backdrop-blur-xl shadow-2xl ring-1 ring-white/5">
          {/* Tabs */}
          <div className="flex rounded-xl bg-slate-950/60 p-1 mb-6 border border-slate-800">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                tab === 'login'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                tab === 'register'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 py-2.5 px-4 text-xs font-bold text-white shadow-glow-indigo transition-all hover:brightness-110 active:scale-98 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <span>Sign In to WorkPulse</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Registration Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Dr. Muhammad Tariq"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@organization.com"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password (min 6 chars)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Organization setup choice */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Organization Setup
                </label>

                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setOrgMode('create')}
                    className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold border transition ${
                      orgMode === 'create'
                        ? 'border-indigo-500/50 bg-indigo-600/20 text-indigo-300'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    + Create New Org
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrgMode('join')}
                    className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold border transition ${
                      orgMode === 'join'
                        ? 'border-indigo-500/50 bg-indigo-600/20 text-indigo-300'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Join Existing
                  </button>
                </div>

                {orgMode === 'create' ? (
                  <div>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Apex Corporation or University"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-emerald-400/90 mt-1.5 flex items-center gap-1 font-medium">
                      <Shield className="h-3 w-3 shrink-0" />
                      You will be registered as Super Administrator for this new organization.
                    </p>
                  </div>
                ) : (
                  <div>
                    {availableOrgs.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No existing organizations found. Please create one.</p>
                    ) : (
                      <select
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
                      >
                        {availableOrgs.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      You will be registered as a standard Employee member.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 py-2.5 px-4 text-xs font-bold text-white shadow-glow-indigo transition-all hover:brightness-110 active:scale-98 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <span>Create Account & Start</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
