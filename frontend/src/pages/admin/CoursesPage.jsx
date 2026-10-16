/**
 * CoursesPage.jsx
 * ───────────────
 * Three tabbed sections:
 *  1. Departments — list + create + delete
 *  2. Courses     — list + create (pick dept) + delete
 *  3. Offerings   — list + assign faculty to course+semester + enroll students
 */

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';

const TABS = ['Departments', 'Courses', 'Offerings'];

function Input({ ...props }) {
  return (
    <input {...props}
      className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700
                 text-white placeholder-gray-500 text-sm
                 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
  );
}
function Select({ children, ...props }) {
  return (
    <select {...props}
      className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700
                 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
      {children}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CoursesPage() {
  const [tab, setTab] = useState('Departments');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Courses & Departments</h2>
        <p className="text-gray-400 text-sm">Manage academic structure</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl border border-gray-800 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t
                ? 'bg-indigo-600 text-white shadow'
                : 'text-gray-400 hover:text-gray-200'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Departments' && <DepartmentsTab />}
      {tab === 'Courses'     && <CoursesTab />}
      {tab === 'Offerings'   && <OfferingsTab />}
    </div>
  );
}

// ── Departments Tab ───────────────────────────────────────────────────────────
function DepartmentsTab() {
  const toast = useToast();
  const [depts, setDepts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');

  async function load() {
    const { data } = await api.get('/departments');
    setDepts(data);
  }
  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post('/departments', { name });
      toast.success('Department created!');
      setModalOpen(false);
      setName('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create department');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this department?')) return;
    try {
      await api.delete(`/departments/${id}`);
      toast.success('Department deleted.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cannot delete department');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-400 text-sm">{depts.length} departments</p>
        <button id="btn-add-dept" onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white
                     text-sm font-semibold rounded-xl transition-all">
          + Add Department
        </button>
      </div>

      <div className="grid gap-3">
        {depts.map(d => (
          <div key={d.id}
            className="flex items-center justify-between bg-gray-900 border border-gray-800
                       rounded-xl px-5 py-4 hover:border-indigo-700 transition-colors">
            <div>
              <div className="text-white font-semibold">{d.name}</div>
              <div className="text-gray-500 text-xs">{d.course_count} course(s)</div>
            </div>
            <button onClick={() => handleDelete(d.id)}
              className="text-red-400 hover:text-red-300 text-sm transition-colors px-2 py-1
                         rounded-lg hover:bg-red-900/30">
              🗑 Delete
            </button>
          </div>
        ))}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Department" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Department Name</label>
            <Input placeholder="e.g. Computer Science" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 text-sm">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── Courses Tab ───────────────────────────────────────────────────────────────
function CoursesTab() {
  const toast = useToast();
  const [courses, setCourses]   = useState([]);
  const [depts,   setDepts]     = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ dept_id: '', code: '', title: '', credits: 3 });

  async function load() {
    const [c, d] = await Promise.all([api.get('/courses'), api.get('/departments')]);
    setCourses(c.data);
    setDepts(d.data);
    if (d.data.length && !form.dept_id) setForm(f => ({...f, dept_id: d.data[0].id}));
  }
  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post('/courses', { ...form, dept_id: Number(form.dept_id), credits: Number(form.credits) });
      toast.success('Course created!');
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create course');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this course?')) return;
    try {
      await api.delete(`/courses/${id}`);
      toast.success('Course deleted.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cannot delete course');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-400 text-sm">{courses.length} courses</p>
        <button id="btn-add-course" onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white
                     text-sm font-semibold rounded-xl transition-all">
          + Add Course
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3">Code</th>
              <th className="text-left px-5 py-3">Title</th>
              <th className="text-left px-5 py-3">Department</th>
              <th className="text-left px-5 py-3">Credits</th>
              <th className="text-left px-5 py-3">Offerings</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {courses.map(c => (
              <tr key={c.id} className="border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors">
                <td className="px-5 py-3">
                  <span className="font-mono bg-indigo-900/40 text-indigo-300 px-2 py-0.5 rounded text-xs">
                    {c.code}
                  </span>
                </td>
                <td className="px-5 py-3 text-white font-medium">{c.title}</td>
                <td className="px-5 py-3 text-gray-400">{c.dept_name}</td>
                <td className="px-5 py-3 text-gray-400">{c.credits}</td>
                <td className="px-5 py-3 text-gray-400">{c.offering_count}</td>
                <td className="px-5 py-3">
                  <button onClick={() => handleDelete(c.id)}
                    className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded-lg
                               hover:bg-red-900/30 transition-colors">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Course">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Department</label>
            <Select value={form.dept_id} onChange={e => setForm(f => ({...f, dept_id: e.target.value}))}>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Course Code</label>
            <Input placeholder="e.g. CS301" value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Title</label>
            <Input placeholder="e.g. Operating Systems" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Credits</label>
            <Input type="number" min="1" max="6" value={form.credits} onChange={e => setForm(f => ({...f, credits: e.target.value}))} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 text-sm">Cancel</button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">Create</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── Offerings Tab ─────────────────────────────────────────────────────────────
function OfferingsTab() {
  const toast = useToast();
  const [offerings,  setOfferings]  = useState([]);
  const [courses,    setCourses]    = useState([]);
  const [semesters,  setSemesters]  = useState([]);
  const [faculty,    setFaculty]    = useState([]);
  const [students,   setStudents]   = useState([]);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selOffering, setSelOffering] = useState(null);
  const [form, setForm] = useState({ course_id: '', faculty_id: '', semester_id: '', ai_policy: 'allowed' });
  const [enrollStudentId, setEnrollStudentId] = useState('');

  const AI_POLICY_STYLE = {
    allowed:    'bg-emerald-900/40 text-emerald-400',
    hints_only: 'bg-yellow-900/40  text-yellow-400',
    disabled:   'bg-red-900/40     text-red-400',
  };

  async function load() {
    const [o, c, s, u] = await Promise.all([
      api.get('/offerings'),
      api.get('/courses'),
      api.get('/semesters'),
      api.get('/users', { params: { limit: 100 } }),
    ]);
    setOfferings(o.data);
    setCourses(c.data);
    setSemesters(s.data);
    const allUsers = u.data.users;
    setFaculty(allUsers.filter(u => u.role === 'faculty'));
    setStudents(allUsers.filter(u => u.role === 'student'));

    if (c.data.length) setForm(f => ({...f, course_id: c.data[0].id}));
    if (s.data.length) setForm(f => ({...f, semester_id: s.data[0].id}));
    if (allUsers.filter(u => u.role === 'faculty').length)
      setForm(f => ({...f, faculty_id: allUsers.find(u => u.role === 'faculty')?.id}));
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post('/offerings', {
        course_id:   Number(form.course_id),
        faculty_id:  Number(form.faculty_id),
        semester_id: Number(form.semester_id),
        ai_policy:   form.ai_policy,
      });
      toast.success('Offering created!');
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create offering');
    }
  }

  async function handleEnroll(e) {
    e.preventDefault();
    try {
      await api.post('/enrollments', {
        student_id:  Number(enrollStudentId),
        offering_id: selOffering.id,
      });
      toast.success('Student enrolled!');
      setEnrollOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Enrollment failed');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-400 text-sm">{offerings.length} offerings</p>
        <button id="btn-add-offering" onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white
                     text-sm font-semibold rounded-xl transition-all">
          + Assign Faculty
        </button>
      </div>

      <div className="grid gap-3">
        {offerings.map(o => (
          <div key={o.id}
            className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4
                       hover:border-indigo-700/50 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono bg-indigo-900/40 text-indigo-300 px-2 py-0.5 rounded text-xs">
                    {o.code}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${AI_POLICY_STYLE[o.ai_policy]}`}>
                    AI: {o.ai_policy}
                  </span>
                </div>
                <div className="text-white font-semibold">{o.title}</div>
                <div className="text-gray-400 text-xs mt-1">
                  👤 {o.faculty_name} · 📅 {o.semester_label} · 🎓 {o.enrolled_count} students
                </div>
              </div>
              <button
                onClick={() => { setSelOffering(o); setEnrollStudentId(''); setEnrollOpen(true); }}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-900/40 text-emerald-400
                           hover:bg-emerald-900/70 transition-colors whitespace-nowrap">
                + Enroll Student
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Offering Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Assign Faculty to Course">
        <form onSubmit={handleCreate} className="space-y-4">
          {[
            { label: 'Course', key: 'course_id', opts: courses.map(c => ({ v: c.id, l: `${c.code} — ${c.title}` })) },
            { label: 'Faculty', key: 'faculty_id', opts: faculty.map(f => ({ v: f.id, l: f.name })) },
            { label: 'Semester', key: 'semester_id', opts: semesters.map(s => ({ v: s.id, l: s.label })) },
          ].map(({ label, key, opts }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
              <Select value={form[key]} onChange={e => setForm(f => ({...f, [key]: e.target.value}))}>
                {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </Select>
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">AI Policy</label>
            <Select value={form.ai_policy} onChange={e => setForm(f => ({...f, ai_policy: e.target.value}))}>
              <option value="allowed">Allowed</option>
              <option value="hints_only">Hints Only</option>
              <option value="disabled">Disabled</option>
            </Select>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 text-sm">Cancel</button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">Create</button>
          </div>
        </form>
      </Modal>

      {/* Enroll Student Modal */}
      <Modal isOpen={enrollOpen} onClose={() => setEnrollOpen(false)} title="Enroll Student" size="sm">
        <form onSubmit={handleEnroll} className="space-y-4">
          <p className="text-gray-400 text-sm">
            Enrolling into <span className="text-white font-medium">{selOffering?.title}</span>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Select Student</label>
            <Select value={enrollStudentId} onChange={e => setEnrollStudentId(e.target.value)}>
              <option value="">— Pick a student —</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
            </Select>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setEnrollOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 text-sm">Cancel</button>
            <button type="submit" disabled={!enrollStudentId}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40">
              Enroll
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
