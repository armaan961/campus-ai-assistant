# 🎓 Campus AI Assistant

> **A full-stack University Management web application with an Admin panel, a Faculty dashboard, and a Student dashboard powered by an AI Study Assistant.**

Built entirely in modern JavaScript / Node.js with Express, SQLite, React, Vite, and Tailwind CSS.

---

## 🌟 Architecture & Key Features

```
Campus-AI/
├── backend/                  # Node.js 20+ Express REST API (Port 8000)
│   ├── src/
│   │   ├── db/               # SQLite schema & database seeder
│   │   ├── middleware/       # JWT auth & requireRole() guards
│   │   ├── routes/           # REST endpoints (/auth, /users, /faculty, /student, /ai, /audit)
│   │   └── utils/            # Audit logger, RAG engine, document parser, Anthropic client
│   └── tests/                # Automated permission matrix & AI evaluation test suites
└── frontend/                 # React + Vite + Tailwind CSS SPA (Port 5173)
    └── src/
        ├── api/              # Axios instance with auto-bearer & 401 interception
        ├── context/          # AuthContext for role-based sessions
        ├── components/       # Shared UI components (Modal, Toast, PrivateRoute)
        └── pages/
            ├── admin/        # Admin Panel (Users, Courses, Audit Log, AI Settings)
            ├── faculty/      # Faculty Portal (Courses, AI Policies, Grading, Attendance)
            └── student/      # Student Portal (Courses, Grades, Attendance, AI Study Space)
```

---

## 👥 Roles & Portals

### 1. 🛡️ Admin Panel (`/admin` — Indigo Theme)
- **Live System Metrics**: Real-time counters for users, active courses, offerings, and AI queries.
- **User Management**: Create accounts, deactivate/reactivate users, reset passwords, and bulk import students via CSV.
- **Safety Invariant**: Protected against accidental lockout — the system strictly blocks deactivating or demoting the last active administrator.
- **Course Administration**: Departments, courses, semester offerings, faculty assignment, and student enrollments.
- **Security Audit Trail**: Immutable logging of all administrative and sensitive operations.
- **AI System Controls**: Master campus AI killswitch, max file upload limit (MB), daily student message quotas, and usage breakdown.

### 2. 👨‍🏫 Faculty Portal (`/faculty` — Sky Blue Theme)
- **My Courses**: Assigned semester offerings with enrolled student rosters and syllabus details.
- **Course AI Policy Toggles**: Instantly switch student AI assistant permissions per course:
  - `🟢 Full AI (Allowed)`: Complete study assistance and Q&A.
  - `🟡 Hints Only (Socratic)`: Assistant guides with questions and prompts, withholding direct solutions.
  - `🔴 AI Disabled`: Shuts off AI assistance for that course.
- **Announcements**: Publish, view, and delete course-wide announcements.
- **Assignments & Grading**: Create homework/projects with deadlines and point values. Review student submissions and assign numerical marks and written feedback.
- **Attendance Sheet**: Mark attendance (`Present`, `Late`, `Absent`) by date with 1-click batch actions.
- **Gradebook**: Comprehensive grade sheet with individual assignment scores, student averages, and official course letter grade entry.

### 3. 🎓 Student Portal (`/student` — Emerald Theme)
- **Academic Dashboard**: Overview of enrolled courses, attendance rates, pending tasks, and recent course announcements.
- **My Courses & Submissions**: View course information and submit coursework, code solutions, or repository links.
- **Grade Transcript**: Complete grade report with final course letters, assignment scores, percentage meters, and instructor comments.
- **Attendance Tracker**: Visual progress meters per course and a daily history log.
- **AI Study Space**:
  - **Document Library**: Upload course readings, lab handouts, and textbook PDFs (`.pdf`, `.docx`, `.txt`, `.md`).
  - **Source Citations**: Extracted chunks provide clickable citation badges `[Source: Doc, p.X]`.
  - **5 Specialized Modes**:
    1. `🔍 Ask`: Factual question answering with source citations.
    2. `💡 Explain`: Step-by-step conceptual breakdowns with analogies.
    3. `🧠 Brainstorm`: Project, essay, and exam study ideas.
    4. `📝 Quiz Me`: Interactive multiple-choice self-assessments.
    5. `📋 Summarize`: Key takeaways and study cheat sheets.
  - **Campus FAQ**: Instant institutional answers (library hours, grading scale, add/drop dates, Wi-Fi support).

