/**
 * axios.js
 * ────────
 * Configures a single axios instance used throughout the app.
 *
 * Two interceptors:
 *  1. REQUEST  — automatically attaches the JWT from localStorage as
 *                "Authorization: Bearer <token>" so every component can
 *                just call `api.get('/...')` without repeating the header.
 *
 *  2. RESPONSE — if the server returns 401 (token expired / invalid),
 *                clears localStorage and sends the user to /login.
 */

import axios from 'axios';

const api = axios.create({
  // Vite's proxy forwards /api → http://localhost:8000, so no hardcoded host
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach Bearer token ──────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 globally ─────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — force re-login
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
