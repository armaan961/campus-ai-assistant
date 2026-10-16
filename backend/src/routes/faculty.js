/**
 * faculty.js (route)
 * ──────────────────
 * All faculty-facing endpoints — protected by authenticate + requireRole('faculty','admin').
 *
 * Endpoints:
 *  GET    /api/v1/faculty/courses                       list offerings taught by faculty
 *  PATCH  /api/v1/faculty/courses/:id/ai-policy         toggle AI policy ('allowed'|'hints_only'|'disabled')
 *  GET    /api/v1/faculty/courses/:id/students          enrolled students roster with summary stats
 *  GET    /api/v1/faculty/announcements                 announcements list (?offering_id=)
 *  POST   /api/v1/faculty/announcements                 create announcement
 *  DELETE /api/v1/faculty/announcements/:id             delete announcement
 *  GET    /api/v1/faculty/assignments                   assignments list (?offering_id=)
 *  POST   /api/v1/faculty/assignments                   create assignment
 *  DELETE /api/v1/faculty/assignments/:id               delete assignment
 *  GET    /api/v1/faculty/assignments/:id/submissions   all students + submission status & grades
 *  POST   /api/v1/faculty/assignments/:id/grade/:studentId  grade / feedback for student
 *  GET    /api/v1/faculty/attendance                    attendance sheet (?offering_id= & date=)
 *  POST   /api/v1/faculty/attendance                    batch save attendance records
 *  GET    /api/v1/faculty/grades                        gradebook breakdown (?offering_id=)
 *  PATCH  /api/v1/faculty/enrollments/:id/grade         update student's final course grade
 */

import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/schema.js';
import { authenticate, requireRole } from '../middleware/requireRole.js';
import { writeAudit } from '../utils/audit.js';

const router = Router();
router.use(authenticate, requireRole('faculty', 'admin'));

/** Helper: verify this offering belongs to the logged-in faculty (or user is admin) */
function verifyOfferingOwnership(db, offeringId, user) {
  const off = db.prepare('SELECT * FROM course_offerings WHERE id = ?').get(offeringId);
  if (!off) return null;
  if (user.role !== 'admin' && off.faculty_id !== user.id) return false;
  return off;
}

// ── 1. My Courses ─────────────────────────────────────────────────────────────

router.get('/courses', (req, res) => {
  const db = getDb();
  const isFaculty = req.user.role === 'faculty';

  const sql = `
    SELECT co.id, co.course_id, co.faculty_id, co.semester_id, co.ai_policy, co.created_at,
           c.code, c.title, c.credits,
           d.name as dept_name,
           s.label as semester_label,
           COUNT(DISTINCT e.id) as enrolled_count,
           COUNT(DISTINCT a.id) as assignment_count,
           COUNT(DISTINCT ann.id) as announcement_count
    FROM course_offerings co
    JOIN courses c ON c.id = co.course_id
    JOIN departments d ON d.id = c.dept_id
    JOIN semesters s ON s.id = co.semester_id
    LEFT JOIN enrollments e ON e.offering_id = co.id
    LEFT JOIN assignments a ON a.offering_id = co.id
    LEFT JOIN announcements ann ON ann.offering_id = co.id
    ${isFaculty ? 'WHERE co.faculty_id = ?' : ''}
    GROUP BY co.id
    ORDER BY c.code ASC
  `;

  const rows = isFaculty ? db.prepare(sql).all(req.user.id) : db.prepare(sql).all();
  res.json(rows);
});

// ── 2. AI Policy Toggle ───────────────────────────────────────────────────────

