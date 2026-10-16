/**
 * AiSettingsPage.jsx
 * ──────────────────
 * Admin AI global settings & campus usage analytics (Phase 7):
 *  - Master AI Killswitch / Enable toggle
 *  - Max document upload size limit (MB)
 *  - Student daily message quota
 *  - Live analytics on questions asked, documents ingested, and mode usage
 */

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../components/Toast';

export default function AiSettingsPage() {
  const toast = useToast();

  const [settings, setSettings] = useState({
    ai_enabled: 1,
    max_upload_mb: 20,
    daily_message_limit: 50,
  });

  const [analytics, setAnalytics] = useState({
    totalQuestions: 0,
    totalDocuments: 0,
    totalChunks: 0,
    totalSessions: 0,
    modeStats: [],
    policyStats: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettingsAndAnalytics();
  }, []);

  async function loadSettingsAndAnalytics() {
    try {
      setLoading(true);
      const [sRes, aRes] = await Promise.all([
        api.get('/ai/admin/settings'),
        api.get('/ai/admin/analytics'),
      ]);
      setSettings(sRes.data);
      setAnalytics(aRes.data);
    } catch {
      toast.error('Failed to load AI administration settings.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.patch('/ai/admin/settings', {
        ai_enabled: !!settings.ai_enabled,
        max_upload_mb: parseInt(settings.max_upload_mb),
        daily_message_limit: parseInt(settings.daily_message_limit),
      });
      setSettings(res.data);
      toast.success('AI global settings updated and logged to audit trail!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update AI settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 gap-3">
        <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading AI system controls...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Campus AI Configuration & Metrics</h2>
          <p className="text-gray-400 text-xs">
            Manage global AI parameters, upload file thresholds, student daily message caps, and monitor usage.
          </p>
        </div>
      </div>

      {/* ── Real-time Analytics Cards ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total AI Questions',  value: analytics.totalQuestions, icon: '💬', color: 'indigo'  },
          { label: 'Ingested Documents',  value: analytics.totalDocuments, icon: '📄', color: 'emerald' },
          { label: 'Indexed RAG Chunks',  value: analytics.totalChunks,    icon: '🧩', color: 'sky'     },
          { label: 'Active Sessions',     value: analytics.totalSessions,  icon: '⚡', color: 'violet'  },
        ].map(card => (
          <div
            key={card.label}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all"
          >
            <div className="text-2xl mb-3">{card.icon}</div>
            <div className="text-3xl font-bold text-indigo-400 mb-1">{card.value}</div>
            <div className="text-gray-400 text-xs">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Global Settings Form & Mode Breakdown ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Settings Form */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-white text-base font-bold mb-4 flex items-center gap-2">
            <span>⚙️</span> Global AI Controls
          </h3>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Master Switch */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800/60 border border-gray-700/60">
              <div>
                <h4 className="text-white text-sm font-semibold mb-0.5">Master Campus AI Assistant</h4>
                <p className="text-gray-400 text-xs">
                  When toggled OFF, student study sessions and document processing are temporarily disabled.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!settings.ai_enabled}
                  onChange={e => setSettings(s => ({ ...s, ai_enabled: e.target.checked ? 1 : 0 }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Upload Size Cap */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-300">
                  Max Document Upload Limit
                </label>
                <span className="text-xs font-mono font-bold text-indigo-400">
                  {settings.max_upload_mb} MB
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={settings.max_upload_mb}
                onChange={e => setSettings(s => ({ ...s, max_upload_mb: parseInt(e.target.value) }))}
                className="w-full accent-indigo-500 bg-gray-800 h-2 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-gray-500">
                Limits PDF, DOCX, and course reading sizes uploaded by students and faculty.
              </p>
            </div>

            {/* Daily Message Limit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-300">
                  Student Daily Message Limit
                </label>
                <span className="text-xs font-mono font-bold text-indigo-400">
                  {settings.daily_message_limit} msgs / day
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={settings.daily_message_limit}
                onChange={e => setSettings(s => ({ ...s, daily_message_limit: parseInt(e.target.value) }))}
                className="w-full accent-indigo-500 bg-gray-800 h-2 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-gray-500">
                Prevents API abuse and runaway queries by setting a rolling 24-hour rate limit per student.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-950 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Apply & Save Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Col: Usage by Mode & Course Policy Distribution */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
              <span>📊</span> Queries by Study Mode
            </h3>
            {analytics.modeStats.length === 0 ? (
              <p className="text-gray-500 text-xs italic">No mode usage recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {analytics.modeStats.map(m => (
                  <div key={m.mode} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-800/60">
                    <span className="capitalize text-gray-300 font-medium">{m.mode}</span>
                    <span className="font-mono font-bold text-indigo-400">{m.count} chats</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-800">
            <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
              <span>🏫</span> Course Policy Distribution
            </h3>
            <div className="space-y-2 text-xs">
              {analytics.policyStats.map(p => (
                <div key={p.ai_policy} className="flex items-center justify-between p-2 rounded-lg bg-gray-800/60">
                  <span className="capitalize text-gray-300">
                    {p.ai_policy === 'allowed' ? '🟢 Full AI' : p.ai_policy === 'hints_only' ? '🟡 Hints Only' : '🔴 AI Off'}
                  </span>
                  <span className="font-mono font-bold text-white">{p.count} courses</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
