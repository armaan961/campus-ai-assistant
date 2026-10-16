/**
 * requireRole.js
 * ──────────────
 * Two middleware functions:
 *
 * 1. authenticate(req, res, next)
 *    Reads the Bearer token from Authorization header,
 *    verifies it, and attaches `req.user = { id, name, role }`.
 *
 * 2. requireRole(...roles)
 *    Factory that returns middleware checking req.user.role
 *    is one of the allowed roles.
 *
 * Usage in a route file:
 *   import { authenticate, requireRole } from '../middleware/requireRole.js';
 *   router.get('/admin-only', authenticate, requireRole('admin'), handler);
 *   router.get('/staff',      authenticate, requireRole('admin','faculty'), handler);
 */

import jwt from 'jsonwebtoken';

/**
 * authenticate — verifies JWT and populates req.user.
 * Returns 401 if token is missing or invalid/expired.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ detail: 'Authentication token required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Attach the decoded payload so downstream handlers can use req.user
    req.user = {
      id:   payload.sub,   // user ID stored in "sub" claim
      name: payload.name,
      role: payload.role,
    };
    next();
  } catch (err) {
    // TokenExpiredError, JsonWebTokenError, etc.
    return res.status(401).json({ detail: 'Invalid or expired token.' });
  }
}

/**
 * requireRole(...allowedRoles)
 * Returns a middleware that passes if req.user.role is in allowedRoles,
 * otherwise responds 403 Forbidden.
 *
 * Always pair with `authenticate` first:
 *   router.get('/x', authenticate, requireRole('admin'), handler)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      // Shouldn't happen if `authenticate` runs first, but guard anyway
      return res.status(401).json({ detail: 'Not authenticated.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        detail: `Access denied. Required role(s): ${allowedRoles.join(', ')}.`,
      });
    }

    next();
  };
}