router.patch('/courses/:id/ai-policy', (req, res) => {
  const schema = z.object({
    ai_policy: z.enum(['allowed', 'hints_only', 'disabled']),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const offeringId = parseInt(req.params.id);
  const off = verifyOfferingOwnership(db, offeringId, req.user);

  if (off === null) return res.status(404).json({ detail: 'Course offering not found.' });
  if (off === false) return res.status(403).json({ detail: 'You do not teach this course offering.' });

  db.prepare('UPDATE course_offerings SET ai_policy = ? WHERE id = ?').run(
    result.data.ai_policy,
    offeringId
  );

  writeAudit(db, {
    userId: req.user.id,
    action: 'UPDATE_AI_POLICY',
    targetType: 'course_offering',
    targetId: offeringId,
    details: { old_policy: off.ai_policy, new_policy: result.data.ai_policy }
  });

  res.json({ id: offeringId, ai_policy: result.data.ai_policy });
});

// ── 3. Student Roster for a Course ────────────────────────────────────────────

router.get('/courses/:id/students', (req, res) => {
  const db = getDb();
  const offeringId = parseInt(req.params.id);
  const off = verifyOfferingOwnership(db, offeringId, req.user);

  if (off === null) return res.status(404).json({ detail: 'Course offering not found.' });
  if (off === false) return res.status(403).json({ detail: 'You do not teach this course offering.' });

  const students = db.prepare(`
    SELECT e.id as enrollment_id, e.grade, e.enrolled_at,
           u.id as student_id, u.name, u.email,
           COUNT(att.id) as total_attendance_records,
           SUM(CASE WHEN att.status = 'present' THEN 1 ELSE 0 END) as present_count
    FROM enrollments e
    JOIN users u ON u.id = e.student_id
    LEFT JOIN attendance att ON att.offering_id = e.offering_id AND att.student_id = u.id
    WHERE e.offering_id = ?
    GROUP BY u.id
    ORDER BY u.name ASC
  `).all(offeringId);

  res.json(students);
});

// ── 4. Announcements ──────────────────────────────────────────────────────────

router.get('/announcements', (req, res) => {
  const db = getDb();
  const { offering_id } = req.query;
  const isFaculty = req.user.role === 'faculty';

  let sql = `
    SELECT ann.id, ann.offering_id, ann.faculty_id, ann.title, ann.body, ann.created_at,
           c.code as course_code, c.title as course_title,
           u.name as author_name
    FROM announcements ann
    JOIN course_offerings co ON co.id = ann.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN users u ON u.id = ann.faculty_id
    WHERE 1=1
  `;
  const params = [];

  if (isFaculty) {
    sql += ' AND co.faculty_id = ?';
    params.push(req.user.id);
  }
  if (offering_id) {
    sql += ' AND ann.offering_id = ?';
    params.push(parseInt(offering_id));
  }

  sql += ' ORDER BY ann.created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post('/announcements', (req, res) => {
  const schema = z.object({
    offering_id: z.number().int().positive(),
    title:       z.string().min(2).max(150),
    body:        z.string().min(2),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const { offering_id, title, body } = result.data;
  const off = verifyOfferingOwnership(db, offering_id, req.user);

  if (off === null) return res.status(404).json({ detail: 'Course offering not found.' });
  if (off === false) return res.status(403).json({ detail: 'You do not teach this course offering.' });

  const info = db.prepare(`
    INSERT INTO announcements (offering_id, faculty_id, title, body)
    VALUES (?, ?, ?, ?)
  `).run(offering_id, req.user.id, title, body);

  writeAudit(db, {
    userId: req.user.id,
    action: 'CREATE_ANNOUNCEMENT',
    targetType: 'announcement',
    targetId: info.lastInsertRowid,
    details: { offering_id, title }
  });

  const created = db.prepare(`
    SELECT ann.*, c.code as course_code, c.title as course_title, u.name as author_name
    FROM announcements ann
    JOIN course_offerings co ON co.id = ann.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN users u ON u.id = ann.faculty_id
    WHERE ann.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json(created);
});

router.delete('/announcements/:id', (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  const ann = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
  if (!ann) return res.status(404).json({ detail: 'Announcement not found.' });

  const off = verifyOfferingOwnership(db, ann.offering_id, req.user);
  if (off === false) return res.status(403).json({ detail: 'Permission denied.' });

  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);

  writeAudit(db, {
    userId: req.user.id,
    action: 'DELETE_ANNOUNCEMENT',
    targetType: 'announcement',
    targetId: id
  });

  res.json({ message: 'Announcement deleted.' });
});

// ── 5. Assignments ────────────────────────────────────────────────────────────

router.get('/assignments', (req, res) => {
  const db = getDb();
  const { offering_id } = req.query;
  const isFaculty = req.user.role === 'faculty';

  let sql = `
    SELECT a.*, c.code as course_code, c.title as course_title,
           COUNT(DISTINCT e.id) as total_students,
           COUNT(DISTINCT sub.id) as submitted_count,
           COUNT(DISTINCT CASE WHEN sub.score IS NOT NULL THEN sub.id END) as graded_count
    FROM assignments a
    JOIN course_offerings co ON co.id = a.offering_id
    JOIN courses c ON c.id = co.course_id
    LEFT JOIN enrollments e ON e.offering_id = co.id
    LEFT JOIN submissions sub ON sub.assignment_id = a.id
    WHERE 1=1
  `;
  const params = [];

  if (isFaculty) {
    sql += ' AND co.faculty_id = ?';
    params.push(req.user.id);
  }
  if (offering_id) {
    sql += ' AND a.offering_id = ?';
    params.push(parseInt(offering_id));
  }

  sql += ' GROUP BY a.id ORDER BY a.due_date ASC, a.id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post('/assignments', (req, res) => {
  const schema = z.object({
    offering_id: z.number().int().positive(),
    title:       z.string().min(2).max(120),
    description: z.string().optional().default(''),
    due_date:    z.string().optional(),
    max_score:   z.number().int().min(1).default(100),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const { offering_id, title, description, due_date, max_score } = result.data;
  const off = verifyOfferingOwnership(db, offering_id, req.user);

  if (off === null) return res.status(404).json({ detail: 'Course offering not found.' });
  if (off === false) return res.status(403).json({ detail: 'You do not teach this course offering.' });

  const info = db.prepare(`
    INSERT INTO assignments (offering_id, title, description, due_date, max_score)
    VALUES (?, ?, ?, ?, ?)
  `).run(offering_id, title, description || '', due_date || null, max_score);

  writeAudit(db, {
    userId: req.user.id,
    action: 'CREATE_ASSIGNMENT',
    targetType: 'assignment',
    targetId: info.lastInsertRowid,
    details: { offering_id, title, max_score }
  });

  const created = db.prepare(`
    SELECT a.*, c.code as course_code, c.title as course_title
    FROM assignments a
    JOIN course_offerings co ON co.id = a.offering_id
    JOIN courses c ON c.id = co.course_id
    WHERE a.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json(created);
});

router.delete('/assignments/:id', (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  const a = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  if (!a) return res.status(404).json({ detail: 'Assignment not found.' });

  const off = verifyOfferingOwnership(db, a.offering_id, req.user);
  if (off === false) return res.status(403).json({ detail: 'Permission denied.' });

  db.transaction(() => {
    db.prepare('DELETE FROM submissions WHERE assignment_id = ?').run(id);
    db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
  })();

  writeAudit(db, {
    userId: req.user.id,
    action: 'DELETE_ASSIGNMENT',
    targetType: 'assignment',
    targetId: id
  });

  res.json({ message: 'Assignment deleted.' });
});

// ── 6. Submissions & Grading ──────────────────────────────────────────────────

router.get('/assignments/:id/submissions', (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  const assignment = db.prepare(`
    SELECT a.*, c.code as course_code, c.title as course_title, co.id as offering_id
    FROM assignments a
    JOIN course_offerings co ON co.id = a.offering_id
    JOIN courses c ON c.id = co.course_id
    WHERE a.id = ?
  `).get(id);

  if (!assignment) return res.status(404).json({ detail: 'Assignment not found.' });
  const off = verifyOfferingOwnership(db, assignment.offering_id, req.user);
  if (off === false) return res.status(403).json({ detail: 'Permission denied.' });

  // Get all enrolled students in this offering, joined with their submission if any
  const students = db.prepare(`
    SELECT u.id as student_id, u.name as student_name, u.email as student_email,
           sub.id as submission_id, sub.file_path, sub.score, sub.feedback,
           sub.submitted_at, sub.graded_at
    FROM enrollments e
    JOIN users u ON u.id = e.student_id
    LEFT JOIN submissions sub ON sub.assignment_id = ? AND sub.student_id = u.id
    WHERE e.offering_id = ?
    ORDER BY u.name ASC
  `).all(id, assignment.offering_id);

  res.json({ assignment, students });
});

router.post('/assignments/:id/grade/:studentId', (req, res) => {
  const schema = z.object({
    score:    z.number().min(0),
    feedback: z.string().optional().default(''),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const assignmentId = parseInt(req.params.id);
  const studentId = parseInt(req.params.studentId);
  const { score, feedback } = result.data;

  const a = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
  if (!a) return res.status(404).json({ detail: 'Assignment not found.' });

  const off = verifyOfferingOwnership(db, a.offering_id, req.user);
  if (off === false) return res.status(403).json({ detail: 'Permission denied.' });

  // Check if student is enrolled in this offering
  const enrolled = db.prepare('SELECT id FROM enrollments WHERE offering_id = ? AND student_id = ?')
    .get(a.offering_id, studentId);
  if (!enrolled) return res.status(400).json({ detail: 'Student is not enrolled in this course.' });

  const existingSub = db.prepare('SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?')
    .get(assignmentId, studentId);

  let subId;
  const now = new Date().toISOString();

  if (existingSub) {
    db.prepare(`
      UPDATE submissions
      SET score = ?, feedback = ?, graded_at = ?
      WHERE id = ?
    `).run(score, feedback || '', now, existingSub.id);
    subId = existingSub.id;
  } else {
    const info = db.prepare(`
      INSERT INTO submissions (assignment_id, student_id, file_path, score, feedback, submitted_at, graded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(assignmentId, studentId, null, score, feedback || '', now, now);
    subId = info.lastInsertRowid;
  }

  writeAudit(db, {
    userId: req.user.id,
    action: 'GRADE_ASSIGNMENT',
    targetType: 'submission',
    targetId: subId,
    details: { assignment_id: assignmentId, student_id: studentId, score }
  });

  const updated = db.prepare('SELECT * FROM submissions WHERE id = ?').get(subId);
  res.json(updated);
});

// ── 7. Attendance ─────────────────────────────────────────────────────────────

router.get('/attendance', (req, res) => {
  const db = getDb();
  const { offering_id, date } = req.query;
  if (!offering_id) return res.status(400).json({ detail: 'offering_id is required.' });

  const offeringId = parseInt(offering_id);
  const off = verifyOfferingOwnership(db, offeringId, req.user);
  if (off === null) return res.status(404).json({ detail: 'Course offering not found.' });
  if (off === false) return res.status(403).json({ detail: 'Permission denied.' });

  const targetDate = date || new Date().toISOString().split('T')[0];

  // Enrolled students joined with their attendance status on targetDate
  const students = db.prepare(`
    SELECT u.id as student_id, u.name, u.email,
           att.status, att.id as attendance_id
    FROM enrollments e
    JOIN users u ON u.id = e.student_id
    LEFT JOIN attendance att ON att.offering_id = e.offering_id
                             AND att.student_id = u.id
                             AND att.date = ?
    WHERE e.offering_id = ?
    ORDER BY u.name ASC
  `).all(targetDate, offeringId);

  // Past dates recorded for quick navigation
  const pastDates = db.prepare(`
    SELECT DISTINCT date,
           COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
           COUNT(*) as total_count
    FROM attendance
    WHERE offering_id = ?
    GROUP BY date
    ORDER BY date DESC
    LIMIT 15
  `).all(offeringId);

  res.json({ date: targetDate, students, pastDates });
});

router.post('/attendance', (req, res) => {
  const schema = z.object({
    offering_id: z.number().int().positive(),
    date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    records:     z.array(z.object({
      student_id: z.number().int().positive(),
      status:     z.enum(['present', 'absent', 'late']),
    })).min(1),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const { offering_id, date, records } = result.data;
  const off = verifyOfferingOwnership(db, offering_id, req.user);

  if (off === null) return res.status(404).json({ detail: 'Course offering not found.' });
  if (off === false) return res.status(403).json({ detail: 'Permission denied.' });

  const upsert = db.prepare(`
    INSERT INTO attendance (offering_id, student_id, date, status)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(offering_id, student_id, date) DO UPDATE SET
      status = excluded.status
  `);

  const saveAll = db.transaction((recs) => {
    for (const r of recs) {
      upsert.run(offering_id, r.student_id, date, r.status);
    }
  });

  saveAll(records);

  writeAudit(db, {
    userId: req.user.id,
    action: 'MARK_ATTENDANCE',
    targetType: 'course_offering',
    targetId: offering_id,
    details: { date, count: records.length }
  });

  res.json({ message: 'Attendance saved successfully.', count: records.length });
});

// ── 8. Gradebook / Final Grades ───────────────────────────────────────────────

router.get('/grades', (req, res) => {
  const db = getDb();
  const { offering_id } = req.query;
  if (!offering_id) return res.status(400).json({ detail: 'offering_id is required.' });

  const offeringId = parseInt(offering_id);
  const off = verifyOfferingOwnership(db, offeringId, req.user);
  if (off === null) return res.status(404).json({ detail: 'Course offering not found.' });
  if (off === false) return res.status(403).json({ detail: 'Permission denied.' });

  // Get assignments for this offering
  const assignments = db.prepare(`
    SELECT id, title, max_score, due_date
    FROM assignments
    WHERE offering_id = ?
    ORDER BY due_date ASC, id ASC
  `).all(offeringId);

  // Get students with their current course grade and their scores per assignment
  const students = db.prepare(`
    SELECT e.id as enrollment_id, e.grade as final_grade,
           u.id as student_id, u.name, u.email
    FROM enrollments e
    JOIN users u ON u.id = e.student_id
    WHERE e.offering_id = ?
    ORDER BY u.name ASC
  `).all(offeringId);

  // Submissions map
  const submissions = db.prepare(`
    SELECT sub.assignment_id, sub.student_id, sub.score
    FROM submissions sub
    JOIN assignments a ON a.id = sub.assignment_id
    WHERE a.offering_id = ?
  `).all(offeringId);

  const subMap = {};
  for (const s of submissions) {
    if (!subMap[s.student_id]) subMap[s.student_id] = {};
    subMap[s.student_id][s.assignment_id] = s.score;
  }

  const rosterWithGrades = students.map(st => ({
    ...st,
    scores: subMap[st.student_id] || {},
  }));

  res.json({ assignments, students: rosterWithGrades });
});

router.patch('/enrollments/:id/grade', (req, res) => {
  const schema = z.object({
    grade: z.string().max(10).nullable(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ detail: result.error.issues[0].message });

  const db = getDb();
  const enrollmentId = parseInt(req.params.id);
  const enrollment = db.prepare(`
    SELECT e.*, co.faculty_id
    FROM enrollments e
    JOIN course_offerings co ON co.id = e.offering_id
    WHERE e.id = ?
  `).get(enrollmentId);

  if (!enrollment) return res.status(404).json({ detail: 'Enrollment record not found.' });
  if (req.user.role !== 'admin' && enrollment.faculty_id !== req.user.id) {
    return res.status(403).json({ detail: 'Permission denied.' });
  }

  db.prepare('UPDATE enrollments SET grade = ? WHERE id = ?').run(
    result.data.grade || null,
    enrollmentId
  );

  writeAudit(db, {
    userId: req.user.id,
    action: 'UPDATE_GRADE',
    targetType: 'enrollment',
    targetId: enrollmentId,
    details: { grade: result.data.grade }
  });

  res.json({ id: enrollmentId, grade: result.data.grade });
});

export default router;
