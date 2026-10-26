import React, { useState, useEffect } from 'react';
import {
  FileText,
  ShieldAlert,
  BarChart3,
  School,
  Database,
  LogOut,
  Sparkles,
  BookOpen,
  UserCheck,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  ShieldCheck,
  RotateCw
} from 'lucide-react';
import { Exam } from '../types';
import { api } from '../services/api';
import { ExamManager } from './ExamManager';
import { LiveProctoring } from './LiveProctoring';
import { ExamReports } from './ExamReports';
import { ClassManager } from './ClassManager';
import { BackupRestore } from './BackupRestore';
import { AiExamParserModal } from './AiExamParserModal';

interface TeacherDashboardProps {
  onLogout: () => void;
  onGoToStudentMode: (examCode?: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onLogout,
  onGoToStudentMode,
}) => {
  const [activeTab, setActiveTab] = useState<'exams' | 'proctor' | 'reports' | 'classes' | 'backup'>('exams');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    return localStorage.getItem('ncv_selected_exam_id') || '';
  });
  const [showAiParser, setShowAiParser] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [classesList, setClassesList] = useState<string[]>([]);

  // Change Admin Password Modal state
  const [showChangeAdminPasswordModal, setShowChangeAdminPasswordModal] = useState(false);
  const [adminCurrentPass, setAdminCurrentPass] = useState('');
  const [adminNewPass, setAdminNewPass] = useState('');
  const [adminConfirmPass, setAdminConfirmPass] = useState('');
  const [showAdminPassToggle, setShowAdminPassToggle] = useState(false);
  const [isAdminPassLoading, setIsAdminPassLoading] = useState(false);
  const [adminPassFeedback, setAdminPassFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPassFeedback(null);

    if (adminNewPass.length < 6) {
      setAdminPassFeedback({
        type: 'error',
        message: 'Mật khẩu mới của giáo viên phải có ít nhất 6 ký tự để đảm bảo an toàn',
      });
      return;
    }

    if (adminNewPass !== adminConfirmPass) {
      setAdminPassFeedback({
        type: 'error',
        message: 'Mật khẩu xác nhận không khớp với mật khẩu mới',
      });
      return;
    }

    setIsAdminPassLoading(true);
    try {
      const res = await api.changeTeacherPassword(adminCurrentPass, adminNewPass);
      setAdminPassFeedback({
        type: 'success',
        message: res.message || 'Đã đổi mật khẩu Giáo viên (Admin) thành công!',
      });
      setAdminCurrentPass('');
      setAdminNewPass('');
      setAdminConfirmPass('');
      setTimeout(() => {
        setShowChangeAdminPasswordModal(false);
        setAdminPassFeedback(null);
      }, 3000);
    } catch (err: any) {
      setAdminPassFeedback({
        type: 'error',
        message: err.message || 'Lỗi đổi mật khẩu, vui lòng kiểm tra lại mật khẩu hiện tại',
      });
    } finally {
      setIsAdminPassLoading(false);
    }
  };

  const loadExams = async () => {
    try {
      const data = await api.getExams(true);
      setExams(data);
      if (data.length > 0) {
        const savedId = localStorage.getItem('ncv_selected_exam_id');
        if (savedId && data.some((e) => e.id === savedId)) {
          setSelectedExamId(savedId);
        } else {
          const mainExam = data[0];
          setSelectedExamId(mainExam ? mainExam.id : '');
          if (mainExam) {
            localStorage.setItem('ncv_selected_exam_id', mainExam.id);
          } else {
            localStorage.removeItem('ncv_selected_exam_id');
          }
        }
      } else {
        setSelectedExamId('');
      }
    } catch (err) {
      console.error('Failed to load exams:', err);
    }
  };

  const loadClasses = async () => {
    try {
      const cls = await api.getClasses();
      setClassesList(cls.map((c) => c.name));
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  };

  useEffect(() => {
    loadExams();
    loadClasses();

    const handleFocus = () => {
      loadExams();
      loadClasses();
    };

    const handleExamDeleted = (e: any) => {
      loadExams();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('ncv_exam_deleted', handleExamDeleted);
    const handleVisibility = () => {
      if (!document.hidden) handleFocus();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('ncv_broadcast_sync');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'EXAM_DELETED') {
          loadExams();
        }
      };
    } catch (e) {}

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('ncv_exam_deleted', handleExamDeleted);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (bc) bc.close();
    };
  }, []);

  const handleOpenProctor = (examId: string) => {
    setSelectedExamId(examId);
    localStorage.setItem('ncv_selected_exam_id', examId);
    setActiveTab('proctor');
  };

  const handleOpenReports = (examId: string) => {
    setSelectedExamId(examId);
    localStorage.setItem('ncv_selected_exam_id', examId);
    setActiveTab('reports');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Teacher Header Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-inner">
              NCV
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-indigo-400">
                  TRƯỜNG THCS NAM CỬA VIỆT
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded-full font-semibold">
                  Tài khoản Quản trị
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white">
                Bàn làm việc Giáo viên • Thầy Lê Gia Lợi
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Cloud Storage Status (Vercel Persistent Storage) */}
            <div
              className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-[11px] font-semibold text-emerald-300"
              title="Dữ liệu đề thi, danh sách học sinh và kết quả bài làm được lưu trữ vĩnh viễn trên Cloud Firestore và tự động khôi phục tức thì trên Vercel"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Lưu vĩnh viễn (Cloud Firestore)</span>
            </div>

            <button
              onClick={() => setShowChangeAdminPasswordModal(true)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 border border-slate-700"
              title="Đổi mật khẩu tài khoản Giáo viên (Admin)"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Đổi MK Admin</span>
            </button>

            <button
              onClick={() => onGoToStudentMode()}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 border border-slate-700"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Chuyển sang Giao diện Học sinh</span>
            </button>

            <button
              onClick={onLogout}
              className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/60 text-red-300 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 border border-red-900/50"
              title="Đăng xuất"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 flex space-x-1 overflow-x-auto text-xs font-bold pt-1">
          <button
            onClick={() => setActiveTab('exams')}
            className={`py-2.5 px-4 border-b-2 flex items-center space-x-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'exams'
                ? 'border-indigo-400 text-white bg-slate-800/80 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. Đề kiểm tra ({exams.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('proctor')}
            className={`py-2.5 px-4 border-b-2 flex items-center space-x-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'proctor'
                ? 'border-indigo-400 text-white bg-slate-800/80 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>2. Giám sát trực tiếp</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`py-2.5 px-4 border-b-2 flex items-center space-x-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'reports'
                ? 'border-indigo-400 text-white bg-slate-800/80 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>3. Kết quả & Xuất Excel</span>
          </button>

          <button
            onClick={() => setActiveTab('classes')}
            className={`py-2.5 px-4 border-b-2 flex items-center space-x-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'classes'
                ? 'border-indigo-400 text-white bg-slate-800/80 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <School className="w-4 h-4" />
            <span>4. Quản lý Lớp (6, 7, 8, 9)</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`py-2.5 px-4 border-b-2 flex items-center space-x-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'backup'
                ? 'border-indigo-400 text-white bg-slate-800/80 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>5. Sao lưu dữ liệu</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 flex-1">
        {activeTab === 'exams' && (
          <ExamManager
            exams={exams}
            onRefresh={loadExams}
            onOpenAiParser={() => {
              setEditingExam(null);
              setShowAiParser(true);
            }}
            onEditExam={(exam) => {
              setEditingExam(exam);
              setShowAiParser(true);
            }}
            onOpenProctor={handleOpenProctor}
            onOpenReports={handleOpenReports}
            onTestExam={(examCode) => onGoToStudentMode(examCode)}
          />
        )}

        {activeTab === 'proctor' && (
          <LiveProctoring exams={exams} selectedExamId={selectedExamId} />
        )}

        {activeTab === 'reports' && (
          <ExamReports exams={exams} selectedExamId={selectedExamId} />
        )}

        {activeTab === 'classes' && (
          <ClassManager
            onClassesUpdated={(cls) => setClassesList(cls.map((c) => c.name))}
          />
        )}

        {activeTab === 'backup' && (
          <BackupRestore
            onRestoreSuccess={async () => {
              await loadExams();
              await loadClasses();
            }}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}
      </main>

      {/* AI Exam Parser / Editor Modal */}
      {showAiParser && (
        <AiExamParserModal
          key={editingExam ? editingExam.id : 'create-new-exam'}
          initialExam={editingExam}
          onClose={() => {
            setShowAiParser(false);
            setEditingExam(null);
          }}
          onSaved={() => {
            loadExams();
            setShowAiParser(false);
            setEditingExam(null);
          }}
          classesList={classesList}
        />
      )}

      {/* Change Admin Password Modal */}
      {showChangeAdminPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-7">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Đổi mật khẩu Giáo viên (Admin)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Thầy Lê Gia Lợi • THCS Nam Cửa Việt
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowChangeAdminPasswordModal(false);
                  setAdminPassFeedback(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adminPassFeedback && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 border ${
                  adminPassFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {adminPassFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{adminPassFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleChangeAdminPassword} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Mật khẩu hiện tại
                </label>
                <input
                  type={showAdminPassToggle ? 'text' : 'password'}
                  required
                  value={adminCurrentPass}
                  onChange={(e) => setAdminCurrentPass(e.target.value)}
                  placeholder="Nhập mật khẩu admin hiện tại"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Mật khẩu mới (ít nhất 6 ký tự) <span className="text-red-500">*</span>
                </label>
                <input
                  type={showAdminPassToggle ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={adminNewPass}
                  onChange={(e) => setAdminNewPass(e.target.value)}
                  placeholder="Nhập mật khẩu mới của thầy"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Nhập lại mật khẩu mới <span className="text-red-500">*</span>
                </label>
                <input
                  type={showAdminPassToggle ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={adminConfirmPass}
                  onChange={(e) => setAdminConfirmPass(e.target.value)}
                  placeholder="Xác nhận lại mật khẩu mới"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminPassToggle(!showAdminPassToggle)}
                  className="text-slate-500 hover:text-slate-800 text-xs flex items-center space-x-1 cursor-pointer"
                >
                  {showAdminPassToggle ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showAdminPassToggle ? 'Ẩn ký tự mật khẩu' : 'Hiện ký tự mật khẩu'}</span>
                </button>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Mật khẩu này dùng để đăng nhập vào Bàn làm việc Giáo viên, quản lý đề thi, mở khóa phòng thi và duyệt danh sách lớp. Thầy vui lòng giữ bí mật!
                </p>
              </div>

              <div className="pt-2 flex space-x-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeAdminPasswordModal(false);
                    setAdminPassFeedback(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Đóng
                </button>

                <button
                  type="submit"
                  disabled={isAdminPassLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-200 transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isAdminPassLoading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Lưu mật khẩu mới</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
