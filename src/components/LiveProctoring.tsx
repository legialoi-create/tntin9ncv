import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Unlock,
  RotateCcw,
  PlusCircle,
  Send,
  Eye,
  WifiOff,
  Search,
  Filter,
  X,
  UserCheck
} from 'lucide-react';
import { Exam } from '../types';
import { api } from '../services/api';
import { ExamSearchDropdown } from './ExamSearchDropdown';

interface LiveProctoringProps {
  exams: Exam[];
  selectedExamId?: string;
}

export const LiveProctoring: React.FC<LiveProctoringProps> = ({ exams, selectedExamId }) => {
  const [currentExamId, setCurrentExamId] = useState<string>(() => {
    if (selectedExamId && exams.some((e) => e.id === selectedExamId)) return selectedExamId;
    const saved = localStorage.getItem('ncv_selected_exam_id');
    if (saved && exams.some((e) => e.id === saved)) return saved;
    const preferred = exams.length > 0 ? exams[0] : null;
    return preferred ? preferred.id : '';
  });
  const [proctorData, setProctorData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>(() => new Date().toLocaleTimeString('vi-VN'));

  // Synchronize currentExamId with selectedExamId and valid exams list
  useEffect(() => {
    if (selectedExamId && exams.some((e) => e.id === selectedExamId)) {
      setCurrentExamId(selectedExamId);
      localStorage.setItem('ncv_selected_exam_id', selectedExamId);
    } else if (exams.length > 0) {
      const savedId = localStorage.getItem('ncv_selected_exam_id');
      if (savedId && exams.some((e) => e.id === savedId)) {
        setCurrentExamId(savedId);
      } else {
        const preferred = exams[0];
        setCurrentExamId(preferred.id);
        localStorage.setItem('ncv_selected_exam_id', preferred.id);
      }
    } else {
      setCurrentExamId('');
      setProctorData(null);
    }
  }, [selectedExamId, exams]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Violation modal
  const [viewingViolationsStudent, setViewingViolationsStudent] = useState<any | null>(null);

  // Action status feedback
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchProctorData = async (showLoading = false) => {
    if (!currentExamId) {
      return;
    }
    if (showLoading) setIsLoading(true);
    try {
      const data = await api.getProctorData(currentExamId);
      if (data) {
        setProctorData(data);
        setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
      }
    } catch (err: any) {
      console.warn('Proctor data warning:', currentExamId, err?.message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentExamId) {
      fetchProctorData(true);
    }
  }, [currentExamId, exams]);

  // Instant cross-tab & live updates listener
  useEffect(() => {
    const handleSync = () => {
      fetchProctorData(false);
    };
    window.addEventListener('ncv_submission_update', handleSync);
    window.addEventListener('ncv_student_started', handleSync);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('ncv_broadcast_sync');
      bc.onmessage = () => {
        handleSync();
      };
    } catch (e) {}

    return () => {
      window.removeEventListener('ncv_submission_update', handleSync);
      window.removeEventListener('ncv_student_started', handleSync);
      if (bc) bc.close();
    };
  }, [currentExamId]);

  // Execute teacher action
  const handleAction = async (sessionId: string, action: 'unlock' | 'retake' | 'extend_time' | 'force_submit', value?: any) => {
    try {
      const res = await api.proctorAction({ sessionId, action, value });
      setActionMessage(res.message || 'Thao tác thành công');
      setTimeout(() => setActionMessage(null), 4000);
      fetchProctorData(false);
    } catch (err: any) {
      setActionMessage('⚠️ Lỗi thao tác: ' + (err.message || 'Vui lòng thử lại'));
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const students = proctorData?.students || [];

  // Filter students
  const filteredStudents = students.filter((s: any) => {
    if (!s) return false;
    const nameStr = String(s.studentName || s.name || '').toLowerCase();
    const sbdStr = String(s.sbd || '').toLowerCase();
    const query = searchQuery.trim().toLowerCase();
    const matchSearch = !query || nameStr.includes(query) || sbdStr.includes(query);
    const cls = String(s.studentClass || s.class || '');
    const matchClass = filterClass === 'ALL' || cls === filterClass;
    const matchStatus = filterStatus === 'ALL' || s.status === filterStatus;
    return matchSearch && matchClass && matchStatus;
  });

  const classList = Array.from(new Set(students.map((s: any) => String(s.studentClass || s.class || '')).filter(Boolean))) as string[];

  // Counts
  const inProgressCount = students.filter((s: any) => s.status === 'in_progress').length;
  const submittedCount = students.filter((s: any) => s.status === 'submitted').length;
  const lockedCount = students.filter((s: any) => s.status === 'locked').length;
  const disconnectedCount = students.filter((s: any) => s.status === 'disconnected').length;
  const violationTotal = students.reduce((acc: number, s: any) => acc + (s.violationCount || 0), 0);

  const formatSeconds = (secs: number) => {
    if (secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (exams.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center max-w-md mx-auto my-8">
        <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800 mb-1">Chưa có bài kiểm tra nào</h3>
        <p className="text-xs text-slate-500 mb-2">
          Hãy tạo đề thi ở mục "1. Đề kiểm tra" để bắt đầu theo dõi và giám sát trực tiếp phòng thi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Giám sát trực tiếp phòng thi
            </h2>
            <p className="text-xs text-slate-500">
              Cập nhật thời gian thực học sinh làm bài, phát hiện chuyển tab và chống gian lận
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Select Exam with search & dropdown */}
          <ExamSearchDropdown
            exams={exams}
            currentExamId={currentExamId}
            onSelectExam={(id) => setCurrentExamId(id)}
            size="md"
            label="Kỳ thi:"
          />

          {/* Manual mode indicator badge */}
          <span className="px-3 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>Thủ công (0 lượt tải ngầm)</span>
          </span>

          {/* Manual refresh button */}
          <button
            onClick={() => fetchProctorData(true)}
            disabled={isLoading}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-xs active:scale-98"
            title="Bấm để tải và làm mới danh sách phòng thi ngay lập tức"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Đang tải...' : 'Làm mới phòng thi'}</span>
          </button>
        </div>

        {/* Real-time zero-waste status bar */}
        <div className="w-full flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 gap-2">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Vừa cập nhật: <b className="text-slate-800">{lastUpdated}</b></span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
              Lưu trữ vĩnh viễn trên Cloud Firestore
            </span>
          </div>
          <div className="text-slate-500 font-medium">
            Tối ưu 100+ học sinh: Học sinh làm bài lưu cục bộ, chỉ ghi Cloud khi nộp bài (~2 lượt/em)
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Metric summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Đang làm bài</div>
          <div className="text-2xl font-black text-indigo-600 mt-1">{inProgressCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Đã nộp bài</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{submittedCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Bị khóa do vi phạm</div>
          <div className="text-2xl font-black text-red-600 mt-1">{lockedCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Mất kết nối</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{disconnectedCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Tổng lượt cảnh báo</div>
          <div className="text-2xl font-black text-purple-600 mt-1">{violationTotal}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo họ tên hoặc SBD..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer"
          >
            <option value="ALL">Tất cả lớp</option>
            {classList.map((c) => (
              <option key={c} value={c}>
                Lớp {c}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="in_progress">Đang làm</option>
            <option value="submitted">Đã nộp</option>
            <option value="locked">Bị khóa</option>
            <option value="disconnected">Mất kết nối</option>
          </select>
        </div>
      </div>

      {/* Proctoring Table - EXACT COLUMNS REQUIRED */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">STT</th>
                <th className="py-3.5 px-4">Họ và tên</th>
                <th className="py-3.5 px-4">Lớp</th>
                <th className="py-3.5 px-4 text-center">Đã làm</th>
                <th className="py-3.5 px-4 text-center">Thời gian còn</th>
                <th className="py-3.5 px-4 text-center">Vi phạm</th>
                <th className="py-3.5 px-4 text-center">Trạng thái</th>
                <th className="py-3.5 px-4 text-right">Thao tác của Giáo viên</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Chưa có học sinh nào tham gia kiểm tra bài này
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s: any, idx: number) => {
                  const isLocked = s.status === 'locked';
                  const isSubmitted = s.status === 'submitted';
                  const isDisconnected = s.status === 'disconnected';

                  return (
                    <tr
                      key={s.sessionId}
                      className={`hover:bg-slate-50/80 transition ${
                        isLocked ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-mono font-medium text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{s.studentName}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Lần {s.attemptNumber || 1}/{s.maxAttempts || 1}
                          </span>
                        </div>
                        {s.sbd && (
                          <div className="text-[11px] text-slate-400">SBD: {s.sbd}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {s.studentClass}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-800">
                          {s.answeredCount}
                        </span>
                        <span className="text-slate-400"> / {s.totalQuestions}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                        {isSubmitted ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          formatSeconds(s.remainingSeconds)
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {s.violationCount > 0 ? (
                          <button
                            onClick={() => setViewingViolationsStudent(s)}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 transition cursor-pointer"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>{s.violationCount} lần</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isSubmitted ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3" />
                            <span>Đã nộp ({s.score !== undefined ? s.score : (s.bestScore !== undefined ? s.bestScore : 0)}đ)</span>
                          </span>
                        ) : isLocked ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 animate-pulse">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Bị khóa</span>
                          </span>
                        ) : isDisconnected ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            <WifiOff className="w-3 h-3" />
                            <span>Mất kết nối</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping inline-block"></span>
                            <span>Đang làm</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Unlock Button if locked */}
                          {isLocked && (
                            <button
                              onClick={() => handleAction(s.sessionId, 'unlock')}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center space-x-1 transition cursor-pointer"
                              title="Mở khóa cho học sinh tiếp tục"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>Mở khóa</span>
                            </button>
                          )}

                          {/* Extend Time Button (+5 min) */}
                          {!isSubmitted && (
                            <button
                              onClick={() => handleAction(s.sessionId, 'extend_time', 5)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium flex items-center space-x-1 transition cursor-pointer"
                              title="Gia hạn thêm 5 phút"
                            >
                              <PlusCircle className="w-3 h-3 text-indigo-600" />
                              <span>+5p</span>
                            </button>
                          )}

                          {/* Allow Retake */}
                          <button
                            onClick={() => handleAction(s.sessionId, 'retake')}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium flex items-center space-x-1 transition cursor-pointer"
                            title="Cho phép làm lại bài"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-600" />
                            <span>Thi lại</span>
                          </button>

                          {/* Force Submit */}
                          {!isSubmitted && (
                            <button
                              onClick={() => handleAction(s.sessionId, 'force_submit')}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium flex items-center space-x-1 transition cursor-pointer"
                              title="Thu bài ngay"
                            >
                              <Send className="w-3 h-3 text-emerald-600" />
                              <span>Thu bài</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Violation History Modal */}
      {viewingViolationsStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">
                  Nhật ký vi phạm quy chế
                </h3>
              </div>
              <button
                onClick={() => setViewingViolationsStudent(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <p>
                <b>Họ và tên:</b> {viewingViolationsStudent.studentName}
              </p>
              <p>
                <b>Lớp:</b> {viewingViolationsStudent.studentClass}
              </p>
              <p>
                <b>Tổng số vi phạm:</b>{' '}
                <span className="font-bold text-red-600">
                  {viewingViolationsStudent.violationCount} lần
                </span>
              </p>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 text-xs">
              {viewingViolationsStudent.violations?.length === 0 ? (
                <p className="text-slate-400 text-center py-4">Chưa có vi phạm</p>
              ) : (
                viewingViolationsStudent.violations.map((v: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-red-100 bg-red-50/60 flex items-start space-x-2"
                  >
                    <span className="w-5 h-5 rounded-full bg-red-200 text-red-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <div className="font-semibold text-red-900">
                        {v.description || v.type}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(v.timestamp).toLocaleTimeString('vi-VN')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end space-x-2">
              {viewingViolationsStudent.status === 'locked' && (
                <button
                  onClick={() => {
                    handleAction(viewingViolationsStudent.sessionId, 'unlock');
                    setViewingViolationsStudent(null);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Mở khóa bài thi
                </button>
              )}
              <button
                onClick={() => setViewingViolationsStudent(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
