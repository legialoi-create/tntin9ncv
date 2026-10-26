import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Copy,
  Trash2,
  Edit,
  Eye,
  Power,
  Clock,
  Sparkles,
  Search,
  CheckCircle,
  HelpCircle,
  ShieldAlert,
  Shuffle,
  RotateCcw,
  Bot,
  Send,
  Download,
  Calendar,
  CalendarClock,
  Timer
} from 'lucide-react';
import { Exam } from '../types';
import { api } from '../services/api';

interface ExamManagerProps {
  exams: Exam[];
  onRefresh: () => void;
  onOpenAiParser: () => void;
  onOpenProctor: (examId: string) => void;
  onOpenReports: (examId: string) => void;
  onEditExam?: (exam: Exam) => void;
  onTestExam?: (examCode: string) => void;
}

export const ExamManager: React.FC<ExamManagerProps> = ({
  exams,
  onRefresh,
  onOpenAiParser,
  onOpenProctor,
  onOpenReports,
  onEditExam,
  onTestExam,
}) => {
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState<number | 'ALL'>('ALL');
  const [viewingQuestionsExam, setViewingQuestionsExam] = useState<Exam | null>(null);

  const getExamScheduleStatus = (exam: Exam) => {
    if (!exam.startTime && !exam.endTime) {
      return { status: 'open_free', label: 'Tự do', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    const nowMs = Date.now();
    const sMs = exam.startTime ? new Date(exam.startTime).getTime() : 0;
    const eMs = exam.endTime ? new Date(exam.endTime).getTime() : Infinity;

    if (sMs && nowMs < sMs) {
      return {
        status: 'upcoming',
        label: `Mở lúc ${new Date(sMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date(sMs).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`,
        color: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    }
    if (eMs && nowMs > eMs) {
      return {
        status: 'ended',
        label: `Đã đóng (${new Date(eMs).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })})`,
        color: 'bg-slate-100 text-slate-600 border-slate-200'
      };
    }
    return {
      status: 'active',
      label: 'Đang trong ca thi',
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
    };
  };

  const [examToDelete, setExamToDelete] = useState<{ id: string; title: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSolvingInManager, setIsSolvingInManager] = useState(false);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleQuickChangeAnswer = async (qIndex: number, newAnswer: 'A' | 'B' | 'C' | 'D') => {
    if (!viewingQuestionsExam || !Array.isArray(viewingQuestionsExam.questions)) return;
    const currentQ = viewingQuestionsExam.questions[qIndex];
    if (!currentQ || currentQ.correctAnswer === newAnswer) return;

    const updatedQuestions = [...viewingQuestionsExam.questions];
    updatedQuestions[qIndex] = {
      ...currentQ,
      correctAnswer: newAnswer,
    };

    const updatedExam: Exam = {
      ...viewingQuestionsExam,
      questions: updatedQuestions,
      updatedAt: new Date().toISOString(),
    };

    setViewingQuestionsExam(updatedExam);

    try {
      await api.saveExam(updatedExam);
      onRefresh();
      showFeedback('success', `Đã đổi đáp án đúng Câu ${qIndex + 1} thành [${newAnswer}]`);
    } catch (err: any) {
      showFeedback('error', 'Lỗi lưu đáp án: ' + err.message);
    }
  };

  const handleAiSolveInManager = async () => {
    if (!viewingQuestionsExam || !Array.isArray(viewingQuestionsExam.questions) || viewingQuestionsExam.questions.length === 0) return;
    setIsSolvingInManager(true);
    try {
      const res = await api.solveQuestionsWithAI(viewingQuestionsExam.questions);
      if (res && res.answers && res.answers.length > 0) {
        const ansMap = new Map(res.answers.map((a) => [a.number, a]));
        const updatedQuestions = viewingQuestionsExam.questions.map((q) => {
          const solved = ansMap.get(q.number);
          if (solved) {
            return {
              ...q,
              correctAnswer: solved.correctAnswer,
              explanation: solved.explanation || q.explanation,
            };
          }
          return q;
        });

        const updatedExam: Exam = {
          ...viewingQuestionsExam,
          questions: updatedQuestions,
          updatedAt: new Date().toISOString(),
        };

        setViewingQuestionsExam(updatedExam);
        await api.saveExam(updatedExam);
        onRefresh();
        showFeedback('success', `✓ AI đã giải và cập nhật đáp án chuẩn xác cho toàn bộ ${res.answers.length} câu hỏi!`);
      }
    } catch (err: any) {
      showFeedback('error', 'Lỗi khi AI giải đề: ' + (err.message || err));
    } finally {
      setIsSolvingInManager(false);
    }
  };

  const [managerChatPrompt, setManagerChatPrompt] = useState('');

  const handleManagerChatPrompt = async (presetText?: string) => {
    const textToSend = (presetText || managerChatPrompt).trim();
    if (!viewingQuestionsExam || !Array.isArray(viewingQuestionsExam.questions) || viewingQuestionsExam.questions.length === 0 || !textToSend || isSolvingInManager) return;
    setIsSolvingInManager(true);
    try {
      const res = await api.chatExamAssistant({
        message: textToSend,
        questions: viewingQuestionsExam.questions,
      });

      if (res.updatedAnswers && res.updatedAnswers.length > 0) {
        const ansMap = new Map(res.updatedAnswers.map((a) => [a.number, a]));
        const updatedQuestions = viewingQuestionsExam.questions.map((q) => {
          const solved = ansMap.get(q.number);
          if (solved) {
            return {
              ...q,
              correctAnswer: solved.correctAnswer,
              explanation: solved.explanation || q.explanation,
            };
          }
          return q;
        });

        const updatedExam: Exam = {
          ...viewingQuestionsExam,
          questions: updatedQuestions,
          updatedAt: new Date().toISOString(),
        };

        setViewingQuestionsExam(updatedExam);
        await api.saveExam(updatedExam);
        onRefresh();
        setManagerChatPrompt('');
        showFeedback('success', `✓ AI: "${res.reply}" (Đã cập nhật ${res.updatedAnswers.length} câu)`);
      } else {
        setManagerChatPrompt('');
        showFeedback('success', `AI: ${res.reply}`);
      }
    } catch (err: any) {
      showFeedback('error', 'Lỗi trao đổi với AI: ' + (err.message || err));
    } finally {
      setIsSolvingInManager(false);
    }
  };

  const handleToggleOpen = async (id: string) => {
    try {
      await api.toggleExamOpen(id);
      onRefresh();
      showFeedback('success', 'Đã cập nhật trạng thái bài thi');
    } catch (err: any) {
      showFeedback('error', 'Lỗi thay đổi trạng thái: ' + err.message);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.duplicateExam(id);
      onRefresh();
      showFeedback('success', 'Đã nhân bản đề thi thành công');
    } catch (err: any) {
      showFeedback('error', 'Lỗi nhân bản đề thi: ' + err.message);
    }
  };

  const handleRestoreSamples = async () => {
    try {
      await api.restoreSampleExams();
      onRefresh();
      showFeedback('success', 'Đã nạp lại bộ đề thi mẫu Tin học 7, 8 thành công!');
    } catch (err: any) {
      showFeedback('error', 'Lỗi nạp đề mẫu: ' + err.message);
    }
  };

  const confirmDeleteExam = async () => {
    if (!examToDelete) return;
    const { id, title } = examToDelete;
    setExamToDelete(null);

    try {
      await api.deleteExam(id);
      onRefresh();
      showFeedback('success', `Đã xóa bài kiểm tra "${title}" thành công`);
    } catch (err: any) {
      showFeedback('error', 'Lỗi xóa bài kiểm tra: ' + err.message);
    }
  };

  const handleViewQuestions = async (exam: Exam) => {
    if (exam.questions && Array.isArray(exam.questions) && exam.questions.length > 0) {
      setViewingQuestionsExam(exam);
    } else {
      try {
        const full = await api.getExam(exam.id, true);
        if (full && Array.isArray(full.questions)) {
          setViewingQuestionsExam(full);
        } else {
          setViewingQuestionsExam({ ...exam, questions: exam.questions || [] });
        }
      } catch {
        setViewingQuestionsExam({ ...exam, questions: exam.questions || [] });
      }
    }
  };

  const formatExamToText = (exam: Exam): string => {
    let content = `TRƯỜNG THCS NAM CỬA VIỆT\n`;
    content += `ĐỀ KIỂM TRA TRẮC NGHIỆM TIN HỌC - KHỐI ${exam.grade}\n`;
    content += `Bài kiểm tra: ${exam.title}\n`;
    content += `Mã đề: ${exam.code} | Thời gian: ${exam.durationMinutes} phút | Lớp: ${(exam.targetClasses || []).join(', ')}\n`;
    content += `==========================================================\n\n`;

    const qs = exam.questions || [];
    qs.forEach((q, idx) => {
      content += `Câu ${idx + 1}: ${q.content}\n`;
      if (q.codeSnippet) {
        content += `[Mã chương trình ${q.codeLanguage || ''}]:\n${q.codeSnippet}\n`;
      }
      (q.options || []).forEach((opt) => {
        content += `${opt.id}. ${opt.text}\n`;
      });
      content += `\n`;
    });

    content += `==========================================================\n`;
    content += `BẢNG ĐÁP ÁN ĐÚNG:\n`;
    const ansList = qs.map((q, idx) => `${idx + 1}.${q.correctAnswer}`);
    content += ansList.join('   ') + `\n`;

    return content;
  };

  const handleExportExamTxt = (exam: Exam) => {
    const text = formatExamToText(exam);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DeThi_${exam.code}_THCS_NamCuaViet.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback('success', `Đã xuất tệp đề thi ${exam.code} (.txt mở được bằng Word)`);
  };

  const handleExportExamJson = (exam: Exam) => {
    const jsonStr = JSON.stringify(exam, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DeThi_${exam.code}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback('success', `Đã xuất tệp JSON đề thi ${exam.code}`);
  };

  const handleCopyExamText = (exam: Exam) => {
    const text = formatExamToText(exam);
    navigator.clipboard.writeText(text);
    showFeedback('success', `Đã sao chép toàn bộ đề thi ${exam.code} (dán được ngay vào Word)`);
  };

  const filteredExams = exams.filter((ex) => {
    const matchSearch =
      ex.title.toLowerCase().includes(search.toLowerCase()) ||
      ex.code.toLowerCase().includes(search.toLowerCase());
    const matchGrade = filterGrade === 'ALL' || ex.grade === filterGrade;
    return matchSearch && matchGrade;
  });

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Action Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Quản lý ngân hàng đề kiểm tra
          </h2>
          <p className="text-xs text-slate-500">
            Tạo đề bằng AI từ file Word (.docx), PDF, hoặc ngân hàng câu hỏi môn Tin học THCS
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRestoreSamples}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
            title="Nạp lại bộ đề kiểm tra mẫu Tin học THCS Nam Cửa Việt"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
            <span>Nạp lại bộ đề mẫu</span>
          </button>

          <button
            onClick={onOpenAiParser}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 flex items-center space-x-2 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>TẠO ĐỀ MỚI BẰNG AI (WORD / PDF)</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc mã đề..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500">Khối:</span>
          {(['ALL', 6, 7, 8, 9] as const).map((g) => (
            <button
              key={g}
              onClick={() => setFilterGrade(g)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                filterGrade === g
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {g === 'ALL' ? 'Tất cả' : `Khối ${g}`}
            </button>
          ))}
        </div>
      </div>

      {/* Exams Grid or Empty State */}
      {filteredExams.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center max-w-md mx-auto my-6 shadow-xs">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">Chưa có bài kiểm tra nào</h3>
          <p className="text-xs text-slate-500 mb-5">
            Ngân hàng đề hiện đang trống. Quý thầy có thể tạo đề mới bằng AI hoặc nạp lại bộ đề mẫu Tin học có sẵn.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              onClick={onOpenAiParser}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-indigo-100"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Tạo đề mới bằng AI</span>
            </button>
            <button
              onClick={handleRestoreSamples}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-indigo-600" />
              <span>Nạp đề mẫu Tin học</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between"
            >
              <div>
                {/* Top tags */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md">
                    {exam.code}
                  </span>

                  <button
                    onClick={() => handleToggleOpen(exam.id)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center space-x-1 cursor-pointer transition ${
                      exam.isOpen
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                    title="Nhấn để Bật / Tắt trạng thái mở làm bài"
                  >
                    <Power className="w-3 h-3" />
                    <span>{exam.isOpen ? 'Đang mở thi' : 'Đang đóng'}</span>
                  </button>
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 mb-2">
                  {exam.title}
                </h3>

                {/* Badges Info */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 my-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Khối & Lớp áp dụng:</span>
                    <span className="font-semibold text-slate-800" title={(exam.targetClasses || []).join(', ')}>
                      Khối {exam.grade} {Array.isArray(exam.targetClasses) && exam.targetClasses.length > 0 ? `(${exam.targetClasses.length} lớp: ${exam.targetClasses.join(', ')})` : '(Tất cả)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Thời gian thi:</span>
                    <span className="font-semibold text-slate-800">
                      {exam.durationMinutes} phút
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Số lượng câu:</span>
                    {exam.randomQuestionCount && exam.randomQuestionCount > 0 && exam.randomQuestionCount < (exam.questions?.length || exam.questionCount || 0) ? (
                      <span className="font-bold text-purple-700 flex items-center space-x-1" title={`Bốc ngẫu nhiên ${exam.randomQuestionCount} câu từ ngân hàng ${(exam.questions?.length || exam.questionCount || 0)} câu`}>
                        <Shuffle className="w-3 h-3 text-purple-600 shrink-0" />
                        <span>Bốc {exam.randomQuestionCount} / {(exam.questions?.length || exam.questionCount || 0)} câu</span>
                      </span>
                    ) : (
                      <span className="font-semibold text-indigo-600">
                        {(exam.questions?.length || exam.questionCount || 0)} câu trắc nghiệm
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Chống gian lận:</span>
                    <span className="font-semibold text-amber-600">
                      Khóa sau {exam.maxViolationsBeforeLock || 3} lần
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Số lần làm bài:</span>
                    <span className="font-semibold text-emerald-600">
                      Tối đa {exam.maxAttempts || 1} lần {Number(exam.maxAttempts) > 1 ? '(Lấy điểm cao nhất)' : ''}
                    </span>
                  </div>

                  {/* Schedule Details */}
                  <div className="col-span-2 bg-white/95 p-2.5 rounded-lg border border-slate-200 shadow-2xs mt-1">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-700 font-bold flex items-center space-x-1.5">
                        <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Khung giờ ca thi:</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getExamScheduleStatus(exam).color}`}>
                        {getExamScheduleStatus(exam).label}
                      </span>
                    </div>
                    {exam.startTime || exam.endTime ? (
                      <div className="text-[11px] text-slate-700 space-y-0.5 pl-3 border-l-2 border-indigo-400">
                        {exam.startTime && (
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-400">Bắt đầu:</span>
                            <b className="text-slate-900">{new Date(exam.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày {new Date(exam.startTime).toLocaleDateString('vi-VN')}</b>
                          </div>
                        )}
                        {exam.endTime && (
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-400">Kết thúc:</span>
                            <b className="text-slate-900">{new Date(exam.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày {new Date(exam.endTime).toLocaleDateString('vi-VN')}</b>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 pl-3 border-l-2 border-slate-200">
                        Không hẹn giờ (Mở tự do theo công tắc)
                      </div>
                    )}
                  </div>
                </div>

                {/* Settings labels */}
                <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500 mb-4">
                  {exam.randomQuestionCount && exam.randomQuestionCount > 0 && exam.randomQuestionCount < (exam.questions?.length || exam.questionCount || 0) && (
                    <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold flex items-center space-x-1">
                      <Shuffle className="w-2.5 h-2.5" />
                      <span>Bốc {exam.randomQuestionCount}/{(exam.questions?.length || exam.questionCount || 0)} câu ngẫu nhiên</span>
                    </span>
                  )}
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                    {exam.maxAttempts && exam.maxAttempts > 1 ? `Làm ${exam.maxAttempts} lần (Lấy điểm cao nhất)` : 'Làm 1 lần'}
                  </span>
                  {exam.shuffleQuestions && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      Trộn câu hỏi
                    </span>
                  )}
                  {exam.shuffleOptions && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      Trộn đáp án ABCD
                    </span>
                  )}
                  {exam.showScoreAfterSubmit && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      Xem điểm ngay
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex space-x-1.5 items-center">
                  <button
                    onClick={() => handleViewQuestions(exam)}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="Xem ngân hàng câu hỏi & đáp án"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {onEditExam && (
                    <button
                      onClick={() => onEditExam(exam)}
                      className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-900 border border-indigo-200/90 rounded-lg transition cursor-pointer flex items-center space-x-1 shadow-2xs font-semibold text-xs"
                      title="Chỉnh sửa bài kiểm tra (tên, mã, câu hỏi, đáp án, lớp, thời gian)"
                      aria-label="Chỉnh sửa đề thi"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span className="text-[11px] hidden sm:inline">Sửa</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDuplicate(exam.id)}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="Nhân bản đề này"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleExportExamTxt(exam)}
                    className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                    title="Xuất tệp đề kiểm tra (.txt mở được bằng Word)"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setExamToDelete({ id: exam.id, title: exam.title })}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    title="Xóa đề thi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex space-x-1.5 items-center">
                  <button
                    onClick={() => onOpenProctor(exam.id)}
                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition cursor-pointer"
                    title="Giám sát học sinh đang làm bài"
                  >
                    Giám sát
                  </button>
                  <button
                    onClick={() => onOpenReports(exam.id)}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition cursor-pointer"
                    title="Xem kết quả & Xuất Excel"
                  >
                    Điểm số
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Questions & Answers Modal */}
      {/* View Questions & Answers Modal */}
      {viewingQuestionsExam && (() => {
        const modalQuestions = Array.isArray(viewingQuestionsExam.questions) ? viewingQuestionsExam.questions : [];
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {viewingQuestionsExam.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Mã đề: {viewingQuestionsExam.code} • {modalQuestions.length} câu trắc nghiệm
                  </p>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleExportExamTxt(viewingQuestionsExam)}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer border border-emerald-200"
                    title="Tải tệp đề thi kèm đáp án định dạng văn bản (mở được bằng Word)"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Xuất đề Word</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyExamText(viewingQuestionsExam)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer border border-slate-200"
                    title="Sao chép toàn bộ nội dung đề và đáp án vào clipboard"
                  >
                    <Copy className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden sm:inline">Sao chép đề</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportExamJson(viewingQuestionsExam)}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer border border-slate-200"
                    title="Tải tệp JSON đề thi"
                  >
                    <span>JSON</span>
                  </button>
                  <button
                    onClick={() => setViewingQuestionsExam(null)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer ml-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Quick Answer Matrix & AI Solve Button */}
              <div className="mb-4 bg-slate-900 text-white p-3.5 rounded-xl border border-indigo-500/30 space-y-2.5 shrink-0 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 text-xs">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white">Bảng đáp án nhanh (Click để đổi ngay):</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      A: {modalQuestions.filter(q => q.correctAnswer === 'A').length} • 
                      B: {modalQuestions.filter(q => q.correctAnswer === 'B').length} • 
                      C: {modalQuestions.filter(q => q.correctAnswer === 'C').length} • 
                      D: {modalQuestions.filter(q => q.correctAnswer === 'D').length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAiSolveInManager}
                    disabled={isSolvingInManager}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                      isSolvingInManager
                        ? 'bg-indigo-900 text-indigo-300 cursor-wait'
                        : 'bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 hover:brightness-105 active:scale-95 shadow-xs'
                    }`}
                    title="Yêu cầu AI giải lại và tự động cập nhật toàn bộ đáp án đúng"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isSolvingInManager ? 'animate-spin' : ''}`} />
                    <span>{isSolvingInManager ? 'AI đang giải đề...' : '🧠 AI giải lại đáp án'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {modalQuestions.map((q, idx) => (
                    <div key={q.id || idx} className="bg-slate-800 rounded p-1 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-400 font-semibold">C{idx + 1}:</span>
                      <div className="flex space-x-0.5">
                        {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                          const isSelected = q.correctAnswer === letter;
                          return (
                            <button
                              key={letter}
                              type="button"
                              onClick={() => handleQuickChangeAnswer(idx, letter)}
                              className={`w-4.5 h-4.5 rounded text-[10px] font-black transition cursor-pointer flex items-center justify-center ${
                                isSelected
                                  ? 'bg-emerald-500 text-slate-950 ring-1 ring-emerald-300'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                              title={`Click để đặt đáp án Câu ${idx + 1} là [${letter}]`}
                            >
                              {letter}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Command / Chat Bar */}
              <div className="mb-3 p-3 bg-gradient-to-r from-indigo-900/90 to-purple-900/90 rounded-xl border border-indigo-400/40 text-white space-y-2 shrink-0">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center space-x-1.5 text-indigo-100">
                    <Bot className="w-4 h-4 text-amber-300" />
                    <span>Ra lệnh cho AI chọn đáp án theo đề:</span>
                  </span>
                  <span className="text-[10px] text-indigo-300">Gemini Flash AI</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={managerChatPrompt}
                    onChange={(e) => setManagerChatPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleManagerChatPrompt();
                      }
                    }}
                    disabled={isSolvingInManager}
                    placeholder="Nhập yêu cầu (vd: 'Giải lại và chọn đáp án chuẩn', 'Đáp án là: 1A, 2C, 3D...', 'Sửa câu 3 thành D')..."
                    className="flex-1 px-3 py-1.5 bg-slate-950/80 border border-indigo-400/50 rounded-lg text-xs text-white placeholder-indigo-300/50 outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                  <button
                    type="button"
                    onClick={() => handleManagerChatPrompt()}
                    disabled={isSolvingInManager || !managerChatPrompt.trim()}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-500 hover:to-emerald-500 disabled:opacity-40 text-slate-950 rounded-lg font-bold text-xs flex items-center space-x-1 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi</span>
                  </button>
                </div>
              </div>

              {/* Quick edit tip */}
              <div className="mb-3 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between shrink-0 shadow-2xs">
                <span className="flex items-center space-x-2 font-medium">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <b>Chỉnh sửa chi tiết:</b> Thầy có thể <b>click trực tiếp vào ô A, B, C, D</b> trong từng câu dưới đây để đổi đáp án đúng (tự động lưu ngay).
                  </span>
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {modalQuestions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                    Đề kiểm tra này chưa có danh sách câu hỏi chi tiết. Thầy có thể nhấn "Chỉnh sửa nội dung" bên dưới để nhập đề hoặc sinh câu hỏi bằng AI.
                  </div>
                ) : (
                  modalQuestions.map((q, idx) => (
                    <div key={q.id || idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-900 text-sm">
                        Câu {idx + 1}: {q.content}
                      </div>
                      {q.codeSnippet && (
                        <div className="bg-slate-900 text-emerald-300 p-2.5 rounded-lg font-mono text-xs whitespace-pre">
                          {q.codeSnippet}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {(q.options || []).map((opt) => {
                          const isCorrect = q.correctAnswer === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleQuickChangeAnswer(idx, opt.id as any)}
                              className={`p-2.5 rounded-xl border text-left flex items-center space-x-2.5 transition cursor-pointer group ${
                                isCorrect
                                  ? 'bg-emerald-100/90 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-500/40 shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50/60 hover:border-emerald-300'
                              }`}
                              title={`Click để đặt [${opt.id}] làm đáp án đúng cho Câu ${idx + 1}`}
                            >
                              <span
                                className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center text-xs shrink-0 transition ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-200 group-hover:text-emerald-900'
                                }`}
                              >
                                {opt.id}
                              </span>
                              <span className="flex-1 text-xs font-medium leading-relaxed">{opt.text}</span>
                              {isCorrect ? (
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-md flex items-center space-x-1 shrink-0">
                                  <span>✓ ĐÚNG</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 group-hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition shrink-0 font-medium">
                                  Chọn làm đúng
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                {onEditExam && (
                  <button
                    type="button"
                    onClick={() => {
                      const ex = viewingQuestionsExam;
                      setViewingQuestionsExam(null);
                      onEditExam(ex);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-indigo-200"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Chỉnh sửa nội dung bài thi này</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingQuestionsExam(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* In-app Exam Delete Confirmation Modal */}
      {examToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Xác nhận xóa bài kiểm tra?
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Bạn có chắc chắn muốn xóa bài kiểm tra <span className="font-bold text-slate-800">"{examToDelete.title}"</span>?
              <br />
              <span className="text-red-500 font-semibold block mt-1">
                Lưu ý: Toàn bộ danh sách điểm, số lần vi phạm và lịch sử làm bài của học sinh thuộc kỳ thi này sẽ bị xóa theo đề thi. Các kỳ thi khác và danh sách học sinh vẫn được bảo toàn nguyên vẹn.
              </span>
            </p>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setExamToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteExam}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-red-200"
              >
                Xóa bài thi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
