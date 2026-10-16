/**
 * seed.js
 * ───────
 * Populates the database with demo data for the workshop.
 * Run with: npm run seed
 *
 * Creates:
 *  - 1 admin
 *  - 2 faculty members
 *  - 5 students
 *  - 2 departments, 4 courses, 1 active semester
 *  - course offerings (faculty assigned to courses)
 *  - student enrollments
 *  - default AI settings row
 *
 * Safe to re-run: uses INSERT OR IGNORE so duplicates are skipped.
 */

import bcrypt from 'bcryptjs';
import { getDb } from './schema.js';

const SALT_ROUNDS = 10; // bcrypt cost factor — 10 is good for workshop speed

async function seed() {
  const db = getDb();

  console.log('\n🌱  Seeding Campus AI database…\n');

  // ── 1. Departments ────────────────────────────────────────────────────────
  const depts = [
    { name: 'Computer Science' },
    { name: 'Mathematics' },
  ];

  const insertDept = db.prepare(
    'INSERT OR IGNORE INTO departments (name) VALUES (@name)'
  );
  depts.forEach(d => insertDept.run(d));

  const csId  = db.prepare("SELECT id FROM departments WHERE name = 'Computer Science'").get().id;
  const mathId = db.prepare("SELECT id FROM departments WHERE name = 'Mathematics'").get().id;

  // ── 2. Semester ───────────────────────────────────────────────────────────
  db.prepare(`
    INSERT OR IGNORE INTO semesters (label, start_date, end_date, is_active)
    VALUES ('Fall 2025', '2025-09-01', '2025-12-31', 1)
  `).run();

  const semId = db.prepare("SELECT id FROM semesters WHERE label = 'Fall 2025'").get().id;

  // ── 3. Courses ────────────────────────────────────────────────────────────
  const insertCourse = db.prepare(`
    INSERT OR IGNORE INTO courses (dept_id, code, title, credits)
    VALUES (@dept_id, @code, @title, @credits)
  `);

  const coursesData = [
    { dept_id: csId,   code: 'CS101', title: 'Intro to Programming',   credits: 3 },
    { dept_id: csId,   code: 'CS201', title: 'Data Structures',        credits: 3 },
    { dept_id: mathId, code: 'MA101', title: 'Calculus I',             credits: 4 },
    { dept_id: mathId, code: 'MA201', title: 'Linear Algebra',         credits: 3 },
  ];
  coursesData.forEach(c => insertCourse.run(c));

  const getCourse = code => db.prepare('SELECT id FROM courses WHERE code = ?').get(code);

  // ── 4. Users ──────────────────────────────────────────────────────────────
  // Plaintext passwords for the workshop — shown at the end
  const usersData = [
    { name: 'Alice Admin',    email: 'admin@campus.edu',    password: 'Admin@123',    role: 'admin'   },
    { name: 'Frank Faculty',  email: 'frank@campus.edu',    password: 'Faculty@123',  role: 'faculty' },
    { name: 'Grace Lecturer', email: 'grace@campus.edu',    password: 'Faculty@123',  role: 'faculty' },
    { name: 'Sam Student',    email: 'sam@campus.edu',      password: 'Student@123',  role: 'student' },
    { name: 'Priya Patel',    email: 'priya@campus.edu',    password: 'Student@123',  role: 'student' },
    { name: 'Jordan Lee',     email: 'jordan@campus.edu',   password: 'Student@123',  role: 'student' },
    { name: 'Maya Sharma',    email: 'maya@campus.edu',     password: 'Student@123',  role: 'student' },
    { name: 'Chris Park',     email: 'chris@campus.edu',    password: 'Student@123',  role: 'student' },
  ];

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (name, email, password_hash, role)
    VALUES (@name, @email, @password_hash, @role)
  `);

  for (const u of usersData) {
    const password_hash = await bcrypt.hash(u.password, SALT_ROUNDS);
    insertUser.run({ name: u.name, email: u.email, password_hash, role: u.role });
  }

  const getUser = email => db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  const frankId = getUser('frank@campus.edu').id;
  const graceId = getUser('grace@campus.edu').id;

  const studentEmails = [
    'sam@campus.edu', 'priya@campus.edu', 'jordan@campus.edu',
    'maya@campus.edu', 'chris@campus.edu',
  ];

  // ── 5. Course Offerings ───────────────────────────────────────────────────
  const insertOffering = db.prepare(`
    INSERT OR IGNORE INTO course_offerings (course_id, faculty_id, semester_id, ai_policy)
    VALUES (@course_id, @faculty_id, @semester_id, @ai_policy)
  `);

  const offeringsData = [
    { course_id: getCourse('CS101').id, faculty_id: frankId, semester_id: semId, ai_policy: 'allowed'     },
    { course_id: getCourse('CS201').id, faculty_id: frankId, semester_id: semId, ai_policy: 'hints_only'  },
    { course_id: getCourse('MA101').id, faculty_id: graceId, semester_id: semId, ai_policy: 'allowed'     },
    { course_id: getCourse('MA201').id, faculty_id: graceId, semester_id: semId, ai_policy: 'disabled'    },
  ];
  offeringsData.forEach(o => insertOffering.run(o));

  const getOffering = (courseCode) => {
    const course = getCourse(courseCode);
    return db.prepare('SELECT id FROM course_offerings WHERE course_id = ?').get(course.id);
  };

  // ── 6. Enrollments ────────────────────────────────────────────────────────
  const insertEnrollment = db.prepare(`
    INSERT OR IGNORE INTO enrollments (student_id, offering_id)
    VALUES (@student_id, @offering_id)
  `);

  // All students enrolled in CS101 and MA101; some in CS201 / MA201
  const enrollmentMap = {
    'CS101': studentEmails,
    'MA101': studentEmails,
    'CS201': ['sam@campus.edu', 'priya@campus.edu', 'jordan@campus.edu'],
    'MA201': ['maya@campus.edu', 'chris@campus.edu'],
  };

  for (const [code, emails] of Object.entries(enrollmentMap)) {
    const offeringId = getOffering(code).id;
    for (const email of emails) {
      const student = getUser(email);
      insertEnrollment.run({ student_id: student.id, offering_id: offeringId });
    }
  }

  // ── 7. Default AI Settings (single row, id = 1) ───────────────────────────
  db.prepare(`
    INSERT OR IGNORE INTO ai_settings (id, ai_enabled, max_upload_mb, daily_message_limit)
    VALUES (1, 1, 20, 50)
  `).run();

  // ── 8. Sample Announcement ────────────────────────────────────────────────
  const cs101OfferingId = getOffering('CS101').id;
  db.prepare(`
    INSERT OR IGNORE INTO announcements (offering_id, faculty_id, title, body)
    VALUES (?, ?, 'Welcome to CS101!', 'Welcome everyone! Please read the syllabus before our first class.')
  `).run(cs101OfferingId, frankId);

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('✅  Seed complete!\n');
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│               DEMO CREDENTIALS                         │');
  console.log('├───────────┬──────────────────────────┬─────────────────┤');
  console.log('│ ROLE      │ EMAIL                    │ PASSWORD        │');
  console.log('├───────────┼──────────────────────────┼─────────────────┤');
  console.log('│ admin     │ admin@campus.edu          │ Admin@123       │');
  console.log('│ faculty   │ frank@campus.edu          │ Faculty@123     │');
  console.log('│ faculty   │ grace@campus.edu          │ Faculty@123     │');
  console.log('│ student   │ sam@campus.edu            │ Student@123     │');
  console.log('│ student   │ priya@campus.edu          │ Student@123     │');
  console.log('│ student   │ jordan@campus.edu         │ Student@123     │');
  console.log('│ student   │ maya@campus.edu           │ Student@123     │');
  console.log('│ student   │ chris@campus.edu          │ Student@123     │');
  console.log('└───────────┴──────────────────────────┴─────────────────┘\n');
}

seed().catch(err => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
