/**
 * FacultyAssignmentsPage.jsx
 * ──────────────────────────
 * Faculty assignment management & submission grading:
 *  - Create assignments per course offering
 *  - View submissions from all enrolled students
 *  - Enter numerical score and written feedback
 *  - Track grading progress
 */

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';

export default function FacultyAssignmentsPage() {
  const toast = useToast();

  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Create Assignment Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOfferingId, setNewOfferingId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newMaxScore, setNewMaxScore] = useState(100);
  const [creating, setCreating] = useState(false);

  // Submissions / Grading Modal
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [submissionsData, setSubmissionsData] = useState([]);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [studentGrades, setStudentGrades] = useState({}); // { [studentId]: { score, feedback, saving } }

  useEffect(() => {
    loadData();
  }, [selectedCourseFilter]);

  async function loadData() {
    try {
      setLoading(true);
      const [coursesRes, asgRes] = await Promise.all([
        api.get('/faculty/courses'),
        api.get(`/faculty/assignments${selectedCourseFilter ? `?offering_id=${selectedCourseFilter}` : ''}`),
      ]);
      setCourses(coursesRes.data);
      setAssignments(asgRes.data);
      if (coursesRes.data.length > 0 && !newOfferingId) {
        setNewOfferingId(coursesRes.data[0].id.toString());
      }
    } catch {
      toast.error('Failed to load assignments.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAssignment(e) {
    e.preventDefault();
    if (!newOfferingId || !newTitle.trim()) {
      toast.error('Please enter course and title.');
      return;
    }

    try {
      setCreating(true);
      const res = await api.post('/faculty/assignments', {
        offering_id: parseInt(newOfferingId),
        title: newTitle.trim(),
        description: newDesc.trim(),
        due_date: newDueDate || null,
        max_score: parseInt(newMaxScore) || 100,
      });
      toast.success('Assignment created!');
      setAssignments(prev => [res.data, ...prev]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
      setNewMaxScore(100);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create assignment.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteAssignment(id) {
    if (!window.confirm('Delete this assignment and any existing student submissions?')) return;
    try {
      await api.delete(`/faculty/assignments/${id}`);
      toast.success('Assignment deleted.');
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch {
      toast.error('Failed to delete assignment.');
    }
  }

  async function openGradingModal(assignment) {
    setActiveAssignment(assignment);
    setGradingLoading(true);
    try {
      const res = await api.get(`/faculty/assignments/${assignment.id}/submissions`);
      setSubmissionsData(res.data.students || []);

      // Initialize form state
      const initial = {};
      (res.data.students || []).forEach(st => {
        initial[st.student_id] = {
          score: st.score !== null && st.score !== undefined ? st.score : '',
          feedback: st.feedback || '',
          saving: false,
        };
      });
      setStudentGrades(initial);
    } catch {
      toast.error('Failed to load submissions.');
    } finally {
      setGradingLoading(false);
    }
  }

  async function handleSaveStudentGrade(studentId) {
    const gradeObj = studentGrades[studentId];
    if (!gradeObj || gradeObj.score === '') {
      toast.error('Please enter a valid numeric score.');
      return;
    }

    const scoreNum = parseFloat(gradeObj.score);
    if (isNaN(scoreNum) || scoreNum < 0) {
      toast.error('Score must be a non-negative number.');
      return;
    }

    try {
      setStudentGrades(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], saving: true },
      }));

      await api.post(`/faculty/assignments/${activeAssignment.id}/grade/${studentId}`, {
        score: scoreNum,
        feedback: gradeObj.feedback,
      });

      toast.success('Grade & feedback saved!');

      // Update submissions data locally
      setSubmissionsData(prev =>
        prev.map(s =>
          s.student_id === studentId
            ? { ...s, score: scoreNum, feedback: gradeObj.feedback, graded_at: new Date().toISOString() }
            : s
        )
      );

      // Refresh assignments count in background
      api.get(`/faculty/assignments${selectedCourseFilter ? `?offering_id=${selectedCourseFilter}` : ''}`)
        .then(res => setAssignments(res.data))
        .catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save grade.');
    } finally {
      setStudentGrades(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], saving: false },
      }));
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Assignments & Grading</h2>
          <p className="text-gray-400 text-xs">
            Create course assignments, inspect student submissions, and provide scores & feedback.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCourseFilter}
            onChange={e => setSelectedCourseFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="">All Courses</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-900/30 transition-all"
          >
            <span>+</span>
            <span>New Assignment</span>
          </button>
        </div>
      </div>

      {/* ── Assignments List ───────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-500 gap-3">
          <span className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading assignments...</span>
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-500">
          <span className="text-4xl block mb-3">📝</span>
          <h3 className="text-white font-semibold text-lg mb-1">No Assignments Created Yet</h3>
          <p className="text-sm mb-4">Click "New Assignment" to publish homework, projects, or quizzes.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-all"
          >
            Create Your First Assignment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {assignments.map(asg => {
            const isDuePassed = asg.due_date && new Date(asg.due_date) < new Date();
            const total = asg.total_students || 0;
            const graded = asg.graded_count || 0;
            const submitted = asg.submitted_count || 0;

            return (
              <div
                key={asg.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700
                           transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-950/80 text-sky-300 border border-sky-800">
                      {asg.course_code}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      Max: <span className="text-white font-bold">{asg.max_score} pts</span>
                    </span>
                  </div>

                  <h3 className="text-white font-bold text-base mb-1">{asg.title}</h3>
                  <p className="text-gray-400 text-xs line-clamp-2 mb-3">
                    {asg.description || 'No description provided.'}
                  </p>

                  <div className="space-y-1.5 text-xs text-gray-400">
                    <div className="flex items-center justify-between">
                      <span>Due Date:</span>
                      <span className={isDuePassed ? 'text-amber-400 font-medium' : 'text-gray-300'}>
                        {asg.due_date ? new Date(asg.due_date).toLocaleDateString() : 'No deadline'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Submissions:</span>
                      <span className="text-sky-400 font-medium">{submitted} / {total}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Graded:</span>
                      <span className="text-emerald-400 font-medium">{graded} / {total}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-800 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${total > 0 ? (graded / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => openGradingModal(asg)}
                    className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white
                               text-xs font-semibold shadow-md shadow-sky-900/30 transition-all text-center"
                  >
                    🏆 Grade Submissions
                  </button>
                  <button
                    onClick={() => handleDeleteAssignment(asg.id)}
                    className="p-2 rounded-xl bg-gray-800 hover:bg-red-950/60 text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-800 transition-colors"
                    title="Delete Assignment"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Create Assignment ───────────────────────────────── */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="📝 Create New Assignment"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Course Offering
            </label>
            <select
              value={newOfferingId}
              onChange={e => setNewOfferingId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-sky-500"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Assignment Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Lab 2: Binary Search Trees"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Description / Instructions
            </label>
            <textarea
              rows={3}
              placeholder="Provide assignment guidelines, rubric, or submission details..."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Due Date (Optional)
              </label>
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Max Score (Points)
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                required
                value={newMaxScore}
                onChange={e => setNewMaxScore(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl text-gray-400 hover:text-white text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Submissions & Grading ───────────────────────────── */}
      <Modal
        isOpen={!!activeAssignment}
        onClose={() => setActiveAssignment(null)}
        title={activeAssignment ? `🏆 Grade Submissions: ${activeAssignment.title}` : ''}
      >
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-gray-800">
            <span>Course: <strong className="text-white">{activeAssignment?.course_code}</strong></span>
            <span>Max Score: <strong className="text-sky-400">{activeAssignment?.max_score} pts</strong></span>
          </div>

          {gradingLoading ? (
            <div className="py-8 text-center text-gray-500 text-xs">Loading student submissions...</div>
          ) : submissionsData.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-xs">
              No students enrolled in this course offering.
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {submissionsData.map(st => {
                const gradeState = studentGrades[st.student_id] || { score: '', feedback: '', saving: false };
                const hasSubmission = !!st.submitted_at;
                const isGraded = st.graded_at !== null;

                return (
                  <div
                    key={st.student_id}
                    className="p-4 rounded-xl bg-gray-800/60 border border-gray-700/60 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800 text-sky-300 font-bold text-xs flex items-center justify-center">
                          {st.student_name[0]}
                        </div>
                        <div>
                          <div className="text-white text-xs font-bold">{st.student_name}</div>
                          <div className="text-gray-400 text-[11px]">{st.student_email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {hasSubmission ? (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800">
                            ✓ Submitted {new Date(st.submitted_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                            No submission yet
                          </span>
                        )}

                        {isGraded && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-sky-950/70 text-sky-300 border border-sky-800">
                            Score: {st.score}/{activeAssignment?.max_score}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Grading Form Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-center">
                      <div>
                        <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-1">
                          Score (0 - {activeAssignment?.max_score})
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={activeAssignment?.max_score}
                          placeholder="Score"
                          value={gradeState.score}
                          onChange={e =>
                            setStudentGrades(prev => ({
                              ...prev,
                              [st.student_id]: { ...prev[st.student_id], score: e.target.value },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-xs focus:outline-none focus:border-sky-500 font-mono"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-1">
                          Feedback / Comments
                        </label>
                        <input
                          type="text"
                          placeholder="Feedback (e.g. Great work, watch out for edge cases)"
                          value={gradeState.feedback}
                          onChange={e =>
                            setStudentGrades(prev => ({
                              ...prev,
                              [st.student_id]: { ...prev[st.student_id], feedback: e.target.value },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-xs focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={gradeState.saving}
                          onClick={() => handleSaveStudentGrade(st.student_id)}
                          className="w-full mt-auto py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          {gradeState.saving ? 'Saving...' : 'Save Grade'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-gray-800 flex justify-end">
            <button
              onClick={() => setActiveAssignment(null)}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
