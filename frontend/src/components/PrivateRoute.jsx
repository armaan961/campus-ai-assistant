/**
 * PrivateRoute.jsx
 * ────────────────
 * Wraps a route so only authenticated users with the right role can access it.
 *
 * Props:
 *   roles (string[]) — list of allowed roles, e.g. ['admin'] or ['faculty','admin']
 *
 * Behaviour:
 *   - While auth is restoring (loading=true) → show a full-screen spinner
 *   - Not logged in → redirect to /login
 *   - Wrong role → redirect to their own dashboard (prevents URL-guessing)
 *   - Correct role → render children
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Maps a role to its home dashboard path */
const ROLE_HOME = {
  admin:   '/admin',
  faculty: '/faculty',
  student: '/student',
};

export default function PrivateRoute({ roles }) {
  const { user, loading } = useAuth();

  // Still restoring session — show full-page spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but wrong role — redirect to their dashboard
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  }

  // All good — render nested routes
  return <Outlet />;
}
