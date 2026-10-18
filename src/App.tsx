import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Lock,
  ShieldCheck,
  School,
  GraduationCap,
  Sparkles,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { api, getAuthToken } from './services/api';
import { StudentEntry } from './components/StudentEntry';
import { StudentExamRoom } from './components/StudentExamRoom';
import { TeacherLogin } from './components/TeacherLogin';
import { TeacherDashboard } from './components/TeacherDashboard';

export default function App() {
  const [view, setView] = useState<'student_entry' | 'student_exam' | 'teacher'>('student_entry');
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  const [showTeacherLoginModal, setShowTeacherLoginModal] = useState(false);

  // Active student exam session state
  const [activeSessionData, setActiveSessionData] = useState<any | null>(null);
  const [activeExamInfo, setActiveExamInfo] = useState<any | null>(null);
  const [activeStudentInfo, setActiveStudentInfo] = useState<any | null>(null);

  // Check existing teacher token on mount
  useEffect(() => {
    if (getAuthToken()) {
      api.checkAuth()
        .then((res) => {
          if (res) {
            setIsTeacherLoggedIn(true);
          } else {
            setIsTeacherLoggedIn(false);
          }
        })
        .catch(() => setIsTeacherLoggedIn(false));
    }
  }, []);

  const [selectedExamCodeForStudent, setSelectedExamCodeForStudent] = useState<string>('');

  const handleGoToStudentMode = (examCode?: string) => {
    if (examCode) {
      setSelectedExamCodeForStudent(examCode);
    }
    setView('student_entry');
  };

  const handleStartExam = (sessionData: any, examInfo: any, studentInfo: any) => {
    setActiveSessionData(sessionData);
    setActiveExamInfo(examInfo);
    setActiveStudentInfo(studentInfo);
    setView('student_exam');
  };

  const handleExitExam = () => {
    setActiveSessionData(null);
    setActiveExamInfo(null);
    setActiveStudentInfo(null);
    setView('student_entry');
  };

  const handleTeacherLoginSuccess = (user: any) => {
    setIsTeacherLoggedIn(true);
    setShowTeacherLoginModal(false);
    setView('teacher');
  };

  const handleTeacherLogout = () => {
    api.logout();
    setIsTeacherLoggedIn(false);
    setView('student_entry');
  };

  // If in active student examination room
  if (view === 'student_exam' && activeSessionData && activeExamInfo && activeStudentInfo) {
    return (
      <StudentExamRoom
        sessionData={activeSessionData}
        examInfo={activeExamInfo}
        studentInfo={activeStudentInfo}
        onExit={handleExitExam}
      />
    );
  }

  // If in teacher dashboard
  if (view === 'teacher' && isTeacherLoggedIn) {
    return (
      <TeacherDashboard
        onLogout={handleTeacherLogout}
        onGoToStudentMode={handleGoToStudentMode}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Universal Navbar */}
      <nav className="bg-white border-b border-slate-200/80 px-4 py-2 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black flex items-center justify-center text-xs shadow-sm shadow-indigo-200">
              NCV
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
                  TRƯỜNG THCS NAM CỬA VIỆT
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                  Môn Tin học
                </span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                Hệ thống Kiểm tra Trắc nghiệm Trực tuyến
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isTeacherLoggedIn ? (
              <button
                onClick={() => setView('teacher')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <School className="w-3.5 h-3.5" />
                <span>Bàn làm việc Giáo viên (Thầy Lê Gia Lợi)</span>
              </button>
            ) : (
              <button
                onClick={() => setShowTeacherLoginModal(true)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Giáo viên Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 py-3 sm:py-4 px-3 sm:px-4 flex flex-col justify-start">
        <StudentEntry
          onStartExam={handleStartExam}
          initialExamCode={selectedExamCodeForStudent}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-2.5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px]">
          <div>
            <b>TRƯỜNG THCS NAM CỬA VIỆT</b> — Tin học Khối 6, 7, 8, 9
          </div>
          <div className="text-slate-400">
            Quản trị & Giảng dạy: <b>Thầy Lê Gia Lợi</b> • Phòng thực hành Tin học
          </div>
        </div>
      </footer>

      {/* Teacher Login Modal */}
      {showTeacherLoginModal && (
        <TeacherLogin
          onLoginSuccess={handleTeacherLoginSuccess}
          onCancel={() => setShowTeacherLoginModal(false)}
        />
      )}
    </div>
  );
}
