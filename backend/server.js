/**
 * server.js
 * ─────────
 * Entry point: loads the Express app, initialises the database schema,
 * then starts listening on PORT (default 8000).
 */

import dotenv from 'dotenv';
dotenv.config();

import app from './src/app.js';
import { getDb } from './src/db/schema.js';

const PORT = process.env.PORT || 8000;

// Initialise the DB (creates tables if they don't exist) before accepting requests
getDb();

app.listen(PORT, () => {
  console.log(`\n🚀  Campus AI backend running at http://localhost:${PORT}`);
  console.log(`    Health check: http://localhost:${PORT}/api/v1/health\n`);
});
