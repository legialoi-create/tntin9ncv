import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Award,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Search,
  CheckCircle2,
  XCircle,
  Users,
  AlertTriangle,
  ShieldAlert,
  X,
  Eye,
  Clock,
  History,
  BookOpen,
  RotateCw,
  Trash2
} from 'lucide-react';
import { Exam } from '../types';
import { api } from '../services/api';
import { ExamSearchDropdown } from './ExamSearchDropdown';

interface ExamReportsProps {
  exams: Exam[];
  selectedExamId?: string;
}

export const ExamReports: React.FC<ExamReportsProps> = ({ exams, selectedExamId }) => {
  const [currentExamId, setCurrentExamId] = useState<string>(() => {
    if (selectedExamId && exams.some((e) => e.id === selectedExamId)) return selectedExamId;
    const saved = localStorage.getItem('ncv_selected_exam_id');
    if (saved && exams.some((e) => e.id === saved)) return saved;
    const preferred = exams.length > 0 ? exams[0] : null;
    return preferred ? preferred.id : '';
  });
  const [reportData, setReportData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterViolation, setFilterViolation] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortByViolation, setSortByViolation] = useState<'none' | 'desc' | 'asc'>('none');
  const [viewingViolationsStudent, setViewingViolationsStudent] = useState<any | null>(null);
  const [viewingAttemptsStudent, setViewingAttemptsStudent] = useState<any | null>(null);
  const [submissionToDelete, setSubmissionToDelete] = useState<any | null>(null);
  const [isDeletingSubmission, setIsDeletingSubmission] = useState(false);
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
      setReportData(null);
    }
  }, [selectedExamId, exams]);

  const fetchReports = async (showLoading = false) => {
    if (!currentExamId) {
      return;
    }
    if (showLoading) setIsLoading(true);
    try {
      const data = await api.getExamReports(currentExamId);
      if (data) {
        setReportData(data);
        setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
      }
    } catch (err: any) {
      console.warn('Exam report warning:', currentExamId, err?.message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const [reportNotice, setReportNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showReportNotice = (type: 'success' | 'error', text: string) => {
    setReportNotice({ type, text });
    setTimeout(() => setReportNotice(null), 4500);
  };

  const confirmDeleteSubmission = async () => {
    if (!submissionToDelete) return;
    const targetSessionId = submissionToDelete.sessionId;
    setIsDeletingSubmission(true);
    try {
      await api.deleteSubmission(targetSessionId, currentExamId);
      setSubmissionToDelete(null);
      showReportNotice('success', 'Đã xóa kết quả bài thi của học sinh thành công');
      await fetchReports(false);
    } catch (err: any) {
      showReportNotice('error', 'Lỗi xóa bài thi: ' + (err?.message || 'Vui lòng thử lại'));
    } finally {
      setIsDeletingSubmission(false);
    }
  };

  useEffect(() => {
    if (currentExamId) {
      fetchReports(true);

      const handleSync = () => {
        fetchReports(false);
      };
      window.addEventListener('ncv_submission_update', handleSync);

      let bc: BroadcastChannel | null = null;
      try {
        bc = new BroadcastChannel('ncv_broadcast_sync');
        bc.onmessage = () => {
          handleSync();
        };
      } catch (e) {}

      return () => {
        window.removeEventListener('ncv_submission_update', handleSync);
        if (bc) bc.close();
      };
    }
  }, [currentExamId, exams]);

  const handleExportExcel = async () => {
    if (!currentExamId) return;
    try {
      const blob = await api.exportExcelReport(currentExamId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const examObj = exams.find((e) => e.id === currentExamId);
      a.download = `KetQua_${examObj?.code || 'Exam'}_THCS_NamCuaViet.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showReportNotice(
        'success',
        'Đã xuất tệp Excel (.xlsx) nhiều tab (mỗi lớp 1 tab riêng, đủ danh sách học sinh theo thứ tự lớp, để trống ô điểm HS chưa thi)'
      );
    } catch (err: any) {
      showReportNotice('error', 'Lỗi xuất tệp Excel: ' + (err.message || 'Vui lòng kiểm tra lại'));
    }
  };

  const submissions = reportData?.submissions || [];
  const rosterSubmissions =
    Array.isArray(reportData?.rosterSubmissions) && reportData.rosterSubmissions.length > 0
      ? reportData.rosterSubmissions
      : submissions;

  const filteredSubmissions = rosterSubmissions
    .filter((s: any) => {
      if (!s) return false;
      const cls = String(s.class || s.studentClass || '');
      const matchClass = filterClass === 'ALL' || cls.toUpperCase() === filterClass.toUpperCase();
      const nameStr = String(s.name || s.studentName || '').toLowerCase();
      const sbdStr = String(s.sbd || '').toLowerCase();
      const query = searchQuery.trim().toLowerCase();
      const matchSearch = !query || nameStr.includes(query) || sbdStr.includes(query);

      const isParticipated =
        s.hasParticipated !== false &&
        s.status !== 'not_participated' &&
        s.score !== null &&
        s.score !== undefined &&
        s.score !== '';
      const vCount = s.violationCount || 0;
      let matchViolation = true;
      if (filterViolation === 'SUBMITTED_ONLY') {
        matchViolation = isParticipated;
      } else if (filterViolation === 'NOT_PARTICIPATED') {
        matchViolation = !isParticipated;
      } else if (filterViolation === 'HAS_VIOLATION') {
        matchViolation = isParticipated && vCount > 0;
      } else if (filterViolation === 'LOCKED') {
        matchViolation = isParticipated && s.status === 'locked';
      } else if (filterViolation === 'NO_VIOLATION') {
        matchViolation = isParticipated && vCount === 0 && s.status !== 'locked';
      }
      return matchClass && matchSearch && matchViolation;
    })
    .sort((a: any, b: any) => {
      if (sortByViolation === 'desc') {
        return (b.violationCount || 0) - (a.violationCount || 0);
      } else if (sortByViolation === 'asc') {
        return (a.violationCount || 0) - (b.violationCount || 0);
      }
      return 0;
    });

  const totalViolationsInReport = reportData?.totalViolations ?? submissions.reduce((acc: number, s: any) => acc + (s.violationCount || 0), 0);
  const violatingStudentsCount = reportData?.violatingStudentsCount ?? submissions.filter((s: any) => (s.violationCount || 0) > 0).length;

  const classList = Array.from(
    new Set([
      ...(Array.isArray(reportData?.targetClassList) ? reportData.targetClassList : []),
      ...rosterSubmissions.map((s: any) => String(s.class || s.studentClass || '')).filter(Boolean)
    ])
  ) as string[];

  if (exams.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center max-w-md mx-auto my-8">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800 mb-1">Chưa có bài kiểm tra nào</h3>
        <p className="text-xs text-slate-500 mb-2">
          Hãy tạo đề thi ở mục "1. Đề kiểm tra" để theo dõi kết quả làm bài và xuất bảng điểm Excel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner and Export button */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Thống kê kết quả & Xuất Excel
            </h2>
            <p className="text-xs text-slate-500">
              Phân tích phổ điểm, tỷ lệ đạt và xuất danh sách bảng điểm chuẩn theo quy định
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Select Exam with searchable dropdown */}
          <ExamSearchDropdown
            exams={exams}
            currentExamId={currentExamId}
            onSelectExam={(id) => {
              setCurrentExamId(id);
              setFilterClass('ALL');
            }}
            size="md"
            label="Kỳ thi:"
          />

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchReports(true)}
            disabled={isLoading}
            title="Bấm để tải điểm số và kết quả bài làm mới nhất từ Cloud Firestore"
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 shadow-sm shadow-indigo-200 disabled:opacity-60"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới kết quả</span>
          </button>

          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            title="Xuất tệp Excel (.xlsx) nhiều tab (mỗi lớp 1 tab), đủ học sinh theo thứ tự lớp, để trống ô điểm HS chưa thi"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 flex items-center space-x-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>XUẤT EXCEL (.xlsx)</span>
          </button>
        </div>

        {/* Real-time zero-waste status bar */}
        <div className="w-full flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 gap-2">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Vừa cập nhật: <b className="text-slate-800">{lastUpdated}</b></span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
              Điểm số lưu vĩnh viễn trên Cloud Firestore
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-600 font-medium">
            <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">
              Chế độ Thủ công
            </span>
            <span>0 lượt tải ngầm • Bấm nút "Làm mới kết quả" khi Thầy muốn nạp điểm mới</span>
          </div>
        </div>
      </div>

      {reportNotice && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition ${
            reportNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {reportNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{reportNotice.text}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500">Số HS dự thi</div>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {reportData?.totalStudentsCount ?? reportData?.submissions?.length ?? 0}
            <span className="text-xs font-normal text-slate-400 ml-1">HS</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Tổng {reportData?.totalSubmissions || 0} lượt làm
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500">Điểm trung bình</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {reportData?.averageScore ?? 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500">Điểm cao nhất</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {reportData?.highestScore ?? 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500">Điểm thấp nhất</div>
          <div className="text-2xl font-black text-red-500 mt-1">
            {reportData?.lowestScore ?? 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500">Tỷ lệ đạt (≥ 5.0)</div>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {reportData?.passRate ?? 0}%
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500">Đạt loại Giỏi (≥ 8.0)</div>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {reportData?.goodCount ?? 0} HS
          </div>
        </div>

        <div className={`p-4 rounded-xl border shadow-xs ${
          totalViolationsInReport > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200'
        }`}>
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Vi phạm</span>
            {totalViolationsInReport > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <div className={`text-2xl font-black mt-1 ${
            totalViolationsInReport > 0 ? 'text-amber-700' : 'text-slate-400'
          }`}>
            {totalViolationsInReport}
            <span className="text-[11px] font-semibold text-slate-500 ml-1">
              lần {violatingStudentsCount > 0 ? `(${violatingStudentsCount} HS)` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Score distribution histogram and hardest questions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Score distribution */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center space-x-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Biểu đồ phân bố điểm số</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Số lượng học sinh theo từng khoảng điểm thi
            </p>

            <div className="space-y-3">
              {reportData?.distribution?.map((dist: any) => {
                const total = reportData?.totalSubmissions || 1;
                const pct = total > 0 ? Math.round((dist.count / total) * 100) : 0;
                return (
                  <div key={dist.range} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700">{dist.range} điểm</span>
                      <span className="text-slate-500">
                        {dist.count} HS ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            Dữ liệu được cập nhật tự động ngay khi học sinh nộp bài.
          </div>
        </div>

        {/* Hardest Questions Table */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-1 flex items-center space-x-1.5">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span>Câu hỏi có nhiều học sinh trả lời sai nhất</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Giúp giáo viên nắm bắt các kiến thức học sinh hay nhầm lẫn để giảng giải lại
          </p>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {reportData?.questionAnalysis?.slice(0, 5).map((q: any) => (
              <div key={q.questionNumber} className="py-2.5 flex items-center justify-between text-xs">
                <div className="pr-3 flex-1">
                  <div className="font-bold text-slate-900">
                    Câu {q.questionNumber}: {q.questionText}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Đúng: {q.correctCount} • Sai: {q.incorrectCount}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs ${
                      q.errorRate >= 50
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    Sai {q.errorRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Student Submissions Table - EXACT USER REQUIREMENTS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Bảng kết quả học sinh ({filteredSubmissions.length} bài)
            </h3>

            {/* Ô tìm & menu thả chọn kì thi trực tiếp tại bảng */}
            <ExamSearchDropdown
              exams={exams}
              currentExamId={currentExamId}
              onSelectExam={(id) => {
                setCurrentExamId(id);
                setFilterClass('ALL');
              }}
              size="sm"
              label="Kỳ thi:"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <div className="relative w-44 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm họ tên hoặc SBD..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
            </div>

            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả lớp</option>
              {classList.map((c) => (
                <option key={c} value={c}>
                  Lớp {c}
                </option>
              ))}
            </select>

            <select
              value={filterViolation}
              onChange={(e) => setFilterViolation(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer font-medium"
            >
              <option value="ALL">Đủ danh sách lớp (Cả HS chưa thi)</option>
              <option value="SUBMITTED_ONLY">Chỉ học sinh đã dự thi</option>
              <option value="NOT_PARTICIPATED">Học sinh chưa dự thi (Vắng)</option>
              <option value="HAS_VIOLATION">Có vi phạm (&gt; 0)</option>
              <option value="LOCKED">Bị khóa do vi phạm</option>
              <option value="NO_VIOLATION">Đã thi &amp; Không vi phạm (0)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-12 text-center">STT</th>
                <th className="py-3 px-4">Họ và tên</th>
                <th className="py-3 px-4">Lớp</th>
                <th className="py-3 px-4 text-center">Lượt làm</th>
                <th className="py-3 px-4 text-center">Đúng</th>
                <th className="py-3 px-4 text-center">Sai</th>
                <th className="py-3 px-4 text-center text-indigo-700">Điểm cao nhất ⭐</th>
                <th
                  onClick={() => setSortByViolation(prev => prev === 'desc' ? 'asc' : prev === 'asc' ? 'none' : 'desc')}
                  className="py-3 px-4 text-center cursor-pointer select-none group hover:bg-slate-100 transition"
                  title="Bấm để sắp xếp theo số lần vi phạm"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Vi phạm</span>
                    {sortByViolation === 'desc' ? (
                      <span className="text-[11px] text-amber-600 font-black">↓</span>
                    ) : sortByViolation === 'asc' ? (
                      <span className="text-[11px] text-amber-600 font-black">↑</span>
                    ) : (
                      <span className="text-[10px] text-slate-300 group-hover:text-slate-400">↕</span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Thời gian nộp</th>
                <th className="py-3 px-3 text-center w-16">Xóa bài</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    Chưa có bài thi nào phù hợp với bộ lọc
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((s: any, idx: number) => {
                  const isParticipated =
                    s.hasParticipated !== false &&
                    s.status !== 'not_participated' &&
                    s.score !== null &&
                    s.score !== undefined &&
                    s.score !== '';

                  return (
                    <tr
                      key={s.sessionId || `${s.class}-${s.name}-${idx}`}
                      className={`hover:bg-slate-50/80 transition ${!isParticipated ? 'bg-slate-50/30' : ''}`}
                    >
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {filterClass !== 'ALL' && s.sttInClass ? s.sttInClass : idx + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{s.name}</span>
                          {s.sbd && (
                            <span className="text-[11px] text-slate-400 font-normal">
                              ({s.sbd})
                            </span>
                          )}
                          {s.status === 'locked' && (
                            <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded border border-red-200">
                              Bị khóa (vi phạm)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{s.class}</td>
                      <td className="py-3 px-4 text-center">
                        {isParticipated ? (
                          <button
                            type="button"
                            onClick={() => setViewingAttemptsStudent(s)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer shadow-xs"
                            title="Bấm để xem lịch sử điểm các lần làm bài"
                          >
                            <History className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{s.attemptCount || 1}/{s.maxAttempts || reportData?.maxAttempts || 1}</span>
                          </button>
                        ) : (
                          <span className="text-slate-300"></span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600">
                        {isParticipated ? (s.correctCount ?? 0) : ''}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-red-500">
                        {isParticipated ? (s.incorrectCount ?? 0) : ''}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isParticipated ? (
                          <span
                            className={`inline-block px-3 py-1 rounded-full font-black text-xs shadow-xs ${
                              (s.score ?? 0) >= 8.0
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : (s.score ?? 0) >= 5.0
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                            title="Điểm cao nhất trong các lần thi"
                          >
                            {s.score ?? 0}
                          </span>
                        ) : (
                          // Học sinh không tham gia thi -> để trống hoàn toàn ô Điểm
                          <span className="inline-block min-w-[2.5rem] min-h-[1.5rem]" title="Học sinh chưa dự thi (để trống điểm)"></span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {!isParticipated ? (
                          <span></span>
                        ) : s.violationCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => setViewingViolationsStudent(s)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition cursor-pointer shadow-xs"
                            title="Bấm để xem lịch sử vi phạm chi tiết"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>{s.violationCount} lần</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 font-medium">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 font-mono text-[11px]">
                        {!isParticipated ? (
                          <span className="text-slate-400 italic font-sans">Chưa dự thi</span>
                        ) : s.status === 'locked' ? (
                          <div>
                            <span className="text-red-600 font-bold">Bị khóa</span>
                            {s.submittedAt && (
                              <div className="text-[10px] text-slate-400">
                                {new Date(s.submittedAt).toLocaleTimeString('vi-VN')} {new Date(s.submittedAt).toLocaleDateString('vi-VN')}
                              </div>
                            )}
                          </div>
                        ) : s.submittedAt ? (
                          new Date(s.submittedAt).toLocaleTimeString('vi-VN') + ' ' + new Date(s.submittedAt).toLocaleDateString('vi-VN')
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isParticipated && (
                          <button
                            type="button"
                            onClick={() => setSubmissionToDelete(s)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title={`Xóa vĩnh viễn bài thi của ${s.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal chi tiết vi phạm của học sinh */}
      {viewingViolationsStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <span>Chi tiết vi phạm quy chế thi</span>
              </div>
              <button
                type="button"
                onClick={() => setViewingViolationsStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400">Học sinh:</span>{' '}
                  <span className="font-bold text-slate-800">{viewingViolationsStudent.name}</span>
                </div>
                <div>
                  <span className="text-slate-400">Lớp:</span>{' '}
                  <span className="font-bold text-slate-800">{viewingViolationsStudent.class}</span>
                </div>
                <div>
                  <span className="text-slate-400">Số báo danh:</span>{' '}
                  <span className="font-bold text-slate-800">{viewingViolationsStudent.sbd || 'Không có'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Tổng vi phạm:</span>{' '}
                  <span className="font-bold text-amber-600">{viewingViolationsStudent.violationCount} lần</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Nhật ký ghi nhận từng lần vi phạm</span>
                </h4>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {(!viewingViolationsStudent.violations || viewingViolationsStudent.violations.length === 0) ? (
                    <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl">
                      Đã ghi nhận {viewingViolationsStudent.violationCount} lượt vi phạm từ hệ thống
                    </div>
                  ) : (
                    viewingViolationsStudent.violations.map((v: any, vIdx: number) => (
                      <div
                        key={vIdx}
                        className="p-3 bg-red-50/60 border border-red-100 rounded-xl text-xs flex items-start space-x-3"
                      >
                        <div className="w-6 h-6 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                          {vIdx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-red-900">
                              {v.type === 'fullscreen_exit'
                                ? 'Thoát toàn màn hình'
                                : v.type === 'tab_switch'
                                ? 'Chuyển tab / rời ứng dụng'
                                : v.type === 'window_blur'
                                ? 'Mất tiêu điểm cửa sổ'
                                : v.type === 'copy_attempt'
                                ? 'Cố gắng sao chép đề'
                                : v.type === 'inspect_attempt'
                                ? 'Nhấn phím tắt cấm'
                                : 'Vi phạm quy chế'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {v.timestamp ? new Date(v.timestamp).toLocaleTimeString('vi-VN') : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            {v.description || 'Học sinh rời khỏi giao diện làm bài thi'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingViolationsStudent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attempts History Modal */}
      {viewingAttemptsStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">
                  LỊCH SỬ CÁC LẦN LÀM BÀI CỦA HỌC SINH
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingAttemptsStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100 text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Học sinh:</span>{' '}
                  <span className="font-bold text-slate-900">{viewingAttemptsStudent.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Lớp:</span>{' '}
                  <span className="font-bold text-slate-900">{viewingAttemptsStudent.class}</span>
                </div>
                <div>
                  <span className="text-slate-500">Số lần đã làm:</span>{' '}
                  <span className="font-bold text-indigo-700">
                    {viewingAttemptsStudent.attemptCount || 1} / {viewingAttemptsStudent.maxAttempts || reportData?.maxAttempts || 1} lần
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Điểm cao nhất:</span>{' '}
                  <span className="font-black text-amber-600 text-sm">
                    ⭐ {viewingAttemptsStudent.bestScore ?? viewingAttemptsStudent.score} / 10
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>Chi tiết từng lần thi (Hệ thống lấy điểm cao nhất)</span>
                </h4>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(!viewingAttemptsStudent.attempts || viewingAttemptsStudent.attempts.length === 0) ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-900">Lần 1</span>
                        <div className="text-[11px] text-slate-500">
                          {viewingAttemptsStudent.submittedAt ? new Date(viewingAttemptsStudent.submittedAt).toLocaleString('vi-VN') : 'Đã nộp'}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-emerald-600">
                          {viewingAttemptsStudent.score}đ
                        </span>
                        <span className="block text-[10px] text-emerald-700 font-bold">Điểm cao nhất ⭐</span>
                      </div>
                    </div>
                  ) : (
                    viewingAttemptsStudent.attempts.map((att: any, aIdx: number) => {
                      const isBest = att.score === viewingAttemptsStudent.score;
                      return (
                        <div
                          key={att.sessionId || aIdx}
                          className={`p-3 rounded-xl border text-xs flex items-center justify-between transition ${
                            isBest
                              ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-sm">
                                Lần {att.attemptNumber || (aIdx + 1)}
                              </span>
                              {isBest && (
                                <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">
                                  Điểm cao nhất ⭐
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Đúng: <b className="text-emerald-700">{att.correctCount}</b> | Sai: <b className="text-red-600">{att.incorrectCount}</b>
                              {att.violationCount > 0 && (
                                <span> | Vi phạm: <b className="text-amber-600">{att.violationCount}</b></span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {att.submittedAt ? new Date(att.submittedAt).toLocaleString('vi-VN') : ''}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`text-xl font-black ${isBest ? 'text-emerald-700' : 'text-slate-700'}`}>
                              {att.score}
                              <span className="text-xs text-slate-400 font-normal">/10</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingAttemptsStudent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa bài thi của học sinh */}
      {submissionToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Xác nhận xóa bài thi
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Bạn có chắc muốn xóa vĩnh viễn kết quả bài thi của học sinh{' '}
              <b className="text-slate-800">{submissionToDelete.name}</b> (Lớp{' '}
              <b className="text-slate-800">{submissionToDelete.class}</b>)?
              <br />
              <span className="text-[11px] text-slate-400 mt-1 inline-block">
                Dữ liệu sẽ bị xóa khỏi đám mây Cloud Firestore và máy chủ. Học sinh sẽ có thể làm lại bài thi.
              </span>
            </p>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setSubmissionToDelete(null)}
                disabled={isDeletingSubmission}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteSubmission}
                disabled={isDeletingSubmission}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                {isDeletingSubmission ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
