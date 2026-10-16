/**
 * FacultyCoursesPage.jsx
 * ──────────────────────
 * Faculty course management:
 *  - View assigned courses with details and statistics
 *  - Live toggle AI Assistant policy ('allowed' | 'hints_only' | 'disabled')
 *  - View and inspect enrolled student roster
 *  - View and post course-specific announcements
 */

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';

const POLICY_OPTIONS = [
  {
    value: 'allowed',
    label: 'Allowed (Full AI)',
    badge: 'bg-emerald-950/70 text-emerald-300 border-emerald-700',
    desc: 'Students can chat freely and get full explanations & examples.',
  },
  {
    value: 'hints_only',
    label: 'Hints Only (Socratic)',
    badge: 'bg-amber-950/70 text-amber-300 border-amber-700',
    desc: 'AI provides guiding questions and hints, but avoids giving direct solutions.',
  },
  {
    value: 'disabled',
    label: 'Disabled (AI Off)',
    badge: 'bg-red-950/70 text-red-300 border-red-700',
    desc: 'The AI assistant is blocked for documents and questions in this course.',
  },
];

export default function FacultyCoursesPage() {
  const toast = useToast();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Roster Modal
  const [selectedCourseForRoster, setSelectedCourseForRoster] = useState(null);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Announcements Modal
  const [selectedCourseForAnn, setSelectedCourseForAnn] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnBody, setNewAnnBody] = useState('');
  const [postingAnn, setPostingAnn] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    try {
      setLoading(true);
      const res = await api.get('/faculty/courses');
      setCourses(res.data);
    } catch {
      toast.error('Failed to load courses.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAiPolicyChange(offeringId, newPolicy) {
    try {
      await api.patch(`/faculty/courses/${offeringId}/ai-policy`, { ai_policy: newPolicy });
      setCourses(prev =>
        prev.map(c => (c.id === offeringId ? { ...c, ai_policy: newPolicy } : c))
      );
      toast.success(`AI Policy updated to "${newPolicy.replace('_', ' ')}"!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update AI policy.');
    }
  }

  async function openRosterModal(course) {
    setSelectedCourseForRoster(course);
    setRosterLoading(true);
    try {
      const res = await api.get(`/faculty/courses/${course.id}/students`);
      setRoster(res.data);
    } catch {
      toast.error('Failed to load student roster.');
    } finally {
      setRosterLoading(false);
    }
  }

  async function openAnnouncementsModal(course) {
    setSelectedCourseForAnn(course);
    setAnnLoading(true);
    try {
      const res = await api.get(`/faculty/announcements?offering_id=${course.id}`);
      setAnnouncements(res.data);
    } catch {
      toast.error('Failed to load course announcements.');
    } finally {
      setAnnLoading(false);
    }
  }

  async function handleCreateAnnouncement(e) {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnBody.trim()) {
      toast.error('Please enter title and message.');
      return;
    }
    try {
      setPostingAnn(true);
      const res = await api.post('/faculty/announcements', {
        offering_id: selectedCourseForAnn.id,
        title: newAnnTitle.trim(),
        body: newAnnBody.trim(),
      });
      toast.success('Announcement posted!');
      setAnnouncements(prev => [res.data, ...prev]);
      setNewAnnTitle('');
      setNewAnnBody('');
      // update local course count
      setCourses(prev =>
        prev.map(c =>
          c.id === selectedCourseForAnn.id
            ? { ...c, announcement_count: (c.announcement_count || 0) + 1 }
            : c
        )
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to post announcement.');
    } finally {
      setPostingAnn(false);
    }
  }

  async function handleDeleteAnnouncement(annId) {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/faculty/announcements/${annId}`);
      toast.success('Announcement removed.');
      setAnnouncements(prev => prev.filter(a => a.id !== annId));
      setCourses(prev =>
        prev.map(c =>
          c.id === selectedCourseForAnn.id
            ? { ...c, announcement_count: Math.max(0, (c.announcement_count || 0) - 1) }
            : c
        )
      );
    } catch {
      toast.error('Failed to delete announcement.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 gap-3">
        <span className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading courses...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">My Assigned Courses</h2>
          <p className="text-gray-400 text-xs">
            Review rosters, manage course announcements, and configure AI assistance modes per course.
          </p>
        </div>
      </div>

      {/* ── Courses Grid ───────────────────────────────────────────── */}
      {courses.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-500">
          <span className="text-4xl block mb-3">📚</span>
          <h3 className="text-white font-semibold text-lg mb-1">No Courses Assigned Yet</h3>
          <p className="text-sm">Contact the university administrator to be assigned to semester offerings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {courses.map(course => {
            const currentPolicy = POLICY_OPTIONS.find(p => p.value === course.ai_policy) || POLICY_OPTIONS[0];

            return (
              <div
                key={course.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700
                           transition-all flex flex-col justify-between space-y-5"
              >
                {/* Course Header */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-lg bg-sky-950/80 border border-sky-800
                                         text-sky-300 font-mono text-xs font-bold">
                          {course.code}
                        </span>
                        <span className="text-xs text-gray-400">{course.dept_name}</span>
                        <span className="text-xs text-gray-500">• {course.credits} Credits</span>
                      </div>
                      <h3 className="text-white text-lg font-bold">{course.title}</h3>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-gray-800 text-gray-400 border border-gray-700">
                      {course.semester_label}
                    </span>
                  </div>

                  {/* Summary Counters */}
                  <div className="grid grid-cols-3 gap-3 my-4">
                    <button
                      onClick={() => openRosterModal(course)}
                      className="bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 rounded-xl p-3 text-left transition-colors group"
                    >
                      <div className="text-xl font-bold text-sky-400 group-hover:text-sky-300">
                        {course.enrolled_count || 0}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <span>Students</span>
                        <span className="text-gray-500 group-hover:text-white">→</span>
                      </div>
                    </button>

                    <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3">
                      <div className="text-xl font-bold text-violet-400">
                        {course.assignment_count || 0}
                      </div>
                      <div className="text-xs text-gray-400">Assignments</div>
                    </div>

                    <button
                      onClick={() => openAnnouncementsModal(course)}
                      className="bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 rounded-xl p-3 text-left transition-colors group"
                    >
                      <div className="text-xl font-bold text-amber-400 group-hover:text-amber-300">
                        {course.announcement_count || 0}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <span>Announcements</span>
                        <span className="text-gray-500 group-hover:text-white">→</span>
                      </div>
                    </button>
                  </div>

                  {/* AI Policy Control */}
                  <div className="bg-gray-950/70 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                        <span>🤖</span> AI Study Policy
                      </label>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${currentPolicy.badge}`}>
                        {currentPolicy.label}
                      </span>
                    </div>

                    <p className="text-gray-400 text-xs mb-3">
                      {currentPolicy.desc}
                    </p>

                    <div className="grid grid-cols-3 gap-1.5">
                      {POLICY_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleAiPolicyChange(course.id, opt.value)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-center
                            ${course.ai_policy === opt.value
                              ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                            }`}
                        >
                          {opt.value === 'allowed' ? '🟢 Full AI' : opt.value === 'hints_only' ? '🟡 Hints Only' : '🔴 AI Off'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center gap-3 pt-3 border-t border-gray-800">
                  <button
                    onClick={() => openRosterModal(course)}
                    className="flex-1 py-2 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-200 transition-all text-center"
                  >
                    👥 Enrolled Roster ({course.enrolled_count || 0})
                  </button>
                  <button
                    onClick={() => openAnnouncementsModal(course)}
                    className="flex-1 py-2 px-3 rounded-xl bg-sky-950/60 hover:bg-sky-900/60 text-sky-300 border border-sky-800/80 text-xs font-medium transition-all text-center"
                  >
                    📢 Announcements ({course.announcement_count || 0})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Student Roster ──────────────────────────────────── */}
      <Modal
        isOpen={!!selectedCourseForRoster}
        onClose={() => setSelectedCourseForRoster(null)}
        title={selectedCourseForRoster ? `👥 Enrolled Students — ${selectedCourseForRoster.code}` : ''}
      >
        <div className="space-y-4">
          <p className="text-gray-400 text-xs">
            {selectedCourseForRoster?.title} ({selectedCourseForRoster?.semester_label})
          </p>

          {rosterLoading ? (
            <div className="py-8 text-center text-gray-500 text-xs">Loading roster...</div>
          ) : roster.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              No students enrolled in this course offering yet.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-800">
              {roster.map(st => {
                const attPercent = st.total_attendance_records > 0
                  ? Math.round((st.present_count / st.total_attendance_records) * 100)
                  : null;

                return (
                  <div key={st.student_id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-900/70 border border-sky-700 text-sky-300 font-bold text-xs flex items-center justify-center">
                        {st.name[0]}
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{st.name}</div>
                        <div className="text-gray-500 text-xs">{st.email}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs">
                        <span className="text-gray-400">Final Grade: </span>
                        <span className="font-bold text-white">{st.grade || '—'}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Attendance: {attPercent !== null ? `${attPercent}%` : 'No records'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-gray-800 flex justify-end">
            <button
              onClick={() => setSelectedCourseForRoster(null)}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Announcements ──────────────────────────────────── */}
      <Modal
        isOpen={!!selectedCourseForAnn}
        onClose={() => setSelectedCourseForAnn(null)}
        title={selectedCourseForAnn ? `📢 Announcements — ${selectedCourseForAnn.code}` : ''}
      >
        <div className="space-y-6">
          {/* Post New Announcement Form */}
          <form onSubmit={handleCreateAnnouncement} className="bg-gray-800/50 border border-gray-800 p-4 rounded-xl space-y-3">
            <h4 className="text-white text-xs font-bold uppercase tracking-wider">Create New Announcement</h4>
            <div>
              <input
                type="text"
                required
                placeholder="Title (e.g. Quiz scheduled for next Tuesday)"
                value={newAnnTitle}
                onChange={e => setNewAnnTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <textarea
                required
                rows={3}
                placeholder="Message body..."
                value={newAnnBody}
                onChange={e => setNewAnnBody(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={postingAnn}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-all disabled:opacity-50"
              >
                {postingAnn ? 'Posting...' : 'Post Announcement'}
              </button>
            </div>
          </form>

          {/* Announcements List */}
          <div>
            <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Published Announcements</h4>
            {annLoading ? (
              <div className="py-6 text-center text-gray-500 text-xs">Loading...</div>
            ) : announcements.length === 0 ? (
              <div className="py-6 text-center text-gray-500 text-xs italic">
                No announcements for this course yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {announcements.map(ann => (
                  <div key={ann.id} className="bg-gray-800/70 border border-gray-750 p-3.5 rounded-xl flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-xs font-bold">{ann.title}</span>
                        <span className="text-[10px] text-gray-500">{new Date(ann.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-300 text-xs whitespace-pre-line">{ann.body}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      className="text-gray-500 hover:text-red-400 text-xs p-1 transition-colors"
                      title="Delete Announcement"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-gray-800 flex justify-end">
            <button
              onClick={() => setSelectedCourseForAnn(null)}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
