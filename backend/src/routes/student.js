/**
 * student.js (route)
 * ──────────────────
 * All student-facing endpoints — protected by authenticate + requireRole('student','admin').
 *
 * Endpoints:
 *  GET  /api/v1/student/courses         list enrolled courses with instructor & AI policy
 *  GET  /api/v1/student/grades          detailed grades breakdown by course & assignment
 *  GET  /api/v1/student/attendance      attendance summary & date records
 *  GET  /api/v1/student/announcements   announcements from all enrolled courses
 *  GET  /api/v1/student/assignments     assignments list with submission status & feedback
 *  POST /api/v1/student/assignments/:id/submit  submit assignment notes/solution
 */

import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/schema.js';
import { authenticate, requireRole } from '../middleware/requireRole.js';

const router = Router();
router.use(authenticate, requireRole('student', 'admin'));

// ── 1. Enrolled Courses ───────────────────────────────────────────────────────

router.get('/courses', (req, res) => {
  const db = getDb();
  const studentId = req.user.id;

  const courses = db.prepare(`
    SELECT e.id as enrollment_id, e.grade as final_grade, e.enrolled_at,
           co.id as offering_id, co.ai_policy,
           c.id as course_id, c.code, c.title, c.credits,
           d.name as dept_name,
           u.name as faculty_name, u.email as faculty_email,
           s.label as semester_label,
           COUNT(DISTINCT a.id) as assignment_count,
           COUNT(DISTINCT ann.id) as announcement_count
    FROM enrollments e
    JOIN course_offerings co ON co.id = e.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN departments d ON d.id = c.dept_id
    JOIN users u ON u.id = co.faculty_id
    JOIN semesters s ON s.id = co.semester_id
    LEFT JOIN assignments a ON a.offering_id = co.id
    LEFT JOIN announcements ann ON ann.offering_id = co.id
    WHERE e.student_id = ?
    GROUP BY e.id
    ORDER BY c.code ASC
  `).all(studentId);

  res.json(courses);
});

// ── 2. Grades Breakdown ───────────────────────────────────────────────────────

router.get('/grades', (req, res) => {
  const db = getDb();
  const studentId = req.user.id;

  // 1. Get course level grades
  const courseGrades = db.prepare(`
    SELECT e.id as enrollment_id, e.grade as final_grade,
           co.id as offering_id, c.code, c.title, c.credits,
           d.name as dept_name, u.name as faculty_name
    FROM enrollments e
    JOIN course_offerings co ON co.id = e.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN departments d ON d.id = c.dept_id
    JOIN users u ON u.id = co.faculty_id
    WHERE e.student_id = ?
    ORDER BY c.code ASC
  `).all(studentId);

  // 2. Get assignment submissions
  const assignmentGrades = db.prepare(`
    SELECT a.id as assignment_id, a.offering_id, a.title, a.max_score, a.due_date,
           c.code as course_code,
           sub.score, sub.feedback, sub.submitted_at, sub.graded_at
    FROM enrollments e
    JOIN assignments a ON a.offering_id = e.offering_id
    JOIN course_offerings co ON co.id = a.offering_id
    JOIN courses c ON c.id = co.course_id
    LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = e.student_id
    WHERE e.student_id = ?
    ORDER BY a.due_date DESC, a.id DESC
  `).all(studentId);

  res.json({ courses: courseGrades, assignments: assignmentGrades });
});

// ── 3. Attendance Summary & History ───────────────────────────────────────────

