/**
 * app.js
 * ──────
 * Configures and exports the Express application.
 * Kept separate from server.js so it's easy to test without starting a real server.
 *
 * Middleware order matters:
 *   CORS → JSON parser → Routes → 404 handler → Error handler
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import healthRouter      from './routes/health.js';
import authRouter        from './routes/auth.js';
import usersRouter       from './routes/users.js';
import departmentsRouter from './routes/departments.js';
import auditRouter       from './routes/audit.js';
import facultyRouter     from './routes/faculty.js';
import studentRouter     from './routes/student.js';
import aiRouter          from './routes/ai.js';

dotenv.config();

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Only allow the Vite dev server. Adjust in production.
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json());             // parse application/json
app.use(express.urlencoded({ extended: false })); // parse form bodies if needed

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/health',  healthRouter);
app.use('/api/v1/auth',    authRouter);
app.use('/api/v1/users',   usersRouter);
app.use('/api/v1/faculty', facultyRouter);
app.use('/api/v1/student', studentRouter);
app.use('/api/v1/ai',      aiRouter);
app.use('/api/v1/audit',   auditRouter);
app.use('/api/v1',         departmentsRouter); // serves /departments, /courses, /offerings, /enrollments, /semesters

// More routers will be mounted here in Phase 2+:
// app.use('/api/v1/auth',    authRouter);
// app.use('/api/v1/users',   usersRouter);
// ... etc.

// ── 404 Catch-all ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ detail: `Route ${req.method} ${req.path} not found.` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
// Express recognises a 4-argument function as an error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ detail: 'Internal server error.' });
});

export default app;
