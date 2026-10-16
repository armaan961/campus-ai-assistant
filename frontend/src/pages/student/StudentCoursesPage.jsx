/**
 * StudentCoursesPage.jsx
 * ──────────────────────
 * Student course hub:
 *  - Detailed view of all currently enrolled courses
 *  - Faculty contact & syllabus information
 *  - AI Policy status indicator with explanation
 *  - Course-specific assignments with submission modal
 *  - Direct link to launch AI Study space for the course
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';

export default function StudentCoursesPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Submit assignment modal
  const [activeAssignmentForSubmit, setActiveAssignmentForSubmit] = useState(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [cRes, asgRes, annRes] = await Promise.all([
          api.get('/student/courses'),
          api.get('/student/assignments'),
          api.get('/student/announcements'),
        ]);
        setCourses(cRes.data);
        setAssignments(asgRes.data);
        setAnnouncements(annRes.data);
      } catch {
        toast.error('Failed to load courses.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleSubmitAssignment(e) {
    e.preventDefault();
    if (!submissionText.trim()) {
      toast.error('Please enter your submission text or link.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/student/assignments/${activeAssignmentForSubmit.id}/submit`, {
        submission_text: submissionText.trim(),
      });
      toast.success(res.data.message || 'Assignment submitted!');
      setActiveAssignmentForSubmit(null);
      setSubmissionText('');

      // Refresh assignments
      const refreshed = await api.get('/student/assignments');
      setAssignments(refreshed.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit assignment.');
    } finally {
      setSubmitting(false);
    }
  }

  function launchAiForCourse(offeringId) {
    navigate(`/student/ai?offering_id=${offeringId}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 gap-3">
        <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading your courses...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">My Enrolled Courses</h2>
          <p className="text-gray-400 text-xs">
            Review syllabi, submit coursework, check faculty updates, and launch the AI study assistant.
          </p>
        </div>
      </div>

      {/* ── Courses List ───────────────────────────────────────────── */}
      {courses.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-500">
          <span className="text-4xl block mb-3">📚</span>
          <h3 className="text-white font-semibold text-lg mb-1">No Enrolled Courses Found</h3>
          <p className="text-sm">Contact the registrar or your academic advisor to enroll in semester courses.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {courses.map(course => {
            const courseAssignments = assignments.filter(a => a.offering_id === course.offering_id);
            const courseAnnouncements = announcements.filter(a => a.offering_id === course.offering_id);

            return (
              <div
                key={course.enrollment_id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all space-y-5"
              >
                {/* Course Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-mono text-xs font-bold">
                        {course.code}
                      </span>
                      <span className="text-xs text-gray-400">{course.dept_name}</span>
                      <span className="text-xs text-gray-500">• {course.credits} Credits</span>
                      <span className="text-xs text-gray-500">• {course.semester_label}</span>
                    </div>
                    <h3 className="text-white text-lg font-bold">{course.title}</h3>
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                      <span>Instructor: <strong className="text-gray-200">{course.faculty_name}</strong></span>
                      <span>({course.faculty_email})</span>
                    </div>
                  </div>

                  {/* AI Policy Badge & AI Launch Button */}
                  <div className="flex flex-col sm:items-end gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border self-start sm:self-auto ${
                      course.ai_policy === 'allowed'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                        : course.ai_policy === 'hints_only'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                        : 'bg-red-950/80 text-red-300 border-red-700'
                    }`}>
                      {course.ai_policy === 'allowed'
                        ? '🟢 AI Allowed (Full Assistant)'
                        : course.ai_policy === 'hints_only'
                        ? '🟡 Hints Only (Socratic Mode)'
                        : '🔴 AI Disabled for this Course'}
                    </span>

                    <button
                      onClick={() => launchAiForCourse(course.offering_id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500
                                 text-white text-xs font-semibold shadow-md shadow-emerald-950 transition-all self-start sm:self-auto"
                    >
                      <span>🤖</span>
                      <span>Study with AI</span>
                    </button>
                  </div>
                </div>

                {/* Assignments Section */}
                <div className="pt-4 border-t border-gray-800">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>📝</span> Course Assignments ({courseAssignments.length})
                  </h4>

                  {courseAssignments.length === 0 ? (
                    <p className="text-gray-500 text-xs italic">No assignments posted for this course yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {courseAssignments.map(asg => {
                        const isSubmitted = !!asg.submission_id;
                        const isGraded = asg.score !== null && asg.score !== undefined;

                        return (
                          <div
                            key={asg.id}
                            className="p-3.5 rounded-xl bg-gray-800/60 border border-gray-750 flex flex-col justify-between space-y-2.5"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <h5 className="text-white text-xs font-bold">{asg.title}</h5>
                                <span className="text-[11px] text-gray-400 font-mono">
                                  {asg.max_score} pts
                                </span>
                              </div>
                              <p className="text-gray-400 text-xs line-clamp-2">
                                {asg.description || 'No description provided.'}
                              </p>
                              {asg.due_date && (
                                <div className="text-[11px] text-gray-500 mt-1">
                                  Due: {new Date(asg.due_date).toLocaleDateString()}
                                </div>
                              )}
                            </div>

                            <div className="pt-2 border-t border-gray-700/50 flex items-center justify-between text-xs">
                              <div>
                                {isGraded ? (
                                  <span className="font-bold text-emerald-400">
                                    Score: {asg.score} / {asg.max_score}
                                  </span>
                                ) : isSubmitted ? (
                                  <span className="text-sky-400">✓ Submitted (Pending Grade)</span>
                                ) : (
                                  <span className="text-amber-400">Not submitted</span>
                                )}
                              </div>

                              <button
                                onClick={() => {
                                  setActiveAssignmentForSubmit(asg);
                                  setSubmissionText(asg.file_path || '');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-[11px] font-medium transition-colors"
                              >
                                {isSubmitted ? 'Edit Submission' : 'Submit Work'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Announcements Section */}
                {courseAnnouncements.length > 0 && (
                  <div className="pt-3 border-t border-gray-800">
                    <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <span>📢</span> Latest Course Announcements
                    </h4>
                    <div className="space-y-2">
                      {courseAnnouncements.slice(0, 2).map(ann => (
                        <div key={ann.id} className="p-3 rounded-lg bg-gray-800/30 border border-gray-800">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white text-xs font-medium">{ann.title}</span>
                            <span className="text-[10px] text-gray-500">{new Date(ann.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-gray-400 text-xs">{ann.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Submit Assignment ───────────────────────────────── */}
      <Modal
        isOpen={!!activeAssignmentForSubmit}
        onClose={() => setActiveAssignmentForSubmit(null)}
        title={activeAssignmentForSubmit ? `📝 Submit: ${activeAssignmentForSubmit.title}` : ''}
      >
        <form onSubmit={handleSubmitAssignment} className="space-y-4">
          <div className="text-xs text-gray-400">
            Enter your submission solution, code explanation, or GitHub repository link below.
          </div>

          <div>
            <textarea
              required
              rows={5}
              placeholder="Enter your completed work or assignment response..."
              value={submissionText}
              onChange={e => setSubmissionText(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setActiveAssignmentForSubmit(null)}
              className="px-4 py-2 rounded-xl text-gray-400 hover:text-white text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Assignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
