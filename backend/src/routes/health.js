/**
 * health.js
 * ─────────
 * GET /api/v1/health
 * Public route — no auth required.
 * Returns {"status":"ok","database":"connected"} when everything is fine.
 * Frontend can poll this to show a server-status indicator.
 */

import { Router } from 'express';
import { getDb } from '../db/schema.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    // Simple DB probe: if this throws, the database is broken
    getDb().prepare('SELECT 1').get();
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected', detail: err.message });
  }
});

export default router;
