/**
 * audit.js  (route)
 * ─────────────────
 * GET /api/v1/audit
 * Admin-only: returns paginated audit log with user name joined.
 * Supports ?action=, ?user_id=, ?page=, ?limit=
 */

import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { authenticate, requireRole } from '../middleware/requireRole.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/', (req, res) => {
  const db = getDb();
  const { action = '', user_id = '', page = '1', limit = '50' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let q = `
    SELECT al.*, u.name as actor_name, u.role as actor_role
    FROM audit_logs al
    JOIN users u ON u.id = al.user_id
    WHERE 1=1
  `;
  const params = [];

  if (action)  { q += ' AND al.action LIKE ?'; params.push(`%${action}%`); }
  if (user_id) { q += ' AND al.user_id = ?';   params.push(user_id); }

  const total = db.prepare(`SELECT COUNT(*) as n FROM (${q})`).get(...params).n;
  q += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const logs = db.prepare(q).all(...params);
  res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
});

export default router;
