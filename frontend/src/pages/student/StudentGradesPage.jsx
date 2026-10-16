/**
 * StudentGradesPage.jsx
 * ─────────────────────
 * Student academic grades report:
 *  - Official course final grades & credits earned
 *  - Detailed assignment-by-assignment marks and percentage bars
 *  - Written instructor feedback
 */

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../components/Toast';

export default function StudentGradesPage() {
  const toast = useToast();

  const [data, setData] = useState({ courses: [], assignments: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGrades() {
      try {
        setLoading(true);
        const res = await api.get('/student/grades');
        setData(res.data);
      } catch {
        toast.error('Failed to load grades.');
      } finally {
        setLoading(false);
      }
    }
    loadGrades();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 gap-3">
        <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading your grades report...</span>
      </div>
    );
  }

  const courses = data.courses || [];
  const assignments = data.assignments || [];

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Academic Grade Report</h2>
          <p className="text-gray-400 text-xs">
            Review official semester course grades, assignment feedback, and academic standing.
          </p>
        </div>
      </div>

      {/* ── Official Course Grades Table ───────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white text-sm font-bold flex items-center gap-2">
            <span>🏆</span> Final Course Grades
          </h3>
          <span className="text-xs text-gray-500">Fall 2025 Term</span>
        </div>

        {courses.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            No course grade records available.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-950/70 text-gray-400 uppercase tracking-wider text-[11px] border-b border-gray-800">
              <tr>
                <th className="px-6 py-3 font-semibold">Course Code</th>
                <th className="px-6 py-3 font-semibold">Course Title</th>
                <th className="px-4 py-3 font-semibold">Credits</th>
                <th className="px-6 py-3 font-semibold">Instructor</th>
                <th className="px-6 py-3 font-semibold text-right">Official Final Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {courses.map(c => (
                <tr key={c.enrollment_id} className="hover:bg-gray-850/40 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-emerald-400">{c.code}</td>
                  <td className="px-6 py-4 text-white font-medium">{c.title}</td>
                  <td className="px-4 py-4 text-gray-400">{c.credits} cr</td>
                  <td className="px-6 py-4 text-gray-300">{c.faculty_name}</td>
                  <td className="px-6 py-4 text-right">
                    {c.final_grade ? (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold font-mono text-xs">
                        {c.final_grade}
                      </span>
                    ) : (
                      <span className="text-gray-500 italic">In Progress</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Assignment Scores & Feedback ───────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
          <span>📝</span> Individual Assignment Breakdown
        </h3>

        {assignments.length === 0 ? (
          <p className="text-gray-500 text-xs italic">No assignment submissions recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {assignments.map(asg => {
              const isGraded = asg.score !== null && asg.score !== undefined;
              const percent = isGraded && asg.max_score > 0
                ? Math.round((asg.score / asg.max_score) * 100)
                : null;

              return (
                <div
                  key={asg.assignment_id}
                  className="bg-gray-800/50 border border-gray-750 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        {asg.course_code}
                      </span>
                      <h4 className="text-white font-semibold text-sm">{asg.title}</h4>
                    </div>

                    {asg.feedback && (
                      <p className="text-gray-300 text-xs bg-gray-900/60 p-2 rounded-lg border border-gray-800 mt-2">
                        💬 <em>"{asg.feedback}"</em>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-center">
                    {isGraded ? (
                      <div className="text-right">
                        <div className="text-base font-bold font-mono text-emerald-400">
                          {asg.score} / {asg.max_score} pts
                        </div>
                        <div className="text-xs text-gray-500">
                          {percent}% • Graded on {asg.graded_at ? new Date(asg.graded_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                    ) : asg.submitted_at ? (
                      <span className="text-xs text-sky-400 bg-sky-950/80 border border-sky-800 px-3 py-1 rounded-lg">
                        Submitted • Awaiting Grade
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-3 py-1 rounded-lg">
                        Unsubmitted
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
