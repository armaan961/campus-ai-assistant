/**
 * StudentDashboard.jsx
 * ────────────────────
 * Phases 5, 6, 7 Student Dashboard shell with real sub-routes:
 *  - /student          → StudentOverview (metrics, quick links, announcements)
 *  - /student/courses  → StudentCoursesPage (enrolled courses, syllabi, submit work)
 *  - /student/grades   → StudentGradesPage (grades report & assignment feedback)
 *  - /student/attend   → StudentAttendancePage (attendance rates & history)
 *  - /student/ai       → AiStudyPage (core RAG chat, document ingest, 5 study modes)
 */

import { useState } from 'react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import StudentOverview      from './StudentOverview';
import StudentCoursesPage   from './StudentCoursesPage';
import StudentGradesPage    from './StudentGradesPage';
import StudentAttendancePage from './StudentAttendancePage';
import AiStudyPage          from './AiStudyPage';

const NAV_ITEMS = [
  { to: '/student',          icon: '📊', label: 'Overview'    },
  { to: '/student/courses',  icon: '📚', label: 'My Courses'  },
  { to: '/student/grades',   icon: '🏆', label: 'Grades'      },
  { to: '/student/attend',   icon: '✅', label: 'Attendance'  },
  { to: '/student/ai',       icon: '🤖', label: 'AI Study'    },
];

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`flex flex-col bg-gray-900 border-r border-gray-800
                    transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}
      >
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🎓</span>
          </div>
          {!collapsed && (
            <div>
              <div className="text-white font-bold text-sm leading-tight">Campus AI</div>
              <div className="text-emerald-400 text-xs font-medium">Student Portal</div>
            </div>
          )}
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/student'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                 transition-all duration-150
                 ${isActive
                   ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50'
                   : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                 }`
              }
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-4 border-t border-gray-800 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-800">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center
                              text-white text-xs font-bold flex-shrink-0">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <div className="text-white text-xs font-semibold truncate">{user?.name}</div>
                <div className="text-emerald-400 text-xs capitalize">{user?.role}</div>
              </div>
            </div>
          )}
          <button
            id="sidebar-logout"
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm
                       text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-all"
          >
            <span className="text-base flex-shrink-0">🚪</span>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        <button
          id="sidebar-collapse"
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center justify-center p-3 border-t border-gray-800
                     text-gray-500 hover:text-gray-300 transition-colors text-sm"
        >
          {collapsed ? '→' : '←'}
        </button>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-sm
                           border-b border-gray-800 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Student Portal</h1>
            <p className="text-gray-500 text-xs">Learn, study & grow</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-900
                          border border-gray-800 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span>{user?.name}</span>
          </div>
        </header>

        <div className="p-8">
          <Routes>
            <Route index element={<StudentOverview />} />
            <Route path="courses" element={<StudentCoursesPage />} />
            <Route path="grades"  element={<StudentGradesPage />} />
            <Route path="attend"  element={<StudentAttendancePage />} />
            <Route path="ai"      element={<AiStudyPage />} />
            <Route path="*"       element={<Navigate to="/student" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
