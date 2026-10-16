/**
 * FacultyOverview.jsx
 * ───────────────────
 * Faculty dashboard home page:
 *  - Metric cards (Courses, Students, Assignments, Announcements)
 *  - AI Policy status monitor across courses
 *  - Recent Announcements feed with inline create modal
 *  - Quick navigation shortcuts
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';

const POLICY_INFO = {
  allowed: {
    label: 'AI Tutor Active',
    color: 'bg-emerald-950/60 text-emerald-300 border-emerald-700',
    dot: 'bg-emerald-400',
    desc: 'Students can ask questions & get explanations',
  },
  hints_only: {
    label: 'Hints Only',
    color: 'bg-amber-950/60 text-amber-300 border-amber-700',
    dot: 'bg-amber-400',
    desc: 'AI provides guidance without full code/answers',
  },
  disabled: {
    label: 'AI Disabled',
    color: 'bg-red-950/60 text-red-300 border-red-700',
    dot: 'bg-red-400',
    desc: 'AI assistant is turned off for this course',
  },
};

export default function FacultyOverview() {
  const { user } = useAuth();
  const toast = useToast();

  const [courses, setCourses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick post announcement modal state
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [annCourseId, setAnnCourseId] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [postingAnn, setPostingAnn] = useState(false);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  async function fetchOverviewData() {
    try {
      setLoading(true);
      const [cRes, aRes, asgRes] = await Promise.all([
        api.get('/faculty/courses'),
        api.get('/faculty/announcements'),
        api.get('/faculty/assignments'),
      ]);
      setCourses(cRes.data);
      setAnnouncements(aRes.data);
      setAssignments(asgRes.data);
      if (cRes.data.length > 0) {
        setAnnCourseId(cRes.data[0].id.toString());
      }
    } catch (err) {
      toast.error('Failed to load dashboard overview data.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePostAnnouncement(e) {
    e.preventDefault();
    if (!annCourseId || !annTitle.trim() || !annBody.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }

    try {
      setPostingAnn(true);
      const res = await api.post('/faculty/announcements', {
        offering_id: parseInt(annCourseId),
        title: annTitle.trim(),
        body: annBody.trim(),
      });
      toast.success('Announcement published!');
      setAnnouncements(prev => [res.data, ...prev]);
      setShowAnnModal(false);
      setAnnTitle('');
      setAnnBody('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to post announcement.');
    } finally {
      setPostingAnn(false);
    }
  }

  const totalStudents = courses.reduce((acc, c) => acc + (c.enrolled_count || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 gap-3">
        <span className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading faculty overview...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Welcome Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-gray-400 text-sm">
            Manage your courses, students, assignments, and AI policies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAnnModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500
                       text-white text-sm font-medium transition-all shadow-lg shadow-sky-900/30"
          >
            <span>📢</span>
            <span>New Announcement</span>
          </button>
          <Link
            to="/faculty/attendance"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700
                       text-gray-200 text-sm font-medium transition-all border border-gray-700"
          >
            <span>✅</span>
            <span>Take Attendance</span>
          </Link>
        </div>
      </div>

      {/* ── Stats Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Assigned Courses',  value: courses.length,      icon: '📚', color: 'sky'    },
          { label: 'Enrolled Students', value: totalStudents,        icon: '👥', color: 'blue'   },
          { label: 'Assignments',       value: assignments.length,  icon: '📝', color: 'violet' },
          { label: 'Announcements',     value: announcements.length,icon: '📢', color: 'amber'  },
        ].map(card => (
          <div
            key={card.label}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
            </div>
            <div className="text-3xl font-bold text-sky-400 mb-1">{card.value}</div>
            <div className="text-gray-400 text-sm">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── AI Policy Course Cards ─────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🤖</span> AI Study Assistant Policies
            </h3>
            <p className="text-gray-400 text-xs">
              Live status of student AI study assistant per course. You can switch policies anytime in My Courses.
            </p>
          </div>
          <Link
            to="/faculty/courses"
            className="text-sky-400 hover:text-sky-300 text-xs font-semibold hover:underline"
          >
            Manage Policies →
          </Link>
        </div>

        {courses.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No courses currently assigned.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map(course => {
              const info = POLICY_INFO[course.ai_policy] || POLICY_INFO.allowed;
              return (
                <div
                  key={course.id}
                  className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-sky-300 bg-sky-950/60 border border-sky-800 px-2 py-0.5 rounded">
                        {course.code}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${info.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
                        {info.label}
                      </span>
                    </div>
                    <h4 className="text-white font-semibold text-sm mb-1">{course.title}</h4>
                    <p className="text-gray-400 text-xs line-clamp-2">{info.desc}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center justify-between text-xs text-gray-500">
                    <span>{course.semester_label}</span>
                    <span>{course.enrolled_count || 0} students enrolled</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Recent Announcements & Quick Actions ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Recent Announcements */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📢</span> Recent Announcements
            </h3>
            <button
              onClick={() => setShowAnnModal(true)}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium hover:underline"
            >
              + Post New
            </button>
          </div>

          {announcements.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">
              <span className="text-3xl block mb-2">📭</span>
              No announcements posted yet. Click "+ Post New" to send an update to your students.
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.slice(0, 5).map(ann => (
                <div
                  key={ann.id}
                  className="bg-gray-800/40 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-semibold text-sky-400">
                      {ann.course_code}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(ann.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-white font-medium text-sm mb-1">{ann.title}</h4>
                  <p className="text-gray-400 text-xs whitespace-pre-line">{ann.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right col: Quick Links & Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>⚡</span> Quick Actions
            </h3>
            <div className="space-y-3">
              <Link
                to="/faculty/courses"
                className="flex items-center justify-between p-3.5 rounded-xl bg-gray-800/60
                           hover:bg-gray-800 border border-gray-700/60 hover:border-sky-500/50 transition-all text-sm group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📚</span>
                  <div>
                    <div className="text-white font-medium group-hover:text-sky-300 transition-colors">
                      My Courses & Rosters
                    </div>
                    <div className="text-gray-400 text-xs">View students & AI policies</div>
                  </div>
                </div>
                <span className="text-gray-500 group-hover:text-white transition-colors">→</span>
              </Link>

              <Link
                to="/faculty/assignments"
                className="flex items-center justify-between p-3.5 rounded-xl bg-gray-800/60
                           hover:bg-gray-800 border border-gray-700/60 hover:border-sky-500/50 transition-all text-sm group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📝</span>
                  <div>
                    <div className="text-white font-medium group-hover:text-sky-300 transition-colors">
                      Assignment Grading
                    </div>
                    <div className="text-gray-400 text-xs">Review & score submissions</div>
                  </div>
                </div>
                <span className="text-gray-500 group-hover:text-white transition-colors">→</span>
              </Link>

              <Link
                to="/faculty/attendance"
                className="flex items-center justify-between p-3.5 rounded-xl bg-gray-800/60
                           hover:bg-gray-800 border border-gray-700/60 hover:border-sky-500/50 transition-all text-sm group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">✅</span>
                  <div>
                    <div className="text-white font-medium group-hover:text-sky-300 transition-colors">
                      Attendance Sheet
                    </div>
                    <div className="text-gray-400 text-xs">Mark present, absent, late</div>
                  </div>
                </div>
                <span className="text-gray-500 group-hover:text-white transition-colors">→</span>
              </Link>

              <Link
                to="/faculty/grades"
                className="flex items-center justify-between p-3.5 rounded-xl bg-gray-800/60
                           hover:bg-gray-800 border border-gray-700/60 hover:border-sky-500/50 transition-all text-sm group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏆</span>
                  <div>
                    <div className="text-white font-medium group-hover:text-sky-300 transition-colors">
                      Course Gradebook
                    </div>
                    <div className="text-gray-400 text-xs">Enter & finalize course grades</div>
                  </div>
                </div>
                <span className="text-gray-500 group-hover:text-white transition-colors">→</span>
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-800 text-xs text-gray-500">
            University Term: <span className="text-gray-300 font-medium">Fall 2025</span>
          </div>
        </div>
      </div>

      {/* ── Modal: Post Announcement ──────────────────────────────── */}
      <Modal
        isOpen={showAnnModal}
        onClose={() => setShowAnnModal(false)}
        title="📢 Publish Course Announcement"
      >
        <form onSubmit={handlePostAnnouncement} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Select Course
            </label>
            <select
              value={annCourseId}
              onChange={e => setAnnCourseId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700
                         text-white text-sm focus:outline-none focus:border-sky-500"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Announcement Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Midterm exam format & topics"
              value={annTitle}
              onChange={e => setAnnTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700
                         text-white text-sm focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Message Body
            </label>
            <textarea
              required
              rows={4}
              placeholder="Write your announcement details here..."
              value={annBody}
              onChange={e => setAnnBody(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700
                         text-white text-sm focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setShowAnnModal(false)}
              className="px-4 py-2 rounded-xl text-gray-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={postingAnn}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white
                         text-sm font-medium transition-all disabled:opacity-50"
            >
              {postingAnn ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
