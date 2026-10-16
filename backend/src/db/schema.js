/**
 * schema.js
 * ─────────
 * Creates every SQLite table the app needs.
 * Called once at server startup — safe to run multiple times (IF NOT EXISTS).
 * Using better-sqlite3 which is synchronous: perfect for simple workshop code.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || './campus_ai.db';

// Resolve relative path from the backend/ folder root
const dbFile = path.resolve(__dirname, '../../', DB_PATH);

let db;

/**
 * getDb() — returns the singleton DB connection.
 * Calling it the first time also runs initSchema().
 */
export function getDb() {
  if (!db) {
    db = new Database(dbFile);
    db.pragma('journal_mode = WAL'); // Better concurrent read performance
    db.pragma('foreign_keys = ON');  // Enforce FK constraints
    initSchema(db);
  }
  return db;
}

/** Run all CREATE TABLE IF NOT EXISTS statements */
function initSchema(db) {
  db.exec(`
    -- ── Users ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      email        TEXT    NOT NULL UNIQUE,
      password_hash TEXT   NOT NULL,
      role         TEXT    NOT NULL CHECK(role IN ('admin','faculty','student')),
      is_active    INTEGER NOT NULL DEFAULT 1,   -- 1 = active, 0 = deactivated
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Departments ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS departments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Courses ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS courses (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_id       INTEGER NOT NULL REFERENCES departments(id),
      code          TEXT    NOT NULL UNIQUE,  -- e.g. "CS101"
      title         TEXT    NOT NULL,
      credits       INTEGER NOT NULL DEFAULT 3,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Semesters ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS semesters (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      label      TEXT    NOT NULL UNIQUE,   -- e.g. "Fall 2025"
      start_date TEXT,
      end_date   TEXT,
      is_active  INTEGER NOT NULL DEFAULT 1
    );

    -- ── Course Offerings ───────────────────────────────────────────────────
    -- One row per (course, semester, faculty) combination
    CREATE TABLE IF NOT EXISTS course_offerings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id   INTEGER NOT NULL REFERENCES courses(id),
      faculty_id  INTEGER NOT NULL REFERENCES users(id),
      semester_id INTEGER NOT NULL REFERENCES semesters(id),
      ai_policy   TEXT    NOT NULL DEFAULT 'allowed'
                          CHECK(ai_policy IN ('allowed','hints_only','disabled')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Enrollments ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS enrollments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER NOT NULL REFERENCES users(id),
      offering_id INTEGER NOT NULL REFERENCES course_offerings(id),
      grade       TEXT,                       -- null until graded
      enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, offering_id)
    );

    -- ── Announcements ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS announcements (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      offering_id INTEGER NOT NULL REFERENCES course_offerings(id),
      faculty_id  INTEGER NOT NULL REFERENCES users(id),
      title       TEXT    NOT NULL,
      body        TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Assignments ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS assignments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      offering_id  INTEGER NOT NULL REFERENCES course_offerings(id),
      title        TEXT    NOT NULL,
      description  TEXT,
      due_date     TEXT,
      max_score    INTEGER NOT NULL DEFAULT 100,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Submissions ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS submissions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES assignments(id),
      student_id    INTEGER NOT NULL REFERENCES users(id),
      file_path     TEXT,
      score         INTEGER,
      feedback      TEXT,
      submitted_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      graded_at     TEXT,
      UNIQUE(assignment_id, student_id)
    );

    -- ── Attendance ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS attendance (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      offering_id INTEGER NOT NULL REFERENCES course_offerings(id),
      student_id  INTEGER NOT NULL REFERENCES users(id),
      date        TEXT    NOT NULL,   -- ISO date "YYYY-MM-DD"
      status      TEXT    NOT NULL CHECK(status IN ('present','absent','late')),
      UNIQUE(offering_id, student_id, date)
    );

    -- ── Documents ──────────────────────────────────────────────────────────
    -- owner_id = student or faculty who uploaded; offering_id = optional course link
    CREATE TABLE IF NOT EXISTS documents (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id    INTEGER NOT NULL REFERENCES users(id),
      offering_id INTEGER REFERENCES course_offerings(id),
      filename    TEXT    NOT NULL,
      file_path   TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Document Chunks (for RAG) ───────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS document_chunks (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id    INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      content        TEXT    NOT NULL,
      page           INTEGER,                -- original page number
      embedding_json TEXT                   -- JSON array of floats
    );

    -- ── Chat Sessions ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER NOT NULL REFERENCES users(id),
      document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
      mode        TEXT    NOT NULL DEFAULT 'ask'
                          CHECK(mode IN ('ask','explain','brainstorm','quiz','summarize')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Chat Messages ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS chat_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role       TEXT    NOT NULL CHECK(role IN ('user','assistant')),
      content    TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── AI Global Settings ─────────────────────────────────────────────────
    -- Single-row table; insert the default row in seed.js
    CREATE TABLE IF NOT EXISTS ai_settings (
      id                  INTEGER PRIMARY KEY CHECK(id = 1),  -- always row 1
      ai_enabled          INTEGER NOT NULL DEFAULT 1,
      max_upload_mb       INTEGER NOT NULL DEFAULT 20,
      daily_message_limit INTEGER NOT NULL DEFAULT 50
    );

    -- ── Audit Logs ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      action      TEXT    NOT NULL,   -- e.g. "CREATE_USER", "RESET_PASSWORD"
      target_type TEXT,               -- e.g. "user", "course"
      target_id   INTEGER,
      details     TEXT,               -- free-form JSON string
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
