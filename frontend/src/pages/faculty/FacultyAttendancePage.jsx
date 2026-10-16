/**
 * FacultyAttendancePage.jsx
 * ─────────────────────────
 * Faculty attendance tracking:
 *  - Select course offering & class date
 *  - History of recorded class dates for quick navigation
 *  - One-click "Mark All Present"
 *  - Visual status toggles (Present / Late / Absent)
 *  - Saves batch records into SQLite attendance table
 */

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../components/Toast';

export default function FacultyAttendancePage() {
  const toast = useToast();

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [students, setStudents] = useState([]);
  const [pastDates, setPastDates] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({}); // { [studentId]: 'present' | 'absent' | 'late' }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load initial faculty courses
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

  // When course or date changes, load attendance sheet
  useEffect(() => {
    if (!selectedCourseId) return;
    loadAttendanceSheet();
  }, [selectedCourseId, date]);

  async function loadAttendanceSheet() {
    try {
      setLoading(true);
      const res = await api.get(`/faculty/attendance?offering_id=${selectedCourseId}&date=${date}`);
      setStudents(res.data.students || []);
      setPastDates(res.data.pastDates || []);

      // Populate local status map
      const map = {};
      (res.data.students || []).forEach(st => {
        map[st.student_id] = st.status || 'present'; // default to present if not marked
      });
      setAttendanceMap(map);
    } catch {
      toast.error('Failed to load attendance sheet.');
    } finally {
      setLoading(false);
    }
  }

  function markAll(status) {
    const updated = {};
    students.forEach(st => {
      updated[st.student_id] = status;
    });
    setAttendanceMap(updated);
  }

  function handleStatusChange(studentId, status) {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: status,
    }));
  }

  async function handleSaveAttendance() {
    if (!selectedCourseId || students.length === 0) return;

    const records = students.map(st => ({
      student_id: st.student_id,
      status: attendanceMap[st.student_id] || 'present',
    }));

    try {
      setSaving(true);
      const res = await api.post('/faculty/attendance', {
        offering_id: parseInt(selectedCourseId),
        date,
        records,
      });
      toast.success(res.data.message || 'Attendance saved successfully!');
      // Refresh past dates
      loadAttendanceSheet();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  }

  const selectedCourse = courses.find(c => c.id.toString() === selectedCourseId);

  // Status metrics for selected date
  const counts = { present: 0, late: 0, absent: 0 };
  Object.values(attendanceMap).forEach(st => {
    if (counts[st] !== undefined) counts[st]++;
  });

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Class Attendance Tracker</h2>
          <p className="text-gray-400 text-xs">
            Mark daily attendance for enrolled students. Records are tied to course offerings and audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveAttendance}
            disabled={saving || students.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500
                       text-white text-xs font-semibold shadow-lg shadow-sky-900/30 transition-all disabled:opacity-50"
          >
            <span>💾</span>
            <span>{saving ? 'Saving...' : 'Save Attendance'}</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar & Controls ──────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Course Offering
            </label>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
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
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Attendance Date
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => markAll('present')}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 text-xs font-medium transition-all"
            >
              ✓ All Present
            </button>
            <button
              onClick={() => markAll('absent')}
              className="flex-1 py-2 px-3 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800/80 text-xs font-medium transition-all"
            >
              ✗ All Absent
            </button>
          </div>
        </div>

        {/* History Pills */}
        {pastDates.length > 0 && (
          <div className="pt-3 border-t border-gray-800/80 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-gray-500 text-xs whitespace-nowrap">Recent dates:</span>
            {pastDates.map(p => (
              <button
                key={p.date}
                onClick={() => setDate(p.date)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all whitespace-nowrap
                  ${p.date === date
                    ? 'bg-sky-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
              >
                {p.date} ({p.present_count}/{p.total_count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Summary Counters ───────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-400">Present</span>
          </div>
          <span className="text-base font-bold text-emerald-400">{counts.present}</span>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-xs text-gray-400">Late</span>
          </div>
          <span className="text-base font-bold text-amber-400">{counts.late}</span>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-xs text-gray-400">Absent</span>
          </div>
          <span className="text-base font-bold text-red-400">{counts.absent}</span>
        </div>
      </div>

      {/* ── Attendance Roster Table ─────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-white text-sm font-bold">
              {selectedCourse ? `${selectedCourse.code} — ${selectedCourse.title}` : 'Student Roster'}
            </h3>
            <span className="text-xs text-gray-500 font-mono">({date})</span>
          </div>
          <span className="text-xs text-gray-400">{students.length} students enrolled</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 gap-3">
            <span className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading attendance data...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">
            No students are currently enrolled in this course offering.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {students.map((st, idx) => {
              const currentStatus = attendanceMap[st.student_id] || 'present';

              return (
                <div
                  key={st.student_id}
                  className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-850/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-5">{idx + 1}.</span>
                    <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 text-sky-400 font-bold text-xs flex items-center justify-center">
                      {st.name[0]}
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">{st.name}</div>
                      <div className="text-gray-500 text-xs">{st.email}</div>
                    </div>
                  </div>

                  {/* Status Toggle Buttons */}
                  <div className="inline-flex rounded-xl bg-gray-950 p-1 border border-gray-800 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleStatusChange(st.student_id, 'present')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all
                        ${currentStatus === 'present'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'text-gray-400 hover:text-emerald-300'
                        }`}
                    >
                      Present
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(st.student_id, 'late')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all
                        ${currentStatus === 'late'
                          ? 'bg-amber-600 text-white shadow'
                          : 'text-gray-400 hover:text-amber-300'
                        }`}
                    >
                      Late
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(st.student_id, 'absent')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all
                        ${currentStatus === 'absent'
                          ? 'bg-red-600 text-white shadow'
                          : 'text-gray-400 hover:text-red-300'
                        }`}
                    >
                      Absent
                    </button>
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
