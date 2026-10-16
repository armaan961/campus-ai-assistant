/**
 * AuthContext.jsx
 * ───────────────
 * Provides authentication state to the entire app via React Context.
 *
 * Exposes:
 *   user        — { id, name, role } or null when not logged in
 *   login(email, password) — calls API, stores token, returns role
 *   logout()    — clears everything and redirects to /login
 *   loading     — true while restoring session from localStorage on mount
 *
 * Token storage: localStorage (acceptable for workshop; in production,
 * consider httpOnly cookies to mitigate XSS).
 *
 * The token payload is a JWT — we decode it client-side ONLY for display
 * purposes (name, role). The server always re-validates on every request.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

// ── Create context ────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

/** Decode the payload of a JWT without verifying signature (display only) */
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // restoring session

  // On first mount, restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        setUser({ id: decoded.sub, name: decoded.name, role: decoded.role });
      } else {
        // Corrupt token — clear it
        localStorage.removeItem('access_token');
      }
    }
    setLoading(false);
  }, []);

  /**
   * login(email, password)
   * Calls POST /api/v1/auth/login.
   * On success: stores token, updates user state, returns the role string.
   * On failure: throws so the login page can show an error message.
   */
  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    const { access_token, role, name } = res.data;

    localStorage.setItem('access_token', access_token);

    const decoded = decodeToken(access_token);
    const userData = { id: decoded.sub, name, role };
    setUser(userData);

    return role; // caller uses this to redirect
  }

  /** logout — clears token and resets state */
  function logout() {
    localStorage.removeItem('access_token');
    setUser(null);
    // Hard navigate so all in-memory state is wiped
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

/** useAuth() — convenience hook, throws if used outside AuthProvider */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