---

## 🔑 Demo Credentials

All accounts are pre-seeded and ready to use in the login demo picker:

| Role | Name | Email | Password |
|---|---|---|---|
| **Admin** | Alice Admin | `admin@campus.edu` | `Admin@123` |
| **Faculty** | Frank Faculty | `frank@campus.edu` | `Faculty@123` |
| **Faculty** | Grace Lecturer | `grace@campus.edu` | `Faculty@123` |
| **Student** | Sam Student | `sam@campus.edu` | `Student@123` |
| **Student** | Priya Patel | `priya@campus.edu` | `Student@123` |
| **Student** | Jordan Lee | `jordan@campus.edu` | `Student@123` |
| **Student** | Maya Sharma | `maya@campus.edu` | `Student@123` |
| **Student** | Chris Park | `chris@campus.edu` | `Student@123` |

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 20+ installed
- npm or yarn

### 1. Clone & Setup Backend
```bash
cd backend
npm install

# Copy environment variables
cp .env.example .env

# Seed the SQLite database with initial users, courses, and settings
npm run seed

# Start Express backend with live hot-reloading (port 8000)
npm run dev
```

### 2. Setup Frontend
```bash
cd ../frontend
npm install

# Start Vite dev server (port 5173)
npm run dev
```

Open **http://localhost:5173** in your web browser.

---

## 🧪 Automated Test Suites

The backend includes a comprehensive, dual-phase automated test suite:

```bash
cd backend
npm test
```

### 1. Security & Permission Matrix Tests (`tests/permissions.test.js`)
- ✅ Verifies unauthenticated calls to protected routes return `401 Unauthorized`.
- ✅ Verifies Student calling Admin routes (`/users`, `/audit`, `/ai/admin/settings`) returns `403 Forbidden`.
- ✅ Verifies Student calling Faculty routes (`/faculty/*`) returns `403 Forbidden`.
- ✅ Verifies Faculty calling Admin routes returns `403 Forbidden`.
- ✅ Verifies authorized role access (Admin, Faculty, Student).
- ✅ Verifies **Last Active Admin Guard** prevents deactivating or locking out the last active admin (`400 Bad Request`).

### 2. 10 AI Evaluation Benchmark Questions (`tests/ai_eval.test.js`)
- ✅ **Q1 (Ask Mode)**: Accurate factual extraction from uploaded course texts.
- ✅ **Q2 (Citations)**: Formats document filename and exact page numbers.
- ✅ **Q3 (Explain Mode)**: Analogy-driven conceptual breakdowns.
- ✅ **Q4 (Brainstorm Mode)**: Generates 4+ creative project and study ideas.
- ✅ **Q5 (Quiz Mode)**: Interactive check-in questions with answer verification.
- ✅ **Q6 (Summarize Mode)**: Synthesizes executive takeaways.
- ✅ **Q7 (Course Policy - Hints Only)**: Enforces Socratic guidance and refuses to output direct code solutions.
- ✅ **Q8 (Course Policy - Disabled)**: Blocks AI assistance when course AI policy is set to disabled.
- ✅ **Q9 (Campus FAQ - Library)**: Accurately retrieves university library operating hours.
- ✅ **Q10 (Campus FAQ - Grading)**: Accurately retrieves university GPA points and letter grade scale.

---

## 🛡️ Environment Configuration (`.env`)

```ini
PORT=8000
JWT_SECRET=supersecret_change_me
JWT_EXPIRES_IN=8h
DB_PATH=./campus_ai.db

# Optional Anthropic Claude API Key (if omitted or placeholder,
# high-quality zero-dependency local RAG synthesis engine is used automatically)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CLAUDE_MODEL=claude-sonnet-4-5

UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=20
```

---

## 📄 License
MIT License • Developed for the Campus AI Hands-on Workshop.
