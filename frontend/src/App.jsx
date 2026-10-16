/**
 * App.jsx — Phase 2+
 * ───────────────────
 * Sets up React Router with:
 *  - AuthProvider  (global login state)
 *  - ToastProvider (global notifications)
 *  - PrivateRoute  (role-based guards)
 *  - Three dashboard roots: /admin, /faculty, /student
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import PrivateRoute      from './components/PrivateRoute';
import ChatbotWidget     from './components/ChatbotWidget';
import LoginPage         from './pages/LoginPage';
import AdminDashboard    from './pages/admin/AdminDashboard';
import FacultyDashboard  from './pages/faculty/FacultyDashboard';
import StudentDashboard  from './pages/student/StudentDashboard';

/** Root redirect: send logged-in users to their dashboard, others to /login */
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null; // let PrivateRoute handle the spinner
  if (!user)   return <Navigate to="/login" replace />;
  const home = { admin: '/admin', faculty: '/faculty', student: '/student' };
  return <Navigate to={home[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Root → smart redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* ── Admin (role: admin) ───────────────────────────────── */}
            <Route element={<PrivateRoute roles={['admin']} />}>
              <Route path="/admin/*" element={<AdminDashboard />} />
            </Route>

            {/* ── Faculty (role: faculty) ───────────────────────────── */}
            <Route element={<PrivateRoute roles={['faculty']} />}>
              <Route path="/faculty/*" element={<FacultyDashboard />} />
            </Route>

            {/* ── Student (role: student) ───────────────────────────── */}
            <Route element={<PrivateRoute roles={['student']} />}>
              <Route path="/student/*" element={<StudentDashboard />} />
            </Route>

            {/* Catch-all → root redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ChatbotWidget />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
