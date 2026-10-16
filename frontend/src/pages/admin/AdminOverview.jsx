/**
 * AdminOverview.jsx
 * ─────────────────
 * Real-time Admin overview dashboard:
 *  - Live metric cards (Users, Courses, Offerings, AI Questions)
 *  - Quick management navigation shortcuts
 *  - Live recent system audit events feed
 *  - System health & term status
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { useToast } from '../../components/Toast';

export default function AdminOverview() {
  const { user } = useAuth();
  const toast = useToast();

  const [stats, setStats] = useState({
    usersCount: 0,
    coursesCount: 0,
    offeringsCount: 0,
    aiQuestions: 0,
  });
  const [recentAudit, setRecentAudit] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOverview() {
      try {
        setLoading(true);
        const [uRes, cRes, oRes, aRes, auditRes] = await Promise.all([
          api.get('/users').catch(() => ({ data: [] })),
          api.get('/courses').catch(() => ({ data: [] })),
          api.get('/offerings').catch(() => ({ data: [] })),
          api.get('/ai/admin/analytics').catch(() => ({ data: { totalQuestions: 0 } })),
          api.get('/audit?limit=5').catch(() => ({ data: [] })),
        ]);

        setStats({
          usersCount: Array.isArray(uRes.data) ? uRes.data.length : (uRes.data.users?.length || 0),
          coursesCount: Array.isArray(cRes.data) ? cRes.data.length : 0,
          offeringsCount: Array.isArray(oRes.data) ? oRes.data.length : 0,
          aiQuestions: aRes.data.totalQuestions || 0,
        });

        const auditRows = Array.isArray(auditRes.data)
          ? auditRes.data
          : (auditRes.data.logs || auditRes.data.audit_logs || []);
        setRecentAudit(auditRows);
      } catch {
        toast.error('Failed to load live overview metrics.');
      } finally {
        setLoading(false);
      }
    }

    loadOverview();
  }, []);

  const statCards = [
    { label: 'Total Users',       value: stats.usersCount,     icon: '👥', color: 'indigo', link: '/admin/users' },
    { label: 'Active Courses',    value: stats.coursesCount,   icon: '📚', color: 'sky',    link: '/admin/courses' },
    { label: 'Course Offerings',  value: stats.offeringsCount, icon: '🎓', color: 'violet', link: '/admin/courses' },
    { label: 'AI Questions Asked', value: stats.aiQuestions,   icon: '🤖', color: 'emerald',link: '/admin/ai' },
  ];

  return (
    <div className="space-y-8">
      {/* ── Welcome Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-gray-400 text-sm">
            University Management Overview • System is operational.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/users"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500
                       text-white text-xs font-semibold shadow-lg shadow-indigo-950 transition-all"
          >
            <span>+</span>
            <span>Add User</span>
          </Link>
          <Link
            to="/admin/ai"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700
                       text-gray-200 text-xs font-semibold border border-gray-700 transition-all"
          >
            <span>🤖</span>
            <span>AI Controls</span>
          </Link>
        </div>
      </div>

      {/* ── Stat Cards Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <Link
            key={card.label}
            to={card.link}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700
                       transition-all group block"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full">
                live
              </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors">
              {loading ? '—' : card.value}
            </div>
            <div className="text-gray-400 text-xs flex items-center justify-between">
              <span>{card.label}</span>
              <span className="text-gray-600 group-hover:text-gray-300 transition-colors">→</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Quick Action Modules & Live Audit Trail ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Admin Shortcuts */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-white text-base font-bold flex items-center gap-2">
            <span>⚡</span> Quick Management Hub
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to="/admin/users"
              className="p-5 rounded-2xl bg-gray-900 border border-gray-800 hover:border-indigo-600/60
                         transition-all group flex flex-col justify-between space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-800 text-indigo-400 flex items-center justify-center text-xl">
                  👥
                </div>
                <div>
                  <h4 className="text-white text-sm font-bold group-hover:text-indigo-300 transition-colors">
                    User Management
                  </h4>
                  <p className="text-gray-400 text-xs">Students, faculty, admins</p>
                </div>
              </div>
              <p className="text-gray-400 text-xs">
                Create accounts, toggle activations, reset passwords, or batch import users via CSV.
              </p>
              <div className="text-indigo-400 text-xs font-semibold flex items-center gap-1">
                Manage Users <span>→</span>
              </div>
            </Link>

            <Link
              to="/admin/courses"
              className="p-5 rounded-2xl bg-gray-900 border border-gray-800 hover:border-sky-600/60
                         transition-all group flex flex-col justify-between space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-950/80 border border-sky-800 text-sky-400 flex items-center justify-center text-xl">
                  📚
                </div>
                <div>
                  <h4 className="text-white text-sm font-bold group-hover:text-sky-300 transition-colors">
                    Courses & Offerings
                  </h4>
                  <p className="text-gray-400 text-xs">Departments, semesters & faculty</p>
                </div>
              </div>
              <p className="text-gray-400 text-xs">
                Configure academic departments, assign instructors to course offerings, and enroll students.
              </p>
              <div className="text-sky-400 text-xs font-semibold flex items-center gap-1">
                Manage Courses <span>→</span>
              </div>
            </Link>

            <Link
              to="/admin/ai"
              className="p-5 rounded-2xl bg-gray-900 border border-gray-800 hover:border-emerald-600/60
                         transition-all group flex flex-col justify-between space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-400 flex items-center justify-center text-xl">
                  🤖
                </div>
                <div>
                  <h4 className="text-white text-sm font-bold group-hover:text-emerald-300 transition-colors">
                    AI Study Controls
                  </h4>
                  <p className="text-gray-400 text-xs">Limits, quotas & analytics</p>
                </div>
              </div>
              <p className="text-gray-400 text-xs">
                Toggle master AI switch, configure max upload size limits, and adjust daily student quotas.
              </p>
              <div className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                Configure AI <span>→</span>
              </div>
            </Link>

            <Link
              to="/admin/audit"
              className="p-5 rounded-2xl bg-gray-900 border border-gray-800 hover:border-violet-600/60
                         transition-all group flex flex-col justify-between space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-950/80 border border-violet-800 text-violet-400 flex items-center justify-center text-xl">
                  📋
                </div>
                <div>
                  <h4 className="text-white text-sm font-bold group-hover:text-violet-300 transition-colors">
                    Security Audit Trail
                  </h4>
                  <p className="text-gray-400 text-xs">Immutable system records</p>
                </div>
              </div>
              <p className="text-gray-400 text-xs">
                Inspect tamper-evident audit logs of user modifications, grade updates, and AI settings changes.
              </p>
              <div className="text-violet-400 text-xs font-semibold flex items-center gap-1">
                View Audit Logs <span>→</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Right Col: Recent Audit Trail Feed */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-base font-bold flex items-center gap-2">
                <span>📋</span> Recent Activity
              </h3>
              <Link to="/admin/audit" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
                View All →
              </Link>
            </div>

            {recentAudit.length === 0 ? (
              <p className="text-gray-500 text-xs italic py-6">No recent events recorded in the audit trail.</p>
            ) : (
              <div className="space-y-3">
                {recentAudit.slice(0, 5).map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="p-3 rounded-xl bg-gray-850/60 border border-gray-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-indigo-400">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="text-gray-300 text-[11px] truncate">
                      By: <span className="text-white font-medium">{log.user_name || log.user_id || 'System'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-800 text-xs text-gray-500 flex items-center justify-between mt-4">
            <span>Environment: <strong className="text-gray-300">Development</strong></span>
            <span>Port: <strong className="text-emerald-400">8000 (API)</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
