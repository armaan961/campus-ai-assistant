/**
 * auth.js
 * ───────
 * POST /api/v1/auth/login
 *
 * Body: { email, password }
 * Response: { access_token, role, name }
 *
 * Steps:
 *  1. Validate body with zod
 *  2. Look up user by email
 *  3. Check is_active flag
 *  4. bcrypt.compare password
 *  5. Sign JWT (sub=id, role, name, exp)
 *  6. Return token + role so the frontend can redirect correctly
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getDb } from '../db/schema.js';

const router = Router();

// ── Input validation schema ────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/v1/auth/login
router.post('/login', (req, res) => {
  // 1. Validate request body
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({ detail: result.error.issues[0].message });
  }

  const { email, password } = result.data;
  const db = getDb();

  // 2. Find user by email
  const user = db.prepare(
    'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ?'
  ).get(email);

  // Return the same vague message for both "not found" and "wrong password"
  // to prevent user-enumeration attacks
  const INVALID = 'Invalid email or password.';

  if (!user) {
    return res.status(401).json({ detail: INVALID });
  }

  // 3. Check account is active
  if (!user.is_active) {
    return res.status(403).json({ detail: 'Your account has been deactivated. Contact your administrator.' });
  }

  // 4. Compare password hash
  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ detail: INVALID });
  }

  // 5. Sign JWT
  const token = jwt.sign(
    {
      sub:  user.id,      // subject = user ID
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  // 6. Return token + role (frontend needs role to redirect to correct dashboard)
  return res.json({
    access_token: token,
    role: user.role,
    name: user.name,
  });
});

export default router;
