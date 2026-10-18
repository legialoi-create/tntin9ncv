import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Database,
  RotateCw,
  FileText,
  ShieldAlert,
  BarChart3,
  School,
  ArrowRight,
  Info,
  Layers,
  Sparkles,
  HelpCircle,
  Clock,
  UserCheck
} from 'lucide-react';
import { api } from '../services/api';

interface BackupRestoreProps {
  onRestoreSuccess?: () => void;
  onNavigateTab?: (tab: 'exams' | 'proctor' | 'reports' | 'classes') => void;
}

interface CurrentStats {
  examsCount: number;
  questionsCount: number;
  liveSessionsCount: number;
  completedSessionsCount: number;
  classesCount: number;
  studentsCount: number;
}

interface FilePreview {
  fileName: string;
  fileSizeKb: number;
  exportedAt?: string;
  teacher?: string;
  school?: string;
  examsCount: number;
  questionsCount: number;
  liveSessionsCount: number;
  completedSessionsCount: number;
  classesCount: number;
  studentsCount: number;
  rawParsedData: any;
}

export const BackupRestore: React.FC<BackupRestoreProps> = ({
  onRestoreSuccess,
  onNavigateTab,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [currentStats, setCurrentStats] = useState<CurrentStats | null>(null);

  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    details?: {
      examsCount?: number;
      sessionsCount?: number;
      classesCount?: number;
      studentsCount?: number;
    };
  } | null>(null);

  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load current system stats on mount
  const fetchCurrentStats = async () => {
    setIsLoadingStats(true);
    try {
      const backup = await api.getBackup();
      if (backup && backup.summary) {
        setCurrentStats({
          examsCount: backup.summary.totalExams || 0,
          questionsCount: backup.summary.totalQuestions || 0,
          liveSessionsCount: backup.summary.totalLiveSessions || 0,
          completedSessionsCount: backup.summary.totalCompletedSessions || 0,
          classesCount: backup.summary.totalClasses || 0,
          studentsCount: backup.summary.totalStudents || 0,
        });
      } else if (backup && backup.data) {
        const exams = backup.data.exams || [];
        const sessions = backup.data.sessions || [];
        const live = sessions.filter(
          (s: any) => s.status === 'in_progress' || s.status === 'locked' || s.status === 'disconnected'
        );
        const completed = sessions.filter((s: any) => s.status === 'submitted');
        const qCount = exams.reduce((sum: number, e: any) => sum + (e.questions?.length || 0), 0);
        setCurrentStats({
          examsCount: exams.length,
          questionsCount: qCount,
          liveSessionsCount: live.length,
          completedSessionsCount: completed.length,
          classesCount: (backup.data.classes || []).length,
          studentsCount: (backup.data.students || []).length,
        });
      }
    } catch (err: any) {
      console.warn('Could not load current backup stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchCurrentStats();
  }, []);

  // 1. Download Backup
  const handleDownloadBackup = async () => {
    setIsExporting(true);
    setStatusMsg(null);
    try {
      const data = await api.getBackup();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const todayStr = new Date().toISOString().slice(0, 10);
      a.download = `SaoLuu_TinHoc_NCV_DayDu_4Muc_${todayStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const totalExams = data.summary?.totalExams ?? data.data?.exams?.length ?? 0;
      const totalSessions = data.data?.sessions?.length ?? 0;
      const totalClasses = data.data?.classes?.length ?? 0;
      const totalStudents = data.data?.students?.length ?? 0;

      setStatusMsg({
        type: 'success',
        text: 'Đã xuất và tải xuống tệp sao lưu an toàn! Tệp đã đóng gói trọn vẹn cả 4 mục của hệ thống.',
        details: {
          examsCount: totalExams,
          sessionsCount: totalSessions,
          classesCount: totalClasses,
          studentsCount: totalStudents,
        },
      });

      // Refresh stats
      await fetchCurrentStats();
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: 'Lỗi khi tải tệp sao lưu: ' + (err.message || 'Không thể kết nối máy chủ'),
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Select & Inspect File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawContent = (reader.result as string || '').replace(/^\uFEFF/, '').trim();
        if (!rawContent) {
          throw new Error('Tệp tải lên rỗng');
        }

        const parsed = JSON.parse(rawContent);

        // Analyze and detect items from the parsed JSON
        let exams: any[] = [];
        let sessions: any[] = [];
        let classes: any[] = [];
        let students: any[] = [];

        // Check if sections format
        if (parsed.sections) {
          if (Array.isArray(parsed.sections.muc_1_de_kiem_tra?.exams)) {
            exams = parsed.sections.muc_1_de_kiem_tra.exams;
          }
          if (Array.isArray(parsed.sections.muc_2_giam_sat_truc_tiep?.sessions)) {
            sessions.push(...parsed.sections.muc_2_giam_sat_truc_tiep.sessions);
          }
          if (Array.isArray(parsed.sections.muc_3_ket_qua_xuat_excel?.sessions)) {
            sessions.push(...parsed.sections.muc_3_ket_qua_xuat_excel.sessions);
          }
          if (Array.isArray(parsed.sections.muc_4_quan_ly_lop_va_hoc_sinh?.classes)) {
            classes = parsed.sections.muc_4_quan_ly_lop_va_hoc_sinh.classes;
          }
          if (Array.isArray(parsed.sections.muc_4_quan_ly_lop_va_hoc_sinh?.students)) {
            students = parsed.sections.muc_4_quan_ly_lop_va_hoc_sinh.students;
          }
        }

        // Check if direct data format
        const root = parsed.data || parsed;
        if (Array.isArray(root.exams)) exams = root.exams;
        if (Array.isArray(root.sessions)) sessions = root.sessions;
        if (Array.isArray(root.classes)) classes = root.classes;
        if (Array.isArray(root.students)) students = root.students;

        if (exams.length === 0 && classes.length === 0 && students.length === 0 && sessions.length === 0) {
          throw new Error('Tệp JSON không chứa cấu trúc của 4 mục (Đề thi, Giám sát, Kết quả, Lớp học). Vui lòng chọn đúng tệp sao lưu của hệ thống.');
        }

        const live = sessions.filter(
          (s) => s.status === 'in_progress' || s.status === 'locked' || s.status === 'disconnected'
        );
        const completed = sessions.filter((s) => s.status === 'submitted');
        const qCount = exams.reduce((sum, e) => sum + (e.questions?.length || 0), 0);

        setFilePreview({
          fileName: file.name,
          fileSizeKb: Math.round((file.size / 1024) * 10) / 10,
          exportedAt: parsed.exportedAt || undefined,
          teacher: parsed.teacher || undefined,
          school: parsed.school || undefined,
          examsCount: exams.length,
          questionsCount: qCount,
          liveSessionsCount: live.length,
          completedSessionsCount: completed.length,
          classesCount: classes.length,
          studentsCount: students.length,
          rawParsedData: parsed,
        });
        setStatusMsg(null);
      } catch (err: any) {
        setStatusMsg({
          type: 'error',
          text: 'Tệp không hợp lệ: ' + (err.message || 'Lỗi cú pháp JSON'),
        });
        setFilePreview(null);
      } finally {
        // Reset file input value so user can re-select the same file if needed
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setStatusMsg({
        type: 'error',
        text: 'Không thể đọc tệp từ thiết bị của bạn.',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  // 3. Confirm & Execute Restore
  const handleExecuteRestore = async () => {
    if (!filePreview || !filePreview.rawParsedData) return;

    setIsRestoring(true);
    setStatusMsg(null);

    try {
      const res = await api.restoreBackup(filePreview.rawParsedData);

      setStatusMsg({
        type: 'success',
        text: res.message || 'Khôi phục toàn bộ cơ sở dữ liệu thành công! Cả 4 mục dữ liệu đã được cập nhật đồng bộ.',
        details: res.details || {
          examsCount: filePreview.examsCount,
          sessionsCount: filePreview.liveSessionsCount + filePreview.completedSessionsCount,
          classesCount: filePreview.classesCount,
          studentsCount: filePreview.studentsCount,
        },
      });

      // Clear preview
      setFilePreview(null);

      // Trigger parent update immediately
      if (onRestoreSuccess) {
        await onRestoreSuccess();
      }

      // Refresh current stats display
      await fetchCurrentStats();
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: 'Lỗi khôi phục cơ sở dữ liệu: ' + (err.message || 'Vui lòng kiểm tra lại quyền giáo viên'),
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Trung tâm Sao lưu & Khôi phục dữ liệu
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Đầy đủ 4 Mục
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl leading-relaxed">
                Đóng gói trọn vẹn 100% cơ sở dữ liệu: <strong className="text-white">Mục 1 (Đề thi & câu hỏi)</strong>,{' '}
                <strong className="text-white">Mục 2 (Giám sát trực tiếp)</strong>,{' '}
                <strong className="text-white">Mục 3 (Kết quả & xuất Excel)</strong>,{' '}
                <strong className="text-white">Mục 4 (Quản lý Lớp & Học sinh)</strong>.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowGuide(!showGuide)}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-indigo-100 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer self-start md:self-center border border-white/10"
          >
            <HelpCircle className="w-4 h-4 text-amber-300" />
            <span>{showGuide ? 'Ẩn giải đáp' : 'Giải đáp thắc mắc'}</span>
          </button>
        </div>

        {/* Expandable Guide / FAQ */}
        {showGuide && (
          <div className="mt-5 pt-4 border-t border-indigo-500/20 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-indigo-100">
            <div className="bg-slate-900/80 rounded-xl p-3.5 border border-indigo-500/20 space-y-1.5">
              <h4 className="font-bold text-amber-300 flex items-center space-x-1.5">
                <Clock className="w-4 h-4" />
                <span>1. Đề tải lên có được lưu lâu dài không?</span>
              </h4>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Hệ thống tự động lưu vào tệp dữ liệu máy chủ. Tuy nhiên, sau mỗi lần hoàn thành soạn đề hoặc cập nhật danh sách lớp, thầy/cô nên bấm <strong className="text-white">"TẢI TỆP SAO LƯU (.JSON)"</strong> về máy tính hoặc lưu lên Google Drive cá nhân. Khi cần chuyển máy tính hay sang năm học mới, chỉ cần 1 cú click là khôi phục toàn bộ!
              </p>
            </div>

            <div className="bg-slate-900/80 rounded-xl p-3.5 border border-indigo-500/20 space-y-1.5">
              <h4 className="font-bold text-emerald-300 flex items-center space-x-1.5">
                <UserCheck className="w-4 h-4" />
                <span>2. Chia sẻ cho bạn khác chỉnh sửa môn khác?</span>
              </h4>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Khi bạn khác dùng tài khoản riêng hoặc link riêng để đổi tên thành Vương môn Vật lý, app của thầy/cô tại link này <strong className="text-white">hoàn toàn độc lập và KHÔNG bị ảnh hưởng</strong>. Thầy/cô có thể gửi tệp sao lưu JSON này cho bạn ấy để bạn ấy có sẵn khung dữ liệu hoàn chỉnh.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 4 Items Overview Grid (Current System Status) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Hiện trạng cơ sở dữ liệu (Bao gồm đầy đủ 4 mục)</span>
          </h3>
          <button
            onClick={fetchCurrentStats}
            className="text-[11px] text-slate-500 hover:text-indigo-600 flex items-center space-x-1 font-medium cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin' : ''}`} />
            <span>Làm mới số liệu</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Mục 1 */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-indigo-300 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                Mục 1
              </span>
              <FileText className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Đề kiểm tra & Câu hỏi</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Ngân hàng đề thi, đáp án, ma trận</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-xs text-slate-600 font-medium">Số đề thi:</span>
              <span className="text-base font-extrabold text-slate-900">
                {currentStats ? `${currentStats.examsCount} đề` : '...'}
              </span>
            </div>
          </div>

          {/* Mục 2 */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-red-300 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                Mục 2
              </span>
              <ShieldAlert className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Giám sát trực tiếp</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Phòng thi online & nhật ký vi phạm</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-xs text-slate-600 font-medium">Phiên đang mở:</span>
              <span className="text-base font-extrabold text-slate-900">
                {currentStats ? `${currentStats.liveSessionsCount} phiên` : '...'}
              </span>
            </div>
          </div>

          {/* Mục 3 */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                Mục 3
              </span>
              <BarChart3 className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Kết quả & Xuất Excel</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Bài đã nộp, bảng điểm chi tiết</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-xs text-slate-600 font-medium">Bài đã nộp:</span>
              <span className="text-base font-extrabold text-slate-900">
                {currentStats ? `${currentStats.completedSessionsCount} bài` : '...'}
              </span>
            </div>
          </div>

          {/* Mục 4 */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-purple-300 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                Mục 4
              </span>
              <School className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Quản lý Lớp & Học sinh</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Khối 6, 7, 8, 9, tài khoản & SBD</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-xs text-slate-600 font-medium">Học sinh / Lớp:</span>
              <span className="text-base font-extrabold text-slate-900">
                {currentStats ? `${currentStats.studentsCount} HS / ${currentStats.classesCount} lớp` : '...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Message Banner */}
      {statusMsg && (
        <div
          className={`p-4 sm:p-5 rounded-2xl text-xs sm:text-sm font-semibold flex flex-col space-y-2 border shadow-sm ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : statusMsg.type === 'error'
              ? 'bg-red-50 text-red-900 border-red-300'
              : 'bg-blue-50 text-blue-900 border-blue-300'
          }`}
        >
          <div className="flex items-start space-x-2.5">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : statusMsg.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-bold">{statusMsg.text}</p>
              {statusMsg.details && (
                <div className="mt-2 pt-2 border-t border-emerald-200/70 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-normal">
                  <div className="bg-emerald-100/60 p-2 rounded-lg">
                    <span className="font-bold">Mục 1 (Đề thi):</span> {statusMsg.details.examsCount ?? 0} đề
                  </div>
                  <div className="bg-emerald-100/60 p-2 rounded-lg">
                    <span className="font-bold">Mục 2 & 3 (Phiên thi):</span> {statusMsg.details.sessionsCount ?? 0} phiên
                  </div>
                  <div className="bg-emerald-100/60 p-2 rounded-lg">
                    <span className="font-bold">Mục 4 (Lớp học):</span> {statusMsg.details.classesCount ?? 0} lớp
                  </div>
                  <div className="bg-emerald-100/60 p-2 rounded-lg">
                    <span className="font-bold">Mục 4 (Học sinh):</span> {statusMsg.details.studentsCount ?? 0} em
                  </div>
                </div>
              )}
            </div>
          </div>

          {statusMsg.type === 'success' && onNavigateTab && (
            <div className="mt-2 flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => onNavigateTab('exams')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
              >
                <span>Mở tab 1. Đề kiểm tra</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigateTab('classes')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
              >
                <span>Mở tab 4. Quản lý Lớp</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Action Cards: Download & Upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: EXPORT / DOWNLOAD */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  1. Tải về tệp sao lưu toàn bộ 4 mục
                </h3>
                <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                  Khuyến nghị tải về định kỳ
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Xuất toàn bộ cơ sở dữ liệu thành tệp định dạng JSON chuẩn. Tệp này chứa đầy đủ:
            </p>

            <ul className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span><strong>Mục 1:</strong> Ngân hàng đề thi, câu hỏi, các phương án, đáp án đúng.</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span><strong>Mục 2:</strong> Trực tiếp giám sát phòng thi, nhật ký vi phạm gian lận.</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span><strong>Mục 3:</strong> Kết quả bài nộp của học sinh, bảng điểm, bài làm chi tiết.</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span><strong>Mục 4:</strong> Danh sách các lớp 6, 7, 8, 9 và tài khoản/mật khẩu học sinh.</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={handleDownloadBackup}
              disabled={isExporting}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-indigo-100 disabled:opacity-50"
            >
              {isExporting ? (
                <RotateCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>TẢI TỆP SAO LƯU 4 MỤC (.JSON)</span>
            </button>
            <p className="text-[11px] text-slate-400 text-center mt-2">
              Lưu tệp về máy tính hoặc đưa lên Google Drive để lưu trữ an toàn lâu dài
            </p>
          </div>
        </div>

        {/* Card 2: IMPORT / RESTORE */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  2. Khôi phục dữ liệu từ tệp sao lưu
                </h3>
                <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                  Xem trước và kiểm tra trước khi khôi phục
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Chọn tệp sao lưu định dạng JSON đã lưu trước đó để phục hồi lại hệ thống. Hệ thống hỗ trợ khôi phục trọn vẹn cả 4 mục hoặc từng mục linh hoạt.
            </p>

            {/* File Preview Card if a file was selected and parsed */}
            {filePreview ? (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-xs text-amber-900">
                      Tệp hợp lệ: {filePreview.fileName} ({filePreview.fileSizeKb} KB)
                    </span>
                  </div>
                  <button
                    onClick={() => setFilePreview(null)}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Hủy chọn
                  </button>
                </div>

                <div className="text-xs text-slate-700 space-y-1">
                  <p className="font-semibold text-slate-900">Nội dung 4 mục sẽ được khôi phục:</p>
                  <div className="grid grid-cols-2 gap-2 mt-1 text-[11px]">
                    <div className="bg-white p-2 rounded border border-amber-200 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Mục 1:</strong> {filePreview.examsCount} đề ({filePreview.questionsCount} câu)</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-amber-200 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Mục 2:</strong> {filePreview.liveSessionsCount} phiên giám sát</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-amber-200 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Mục 3:</strong> {filePreview.completedSessionsCount} kết quả đã nộp</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-amber-200 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Mục 4:</strong> {filePreview.classesCount} lớp, {filePreview.studentsCount} HS</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleExecuteRestore}
                  disabled={isRestoring}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isRestoring ? (
                    <RotateCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>XÁC NHẬN TIẾN HÀNH KHÔI PHỤC NGAY</span>
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 font-medium">
                  Bấm nút bên dưới để chọn tệp sao lưu (.json) từ máy tính của bạn
                </p>
                <p className="text-[11px] text-slate-400">
                  Hệ thống sẽ kiểm tra kỹ tính hợp lệ của cả 4 mục trước khi tiến hành cập nhật
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <label className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-md">
              <Upload className="w-4 h-4" />
              <span>{filePreview ? 'CHỌN TỆP SAO LƯU KHÁC' : 'CHỌN TỆP SAO LƯU ĐỂ KHÔI PHỤC (.JSON)'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-[11px] text-slate-400 text-center mt-2">
              Dữ liệu sau khi khôi phục sẽ tự động hiển thị ngay ở các tab 1, 2, 3, 4
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
