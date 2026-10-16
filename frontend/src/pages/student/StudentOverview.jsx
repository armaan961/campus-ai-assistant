/**
 * StudentOverview.jsx
 * ───────────────────
 * Student dashboard home page:
 *  - Welcome header & academic snapshot
 *  - Metrics cards (Enrolled Courses, Overall Attendance, Assignments Due)
 *  - AI Study Space quick launch card
 *  - Recent Course Announcements feed
 *  - Quick access to Courses, Grades, and Attendance
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { useToast } from '../../components/Toast';

export default function StudentOverview() {
  const { user } = useAuth();
  const toast = useToast();

  const [courses, setCourses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [cRes, aRes, attRes, asgRes] = await Promise.all([
          api.get('/student/courses'),
          api.get('/student/announcements'),
          api.get('/student/attendance'),
          api.get('/student/assignments'),
        ]);
        setCourses(cRes.data);
        setAnnouncements(aRes.data);
        setAttendanceSummary(attRes.data.summary || []);
        setAssignments(asgRes.data);
      } catch {
        toast.error('Failed to load student overview.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute aggregate attendance
  let totalSessions = 0;
  let presentSessions = 0;
  attendanceSummary.forEach(c => {
    totalSessions += c.total_sessions || 0;
    presentSessions += c.present_count || 0;
  });
  const overallAttendancePercent = totalSessions > 0
    ? Math.round((presentSessions / totalSessions) * 100)
    : 100;

  const pendingAssignments = assignments.filter(a => !a.submission_id).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 gap-3">
        <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading your student dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Welcome Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Welcome back, {user?.name?.split(' ')[0]} 🌟
          </h2>
          <p className="text-gray-400 text-sm">
            Fall 2025 Semester • Here is your current academic progress and assignments.
          </p>
        </div>

        <Link
          to="/student/ai"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500
                     text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-900/40"
        >
          <span>🤖</span>
          <span>Open AI Study Assistant</span>
        </Link>
      </div>

      {/* ── Metrics Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Enrolled Courses',  value: courses.length,                  icon: '📚', color: 'emerald' },
          { label: 'Overall Attendance', value: `${overallAttendancePercent}%`,  icon: '✅', color: 'sky'     },
          { label: 'Assignments Due',    value: pendingAssignments,              icon: '📝', color: 'amber'   },
          { label: 'Announcements',      value: announcements.length,            icon: '📢', color: 'violet'  },
        ].map(card => (
          <div
            key={card.label}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all"
          >
            <div className="text-2xl mb-3">{card.icon}</div>
            <div className="text-3xl font-bold text-emerald-400 mb-1">{card.value}</div>
            <div className="text-gray-400 text-xs">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── AI Study Space Banner ──────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-gray-900 to-gray-900 border border-emerald-800/60 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-900/70 border border-emerald-700 flex items-center justify-center text-3xl flex-shrink-0">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700">
                AI Study Tutor
              </span>
              <span className="text-xs text-gray-400">Ask • Explain • Brainstorm • Quiz • Summarize</span>
            </div>
            <h3 className="text-white text-lg font-bold">Have questions about your lectures or readings?</h3>
            <p className="text-gray-400 text-xs mt-1">
              Upload textbook PDFs, class notes, or syllabi. Get instant answers with verified source citations!
            </p>
          </div>
        </div>

        <Link
          to="/student/ai"
          className="whitespace-nowrap px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/50 transition-all"
        >
          Launch Study Space →
        </Link>
      </div>

      {/* ── Enrolled Courses Snapshot & Announcements ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: My Enrolled Courses */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📚</span> My Enrolled Courses
            </h3>
            <Link to="/student/courses" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium hover:underline">
              View All Courses →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map(course => (
              <div
                key={course.enrollment_id}
                className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-4 flex flex-col justify-between hover:border-gray-600 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded">
                      {course.code}
                    </span>
                    <span className="text-xs text-gray-400">{course.credits} Credits</span>
                  </div>
                  <h4 className="text-white font-semibold text-sm mb-1">{course.title}</h4>
                  <div className="text-gray-400 text-xs flex items-center gap-1.5">
                    <span>👨‍🏫</span>
                    <span>{course.faculty_name}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    Grade: <strong className="text-white">{course.final_grade || 'In Progress'}</strong>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                    course.ai_policy === 'allowed'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : course.ai_policy === 'hints_only'
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-red-950 text-red-300 border-red-800'
                  }`}>
                    {course.ai_policy === 'allowed' ? '🟢 Full AI' : course.ai_policy === 'hints_only' ? '🟡 Hints Only' : '🔴 AI Off'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Announcements Feed */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📢</span> Course Updates
            </h3>
            <span className="text-xs text-gray-500">{announcements.length} updates</span>
          </div>

          {announcements.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-xs">
              No course announcements posted yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {announcements.slice(0, 4).map(ann => (
                <div
                  key={ann.id}
                  className="bg-gray-800/40 border border-gray-800 rounded-xl p-3.5 hover:border-gray-700 transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {ann.course_code}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(ann.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-white font-medium text-xs mb-1">{ann.title}</h4>
                  <p className="text-gray-400 text-xs line-clamp-2">{ann.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
