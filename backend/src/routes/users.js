/**
 * users.js  (route)
 * ─────────────────
 * All user-management endpoints — admin only (except GET /me).
 *
 * GET    /api/v1/users              list all users (paginated, searchable)
 * POST   /api/v1/users              create a user
 * PATCH  /api/v1/users/:id          update name / role / is_active
 * POST   /api/v1/users/:id/reset-password   admin resets a user's password
 * POST   /api/v1/users/bulk-import  CSV upload → create multiple users
 *
 * Security rules enforced here:
 *  - Never expose password_hash
 *  - Cannot deactivate/delete the last active admin
 *  - Admin cannot change their own role (accidental lockout)
 *  - Audit log written on every mutation
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { z } from 'zod';
import { getDb } from '../db/schema.js';
import { authenticate, requireRole } from '../middleware/requireRole.js';
import { writeAudit } from '../utils/audit.js';

const router  = Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const SALT    = 10;

// ── All routes require authentication + admin role ────────────────────────────
router.use(authenticate, requireRole('admin'));

// ── Validation schemas ────────────────────────────────────────────────────────
const createSchema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters'),
  email:    z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role:     z.enum(['admin', 'faculty', 'student']),
});

const updateSchema = z.object({
  name:      z.string().min(2).optional(),
  is_active: z.boolean().optional(),
  role:      z.enum(['admin', 'faculty', 'student']).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'No fields to update' });

const resetPwSchema = z.object({
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
});

// ── Helper: check at least 1 active admin remains ────────────────────────────
function guardLastAdmin(db, userId) {
  const count = db.prepare(
    "SELECT COUNT(*) as n FROM users WHERE role='admin' AND is_active=1 AND id != ?"
  ).get(userId).n;
  return count > 0; // false means this IS the last admin
}

// ── GET /api/v1/users  ────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const db = getDb();
  const { search = '', role = '', page = '1', limit = '20' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = 'SELECT id, name, email, role, is_active, created_at FROM users WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (role) {
    query += ' AND role = ?';
    params.push(role);
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM (${query})`).get(...params).n;
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const users = db.prepare(query).all(...params);
  res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
});

// ── POST /api/v1/users  ───────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const result = createSchema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const { name, email, password, role } = result.data;
  const db = getDb();

  // Check email uniqueness
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ detail: 'Email already in use.' });

  const password_hash = bcrypt.hashSync(password, SALT);
  const info = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(name, email, password_hash, role);

  writeAudit(db, {
    userId: req.user.id, action: 'CREATE_USER',
    targetType: 'user', targetId: info.lastInsertRowid,
    details: { email, role },
  });

  res.status(201).json({ id: info.lastInsertRowid, name, email, role, is_active: 1 });
});

// ── PATCH /api/v1/users/:id  ──────────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const result = updateSchema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ detail: 'User not found.' });

  const updates = result.data;

  // Guard: cannot deactivate or change role of the last active admin
  if ((updates.is_active === false || updates.role) && user.role === 'admin') {
    if (!guardLastAdmin(db, id)) {
      return res.status(400).json({ detail: 'Cannot deactivate or change the role of the last active admin.' });
    }
  }

  // Guard: admin cannot change their own role (accidental lockout)
  if (updates.role && id === req.user.id) {
    return res.status(400).json({ detail: 'You cannot change your own role.' });
  }

  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run(...values, id);

  // Determine audit action
  let action = 'UPDATE_USER';
  if ('is_active' in updates) action = updates.is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER';
  if ('role' in updates) action = 'CHANGE_ROLE';

  writeAudit(db, {
    userId: req.user.id, action,
    targetType: 'user', targetId: id,
    details: updates,
  });

  res.json({ message: 'User updated.' });
});

// ── POST /api/v1/users/:id/reset-password  ────────────────────────────────────
router.post('/:id/reset-password', (req, res) => {
  const id = parseInt(req.params.id);
  const result = resetPwSchema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ detail: 'User not found.' });

  const password_hash = bcrypt.hashSync(result.data.new_password, SALT);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, id);

  writeAudit(db, {
    userId: req.user.id, action: 'RESET_PASSWORD',
    targetType: 'user', targetId: id,
  });

  res.json({ message: 'Password reset successfully.' });
});

// ── POST /api/v1/users/bulk-import  ──────────────────────────────────────────
// CSV format: name,email,password,role  (first row = header, ignored)
router.post('/bulk-import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ detail: 'No file uploaded.' });
  if (!req.file.originalname.endsWith('.csv')) {
    return res.status(400).json({ detail: 'File must be a .csv' });
  }

  const text  = req.file.buffer.toString('utf-8');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Skip header row
  const rows  = lines.slice(1);
  const db    = getDb();
  const results = { created: 0, skipped: 0, errors: [] };

  const insertStmt = db.prepare(
    'INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  );

  // Wrap all inserts in a transaction for speed + atomicity
  const runAll = db.transaction(() => {
    for (const [i, line] of rows.entries()) {
      const [name, email, password, role] = line.split(',').map(s => s?.trim().replace(/^"|"$/g, ''));

      // Validate each row
      const parsed = createSchema.safeParse({ name, email, password, role });
      if (!parsed.success) {
        results.errors.push({ row: i + 2, error: parsed.error.issues[0].message, line });
        continue;
      }

      const hash = bcrypt.hashSync(password, SALT);
      const info = insertStmt.run(name, email, hash, role);

      if (info.changes === 1) {
        results.created++;
        writeAudit(db, {
          userId: req.user.id, action: 'CREATE_USER_BULK',
          targetType: 'user', targetId: info.lastInsertRowid,
          details: { email, role },
        });
      } else {
        results.skipped++; // email already existed
      }
    }
  });

  runAll();
  res.json(results);
});

export default router;
