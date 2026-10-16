/**
 * ai.js (route)
 * ────────────
 * Endpoints for:
 *  - File upload & ingestion into RAG chunks
 *  - Document management (list, view, delete)
 *  - Chat sessions & messages across 5 modes
 *  - Campus FAQ knowledge base
 *  - Admin AI global settings & analytics
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { getDb } from '../db/schema.js';
import { authenticate, requireRole } from '../middleware/requireRole.js';
import { writeAudit } from '../utils/audit.js';
import {
  extractTextFromFile,
  chunkText,
  searchChunks,
  generateAiResponse,
  CAMPUS_FAQ
} from '../utils/ai.js';

const router = Router();

// Multer storage configuration
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_MB) || 20) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only PDF, DOCX, TXT, and Markdown files are supported.'));
    }
    cb(null, true);
  },
});

// ── 1. Document Upload & Ingest Pipeline ───────────────────────────────────────

router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ detail: 'No file uploaded.' });
  }

  const db = getDb();

  // Check global AI settings
  const settings = db.prepare('SELECT * FROM ai_settings WHERE id = 1').get();
  if (settings && !settings.ai_enabled) {
    fs.unlinkSync(req.file.path);
    return res.status(403).json({ detail: 'AI features are currently disabled campus-wide by the administrator.' });
  }

  const offeringId = req.body.offering_id ? parseInt(req.body.offering_id) : null;

  try {
    // 1. Extract text
    const { text, numPages } = await extractTextFromFile(req.file.path, req.file.originalname);
    if (!text || text.trim().length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ detail: 'Could not extract readable text from document.' });
    }

    // 2. Chunk text
    const chunks = chunkText(text);

    // 3. Save into SQLite via transaction
    const insertDoc = db.prepare(`
      INSERT INTO documents (owner_id, offering_id, filename, file_path)
      VALUES (?, ?, ?, ?)
    `);

    const insertChunk = db.prepare(`
      INSERT INTO document_chunks (document_id, content, page, embedding_json)
      VALUES (?, ?, ?, ?)
    `);

    let docId;
    db.transaction(() => {
      const info = insertDoc.run(req.user.id, offeringId, req.file.originalname, req.file.path);
      docId = info.lastInsertRowid;
      for (const ch of chunks) {
        insertChunk.run(docId, ch.content, ch.page, null);
      }
    })();

    res.status(201).json({
      id: docId,
      filename: req.file.originalname,
      chunks_count: chunks.length,
      pages: numPages,
      message: 'Document successfully ingested for AI study!',
    });
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Document processing error:', err);
    res.status(500).json({ detail: 'Failed to process and chunk document: ' + err.message });
  }
});

// ── 2. List & Delete Documents ────────────────────────────────────────────────

router.get('/documents', authenticate, (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  // Documents owned by user OR linked to courses user is enrolled in/teaches
  const docs = db.prepare(`
    SELECT d.id, d.owner_id, d.offering_id, d.filename, d.created_at,
           COUNT(dc.id) as chunk_count,
           u.name as owner_name,
           c.code as course_code
    FROM documents d
    JOIN users u ON u.id = d.owner_id
    LEFT JOIN document_chunks dc ON dc.document_id = d.id
    LEFT JOIN course_offerings co ON co.id = d.offering_id
    LEFT JOIN courses c ON c.id = co.course_id
    WHERE d.owner_id = ? OR d.offering_id IN (
      SELECT offering_id FROM enrollments WHERE student_id = ?
      UNION
      SELECT id FROM course_offerings WHERE faculty_id = ?
    )
    GROUP BY d.id
    ORDER BY d.id DESC
  `).all(userId, userId, userId);

  res.json(docs);
});

router.delete('/documents/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ detail: 'Invalid document ID.' });
    }

    // Fetch document metadata to retrieve file_path and check existence/ownership
    const doc = db.prepare('SELECT file_path, owner_id FROM documents WHERE id = ?').get(id);

    // Return 404 if not found or if the logged-in user is not the owner (and not admin)
    if (!doc || (req.user.role !== 'admin' && doc.owner_id !== req.user.id)) {
      return res.status(404).json({ detail: 'Document not found.' });
    }

    // 1. Run deletion in one better-sqlite3 transaction:
    //    - DELETE FROM document_chunks WHERE document_id = ?
    //    - UPDATE chat_sessions SET document_id = NULL WHERE document_id = ?
    //    - DELETE FROM documents WHERE id = ? AND owner_id = <logged-in student id>
    let deleteResult;
    const deleteTx = db.transaction(() => {
      // Clean up child chunks referencing documents(id)
      db.prepare('DELETE FROM document_chunks WHERE document_id = ?').run(id);

      // Detach any chat sessions referencing documents(id) so FK constraint is satisfied
      db.prepare('UPDATE chat_sessions SET document_id = NULL WHERE document_id = ?').run(id);

      // Delete document enforcing owner_id (or permit admin)
      if (req.user.role === 'admin') {
        deleteResult = db.prepare('DELETE FROM documents WHERE id = ?').run(id);
      } else {
        deleteResult = db.prepare('DELETE FROM documents WHERE id = ? AND owner_id = ?').run(id, req.user.id);
      }
    });

    deleteTx();

    // 3. Return 404 if no row was deleted (not the owner or not found)
    if (!deleteResult || deleteResult.changes === 0) {
      return res.status(404).json({ detail: 'Document not found.' });
    }

    // 2. Delete the uploaded file from disk afterwards inside try/catch so a missing file never fails request
    if (doc?.file_path) {
      try {
        if (fs.existsSync(doc.file_path)) {
          fs.unlinkSync(doc.file_path);
        }
      } catch (fileErr) {
        console.error('Failed to unlink uploaded file from disk (non-fatal):', fileErr?.message || fileErr);
      }
    }

    return res.json({ message: 'Document and study chunks deleted.' });
  } catch (err) {
    console.error('Error deleting document:', err);
    return res.status(500).json({ detail: `Failed to delete document: ${err?.message || 'Server error'}` });
  }
});

// ── 3. Chat Sessions & Messages ───────────────────────────────────────────────

router.get('/chat/sessions', authenticate, (req, res) => {
  const db = getDb();
  const sessions = db.prepare(`
    SELECT s.*, d.filename as document_name,
           (SELECT content FROM chat_messages WHERE session_id = s.id ORDER BY id DESC LIMIT 1) as last_message,
           (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.id) as message_count
    FROM chat_sessions s
    LEFT JOIN documents d ON d.id = s.document_id
    WHERE s.student_id = ?
    ORDER BY s.id DESC
  `).all(req.user.id);

  res.json(sessions);
});

router.post('/chat/session', authenticate, (req, res) => {
  const schema = z.object({
    document_id: z.number().int().positive().nullable().optional(),
    mode:        z.enum(['ask', 'explain', 'brainstorm', 'quiz', 'summarize']).default('ask'),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const { document_id, mode } = result.data;

  const info = db.prepare(`
    INSERT INTO chat_sessions (student_id, document_id, mode)
    VALUES (?, ?, ?)
  `).run(req.user.id, document_id || null, mode);

  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(session);
});

router.get('/chat/sessions/:id', authenticate, (req, res) => {
  const db = getDb();
  const sessionId = parseInt(req.params.id);

  const session = db.prepare(`
    SELECT s.*, d.filename as document_name, d.offering_id
    FROM chat_sessions s
    LEFT JOIN documents d ON d.id = s.document_id
    WHERE s.id = ?
  `).get(sessionId);

  if (!session) return res.status(404).json({ detail: 'Session not found.' });
  if (req.user.role !== 'admin' && session.student_id !== req.user.id) {
    return res.status(403).json({ detail: 'Permission denied.' });
  }

  const messages = db.prepare(`
    SELECT * FROM chat_messages WHERE session_id = ? ORDER BY id ASC
  `).all(sessionId);

  res.json({ session, messages });
});

router.delete('/chat/sessions/:id', authenticate, (req, res) => {
  const db = getDb();
  const sessionId = parseInt(req.params.id);
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(sessionId);

  if (!session) return res.status(404).json({ detail: 'Session not found.' });
  if (req.user.role !== 'admin' && session.student_id !== req.user.id) {
    return res.status(403).json({ detail: 'Permission denied.' });
  }

  db.transaction(() => {
    db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(sessionId);
  })();

  res.json({ message: 'Session deleted.' });
});

// ── 4. Send Message & Run RAG Pipeline ────────────────────────────────────────

router.post('/chat/sessions/:id/message', authenticate, async (req, res) => {
  const schema = z.object({
    content:     z.string().min(1, 'Message cannot be empty.'),
    mode:        z.enum(['ask', 'explain', 'brainstorm', 'quiz', 'summarize']).optional(),
    offering_id: z.number().int().positive().nullable().optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const sessionId = parseInt(req.params.id);
  const userPrompt = result.data.content.trim();

  // 1. Verify session exists and belongs to user
  const session = db.prepare(`
    SELECT s.*, d.offering_id as doc_offering_id, d.filename as doc_filename
    FROM chat_sessions s
    LEFT JOIN documents d ON d.id = s.document_id
    WHERE s.id = ?
  `).get(sessionId);

  if (!session) return res.status(404).json({ detail: 'Session not found.' });
  if (req.user.role !== 'admin' && session.student_id !== req.user.id) {
    return res.status(403).json({ detail: 'Permission denied.' });
  }

  // 2. Check Daily Message Limits
  const settings = db.prepare('SELECT * FROM ai_settings WHERE id = 1').get();
  if (settings && !settings.ai_enabled) {
    return res.status(403).json({ detail: 'AI assistance is currently disabled by university administration.' });
  }

  const todayCount = db.prepare(`
    SELECT COUNT(*) as n FROM chat_messages m
    JOIN chat_sessions s ON s.id = m.session_id
    WHERE s.student_id = ? AND m.role = 'user' AND date(m.created_at) = date('now')
  `).get(req.user.id).n;

  if (settings && todayCount >= settings.daily_message_limit) {
    return res.status(429).json({
      detail: `Daily message cap reached (${settings.daily_message_limit} msgs/day). Please try again tomorrow.`,
    });
  }

  // 3. Determine Course Policy
  const effectiveOfferingId = result.data.offering_id || session.doc_offering_id || null;
  let coursePolicy = 'allowed';
  let courseCode = '';

  if (effectiveOfferingId) {
    const off = db.prepare(`
      SELECT co.ai_policy, c.code
      FROM course_offerings co
      JOIN courses c ON c.id = co.course_id
      WHERE co.id = ?
    `).get(effectiveOfferingId);
    if (off) {
      coursePolicy = off.ai_policy;
      courseCode = off.code;
    }
  }

  // 4. Retrieve candidate document chunks
  let candidateChunks = [];
  if (session.document_id) {
    candidateChunks = db.prepare(`
      SELECT dc.*, d.filename as doc_filename
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.document_id = ?
    `).all(session.document_id);
  } else if (effectiveOfferingId) {
    candidateChunks = db.prepare(`
      SELECT dc.*, d.filename as doc_filename
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE d.offering_id = ?
    `).all(effectiveOfferingId);
  } else {
    // Search across user's recent documents
    candidateChunks = db.prepare(`
      SELECT dc.*, d.filename as doc_filename
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE d.owner_id = ?
      LIMIT 100
    `).all(req.user.id);
  }

  // Cosine similarity search on chunks
  const retrievedChunks = searchChunks(candidateChunks, userPrompt, 4);

  // 5. Fetch previous messages for context
  const previousMessages = db.prepare(`
    SELECT role, content FROM chat_messages
    WHERE session_id = ?
    ORDER BY id ASC
    LIMIT 10
  `).all(sessionId);

  // 6. Generate AI response
  const activeMode = result.data.mode || session.mode || 'ask';

  const aiResult = await generateAiResponse({
    prompt: userPrompt,
    mode: activeMode,
    coursePolicy,
    retrievedChunks,
    chatHistory: previousMessages,
    courseCode,
  });

  // 7. Save user message and assistant message to database
  const insertMsg = db.prepare(`
    INSERT INTO chat_messages (session_id, role, content)
    VALUES (?, ?, ?)
  `);

  let assistantMsgId;
  db.transaction(() => {
    insertMsg.run(sessionId, 'user', userPrompt);
    const info = insertMsg.run(sessionId, 'assistant', aiResult.content);
    assistantMsgId = info.lastInsertRowid;
    // update session mode if changed
    if (result.data.mode && result.data.mode !== session.mode) {
      db.prepare('UPDATE chat_sessions SET mode = ? WHERE id = ?').run(result.data.mode, sessionId);
    }
  })();

  const savedAssistantMsg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(assistantMsgId);

  res.json({
    message: savedAssistantMsg,
    citations: aiResult.citations,
    course_policy: coursePolicy,
  });
});

// ── 5. Campus FAQ Knowledge Base ──────────────────────────────────────────────

router.get('/faq', (req, res) => {
  res.json(CAMPUS_FAQ);
});

// ── 6. Admin AI Settings & Analytics ──────────────────────────────────────────

router.get('/admin/settings', authenticate, requireRole('admin'), (req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT * FROM ai_settings WHERE id = 1').get();
  res.json(settings);
});

router.patch('/admin/settings', authenticate, requireRole('admin'), (req, res) => {
  const schema = z.object({
    ai_enabled:          z.boolean().optional(),
    max_upload_mb:       z.number().int().min(1).max(100).optional(),
    daily_message_limit: z.number().int().min(1).max(500).optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const current = db.prepare('SELECT * FROM ai_settings WHERE id = 1').get();

  const ai_enabled = result.data.ai_enabled !== undefined ? (result.data.ai_enabled ? 1 : 0) : current.ai_enabled;
  const max_upload_mb = result.data.max_upload_mb !== undefined ? result.data.max_upload_mb : current.max_upload_mb;
  const daily_message_limit = result.data.daily_message_limit !== undefined ? result.data.daily_message_limit : current.daily_message_limit;

  db.prepare(`
    UPDATE ai_settings
    SET ai_enabled = ?, max_upload_mb = ?, daily_message_limit = ?
    WHERE id = 1
  `).run(ai_enabled, max_upload_mb, daily_message_limit);

  writeAudit(db, {
    userId: req.user.id,
    action: 'UPDATE_AI_SETTINGS',
    targetType: 'ai_settings',
    targetId: 1,
    details: { ai_enabled: !!ai_enabled, max_upload_mb, daily_message_limit },
  });

  const updated = db.prepare('SELECT * FROM ai_settings WHERE id = 1').get();
  res.json(updated);
});

router.get('/admin/analytics', authenticate, requireRole('admin'), (req, res) => {
  const db = getDb();

  const totalQuestions = db.prepare("SELECT COUNT(*) as n FROM chat_messages WHERE role = 'user'").get().n;
  const totalDocuments = db.prepare("SELECT COUNT(*) as n FROM documents").get().n;
  const totalChunks    = db.prepare("SELECT COUNT(*) as n FROM document_chunks").get().n;
  const totalSessions  = db.prepare("SELECT COUNT(*) as n FROM chat_sessions").get().n;

  // Breakdown by mode
  const modeStats = db.prepare(`
    SELECT mode, COUNT(*) as count
    FROM chat_sessions
    GROUP BY mode
  `).all();

  // Course offerings AI policies breakdown
  const policyStats = db.prepare(`
    SELECT ai_policy, COUNT(*) as count
    FROM course_offerings
    GROUP BY ai_policy
  `).all();

  res.json({
    totalQuestions,
    totalDocuments,
    totalChunks,
    totalSessions,
    modeStats,
    policyStats,
  });
});

export default router;
