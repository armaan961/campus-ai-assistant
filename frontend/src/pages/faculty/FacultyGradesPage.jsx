/**
 * FacultyGradesPage.jsx
 * ─────────────────────
 * Faculty course gradebook:
 *  - Comprehensive roster with scores across all assignments
 *  - Average / percentage calculation
 *  - Final course grade assignment (A, B+, C, etc.)
 *  - Inline editing and saving of final grades
 */

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../components/Toast';

const GRADE_PRESETS = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F', 'Pass', 'Fail'];

export default function FacultyGradesPage() {
  const toast = useToast();

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [gradebook, setGradebook] = useState({ assignments: [], students: [] });
  const [loading, setLoading] = useState(true);

  // Local state for editing grades: { [enrollmentId]: { grade, saving } }
  const [finalGrades, setFinalGrades] = useState({});

  useEffect(() => {
    api.get('/faculty/courses')
      .then(res => {
        setCourses(res.data);
        if (res.data.length > 0) {
          setSelectedCourseId(res.data[0].id.toString());
        }
      })
      .catch(() => toast.error('Failed to load courses.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    loadGradebook();
  }, [selectedCourseId]);

  async function loadGradebook() {
    try {
      setLoading(true);
      const res = await api.get(`/faculty/grades?offering_id=${selectedCourseId}`);
      setGradebook(res.data);

      const map = {};
      (res.data.students || []).forEach(st => {
        map[st.enrollment_id] = {
          grade: st.final_grade || '',
          saving: false,
        };
      });
      setFinalGrades(map);
    } catch {
      toast.error('Failed to load gradebook.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateGrade(enrollmentId, gradeValue) {
    try {
      setFinalGrades(prev => ({
        ...prev,
        [enrollmentId]: { ...prev[enrollmentId], grade: gradeValue, saving: true },
      }));

      await api.patch(`/faculty/enrollments/${enrollmentId}/grade`, {
        grade: gradeValue.trim() || null,
      });

      toast.success('Grade updated!');
      setGradebook(prev => ({
        ...prev,
        students: prev.students.map(s =>
          s.enrollment_id === enrollmentId ? { ...s, final_grade: gradeValue.trim() } : s
        ),
      }));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update grade.');
    } finally {
      setFinalGrades(prev => ({
        ...prev,
        [enrollmentId]: { ...prev[enrollmentId], saving: false },
      }));
    }
  }

  const selectedCourse = courses.find(c => c.id.toString() === selectedCourseId);
  const assignments = gradebook.assignments || [];
  const students = gradebook.students || [];

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Course Gradebook</h2>
          <p className="text-gray-400 text-xs">
            Review assignment scores across the semester and finalize official course letter grades.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 text-xs focus:outline-none focus:border-sky-500"
          >
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Gradebook Table ────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-white text-sm font-bold">
              {selectedCourse ? `${selectedCourse.code} Grade Sheet` : 'Gradebook'}
            </h3>
            <span className="text-xs text-gray-400">• {students.length} students enrolled</span>
          </div>
          <span className="text-xs text-gray-500">{assignments.length} assignments tracked</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 gap-3">
            <span className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading gradebook...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">
            No students enrolled in this course offering.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-950/70 text-gray-400 uppercase tracking-wider text-[11px] border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3 font-semibold">Student</th>
                  {assignments.map(a => (
                    <th key={a.id} className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                      <div>{a.title}</div>
                      <div className="text-[10px] text-gray-500 font-mono">({a.max_score} pts)</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-center">Avg %</th>
                  <th className="px-6 py-3 font-semibold text-right">Official Final Grade</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-800">
                {students.map(st => {
                  const state = finalGrades[st.enrollment_id] || { grade: '', saving: false };

                  // Compute average assignment percentage
                  let totalPossible = 0;
                  let totalEarned = 0;
                  assignments.forEach(a => {
                    const score = st.scores?.[a.id];
                    if (score !== undefined && score !== null) {
                      totalEarned += score;
                      totalPossible += a.max_score;
                    }
                  });
                  const avgPercent = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : null;

                  return (
                    <tr key={st.student_id} className="hover:bg-gray-850/40 transition-colors">
                      {/* Student info */}
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800 text-sky-400 font-bold text-xs flex items-center justify-center">
                            {st.name[0]}
                          </div>
                          <div>
                            <div className="text-white font-medium text-xs">{st.name}</div>
                            <div className="text-gray-500 text-[11px]">{st.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Individual assignment scores */}
                      {assignments.map(a => {
                        const score = st.scores?.[a.id];
                        return (
                          <td key={a.id} className="px-4 py-3.5 text-center font-mono whitespace-nowrap">
                            {score !== undefined && score !== null ? (
                              <span className="text-sky-300 font-semibold">{score}</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Average */}
                      <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap">
                        {avgPercent !== null ? (
                          <span className={`font-bold ${avgPercent >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {avgPercent}%
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                      {/* Final Grade Selector / Input */}
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <select
                            value={state.grade}
                            disabled={state.saving}
                            onChange={e => handleUpdateGrade(st.enrollment_id, e.target.value)}
                            className="px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs font-semibold focus:outline-none focus:border-sky-500"
                          >
                            <option value="">Ungraded</option>
                            {GRADE_PRESETS.map(g => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                          {state.saving && (
                            <span className="w-3.5 h-3.5 border border-sky-400 border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
