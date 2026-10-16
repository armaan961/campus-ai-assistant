/**
 * audit.js  (utility)
 * ───────────────────
 * Thin wrapper that inserts a row into audit_logs.
 * Call this after every mutating admin action.
 *
 * Usage:
 *   import { writeAudit } from '../utils/audit.js';
 *   writeAudit(db, { userId: req.user.id, action: 'CREATE_USER',
 *                    targetType: 'user', targetId: newUser.id,
 *                    details: { email } });
 */

export function writeAudit(db, { userId, action, targetType = null, targetId = null, details = null }) {
  db.prepare(`
    INSERT INTO audit_logs (user_id, action, target_type, target_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    userId,
    action,
    targetType,
    targetId,
    details ? JSON.stringify(details) : null
  );
}
