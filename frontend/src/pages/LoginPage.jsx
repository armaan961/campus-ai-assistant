/**
 * LoginPage.jsx
 * ─────────────
 * The public entry point for all roles.
 * - Validates inputs client-side before making the API call
 * - Shows inline error on bad credentials
 * - On success, redirects to the correct dashboard based on role
 * - If already logged in, redirects immediately (no flash)
 */

import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

/** Map role → dashboard path */
const ROLE_HOME = { admin: '/admin', faculty: '/faculty', student: '/student' };

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const toast    = useToast();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  // Already logged in — redirect silently
  if (!loading && user) {
    return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Basic client-side validation
    if (!email.trim())    return setError('Email is required.');
    if (!password.trim()) return setError('Password is required.');

    setBusy(true);
    try {
      const role = await login(email.trim(), password);
      toast.success('Welcome back!');
      navigate(ROLE_HOME[role] || '/', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.detail || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* ── Left panel: branding ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden
                      bg-gradient-to-br from-indigo-950 via-gray-900 to-gray-950
                      flex-col items-center justify-center p-16">
        {/* decorative blobs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

        <div className="relative z-10 max-w-md text-center">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-24 h-24
                          rounded-3xl bg-indigo-600 shadow-2xl shadow-indigo-900/60 mb-8">
            <span className="text-5xl">🎓</span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            Campus <span className="text-indigo-400">AI</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed mb-12">
            Your intelligent university management platform. Learn smarter, teach better, manage effortlessly.
          </p>

          {/* Role badges */}
          <div className="flex flex-col gap-3 text-left">
            {[
              { icon: '⚙️', role: 'Admin',   color: 'indigo', desc: 'Manage users, courses & settings' },
              { icon: '📚', role: 'Faculty',  color: 'sky',    desc: 'Teach courses & grade students'   },
              { icon: '🧠', role: 'Student',  color: 'emerald',desc: 'Study smarter with AI assistance' },
            ].map(({ icon, role, color, desc }) => (
              <div key={role}
                className={`flex items-center gap-4 p-4 rounded-2xl
                  bg-${color}-900/30 border border-${color}-800/50`}>
                <span className="text-2xl">{icon}</span>
                <div>
                  <div className={`text-${color}-300 font-semibold text-sm`}>{role}</div>
                  <div className="text-gray-400 text-xs">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: login form ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Mobile logo */}
        <div className="lg:hidden flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mb-3">
            <span className="text-3xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            Campus <span className="text-indigo-400">AI</span>
          </h1>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-gray-400">Sign in to your account to continue</p>
          </div>

          <form id="login-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="you@campus.edu"
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700
                           text-white placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-800 border border-gray-700
                             text-white placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                             transition-all"
                />
                <button
                  type="button"
                  id="toggle-password"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                             hover:text-gray-200 transition-colors text-lg px-1"
                  aria-label="Toggle password visibility"
                >
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div id="login-error"
                className="flex items-center gap-3 bg-red-950 border border-red-800
                           rounded-xl px-4 py-3 text-red-300 text-sm">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={busy}
              className="w-full py-3 px-6 rounded-xl font-semibold text-white
                         bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-150 shadow-lg shadow-indigo-900/40
                         flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-8 p-4 rounded-xl bg-gray-900 border border-gray-800">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
              Workshop demo credentials
            </p>
            <div className="space-y-1.5 text-xs">
              {[
                { role: 'Admin',   email: 'admin@campus.edu',   pw: 'Admin@123',   color: 'text-indigo-400' },
                { role: 'Faculty', email: 'frank@campus.edu',   pw: 'Faculty@123', color: 'text-sky-400'    },
                { role: 'Student', email: 'sam@campus.edu',     pw: 'Student@123', color: 'text-emerald-400'},
              ].map(c => (
                <button
                  key={c.role}
                  type="button"
                  id={`demo-${c.role.toLowerCase()}`}
                  onClick={() => { setEmail(c.email); setPassword(c.pw); setError(''); }}
                  className="flex items-center gap-2 w-full text-left hover:bg-gray-800
                             rounded-lg px-2 py-1.5 transition-colors group"
                >
                  <span className={`font-semibold ${c.color} w-14`}>{c.role}</span>
                  <span className="text-gray-400 group-hover:text-gray-300">{c.email}</span>
                  <span className="ml-auto text-gray-600 group-hover:text-gray-400 font-mono">{c.pw}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">Click a row to auto-fill credentials</p>
          </div>
        </div>
      </div>
    </div>
  );
}
