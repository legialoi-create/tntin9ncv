import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  Flag,
  ChevronLeft,
  ChevronRight,
  Send,
  Maximize2,
  Lock,
  RotateCcw,
  ShieldAlert,
  HelpCircle,
  Check,
  WifiOff,
  Wifi
} from 'lucide-react';
import { StudentQuestion } from '../types';
import { api } from '../services/api';
import { saveStudentSessionToFirestore, updateSessionProgressInFirestore } from '../services/firebase';
import { CodeBlock } from './CodeBlock';

interface StudentExamRoomProps {
  sessionData: {
    sessionId: string;
    startedAt: string;
    expiresAt: string;
    questions: StudentQuestion[];
    savedAnswers: Record<string, 'A' | 'B' | 'C' | 'D'>;
    flaggedQuestions?: string[];
    violationCount?: number;
    attemptNumber?: number;
    maxAttempts?: number;
    bestScoreSoFar?: number;
  };
  examInfo: {
    id: string;
    code: string;
    title: string;
    grade: number;
    durationMinutes: number;
    maxViolationsBeforeLock: number;
    maxAttempts?: number;
  };
  studentInfo: {
    name: string;
    class: string;
    sbd?: string;
    username?: string;
  };
  onExit: () => void;
}

export const StudentExamRoom: React.FC<StudentExamRoomProps> = ({
  sessionData,
  examInfo,
  studentInfo,
  onExit,
}) => {
  const [currentSession, setCurrentSession] = useState(sessionData);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>(() => {
    const serverAnswers = sessionData.savedAnswers || {};
    try {
      const offlineLocal = localStorage.getItem(`offline_ans_${sessionData.sessionId}`);
      if (offlineLocal) {
        const parsed = JSON.parse(offlineLocal);
        if (parsed && typeof parsed === 'object') {
          return { ...serverAnswers, ...parsed };
        }
      }
    } catch (e) {}
    return serverAnswers;
  });
  const [flagged, setFlagged] = useState<Set<string>>(
    new Set(sessionData.flaggedQuestions || [])
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitResult, setSubmitResult] = useState<any | null>(null);

  // Anti-cheat state
  const [violationCount, setViolationCount] = useState<number>(
    sessionData.violationCount || 0
  );
  const [isLocked, setIsLocked] = useState(false);
  const [warningModal, setWarningModal] = useState<{
    show: boolean;
    level: 1 | 2;
    message: string;
  }>({ show: false, level: 1, message: '' });
  const [warningCountdown, setWarningCountdown] = useState<number>(10);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsFullscreenPrompt, setNeedsFullscreenPrompt] = useState(false);

  // Lock 60s countdown state
  const [lockCountdown, setLockCountdown] = useState<number>(60);
  const [isLockExiting, setIsLockExiting] = useState<boolean>(false);

  // Network connection state
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [offlineSeconds, setOfflineSeconds] = useState<number>(0);
  const [longDisconnectionModal, setLongDisconnectionModal] = useState<boolean>(false);

  const violationCooldownRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const questions = currentSession.questions;
  const currentQ = questions[currentIdx];
  const maxViolations = examInfo.maxViolationsBeforeLock || 3;

  // Handle exiting lock screen after 1 minute or manually
  const handleLockExit = useCallback(async () => {
    if (isLockExiting) return;
    setIsLockExiting(true);
    try {
      await api.lockExit({ sessionId: currentSession.sessionId });
    } catch (e) {
      console.error('Error exiting lock session:', e);
    } finally {
      onExit();
    }
  }, [currentSession.sessionId, isLockExiting, onExit]);

  // Calculate remaining seconds based on server expiresAt
  const updateTimer = useCallback(() => {
    const expiresMs = new Date(currentSession.expiresAt).getTime();
    const nowMs = Date.now();
    const diff = Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
    setRemainingSeconds(diff);
    return diff;
  }, [currentSession.expiresAt]);

  // Request fullscreen
  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
      setNeedsFullscreenPrompt(false);
    } catch (err) {
      console.warn('Fullscreen request blocked or dismissed:', err);
    }
  };

  // Initial fullscreen prompt
  useEffect(() => {
    enterFullscreen();
  }, []);

  // Timer countdown and auto submit
  useEffect(() => {
    if (submitResult) return;
    const initial = updateTimer();
    if (initial <= 0) {
      handleFinalSubmit();
      return;
    }

    const timer = setInterval(() => {
      const rem = updateTimer();
      if (rem <= 0) {
        clearInterval(timer);
        handleFinalSubmit();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [updateTimer, submitResult]);

  // 60-second timer when locked
  useEffect(() => {
    if (!isLocked || submitResult) return;

    setLockCountdown(60);
    const timer = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleLockExit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked, submitResult, handleLockExit]);

  // 10-second countdown when warning modal appears (auto resume exam if student doesn't click)
  useEffect(() => {
    if (!warningModal.show || submitResult || isLocked) {
      setWarningCountdown(10);
      return;
    }

    setWarningCountdown(10);
    const timer = setInterval(() => {
      setWarningCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setWarningModal({ show: false, level: 1, message: '' });
          setNeedsFullscreenPrompt(false);
          enterFullscreen();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [warningModal.show, submitResult, isLocked]);

  // Network connection monitoring & periodic heartbeat
  useEffect(() => {
    if (submitResult || isLocked) return;

    const handleOnline = () => {
      setIsOffline(false);
      setOfflineSeconds(0);
      api.heartbeat({ sessionId: currentSession.sessionId }).catch(() => {});
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const hbInterval = setInterval(async () => {
      if (!navigator.onLine) {
        setIsOffline(true);
        setOfflineSeconds((prev) => {
          const next = prev + 5;
          if (next >= 120 && !longDisconnectionModal) {
            setLongDisconnectionModal(true);
          }
          return next;
        });
      } else {
        try {
          const res = await api.heartbeat({
            sessionId: currentSession.sessionId,
            examId: examInfo.id,
            studentName: studentInfo.name,
            studentClass: studentInfo.class,
            sbd: studentInfo.sbd,
            violationCount: violationCount,
            answers: answers,
            status: isLocked ? 'locked' : 'in_progress',
            attemptNumber: currentSession.attemptNumber || 1
          });
          if (res.isLocked) {
            setIsLocked(true);
          }
          setIsOffline(false);
          setOfflineSeconds(0);
        } catch (e) {
          setIsOffline(true);
          setOfflineSeconds((prev) => {
            const next = prev + 5;
            if (next >= 120 && !longDisconnectionModal) {
              setLongDisconnectionModal(true);
            }
            return next;
          });
        }
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(hbInterval);
    };
  }, [currentSession.sessionId, submitResult, isLocked, longDisconnectionModal]);

  // Periodic polling when locked to see if teacher unlocked
  useEffect(() => {
    if (!isLocked || submitResult) return;
    const interval = setInterval(async () => {
      try {
        const check = await api.validateStudentEntry({
          examCode: examInfo.code,
          studentName: studentInfo.name,
          studentClass: studentInfo.class,
          sbd: studentInfo.sbd,
        });
        if (check.valid && !check.isLocked) {
          setIsLocked(false);
          setViolationCount(0);
        }
      } catch (e) {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isLocked, examInfo.code, studentInfo, submitResult]);

  const roomEntryTimeRef = useRef(Date.now());
  const lastSyncRef = useRef<number>(Date.now());

  // 1. Register active session in Firestore so Teacher Live Proctoring sees student immediately
  useEffect(() => {
    saveStudentSessionToFirestore({
      sessionId: currentSession.sessionId,
      examId: examInfo.id,
      examCode: examInfo.code,
      studentName: studentInfo.name,
      studentClass: studentInfo.class,
      sbd: studentInfo.sbd,
      status: 'in_progress',
      startedAt: currentSession.startedAt,
      attemptNumber: currentSession.attemptNumber || 1,
      totalQuestions: questions.length,
      violationCount: violationCount,
      answeredCount: Object.keys(answers).length
    }).catch(() => {});
  }, [currentSession.sessionId, examInfo.id, examInfo.code, studentInfo.name, studentInfo.class, studentInfo.sbd, questions.length]);

  // 2. Optimized checkpoint sync: Keep answers in local buffer during exam, sync progress periodically or after 15 mins
  useEffect(() => {
    if (submitResult) return;
    const answeredCount = Object.keys(answers).length;
    const now = Date.now();
    const elapsedMinutes = (now - roomEntryTimeRef.current) / (60 * 1000);
    // After 15 minutes of exam time, periodic 2 minutes, or when violations occur: sync progress to Firestore
    if (elapsedMinutes >= 15 || now - lastSyncRef.current >= 120000 || violationCount > 0 || isLocked) {
      lastSyncRef.current = now;
      updateSessionProgressInFirestore({
        sessionId: currentSession.sessionId,
        answeredCount,
        violationCount,
        isLocked
      }).catch(() => {});
    }
  }, [answers, violationCount, isLocked, submitResult, currentSession.sessionId]);

  // Record Violation Function
  const handleViolation = useCallback(
    async (type: string, description: string) => {
      if (submitResult || isLocked) return;

      // Grace period: First 15 seconds after entering the exam room, ignore fullscreen_exit & blur
      const secondsInRoom = (Date.now() - roomEntryTimeRef.current) / 1000;
      if (secondsInRoom < 15 && (type === 'fullscreen_exit' || type === 'window_blur')) {
        return;
      }

      // Prevent spamming multiple violations in quick succession (8-second cooldown)
      if (violationCooldownRef.current) return;
      violationCooldownRef.current = true;
      setTimeout(() => {
        violationCooldownRef.current = false;
      }, 8000);

      try {
        const res = await api.reportViolation({
          sessionId: currentSession.sessionId,
          type,
          description,
        });

        const newCount = res.violationCount;
        setViolationCount(newCount);

        const effectiveMax = res.maxViolations || maxViolations;
        const remaining = effectiveMax - newCount;

        if (res.isLocked || newCount >= effectiveMax) {
          setIsLocked(true);
          setWarningModal({ show: false, level: 2, message: '' });
        } else if (remaining <= 1) {
          setWarningModal({
            show: true,
            level: 2,
            message: `CẢNH BÁO NGHIÊM TRỌNG (Lần ${newCount}/${effectiveMax}): Nếu bạn vi phạm thêm 1 lần nữa (${description}), bài thi sẽ bị TỰ ĐỘNG KHÓA ngay lập tức!`,
          });
        } else {
          setWarningModal({
            show: true,
            level: 1,
            message: `Cảnh báo vi phạm (Lần ${newCount}/${effectiveMax}): Hệ thống phát hiện bạn vừa rời khỏi màn hình làm bài (${description}). Bạn còn ${remaining} lần trước khi bài thi bị khóa!`,
          });
        }
      } catch (err) {
        console.error('Failed to report violation:', err);
      }
    },
    [currentSession.sessionId, maxViolations, isLocked, submitResult]
  );

  // Anti-Cheat Event Listeners (Tab switch, window blur, fullscreen change)
  useEffect(() => {
    if (submitResult || isLocked) return;

    // 1. Visibility Change (Tab switch or minimize)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('tab_switch', 'Chuyển sang tab hoặc ứng dụng khác');
      }
    };

    // 2. Window Blur (Focus lost - only count if page is actually hidden)
    const handleWindowBlur = () => {
      if (document.hidden) {
        handleViolation('window_blur', 'Cửa sổ kiểm tra bị mất tiêu điểm');
      }
    };

    // 3. Fullscreen Exit
    const handleFullscreenChange = () => {
      const inFs = !!document.fullscreenElement || !!(document as any).webkitFullscreenElement;
      setIsFullscreen(inFs);
      if (!inFs && !submitResult && !isLocked) {
        setNeedsFullscreenPrompt(false);
        handleViolation('fullscreen_exit', 'Thoát khỏi chế độ toàn màn hình');
      }
    };

    // 4. Copy/Cut/Paste prevention
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      handleViolation('copy_attempt', 'Cố gắng sao chép đề bài');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent PrintScreen, F12, Ctrl+Shift+I, Ctrl+U, Ctrl+C, Ctrl+V, Alt+Tab hints
      if (
        e.key === 'PrintScreen' ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J' || e.key === 'S')) ||
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === 's' || e.key === 'S')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P' || e.key === 'c' || e.key === 'C'))
      ) {
        e.preventDefault();
        handleViolation('inspect_attempt', 'Nhấn phím tắt chụp màn hình hoặc sao chép đề');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCopy);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleViolation, submitResult, isLocked]);

  // Handle Option Select (Autosave immediately)
  const handleSelectOption = async (optionId: 'A' | 'B' | 'C' | 'D') => {
    if (isLocked || submitResult) return;
    const newAnswers = { ...answers, [currentQ.id]: optionId };
    setAnswers(newAnswers);

    // Offline fallback storage
    try {
      localStorage.setItem(`offline_ans_${currentSession.sessionId}`, JSON.stringify(newAnswers));
    } catch (e) {}

    // Async save to server
    try {
      await api.saveAnswer({
        sessionId: currentSession.sessionId,
        questionId: currentQ.id,
        optionId,
      });
    } catch (err) {
      console.warn('Autosave warning, saved in local backup:', err);
    }
  };

  // Toggle Flag
  const handleToggleFlag = async () => {
    if (isLocked || submitResult) return;
    const newFlagged = new Set(flagged);
    const isNowFlagged = !newFlagged.has(currentQ.id);

    if (isNowFlagged) {
      newFlagged.add(currentQ.id);
    } else {
      newFlagged.delete(currentQ.id);
    }
    setFlagged(newFlagged);

    try {
      await api.saveAnswer({
        sessionId: currentSession.sessionId,
        questionId: currentQ.id,
        flagged: isNowFlagged,
      });
    } catch (err) {
      console.warn('Failed to update flagged question:', err);
    }
  };

  // Submit action
  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitConfirm(false);

    try {
      const res = await api.submitExam({
        sessionId: currentSession.sessionId,
        examId: examInfo.id,
        examCode: examInfo.code,
        studentName: studentInfo.name,
        studentClass: studentInfo.class,
        sbd: studentInfo.sbd,
        answers: answers,
        questionOrder: currentSession.questions ? currentSession.questions.map(q => q.id) : undefined,
        attemptNumber: currentSession.attemptNumber || 1,
        violationCount: violationCount,
        startedAt: currentSession.startedAt
      });
      setSubmitResult(res);
      // Exit fullscreen peacefully
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (err: any) {
      alert('Có lỗi xảy ra khi nộp bài: ' + (err.message || 'Vui lòng thử lại'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retake action (start next attempt with fresh randomized shuffle)
  const handleRetake = async () => {
    if (isRetaking) return;
    setIsRetaking(true);
    try {
      const res = await api.startExam({
        examCode: examInfo.code,
        studentName: studentInfo.name,
        studentClass: studentInfo.class,
        sbd: studentInfo.sbd,
        forceNew: true,
      });
      setCurrentSession(res);
      setAnswers({});
      setFlagged(new Set());
      setCurrentIdx(0);
      setViolationCount(0);
      setIsLocked(false);
      setSubmitResult(null);
      enterFullscreen();
    } catch (err: any) {
      alert('Không thể bắt đầu làm lại bài thi: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsRetaking(false);
    }
  };

  // Timer formatting
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).filter(k => answers[k] && String(answers[k]).trim()).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);

  const displayAnsweredCount = Math.max(
    0,
    Math.min(
      questions.length,
      submitResult?.answeredCount ??
        (submitResult?.correctCount !== undefined && submitResult?.incorrectCount !== undefined
          ? (submitResult.correctCount + submitResult.incorrectCount)
          : (submitResult?.unansweredCount !== undefined && submitResult.unansweredCount <= questions.length
              ? questions.length - submitResult.unansweredCount
              : answeredCount))
    )
  );
  const displayUnansweredCount = Math.max(0, questions.length - displayAnsweredCount);

  // Render Post-Submission Screen
  if (submitResult) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl text-center">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <CheckCircle className="w-10 h-10" />
          </div>

          <h2 className="text-xl font-bold text-white mb-1">
            ĐÃ NỘP BÀI THÀNH CÔNG!
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            TRƯỜNG THCS NAM CỬA VIỆT - BÀI KIỂM TRA TIN HỌC
          </p>

          <div className="bg-slate-900/80 rounded-xl p-4 text-left border border-slate-700/60 mb-6 space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Họ và tên:</span>
              <span className="font-semibold text-white">{studentInfo.name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Lớp:</span>
              <span className="font-semibold text-white">{studentInfo.class}</span>
            </div>
            {studentInfo.sbd && (
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Số báo danh:</span>
                <span className="font-semibold text-white">{studentInfo.sbd}</span>
              </div>
            )}
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Lượt làm bài:</span>
              <span className="font-bold text-indigo-300">
                Lần {submitResult.attemptNumber || currentSession.attemptNumber || 1} / {submitResult.maxAttempts || examInfo.maxAttempts || 1}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Thời gian nộp:</span>
              <span className="text-slate-300">
                {new Date().toLocaleTimeString('vi-VN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Số câu đã trả lời:</span>
              <span className="font-semibold text-emerald-400">
                {displayAnsweredCount} / {questions.length}
              </span>
            </div>
          </div>

          {submitResult.showScore && submitResult.score !== undefined ? (
            <div className="bg-gradient-to-br from-indigo-950 to-purple-950 border border-indigo-500/30 rounded-xl p-5 mb-6 text-center">
              <p className="text-xs uppercase tracking-wider text-indigo-300 font-semibold mb-1">
                KẾT QUẢ ĐIỂM SỐ LẦN {submitResult.attemptNumber || currentSession.attemptNumber || 1}
              </p>
              <div className="text-4xl font-extrabold text-amber-300 mb-2">
                {submitResult.score} <span className="text-lg text-slate-400">/ 10</span>
              </div>
              <div className="flex justify-center space-x-4 text-xs text-slate-300 mb-3">
                <span>
                  Đúng: <b className="text-emerald-400">{submitResult.correctCount}</b>
                </span>
                <span>
                  Sai: <b className="text-red-400">{submitResult.incorrectCount}</b>
                </span>
                <span>
                  Chưa làm: <b className="text-slate-400">{displayUnansweredCount}</b>
                </span>
              </div>

              {/* Best Score Recognition Card */}
              <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-xl p-3 text-center">
                <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">
                  ⭐ ĐIỂM CAO NHẤT ĐƯỢC GHI NHẬN VÀO HỆ THỐNG
                </span>
                <span className="text-2xl font-black text-amber-300">
                  {submitResult.bestScore !== undefined ? submitResult.bestScore : submitResult.score}{' '}
                  <span className="text-xs text-slate-300 font-normal">/ 10 điểm</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 mb-6 text-xs text-slate-400 text-center">
              Điểm số và đáp án chi tiết sẽ được thầy Lê Gia Lợi công bố sau khi cả lớp hoàn thành bài thi.
            </div>
          )}

          {/* Action Buttons: Retake & Exit */}
          <div className="space-y-3">
            {Boolean(submitResult.canRetake || (submitResult.attemptsRemaining && submitResult.attemptsRemaining > 0)) && (
              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                <button
                  onClick={handleRetake}
                  disabled={isRetaking}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/40 transition cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isRetaking ? (
                    <span>Đang tạo đề thi mới...</span>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>
                        LÀM LẠI BÀI THI (Còn {submitResult.attemptsRemaining} lượt)
                      </span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-400 leading-relaxed text-left">
                  🔄 Thầy cho phép làm tối đa <b>{submitResult.maxAttempts || examInfo.maxAttempts || 1} lần</b> và <b>lấy điểm cao nhất</b>. Ở lần làm tiếp theo, đề thi sẽ <b>tự động đảo thứ tự câu hỏi và đáp án khác</b>.
                </p>
              </div>
            )}

            {/* Blocked banner when all attempts are exhausted */}
            {(!submitResult.canRetake || !submitResult.attemptsRemaining || submitResult.attemptsRemaining <= 0) && (
              <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-3.5 text-center space-y-1">
                <div className="text-xs font-bold text-amber-400 flex items-center justify-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>ĐÃ HOÀN THÀNH ĐỦ SỐ LẦN LÀM BÀI CHO PHÉP</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Em đã hoàn thành đủ <b>{submitResult.attemptsMade || submitResult.maxAttempts || 1}/{submitResult.maxAttempts || examInfo.maxAttempts || 1} lần</b>. Hệ thống không cho phép làm lại thêm. Điểm số cao nhất <b>({submitResult.bestScore !== undefined ? submitResult.bestScore : submitResult.score} điểm ⭐)</b> đã được ghi nhận chính thức vào sổ điểm.
                </p>
              </div>
            )}

            <button
              onClick={onExit}
              className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium transition cursor-pointer text-sm"
            >
              Quay lại trang chính
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Locked Screen
  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-red-950/50 rounded-2xl p-8 border border-red-500/50 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-500/40 animate-pulse">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-red-200">BÀI THI BỊ TẠM KHÓA DO VI PHẠM</h2>
            <p className="text-xs text-red-300/80 mt-1">
              Hệ thống phát hiện vi phạm nội quy ({violationCount} lần: chuyển tab, rời màn hình, hoặc thoát toàn màn hình).
            </p>
          </div>

          {/* 1-Minute Countdown Box */}
          <div className="bg-slate-900/90 rounded-xl p-4 border border-red-900/60 text-center space-y-2">
            <p className="text-xs font-medium text-amber-300">
              Thời gian chờ tự động thoát về màn hình đăng nhập:
            </p>
            <div className="text-4xl font-extrabold font-mono text-amber-400 animate-pulse tracking-wider">
              {lockCountdown}s
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Khi hết 1 phút (hoặc khi bấm quay về), bài thi sẽ kết thúc và <b className="text-red-400">TRỪ 1 LẦN LÀM BÀI</b>.
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-xl p-3.5 text-left border border-slate-800 text-xs space-y-1.5 text-slate-300">
            <p className="font-semibold text-white">Học sinh: {studentInfo.name} - Lớp {studentInfo.class}</p>
            <p className="text-slate-400">
              Mã bài thi: <span className="font-mono text-indigo-300">{examInfo.code}</span>
            </p>
            <p className="text-amber-300/90 font-medium pt-1">
              👉 Báo ngay với <span className="font-bold underline">Thầy Lê Gia Lợi</span> nếu cần mở khóa làm tiếp bài này trong thời gian đếm ngược.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-center space-x-2 text-xs text-indigo-300 bg-indigo-950/40 py-2 rounded-lg border border-indigo-800/40">
              <RotateCcw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Đang chờ thầy giáo mở khóa từ xa ({lockCountdown}s)...</span>
            </div>

            <button
              onClick={handleLockExit}
              disabled={isLockExiting}
              className="w-full py-2.5 bg-red-600 hover:bg-red-500 active:scale-98 text-white rounded-xl font-bold text-xs transition shadow-lg cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>Quay về màn hình đăng nhập (Bị trừ 1 lần làm)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-slate-900 text-slate-100 flex flex-col select-none relative"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Offline Alert Banner (Short Disconnection) */}
      {isOffline && !longDisconnectionModal && (
        <div className="bg-amber-600 text-white font-medium text-xs py-2 px-4 flex items-center justify-between shadow-lg animate-pulse z-50 sticky top-0">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-4 h-4 text-amber-200" />
            <span>
              ⚠️ MẤT KẾT NỐI MẠNG ({offlineSeconds}s/120s)! Hệ thống đang chờ tự động nối lại... Các đáp án của em đã được lưu tạm trên máy.
            </span>
          </div>
          <span className="text-[10px] bg-amber-800 px-2 py-0.5 rounded text-amber-100 font-mono">
            Gián đoạn: {offlineSeconds}s
          </span>
        </div>
      )}

      {/* Long Disconnection Modal (> 2 Minutes) */}
      {longDisconnectionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/60 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/40">
              <WifiOff className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-amber-300">
              MẤT KẾT NỐI MẠNG QUÁ LÂU (&gt; 2 PHÚT)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Hệ thống ghi nhận đường truyền mạng bị gián đoạn quá lâu. Để đảm bảo quyền lợi cho em, lượt làm bài dở dang này đã được <b className="text-amber-400">HỦY BỎ và KHÔNG TÍNH LẦN LÀM BÀI</b>.
            </p>
            <div className="bg-slate-800/80 rounded-xl p-3 text-left border border-slate-700 text-xs text-slate-300">
              <p className="text-emerald-400 font-semibold mb-1">✅ Bạn có thể làm lại bài thi mới:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                <li>Số lượt làm bài của bạn được giữ nguyên, không bị trừ.</li>
                <li>Vui lòng kiểm tra lại kết nối mạng Wi-Fi trước khi bắt đầu lại.</li>
              </ul>
            </div>
            <button
              onClick={onExit}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition cursor-pointer"
            >
              BẮT ĐẦU LÀM LẠI BÀI MỚI
            </button>
          </div>
        </div>
      )}
      {/* Warning Modals (Level 1 & Level 2) */}
      {warningModal.show && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`rounded-2xl p-6 max-w-md w-full text-center shadow-2xl border ${
              warningModal.level === 2
                ? 'bg-red-950/90 border-red-500'
                : 'bg-amber-950/90 border-amber-500'
            }`}
          >
            <AlertTriangle
              className={`w-12 h-12 mx-auto mb-3 ${
                warningModal.level === 2 ? 'text-red-400' : 'text-amber-400'
              }`}
            />
            <h3 className="text-lg font-bold text-white mb-2">
              {warningModal.level === 2
                ? 'CẢNH BÁO VI PHẠM NGHIÊM TRỌNG'
                : 'CẢNH BÁO VI PHẠM QUY CHẾ'}
            </h3>
            <p className="text-sm text-slate-200 mb-4 leading-relaxed">{warningModal.message}</p>

            {/* Auto-return timer indicator (10 seconds) */}
            <div className="mb-4 bg-black/40 rounded-xl p-2.5 border border-white/10">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <span>Tự động quay lại làm bài sau:</span>
                <span className="font-mono font-bold text-amber-300 text-sm bg-black/50 px-2 py-0.5 rounded border border-amber-500/30">
                  {warningCountdown}s
                </span>
              </div>
              <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    warningModal.level === 2 ? 'bg-red-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${Math.max(0, (warningCountdown / 10) * 100)}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => {
                setWarningModal({ show: false, level: 1, message: '' });
                setNeedsFullscreenPrompt(false);
                enterFullscreen();
              }}
              className={`w-full py-2.5 font-bold rounded-xl cursor-pointer transition shadow-lg flex items-center justify-center space-x-2 active:scale-98 ${
                warningModal.level === 2
                  ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-900/50'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-900/50'
              }`}
            >
              <span>Tôi đã hiểu và quay lại làm bài ({warningCountdown}s)</span>
            </button>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
            <HelpCircle className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">
              XÁC NHẬN NỘP BÀI THI
            </h3>
            <div className="bg-slate-900 rounded-xl p-4 my-4 text-sm text-left border border-slate-700/60 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Đã trả lời:</span>
                <span className="font-bold text-emerald-400">
                  {answeredCount} / {questions.length} câu
                </span>
              </div>
              {unansweredCount > 0 && (
                <div className="flex justify-between text-amber-300 font-medium">
                  <span>Còn chưa trả lời:</span>
                  <span>{unansweredCount} câu</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Thời gian còn lại:</span>
                <span className="font-mono text-slate-300">
                  {formatTime(remainingSeconds)}
                </span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p className="text-xs text-amber-400/90 mb-4">
                ⚠️ Bạn vẫn còn {unansweredCount} câu chưa chọn đáp án. Bạn có muốn kiểm tra lại trước khi nộp?
              </p>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium cursor-pointer"
              >
                Tiếp tục làm bài
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Đang nộp...' : 'Đồng ý nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="bg-slate-800/95 border-b border-slate-700 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-md">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              TRƯỜNG THCS NAM CỬA VIỆT
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-300 font-medium">
              BÀI KIỂM TRA TRẮC NGHIỆM TIN HỌC
            </span>
          </div>
          <h1 className="text-sm md:text-base font-bold text-white truncate max-w-md">
            {examInfo.title}
          </h1>
        </div>

        {/* Student Info & Timer */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:block text-right text-xs">
            <div className="font-semibold text-white flex items-center justify-end space-x-1.5">
              <span>{studentInfo.name}</span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px] border border-indigo-400/30">
                Lần {currentSession.attemptNumber || 1}/{examInfo.maxAttempts || currentSession.maxAttempts || 1}
              </span>
            </div>
            <div className="text-slate-400">
              Lớp: <span className="text-indigo-300 font-medium">{studentInfo.class}</span>
              {studentInfo.username && (
                <span className="text-slate-400 font-mono"> ({studentInfo.username})</span>
              )}
              {studentInfo.sbd && ` | SBD: ${studentInfo.sbd}`}
            </div>
          </div>

          {/* Countdown Clock */}
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border font-mono font-bold text-sm sm:text-base transition ${
              remainingSeconds <= 60
                ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse'
                : remainingSeconds <= 300
                ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                : 'bg-slate-900 border-slate-700 text-emerald-400'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTime(remainingSeconds)}</span>
          </div>

          {/* Fullscreen toggle button if not fullscreen */}
          {!isFullscreen && (
            <button
              onClick={enterFullscreen}
              title="Bật toàn màn hình"
              className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Toàn màn hình</span>
            </button>
          )}

          {/* Submit Button */}
          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm flex items-center space-x-1.5 shadow-sm transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Nộp bài</span>
          </button>
        </div>
      </header>

      {/* VIOLATION STATUS BADGE */}
      {violationCount > 0 && (
        <div className="bg-amber-950/40 border-b border-amber-600/30 px-4 py-1 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Số lần cảnh báo vi phạm: <b>{violationCount} / {maxViolations}</b>
            </span>
          </div>
          <span className="text-[11px] text-amber-400/80">
            (Đạt {maxViolations} lần sẽ bị khóa bài)
          </span>
        </div>
      )}

      {/* MAIN EXAM BODY */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Current Question Card */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-xl flex-1 flex flex-col justify-between relative overflow-hidden">
            {/* Dynamic Security Anti-Photography Watermark */}
            <div
              aria-hidden="true"
              className="pointer-events-none select-none absolute inset-0 z-0 overflow-hidden flex flex-wrap content-around justify-around opacity-[0.045] rotate-[-15deg] text-[10px] sm:text-[11px] font-mono font-black text-slate-100 leading-loose tracking-wider uppercase"
            >
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="whitespace-nowrap p-3">
                  {studentInfo.name} • {studentInfo.class} {studentInfo.sbd ? `• SBD:${studentInfo.sbd}` : ''} • THCS NAM CỬA VIỆT • {examInfo.code}
                </div>
              ))}
            </div>

            <div className="relative z-10">
              {/* Question Header & Flag Button */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-700/80">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold uppercase tracking-wide">
                    Câu {currentIdx + 1} / {questions.length}
                  </span>
                  {answers[currentQ.id] ? (
                    <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã chọn ({answers[currentQ.id]})</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Chưa chọn đáp án</span>
                  )}
                </div>

                <button
                  onClick={handleToggleFlag}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer border ${
                    flagged.has(currentQ.id)
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300 border-slate-600'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>
                    {flagged.has(currentQ.id) ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại'}
                  </span>
                </button>
              </div>

              {/* Question Content */}
              <div className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed mb-4">
                {currentQ.content}
              </div>

              {/* Code Snippet (Python, Pascal, C++, Scratch) */}
              {currentQ.codeSnippet && (
                <CodeBlock
                  code={currentQ.codeSnippet}
                  language={currentQ.codeLanguage}
                  selectable={false}
                />
              )}

              {/* Optional Question Image */}
              {currentQ.imageUrl && (
                <div className="my-3 rounded-lg overflow-hidden border border-slate-700 max-h-64 flex justify-center bg-slate-900">
                  <img
                    src={currentQ.imageUrl}
                    alt="Hình minh họa câu hỏi"
                    className="object-contain max-h-64 pointer-events-none select-none"
                  />
                </div>
              )}

              {/* Four Options (A, B, C, D) */}
              <div className="mt-6 space-y-3">
                {currentQ.options.map((option) => {
                  const isSelected = answers[currentQ.id] === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelectOption(option.id)}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition flex items-start space-x-3.5 cursor-pointer group ${
                        isSelected
                          ? 'bg-indigo-950/70 border-indigo-500 text-white ring-2 ring-indigo-500/40 shadow-md'
                          : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-200'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-bold text-sm transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-700 text-slate-300 group-hover:bg-slate-600'
                        }`}
                      >
                        {option.id}
                      </span>
                      <span className="text-sm sm:text-base pt-0.5 leading-relaxed">
                        {option.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-700/80 relative z-10">
              <button
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:pointer-events-none text-slate-200 rounded-xl text-sm font-medium flex items-center space-x-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Câu trước</span>
              </button>

              <span className="text-xs text-slate-400 font-mono">
                {currentIdx + 1} / {questions.length}
              </span>

              <button
                onClick={() =>
                  setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))
                }
                disabled={currentIdx === questions.length - 1}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl text-sm font-medium flex items-center space-x-1 cursor-pointer"
              >
                <span>Câu tiếp</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Question Palette (Bảng số câu hỏi) */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                BẢNG SỐ CÂU HỎI
              </h2>
              <span className="text-xs font-semibold text-emerald-400">
                {answeredCount}/{questions.length} câu
              </span>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 mb-4 pb-3 border-b border-slate-700/60">
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-emerald-600 inline-block"></span>
                <span>Đã làm</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-slate-700 border border-slate-600 inline-block"></span>
                <span>Chưa làm</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-amber-500 inline-block"></span>
                <span>Xem lại</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded border-2 border-indigo-400 inline-block"></span>
                <span>Đang xem</span>
              </div>
            </div>

            {/* Questions Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2 max-h-[360px] overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIdx;
                const isAnswered = !!answers[q.id];
                const isFlagged = flagged.has(q.id);

                let btnClass = 'bg-slate-700 text-slate-300 hover:bg-slate-600';
                if (isFlagged) {
                  btnClass = 'bg-amber-500 text-slate-950 font-bold';
                } else if (isAnswered) {
                  btnClass = 'bg-emerald-600 text-white font-bold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`relative h-10 rounded-lg text-sm transition flex items-center justify-center cursor-pointer ${btnClass} ${
                      isCurrent
                        ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-indigo-400 font-extrabold scale-105 z-10'
                        : ''
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Submit Block */}
            <div className="mt-5 pt-4 border-t border-slate-700">
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>NỘP BÀI THI ({answeredCount}/{questions.length})</span>
              </button>
            </div>
          </div>

          {/* Exam info summary */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 text-xs text-slate-400 space-y-1">
            <div className="text-slate-300 font-semibold mb-1">
              Lưu ý chống gian lận:
            </div>
            <p>• Không chuyển tab hoặc mở ứng dụng khác trong khi làm bài.</p>
            <p>• Hệ thống tự động ghi nhận thời điểm vi phạm và khóa bài sau 3 lần.</p>
            <p>• Hết thời gian làm bài, hệ thống sẽ tự động nộp bài ngay lập tức.</p>
          </div>
        </div>
      </main>
    </div>
  );
};
