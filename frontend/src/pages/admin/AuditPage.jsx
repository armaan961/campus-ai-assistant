/**
 * AuditPage.jsx
 * ─────────────
 * Read-only audit log viewer for admins.
 * Shows who did what, when, and on which target.
 * Filterable by action keyword.
 */

import { useState, useEffect } from 'react';
import api from '../../api/axios';

const ACTION_ICONS = {
  CREATE_USER:       '👤+',
  CREATE_USER_BULK:  '👥+',
  DEACTIVATE_USER:   '🚫',
  ACTIVATE_USER:     '✅',
  CHANGE_ROLE:       '🔄',
  RESET_PASSWORD:    '🔑',
  GRADE_CHANGE:      '📝',
  AI_SETTINGS:       '🤖',
};

const ACTION_COLOR = {
  CREATE_USER:       'bg-emerald-900/40 text-emerald-300',
  CREATE_USER_BULK:  'bg-emerald-900/40 text-emerald-300',
  DEACTIVATE_USER:   'bg-red-900/40     text-red-300',
  ACTIVATE_USER:     'bg-sky-900/40     text-sky-300',
  CHANGE_ROLE:       'bg-violet-900/40  text-violet-300',
  RESET_PASSWORD:    'bg-amber-900/40   text-amber-300',
};

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr + 'Z')) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff/3600)}h ago`;
  return new Date(isoStr).toLocaleDateString();
}

export default function AuditPage() {
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [action,  setAction]  = useState('');
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const LIMIT = 25;

  async function fetchLogs() {
    setLoading(true);
    try {
      const { data } = await api.get('/audit', { params: { action, page, limit: LIMIT } });
      setLogs(data.logs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLogs(); }, [action, page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Audit Log</h2>
          <p className="text-gray-400 text-sm">{total} total entries</p>
        </div>
        <input
          id="audit-search"
          type="text"
          placeholder="Filter by action…"
          value={action}
          onChange={e => { setAction(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700
                     text-white placeholder-gray-500 text-sm w-64
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No audit entries found</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {logs.map(log => (
              <div key={log.id}
                className="flex items-start gap-4 px-5 py-4 hover:bg-gray-800/40 transition-colors">
                {/* Action icon */}
                <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center
                                text-lg flex-shrink-0 mt-0.5">
                  {ACTION_ICONS[log.action] || '📋'}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-medium
                      ${ACTION_COLOR[log.action] || 'bg-gray-800 text-gray-300'}`}>
                      {log.action}
                    </span>
                    {log.target_type && (
                      <span className="text-gray-500 text-xs">
                        on {log.target_type} #{log.target_id}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-300 text-sm">
                    <span className="text-white font-medium">{log.actor_name}</span>
                    <span className="text-gray-500 mx-1">({log.actor_role})</span>
                  </div>
                  {log.details && (
                    <div className="mt-1.5 text-xs text-gray-500 font-mono bg-gray-800/60
                                    rounded-lg px-3 py-1.5 inline-block max-w-full overflow-x-auto">
                      {log.details}
                    </div>
                  )}
                </div>

                {/* Time */}
                <div className="text-right flex-shrink-0">
                  <div className="text-gray-500 text-xs">{timeAgo(log.created_at)}</div>
                  <div className="text-gray-600 text-xs mt-0.5">
                    {new Date(log.created_at + 'Z').toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
            <span className="text-gray-500 text-xs">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                className="px-3 py-1 rounded-lg bg-gray-800 text-gray-300 text-xs
                           disabled:opacity-40 hover:bg-gray-700">← Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                className="px-3 py-1 rounded-lg bg-gray-800 text-gray-300 text-xs
                           disabled:opacity-40 hover:bg-gray-700">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
