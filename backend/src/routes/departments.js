/**
 * departments.js  (route)
 * ───────────────────────
 * GET    /api/v1/departments           list all
 * POST   /api/v1/departments           create
 * DELETE /api/v1/departments/:id       delete (only if no courses)
 *
 * GET    /api/v1/departments/:id/courses    courses in a department
 *
 * GET    /api/v1/courses               list all courses (with dept info)
 * POST   /api/v1/courses               create course
 * DELETE /api/v1/courses/:id           delete (only if no offerings)
 */

import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/schema.js';
import { authenticate, requireRole } from '../middleware/requireRole.js';

const router = Router();
router.use(['/departments', '/courses', '/semesters', '/offerings', '/enrollments'], authenticate, requireRole('admin'));

// ── Departments ───────────────────────────────────────────────────────────────

router.get('/departments', (req, res) => {
  const db = getDb();
  const depts = db.prepare(`
    SELECT d.*, COUNT(c.id) as course_count
    FROM departments d
    LEFT JOIN courses c ON c.dept_id = d.id
    GROUP BY d.id
    ORDER BY d.name
  `).all();
  res.json(depts);
});

router.post('/departments', (req, res) => {
  const schema = z.object({ name: z.string().min(2) });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  try {
    const info = db.prepare('INSERT INTO departments (name) VALUES (?)').run(result.data.name);
    res.status(201).json({ id: info.lastInsertRowid, name: result.data.name });
  } catch {
    res.status(409).json({ detail: 'Department name already exists.' });
  }
});

router.delete('/departments/:id', (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  const courseCount = db.prepare('SELECT COUNT(*) as n FROM courses WHERE dept_id = ?').get(id).n;
  if (courseCount > 0) return res.status(400).json({ detail: 'Cannot delete department with existing courses.' });
  db.prepare('DELETE FROM departments WHERE id = ?').run(id);
  res.json({ message: 'Department deleted.' });
});

// ── Courses ───────────────────────────────────────────────────────────────────

router.get('/courses', (req, res) => {
  const db = getDb();
  const courses = db.prepare(`
    SELECT c.*, d.name as dept_name,
           COUNT(DISTINCT co.id) as offering_count
    FROM courses c
    JOIN departments d ON d.id = c.dept_id
    LEFT JOIN course_offerings co ON co.course_id = c.id
    GROUP BY c.id
    ORDER BY c.code
  `).all();
  res.json(courses);
});

router.post('/courses', (req, res) => {
  const schema = z.object({
    dept_id: z.number().int().positive(),
    code:    z.string().min(2).max(10).toUpperCase(),
    title:   z.string().min(3),
    credits: z.number().int().min(1).max(6).default(3),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  try {
    const { dept_id, code, title, credits } = result.data;
    const info = db.prepare(
      'INSERT INTO courses (dept_id, code, title, credits) VALUES (?, ?, ?, ?)'
    ).run(dept_id, code, title, credits);
    res.status(201).json({ id: info.lastInsertRowid, ...result.data });
  } catch {
    res.status(409).json({ detail: 'Course code already exists.' });
  }
});

router.delete('/courses/:id', (req, res) => {
  const db  = getDb();
  const id  = parseInt(req.params.id);
  const cnt = db.prepare('SELECT COUNT(*) as n FROM course_offerings WHERE course_id = ?').get(id).n;
  if (cnt > 0) return res.status(400).json({ detail: 'Cannot delete course with existing offerings.' });
  db.prepare('DELETE FROM courses WHERE id = ?').run(id);
  res.json({ message: 'Course deleted.' });
});

// ── Semesters ─────────────────────────────────────────────────────────────────

router.get('/semesters', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM semesters ORDER BY id DESC').all());
});

router.post('/semesters', (req, res) => {
  const schema = z.object({
    label:      z.string().min(2),
    start_date: z.string().optional(),
    end_date:   z.string().optional(),
    is_active:  z.boolean().default(true),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });
  const { label, start_date, end_date, is_active } = result.data;
  const info = getDb().prepare(
    'INSERT OR IGNORE INTO semesters (label, start_date, end_date, is_active) VALUES (?,?,?,?)'
  ).run(label, start_date || null, end_date || null, is_active ? 1 : 0);
  res.status(201).json({ id: info.lastInsertRowid, ...result.data });
});

// ── Offerings (faculty assignment) ────────────────────────────────────────────

router.get('/offerings', (req, res) => {
  const db = getDb();
  const offerings = db.prepare(`
    SELECT co.*, c.code, c.title, u.name as faculty_name, s.label as semester_label,
           COUNT(e.id) as enrolled_count
    FROM course_offerings co
    JOIN courses c   ON c.id  = co.course_id
    JOIN users u     ON u.id  = co.faculty_id
    JOIN semesters s ON s.id  = co.semester_id
    LEFT JOIN enrollments e ON e.offering_id = co.id
    GROUP BY co.id
    ORDER BY co.id DESC
  `).all();
  res.json(offerings);
});

router.post('/offerings', (req, res) => {
  const schema = z.object({
    course_id:   z.number().int().positive(),
    faculty_id:  z.number().int().positive(),
    semester_id: z.number().int().positive(),
    ai_policy:   z.enum(['allowed', 'hints_only', 'disabled']).default('allowed'),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const { course_id, faculty_id, semester_id, ai_policy } = result.data;
  const info = db.prepare(
    'INSERT INTO course_offerings (course_id, faculty_id, semester_id, ai_policy) VALUES (?,?,?,?)'
  ).run(course_id, faculty_id, semester_id, ai_policy);
  res.status(201).json({ id: info.lastInsertRowid, ...result.data });
});

// ── Enrollments ───────────────────────────────────────────────────────────────

router.get('/enrollments', (req, res) => {
  const { offering_id } = req.query;
  const db = getDb();
  let q = `
    SELECT e.*, u.name as student_name, u.email as student_email
    FROM enrollments e JOIN users u ON u.id = e.student_id
  `;
  const params = [];
  if (offering_id) { q += ' WHERE e.offering_id = ?'; params.push(offering_id); }
  q += ' ORDER BY u.name';
  res.json(db.prepare(q).all(...params));
});

router.post('/enrollments', (req, res) => {
  const schema = z.object({
    student_id:  z.number().int().positive(),
    offering_id: z.number().int().positive(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  try {
    const info = db.prepare(
      'INSERT INTO enrollments (student_id, offering_id) VALUES (?, ?)'
    ).run(result.data.student_id, result.data.offering_id);
    res.status(201).json({ id: info.lastInsertRowid, ...result.data });
  } catch {
    res.status(409).json({ detail: 'Student already enrolled in this offering.' });
  }
});

router.delete('/enrollments/:id', (req, res) => {
  getDb().prepare('DELETE FROM enrollments WHERE id = ?').run(parseInt(req.params.id));
  res.json({ message: 'Enrollment removed.' });
});

export default router;
