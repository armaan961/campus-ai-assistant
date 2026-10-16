/**
 * UsersPage.jsx
 * ─────────────
 * Admin user management:
 *  - Searchable, filterable table of all users
 *  - Create user modal (name, email, password, role)
 *  - Deactivate / reactivate toggle
 *  - Reset password modal
 *  - CSV bulk import with results summary
 */

import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';

// ── Role badge helper ─────────────────────────────────────────────────────────
const ROLE_STYLE = {
  admin:   'bg-indigo-900/60 text-indigo-300 border-indigo-700',
  faculty: 'bg-sky-900/60    text-sky-300    border-sky-700',
  student: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
};

function RoleBadge({ role }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold
                      border capitalize ${ROLE_STYLE[role] || 'bg-gray-800 text-gray-400'}`}>
      {role}
    </span>
  );
}

// ── Field component ───────────────────────────────────────────────────────────
function Field({ label, id, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700
                 text-white placeholder-gray-500 text-sm
                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700
                 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {children}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const toast = useToast();

  // Table state
  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [search,  setSearch]  = useState('');
  const [roleFilter, setRole] = useState('');
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);

  // Modals
  const [createOpen,    setCreateOpen]    = useState(false);
  const [resetOpen,     setResetOpen]     = useState(false);
  const [resetTarget,   setResetTarget]   = useState(null);
  const [csvOpen,       setCsvOpen]       = useState(false);

  // Create form
  const [form, setForm]   = useState({ name:'', email:'', password:'', role:'student' });
  const [formErr, setFormErr] = useState({});
  const [submitting, setSub] = useState(false);

  // Reset password form
  const [newPw, setNewPw] = useState('');

  // CSV
  const fileRef = useRef(null);
  const [csvResult, setCsvResult] = useState(null);

  const LIMIT = 10;

  // ── Fetch users ─────────────────────────────────────────────────────────────
  async function fetchUsers() {
    setLoading(true);
    try {
      const { data } = await api.get('/users', {
        params: { search, role: roleFilter, page, limit: LIMIT },
      });
      setUsers(data.users);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, [search, roleFilter, page]);

  // ── Create user ─────────────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    setFormErr({});
    setSub(true);
    try {
      await api.post('/users', form);
      toast.success('User created successfully!');
      setCreateOpen(false);
      setForm({ name:'', email:'', password:'', role:'student' });
      fetchUsers();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to create user';
      toast.error(msg);
      setFormErr({ general: msg });
    } finally {
      setSub(false);
    }
  }

  // ── Toggle active ───────────────────────────────────────────────────────────
  async function toggleActive(user) {
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active });
      toast.success(`User ${user.is_active ? 'deactivated' : 'reactivated'}.`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update user');
    }
  }

  // ── Reset password ──────────────────────────────────────────────────────────
  async function handleResetPw(e) {
    e.preventDefault();
    if (newPw.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await api.post(`/users/${resetTarget.id}/reset-password`, { new_password: newPw });
      toast.success('Password reset successfully.');
      setResetOpen(false);
      setNewPw('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    }
  }

  // ── CSV import ──────────────────────────────────────────────────────────────
  async function handleCsv() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error('Please select a CSV file');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/users/bulk-import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCsvResult(data);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'CSV import failed');
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Users</h2>
          <p className="text-gray-400 text-sm">{total} total accounts</p>
        </div>
        <div className="flex gap-2">
          <button
            id="btn-csv-import"
            onClick={() => { setCsvOpen(true); setCsvResult(null); }}
            className="px-4 py-2 rounded-xl border border-gray-700 text-gray-300
                       hover:bg-gray-800 text-sm font-medium transition-all"
          >
            📥 CSV Import
          </button>
          <button
            id="btn-create-user"
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500
                       text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-900/40"
          >
            + New User
          </button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          id="user-search"
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700
                     text-white placeholder-gray-500 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          id="role-filter"
          value={roleFilter}
          onChange={e => { setRole(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700
                     text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="faculty">Faculty</option>
          <option value="student">Student</option>
        </select>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Role</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Joined</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    <div className="inline-block w-6 h-6 border-2 border-indigo-400
                                    border-t-transparent rounded-full animate-spin" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}
                    className="border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors">
                    {/* Avatar + Name */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-700/60
                                        flex items-center justify-center text-white text-xs font-bold">
                          {u.name[0].toUpperCase()}
                        </div>
                        <span className="text-white font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-400">{u.email}</td>
                    <td className="px-5 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium
                        ${u.is_active
                          ? 'bg-emerald-900/40 text-emerald-400'
                          : 'bg-red-900/40 text-red-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setResetTarget(u); setResetOpen(true); }}
                          className="text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700
                                     text-gray-300 transition-colors"
                          title="Reset password"
                        >
                          🔑
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors
                            ${u.is_active
                              ? 'bg-red-900/40 hover:bg-red-900/70 text-red-400'
                              : 'bg-emerald-900/40 hover:bg-emerald-900/70 text-emerald-400'}`}
                          title={u.is_active ? 'Deactivate' : 'Reactivate'}
                        >
                          {u.is_active ? '🚫' : '✅'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
            <span className="text-gray-500 text-xs">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg bg-gray-800 text-gray-300 text-xs
                           disabled:opacity-40 hover:bg-gray-700 transition-colors"
              >← Prev</button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded-lg bg-gray-800 text-gray-300 text-xs
                           disabled:opacity-40 hover:bg-gray-700 transition-colors"
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create User Modal ───────────────────────────────────────────── */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create New User">
        <form id="create-user-form" onSubmit={handleCreate} className="space-y-4">
          <Field label="Full Name" id="new-name">
            <Input id="new-name" placeholder="Jane Doe"
              value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          </Field>
          <Field label="Email" id="new-email">
            <Input id="new-email" type="email" placeholder="jane@campus.edu"
              value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
          </Field>
          <Field label="Password" id="new-password">
            <Input id="new-password" type="password" placeholder="Min. 6 characters"
              value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} />
          </Field>
          <Field label="Role" id="new-role">
            <Select id="new-role" value={form.role}
              onChange={e => setForm(f => ({...f, role: e.target.value}))}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>

          {formErr.general && (
            <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3
                            text-red-300 text-sm">{formErr.general}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300
                         hover:bg-gray-800 text-sm transition-all">
              Cancel
            </button>
            <button id="create-user-submit" type="submit" disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
                         text-white text-sm font-semibold transition-all disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Reset Password Modal ────────────────────────────────────────── */}
      <Modal isOpen={resetOpen} onClose={() => setResetOpen(false)} title="Reset Password" size="sm">
        <form onSubmit={handleResetPw} className="space-y-4">
          <p className="text-gray-400 text-sm">
            Resetting password for <span className="text-white font-medium">{resetTarget?.name}</span>
          </p>
          <Field label="New Password" id="reset-pw">
            <Input id="reset-pw" type="password" placeholder="Min. 6 characters"
              value={newPw} onChange={e => setNewPw(e.target.value)} />
          </Field>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setResetOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300
                         hover:bg-gray-800 text-sm transition-all">Cancel</button>
            <button id="reset-pw-submit" type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500
                         text-white text-sm font-semibold transition-all">Reset</button>
          </div>
        </form>
      </Modal>

      {/* ── CSV Import Modal ────────────────────────────────────────────── */}
      <Modal isOpen={csvOpen} onClose={() => setCsvOpen(false)} title="Bulk CSV Import">
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-xl p-4 text-xs text-gray-400 font-mono leading-relaxed">
            <p className="text-gray-300 font-semibold mb-2">Expected CSV format:</p>
            name,email,password,role<br />
            John Doe,john@campus.edu,Pass@123,student<br />
            Jane Smith,jane@campus.edu,Pass@123,faculty
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Select CSV file</label>
            <input
              id="csv-file-input"
              ref={fileRef}
              type="file"
              accept=".csv"
              className="block w-full text-sm text-gray-400
                         file:mr-4 file:py-2 file:px-4 file:rounded-lg
                         file:border-0 file:text-sm file:font-medium
                         file:bg-indigo-600 file:text-white
                         hover:file:bg-indigo-500 cursor-pointer"
            />
          </div>

          {csvResult && (
            <div className="bg-gray-800 rounded-xl p-4 text-sm space-y-2">
              <div className="flex gap-4">
                <span className="text-emerald-400">✓ Created: {csvResult.created}</span>
                <span className="text-yellow-400">⚠ Skipped: {csvResult.skipped}</span>
                <span className="text-red-400">✕ Errors: {csvResult.errors.length}</span>
              </div>
              {csvResult.errors.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {csvResult.errors.map((e, i) => (
                    <p key={i} className="text-red-400 text-xs">
                      Row {e.row}: {e.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setCsvOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300
                         hover:bg-gray-800 text-sm transition-all">Close</button>
            <button id="csv-import-submit" onClick={handleCsv}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
                         text-white text-sm font-semibold transition-all">
              Import
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
