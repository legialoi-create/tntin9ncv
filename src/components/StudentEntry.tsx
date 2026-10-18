import React, { useState, useEffect } from 'react';
import {
  FileText,
  User,
  School,
  Hash,
  Play,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Clock,
  CheckCircle2,
  Lock,
  RotateCw,
  Users,
  Check,
  X,
  Eye,
  EyeOff,
  KeyRound,
  Key,
  Save
} from 'lucide-react';
import { ClassInfo, StudentInfo, Exam } from '../types';
import { api } from '../services/api';

interface StudentEntryProps {
  onStartExam: (sessionData: any, examInfo: any, studentInfo: any) => void;
  initialExamCode?: string;
}

export const StudentEntry: React.FC<StudentEntryProps> = ({
  onStartExam,
  initialExamCode = '',
}) => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [isManualExamCode, setIsManualExamCode] = useState(false);
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [examCode, setExamCode] = useState(initialExamCode || '');
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [sbd, setSbd] = useState('');

  // Password state for student login
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Change password state (once logged in, before starting exam)
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changePasswordFeedback, setChangePasswordFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Helper to compute username: 2 last words of name + class
  const computeUsername = (name: string, cls: string) => {
    if (!name) return '';
    const words = name.trim().split(/\s+/).filter(Boolean);
    const lastTwo = words.length >= 2 ? words.slice(-2).join('') : words.join('');
    const cleanName = lastTwo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
    const cleanClass = (cls || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${cleanName}${cleanClass}`;
  };

  // Class student roster state
  const [classStudents, setClassStudents] = useState<StudentInfo[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [isManualInput, setIsManualInput] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Verification step (before launching exam)
  const [verifiedInfo, setVerifiedInfo] = useState<{
    exam: any;
    student: any;
    hasActiveSession: boolean;
    isLocked: boolean;
    attemptsMade?: number;
    maxAttempts?: number;
    attemptsRemaining?: number;
    bestScore?: number;
    nextAttemptNumber?: number;
    pastAttempts?: any[];
  } | null>(null);

  const [blockedAttemptInfo, setBlockedAttemptInfo] = useState<{
    attemptsMade: number;
    maxAttempts: number;
    bestScore?: number;
    studentName: string;
    studentClass: string;
    sbd?: string;
    pastAttempts?: Array<{
      sessionId: string;
      attemptNumber: number;
      score: number;
      submittedAt?: string;
    }>;
    message: string;
  } | null>(null);

  useEffect(() => {
    // Load class list from backend
    api.getClasses()
      .then((cls) => {
        setClasses(cls);
        if (cls.length > 0 && !studentClass) {
          setStudentClass(cls[0].name);
        }
      })
      .catch((err) => console.error('Failed to load classes:', err));
  }, []);

  // Load available exams from backend
  useEffect(() => {
    setIsLoadingExams(true);
    api.getExams()
      .then((data) => {
        setExams(data);
        if (initialExamCode) {
          const found = data.find(
            (e) =>
              e.code.toUpperCase() === initialExamCode.toUpperCase() ||
              e.id === initialExamCode
          );
          if (found) {
            setSelectedExamId(found.id);
            setExamCode(found.code);
          } else {
            setExamCode(initialExamCode);
            setIsManualExamCode(true);
          }
        } else if (data.length > 0) {
          const openExam = data.find((e) => e.isOpen) || data[0];
          setSelectedExamId(openExam.id);
          setExamCode(openExam.code);
        }
      })
      .catch((err) => {
        console.error('Failed to load exams:', err);
      })
      .finally(() => setIsLoadingExams(false));
  }, [initialExamCode]);

  // When selected class changes, check if there's an exam matching this grade
  useEffect(() => {
    if (!studentClass || isManualExamCode || exams.length === 0) return;
    const currentClassInfo = classes.find((c) => c.name === studentClass);
    if (currentClassInfo) {
      const currentExam = exams.find((e) => e.id === selectedExamId);
      if (!currentExam || currentExam.grade !== currentClassInfo.grade) {
        const gradeExams = exams.filter((e) => e.grade === currentClassInfo.grade);
        if (gradeExams.length > 0) {
          const openExam = gradeExams.find((e) => e.isOpen) || gradeExams[0];
          setSelectedExamId(openExam.id);
          setExamCode(openExam.code);
        }
      }
    }
  }, [studentClass, classes, exams]);

  // When selected class changes, load its student roster
  useEffect(() => {
    if (!studentClass) return;
    setIsLoadingStudents(true);
    api.getStudents(studentClass)
      .then((students) => {
        setClassStudents(students);
        setSelectedStudentId('');
        // If students exist, default to selecting from roster
        if (students.length > 0) {
          setIsManualInput(false);
        } else {
          setIsManualInput(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load class students:', err);
        setClassStudents([]);
        setIsManualInput(true);
      })
      .finally(() => setIsLoadingStudents(false));
  }, [studentClass]);

  const handleSelectExam = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedExamId(val);

    if (val === '__custom__') {
      setIsManualExamCode(true);
      setExamCode('');
      return;
    }

    const found = exams.find((x) => x.id === val);
    if (found) {
      setExamCode(found.code);
    } else {
      setExamCode('');
    }
  };

  const handleSelectStudent = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedStudentId(val);

    if (val === '__custom__') {
      setIsManualInput(true);
      setStudentName('');
      return;
    }

    const found = classStudents.find((s) => s.id === val);
    if (found) {
      setStudentName(found.name);
      if (found.sbd) {
        setSbd(found.sbd);
      }
      const defaultPass = `${studentClass.toUpperCase().replace(/[^A-Z0-9]/g, '')}123`;
      if (!password.trim()) {
        setPassword(defaultPass);
      }
    } else {
      setStudentName('');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!studentName.trim()) {
      setErrorMsg('Vui lòng chọn hoặc nhập họ và tên của bạn');
      return;
    }
    if (!studentClass) {
      setErrorMsg('Vui lòng chọn lớp');
      return;
    }
    if (!password.trim()) {
      const defaultPass = `${studentClass.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}123`;
      setErrorMsg(`Vui lòng nhập mật khẩu đăng nhập. Mật khẩu mặc định là tên lớp thêm 123 (Ví dụ: ${defaultPass}).`);
      return;
    }
    let codeToValidate = examCode.trim();
    if (!codeToValidate && selectedExamId) {
      const found = exams.find((e) => e.id === selectedExamId);
      if (found) {
        codeToValidate = found.code;
        setExamCode(found.code);
      }
    }

    if (!codeToValidate) {
      setErrorMsg('Vui lòng chọn bài kiểm tra từ danh sách');
      return;
    }

    const selectedStudent = classStudents.find((s) => s.id === selectedStudentId);
    const assignedUsername = selectedStudent?.username || computeUsername(studentName, studentClass);

    setIsLoading(true);
    try {
      const res = await api.validateStudentEntry({
        examCode: codeToValidate,
        studentName: studentName.trim(),
        studentClass: studentClass.trim(),
        sbd: sbd.trim(),
        username: assignedUsername,
        password: password.trim(),
      });

      setVerifiedInfo({
        exam: res.exam,
        student: res.student,
        hasActiveSession: res.hasActiveSession,
        isLocked: res.isLocked,
        attemptsMade: (res as any).attemptsMade,
        maxAttempts: (res as any).maxAttempts,
        attemptsRemaining: (res as any).attemptsRemaining,
        bestScore: (res as any).bestScore,
        nextAttemptNumber: (res as any).nextAttemptNumber,
        pastAttempts: (res as any).pastAttempts,
      });
      setCurrentPasswordInput(password.trim());
      setBlockedAttemptInfo(null);
    } catch (err: any) {
      if (
        err.data?.hasCompletedAllAttempts ||
        (err.data?.attemptsMade !== undefined && err.data?.attemptsMade >= (err.data?.maxAttempts || 1)) ||
        (err.message && (err.message.includes('quá số lần') || err.message.includes('hoàn thành đủ')))
      ) {
        setBlockedAttemptInfo({
          attemptsMade: err.data?.attemptsMade ?? 1,
          maxAttempts: err.data?.maxAttempts ?? 1,
          bestScore: err.data?.bestScore,
          studentName: studentName.trim(),
          studentClass: studentClass.trim(),
          sbd: sbd ? sbd.trim() : undefined,
          pastAttempts: err.data?.pastAttempts,
          message: err.message || 'Bạn đã quá số lần làm bài cho phép của bài kiểm tra này.'
        });
        setErrorMsg(null);
      } else {
        setBlockedAttemptInfo(null);
        setErrorMsg(err.message || 'Không thể xác thực thông tin bài kiểm tra');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmStart = async () => {
    if (!verifiedInfo) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.startExam({
        examCode: verifiedInfo.exam.code,
        studentName: verifiedInfo.student.name,
        studentClass: verifiedInfo.student.class,
        sbd: verifiedInfo.student.sbd,
      });

      onStartExam(res, verifiedInfo.exam, verifiedInfo.student);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể bắt đầu làm bài thi. Vui lòng kiểm tra lại phòng thi hoặc liên hệ giáo viên.');
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordFeedback(null);

    if (!verifiedInfo) return;

    if (!newPasswordInput || newPasswordInput.trim().length < 4) {
      setChangePasswordFeedback({
        type: 'error',
        message: 'Mật khẩu mới phải có ít nhất 4 ký tự',
      });
      return;
    }

    if (newPasswordInput.trim() !== confirmPasswordInput.trim()) {
      setChangePasswordFeedback({
        type: 'error',
        message: 'Mật khẩu xác nhận không khớp với mật khẩu mới',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await api.changeStudentPassword({
        studentId: verifiedInfo.student.id,
        username: verifiedInfo.student.username,
        currentPassword: currentPasswordInput.trim() || password.trim(),
        newPassword: newPasswordInput.trim(),
      });

      setVerifiedInfo((prev) =>
        prev
          ? {
              ...prev,
              student: {
                ...prev.student,
                isPasswordChanged: true,
              },
            }
          : null
      );
      setPassword(newPasswordInput.trim());
      setChangePasswordFeedback({
        type: 'success',
        message:
          res.message ||
          'Đã đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới để đăng nhập cho các bài thi sau.',
      });
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setTimeout(() => {
        setShowChangePasswordForm(false);
      }, 3500);
    } catch (err: any) {
      setChangePasswordFeedback({
        type: 'error',
        message: err.message || 'Lỗi đổi mật khẩu, vui lòng kiểm tra lại mật khẩu hiện tại',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const selectedExam = exams.find(
    (e) => e.id === selectedExamId || (examCode && e.code.toUpperCase() === examCode.trim().toUpperCase())
  );

  return (
    <div className="max-w-2xl mx-auto py-1 sm:py-2 px-2 sm:px-4">
      {/* Banner */}
      <div className="text-center mb-3 sm:mb-4">
        <span className="inline-block px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-1">
          HỆ THỐNG KIỂM TRA TRẮC NGHIỆM TIN HỌC TRỰC TUYẾN
        </span>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
          TRƯỜNG THCS NAM CỬA VIỆT
        </h1>
        <p className="text-xs text-slate-600 mt-0.5">
          Giáo viên phụ trách: <span className="font-semibold text-slate-800">Thầy Lê Gia Lợi</span>
        </p>
      </div>

      {!verifiedInfo ? (
        /* Form Điền thông tin vào thi */
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200/90 p-4 sm:p-5">
          <div className="flex items-center space-x-2.5 mb-3.5 pb-2.5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Thông tin thí sinh vào phòng thi
              </h2>
              <p className="text-[11px] text-slate-500">
                Học sinh nhập đúng họ tên và lớp để hệ thống ghi nhận điểm chính xác
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div>{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-3 sm:space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Danh sách bài kiểm tra <span className="text-red-500">*</span>
              </label>

              {!isManualExamCode && exams.length > 0 ? (
                <div>
                  <div className="relative">
                    <select
                      value={selectedExamId}
                      onChange={handleSelectExam}
                      required
                      className="w-full px-3.5 py-2 sm:py-2.5 bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 text-xs sm:text-sm font-semibold transition outline-none cursor-pointer"
                    >
                      <option value="">
                        -- Chọn bài kiểm tra từ danh sách ({exams.length} bài) --
                      </option>
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title} (Khối {ex.grade} - {ex.durationMinutes} phút) {!ex.isOpen ? '🔒 [Chưa mở]' : '🟢 [Đang mở]'}
                        </option>
                      ))}
                      <option value="__custom__">
                        ✏️ Tự gõ mã khác (nếu cần nhập mã riêng)
                      </option>
                    </select>
                  </div>

                  {selectedExam && (
                    <div className="mt-1.5 p-2 sm:p-2.5 bg-gradient-to-r from-indigo-50/90 to-blue-50/90 border border-indigo-200/80 rounded-lg flex flex-wrap items-center justify-between gap-1.5 text-xs">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${selectedExam.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                        <div>
                          <div className="font-bold text-slate-900 text-xs sm:text-sm leading-tight">{selectedExam.title}</div>
                          <div className="text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                            <span className="font-semibold text-indigo-700">Khối {selectedExam.grade}</span>
                            <span>•</span>
                            <span>Thời gian: <b>{selectedExam.durationMinutes} phút</b></span>
                            <span>•</span>
                            <span>
                              Số câu:{' '}
                              <b>
                                {selectedExam.randomQuestionCount &&
                                selectedExam.randomQuestionCount > 0 &&
                                selectedExam.randomQuestionCount < ((selectedExam as any).questionCount || selectedExam.questions?.length || 0)
                                  ? `${selectedExam.randomQuestionCount} câu (bốc ngẫu nhiên / ${(selectedExam as any).questionCount || selectedExam.questions?.length || 0} câu)`
                                  : `${(selectedExam as any).questionCount || selectedExam.questions?.length || 0} câu`}
                              </b>
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] sm:text-[11px] ${selectedExam.isOpen ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                        {selectedExam.isOpen ? '🟢 Đang mở phòng thi' : '🔒 Chưa mở phòng thi'}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-end mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualExamCode(true);
                        setExamCode('');
                      }}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                    >
                      Tự gõ mã khác nếu cần
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={examCode}
                      onChange={(e) => setExamCode(e.target.value)}
                      placeholder="Ví dụ: TIN8-NCV01 hoặc TIN7-NCV02"
                      className="w-full px-3.5 py-2 sm:py-2.5 bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 font-mono text-xs sm:text-sm font-semibold uppercase tracking-wider transition outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[11px] text-slate-400">
                      {exams.length === 0 && !isLoadingExams
                        ? '(Chưa có danh sách đề thi nạp sẵn, học sinh nhập mã theo hướng dẫn)'
                        : '(Nhập mã theo hướng dẫn của thầy Lê Gia Lợi tại phòng máy)'}
                    </p>
                    {exams.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualExamCode(false);
                          const first = exams.find((e) => e.isOpen) || exams[0];
                          setSelectedExamId(first.id);
                          setExamCode(first.code);
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline ml-2"
                      >
                        Quay lại chọn từ danh sách
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Lớp học <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 sm:py-2.5 bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 text-xs sm:text-sm font-semibold transition outline-none cursor-pointer"
                  >
                    {classes.map((c) => (
                      <option key={c.name} value={c.name}>
                        Lớp {c.name} (Khối {c.grade})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Số báo danh / Mã học sinh
                </label>
                <input
                  type="text"
                  value={sbd}
                  onChange={(e) => setSbd(e.target.value)}
                  placeholder="Ví dụ: 08A-12 (Tùy chọn)"
                  className="w-full px-3.5 py-2 sm:py-2.5 bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 text-xs sm:text-sm transition outline-none"
                />
              </div>
            </div>

            {/* Student Name Selection / Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Họ và tên học sinh <span className="text-red-500">*</span>
                </label>
                {classStudents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualInput(!isManualInput);
                      if (isManualInput) {
                        setSelectedStudentId('');
                      }
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline flex items-center space-x-1"
                  >
                    <Users className="w-3 h-3" />
                    <span>{isManualInput ? 'Chọn từ danh sách lớp' : 'Tự gõ tên khác'}</span>
                  </button>
                )}
              </div>

              {!isManualInput && classStudents.length > 0 ? (
                <div className="space-y-1.5">
                  {classStudents.length > 8 && (
                    <div className="relative mb-1">
                      <input
                        type="text"
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        placeholder={`🔍 Gõ để lọc nhanh tên bạn trong lớp ${studentClass}...`}
                        className="w-full px-3 py-1 bg-indigo-50/50 border border-indigo-200 rounded-lg text-xs text-indigo-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-indigo-500"
                      />
                    </div>
                  )}

                  <select
                    value={selectedStudentId}
                    onChange={handleSelectStudent}
                    required
                    className="w-full px-3.5 py-2 sm:py-2.5 bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 text-xs sm:text-sm font-semibold transition outline-none cursor-pointer"
                  >
                    <option value="">
                      -- Bấm vào đây để chọn tên bạn trong lớp {studentClass} ({classStudents.length} học sinh) --
                    </option>
                    {classStudents
                      .filter((st) => {
                        if (!studentSearchQuery.trim()) return true;
                        const q = studentSearchQuery.toLowerCase();
                        return (
                          st.name.toLowerCase().includes(q) ||
                          (st.sbd && st.sbd.toLowerCase().includes(q))
                        );
                      })
                      .map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.sbd ? `[SBD: ${st.sbd}] ` : ''}{st.name}
                        </option>
                      ))}
                    <option value="__custom__">
                      ✏️ Tự nhập tên khác (nếu em không có trong danh sách trên)
                    </option>
                  </select>

                  {selectedStudentId && selectedStudentId !== '__custom__' && (
                    <div className="flex items-center space-x-1.5 text-[11px] text-emerald-600 font-semibold px-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã chọn: {studentName} {sbd ? `(SBD: ${sbd})` : ''}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn An"
                    className="w-full px-3.5 py-2 sm:py-2.5 bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 text-xs sm:text-sm font-medium transition outline-none"
                  />
                  {classStudents.length === 0 && !isLoadingStudents && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      (Lớp {studentClass} chưa có danh sách nạp sẵn, học sinh tự nhập họ tên)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Student Account Name Preview if student selected or typed */}
            {studentName && studentClass && (
              <div className="p-2 bg-indigo-50/70 border border-indigo-200/70 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[11px] text-slate-700">
                    Tên đăng nhập (Name):
                  </span>
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                    {computeUsername(studentName, studentClass)}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  (2 chữ cuối tên + lớp)
                </span>
              </div>
            )}

            {/* Password Input for Student Login */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <Lock className="w-3 h-3 text-indigo-600" />
                  <span>Mật khẩu đăng nhập <span className="text-red-500">*</span></span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  Mặc định: <b className="font-mono text-indigo-700">{studentClass || 'TênLớp'}123</b>
                </span>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`Nhập mật khẩu của em (Mặc định: ${studentClass || 'TênLớp'}123)`}
                  className="w-full px-3.5 py-2 sm:py-2.5 pr-10 bg-slate-50 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 text-xs sm:text-sm font-semibold transition outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="mt-1 p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg text-[11px] text-indigo-950 flex items-start space-x-2">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-snug">
                  <p>
                    Mật khẩu ban đầu là <b>{studentClass || 'TênLớp'}123</b>.
                  </p>
                  <p className="text-indigo-800">
                    💡 Sau khi đăng nhập, em có thể <b>đổi mật khẩu riêng</b> để tránh bạn khác dùng chung tài khoản!
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-200 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-3 sm:mt-4 text-xs sm:text-sm"
            >
              {isLoading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Đang xác thực thông tin đăng nhập...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>ĐĂNG NHẬP VÀ VÀO PHÒNG THI</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Màn hình Xác nhận thông tin và Nội quy thi */
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200/90 p-4 sm:p-5">
          <div className="text-center pb-3 border-b border-slate-100">
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider inline-block mb-1">
              SẴN SÀNG LÀM BÀI KIỂM TRA
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
              {verifiedInfo.exam.title}
            </h2>
            <p className="text-xs font-mono text-indigo-600 font-semibold mt-0.5">
              Mã đề: {verifiedInfo.exam.code} • Khối {verifiedInfo.exam.grade}
            </p>
          </div>

          {errorMsg && (
            <div className="my-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Student Info Card */}
          <div className="bg-slate-50 rounded-xl p-3 my-3 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 block">Thí sinh:</span>
              <span className="font-bold text-slate-900">{verifiedInfo.student.name}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Lớp:</span>
              <span className="font-bold text-slate-900">{verifiedInfo.student.class}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Tên đăng nhập (Name):</span>
              <span className="font-mono font-bold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-200 inline-block">
                {verifiedInfo.student.username}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Thời gian:</span>
              <span className="font-bold text-indigo-700 flex items-center space-x-1">
                <Clock className="w-3 h-3 inline" />
                <span>{verifiedInfo.exam.durationMinutes} phút</span>
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Số lượng câu làm:</span>
              <span className="font-bold text-slate-900">
                {verifiedInfo.exam.randomQuestionCount &&
                verifiedInfo.exam.randomQuestionCount > 0 &&
                verifiedInfo.exam.randomQuestionCount < verifiedInfo.exam.questionCount ? (
                  <span className="text-purple-700 font-extrabold">
                    {verifiedInfo.exam.randomQuestionCount} câu{' '}
                    <span className="text-[11px] text-slate-500 font-normal">
                      (bốc ngẫu nhiên / {verifiedInfo.exam.questionCount} câu)
                    </span>
                  </span>
                ) : (
                  <span>{verifiedInfo.exam.questionCount} câu trắc nghiệm</span>
                )}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Số lần làm bài:</span>
              <span className="font-bold text-emerald-700">
                Tối đa {verifiedInfo.maxAttempts || 1} lần (Lấy điểm cao nhất)
              </span>
            </div>
            {verifiedInfo.student.sbd && (
              <div>
                <span className="text-[11px] text-slate-500 block">Số báo danh:</span>
                <span className="font-bold text-slate-900">{verifiedInfo.student.sbd}</span>
              </div>
            )}
            <div>
              <span className="text-[11px] text-slate-500 block">Bảo mật tài khoản:</span>
              <span className="font-semibold text-[11px]">
                {verifiedInfo.student.isPasswordChanged ? (
                  <span className="text-emerald-700">🟢 Đã đổi MK riêng</span>
                ) : (
                  <span className="text-amber-700">🟡 Dùng MK mặc định ({verifiedInfo.student.class}123)</span>
                )}
              </span>
            </div>
          </div>

          {/* Ô ĐỔI MẬT KHẨU CHO HỌC SINH TRƯỚC KHI VÀO THI */}
          <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-slate-50 border border-indigo-200 rounded-xl p-3 sm:p-3.5 my-3">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2 pb-2.5 border-b border-indigo-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <KeyRound className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-1.5">
                    <span>Ô ĐỔI MẬT KHẨU CÁ NHÂN</span>
                    <span className="text-[11px] text-indigo-600 font-normal lowercase">(tránh lộ mật khẩu chung)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Tên đăng nhập của em: <b className="font-mono text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200">{verifiedInfo.student.username}</b>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {verifiedInfo.student.isPasswordChanged ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đã có MK riêng an toàn</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mật khẩu mặc định ({verifiedInfo.student.class}123)</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowChangePasswordForm(!showChangePasswordForm);
                    setChangePasswordFeedback(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer border ${
                    showChangePasswordForm
                      ? 'bg-slate-200 text-slate-800 border-slate-300'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-xs'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{showChangePasswordForm ? 'Đóng ô đổi MK' : (verifiedInfo.student.isPasswordChanged ? 'Đổi mật khẩu khác' : 'Đổi mật khẩu riêng ngay')}</span>
                </button>
              </div>
            </div>

            {!showChangePasswordForm && !verifiedInfo.student.isPasswordChanged && (
              <div className="text-xs text-indigo-900 bg-white/80 p-3 rounded-xl border border-indigo-100 flex items-start space-x-2">
                <span className="text-sm">💡</span>
                <p className="leading-relaxed">
                  <b>Khuyên dùng:</b> Mật khẩu mặc định ban đầu là <b>{verifiedInfo.student.class}123</b> là mật khẩu chung của lớp. Để tránh bị bạn khác dùng tài khoản của em, em nên bấm nút <b>"Đổi mật khẩu riêng ngay"</b> ở trên trước khi bấm bắt đầu làm bài!
                </p>
              </div>
            )}

            {showChangePasswordForm && (
              <form onSubmit={handleChangePassword} className="space-y-3 pt-2 text-xs">
                {changePasswordFeedback && (
                  <div
                    className={`p-3 rounded-xl font-semibold flex items-center space-x-2 border text-xs ${
                      changePasswordFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-red-50 text-red-800 border-red-200'
                    }`}
                  >
                    {changePasswordFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{changePasswordFeedback.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">
                      Mật khẩu hiện tại
                    </label>
                    <input
                      type="password"
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      placeholder={`Mặc định: ${verifiedInfo.student.class}123`}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">
                      Mật khẩu mới (ít nhất 4 ký tự) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Nhập mật khẩu mới của em"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">
                      Nhập lại mật khẩu mới <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      placeholder="Xác nhận lại mật khẩu mới"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowChangePasswordForm(false)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isChangingPassword ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Lưu mật khẩu mới</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Previous Attempts Info Banner */}
          {Boolean(verifiedInfo.attemptsMade && verifiedInfo.attemptsMade > 0) && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 my-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-900 uppercase flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                  <span>Tiến độ thi của em</span>
                </span>
                <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-full">
                  Lần {verifiedInfo.nextAttemptNumber || ((verifiedInfo.attemptsMade || 0) + 1)} / {verifiedInfo.maxAttempts || 1}
                </span>
              </div>
              <div className="text-xs text-indigo-950 space-y-1.5">
                <p>
                  Em đã hoàn thành <b>{verifiedInfo.attemptsMade}</b> lượt thi. Điểm cao nhất hiện tại của em:{' '}
                  <b className="text-emerald-700 text-sm font-black">{verifiedInfo.bestScore ?? 0} / 10 điểm</b>.
                </p>
                <div className="flex items-start space-x-1.5 text-indigo-700 text-[11px] pt-1 border-t border-indigo-100">
                  <span>💡</span>
                  <span>
                    Hệ thống sẽ <b>lấy điểm cao nhất</b> trong các lần làm của em. Ở lần thi này, <b>đề thi và các phương án ABCD sẽ tự động đảo thứ tự ngẫu nhiên khác với lần trước</b>.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Exam Rules & Anti-cheat warning */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 my-3">
            <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs sm:text-sm mb-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>NỘI QUY PHÒNG THI & QUY CHẾ CHỐNG GIAN LẬN</span>
            </div>
            <ul className="text-[11px] sm:text-xs text-amber-950/90 space-y-1 list-disc pl-4 sm:pl-5">
              <li>
                <b>Chế độ toàn màn hình:</b> Bắt buộc làm bài ở chế độ toàn màn hình máy tính.
              </li>
              <li>
                <b>Phát hiện chuyển tab:</b> Không chuyển sang tab khác, không thu nhỏ trình duyệt, không mở phần mềm khác.
              </li>
              <li>
                <b>Tự động khóa bài:</b> Hệ thống ghi nhận từng lượt vi phạm. Nếu vi phạm quá{' '}
                <b>{verifiedInfo.exam.maxViolationsBeforeLock} lần</b>, bài thi sẽ bị <b>KHÓA NGAY LẬP TỨC</b> và phải xin phép thầy Lê Gia Lợi mở khóa.
              </li>
              <li>
                <b>Tự động lưu:</b> Hệ thống tự động lưu từng câu khi bạn click chọn đáp án.
              </li>
              <li>
                <b>Đảo đề ngẫu nhiên:</b>{' '}
                {verifiedInfo.exam.randomQuestionCount &&
                verifiedInfo.exam.randomQuestionCount > 0 &&
                verifiedInfo.exam.randomQuestionCount < verifiedInfo.exam.questionCount ? (
                  <span>
                    Đề thi tự động bốc ngẫu nhiên <b>{verifiedInfo.exam.randomQuestionCount} câu</b> từ ngân hàng {verifiedInfo.exam.questionCount} câu. Mỗi học sinh và mỗi lần làm lại sẽ nhận bộ câu hỏi khác nhau và xáo trộn vị trí đáp án ABCD.
                  </span>
                ) : (
                  <span>Mỗi lần vào làm sẽ được xáo trộn thứ tự câu hỏi và phương án ABCD khác nhau.</span>
                )}
              </li>
              <li>
                <b>Hết giờ:</b> Hệ thống tự động nộp bài khi đồng hồ đếm ngược về 00:00.
              </li>
            </ul>
          </div>

          <div className="flex space-x-2.5 pt-1">
            <button
              onClick={() => setVerifiedInfo(null)}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-xs sm:text-sm transition cursor-pointer"
            >
              Quay lại sửa thông tin
            </button>

            <button
              onClick={handleConfirmStart}
              disabled={isLoading}
              className="flex-1 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-200 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 text-xs sm:text-sm"
            >
              {isLoading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Đang khởi tạo bài thi...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {verifiedInfo.attemptsMade && verifiedInfo.attemptsMade > 0
                      ? `BẮT ĐẦU LÀM LẦN ${verifiedInfo.nextAttemptNumber || (verifiedInfo.attemptsMade + 1)} (ĐẢO ĐỀ MỚI)`
                      : 'BẮT ĐẦU KIỂM TRA'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Blocked Attempt Modal: Exceeded Max Attempts */}
      {blockedAttemptInfo && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base uppercase tracking-tight">
                    ĐÃ QUÁ SỐ LẦN LÀM BÀI CHO PHÉP
                  </h3>
                  <p className="text-xs text-red-100">
                    Hệ thống không cho phép vào làm thêm lần nào nữa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBlockedAttemptInfo(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50/70 border border-red-200 rounded-xl p-4 text-xs text-red-950 space-y-2">
                <div className="flex justify-between items-center border-b border-red-100 pb-2">
                  <span className="text-slate-600">Thí sinh:</span>
                  <span className="font-bold text-slate-900 text-sm">{blockedAttemptInfo.studentName}</span>
                </div>
                <div className="flex justify-between items-center border-b border-red-100 pb-2">
                  <span className="text-slate-600">Lớp:</span>
                  <span className="font-bold text-slate-900">{blockedAttemptInfo.studentClass}</span>
                </div>
                {blockedAttemptInfo.sbd && (
                  <div className="flex justify-between items-center border-b border-red-100 pb-2">
                    <span className="text-slate-600">Số báo danh:</span>
                    <span className="font-semibold text-slate-900">{blockedAttemptInfo.sbd}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-b border-red-100 pb-2">
                  <span className="text-slate-600">Số lần đã hoàn thành:</span>
                  <span className="font-bold text-red-700 text-sm">
                    {blockedAttemptInfo.attemptsMade} / {blockedAttemptInfo.maxAttempts} lần
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-700 font-semibold">Quy định giáo viên:</span>
                  <span className="font-semibold text-slate-800">
                    Tối đa {blockedAttemptInfo.maxAttempts} lần (Lấy điểm cao nhất)
                  </span>
                </div>
              </div>

              {/* Best Score Banner */}
              <div className="bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-indigo-500/10 border-2 border-emerald-500/40 rounded-xl p-4 text-center">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                  ⭐ ĐIỂM CAO NHẤT ĐÃ GHI NHẬN VÀO HỆ THỐNG
                </span>
                <span className="text-3xl font-black text-amber-600">
                  {blockedAttemptInfo.bestScore !== undefined ? blockedAttemptInfo.bestScore : 0}
                  <span className="text-sm font-normal text-slate-500"> / 10 điểm</span>
                </span>
              </div>

              {/* Past Attempts List if available */}
              {blockedAttemptInfo.pastAttempts && blockedAttemptInfo.pastAttempts.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Lịch sử điểm các lần làm:
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs">
                    {blockedAttemptInfo.pastAttempts.map((att, idx) => {
                      const isBest = att.score === blockedAttemptInfo.bestScore;
                      return (
                        <div
                          key={att.sessionId || idx}
                          className={`p-2.5 rounded-lg border flex items-center justify-between ${
                            isBest
                              ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span>Lần {att.attemptNumber || (idx + 1)}</span>
                          <span className="font-mono font-bold">
                            {att.score} điểm {isBest && '⭐ (Cao nhất)'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Guidance text */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center space-x-1">
                  <span>⚠️</span>
                  <span>Thông báo từ hệ thống:</span>
                </p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Em đã làm đủ số lần cho phép của bài kiểm tra này. Nếu có sự cố kỹ thuật hoặc lý do đặc biệt cần làm lại, vui lòng báo trực tiếp với thầy <b>Lê Gia Lợi</b> tại phòng Tin học để được xem xét cấp quyền mở lại.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setBlockedAttemptInfo(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đã hiểu và Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
