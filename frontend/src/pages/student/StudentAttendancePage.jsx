/**
 * StudentAttendancePage.jsx
 * ─────────────────────────
 * Student attendance report:
 *  - Course-by-course attendance summary with percentage bars
 *  - Chronological daily attendance activity records
 *  - Clear status badges (Present, Late, Absent)
 */

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../components/Toast';

export default function StudentAttendancePage() {
  const toast = useToast();

  const [data, setData] = useState({ summary: [], records: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAttendance() {
      try {
        setLoading(true);
        const res = await api.get('/student/attendance');
        setData(res.data);
      } catch {
        toast.error('Failed to load attendance records.');
      } finally {
        setLoading(false);
      }
    }
    loadAttendance();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 gap-3">
        <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading attendance records...</span>
      </div>
    );
  }

  const summary = data.summary || [];
  const records = data.records || [];

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Class Attendance Record</h2>
          <p className="text-gray-400 text-xs">
            Track your class presence, attendance percentages, and historical dates across all courses.
          </p>
        </div>
      </div>

      {/* ── Course Attendance Summary Cards ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {summary.map(course => {
          const total = course.total_sessions || 0;
          const present = course.present_count || 0;
          const late = course.late_count || 0;
          const absent = course.absent_count || 0;
          const rate = total > 0 ? Math.round((present / total) * 100) : 100;

          return (
            <div
              key={course.offering_id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                    {course.code}
                  </span>
                  <span className={`text-base font-bold font-mono ${rate >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {rate}%
                  </span>
                </div>
                <h3 className="text-white font-bold text-sm">{course.title}</h3>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${rate >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${rate}%` }}
                />
              </div>

              {/* Counts */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800 text-center text-xs">
                <div className="p-1.5 rounded-lg bg-gray-800/60">
                  <div className="text-emerald-400 font-bold">{present}</div>
                  <div className="text-[10px] text-gray-500">Present</div>
                </div>
                <div className="p-1.5 rounded-lg bg-gray-800/60">
                  <div className="text-amber-400 font-bold">{late}</div>
                  <div className="text-[10px] text-gray-500">Late</div>
                </div>
                <div className="p-1.5 rounded-lg bg-gray-800/60">
                  <div className="text-red-400 font-bold">{absent}</div>
                  <div className="text-[10px] text-gray-500">Absent</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Chronological Attendance Log ───────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white text-sm font-bold flex items-center gap-2">
            <span>📅</span> Daily Class Attendance History
          </h3>
          <span className="text-xs text-gray-400">{records.length} records logged</span>
        </div>

        {records.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            No daily attendance dates have been logged by instructors yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {records.map(rec => (
              <div
                key={rec.id}
                className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-850/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-gray-400 bg-gray-800 px-2 py-1 rounded">
                    {rec.date}
                  </span>
                  <div>
                    <span className="text-white font-medium text-xs mr-2">{rec.course_code}</span>
                    <span className="text-gray-400 text-xs">{rec.course_title}</span>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${
                    rec.status === 'present'
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700'
                      : rec.status === 'late'
                      ? 'bg-amber-950/70 text-amber-300 border-amber-700'
                      : 'bg-red-950/70 text-red-300 border-red-700'
                  }`}
                >
                  {rec.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