router.get('/attendance', (req, res) => {
  const db = getDb();
  const studentId = req.user.id;

  // Course-level attendance statistics
  const summary = db.prepare(`
    SELECT co.id as offering_id, c.code, c.title,
           COUNT(att.id) as total_sessions,
           SUM(CASE WHEN att.status = 'present' THEN 1 ELSE 0 END) as present_count,
           SUM(CASE WHEN att.status = 'late' THEN 1 ELSE 0 END) as late_count,
           SUM(CASE WHEN att.status = 'absent' THEN 1 ELSE 0 END) as absent_count
    FROM enrollments e
    JOIN course_offerings co ON co.id = e.offering_id
    JOIN courses c ON c.id = co.course_id
    LEFT JOIN attendance att ON att.offering_id = co.id AND att.student_id = e.student_id
    WHERE e.student_id = ?
    GROUP BY co.id
    ORDER BY c.code ASC
  `).all(studentId);

  // Detailed recent attendance logs
  const records = db.prepare(`
    SELECT att.id, att.offering_id, att.date, att.status,
           c.code as course_code, c.title as course_title
    FROM attendance att
    JOIN course_offerings co ON co.id = att.offering_id
    JOIN courses c ON c.id = co.course_id
    WHERE att.student_id = ?
    ORDER BY att.date DESC
    LIMIT 30
  `).all(studentId);

  res.json({ summary, records });
});

// ── 4. Announcements ──────────────────────────────────────────────────────────

router.get('/announcements', (req, res) => {
  const db = getDb();
  const studentId = req.user.id;

  const announcements = db.prepare(`
    SELECT ann.id, ann.title, ann.body, ann.created_at,
           co.id as offering_id, c.code as course_code, c.title as course_title,
           u.name as author_name
    FROM enrollments e
    JOIN announcements ann ON ann.offering_id = e.offering_id
    JOIN course_offerings co ON co.id = ann.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN users u ON u.id = ann.faculty_id
    WHERE e.student_id = ?
    ORDER BY ann.created_at DESC
  `).all(studentId);

  res.json(announcements);
});

// ── 5. Assignments & Submission ───────────────────────────────────────────────

router.get('/assignments', (req, res) => {
  const db = getDb();
  const studentId = req.user.id;

  const assignments = db.prepare(`
    SELECT a.id, a.offering_id, a.title, a.description, a.due_date, a.max_score, a.created_at,
           c.code as course_code, c.title as course_title,
           u.name as faculty_name,
           sub.id as submission_id, sub.file_path, sub.score, sub.feedback,
           sub.submitted_at, sub.graded_at
    FROM enrollments e
    JOIN assignments a ON a.offering_id = e.offering_id
    JOIN course_offerings co ON co.id = a.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN users u ON u.id = co.faculty_id
    LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = e.student_id
    WHERE e.student_id = ?
    ORDER BY a.due_date ASC, a.id DESC
  `).all(studentId);

  res.json(assignments);
});

router.post('/assignments/:id/submit', (req, res) => {
  const schema = z.object({
    submission_text: z.string().min(1, 'Please enter your submission text or link.'),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const assignmentId = parseInt(req.params.id);
  const studentId = req.user.id;

  // Verify student is enrolled in the course offering for this assignment
  const assignment = db.prepare(`
    SELECT a.*, e.id as enrollment_id
    FROM assignments a
    JOIN enrollments e ON e.offering_id = a.offering_id
    WHERE a.id = ? AND e.student_id = ?
  `).get(assignmentId, studentId);

  if (!assignment) {
    return res.status(403).json({ detail: 'You are not enrolled in the course for this assignment.' });
  }

  const now = new Date().toISOString();
  const existingSub = db.prepare(`
    SELECT id, score FROM submissions WHERE assignment_id = ? AND student_id = ?
  `).get(assignmentId, studentId);

  let subId;
  if (existingSub) {
    db.prepare(`
      UPDATE submissions
      SET file_path = ?, submitted_at = ?
      WHERE id = ?
    `).run(result.data.submission_text, now, existingSub.id);
    subId = existingSub.id;
  } else {
    const info = db.prepare(`
      INSERT INTO submissions (assignment_id, student_id, file_path, submitted_at)
      VALUES (?, ?, ?, ?)
    `).run(assignmentId, studentId, result.data.submission_text, now);
    subId = info.lastInsertRowid;
  }

  const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(subId);
  res.json({ message: 'Assignment submitted successfully!', submission: sub });
});

export default router;
