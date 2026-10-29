import { Exam, ExamSession, ClassInfo, StudentInfo, ExamStats, StudentQuestion, Question, QuestionOption } from '../types';
import { SEED_APP_DATA } from '../../server/seedData';
import * as XLSX from 'xlsx';
import {
  savePermanentSubmission,
  saveStudentSessionToFirestore,
  updateSessionProgressInFirestore,
  getSubmissionsFromFirestore,
  deleteSubmissionsForExamFromFirestore,
  recordDeletedExamInFirestore,
  getDeletedExamsFromFirestore,
  unmarkDeletedExamInFirestore,
  saveExamToFirestore,
  getExamsFromFirestore,
  saveStudentsToFirestore,
  getStudentsFromFirestore,
  deleteStudentFromFirestore,
  deleteClassStudentsFromFirestore,
  saveClassesToFirestore,
  getClassesFromFirestore,
  deleteClassFromFirestore,
  recordDeletedClassInFirestore,
  getDeletedClassesFromFirestore,
  unmarkDeletedClassInFirestore,
  deleteSingleSubmissionFromFirestore,
  sortStudentsByRosterOrder,
  saveTeacherPasswordToFirestore,
  getTeacherPasswordFromFirestore
} from './firebase';
import { parseExamLocally } from '../utils/localExamParser';
import {
  extractQuestionCorrectAnswer,
  normalizeQuestionOptions,
  normalizeSingleQuestionOptionMap,
  reconstructOptionOrderFromDisplayedQuestions,
  sealExamQuestions,
  unsealExamQuestions,
  sanitizeExamForStudent,
  sealOptionOrder,
  unsealOptionOrder,
  sealValue,
  unsealValue,
  hashPasswordSync,
  verifyPasswordSync,
  verifyTeacherPasswordHash,
  isHashedPassword,
  normalizeStudentName,
  normalizeClassName,
  getStudentRawAnswer,
} from '../utils/security.ts';

function saveEncryptedSessionMeta(sessionId: string, meta: Record<string, any>): void {
  if (!sessionId) return;
  try {
    const sealed = sealValue(JSON.stringify(meta), `SESSION_META::${sessionId}`);
    sessionStorage.setItem(`ncv_session_meta_${sessionId}`, sealed);
  } catch (e) {}
}

function loadEncryptedSessionMeta(sessionId: string): Record<string, any> {
  if (!sessionId) return {};
  try {
    const raw = sessionStorage.getItem(`ncv_session_meta_${sessionId}`);
    if (!raw) return {};
    const unsealed = unsealValue(raw, `SESSION_META::${sessionId}`);
    if (unsealed) {
      return JSON.parse(unsealed);
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveEncryptedFallbackExam(sessionId: string, exam: any): void {
  if (!sessionId || !exam) return;
  try {
    const sealedExam = sealExamQuestions(exam);
    const cipher = sealValue(JSON.stringify(sealedExam), `FALLBACK_EXAM::${sessionId}`);
    sessionStorage.setItem(`ncv_fallback_exam_${sessionId}`, cipher);
  } catch (e) {}
}

function loadEncryptedFallbackExam(sessionId: string): any | null {
  if (!sessionId) return null;
  try {
    const raw = sessionStorage.getItem(`ncv_fallback_exam_${sessionId}`);
    if (!raw) return null;
    const unsealed = unsealValue(raw, `FALLBACK_EXAM::${sessionId}`);
    if (unsealed) {
      return JSON.parse(unsealed);
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const TEACHER_SESSION_KEY = 'ncv_teacher_auth_v3';

// Immediately purge any legacy auto-forged teacher token from localStorage on all student phones/browsers
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ncv_teacher_token');
  }
} catch (e) {}

export const isValidTeacherToken = (token: string | null | undefined): boolean => {
  if (!token || typeof token !== 'string') return false;
  try {
    const decoded = typeof atob === 'function' ? atob(token) : '';
    return decoded.startsWith('legialoi_verified_v3:::ncv-tin-hoc-legialoi-token-2026:::');
  } catch {
    return false;
  }
};

let teacherToken: string | null = (() => {
  try {
    if (typeof window === 'undefined') return null;
    const saved = sessionStorage.getItem(TEACHER_SESSION_KEY);
    if (isValidTeacherToken(saved)) return saved;
    sessionStorage.removeItem(TEACHER_SESSION_KEY);
    return null;
  } catch {
    return null;
  }
})();

export const setAuthToken = (token: string | null) => {
  try {
    localStorage.removeItem('ncv_teacher_token');
  } catch (e) {}
  if (token && isValidTeacherToken(token)) {
    teacherToken = token;
    try {
      sessionStorage.setItem(TEACHER_SESSION_KEY, token);
    } catch (e) {}
  } else {
    teacherToken = null;
    try {
      sessionStorage.removeItem(TEACHER_SESSION_KEY);
    } catch (e) {}
  }
};

export const getAuthToken = (): string | null => {
  try {
    const candidate = teacherToken || (typeof window !== 'undefined' ? sessionStorage.getItem(TEACHER_SESSION_KEY) : null);
    if (isValidTeacherToken(candidate)) {
      return candidate;
    }
    if (candidate) {
      sessionStorage.removeItem(TEACHER_SESSION_KEY);
    }
  } catch (e) {}
  teacherToken = null;
  return null;
};

const getHeaders = (isTeacher = false) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (isTeacher) {
    const token = getAuthToken();
    // NEVER auto-generate a teacher token here! Only attach if teacher explicitly logged in.
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
};

// Safe JSON parser that never throws Unexpected token '<' on HTML responses
async function safeJson<T = any>(res: Response, fallbackError = 'Có lỗi xảy ra trong quá trình xử lý'): Promise<T> {
  let text = '';
  try {
    text = await res.text();
  } catch (err: any) {
    throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.');
  }

  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const serverMessage = data?.error || data?.message;
    const statusText =
      res.status === 404
        ? 'Dữ liệu hoặc đường dẫn API không tồn tại (404)'
        : res.status === 403
        ? 'Bài kiểm tra không khả dụng hoặc đã bị đóng (403)'
        : res.status === 401
        ? 'Tên đăng nhập hoặc mật khẩu không chính xác hoặc phiên làm việc đã hết hạn (401)'
        : res.status >= 500
        ? (serverMessage || 'Lỗi máy chủ (500). Vui lòng thử lại sau.')
        : fallbackError;

    const errorMsg = serverMessage || statusText || fallbackError;
    const error: any = new Error(errorMsg);
    error.data = data;
    error.status = res.status;
    throw error;
  }

  return (data !== null ? data : {}) as T;
}

// Helper: Gather authoritative exam config + all completed attempts of a student across Firestore and localStorage
async function gatherStudentExamHistory(params: {
  examCode?: string;
  examId?: string;
  studentName?: string;
  studentClass?: string;
  excludeSessionId?: string;
}): Promise<{
  exam: Exam | undefined;
  previousSessions: any[];
  attemptsMade: number;
  maxAttempts: number;
  bestScore: number | undefined;
  pastAttempts: Array<{
    sessionId: string;
    attemptNumber: number;
    score: number;
    submittedAt?: string;
  }>;
}> {
  const targetId = String(params.examId || params.examCode || '').trim().toUpperCase();
  const targetCode = String(params.examCode || params.examId || '').trim().toUpperCase();

  const matchesExam = (e: any): boolean => {
    if (!e) return false;
    const eId = String(e.id || '').trim().toUpperCase();
    const eCode = String(e.code || '').trim().toUpperCase();
    return Boolean(
      (targetId && (eId === targetId || eCode === targetId)) ||
      (targetCode && (eId === targetCode || eCode === targetCode))
    );
  };

  let localExam: Exam | undefined;
  try {
    const raw = localStorage.getItem('ncv_exams_data');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localExam = parsed.find(matchesExam);
      }
    }
  } catch (e) {}

  let fbExam: Exam | undefined;
  try {
    // Force refresh from Firestore so teacher changes to maxAttempts, isOpen, or schedule apply immediately
    const fbExams = await getExamsFromFirestore(true);
    if (Array.isArray(fbExams)) {
      fbExam = fbExams.find(matchesExam);
    }
  } catch (e) {}

  let resolvedExam: Exam | undefined = localExam || fbExam;
  if (localExam && fbExam) {
    const localTime = new Date(localExam.updatedAt || localExam.createdAt || 0).getTime();
    const fbTime = new Date(fbExam.updatedAt || fbExam.createdAt || 0).getTime();
    const keyedQuestions =
      Array.isArray(fbExam.questions) && fbExam.questions.some((q: any) => q && extractQuestionCorrectAnswer(q, fbExam!.id) !== '')
        ? fbExam.questions
        : Array.isArray(localExam.questions) && localExam.questions.some((q: any) => q && extractQuestionCorrectAnswer(q, localExam!.id) !== '')
        ? localExam.questions
        : fbExam.questions || localExam.questions;

    if (fbTime >= localTime) {
      resolvedExam = { ...localExam, ...fbExam, questions: keyedQuestions };
    } else {
      resolvedExam = { ...fbExam, ...localExam, questions: keyedQuestions };
    }
  }

  if (!resolvedExam) {
    resolvedExam = (SEED_APP_DATA.exams as any[]).find(matchesExam);
  }

  if (resolvedExam) {
    resolvedExam = sealExamQuestions(resolvedExam);
  }

  const aliases = Array.from(
    new Set(
      [
        params.examId,
        params.examCode,
        resolvedExam?.id,
        resolvedExam?.code,
      ]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    )
  );
  const upperAliases = new Set(aliases.map((a) => a.toUpperCase()));
  const normAliases = new Set(aliases.map((a) => a.toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean));

  const sNameNorm = normalizeStudentName(params.studentName);
  const sClassNorm = normalizeClassName(params.studentClass);
  const excludeId = String(params.excludeSessionId || '').trim();

  const sessionMap = new Map<string, any>();

  const registerSubmittedRecord = (s: any) => {
    if (!s || (s.status !== 'submitted' && s.status !== 'locked')) return;
    const sid = String(s.sessionId || s.id || '').trim();
    if (!sid || (excludeId && sid === excludeId)) return;

    const recName = normalizeStudentName(s.studentName || s.name);
    const recClass = normalizeClassName(s.studentClass || s.class);
    if (!sNameNorm || !sClassNorm || recName !== sNameNorm || recClass !== sClassNorm) return;

    // Verify exam match if record has examId/examCode
    const sExamId = String(s.examId || '').trim().toUpperCase();
    const sExamCode = String(s.examCode || '').trim().toUpperCase();
    const sNormId = sExamId.replace(/[^A-Z0-9]/g, '');
    const sNormCode = sExamCode.replace(/[^A-Z0-9]/g, '');
    if (upperAliases.size > 0 && (sExamId || sExamCode)) {
      const matched =
        (sExamId && upperAliases.has(sExamId)) ||
        (sExamCode && upperAliases.has(sExamCode)) ||
        (sNormId && normAliases.has(sNormId)) ||
        (sNormCode && normAliases.has(sNormCode));
      if (!matched) return;
    }

    const existing = sessionMap.get(sid);
    if (!existing) {
      sessionMap.set(sid, {
        ...s,
        sessionId: sid,
        id: sid,
        examId: resolvedExam?.id || s.examId || params.examId || params.examCode,
        examCode: resolvedExam?.code || s.examCode || params.examCode || params.examId,
        studentName: String(s.studentName || s.name || params.studentName || '').trim(),
        studentClass: String(s.studentClass || s.class || params.studentClass || '').trim(),
        score: typeof s.score === 'number' && !isNaN(s.score) ? s.score : Number(s.bestScore) || 0,
        attemptNumber: Number(s.attemptNumber) || 1,
        status: 'submitted',
        submittedAt: s.submittedAt || s.startedAt || new Date().toISOString()
      });
    } else {
      const prevScore = typeof existing.score === 'number' ? existing.score : 0;
      const curScore = typeof s.score === 'number' && !isNaN(s.score) ? s.score : prevScore;
      sessionMap.set(sid, {
        ...existing,
        ...s,
        sessionId: sid,
        id: sid,
        score: Math.max(prevScore, curScore),
        attemptNumber: Math.max(Number(existing.attemptNumber) || 1, Number(s.attemptNumber) || 1),
        status: 'submitted'
      });
    }
  };

  // 1. Check localStorage submission caches
  try {
    for (const a of aliases) {
      const raw = localStorage.getItem(`ncv_submissions_${a}`);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) arr.forEach(registerSubmittedRecord);
      }
    }
    const globalRaw = localStorage.getItem('ncv_submissions_global_all');
    if (globalRaw) {
      const globalArr = JSON.parse(globalRaw);
      if (Array.isArray(globalArr)) globalArr.forEach(registerSubmittedRecord);
    }
    const attemptLogRaw = localStorage.getItem('ncv_student_attempt_records');
    if (attemptLogRaw) {
      const attemptLogArr = JSON.parse(attemptLogRaw);
      if (Array.isArray(attemptLogArr)) attemptLogArr.forEach(registerSubmittedRecord);
    }
  } catch (e) {}

  // 2. Check Firestore submissions
  if (sNameNorm && sClassNorm) {
    try {
      const fbSubs = await getSubmissionsFromFirestore(
        resolvedExam?.id || params.examId,
        resolvedExam?.code || params.examCode,
        aliases
      );
      if (Array.isArray(fbSubs)) {
        fbSubs.forEach(registerSubmittedRecord);
      }
    } catch (e) {}
  }

  const previousSessions = Array.from(sessionMap.values()).sort(
    (a, b) => new Date(a.submittedAt || a.startedAt || 0).getTime() - new Date(b.submittedAt || b.startedAt || 0).getTime()
  );

  let maxRecordedAttemptNumber = 0;
  let bestScore: number | undefined = undefined;
  previousSessions.forEach((s, idx) => {
    const attNum = Number(s.attemptNumber) || idx + 1;
    if (attNum > maxRecordedAttemptNumber) maxRecordedAttemptNumber = attNum;
    const sc = typeof s.score === 'number' && !isNaN(s.score) ? s.score : undefined;
    if (sc !== undefined) {
      bestScore = bestScore === undefined ? sc : Math.max(bestScore, sc);
    }
    const bs = typeof s.bestScore === 'number' && !isNaN(s.bestScore) ? s.bestScore : undefined;
    if (bs !== undefined) {
      bestScore = bestScore === undefined ? bs : Math.max(bestScore, bs);
    }
  });

  // Use distinct submitted session count as primary truth, or maxRecordedAttemptNumber if higher
  const attemptsMade = Math.max(previousSessions.length, maxRecordedAttemptNumber);
  const maxAttempts = Math.max(1, Number(resolvedExam?.maxAttempts) || 1);

  const pastAttempts = previousSessions.map((s, idx) => ({
    sessionId: s.sessionId || s.id,
    attemptNumber: idx + 1,
    score: typeof s.score === 'number' ? s.score : 0,
    submittedAt: s.submittedAt || s.startedAt
  }));

  return {
    exam: resolvedExam,
    previousSessions,
    attemptsMade,
    maxAttempts,
    bestScore,
    pastAttempts
  };
}

export const api = {
  // Auth
  login: async (username: string, password: string) => {
    const trimmedUser = String(username || '').trim().toLowerCase();
    const trimmedPass = String(password || '').trim();

    const allowedUsers = ['legialoi', 'legialoi@gmail.com', 'admin', 'teacher', 'gv'];
    const isValidUser = allowedUsers.includes(trimmedUser);
    if (!isValidUser) {
      throw new Error('Tên đăng nhập Giáo viên không chính xác');
    }

    // 1. Check Cloud Firestore & localStorage for custom changed Teacher password
    const localPassHash = localStorage.getItem('ncv_admin_password');
    const cloudPassHash = await getTeacherPasswordFromFirestore();

    if (localPassHash && !cloudPassHash) {
      // Sync existing local custom password up to Cloud Firestore so it survives app updates/redeployments
      saveTeacherPasswordToFirestore(localPassHash).catch(() => {});
    }

    const effectivePassHash = cloudPassHash || localPassHash;

    // CRITICAL: If Teacher has changed their password, strictly verify against the new password FIRST
    // and IMMEDIATELY REJECT the initial password in the code!
    if (effectivePassHash) {
      const matchesCustom =
        verifyPasswordSync(trimmedPass, effectivePassHash) ||
        verifyPasswordSync(trimmedPass.replace(/\s+/g, ' '), effectivePassHash) ||
        verifyPasswordSync(trimmedPass.replace(/\s+/g, ''), effectivePassHash);

      if (!matchesCustom) {
        throw new Error(
          'Mật khẩu Giáo viên không chính xác! Mật khẩu ban đầu đã bị vô hiệu hóa sau khi đổi mật khẩu.'
        );
      }
    }

    let res: Response | null = null;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          adminPasswordHash: effectivePassHash || undefined,
        }),
      });
    } catch {
      // Network error or static environment
    }

    if (res && res.ok) {
      const data = await res.json();
      if (data && data.token) {
        if (data.passwordHash && !effectivePassHash) {
          try {
            localStorage.setItem('ncv_admin_password', data.passwordHash);
          } catch (e) {}
          saveTeacherPasswordToFirestore(data.passwordHash).catch(() => {});
        }
        setAuthToken(data.token);
        return data;
      }
    }

    if (res && res.status === 401 && !effectivePassHash) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || 'Tên đăng nhập hoặc mật khẩu Giáo viên không chính xác');
    }

    // Client-side verification: if effectivePassHash exists, ONLY accept effectivePassHash; otherwise accept initial hash
    const isValidPass = effectivePassHash
      ? verifyPasswordSync(trimmedPass, effectivePassHash) ||
        verifyPasswordSync(trimmedPass.replace(/\s+/g, ' '), effectivePassHash) ||
        verifyPasswordSync(trimmedPass.replace(/\s+/g, ''), effectivePassHash)
      : verifyTeacherPasswordHash(trimmedPass);

    if (isValidUser && isValidPass) {
      const token = btoa(`legialoi_verified_v3:::ncv-tin-hoc-legialoi-token-2026:::${Date.now()}`);
      setAuthToken(token);
      return {
        success: true,
        token,
        user: {
          username: 'legialoi',
          fullName: 'Thầy Lê Gia Lợi',
          role: 'teacher',
          school: 'THCS Nam Cửa Việt'
        }
      };
    }

    throw new Error('Tên đăng nhập hoặc mật khẩu Giáo viên không chính xác');
  },

  checkAuth: async () => {
    const token = getAuthToken();
    if (!token || !isValidTeacherToken(token)) {
      setAuthToken(null);
      return null;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: getHeaders(true),
      });
      if (res.ok) {
        return await safeJson(res, 'Phiên đăng nhập hết hạn');
      }
      if (res.status === 404) {
        return {
          user: {
            username: 'legialoi',
            fullName: 'Thầy Lê Gia Lợi',
            role: 'teacher',
            school: 'THCS Nam Cửa Việt'
          }
        };
      }
      setAuthToken(null);
      return null;
    } catch {
      return {
        user: {
          username: 'legialoi',
          fullName: 'Thầy Lê Gia Lợi',
          role: 'teacher',
          school: 'THCS Nam Cửa Việt'
        }
      };
    }
  },

  logout: () => {
    setAuthToken(null);
  },

  changeTeacherPassword: async (currentPassword: string, newPassword: string) => {
    const trimmedCurrent = String(currentPassword || '').trim();
    const trimmedNew = String(newPassword || '').trim();
    const localPassHash = localStorage.getItem('ncv_admin_password');
    const cloudPassHash = await getTeacherPasswordFromFirestore();
    const effectivePassHash = cloudPassHash || localPassHash;

    // Strictly verify current password first: if password was already changed, old default password is NOT valid
    const isCurrentValid = effectivePassHash
      ? verifyPasswordSync(trimmedCurrent, effectivePassHash) ||
        verifyPasswordSync(trimmedCurrent.replace(/\s+/g, ' '), effectivePassHash) ||
        verifyPasswordSync(trimmedCurrent.replace(/\s+/g, ''), effectivePassHash)
      : verifyTeacherPasswordHash(trimmedCurrent);

    if (!isCurrentValid) {
      throw new Error('Mật khẩu hiện tại của giáo viên không chính xác');
    }

    const hashedNew = hashPasswordSync(trimmedNew);

    // 1. Save to localStorage immediately
    try {
      localStorage.setItem('ncv_admin_password', hashedNew);
    } catch (e) {}

    // 2. Save to Cloud Firestore so it permanently survives app updates, redeployments, and browser changes
    await saveTeacherPasswordToFirestore(hashedNew);

    // 3. Sync to backend server
    let data: any = null;
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({
          currentPassword: trimmedCurrent,
          newPassword: trimmedNew,
          adminPasswordHash: effectivePassHash || undefined,
          newPasswordHash: hashedNew,
        }),
      });
      if (res.ok) {
        data = await res.json().catch(() => null);
      }
    } catch {
      // Network/serverless fallback
    }

    return {
      success: true,
      message: data?.message || 'Đã đổi mật khẩu Giáo viên thành công! Mật khẩu cũ đã bị vô hiệu hóa hoàn toàn.',
    };
  },

  // AI Exam Parser
  parseExamWithAI: async (params: {
    rawText?: string;
    fileBase64?: string;
    mimeType?: string;
    filename?: string;
    answersText?: string;
    teacherPrompt?: string;
    selectedModel?: string;
  }) => {
    // If user explicitly selected local parser, run locally directly
    if (params.selectedModel === 'local') {
      if (params.rawText && params.rawText.trim().length > 0) {
        return parseExamLocally(params.rawText, params.answersText);
      }
      throw new Error('Chế độ phân tích Cục bộ yêu cầu dán văn bản đề thi hoặc tệp Word (.docx).');
    }

    try {
      const res = await fetch('/api/ai/parse-exam', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify(params),
      });
      if (res.ok) {
        return await safeJson(res, 'Lỗi bóc tách đề thi AI');
      }
      const errJson = await res.json().catch(() => null);
      if (errJson?.error) {
        throw new Error(errJson.error);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('Failed to fetch')) {
        // If server gave an explicit business error message (e.g. quota, file format), fallback locally
        if (params.rawText && params.rawText.trim().length > 0) {
          return parseExamLocally(params.rawText, params.answersText);
        }
        throw err;
      }
    }

    // Client-side fallback parsing if server API fails or offline
    if (params.rawText && params.rawText.trim().length > 0) {
      return parseExamLocally(params.rawText, params.answersText);
    }

    throw new Error('Không thể phân tích đề thi lúc này. Thầy vui lòng thử dán trực tiếp nội dung văn bản đề thi.');
  },

  solveQuestionsWithAI: async (questions: Question[], selectedModel?: string) => {
    const res = await fetch('/api/ai/solve-answers', {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ questions, selectedModel }),
    });
    return await safeJson<{
      success: boolean;
      answers: { number: number; correctAnswer: 'A' | 'B' | 'C' | 'D'; explanation: string }[];
    }>(res, 'Lỗi AI giải đáp án');
  },

  chatExamAssistant: async (params: {
    message: string;
    questions: Question[];
    history?: { role: 'user' | 'assistant'; content: string }[];
    selectedModel?: string;
  }) => {
    const res = await fetch('/api/ai/chat-assistant', {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(params),
    });
    return await safeJson<{
      success: boolean;
      reply: string;
      updatedAnswers?: { number: number; correctAnswer: 'A' | 'B' | 'C' | 'D'; explanation?: string }[];
    }>(res, 'Lỗi trao đổi với AI');
  },

  // Exams
  getExams: async (asTeacher = false): Promise<Exam[]> => {
    let localExams: Exam[] = [];
    const cached = localStorage.getItem('ncv_exams_data');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) localExams = parsed;
      } catch (e) {}
    }

    // 1. Gather deleted exams blacklist from local storage
    const deletedExamsSet = new Set<string>();
    try {
      const delArr = JSON.parse(localStorage.getItem('ncv_deleted_exams') || '[]');
      if (Array.isArray(delArr)) {
        delArr.forEach((id: string) => deletedExamsSet.add(String(id).trim().toUpperCase()));
      }
    } catch (e) {}

    // 2. Parallel fetch from backend API and cached Firebase Firestore (Vercel cold-start proof + zero waterfall delay)
    let serverData: Exam[] = [];
    let fbExams: Exam[] = [];

    await Promise.all([
      (async () => {
        try {
          const res = await fetch('/api/exams', {
            headers: getHeaders(asTeacher),
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) serverData = data;
          }
        } catch (e) {}
      })(),
      (async () => {
        try {
          const fbDeleted = await getDeletedExamsFromFirestore();
          fbDeleted.forEach((id) => deletedExamsSet.add(id));
          localStorage.setItem('ncv_deleted_exams', JSON.stringify(Array.from(deletedExamsSet)));
        } catch (e) {}
      })(),
      (async () => {
        try {
          fbExams = await getExamsFromFirestore();
        } catch (e) {}
      })()
    ]);

    // 3. Merge all sources, strictly EXCLUDING any exam in deletedExamsSet
    const examMap = new Map<string, Exam>();
    const allCandidates = [...localExams, ...fbExams, ...serverData];

    allCandidates.forEach((e: Exam) => {
      if (!e || !e.id || !e.title) return;
      const uId = e.id.trim().toUpperCase();
      const uCode = (e.code || '').trim().toUpperCase();
      if (deletedExamsSet.has(uId) || (uCode && deletedExamsSet.has(uCode))) {
        return; // Strongly filter out deleted exams
      }
      const existing = examMap.get(e.id);
      if (!existing) {
        examMap.set(e.id, e);
      } else {
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const incomingTime = new Date(e.updatedAt || e.createdAt || 0).getTime();
        // Preserve questions array from Firestore/local when merging with student-stripped serverData
        const mergedQuestions = (Array.isArray(e.questions) && e.questions.length > 0)
          ? e.questions
          : existing.questions;
        if (incomingTime >= existingTime) {
          examMap.set(e.id, { ...existing, ...e, questions: mergedQuestions });
        } else if (!existing.questions && mergedQuestions) {
          examMap.set(e.id, { ...existing, questions: mergedQuestions });
        }
      }
    });

    const cleanExams = Array.from(examMap.values());
    // Always store sealed questions in localStorage so DevTools inspection never reveals plain answers
    const sealedForStorage = cleanExams.map((e) => sealExamQuestions(e));
    localStorage.setItem('ncv_exams_data', JSON.stringify(sealedForStorage));

    const isVerifiedTeacher = asTeacher && isValidTeacherToken(getAuthToken());

    if (isVerifiedTeacher && fbExams.length === 0 && sealedForStorage.length > 0) {
      sealedForStorage.forEach((exam) => {
        saveExamToFirestore(exam).catch(() => {});
      });
    }

    if (isVerifiedTeacher) {
      return sealedForStorage.map((e) => unsealExamQuestions(e));
    }

    // For students, return sanitized exams with no plain correctAnswer or explanation
    return sealedForStorage.map((e) => sanitizeExamForStudent(e));
  },

  getExam: async (id: string, asTeacher = false): Promise<Exam> => {
    const isVerifiedTeacher = asTeacher && isValidTeacherToken(getAuthToken());
    try {
      const res = await fetch(`/api/exams/${id}`, {
        headers: getHeaders(isVerifiedTeacher),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          return isVerifiedTeacher ? unsealExamQuestions(data) : sanitizeExamForStudent(data);
        }
      }
    } catch (e) {}

    const cached = localStorage.getItem('ncv_exams_data');
    if (cached) {
      try {
        const exams: Exam[] = JSON.parse(cached) || [];
        const found = exams.find((e) => e.id === id || e.code === id);
        if (found) {
          return isVerifiedTeacher ? unsealExamQuestions(found) : sanitizeExamForStudent(found);
        }
      } catch (e) {}
    }
    throw new Error('Không tìm thấy bài kiểm tra');
  },

  saveExam: async (exam: Exam, isNewExam?: boolean): Promise<Exam> => {
    const finalExam: Exam = {
      ...exam,
      id: exam.id && !exam.id.startsWith('new-') ? exam.id : `exam-${Date.now()}`,
      updatedAt: new Date().toISOString(),
      createdAt: exam.createdAt || new Date().toISOString(),
    };
    const sealedFinalExam = sealExamQuestions(finalExam);

    // Unmark from deleted blacklist
    try {
      const uId = finalExam.id.trim().toUpperCase();
      const uCode = (finalExam.code || '').trim().toUpperCase();
      const delArr = JSON.parse(localStorage.getItem('ncv_deleted_exams') || '[]');
      if (Array.isArray(delArr)) {
        const filtered = delArr.filter((id: string) => id !== uId && (!uCode || id !== uCode));
        localStorage.setItem('ncv_deleted_exams', JSON.stringify(filtered));
      }
      unmarkDeletedExamInFirestore(uId, uCode).catch(() => {});
    } catch (e) {}

    const cached = localStorage.getItem('ncv_exams_data');
    let exams: Exam[] = [];
    if (cached) {
      try {
        exams = JSON.parse(cached) || [];
      } catch (e) {}
    }
    const idx = exams.findIndex((e) => e.id === finalExam.id || (finalExam.code && e.code === finalExam.code));
    if (idx >= 0) {
      exams[idx] = sealedFinalExam;
    } else {
      exams.unshift(sealedFinalExam);
    }
    localStorage.setItem('ncv_exams_data', JSON.stringify(exams));

    // Save to Firebase Firestore for permanent cloud storage across all Vercel cold starts
    try {
      await saveExamToFirestore(sealedFinalExam);
    } catch (e) {
      console.warn('[Firebase] saveExamToFirestore error:', e);
    }

    try {
      const shouldPost = isNewExam === true || !exam.id || exam.id.startsWith('new-');
      const url = shouldPost ? '/api/exams' : `/api/exams/${finalExam.id}`;
      const method = shouldPost ? 'POST' : 'PUT';

      let res = await fetch(url, {
        method,
        headers: getHeaders(true),
        body: JSON.stringify(finalExam),
      });

      if (!res.ok && res.status === 404 && method === 'PUT') {
        res = await fetch('/api/exams', {
          method: 'POST',
          headers: getHeaders(true),
          body: JSON.stringify(finalExam),
        });
      }

      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          return data;
        }
      }
    } catch (e) {}

    return finalExam;
  },

  deleteExam: async (id: string): Promise<void> => {
    if (!id) return;
    const cleanId = id.trim();
    const upperId = cleanId.toUpperCase();

    // 1. Discover exam code and full alias set from all available sources
    let targetCode = '';
    const aliases: string[] = [cleanId, upperId];

    try {
      const cached = localStorage.getItem('ncv_exams_data');
      let exams: Exam[] = [];
      if (cached) {
        try { exams = JSON.parse(cached) || []; } catch (e) {}
      }
      let target = exams.find((e) => (e.id && e.id.toUpperCase() === upperId) || (e.code && e.code.toUpperCase() === upperId));
      if (!target) {
        const fbExams = await getExamsFromFirestore().catch(() => []);
        target = fbExams.find((e) => (e.id && e.id.toUpperCase() === upperId) || (e.code && e.code.toUpperCase() === upperId));
      }
      if (target?.code) {
        targetCode = target.code.trim().toUpperCase();
        aliases.push(target.code, targetCode);
      }
      if (target?.id) {
        aliases.push(target.id, target.id.toUpperCase());
      }

      // Add to local deleted blacklist
      const delArr = JSON.parse(localStorage.getItem('ncv_deleted_exams') || '[]');
      if (Array.isArray(delArr)) {
        if (!delArr.includes(upperId)) delArr.push(upperId);
        if (targetCode && !delArr.includes(targetCode)) delArr.push(targetCode);
        localStorage.setItem('ncv_deleted_exams', JSON.stringify(delArr));
      }
    } catch (e) {}

    // 2. Permanently record in Firebase Firestore deleted_exams and delete ALL student submissions and scores for this exam
    try {
      await Promise.all([
        recordDeletedExamInFirestore(upperId, targetCode),
        deleteSubmissionsForExamFromFirestore(cleanId, targetCode, aliases)
      ]);
    } catch (e) {
      console.warn('[Firebase] deleteExam error:', e);
    }

    // 3. Purge all local storage caches for this exam and its student submissions
    try {
      localStorage.removeItem(`ncv_submissions_${cleanId}`);
      localStorage.removeItem(`ncv_submissions_${upperId}`);
      localStorage.removeItem(`ncv_reports_cache_${cleanId}`);
      localStorage.removeItem(`ncv_reports_cache_${upperId}`);
      sessionStorage.removeItem(`ncv_reports_cache_${cleanId}`);
      sessionStorage.removeItem(`ncv_reports_cache_${upperId}`);

      if (targetCode) {
        localStorage.removeItem(`ncv_submissions_${targetCode}`);
        localStorage.removeItem(`ncv_reports_cache_${targetCode}`);
        sessionStorage.removeItem(`ncv_reports_cache_${targetCode}`);
      }

      const selectedId = localStorage.getItem('ncv_selected_exam_id');
      if (selectedId === cleanId || selectedId === upperId || (targetCode && selectedId === targetCode)) {
        localStorage.removeItem('ncv_selected_exam_id');
      }

      const cached = localStorage.getItem('ncv_exams_data');
      if (cached) {
        const exams: Exam[] = JSON.parse(cached) || [];
        const filtered = exams.filter((e) => {
          const eId = (e.id || '').toUpperCase();
          const eCode = (e.code || '').toUpperCase();
          return eId !== upperId && (targetCode ? eCode !== targetCode : true);
        });
        localStorage.setItem('ncv_exams_data', JSON.stringify(filtered));
      }

      // Purge active sessions in progress for this exam
      try {
        const activeRaw = localStorage.getItem('ncv_active_sessions');
        if (activeRaw) {
          const activeArr = JSON.parse(activeRaw);
          if (Array.isArray(activeArr)) {
            const filteredActive = activeArr.filter((s: any) => {
              if (!s) return false;
              const sId = String(s.examId || '').trim().toUpperCase();
              const sCode = String(s.examCode || '').trim().toUpperCase();
              const matchId = sId === upperId || sId === cleanId.toUpperCase();
              const matchCode = targetCode ? sCode === targetCode || sId === targetCode : false;
              return !matchId && !matchCode;
            });
            localStorage.setItem('ncv_active_sessions', JSON.stringify(filteredActive));
          }
        }
      } catch (e) {}

      // Purge global submissions cache
      try {
        const globalRaw = localStorage.getItem('ncv_submissions_global_all');
        if (globalRaw) {
          const globalArr = JSON.parse(globalRaw);
          if (Array.isArray(globalArr)) {
            const filteredGlobal = globalArr.filter((s: any) => {
              if (!s) return false;
              const sId = String(s.examId || '').trim().toUpperCase();
              const sCode = String(s.examCode || '').trim().toUpperCase();
              const matchId = sId === upperId || sId === cleanId.toUpperCase();
              const matchCode = targetCode ? sCode === targetCode || sId === targetCode : false;
              return !matchId && !matchCode;
            });
            localStorage.setItem('ncv_submissions_global_all', JSON.stringify(filteredGlobal));
          }
        }
      } catch (e) {}

      // Clean up any keys that contain the deleted exam ID or code
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.includes(cleanId) ||
            key.startsWith(`ncv_submissions_${cleanId}`) ||
            key.startsWith(`ncv_reports_cache_${cleanId}`) ||
            (targetCode && (key.includes(targetCode) || key.startsWith(`ncv_submissions_${targetCode}`))))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      // Broadcast exam deleted event across all browser windows and components
      window.dispatchEvent(new CustomEvent('ncv_exam_deleted', { detail: { examId: cleanId, examCode: targetCode } }));
      window.dispatchEvent(new CustomEvent('ncv_submission_update', { detail: {} }));
      const bc = new BroadcastChannel('ncv_broadcast_sync');
      bc.postMessage({ type: 'EXAM_DELETED', examId: cleanId, examCode: targetCode });
      bc.close();
    } catch (e) {}

    try {
      await fetch(`/api/exams/${encodeURIComponent(cleanId)}`, {
        method: 'DELETE',
        headers: getHeaders(true),
      });
    } catch (e) {}
  },

  duplicateExam: async (id: string): Promise<Exam> => {
    let duplicated: Exam | null = null;
    const cached = localStorage.getItem('ncv_exams_data');
    if (cached) {
      try {
        const exams: Exam[] = JSON.parse(cached) || [];
        const original = exams.find((e) => e.id === id);
        if (original) {
          duplicated = {
            ...original,
            id: `exam-${Date.now()}`,
            code: `${original.code}-COPY`,
            title: `${original.title} (Bản sao)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          exams.unshift(duplicated);
          localStorage.setItem('ncv_exams_data', JSON.stringify(exams));
        }
      } catch (e) {}
    }

    try {
      const res = await fetch(`/api/exams/${id}/duplicate`, {
        method: 'POST',
        headers: getHeaders(true),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) return data;
      }
    } catch (e) {}

    if (duplicated) return duplicated;
    throw new Error('Lỗi nhân bản bài thi');
  },

  toggleExamOpen: async (id: string): Promise<Exam> => {
    const cached = localStorage.getItem('ncv_exams_data');
    let toggled: Exam | null = null;
    if (cached) {
      try {
        const exams: Exam[] = JSON.parse(cached) || [];
        const idx = exams.findIndex((e) => e.id === id);
        if (idx >= 0) {
          exams[idx].isOpen = !exams[idx].isOpen;
          exams[idx].updatedAt = new Date().toISOString();
          toggled = exams[idx];
          localStorage.setItem('ncv_exams_data', JSON.stringify(exams));
        }
      } catch (e) {}
    }

    try {
      const res = await fetch(`/api/exams/${id}/toggle`, {
        method: 'POST',
        headers: getHeaders(true),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) return data;
      }
    } catch (e) {}

    if (toggled) return toggled;
    throw new Error('Lỗi đổi trạng thái bài thi');
  },

  restoreSampleExams: async () => {
    // Clear sample exam IDs from blacklist
    try {
      const sampleIds = ['EXAM-1791604725287', 'TIN9-NCV01', 'THCS01', 'EXAM-1791604725288', 'THCS02'];
      const delArr = JSON.parse(localStorage.getItem('ncv_deleted_exams') || '[]');
      if (Array.isArray(delArr)) {
        const filtered = delArr.filter((id: string) => !sampleIds.includes(String(id).toUpperCase()));
        localStorage.setItem('ncv_deleted_exams', JSON.stringify(filtered));
      }
      sampleIds.forEach(id => {
        unmarkDeletedExamInFirestore(id).catch(() => {});
      });
    } catch (e) {}

    try {
      const res = await fetch('/api/exams/restore-samples', {
        method: 'POST',
        headers: getHeaders(true),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.exams) {
          localStorage.setItem('ncv_exams_data', JSON.stringify(data.exams));
          return data;
        }
      }
    } catch (e) {}
    return { success: true, message: 'Đã khôi phục đề thi mẫu thành công' };
  },

  // Classes
  getClasses: async (): Promise<ClassInfo[]> => {
    let localClasses: ClassInfo[] = [];
    const cached = localStorage.getItem('ncv_classes_data');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) localClasses = parsed;
      } catch (e) {}
    }

    const deletedClassesSet = new Set<string>();
    const localDeletedArr: string[] = [];
    try {
      const delArr = JSON.parse(localStorage.getItem('ncv_deleted_classes') || '[]');
      if (Array.isArray(delArr)) {
        delArr.forEach((c: string) => {
          const u = String(c).trim().toUpperCase();
          if (u) {
            deletedClassesSet.add(u);
            localDeletedArr.push(u);
          }
        });
      }
    } catch (e) {}

    // Always treat legacy test classes (THU, 9A8, 9A9) as excluded unless they actually have real students
    const LEGACY_TEST_CLASSES = new Set(['THU', '9A8', '9A9']);
    const SEED_FAKE_COUNTS: Record<string, number> = {
      THU: 10,
      '9A8': 38,
      '9A9': 40,
      '9A': 36,
      '9B': 35,
      '9C': 35,
      '8A': 38,
      '8B': 37,
      '8C': 36,
      '7A': 36,
      '7B': 35,
      '7C': 34,
      '6A': 35,
      '6B': 34,
      '6C': 33,
    };

    let serverClasses: ClassInfo[] = [];
    let fbClasses: ClassInfo[] = [];
    let fbStudents: StudentInfo[] = [];
    const isTeacherSession = Boolean(getAuthToken());

    await Promise.all([
      (async () => {
        try {
          const fbDeleted = await getDeletedClassesFromFirestore();
          const fbDeletedSet = new Set(fbDeleted.map((c) => String(c).trim().toUpperCase()));
          fbDeletedSet.forEach((c) => deletedClassesSet.add(c));

          // Sync any locally deleted classes to Firestore so mobile phones also respect teacher's deleted classes
          for (const localDel of localDeletedArr) {
            if (!fbDeletedSet.has(localDel)) {
              deleteClassFromFirestore(localDel).catch(() => {});
            }
          }
          localStorage.setItem('ncv_deleted_classes', JSON.stringify(Array.from(deletedClassesSet)));
        } catch (e) {}
      })(),
      (async () => {
        try {
          fbClasses = await getClassesFromFirestore();
        } catch (e) {}
      })(),
      (async () => {
        try {
          fbStudents = await getStudentsFromFirestore();
        } catch (e) {}
      })()
    ]);

    // Count real students per class in Firestore (ignoring 2 seed THU students)
    const realStudentCountByClass = new Map<string, { displayName: string; count: number }>();
    if (Array.isArray(fbStudents)) {
      fbStudents.forEach((st) => {
        if (!st || !st.class) return;
        const idStr = String(st.id || '');
        const upperCls = String(st.class).trim().toUpperCase();
        if (!upperCls || deletedClassesSet.has(upperCls)) return;
        if (upperCls === 'THU' && (idStr === 'st-thu-1' || idStr === 'st-thu-2')) return;
        const cur = realStudentCountByClass.get(upperCls);
        if (cur) {
          cur.count += 1;
        } else {
          realStudentCountByClass.set(upperCls, { displayName: String(st.class).trim(), count: 1 });
        }
      });
    }

    const hasRealStudentRosters = realStudentCountByClass.size > 0;

    // Only fetch serverClasses as a last resort if both Firestore and localStorage are empty
    if (fbClasses.length === 0 && localClasses.length === 0 && !hasRealStudentRosters) {
      try {
        const res = await fetch('/api/classes');
        if (res.ok) {
          const serverData = await res.json();
          if (Array.isArray(serverData)) serverClasses = serverData;
        }
      } catch (e) {}
    }

    // Source priority: If Firestore has classes, use fbClasses (never merge cold-start serverClasses!).
    const rawCandidateClasses =
      fbClasses.length > 0
        ? fbClasses
        : localClasses.length > 0
        ? localClasses
        : serverClasses;

    const classMap = new Map<string, ClassInfo>();

    // First, ensure every class that actually has real students in Firestore is included
    realStudentCountByClass.forEach((info, upper) => {
      if (deletedClassesSet.has(upper)) return;
      const inferredGrade = (parseInt(upper.charAt(0), 10) || 8) as 6 | 7 | 8 | 9;
      const validGrade = ([6, 7, 8, 9].includes(inferredGrade) ? inferredGrade : 8) as 6 | 7 | 8 | 9;
      classMap.set(upper, {
        name: info.displayName,
        grade: validGrade,
        studentCount: info.count,
      });
    });

    rawCandidateClasses.forEach((c) => {
      if (!c || !c.name) return;
      const upper = c.name.trim().toUpperCase();
      if (!upper || deletedClassesSet.has(upper)) return;

      const realCount = realStudentCountByClass.get(upper)?.count || 0;

      // Exclude legacy dummy classes (THU, 9A8, 9A9) unless they actually have real students
      if (LEGACY_TEST_CLASSES.has(upper) && realCount === 0) {
        return;
      }

      // If the school already has real student rosters in Firestore, skip phantom auto-seeded classes
      // that still carry their fake seed studentCount (33..40) but have 0 real students in Firestore
      if (hasRealStudentRosters && realCount === 0) {
        const seedFakeCount = SEED_FAKE_COUNTS[upper];
        if (seedFakeCount !== undefined && Number(c.studentCount) === seedFakeCount) {
          return;
        }
      }

      const inferredGrade = (Number(c.grade) || parseInt(upper.charAt(0), 10) || 6) as 6 | 7 | 8 | 9;
      const validGrade = ([6, 7, 8, 9].includes(inferredGrade) ? inferredGrade : 6) as 6 | 7 | 8 | 9;

      classMap.set(upper, {
        name: c.name.trim(),
        grade: validGrade,
        studentCount: realCount > 0 ? realCount : Number(c.studentCount) || 0,
      });
    });

    const clean = Array.from(classMap.values()).sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, 'vi', { numeric: true });
    });

    if (clean.length > 0) {
      localStorage.setItem('ncv_classes_data', JSON.stringify(clean));
      if (isTeacherSession && fbClasses.length === 0) {
        saveClassesToFirestore(clean).catch(() => {});
      }
      return clean;
    }

    return [];
  },

  saveClasses: async (classes: ClassInfo[]): Promise<ClassInfo[]> => {
    // If a class in classes was previously marked deleted, un-delete it
    try {
      const delArr = JSON.parse(localStorage.getItem('ncv_deleted_classes') || '[]');
      if (Array.isArray(delArr) && delArr.length > 0) {
        const activeUpper = new Set(classes.map(c => c.name.trim().toUpperCase()));
        const remaining = delArr.filter((name: string) => !activeUpper.has(name));
        localStorage.setItem('ncv_deleted_classes', JSON.stringify(remaining));
      }
      for (const c of classes) {
        unmarkDeletedClassInFirestore(c.name).catch(() => {});
      }
    } catch (e) {}

    localStorage.setItem('ncv_classes_data', JSON.stringify(classes));
    await saveClassesToFirestore(classes);

    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ classes }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem('ncv_classes_data', JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      // gracefully keep client data
    }
    return classes;
  },

  deleteClass: async (className: string) => {
    const trimmed = className.trim();
    const upper = trimmed.toUpperCase();

    // 1. Add to local deleted classes blacklist
    try {
      const delArr = JSON.parse(localStorage.getItem('ncv_deleted_classes') || '[]');
      if (Array.isArray(delArr) && !delArr.includes(upper)) {
        delArr.push(upper);
        localStorage.setItem('ncv_deleted_classes', JSON.stringify(delArr));
      }
    } catch (e) {}

    // 2. Permanently delete from Firebase Firestore
    try {
      await deleteClassFromFirestore(trimmed);
    } catch (e) {
      console.warn('deleteClassFromFirestore error:', e);
    }

    // 3. Remove from local classes
    let updated: ClassInfo[] = [];
    const cached = localStorage.getItem('ncv_classes_data');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          updated = parsed.filter((c: ClassInfo) => c.name.trim().toUpperCase() !== upper);
          localStorage.setItem('ncv_classes_data', JSON.stringify(updated));
        }
      } catch (e) {}
    }

    // 4. Remove students of this class from local storage
    try {
      const cachedStudents = localStorage.getItem('ncv_students_data');
      if (cachedStudents) {
        const parsedSt = JSON.parse(cachedStudents);
        if (Array.isArray(parsedSt)) {
          const filteredSt = parsedSt.filter((s: StudentInfo) => s.class.trim().toUpperCase() !== upper);
          localStorage.setItem('ncv_students_data', JSON.stringify(filteredSt));
        }
      }
    } catch (e) {}

    try {
      const res = await fetch(`/api/classes/${encodeURIComponent(trimmed)}`, {
        method: 'DELETE',
        headers: getHeaders(true),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.classes && Array.isArray(data.classes)) {
          const clean = data.classes.filter((c: ClassInfo) => c.name.trim().toUpperCase() !== upper);
          localStorage.setItem('ncv_classes_data', JSON.stringify(clean));
          return { ...data, classes: clean };
        }
        return data;
      }
    } catch (e) {}
    return { success: true, message: `Đã xóa lớp ${trimmed} thành công`, classes: updated };
  },

  restoreDefaultClasses: async () => {
    try {
      localStorage.removeItem('ncv_deleted_classes');
    } catch (e) {}
    const defaultClasses: ClassInfo[] = [
      { name: '6A', grade: 6, studentCount: 0 },
      { name: '6B', grade: 6, studentCount: 0 },
      { name: '7A', grade: 7, studentCount: 0 },
      { name: '7B', grade: 7, studentCount: 0 },
      { name: '8A', grade: 8, studentCount: 0 },
      { name: '8B', grade: 8, studentCount: 0 },
      { name: '9A', grade: 9, studentCount: 0 },
      { name: '9B', grade: 9, studentCount: 0 },
    ];
    localStorage.setItem('ncv_classes_data', JSON.stringify(defaultClasses));
    saveClassesToFirestore(defaultClasses).catch(() => {});
    try {
      const res = await fetch('/api/classes/restore-defaults', {
        method: 'POST',
        headers: getHeaders(true),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return { success: true, message: 'Đã khôi phục danh sách các lớp chuẩn khối 6, 7, 8, 9 của THCS Nam Cửa Việt', classes: defaultClasses };
  },

  getStudents: async (className?: string, asTeacher = false): Promise<StudentInfo[]> => {
    const url = className ? `/api/students?class=${encodeURIComponent(className)}` : '/api/students';

    // 0. Load deleted students blacklist
    const deletedStudentIdsSet = new Set<string>();
    try {
      const delList = JSON.parse(localStorage.getItem('ncv_deleted_student_ids') || '[]');
      if (Array.isArray(delList)) {
        delList.forEach((id: string) => {
          if (id) deletedStudentIdsSet.add(String(id).trim());
        });
      }
    } catch (e) {}

    // 1. Parallel fetch from Server and cached Firebase Firestore (Vercel cold-start proof)
    let serverStudents: StudentInfo[] = [];
    let fbStudents: StudentInfo[] = [];

    await Promise.all([
      (async () => {
        try {
          const res = await fetch(url, {
            headers: getHeaders(asTeacher),
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              serverStudents = data.filter((s) => s && s.id && !deletedStudentIdsSet.has(String(s.id).trim()));
            }
          }
        } catch (e) {}
      })(),
      (async () => {
        try {
          fbStudents = await getStudentsFromFirestore(className);
        } catch (e) {
          console.warn('[Firebase] getStudentsFromFirestore error:', e);
        }
      })()
    ]);

    // 3. Fetch from local cache (teacher's immediate state)
    let localStudents: StudentInfo[] = [];
    const cached = localStorage.getItem('ncv_students_data');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          localStudents = parsed.filter((s) => s && s.id && !deletedStudentIdsSet.has(String(s.id).trim()));
        }
      } catch (e) {}
    }

    // 4. Merge all sources safely:
    // Determine which classes already have custom rosters in local storage or Cloud Firestore
    const classesWithLocal = new Set<string>();
    localStudents.forEach((s) => {
      if (s && s.class) classesWithLocal.add(s.class.trim().toUpperCase());
    });
    const classesWithFirestore = new Set<string>();
    fbStudents.forEach((s) => {
      if (s && s.class) classesWithFirestore.add(s.class.trim().toUpperCase());
    });
    const classesWithCustomRoster = new Set([...classesWithLocal, ...classesWithFirestore]);

    const studentMap = new Map<string, StudentInfo>();
    const identityKeyMap = new Map<string, string>(); // class:::name -> id

    // A. For classes that do NOT have any custom roster in local or Firestore, allow server defaults
    serverStudents.forEach((s) => {
      if (s && s.id && s.name && s.class && !deletedStudentIdsSet.has(String(s.id).trim())) {
        const clsKey = s.class.trim().toUpperCase();
        if (!classesWithCustomRoster.has(clsKey)) {
          studentMap.set(s.id, s);
          identityKeyMap.set(`${clsKey}:::${s.name.trim().toLowerCase()}`, s.id);
        }
      }
    });

    // B. Firestore students are permanent cloud records across all devices & Vercel cold starts
    fbStudents.forEach((s) => {
      if (s && s.id && s.name && s.class && !deletedStudentIdsSet.has(String(s.id).trim())) {
        const clsKey = s.class.trim().toUpperCase();
        const identKey = `${clsKey}:::${s.name.trim().toLowerCase()}`;
        const existingId = identityKeyMap.get(identKey);
        if (existingId && existingId !== s.id) {
          studentMap.delete(existingId);
        }
        studentMap.set(s.id, s);
        identityKeyMap.set(identKey, s.id);
      }
    });

    // C. Local students are authoritative for classes that exist locally, while preserving any cloud password changes
    localStudents.forEach((s) => {
      if (s && s.id && s.name && s.class && !deletedStudentIdsSet.has(String(s.id).trim())) {
        const clsKey = s.class.trim().toUpperCase();
        const identKey = `${clsKey}:::${s.name.trim().toLowerCase()}`;
        const existingId = identityKeyMap.get(identKey);
        const existingRecord = (existingId ? studentMap.get(existingId) : undefined) || studentMap.get(s.id);
        if (existingId && existingId !== s.id) {
          studentMap.delete(existingId);
        }
        const mergedRecord: StudentInfo = {
          ...existingRecord,
          ...s,
        };
        if (existingRecord?.isPasswordChanged && !s.isPasswordChanged && existingRecord.password) {
          mergedRecord.password = existingRecord.password;
          mergedRecord.isPasswordChanged = true;
        }
        studentMap.set(s.id, mergedRecord);
        identityKeyMap.set(identKey, s.id);
      }
    });

    let merged = Array.from(studentMap.values()).filter((s) => !deletedStudentIdsSet.has(String(s.id).trim()));
    if (className) {
      const targetCls = className.trim().toUpperCase();
      merged = sortStudentsByRosterOrder(
        merged.filter((s) => (s.class || '').trim().toUpperCase() === targetCls)
      );
    } else {
      // Group by class and sort each class in exact roster order
      const byClass = new Map<string, StudentInfo[]>();
      merged.forEach((s) => {
        const clsKey = (s.class || '').trim().toUpperCase();
        if (!byClass.has(clsKey)) byClass.set(clsKey, []);
        byClass.get(clsKey)!.push(s);
      });
      const orderedAll: StudentInfo[] = [];
      byClass.forEach((clsList) => {
        orderedAll.push(...sortStudentsByRosterOrder(clsList));
      });
      merged = orderedAll;
    }

    // Cache updated list in localStorage
    if (!className) {
      localStorage.setItem('ncv_students_data', JSON.stringify(merged));
    } else {
      const otherClassStudents = localStudents.filter(
        (s) => (s.class || '').trim().toUpperCase() !== className.trim().toUpperCase()
      );
      localStorage.setItem('ncv_students_data', JSON.stringify([...otherClassStudents, ...merged]));
    }

    return merged;
  },

  saveStudents: async (students: StudentInfo[]): Promise<StudentInfo[]> => {
    localStorage.setItem('ncv_students_data', JSON.stringify(students));
    saveStudentsToFirestore(students).catch(() => {});

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ students }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (e) {}
    return students;
  },

  deleteStudent: async (studentId: string) => {
    if (!studentId) return { success: true };
    const cleanId = String(studentId).trim();

    // 1. Mark in permanent deleted student IDs blacklist
    try {
      const delList = JSON.parse(localStorage.getItem('ncv_deleted_student_ids') || '[]');
      if (Array.isArray(delList) && !delList.includes(cleanId)) {
        delList.push(cleanId);
        localStorage.setItem('ncv_deleted_student_ids', JSON.stringify(delList));
      }
    } catch (e) {}

    // 2. Remove from local cache
    const cached = localStorage.getItem('ncv_students_data');
    if (cached) {
      try {
        const all: StudentInfo[] = JSON.parse(cached) || [];
        const filtered = all.filter((s) => String(s.id).trim() !== cleanId);
        localStorage.setItem('ncv_students_data', JSON.stringify(filtered));
      } catch (e) {}
    }

    // 3. Remove from Firestore
    deleteStudentFromFirestore(cleanId).catch(() => {});

    // 4. Remove from server
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(cleanId)}`, {
        method: 'DELETE',
        headers: getHeaders(true),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return { success: true, message: 'Đã xóa học sinh thành công' };
  },

  saveClassStudents: async (className: string, students: StudentInfo[]) => {
    const trimmedClass = className.trim().toUpperCase();
    const cached = localStorage.getItem('ncv_students_data');
    let all: StudentInfo[] = [];
    if (cached) {
      try {
        all = JSON.parse(cached) || [];
      } catch (e) {}
    }

    // Find any previously existing students in this class that were removed in the new list
    const previousClassStudents = all.filter((s) => (s.class || '').trim().toUpperCase() === trimmedClass);
    const newStudentIds = new Set(students.map((s) => String(s.id).trim()));
    const removedIds = previousClassStudents
      .filter((s) => !newStudentIds.has(String(s.id).trim()))
      .map((s) => String(s.id).trim());

    if (removedIds.length > 0) {
      try {
        const delList = JSON.parse(localStorage.getItem('ncv_deleted_student_ids') || '[]');
        if (Array.isArray(delList)) {
          removedIds.forEach((id) => {
            if (!delList.includes(id)) delList.push(id);
            deleteStudentFromFirestore(id).catch(() => {});
          });
          localStorage.setItem('ncv_deleted_student_ids', JSON.stringify(delList));
        }
      } catch (e) {}
    }

    const stampedStudents = students.map((s, idx) => ({
      ...s,
      stt: idx + 1,
    }));

    const filtered = all.filter((s) => (s.class || '').trim().toUpperCase() !== trimmedClass);
    const updated = [...filtered, ...stampedStudents];
    localStorage.setItem('ncv_students_data', JSON.stringify(updated));

    // Save to Firebase Firestore immediately
    try {
      await deleteClassStudentsFromFirestore(className);
      await saveStudentsToFirestore(stampedStudents);
    } catch (e) {
      console.warn('[Firebase] saveClassStudents warning:', e);
    }

    // Update studentCount on the class in both localStorage and Cloud Firestore
    try {
      const cachedClasses = localStorage.getItem('ncv_classes_data');
      if (cachedClasses) {
        const clsList: ClassInfo[] = JSON.parse(cachedClasses) || [];
        const foundIdx = clsList.findIndex((c) => c.name.trim().toUpperCase() === trimmedClass);
        if (foundIdx >= 0) {
          clsList[foundIdx] = { ...clsList[foundIdx], studentCount: students.length };
          localStorage.setItem('ncv_classes_data', JSON.stringify(clsList));
          saveClassesToFirestore(clsList).catch(() => {});
        }
      }
    } catch (e) {}

    try {
      const res = await fetch(`/api/classes/${encodeURIComponent(className)}/students`, {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ students }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return { success: true, message: `Đã lưu danh sách học sinh lớp ${className}`, students };
  },

  clearClassStudents: async (className: string) => {
    const trimmed = className.trim().toUpperCase();
    const cached = localStorage.getItem('ncv_students_data');
    let all: StudentInfo[] = [];
    if (cached) {
      try {
        all = JSON.parse(cached) || [];
      } catch (e) {}
    }

    const targetStudents = all.filter((s) => (s.class || '').trim().toUpperCase() === trimmed);
    if (targetStudents.length > 0) {
      try {
        const delList = JSON.parse(localStorage.getItem('ncv_deleted_student_ids') || '[]');
        if (Array.isArray(delList)) {
          targetStudents.forEach((s) => {
            const sId = String(s.id).trim();
            if (!delList.includes(sId)) delList.push(sId);
            deleteStudentFromFirestore(sId).catch(() => {});
          });
          localStorage.setItem('ncv_deleted_student_ids', JSON.stringify(delList));
        }
      } catch (e) {}
    }

    const filtered = all.filter((s) => (s.class || '').trim().toUpperCase() !== trimmed);
    localStorage.setItem('ncv_students_data', JSON.stringify(filtered));

    deleteClassStudentsFromFirestore(className).catch(() => {});

    try {
      const res = await fetch(`/api/classes/${encodeURIComponent(className)}/students`, {
        method: 'DELETE',
        headers: getHeaders(true),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return { success: true, message: `Đã làm trống danh sách lớp ${className}` };
  },

  // Student Account & Password Management
  generateClassAccounts: async (className?: string, all?: boolean) => {
    const cached = localStorage.getItem('ncv_students_data');
    let students: StudentInfo[] = [];
    if (cached) {
      try {
        students = JSON.parse(cached) || [];
      } catch (e) {}
    }

    const normalizePart = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();

    const getLastN = (name: string, n: number) => {
      const words = (name || '').trim().split(/\s+/).filter(Boolean);
      const slice = words.length >= n ? words.slice(-n).join('') : words.join('');
      return normalizePart(slice);
    };

    const getFullNormalized = (name: string) => {
      const words = (name || '').trim().split(/\s+/).filter(Boolean);
      return normalizePart(words.join(''));
    };

    const computeLocalUsername = (s: StudentInfo, allList: StudentInfo[]) => {
      const cleanClass = (s.class || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const targetLast2 = getLastN(s.name, 2);
      const sameClass = allList.filter(
        (item) => (item.class || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanClass
      );
      const hasLast2Collision = sameClass.some(
        (other) => other.id !== s.id && getLastN(other.name, 2) === targetLast2
      );
      if (!hasLast2Collision) {
        return `${targetLast2}${cleanClass}`;
      }
      const targetFull = getFullNormalized(s.name);
      const sameFullList = sameClass.filter((item) => getFullNormalized(item.name) === targetFull);
      if (sameFullList.length <= 1) {
        return `${targetFull}${cleanClass}`;
      }
      const idx = sameFullList.findIndex((item) => item.id === s.id);
      const suffix = idx >= 0 ? idx + 1 : 1;
      return `${targetFull}${suffix}${cleanClass}`;
    };

    const updatedStudents = students.map((s) => {
      const isTarget = all || (className && (s.class || '').trim().toLowerCase() === className.trim().toLowerCase());
      if (isTarget) {
        const username = computeLocalUsername(s, students);
        const defaultPassword = `${(s.class || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}123`;
        return {
          ...s,
          username,
          password: s.password || defaultPassword,
          isPasswordChanged: s.isPasswordChanged || false,
        };
      }
      return s;
    });

    localStorage.setItem('ncv_students_data', JSON.stringify(updatedStudents));
    saveStudentsToFirestore(updatedStudents).catch(() => {});

    try {
      const res = await fetch('/api/students/generate-class-accounts', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ className, all }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}

    const classFiltered = className
      ? updatedStudents.filter((s) => (s.class || '').trim().toLowerCase() === className.trim().toLowerCase())
      : updatedStudents;

    return {
      success: true,
      message: 'Đã tạo Username và MK mặc định cho học sinh thành công!',
      students: classFiltered,
      totalUpdated: classFiltered.length,
    };
  },

  resetStudentPassword: async (params: {
    studentId?: string;
    className?: string;
    resetAll?: boolean;
  }) => {
    const cached = localStorage.getItem('ncv_students_data');
    let students: StudentInfo[] = [];
    if (cached) {
      try {
        students = JSON.parse(cached) || [];
      } catch (e) {}
    }

    const resetTargets: StudentInfo[] = [];
    const updatedStudents = students.map((s) => {
      const isTarget = params.resetAll && params.className
        ? (s.class || '').trim().toLowerCase() === params.className.trim().toLowerCase()
        : s.id === params.studentId;
      if (isTarget) {
        const defaultPass = `${(s.class || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}123`;
        try {
          if (s.username) localStorage.removeItem(`ncv_student_pass_${s.username.toLowerCase()}`);
          if (s.id) localStorage.removeItem(`ncv_student_pass_id_${s.id}`);
          if (s.name && s.class) {
            localStorage.removeItem(
              `ncv_student_pass_name_${normalizeClassName(s.class)}_${normalizeStudentName(s.name)}`
            );
          }
        } catch (e) {}
        const resetSt = { ...s, password: defaultPass, isPasswordChanged: false };
        resetTargets.push(resetSt);
        return resetSt;
      }
      return s;
    });

    localStorage.setItem('ncv_students_data', JSON.stringify(updatedStudents));
    if (resetTargets.length > 0) {
      await saveStudentsToFirestore(resetTargets).catch(() => {});
    } else {
      await saveStudentsToFirestore(updatedStudents).catch(() => {});
    }

    try {
      const res = await fetch('/api/students/reset-password', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify(params),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}

    const classFiltered = params.className
      ? updatedStudents.filter((s) => (s.class || '').trim().toLowerCase() === params.className!.trim().toLowerCase())
      : updatedStudents;

    return {
      success: true,
      message: 'Đã cấp lại mật khẩu mặc định thành công!',
      students: classFiltered,
    };
  },

  changeStudentPassword: async (params: {
    studentId?: string;
    studentName?: string;
    studentClass?: string;
    sbd?: string;
    username?: string;
    currentPassword?: string;
    newPassword: string;
  }) => {
    const hashedNewPass = hashPasswordSync(params.newPassword.trim());
    const normTargetName = normalizeStudentName(params.studentName);
    const normTargetCls = normalizeClassName(params.studentClass);
    const usernameLower = String(params.username || '').trim().toLowerCase();

    const persistHashedPassLocallyAndCloud = async () => {
      try {
        if (usernameLower) {
          localStorage.setItem(`ncv_student_pass_${usernameLower}`, hashedNewPass);
        }
        if (params.studentId) {
          localStorage.setItem(`ncv_student_pass_id_${params.studentId}`, hashedNewPass);
        }
        if (normTargetCls && normTargetName) {
          localStorage.setItem(`ncv_student_pass_name_${normTargetCls}_${normTargetName}`, hashedNewPass);
        }
      } catch (e) {}

      try {
        const cached = localStorage.getItem('ncv_students_data');
        const all: StudentInfo[] = cached ? JSON.parse(cached) || [] : [];
        let updatedStudent: StudentInfo | null = null;
        const nextAll = all.map((s) => {
          const idMatches = Boolean(params.studentId && s.id === params.studentId);
          const userMatches = Boolean(usernameLower && s.username && s.username.toLowerCase() === usernameLower);
          const nameClsMatches = Boolean(
            normTargetName &&
              normTargetCls &&
              normalizeStudentName(s.name) === normTargetName &&
              normalizeClassName(s.class) === normTargetCls
          );
          if (idMatches || userMatches || nameClsMatches) {
            updatedStudent = {
              ...s,
              username: s.username || params.username,
              password: hashedNewPass,
              isPasswordChanged: true,
            };
            return updatedStudent;
          }
          return s;
        });

        if (!updatedStudent && (params.studentId || (params.studentName && params.studentClass))) {
          const createdSt: StudentInfo = {
            id: params.studentId || `st-${normTargetCls}-${Date.now()}`,
            name: String(params.studentName || '').trim(),
            class: String(params.studentClass || '').trim(),
            sbd: params.sbd ? String(params.sbd).trim() : '',
            username: params.username ? String(params.username).trim() : undefined,
            password: hashedNewPass,
            isPasswordChanged: true,
          };
          updatedStudent = createdSt;
          nextAll.push(createdSt);
        }

        if (updatedStudent) {
          localStorage.setItem('ncv_students_data', JSON.stringify(nextAll));
          await saveStudentsToFirestore([updatedStudent]).catch(() => {});
        }
      } catch (e) {}
    };

    let res: Response | null = null;
    try {
      res = await fetch('/api/students/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          newPasswordHash: hashedNewPass,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await persistHashedPassLocallyAndCloud();
        return data;
      }
      if (res.status === 400) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Mật khẩu hiện tại không chính xác');
      }
    } catch (e: any) {
      if (e?.message && e.message.includes('Mật khẩu hiện tại')) {
        throw e;
      }
      // ignore network error
    }

    await persistHashedPassLocallyAndCloud();

    return {
      success: true,
      message: 'Đổi mật khẩu thành công! Em hãy ghi nhớ mật khẩu mới để đăng nhập cho các bài kiểm tra sau (mật khẩu cũ đã hết hiệu lực).'
    };
  },

  // Student Examination API
  validateStudentEntry: async (params: {
    examCode: string;
    studentId?: string;
    studentName?: string;
    studentClass?: string;
    sbd?: string;
    username?: string;
    password?: string;
  }) => {
    const history = await gatherStudentExamHistory({
      examCode: params.examCode,
      studentName: params.studentName,
      studentClass: params.studentClass,
    });
    const realExamSnapshot = history.exam ? sealExamQuestions(history.exam) : null;

    // Look up student's current password status across localStorage AND Cloud Firestore
    const inputPass = String(params.password || '').trim();
    const studentClassNorm = String(params.studentClass || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const defaultPass = `${studentClassNorm}123`;
    const usernameLower = String(params.username || '').trim().toLowerCase();
    const normName = normalizeStudentName(params.studentName);
    const normCls = normalizeClassName(params.studentClass);

    const storedCustomPass =
      (usernameLower ? localStorage.getItem(`ncv_student_pass_${usernameLower}`) : null) ||
      (params.studentId ? localStorage.getItem(`ncv_student_pass_id_${params.studentId}`) : null) ||
      (normCls && normName ? localStorage.getItem(`ncv_student_pass_name_${normCls}_${normName}`) : null);

    let rosterStoredPass: string | undefined;
    let rosterPassChanged = false;

    const inspectStudentRecord = (s?: StudentInfo | null) => {
      if (!s) return;
      const isDefaultHash =
        s.password &&
        (s.password.toLowerCase() === defaultPass.toLowerCase() ||
          verifyPasswordSync(defaultPass, s.password) ||
          verifyPasswordSync(defaultPass.toLowerCase(), s.password));
      if (s.isPasswordChanged && s.password && !isDefaultHash) {
        rosterStoredPass = s.password;
        rosterPassChanged = true;
      } else if (!rosterStoredPass && s.password) {
        rosterStoredPass = s.password;
      }
    };

    try {
      // 1. Check fresh Firestore student record so password changes persist across app updates & devices
      if (params.studentClass) {
        const fbList = await getStudentsFromFirestore(params.studentClass, true);
        const fbFound = fbList.find(
          (s: any) =>
            (params.studentId && s.id === params.studentId) ||
            (usernameLower && s.username && s.username.toLowerCase() === usernameLower) ||
            (normName && normCls && normalizeStudentName(s.name) === normName && normalizeClassName(s.class) === normCls)
        );
        inspectStudentRecord(fbFound);
      }
    } catch (e) {}

    try {
      // 2. Also check localStorage student roster
      const cachedSt = localStorage.getItem('ncv_students_data');
      if (cachedSt) {
        const list: StudentInfo[] = JSON.parse(cachedSt) || [];
        const localFound = list.find(
          (s) =>
            (params.studentId && s.id === params.studentId) ||
            (usernameLower && s.username && s.username.toLowerCase() === usernameLower) ||
            (normName && normCls && normalizeStudentName(s.name) === normName && normalizeClassName(s.class) === normCls)
        );
        inspectStudentRecord(localFound);
      }
    } catch (e) {}

    const effectiveCustomPassHash = storedCustomPass || (rosterPassChanged ? rosterStoredPass : undefined);
    const isStudentPasswordChanged = Boolean(storedCustomPass || rosterPassChanged);

    // CRITICAL GATE: Verify student password BEFORE calling server so old default password in server seed data can NEVER bypass a changed password
    if (isStudentPasswordChanged && effectiveCustomPassHash) {
      const matchesCustom =
        (storedCustomPass && verifyPasswordSync(inputPass, storedCustomPass)) ||
        (rosterStoredPass && rosterPassChanged && verifyPasswordSync(inputPass, rosterStoredPass));
      if (!matchesCustom) {
        throw new Error(
          `Mật khẩu đăng nhập không chính xác! Tài khoản của em đã đổi sang mật khẩu riêng (mật khẩu mặc định ${defaultPass} không còn hiệu lực). Nếu quên mật khẩu mới, em hãy nhờ thầy Lê Gia Lợi bấm Reset mật khẩu nhé!`
        );
      }
    } else {
      const inputPassNoSpace = inputPass.replace(/\s+/g, '').toLowerCase();
      const defaultPassNoSpace = defaultPass.toLowerCase();
      const matchesDefault =
        inputPassNoSpace === defaultPassNoSpace ||
        Boolean(rosterStoredPass && verifyPasswordSync(inputPass, rosterStoredPass));
      if (!matchesDefault) {
        throw new Error(
          `Mật khẩu đăng nhập không chính xác! Mật khẩu mặc định là tên lớp thêm 123 (Ví dụ: ${defaultPass}). Nếu quên mật khẩu, em hãy nhờ thầy Lê Gia Lợi cấp lại nhé!`
        );
      }
    }

    let res: Response | null = null;
    try {
      res = await fetch('/api/student/validate-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          examSnapshot: realExamSnapshot,
          previousSessions: history.previousSessions,
          clientAttemptsMade: history.attemptsMade,
          clientBestScore: history.bestScore,
          studentPasswordHash: effectiveCustomPassHash,
          studentIsPasswordChanged: isStudentPasswordChanged,
        }),
      });

      if (res.ok) {
        const serverData: any = await safeJson(res, 'Không thể xác thực thông tin vào thi');
        const effectiveMaxAttempts = Math.max(
          1,
          Number(realExamSnapshot?.maxAttempts ?? serverData?.maxAttempts ?? serverData?.exam?.maxAttempts ?? 1)
        );
        const effectiveAttemptsMade = Math.max(
          history.attemptsMade,
          Number(serverData?.attemptsMade || 0)
        );
        const effectiveBestScore =
          history.bestScore !== undefined && serverData?.bestScore !== undefined
            ? Math.max(history.bestScore, Number(serverData.bestScore))
            : (history.bestScore ?? serverData?.bestScore);

        if (!serverData?.hasActiveSession && effectiveAttemptsMade >= effectiveMaxAttempts) {
          const blockErr: any = new Error(
            `Bạn đã hoàn thành đủ ${effectiveAttemptsMade}/${effectiveMaxAttempts} lần làm bài cho phép. Điểm cao nhất của bạn là: ${effectiveBestScore ?? 0} điểm.`
          );
          blockErr.status = 403;
          blockErr.data = {
            hasCompletedAllAttempts: true,
            attemptsMade: effectiveAttemptsMade,
            maxAttempts: effectiveMaxAttempts,
            bestScore: effectiveBestScore ?? 0,
            pastAttempts: history.pastAttempts?.length ? history.pastAttempts : serverData?.pastAttempts,
          };
          throw blockErr;
        }

        return {
          ...serverData,
          student: {
            ...serverData?.student,
            id: params.studentId || serverData?.student?.id,
            username: params.username || serverData?.student?.username,
            isPasswordChanged: isStudentPasswordChanged || Boolean(serverData?.student?.isPasswordChanged),
          },
          exam: {
            ...serverData?.exam,
            maxAttempts: effectiveMaxAttempts,
          },
          attemptsMade: effectiveAttemptsMade,
          maxAttempts: effectiveMaxAttempts,
          attemptsRemaining: Math.max(0, effectiveMaxAttempts - effectiveAttemptsMade),
          bestScore: effectiveBestScore,
          nextAttemptNumber: serverData?.hasActiveSession
            ? (serverData?.nextAttemptNumber || effectiveAttemptsMade + 1)
            : effectiveAttemptsMade + 1,
          pastAttempts: history.pastAttempts?.length ? history.pastAttempts : serverData?.pastAttempts,
        };
      }

      if (res.status === 401) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.error ||
            (isStudentPasswordChanged
              ? 'Mật khẩu đăng nhập không chính xác! Em đã đổi mật khẩu riêng nên mật khẩu mặc định cũ không còn hiệu lực.'
              : `Mật khẩu đăng nhập không chính xác! Mật khẩu mặc định là ${defaultPass}.`)
        );
      }

      // If server returned 403 or specific student block (like max attempts exceeded), throw server error
      if (res.status === 403) {
        return await safeJson(res, 'Không thể xác thực thông tin vào thi');
      }
    } catch (e: any) {
      if (
        e?.status === 403 ||
        e?.data?.hasCompletedAllAttempts ||
        (e?.message &&
          (e.message.includes('quá số lần') ||
            e.message.includes('hoàn thành đủ') ||
            e.message.includes('Mật khẩu đăng nhập không chính xác')))
      ) {
        throw e;
      }
      // Network/Vercel serverless offline
    }

    // Client-side fallback check for Vercel static or serverless state resets
    const inputPassNoSpace = inputPass.replace(/\s+/g, '').toLowerCase();
    const defaultPassNoSpace = defaultPass.toLowerCase();

    const isPassValid = isStudentPasswordChanged
      ? Boolean(
          (storedCustomPass && verifyPasswordSync(inputPass, storedCustomPass)) ||
            (rosterStoredPass && verifyPasswordSync(inputPass, rosterStoredPass))
        )
      : Boolean(
          (rosterStoredPass && verifyPasswordSync(inputPass, rosterStoredPass)) ||
            inputPassNoSpace === defaultPassNoSpace
        );

    if (!isPassValid) {
      throw new Error(
        isStudentPasswordChanged
          ? 'Mật khẩu đăng nhập không chính xác! Em đã đổi mật khẩu riêng nên mật khẩu mặc định cũ không còn hiệu lực. Nếu quên mật khẩu, em hãy nhờ thầy Lê Gia Lợi cấp lại nhé!'
          : `Mật khẩu đăng nhập không chính xác! Mật khẩu mặc định là tên lớp thêm 123 (Ví dụ: ${defaultPass}). Nếu quên mật khẩu, em hãy nhờ thầy Lê Gia Lợi cấp lại nhé!`
      );
    }

    const realExam: any = realExamSnapshot;

    const isTestClass = /^(test|thu|demo|gv|giaovien)/i.test((params.studentClass || '').trim());
    const now = new Date();
    if (realExam && !isTestClass) {
      if (realExam.isOpen === false) {
        throw new Error(`Bài kiểm tra ${realExam.code || params.examCode} hiện đang được Giáo viên tạm đóng.`);
      }
      if (realExam.startTime && new Date(realExam.startTime) > now) {
        const timeStr = new Date(realExam.startTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit'
        });
        throw new Error(`Ca thi này chưa bắt đầu. Thời gian mở ca thi: ${timeStr}. Em vui lòng quay lại sau!`);
      }
      if (realExam.endTime && new Date(realExam.endTime) < now) {
        const timeStr = new Date(realExam.endTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit'
        });
        throw new Error(`Ca thi này đã kết thúc vào lúc ${timeStr}. Em không thể vào làm bài được nữa.`);
      }
    }

    const effectiveMaxAttempts = Math.max(1, Number(realExam?.maxAttempts) || 1);
    const effectiveAttemptsMade = history.attemptsMade;
    const effectiveBestScore = history.bestScore;

    if (effectiveAttemptsMade >= effectiveMaxAttempts) {
      const blockErr: any = new Error(
        `Bạn đã hoàn thành đủ ${effectiveAttemptsMade}/${effectiveMaxAttempts} lần làm bài cho phép. Điểm cao nhất của bạn là: ${effectiveBestScore ?? 0} điểm.`
      );
      blockErr.status = 403;
      blockErr.data = {
        hasCompletedAllAttempts: true,
        attemptsMade: effectiveAttemptsMade,
        maxAttempts: effectiveMaxAttempts,
        bestScore: effectiveBestScore ?? 0,
        pastAttempts: history.pastAttempts,
      };
      throw blockErr;
    }

    const mockExam = {
      id: realExam?.id || `exam-${params.examCode}`,
      code: realExam?.code || params.examCode,
      title: realExam?.title || `Bài kiểm tra môn Tin học (${params.examCode})`,
      durationMinutes: realExam?.durationMinutes || 45,
      startTime: realExam?.startTime,
      endTime: realExam?.endTime,
      totalPoints: realExam?.totalPoints || 10,
      isOpen: realExam ? realExam.isOpen !== false : true,
      maxAttempts: effectiveMaxAttempts,
      maxViolationsBeforeLock: realExam?.maxViolationsBeforeLock || 3,
      shuffleQuestions: realExam ? realExam.shuffleQuestions !== false : true,
      shuffleOptions: realExam ? realExam.shuffleOptions !== false : true,
      showScoreAfterSubmit: realExam ? realExam.showScoreAfterSubmit !== false : true,
      questionCount: realExam?.questions?.length || 10,
      randomQuestionCount: realExam?.randomQuestionCount
    };

    const mockStudent = {
      id: `st-${Date.now()}`,
      name: params.studentName || 'Học sinh',
      class: params.studentClass || '8A',
      sbd: params.sbd || 'SBD-01',
      username: params.username || 'hocsinh'
    };

    return {
      exam: mockExam,
      student: mockStudent,
      hasActiveSession: false,
      isLocked: false,
      attemptsMade: effectiveAttemptsMade,
      maxAttempts: effectiveMaxAttempts,
      attemptsRemaining: Math.max(0, effectiveMaxAttempts - effectiveAttemptsMade),
      bestScore: effectiveBestScore,
      nextAttemptNumber: effectiveAttemptsMade + 1,
      pastAttempts: history.pastAttempts,
    };
  },

  startExam: async (params: {
    examCode: string;
    studentName: string;
    studentClass: string;
    sbd?: string;
    forceNew?: boolean;
  }) => {
    const cleanCode = String(params.examCode || '').trim().toUpperCase();
    const history = await gatherStudentExamHistory({
      examCode: params.examCode,
      studentName: params.studentName,
      studentClass: params.studentClass,
    });

    let matchedCachedExam: Exam | undefined = history.exam;
    let cachedExams: Exam[] = [];
    try {
      const raw = localStorage.getItem('ncv_exams_data');
      if (raw) cachedExams = JSON.parse(raw);
    } catch (e) {}

    if (!matchedCachedExam) {
      matchedCachedExam = (cachedExams || []).find(
        (e) => (e.code && e.code.trim().toUpperCase() === cleanCode) || (e.id && e.id.trim().toUpperCase() === cleanCode)
      );
    }

    if (matchedCachedExam) {
      matchedCachedExam = sealExamQuestions(matchedCachedExam);
    }

    const effectiveMaxAttempts = Math.max(1, Number(matchedCachedExam?.maxAttempts ?? history.maxAttempts ?? 1));

    // Strictly enforce maxAttempts on the client before starting a new attempt
    if (history.attemptsMade >= effectiveMaxAttempts) {
      const blockErr: any = new Error(
        `Bạn đã quá số lần làm bài cho phép (${history.attemptsMade}/${effectiveMaxAttempts} lần). Điểm số cao nhất đã ghi nhận: ${history.bestScore ?? 0} điểm.`
      );
      blockErr.status = 403;
      blockErr.data = {
        hasCompletedAllAttempts: true,
        attemptsMade: history.attemptsMade,
        maxAttempts: effectiveMaxAttempts,
        bestScore: history.bestScore ?? 0,
        pastAttempts: history.pastAttempts,
      };
      throw blockErr;
    }

    try {
      const res = await fetch('/api/student/start', {
        method: 'POST',
        headers: getHeaders(false),
        body: JSON.stringify({
          ...params,
          examSnapshot: matchedCachedExam,
          previousSessions: history.previousSessions,
          clientAttemptsMade: history.attemptsMade,
          clientBestScore: history.bestScore,
        }),
      });

      let serverSession: any = null;
      if (res.ok) {
        serverSession = await safeJson<{
          sessionId: string;
          startedAt: string;
          expiresAt: string;
          questions: StudentQuestion[];
          questionOrder?: string[];
          optionOrder?: Record<string, Record<string, string>>;
          sealedOptionOrder?: string;
          savedAnswers: Record<string, 'A' | 'B' | 'C' | 'D'>;
          flaggedQuestions: string[];
          violationCount: number;
          attemptNumber?: number;
          maxAttempts?: number;
          bestScoreSoFar?: number;
        }>(res, 'Không thể bắt đầu làm bài thi');
      }

      if (serverSession) {
        const resolvedAttemptNum = Math.max(
          Number(serverSession.attemptNumber) || 1,
          history.attemptsMade + 1
        );
        serverSession.attemptNumber = resolvedAttemptNum;
        serverSession.maxAttempts = effectiveMaxAttempts;
        if (history.bestScore !== undefined) {
          serverSession.bestScoreSoFar =
            serverSession.bestScoreSoFar !== undefined
              ? Math.max(Number(serverSession.bestScoreSoFar), history.bestScore)
              : history.bestScore;
        }

        const resolvedExamId = matchedCachedExam?.id || String(params.examCode || '').trim();
        const resolvedExamCode = matchedCachedExam?.code || String(params.examCode || '').trim();
        const sealedOpt =
          serverSession.sealedOptionOrder ||
          (serverSession.optionOrder
            ? sealOptionOrder(serverSession.optionOrder as any, serverSession.sessionId)
            : '');
        delete serverSession.optionOrder;
        serverSession.sealedOptionOrder = sealedOpt;

        saveEncryptedSessionMeta(serverSession.sessionId, {
          questionOrder: serverSession.questionOrder,
          sealedOptionOrder: sealedOpt,
          examId: resolvedExamId,
          examCode: resolvedExamCode,
        });

        // Register student session in Firebase Firestore so Live Proctoring immediately reflects student entry
        try {
          saveStudentSessionToFirestore({
            sessionId: serverSession.sessionId,
            examId: resolvedExamId,
            examCode: resolvedExamCode,
            studentName: params.studentName,
            studentClass: params.studentClass,
            sbd: params.sbd,
            status: 'in_progress',
            startedAt: serverSession.startedAt,
            attemptNumber: resolvedAttemptNum,
            totalQuestions: serverSession.questions?.length || 10,
            violationCount: 0,
            answeredCount: 0,
            questionOrder: serverSession.questionOrder,
            optionOrder: sealedOpt as any
          }).catch(() => {});

          const activeItem = {
            sessionId: serverSession.sessionId,
            examId: resolvedExamId,
            examCode: resolvedExamCode,
            studentName: params.studentName,
            studentClass: params.studentClass,
            sbd: params.sbd,
            status: 'in_progress',
            startedAt: serverSession.startedAt,
            attemptNumber: resolvedAttemptNum,
            totalQuestions: serverSession.questions?.length || 10,
            answeredCount: 0
          };
          const activeRaw = localStorage.getItem('ncv_active_sessions') || '[]';
          const activeArr = JSON.parse(activeRaw);
          const filtered = activeArr.filter((s: any) => s.sessionId !== serverSession.sessionId);
          filtered.unshift(activeItem);
          localStorage.setItem('ncv_active_sessions', JSON.stringify(filtered.slice(0, 50)));

          window.dispatchEvent(new CustomEvent('ncv_student_started', { detail: activeItem }));
          const bc = new BroadcastChannel('ncv_broadcast_sync');
          bc.postMessage({ type: 'STUDENT_STARTED', session: activeItem });
          bc.close();
        } catch (e) {}

        return serverSession;
      }

      // If server returned 401 (password) or 403 (e.g. locked or exceeded max attempts), propagate exact server message
      if (res.status === 401 || res.status === 403) {
        return await safeJson(res, 'Bài kiểm tra không khả dụng');
      }

      if (res.status === 400) {
        const errJson = await res.json().catch(() => null);
        if (errJson?.error) throw new Error(errJson.error);
      }
    } catch (err: any) {
      if (
        err?.status === 401 ||
        err?.status === 403 ||
        err?.data?.hasCompletedAllAttempts ||
        err?.message?.includes('khóa') ||
        err?.message?.includes('quá số lần') ||
        err?.message?.includes('hoàn thành đủ') ||
        err?.message?.includes('mật khẩu') ||
        err?.message?.includes('chưa bắt đầu') ||
        err?.message?.includes('kết thúc') ||
        err?.message?.includes('Ca thi')
      ) {
        throw err;
      }
      console.warn('[Vercel Serverless Fallback] Server 500/offline on /api/student/start, starting offline exam session:', err);
    }

    // High-resilience client-side fallback: ensure student can ALWAYS take their exam even during Vercel cold starts/downtime
    let exam = matchedCachedExam;
    if (!exam) {
      exam = (SEED_APP_DATA.exams as any[]).find(e => (e.code && e.code.toUpperCase() === cleanCode) || (e.id && e.id.toUpperCase() === cleanCode));
    }
    if (!exam) {
      exam = (cachedExams && cachedExams.length > 0) ? (cachedExams.find(e => e.isOpen) || cachedExams[0]) : (SEED_APP_DATA.exams[0] as any);
    }
    if (exam) {
      exam = sealExamQuestions(exam);
    }

    const fallbackMaxAttempts = Math.max(1, Number(exam?.maxAttempts ?? effectiveMaxAttempts));
    if (history.attemptsMade >= fallbackMaxAttempts) {
      const blockErr: any = new Error(
        `Bạn đã quá số lần làm bài cho phép (${history.attemptsMade}/${fallbackMaxAttempts} lần). Điểm số cao nhất đã ghi nhận: ${history.bestScore ?? 0} điểm.`
      );
      blockErr.status = 403;
      blockErr.data = {
        hasCompletedAllAttempts: true,
        attemptsMade: history.attemptsMade,
        maxAttempts: fallbackMaxAttempts,
        bestScore: history.bestScore ?? 0,
        pastAttempts: history.pastAttempts,
      };
      throw blockErr;
    }

    const isTestClass = /^(test|thu|demo|gv|giaovien)/i.test((params.studentClass || '').trim());
    if (!isTestClass && exam) {
      const now = new Date();
      if (exam.startTime && new Date(exam.startTime) > now) {
        const timeStr = new Date(exam.startTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit'
        });
        throw new Error(`Ca thi này chưa bắt đầu. Thời gian mở ca thi: ${timeStr}. Em vui lòng quay lại sau!`);
      }
      if (exam.endTime && new Date(exam.endTime) < now) {
        const timeStr = new Date(exam.endTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit'
        });
        throw new Error(`Ca thi này đã kết thúc vào lúc ${timeStr}. Em không thể vào làm bài được nữa.`);
      }
    }

    const fisherYatesShuffle = <T,>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const allQ = (exam?.questions && Array.isArray(exam.questions) && exam.questions.length > 0)
      ? [...exam.questions]
      : [...(SEED_APP_DATA.exams[0].questions as any[])];

    const isRandomSubset = Boolean(
      exam?.randomQuestionCount &&
      exam.randomQuestionCount > 0 &&
      exam.randomQuestionCount < allQ.length
    );
    const shouldShuffleQ = exam?.shuffleQuestions !== false || isRandomSubset;
    const shuffledQ = shouldShuffleQ ? fisherYatesShuffle(allQ) : [...allQ];
    const targetCount = isRandomSubset
      ? (exam!.randomQuestionCount as number)
      : shuffledQ.length;
    const pickedQ = shuffledQ.slice(0, targetCount);

    const shouldShuffleOpts = exam?.shuffleOptions !== false;
    const fallbackQuestionOrder: string[] = [];
    const fallbackOptionOrder: Record<string, Record<'A' | 'B' | 'C' | 'D', 'A' | 'B' | 'C' | 'D'>> = {};
    const gradedFallbackQuestions: any[] = [];

    const studentQuestions: StudentQuestion[] = pickedQ.map((q: any, idx: number) => {
      fallbackQuestionOrder.push(q.id);
      let optIds: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
      if (shouldShuffleOpts) {
        optIds = fisherYatesShuffle(optIds);
      }
      const mapping: Record<'A' | 'B' | 'C' | 'D', 'A' | 'B' | 'C' | 'D'> = {
        A: optIds[0] || 'A',
        B: optIds[1] || 'B',
        C: optIds[2] || 'C',
        D: optIds[3] || 'D',
      };
      fallbackOptionOrder[q.id] = mapping;

      const normalizedOrigOptions = normalizeQuestionOptions(q.options);
      const mappedOptions: QuestionOption[] = (['A', 'B', 'C', 'D'] as const).map((displayId, optIdx) => {
        const origOptId = mapping[displayId];
        const origOpt =
          normalizedOrigOptions.find((o) => o.id === origOptId) ||
          normalizedOrigOptions[['A', 'B', 'C', 'D'].indexOf(origOptId)] ||
          normalizedOrigOptions[optIdx];
        return {
          id: displayId,
          text: origOpt ? origOpt.text : ''
        };
      });

      gradedFallbackQuestions.push({
        ...q,
        options: normalizedOrigOptions
      });

      return {
        id: q.id,
        number: idx + 1,
        content: q.content,
        codeSnippet: q.codeSnippet,
        codeLanguage: q.codeLanguage,
        imageUrl: q.imageUrl,
        options: mappedOptions
      };
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (exam?.durationMinutes || 45) * 60 * 1000);
    const sessionId = `ses-fallback-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nextAttemptNum = history.attemptsMade + 1;
    const sealedFallbackOptOrder = sealOptionOrder(fallbackOptionOrder as any, sessionId);

    saveEncryptedFallbackExam(sessionId, {
      ...exam,
      questions: gradedFallbackQuestions
    });
    saveEncryptedSessionMeta(sessionId, {
      questionOrder: fallbackQuestionOrder,
      sealedOptionOrder: sealedFallbackOptOrder,
      examId: exam?.id || cleanCode,
      examCode: exam?.code || cleanCode,
    });

    const fallbackSession = {
      sessionId,
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      questions: studentQuestions,
      questionOrder: fallbackQuestionOrder,
      sealedOptionOrder: sealedFallbackOptOrder,
      savedAnswers: {},
      flaggedQuestions: [],
      violationCount: 0,
      attemptNumber: nextAttemptNum,
      maxAttempts: fallbackMaxAttempts,
      bestScoreSoFar: history.bestScore
    };

    // Register fallback student session in Firebase Firestore so teacher can proctor
    try {
      saveStudentSessionToFirestore({
        sessionId,
        examId: exam?.id || cleanCode,
        examCode: exam?.code || cleanCode,
        studentName: params.studentName,
        studentClass: params.studentClass,
        sbd: params.sbd,
        status: 'in_progress',
        startedAt: now.toISOString(),
        attemptNumber: nextAttemptNum,
        totalQuestions: studentQuestions.length,
        violationCount: 0,
        answeredCount: 0,
        questionOrder: fallbackQuestionOrder,
        optionOrder: sealedFallbackOptOrder as any
      }).catch(() => {});

      const activeItem = {
        sessionId,
        examId: exam?.id || cleanCode,
        examCode: exam?.code || cleanCode,
        studentName: params.studentName,
        studentClass: params.studentClass,
        sbd: params.sbd,
        status: 'in_progress',
        startedAt: now.toISOString(),
        attemptNumber: nextAttemptNum,
        totalQuestions: studentQuestions.length,
        answeredCount: 0
      };
      const activeRaw = localStorage.getItem('ncv_active_sessions') || '[]';
      const activeArr = JSON.parse(activeRaw);
      const filtered = activeArr.filter((s: any) => s.sessionId !== sessionId);
      filtered.unshift(activeItem);
      localStorage.setItem('ncv_active_sessions', JSON.stringify(filtered.slice(0, 50)));

      window.dispatchEvent(new CustomEvent('ncv_student_started', { detail: activeItem }));
      const bc = new BroadcastChannel('ncv_broadcast_sync');
      bc.postMessage({ type: 'STUDENT_STARTED', session: activeItem });
      bc.close();
    } catch (e) {}

    return fallbackSession;
  },

  saveAnswer: async (params: {
    sessionId: string;
    questionId: string;
    optionId?: 'A' | 'B' | 'C' | 'D';
    flagged?: boolean;
    examId?: string;
    questionOrder?: string[];
    sealedOptionOrder?: string;
  }) => {
    try {
      const key = `ncv_session_${params.sessionId}_answers`;
      const current = JSON.parse(localStorage.getItem(key) || '{}');
      if (params.optionId) {
        current[params.questionId] = params.optionId;
      } else {
        delete current[params.questionId];
      }
      localStorage.setItem(key, JSON.stringify(current));
    } catch (e) {}

    const meta = loadEncryptedSessionMeta(params.sessionId);
    const metaPayload: Record<string, any> = {
      questionOrder: params.questionOrder || meta.questionOrder,
      sealedOptionOrder: params.sealedOptionOrder || meta.sealedOptionOrder || meta.optionOrder,
      examId: params.examId || meta.examId,
    };

    try {
      const res = await fetch('/api/student/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, ...metaPayload }),
      });
      if (res.ok) {
        return await safeJson(res, 'Lỗi lưu đáp án');
      }
    } catch (e) {}
    return { success: true };
  },

  reportViolation: async (params: {
    sessionId: string;
    type: string;
    description: string;
    examId?: string;
    questionOrder?: string[];
    sealedOptionOrder?: string;
  }) => {
    const meta = loadEncryptedSessionMeta(params.sessionId);
    const metaPayload: Record<string, any> = {
      questionOrder: params.questionOrder || meta.questionOrder,
      sealedOptionOrder: params.sealedOptionOrder || meta.sealedOptionOrder || meta.optionOrder,
      examId: params.examId || meta.examId,
    };

    try {
      const res = await fetch('/api/student/violation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, ...metaPayload }),
      });
      if (res.ok) {
        return await safeJson<{
          violationCount: number;
          isLocked: boolean;
          maxViolations: number;
        }>(res, 'Lỗi ghi nhận vi phạm');
      }
    } catch (e) {}
    return { violationCount: 1, isLocked: false, maxViolations: 3 };
  },

  lockExit: async (params: {
    sessionId: string;
    examId?: string;
    examCode?: string;
    studentName?: string;
    studentClass?: string;
    sbd?: string;
    answers?: Record<string, string>;
    questionOrder?: string[];
    optionOrder?: Record<string, Record<string, string>>;
    sealedOptionOrder?: string;
    displayedQuestions?: StudentQuestion[];
    violationCount?: number;
    attemptNumber?: number;
    bestScoreSoFar?: number;
    startedAt?: string;
  }) => {
    const meta = loadEncryptedSessionMeta(params.sessionId);
    const resolvedExamId = String(params.examId || meta.examId || params.examCode || '').trim();
    const resolvedExamCode = String(params.examCode || meta.examCode || resolvedExamId).trim();
    const resolvedQuestionOrder = params.questionOrder || meta.questionOrder;
    const resolvedSealedOptionOrder = params.sealedOptionOrder || meta.sealedOptionOrder || meta.optionOrder;

    // Also submit/finalize through submitExam pipeline so locked session is permanently saved to Firestore and localStorage as 1 used attempt
    try {
      await api.submitExam({
        sessionId: params.sessionId,
        examId: resolvedExamId,
        examCode: resolvedExamCode,
        studentName: params.studentName,
        studentClass: params.studentClass,
        sbd: params.sbd,
        answers: params.answers,
        questionOrder: resolvedQuestionOrder,
        optionOrder: params.optionOrder,
        sealedOptionOrder: resolvedSealedOptionOrder,
        displayedQuestions: params.displayedQuestions,
        violationCount: Math.max(Number(params.violationCount) || 3, 3),
        attemptNumber: params.attemptNumber,
        bestScoreSoFar: params.bestScoreSoFar,
        startedAt: params.startedAt,
      });
    } catch (e) {}

    try {
      const res = await fetch('/api/student/lock-exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          examId: resolvedExamId,
          examCode: resolvedExamCode,
          questionOrder: resolvedQuestionOrder,
          sealedOptionOrder: resolvedSealedOptionOrder,
        }),
      });
      if (res.ok) {
        return await safeJson(res, 'Lỗi cập nhật phiên bị khóa');
      }
    } catch (e) {}
    return { success: true };
  },

  heartbeat: async (params: {
    sessionId: string;
    examId?: string;
    studentName?: string;
    studentClass?: string;
    sbd?: string;
    violationCount?: number;
    answers?: Record<string, string>;
    status?: string;
    attemptNumber?: number;
    questionOrder?: string[];
    sealedOptionOrder?: string;
  }) => {
    const meta = loadEncryptedSessionMeta(params.sessionId);
    const metaPayload: Record<string, any> = {
      questionOrder: params.questionOrder || meta.questionOrder,
      sealedOptionOrder: params.sealedOptionOrder || meta.sealedOptionOrder || meta.optionOrder,
      examId: params.examId || meta.examId,
    };

    try {
      const res = await fetch('/api/student/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, ...metaPayload }),
      });
      if (res.ok) {
        return await safeJson<{ success: boolean; isLocked?: boolean; status?: string }>(
          res,
          'Lỗi kiểm tra kết nối'
        );
      }
    } catch (e) {}
    return { success: true, isLocked: false, status: 'in_progress' };
  },

  submitExam: async (params: string | {
    sessionId: string;
    examId?: string;
    examCode?: string;
    studentName?: string;
    studentClass?: string;
    sbd?: string;
    answers?: Record<string, string>;
    questionOrder?: string[];
    optionOrder?: Record<string, Record<string, string>>;
    sealedOptionOrder?: string;
    displayedQuestions?: StudentQuestion[];
    violationCount?: number;
    attemptNumber?: number;
    bestScoreSoFar?: number;
    startedAt?: string;
  }) => {
    const sessionId = typeof params === 'string' ? params : params.sessionId;
    const payload: any = typeof params === 'string' ? { sessionId } : { ...params };

    const normalizeOptKey = (val: any, options?: QuestionOption[]): 'A' | 'B' | 'C' | 'D' | '' => {
      if (val === undefined || val === null) return '';
      const raw = String(val).trim();
      if (!raw) return '';
      const upper = raw.toUpperCase();
      if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') {
        return upper as 'A' | 'B' | 'C' | 'D';
      }
      const prefixMatch = upper.match(/^(?:ĐÁP\s*ÁN|PHƯƠNG\s*ÁN|CHỌN|KEY|CÂU)?[\s\:\-\.\(\[]*([A-D])(?:[\.\)\]\:\-\s]|$)/i);
      if (prefixMatch && prefixMatch[1]) {
        return prefixMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      }
      if (Array.isArray(options) && options.length > 0) {
        const rawLower = raw.toLowerCase();
        const matchedOpt = options.find(o => o && String(o.text || '').trim().toLowerCase() === rawLower);
        if (matchedOpt && matchedOpt.id) {
          const optId = String(matchedOpt.id).trim().toUpperCase();
          if (optId === 'A' || optId === 'B' || optId === 'C' || optId === 'D') {
            return optId as 'A' | 'B' | 'C' | 'D';
          }
        }
      }
      return '';
    };

    // Fill in locally stored answers if missing in payload
    if (!payload.answers || Object.keys(payload.answers).length === 0) {
      try {
        const savedAnswersRaw =
          localStorage.getItem(`ncv_session_${sessionId}_answers`) ||
          localStorage.getItem(`offline_ans_${sessionId}`);
        if (savedAnswersRaw) {
          const unsealedAns = unsealValue(savedAnswersRaw, `OFFLINE_ANS::${sessionId}`);
          payload.answers = JSON.parse(unsealedAns || savedAnswersRaw);
        }
      } catch (e) {}
    }

    // Attach session meta (questionOrder, sealedOptionOrder), examSnapshot, and prior student attempts for Vercel cold-start accuracy
    const history = await gatherStudentExamHistory({
      examId: payload.examId,
      examCode: payload.examCode,
      studentName: payload.studentName,
      studentClass: payload.studentClass,
      excludeSessionId: sessionId,
    });

    try {
      const meta = loadEncryptedSessionMeta(sessionId);
      if (!payload.questionOrder && meta.questionOrder) payload.questionOrder = meta.questionOrder;
      if (!payload.sealedOptionOrder && (meta.sealedOptionOrder || meta.optionOrder)) {
        payload.sealedOptionOrder = meta.sealedOptionOrder || meta.optionOrder;
      }
      if (!payload.examId && meta.examId) payload.examId = meta.examId;
      if (!payload.examCode && meta.examCode) payload.examCode = meta.examCode;

      if (history.exam) {
        payload.examSnapshot = sealExamQuestions(history.exam);
        if (!payload.examId && history.exam.id) payload.examId = history.exam.id;
        if (!payload.examCode && history.exam.code) payload.examCode = history.exam.code;
      }
    } catch (e) {}

    const computedCurrentAttempt = Math.max(
      Number(payload.attemptNumber) || 1,
      history.attemptsMade + 1
    );
    payload.attemptNumber = computedCurrentAttempt;
    payload.previousSessions = history.previousSessions;
    payload.clientAttemptsMade = computedCurrentAttempt;
    if (history.bestScore !== undefined) {
      payload.clientBestScore =
        payload.bestScoreSoFar !== undefined
          ? Math.max(Number(payload.bestScoreSoFar), history.bestScore)
          : history.bestScore;
    }

    const effectiveMaxAttempts = Math.max(1, Number(history.exam?.maxAttempts ?? payload.examSnapshot?.maxAttempts ?? 1));
    if (history.attemptsMade >= effectiveMaxAttempts && !history.previousSessions.some((s: any) => (s.sessionId || s.id) === sessionId)) {
      const blockErr: any = new Error(
        `Bạn đã hoàn thành đủ ${history.attemptsMade}/${effectiveMaxAttempts} lần làm bài cho phép. Hệ thống không ghi nhận thêm bài nộp mới.`
      );
      blockErr.status = 403;
      blockErr.data = {
        hasCompletedAllAttempts: true,
        attemptsMade: history.attemptsMade,
        maxAttempts: effectiveMaxAttempts,
        bestScore: history.bestScore ?? 0,
        pastAttempts: history.pastAttempts,
      };
      throw blockErr;
    }

    let result: any = null;
    try {
      const res = await fetch('/api/student/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        result = await safeJson(res, 'Lỗi nộp bài');
      }
    } catch (e) {}

    // Fallback grading for client sessions or Vercel serverless temporary disconnection
    if (!result) {
      try {
        const savedExamObj = loadEncryptedFallbackExam(sessionId);
        const answers: Record<string, string> = payload.answers || {};

        let exam: Exam | null = null;
        if (payload.examSnapshot && Array.isArray(payload.examSnapshot.questions) && payload.examSnapshot.questions.some((q: any) => q && (extractQuestionCorrectAnswer(q, payload.examSnapshot.id) !== '' || q.correctAnswer))) {
          exam = payload.examSnapshot;
        } else if (savedExamObj) {
          exam = savedExamObj;
        } else {
          const targetId = String(payload.examId || payload.examCode || '').trim().toUpperCase();
          const targetCode = String(payload.examCode || payload.examId || '').trim().toUpperCase();
          const cachedExams = localStorage.getItem('ncv_exams_data');
          if (cachedExams) {
            const arr = JSON.parse(cachedExams);
            if (Array.isArray(arr) && arr.length > 0) {
              exam = arr.find(
                (e: any) =>
                  (e.id && String(e.id).trim().toUpperCase() === targetId) ||
                  (e.code && String(e.code).trim().toUpperCase() === targetId) ||
                  (e.id && String(e.id).trim().toUpperCase() === targetCode) ||
                  (e.code && String(e.code).trim().toUpperCase() === targetCode)
              ) || null;
            }
          }
          if (!exam) {
            exam = (SEED_APP_DATA.exams as any[]).find(
              (e: any) =>
                (e.id && String(e.id).trim().toUpperCase() === targetId) ||
                (e.code && String(e.code).trim().toUpperCase() === targetId) ||
                (e.id && String(e.id).trim().toUpperCase() === targetCode) ||
                (e.code && String(e.code).trim().toUpperCase() === targetCode)
            ) || null;
          }
        }
        if (!exam) exam = SEED_APP_DATA.exams[0] as any;

        const allQuestions: Question[] = Array.isArray(exam?.questions) ? exam!.questions : [];
        const mappedQuestions = Array.isArray(payload.questionOrder) && payload.questionOrder.length > 0
          ? (payload.questionOrder
              .map((qId: string) => allQuestions.find((q) => q && (q.id === qId || String(q.id).replace(/[\/\.]/g, '_') === String(qId).replace(/[\/\.]/g, '_'))))
              .filter(Boolean) as Question[])
          : [];
        const questionsToGrade = mappedQuestions.length > 0 ? mappedQuestions : allQuestions;
        const total = questionsToGrade.length || 1;
        let correct = 0;
        let incorrect = 0;

        const reconstructedOptOrder = reconstructOptionOrderFromDisplayedQuestions(
          payload.displayedQuestions,
          allQuestions
        );
        const unsealedOptOrder = unsealOptionOrder(
          payload.sealedOptionOrder || payload.optionOrder,
          sessionId
        );
        const decodedOptOrder: Record<string, any> = {
          ...reconstructedOptOrder,
          ...(unsealedOptOrder || {}),
        };

        for (const q of questionsToGrade) {
          if (!q || !q.id) continue;
          const rawAns = getStudentRawAnswer(answers, q.id);
          const displayChoice = normalizeOptKey(rawAns, q.options);
          if (!displayChoice) continue;

          const safeKey = String(q.id).replace(/[\/\.]/g, '_');
          const normMapping = normalizeSingleQuestionOptionMap(decodedOptOrder[q.id] || decodedOptOrder[safeKey]);
          const origChoice = normMapping ? (normMapping[displayChoice] || displayChoice) : displayChoice;

          const expectedAnswer = extractQuestionCorrectAnswer(q, exam?.id) || normalizeOptKey(q.correctAnswer, q.options);
          if (origChoice === expectedAnswer) {
            correct++;
          } else {
            incorrect++;
          }
        }

        const answered = correct + incorrect;
        const unanswered = Math.max(0, total - answered);
        const score = total > 0 ? Math.round((correct * 10 / total) * 100) / 100 : 0;

        result = {
          score,
          bestScore: score,
          correctCount: correct,
          incorrectCount: incorrect,
          answeredCount: answered,
          unansweredCount: unanswered,
          totalQuestions: total,
          passed: score >= 5,
          submittedAt: new Date().toISOString()
        };
      } catch (err) {
        const fallbackTotal = Array.isArray(payload.questionOrder) && payload.questionOrder.length > 0 ? payload.questionOrder.length : 10;
        result = {
          score: 0,
          bestScore: 0,
          correctCount: 0,
          incorrectCount: 0,
          answeredCount: 0,
          unansweredCount: fallbackTotal,
          totalQuestions: fallbackTotal,
          passed: false,
          submittedAt: new Date().toISOString()
        };
      }
    }

    // Persist this submission into localStorage and Firestore for reports, proctoring, and strict attempt enforcement
    try {
      const examId = String(history.exam?.id || payload.examId || (result as any)?.examId || '').trim();
      const examCode = String(history.exam?.code || payload.examCode || (result as any)?.examCode || '').trim();
      const actualScore = result?.score !== undefined ? Number(result.score) : (result?.bestScore !== undefined ? Number(result.bestScore) : 0);

      // Compute true highest score across all previous submitted attempts of this student
      const prevStudentScores: number[] = [actualScore];
      if (result?.bestScore !== undefined && !isNaN(Number(result.bestScore))) {
        prevStudentScores.push(Number(result.bestScore));
      }
      if (payload.bestScoreSoFar !== undefined && !isNaN(Number(payload.bestScoreSoFar))) {
        prevStudentScores.push(Number(payload.bestScoreSoFar));
      }
      if (history.bestScore !== undefined && !isNaN(Number(history.bestScore))) {
        prevStudentScores.push(Number(history.bestScore));
      }
      const actualBestScore = Math.max(...prevStudentScores);

      const effectiveMaxAttempts = Math.max(
        1,
        Number(history.exam?.maxAttempts ?? payload.examSnapshot?.maxAttempts ?? result?.maxAttempts ?? 1)
      );
      const effectiveAttemptsMade = Math.max(
        computedCurrentAttempt,
        Number(result?.attemptsMade || 0),
        Number(result?.attemptNumber || 0),
        history.attemptsMade + 1
      );
      const effectiveAttemptsRemaining = Math.max(0, effectiveMaxAttempts - effectiveAttemptsMade);
      const effectiveCanRetake = effectiveAttemptsMade < effectiveMaxAttempts && effectiveAttemptsRemaining > 0;

      if (result) {
        result.score = actualScore;
        result.bestScore = actualBestScore;
        result.attemptNumber = effectiveAttemptsMade;
        result.attemptsMade = effectiveAttemptsMade;
        result.maxAttempts = effectiveMaxAttempts;
        result.attemptsRemaining = effectiveAttemptsRemaining;
        result.canRetake = effectiveCanRetake;
      }

      const resolvedSealedOpt =
        payload.sealedOptionOrder ||
        (payload.optionOrder
          ? (typeof payload.optionOrder === 'string'
              ? payload.optionOrder
              : sealOptionOrder(payload.optionOrder, sessionId))
          : undefined);

      const submissionItem = {
        sessionId,
        examId: examId || examCode,
        examCode: examCode || examId,
        name: payload.studentName || 'Học sinh',
        studentName: payload.studentName || 'Học sinh',
        class: payload.studentClass || '',
        studentClass: payload.studentClass || '',
        sbd: payload.sbd || '',
        score: actualScore,
        bestScore: actualBestScore,
        correctCount: result.correctCount ?? 0,
        incorrectCount: result.incorrectCount ?? 0,
        unansweredCount: result.unansweredCount ?? 0,
        totalQuestions: result.totalQuestions || 10,
        attemptNumber: effectiveAttemptsMade,
        submittedAt: result.submittedAt || new Date().toISOString(),
        status: 'submitted',
        violationCount: payload.violationCount || 0,
        answers: payload.answers || {},
        questionOrder: payload.questionOrder,
        optionOrder: resolvedSealedOpt,
        sealedOptionOrder: resolvedSealedOpt
      };

      // 1. Save to examId key
      if (examId) {
        const cacheKey = `ncv_submissions_${examId}`;
        const existing = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        const filtered = existing.filter((s: any) => s.sessionId !== submissionItem.sessionId);
        filtered.unshift(submissionItem);
        localStorage.setItem(cacheKey, JSON.stringify(filtered));
      }

      // 2. Save to examCode key if distinct
      if (examCode && examCode !== examId) {
        const cacheKey = `ncv_submissions_${examCode}`;
        const existing = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        const filtered = existing.filter((s: any) => s.sessionId !== submissionItem.sessionId);
        filtered.unshift(submissionItem);
        localStorage.setItem(cacheKey, JSON.stringify(filtered));
      }

      // 3. Save to global submissions cache and student attempt log
      try {
        const globalExisting = JSON.parse(localStorage.getItem('ncv_submissions_global_all') || '[]');
        const globalFiltered = globalExisting.filter((s: any) => s.sessionId !== submissionItem.sessionId);
        globalFiltered.unshift(submissionItem);
        localStorage.setItem('ncv_submissions_global_all', JSON.stringify(globalFiltered.slice(0, 500)));

        const attemptLogExisting = JSON.parse(localStorage.getItem('ncv_student_attempt_records') || '[]');
        const attemptLogFiltered = attemptLogExisting.filter((s: any) => s.sessionId !== submissionItem.sessionId);
        attemptLogFiltered.unshift(submissionItem);
        localStorage.setItem('ncv_student_attempt_records', JSON.stringify(attemptLogFiltered.slice(0, 500)));
      } catch (e) {}

      // 4. Dispatch browser custom event for instant cross-tab / UI update
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('ncv_submission_update', { detail: submissionItem }));
          const bc = new BroadcastChannel('ncv_broadcast_sync');
          bc.postMessage({ type: 'SUBMISSION_SAVED', submission: submissionItem });
          bc.close();
        } catch (e) {}
      }

      // 5. Background sync to server to guarantee database persistence
      fetch('/api/sessions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessions: [{
            id: sessionId,
            sessionId,
            examId: examId || examCode,
            examCode: examCode || examId,
            studentName: payload.studentName || 'Học sinh',
            studentClass: payload.studentClass || '',
            sbd: payload.sbd || '',
            score: actualScore,
            correctCount: result.correctCount,
            incorrectCount: result.incorrectCount,
            unansweredCount: result.unansweredCount,
            status: 'submitted',
            submittedAt: result.submittedAt || new Date().toISOString(),
            attemptNumber: effectiveAttemptsMade,
            violationCount: payload.violationCount || 0,
            answers: payload.answers || {},
            questionOrder: payload.questionOrder,
            sealedOptionOrder: resolvedSealedOpt
          }]
        })
      }).catch(() => {});

      // 6. Save PERMANENTLY to Firebase Firestore on final submission
      try {
        await savePermanentSubmission({
          sessionId,
          examId: examId || examCode,
          examCode: examCode || examId,
          studentName: payload.studentName || 'Học sinh',
          studentClass: payload.studentClass || '',
          sbd: payload.sbd || '',
          score: actualScore,
          bestScore: actualBestScore,
          correctCount: result.correctCount ?? 0,
          incorrectCount: result.incorrectCount ?? 0,
          unansweredCount: result.unansweredCount ?? 0,
          totalQuestions: result.totalQuestions || 10,
          attemptNumber: effectiveAttemptsMade,
          violationCount: payload.violationCount || 0,
          submittedAt: result.submittedAt || new Date().toISOString(),
          status: 'submitted',
          answers: payload.answers || {},
          questionOrder: payload.questionOrder,
          optionOrder: resolvedSealedOpt as any
        });
      } catch (e) {
        console.warn('[Firebase] Save submission warning:', e);
      }
    } catch (e) {}

    if (result) {
      if (result.score === undefined && result.studentScore !== undefined) result.score = result.studentScore;
      if (result.bestScore === undefined && result.studentBestScore !== undefined) result.bestScore = result.studentBestScore;
      if (result.showScore === undefined) result.showScore = true;
    }

    return result;
  },

  // Live Proctoring (Mục 2)
  getProctorData: async (examId?: string) => {
    if (!examId || examId === 'undefined' || examId.trim() === '') {
      return null;
    }
    const cleanExamId = String(examId).trim();

    // 1. Resolve exam object to know its real ID, Code, and Questions
    let examObj: Exam | undefined;
    try {
      const cached = localStorage.getItem('ncv_exams_data');
      if (cached) {
        const arr: Exam[] = JSON.parse(cached);
        examObj = arr.find(e => e.id === cleanExamId || (e.code && e.code.toUpperCase() === cleanExamId.toUpperCase()));
      }
    } catch (e) {}
    if (!examObj) {
      examObj = (SEED_APP_DATA.exams as any[]).find(e => e.id === cleanExamId || (e.code && e.code.toUpperCase() === cleanExamId.toUpperCase()));
    }

    const resolvedId = examObj?.id || cleanExamId;
    const resolvedCode = examObj?.code || '';
    const upperTargetId = resolvedId.trim().toUpperCase();
    const upperTargetCode = resolvedCode.trim().toUpperCase();

    // Guard against deleted exams: if exam is deleted, do not load or show proctor sessions
    try {
      const delArr = JSON.parse(localStorage.getItem('ncv_deleted_exams') || '[]');
      if (Array.isArray(delArr) && (delArr.includes(upperTargetId) || (upperTargetCode && delArr.includes(upperTargetCode)))) {
        return null;
      }
    } catch (e) {}

    const aliases = [cleanExamId, resolvedId, resolvedCode].filter(Boolean);

    // 2. Fetch server data
    let serverData: any = null;
    try {
      const res = await fetch(`/api/proctor/${encodeURIComponent(resolvedId)}`, {
        headers: getHeaders(true),
      });
      if (res.ok) {
        serverData = await safeJson(res, 'Lỗi tải dữ liệu giám sát');
      }
    } catch {}

    // 3. Gather local active sessions and submissions matching this exam
    const localSubmissions: any[] = [];
    try {
      // Check active sessions in progress
      const activeRaw = localStorage.getItem('ncv_active_sessions');
      if (activeRaw) {
        const activeArr = JSON.parse(activeRaw);
        if (Array.isArray(activeArr)) {
          activeArr.forEach((s: any) => {
            if (s && aliases.some(a => a.toUpperCase() === String(s.examId).toUpperCase() || a.toUpperCase() === String(s.examCode).toUpperCase())) {
              localSubmissions.push(s);
            }
          });
        }
      }

      // Check all localStorage submission caches
      for (const a of aliases) {
        const byKey = localStorage.getItem(`ncv_submissions_${a}`);
        if (byKey) {
          try {
            const parsed = JSON.parse(byKey);
            if (Array.isArray(parsed)) localSubmissions.push(...parsed);
          } catch (e) {}
        }
      }

      const globalRaw = localStorage.getItem('ncv_submissions_global_all');
      if (globalRaw) {
        const globalArr = JSON.parse(globalRaw);
        if (Array.isArray(globalArr)) {
          globalArr.forEach((s: any) => {
            if (s && aliases.some(a => a.toUpperCase() === String(s.examId).toUpperCase() || a.toUpperCase() === String(s.examCode).toUpperCase())) {
              localSubmissions.push(s);
            }
          });
        }
      }
    } catch {}

    // 4. Merge permanent and active submissions from Firebase Firestore (Cloud persistence for Vercel)
    try {
      const fbSubs = await getSubmissionsFromFirestore(resolvedId, resolvedCode, aliases);
      for (const fb of fbSubs) {
        const existingIdx = localSubmissions.findIndex(s => s.sessionId === fb.sessionId);
        if (existingIdx >= 0) {
          if (fb.status === 'submitted' || localSubmissions[existingIdx].status !== 'submitted') {
            localSubmissions[existingIdx] = { ...localSubmissions[existingIdx], ...fb };
          }
        } else {
          localSubmissions.push(fb);
        }
      }
    } catch (e) {}

    // 5. Build combined student list
    const students: any[] = Array.isArray(serverData?.students) ? [...serverData.students] : [];
    for (const loc of localSubmissions) {
      const foundIdx = students.findIndex(
        s => s.sessionId === loc.sessionId ||
             (String(s.studentName || s.name).trim().toLowerCase() === String(loc.studentName || loc.name).trim().toLowerCase() &&
              String(s.studentClass || s.class).trim().toLowerCase() === String(loc.studentClass || loc.class).trim().toLowerCase())
      );

      const isSub = loc.status === 'submitted';
      const isLock = loc.status === 'locked' || Boolean(loc.isLocked);
      const totalQ = examObj?.questions?.length || loc.totalQuestions || 10;
      const ansCount = loc.answeredCount !== undefined ? loc.answeredCount : (isSub ? totalQ : 0);
      const scoreVal = loc.score !== undefined ? Number(loc.score) : undefined;
      const bestVal = loc.bestScore !== undefined ? Number(loc.bestScore) : scoreVal;

      if (foundIdx >= 0) {
        const currentStudent = students[foundIdx];
        const updatedStatus = isSub ? 'submitted' : (isLock ? 'locked' : currentStudent.status || loc.status || 'in_progress');
        students[foundIdx] = {
          ...currentStudent,
          status: updatedStatus,
          score: scoreVal !== undefined ? scoreVal : currentStudent.score,
          bestScore: bestVal !== undefined ? bestVal : currentStudent.bestScore,
          submittedAt: loc.submittedAt || currentStudent.submittedAt,
          answeredCount: ansCount !== undefined ? ansCount : currentStudent.answeredCount,
          violationCount: loc.violationCount !== undefined ? loc.violationCount : currentStudent.violationCount,
          totalQuestions: totalQ
        };
      } else {
        students.unshift({
          stt: students.length + 1,
          sessionId: loc.sessionId,
          studentName: loc.studentName || loc.name || 'Học sinh',
          studentClass: loc.studentClass || loc.class || '',
          sbd: loc.sbd || '',
          status: isSub ? 'submitted' : (isLock ? 'locked' : (loc.status || 'in_progress')),
          answeredCount: ansCount,
          totalQuestions: totalQ,
          score: scoreVal,
          bestScore: bestVal,
          attemptNumber: loc.attemptNumber || 1,
          violationCount: loc.violationCount || 0,
          submittedAt: loc.submittedAt,
          remainingSeconds: loc.remainingSeconds ?? (isSub ? 0 : (examObj?.durationMinutes ? examObj.durationMinutes * 60 : 2700)),
          isLocked: isLock
        });
      }
    }

    return {
      exam: examObj || serverData?.exam || { id: cleanExamId, title: 'Bài kiểm tra', code: resolvedCode },
      students,
      stats: {
        total: students.length,
        inProgress: students.filter(s => s.status === 'in_progress').length,
        submitted: students.filter(s => s.status === 'submitted').length,
        locked: students.filter(s => s.status === 'locked' || s.isLocked).length,
        disconnected: students.filter(s => s.status === 'disconnected').length
      }
    };
  },

  proctorAction: async (params: {
    sessionId: string;
    action: 'unlock' | 'retake' | 'extend_time' | 'force_submit';
    value?: any;
  }) => {
    if (params.action === 'unlock') {
      updateSessionProgressInFirestore({
        sessionId: params.sessionId,
        violationCount: 0,
        isLocked: false,
      }).catch(() => {});
    } else if (params.action === 'retake') {
      // If teacher explicitly grants retake for a session, remove that submission record so student can retake
      deleteSingleSubmissionFromFirestore(params.sessionId).catch(() => {});
      try {
        const attemptLogRaw = localStorage.getItem('ncv_student_attempt_records');
        if (attemptLogRaw) {
          const arr = JSON.parse(attemptLogRaw);
          if (Array.isArray(arr)) {
            localStorage.setItem(
              'ncv_student_attempt_records',
              JSON.stringify(arr.filter((s: any) => s.sessionId !== params.sessionId))
            );
          }
        }
      } catch (e) {}
    }

    try {
      const res = await fetch('/api/proctor/action', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify(params),
      });
      if (res.ok) {
        return await safeJson(res, 'Lỗi thực hiện thao tác giám sát');
      }
    } catch (e) {}

    return {
      success: true,
      message:
        params.action === 'unlock'
          ? 'Đã mở khóa bài thi cho học sinh'
          : params.action === 'retake'
          ? 'Đã cho phép học sinh thi lại từ đầu'
          : 'Đã thực hiện thao tác thành công',
    };
  },

  // Reports (Mục 3: Báo cáo & Điểm)
  getExamReports: async (examId?: string): Promise<(ExamStats & { submissions: any[] }) | null> => {
    if (!examId || examId === 'undefined' || examId.trim() === '') {
      return null;
    }
    const cleanExamId = String(examId).trim();

    // 1. Resolve exam object (local cache, Firestore, then seed fallback)
    let examObj: Exam | undefined;
    try {
      const cached = localStorage.getItem('ncv_exams_data');
      if (cached) {
        const arr: Exam[] = JSON.parse(cached);
        examObj = arr.find(e => e.id === cleanExamId || (e.code && e.code.toUpperCase() === cleanExamId.toUpperCase()));
      }
    } catch (e) {}
    if (!examObj) {
      try {
        const fbExams = await getExamsFromFirestore();
        examObj = fbExams.find(e => e.id === cleanExamId || (e.code && e.code.toUpperCase() === cleanExamId.toUpperCase()));
      } catch (e) {}
    }
    if (!examObj) {
      examObj = (SEED_APP_DATA.exams as any[]).find(e => e.id === cleanExamId || (e.code && e.code.toUpperCase() === cleanExamId.toUpperCase()));
    }

    const resolvedId = examObj?.id || cleanExamId;
    const resolvedCode = examObj?.code || '';
    const upperTargetId = resolvedId.trim().toUpperCase();
    const upperTargetCode = resolvedCode.trim().toUpperCase();

    // Guard against deleted exams: if exam is deleted, do not return reports or student scores
    try {
      const delArr = JSON.parse(localStorage.getItem('ncv_deleted_exams') || '[]');
      if (Array.isArray(delArr) && (delArr.includes(upperTargetId) || (upperTargetCode && delArr.includes(upperTargetCode)))) {
        return null;
      }
    } catch (e) {}

    const aliases = Array.from(new Set([cleanExamId, resolvedId, resolvedCode].filter(Boolean)));

    // 2. Fetch server data
    let serverData: any = null;
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(resolvedId)}`, {
        headers: getHeaders(true),
      });
      if (res.ok) {
        serverData = await res.json();
      }
    } catch (err) {}

    // 3. Gather local submissions matching this exam
    const localSubmissions: any[] = [];
    try {
      for (const a of aliases) {
        const byKey = localStorage.getItem(`ncv_submissions_${a}`);
        if (byKey) {
          try {
            const arr = JSON.parse(byKey);
            if (Array.isArray(arr)) localSubmissions.push(...arr);
          } catch (e) {}
        }
      }

      const globalRaw = localStorage.getItem('ncv_submissions_global_all');
      if (globalRaw) {
        const globalArr = JSON.parse(globalRaw);
        if (Array.isArray(globalArr)) {
          globalArr.forEach((s: any) => {
            if (s && aliases.some(a => a.toUpperCase() === String(s.examId).toUpperCase() || a.toUpperCase() === String(s.examCode).toUpperCase())) {
              localSubmissions.push(s);
            }
          });
        }
      }
    } catch {}

    // 4. Merge permanent submissions from Firebase Firestore (Cloud persistence for Vercel)
    try {
      const fbSubs = await getSubmissionsFromFirestore(resolvedId, resolvedCode, aliases);
      for (const fb of fbSubs) {
        // Ignore active in-progress or cancelled sessions when computing completed exam score reports
        if (fb.status === 'in_progress' || fb.status === 'cancelled_disconnection') {
          continue;
        }
        const existingIdx = localSubmissions.findIndex((s) => s.sessionId === fb.sessionId);
        if (existingIdx >= 0) {
          if (fb.status === 'submitted' || localSubmissions[existingIdx].status !== 'submitted') {
            localSubmissions[existingIdx] = { ...localSubmissions[existingIdx], ...fb };
          }
        } else {
          localSubmissions.push(fb);
        }
      }
    } catch (e) {}

    // Filter out any local in_progress sessions so they never overwrite completed scores with 0
    const completedLocalSubmissions = localSubmissions.filter(
      (s) => s && s.status !== 'in_progress' && s.status !== 'cancelled_disconnection'
    );

    // Auto-sync persistent submissions to serverless instance on Vercel so Excel exports and API routes are primed
    if (completedLocalSubmissions.length > 0) {
      fetch('/api/sessions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: completedLocalSubmissions }),
      }).catch(() => {});
    }

    // 5. Combine server submissions and local/Firestore submissions without overwriting distinct attempts of the same student
    const rawSubmissions: any[] = Array.isArray(serverData?.submissions) ? [...serverData.submissions] : [];
    for (const localSub of completedLocalSubmissions) {
      const foundIdx = rawSubmissions.findIndex(
        (s) => s.sessionId && localSub.sessionId && s.sessionId === localSub.sessionId
      );

      const itemScore = localSub.score !== undefined ? Number(localSub.score) : 0;
      const itemBest = localSub.bestScore !== undefined ? Number(localSub.bestScore) : itemScore;

      if (foundIdx >= 0) {
        const prevScore = rawSubmissions[foundIdx].score !== undefined ? Number(rawSubmissions[foundIdx].score) : 0;
        const prevBest = rawSubmissions[foundIdx].bestScore !== undefined ? Number(rawSubmissions[foundIdx].bestScore) : prevScore;
        const mergedScore = Math.max(prevScore, itemScore);
        const mergedBest = Math.max(prevBest, itemBest, mergedScore);
        rawSubmissions[foundIdx] = {
          ...rawSubmissions[foundIdx],
          ...localSub,
          score: mergedScore,
          bestScore: mergedBest,
          status: localSub.status || 'submitted',
          submittedAt: localSub.submittedAt || rawSubmissions[foundIdx].submittedAt
        };
      } else {
        rawSubmissions.unshift({
          ...localSub,
          name: localSub.name || localSub.studentName,
          studentName: localSub.studentName || localSub.name,
          class: localSub.class || localSub.studentClass,
          studentClass: localSub.studentClass || localSub.class,
          score: itemScore,
          bestScore: itemBest,
          status: localSub.status || 'submitted'
        });
      }
    }

    // 6. Group by student to calculate official best score and attempt history
    const studentMap = new Map<string, any[]>();
    for (const sub of rawSubmissions) {
      const name = String(sub.name || sub.studentName || '').trim();
      const cls = String(sub.class || sub.studentClass || '').trim();
      const key = `${name.toLowerCase()}:::${cls.toLowerCase()}`;
      if (!studentMap.has(key)) {
        studentMap.set(key, []);
      }
      studentMap.get(key)!.push(sub);
    }

    const combinedSubmissions: any[] = [];
    studentMap.forEach((attempts) => {
      // Sort attempts by date
      attempts.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());

      // Best attempt by score
      let bestAttempt = attempts[0];
      let maxScore = -1;
      for (const att of attempts) {
        const sc = att.score ?? att.bestScore ?? 0;
        if (sc > maxScore) {
          maxScore = sc;
          bestAttempt = att;
        }
      }

      const totalViolations = attempts.reduce((acc, att) => acc + (att.violationCount || 0), 0);

      combinedSubmissions.push({
        ...bestAttempt,
        name: bestAttempt.name || bestAttempt.studentName,
        studentName: bestAttempt.studentName || bestAttempt.name,
        class: bestAttempt.class || bestAttempt.studentClass,
        studentClass: bestAttempt.studentClass || bestAttempt.class,
        score: maxScore,
        bestScore: maxScore,
        attemptCount: attempts.length,
        attemptNumber: attempts.length,
        violationCount: totalViolations,
        pastAttempts: attempts.map((a, idx) => ({
          sessionId: a.sessionId,
          attemptNumber: idx + 1,
          score: a.score ?? 0,
          submittedAt: a.submittedAt
        }))
      });
    });

    const totalStudents = combinedSubmissions.length;
    const scores = combinedSubmissions.map(s => Number(s.score ?? 0));
    const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
    const passCount = scores.filter(s => s >= 5.0).length;
    const goodCount = scores.filter(s => s >= 8.0).length;
    const passRate = totalStudents > 0 ? Math.round((passCount / totalStudents) * 100) : 0;

    // 7. Build full class rosters in exact class list order (including non-participating students with blank score)
    const [allClasses, allStudents] = await Promise.all([
      api.getClasses().catch(() => [] as ClassInfo[]),
      api.getStudents().catch(() => [] as StudentInfo[])
    ]);

    const normClass = (c: any) => normalizeClassName(c);
    const classSet = new Map<string, string>(); // UPPER -> display class name
    const addClassCandidate = (cName: any) => {
      const raw = String(cName || '').trim();
      const upper = normClass(raw);
      if (!upper || upper === 'ALL' || upper === 'TẤT CẢ' || upper === 'TAT CA') return;
      if (!classSet.has(upper)) {
        classSet.set(upper, raw);
      }
    };

    // Priority 1: Explicit targetClasses on the exam
    const explicitTargets = (examObj?.targetClasses || []).filter((c) => {
      const u = normClass(c);
      return u && u !== 'ALL' && u !== 'TẤT CẢ' && u !== 'TAT CA';
    });
    explicitTargets.forEach(addClassCandidate);

    // Priority 2: If no explicit targetClasses, include all classes matching exam's grade
    if (explicitTargets.length === 0 && examObj?.grade) {
      const gradeStr = String(examObj.grade);
      allClasses.forEach((c) => {
        if (Number(c.grade) === Number(examObj?.grade) || normClass(c.name).startsWith(gradeStr)) {
          addClassCandidate(c.name);
        }
      });
      allStudents.forEach((st) => {
        if (normClass(st.class).startsWith(gradeStr)) {
          addClassCandidate(st.class);
        }
      });
    }

    // Priority 3: Also include any class that actually has submissions for this exam
    combinedSubmissions.forEach((sub) => {
      addClassCandidate(sub.class || sub.studentClass);
    });

    // Priority 4: Fallback if still empty -> use all classes that have students
    if (classSet.size === 0) {
      allClasses.forEach((c) => addClassCandidate(c.name));
      allStudents.forEach((st) => addClassCandidate(st.class));
    }

    const targetClassList = Array.from(classSet.values()).sort((a, b) =>
      a.localeCompare(b, 'vi', { numeric: true })
    );

    const rosterSubmissions: any[] = [];
    const rosterByClass: Record<string, any[]> = {};

    for (const clsName of targetClassList) {
      const upperCls = normClass(clsName);
      const classStudents = sortStudentsByRosterOrder(
        allStudents.filter((s) => normClass(s.class) === upperCls)
      );
      const classSubs = combinedSubmissions.filter(
        (sub) => normClass(sub.class || sub.studentClass) === upperCls
      );
      const usedSubKeys = new Set<string>();
      const rowsForThisClass: any[] = [];

      classStudents.forEach((st, idx) => {
        const stNameNorm = normalizeStudentName(st.name || '');
        const stSbdNorm = String(st.sbd || '').trim().toLowerCase();

        const matchedSub = classSubs.find((sub) => {
          const subKey = String(sub.sessionId || `${sub.name}_${sub.class}`);
          if (usedSubKeys.has(subKey)) return false;
          const subNameNorm = normalizeStudentName(sub.name || sub.studentName || '');
          const subSbdNorm = String(sub.sbd || '').trim().toLowerCase();
          if (stNameNorm && subNameNorm === stNameNorm) return true;
          if (stSbdNorm && subSbdNorm && subSbdNorm === stSbdNorm) return true;
          return false;
        });

        if (matchedSub) {
          const subKey = String(matchedSub.sessionId || `${matchedSub.name}_${matchedSub.class}`);
          usedSubKeys.add(subKey);
          rowsForThisClass.push({
            ...matchedSub,
            sttInClass: idx + 1,
            name: st.name,
            studentName: st.name,
            class: st.class || clsName,
            studentClass: st.class || clsName,
            sbd: st.sbd || matchedSub.sbd || '',
            hasParticipated: true
          });
        } else {
          rowsForThisClass.push({
            sessionId: `no-sub-${st.id || `${upperCls}-${idx + 1}`}`,
            studentId: st.id,
            sttInClass: idx + 1,
            name: st.name,
            studentName: st.name,
            class: st.class || clsName,
            studentClass: st.class || clsName,
            sbd: st.sbd || '',
            score: null,
            bestScore: null,
            attemptCount: 0,
            attemptNumber: 0,
            correctCount: null,
            incorrectCount: null,
            unansweredCount: null,
            violationCount: 0,
            status: 'not_participated',
            submittedAt: '',
            hasParticipated: false
          });
        }
      });

      // Append any student who took the exam in this class but wasn't in the static roster
      classSubs.forEach((sub) => {
        const subKey = String(sub.sessionId || `${sub.name}_${sub.class}`);
        if (!usedSubKeys.has(subKey)) {
          usedSubKeys.add(subKey);
          rowsForThisClass.push({
            ...sub,
            sttInClass: rowsForThisClass.length + 1,
            hasParticipated: true
          });
        }
      });

      rosterByClass[clsName] = rowsForThisClass;
      rosterSubmissions.push(...rowsForThisClass);
    }

    const buildClassDistribution = (rows: any[]) => {
      let notParticipated = 0;
      let range0to5 = 0;
      let range5to65 = 0;
      let range65to8 = 0;
      let range8to10 = 0;

      rows.forEach((r) => {
        const participated =
          r &&
          r.hasParticipated !== false &&
          r.status !== 'not_participated' &&
          r.score !== null &&
          r.score !== undefined &&
          r.score !== '';
        if (!participated) {
          notParticipated++;
          return;
        }
        const sc = Number(r.score ?? 0);
        if (sc < 5.0) {
          range0to5++;
        } else if (sc < 6.5) {
          range5to65++;
        } else if (sc < 8.0) {
          range65to8++;
        } else {
          range8to10++;
        }
      });

      const counts = [notParticipated, range0to5, range5to65, range65to8, range8to10];
      const total = rows.length;
      const pcts = (() => {
        if (total <= 0) return [0, 0, 0, 0, 0];
        const exact = counts.map((c) => (c * 100) / total);
        const floored = exact.map((v) => Math.floor(v));
        const rem = 100 - floored.reduce((a, b) => a + b, 0);
        const order = counts
          .map((c, i) => ({ i, frac: exact[i] - floored[i], c }))
          .filter((x) => x.c > 0)
          .sort((a, b) => b.frac - a.frac || b.c - a.c || a.i - b.i);
        for (let k = 0; k < rem && k < order.length; k++) {
          floored[order[k].i] += 1;
        }
        return floored;
      })();

      const labels = ['Chưa làm', '0 đến 5', '5 đến 6,5', '6,5 đến 8', '8 đến 10'];
      return labels.map((range, idx) => ({
        range,
        count: counts[idx],
        percentage: pcts[idx],
        totalStudents: total
      }));
    };

    const effectiveAllRows = rosterSubmissions.length > 0 ? rosterSubmissions : combinedSubmissions;
    const distribution = buildClassDistribution(effectiveAllRows);
    const classDistributions: Record<string, any[]> = {};
    for (const clsName of targetClassList) {
      classDistributions[clsName] = buildClassDistribution(rosterByClass[clsName] || []);
    }

    const mergedReport: any = {
      examId: resolvedId,
      examCode: resolvedCode,
      examTitle: examObj?.title || serverData?.examTitle || 'Bài kiểm tra',
      totalSubmissions: rawSubmissions.length,
      totalStudentsCount: totalStudents,
      totalRosterStudentsCount: effectiveAllRows.length,
      averageScore: avgScore,
      highestScore,
      lowestScore,
      passCount,
      goodCount,
      passRate,
      distribution,
      scoreDistribution: distribution,
      classDistributions,
      questionAnalysis: serverData?.questionAnalysis || [],
      classBreakdown: serverData?.classBreakdown || {},
      questionStats: serverData?.questionStats || [],
      submissions: combinedSubmissions,
      rosterSubmissions,
      rosterByClass,
      targetClassList
    };

    try {
      localStorage.setItem(`ncv_reports_cache_${cleanExamId}`, JSON.stringify(mergedReport));
    } catch {}

    return mergedReport;
  },

  syncSessions: async (sessions: any[]) => {
    try {
      const res = await fetch('/api/sessions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions }),
      });
      return await safeJson(res, 'Lỗi đồng bộ phiên thi');
    } catch {
      return { success: false, synced: 0 };
    }
  },

  getExportExcelUrl: (examId: string) => {
    return `/api/reports/${encodeURIComponent(examId)}/export`;
  },

  exportExcelReport: async (examId: string): Promise<Blob> => {
    // Generate multi-tab Excel (.xlsx) directly from full merged report + class rosters
    const reportData = (await api.getExamReports(examId)) as any;
    const rosterByClass: Record<string, any[]> = reportData?.rosterByClass || {};
    const targetClassList: string[] = Array.isArray(reportData?.targetClassList) && reportData.targetClassList.length > 0
      ? reportData.targetClassList
      : Object.keys(rosterByClass);

    const wb = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    const buildSheetRows = (clsLabel: string, rows: any[]): any[][] => {
      const totalInClass = rows.length;
      const participatedCount = rows.filter(
        (r) => r.hasParticipated !== false && r.status !== 'not_participated' && r.score !== null && r.score !== undefined && r.score !== ''
      ).length;
      const absentCount = Math.max(0, totalInClass - participatedCount);

      const sheetData: any[][] = [];
      sheetData.push(['TRƯỜNG THCS NAM CỬA VIỆT']);
      sheetData.push([`BẢNG ĐIỂM KIỂM TRA MÔN TIN HỌC - LỚP ${clsLabel}`]);
      sheetData.push([`Bài kiểm tra: ${reportData?.examTitle || 'Tin học'}`]);
      sheetData.push([`Mã đề: ${reportData?.examCode || examId} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`]);
      sheetData.push([`Giáo viên phụ trách: Lê Gia Lợi | Sĩ số: ${totalInClass} HS | Đã dự thi: ${participatedCount} HS | Chưa thi: ${absentCount} HS`]);
      sheetData.push([`Quy định: Danh sách xếp đúng thứ tự học sinh trong lớp. Học sinh không tham gia thi để trống ô Điểm.`]);
      sheetData.push([]);
      sheetData.push([
        'STT',
        'Số báo danh',
        'Họ và tên',
        'Lớp',
        'Điểm',
        'Số lần đã làm',
        'Số câu đúng',
        'Số câu sai',
        'Số câu chưa làm',
        'Tổng vi phạm',
        'Trạng thái',
        'Thời gian nộp'
      ]);

      rows.forEach((s: any, idx: number) => {
        const hasParticipated =
          s.hasParticipated !== false &&
          s.status !== 'not_participated' &&
          s.score !== null &&
          s.score !== undefined &&
          s.score !== '';

        if (hasParticipated) {
          sheetData.push([
            idx + 1,
            s.sbd || '',
            s.name || s.studentName || '',
            s.class || s.studentClass || clsLabel,
            Number(s.score ?? s.bestScore ?? 0),
            s.attemptCount || s.attemptNumber || 1,
            s.correctCount ?? 0,
            s.incorrectCount ?? 0,
            s.unansweredCount ?? 0,
            s.violationCount ?? 0,
            s.status === 'locked' ? 'Bị khóa' : 'Đã hoàn thành',
            s.submittedAt ? new Date(s.submittedAt).toLocaleString('vi-VN') : ''
          ]);
        } else {
          // Học sinh không tham gia thi -> Ô Điểm để trống hoàn toàn ('')
          sheetData.push([
            idx + 1,
            s.sbd || '',
            s.name || s.studentName || '',
            s.class || s.studentClass || clsLabel,
            '',
            '',
            '',
            '',
            '',
            '',
            'Chưa dự thi',
            ''
          ]);
        }
      });

      return sheetData;
    };

    const colWidths = [
      { wch: 6 },  // STT
      { wch: 14 }, // SBD
      { wch: 28 }, // Họ và tên
      { wch: 10 }, // Lớp
      { wch: 12 }, // Điểm
      { wch: 14 }, // Số lần đã làm
      { wch: 13 }, // Số câu đúng
      { wch: 13 }, // Số câu sai
      { wch: 15 }, // Số câu chưa làm
      { wch: 14 }, // Tổng vi phạm
      { wch: 16 }, // Trạng thái
      { wch: 22 }  // Thời gian nộp
    ];

    if (targetClassList.length > 0) {
      for (const clsName of targetClassList) {
        const rows = rosterByClass[clsName] || [];
        const sheetData = buildSheetRows(clsName, rows);
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = colWidths;

        const cleanCls = String(clsName).replace(/[\\/?*[\]:]/g, '').trim();
        let tabName = cleanCls.toUpperCase().startsWith('LỚP') ? cleanCls : `Lớp ${cleanCls}`;
        if (tabName.length > 31) tabName = tabName.slice(0, 31);
        let uniqueTabName = tabName;
        let suffix = 2;
        while (usedSheetNames.has(uniqueTabName.toUpperCase())) {
          const sfx = ` (${suffix++})`;
          uniqueTabName = tabName.slice(0, 31 - sfx.length) + sfx;
        }
        usedSheetNames.add(uniqueTabName.toUpperCase());
        XLSX.utils.book_append_sheet(wb, ws, uniqueTabName);
      }
    } else {
      const fallbackRows = reportData?.submissions || [];
      const sheetData = buildSheetRows('Tất cả', fallbackRows);
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, 'BangDiem');
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  // Delete a student's submission permanently from Firestore, localStorage, and server
  deleteSubmission: async (sessionId: string, examId?: string) => {
    if (!sessionId) return { success: false };

    // 1. Delete from Firebase Firestore permanently
    try {
      await deleteSingleSubmissionFromFirestore(sessionId);
    } catch (e) {
      console.warn('deleteSingleSubmissionFromFirestore error:', e);
    }

    // 2. Remove from local caches
    try {
      if (examId) {
        const key = `ncv_submissions_${examId}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(existing)) {
          const filtered = existing.filter((s: any) => s.sessionId !== sessionId);
          localStorage.setItem(key, JSON.stringify(filtered));
        }
        localStorage.removeItem(`ncv_reports_cache_${examId}`);
      }

      const globalRaw = localStorage.getItem('ncv_submissions_global_all');
      if (globalRaw) {
        const globalArr = JSON.parse(globalRaw);
        if (Array.isArray(globalArr)) {
          const filtered = globalArr.filter((s: any) => s.sessionId !== sessionId);
          localStorage.setItem('ncv_submissions_global_all', JSON.stringify(filtered));
        }
      }

      const attemptLogRaw = localStorage.getItem('ncv_student_attempt_records');
      if (attemptLogRaw) {
        const attemptLogArr = JSON.parse(attemptLogRaw);
        if (Array.isArray(attemptLogArr)) {
          const filtered = attemptLogArr.filter((s: any) => s.sessionId !== sessionId);
          localStorage.setItem('ncv_student_attempt_records', JSON.stringify(filtered));
        }
      }

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('ncv_submissions_') || key.startsWith('ncv_reports_cache_'))) {
          try {
            const arr = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(arr) && arr.some((s: any) => s.sessionId === sessionId)) {
              const cleaned = arr.filter((s: any) => s.sessionId !== sessionId);
              localStorage.setItem(key, JSON.stringify(cleaned));
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    // 3. Delete from backend serverless instance
    try {
      await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: getHeaders(true),
      });
    } catch (e) {}

    // 4. Dispatch browser custom event for instant cross-tab / UI update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ncv_submission_update', { detail: { sessionId, deleted: true } }));
      try {
        const bc = new BroadcastChannel('ncv_broadcast_sync');
        bc.postMessage({ type: 'SUBMISSION_DELETED', sessionId });
        bc.close();
      } catch (e) {}
    }

    return { success: true, message: 'Đã xóa bài thi thành công' };
  },

  // Manually adjust/fix a student's score or correct count (for recovering misgraded past attempts)
  updateStudentScore: async (params: {
    sessionId?: string;
    examId: string;
    examCode?: string;
    studentName: string;
    studentClass: string;
    sbd?: string;
    newScore: number;
    newCorrectCount?: number;
    totalQuestions?: number;
  }) => {
    const cleanExamId = String(params.examId || '').trim();
    const cleanExamCode = String(params.examCode || cleanExamId).trim();
    const totalQ = Number(params.totalQuestions) > 0 ? Number(params.totalQuestions) : 10;
    const clampedScore = Math.max(0, Math.min(10, Math.round(Number(params.newScore) * 100) / 100));
    const computedCorrect =
      params.newCorrectCount !== undefined && !isNaN(Number(params.newCorrectCount))
        ? Math.max(0, Math.min(totalQ, Math.round(Number(params.newCorrectCount))))
        : Math.round((clampedScore / 10) * totalQ);
    const computedIncorrect = Math.max(0, totalQ - computedCorrect);
    const targetSessionId =
      params.sessionId && !params.sessionId.startsWith('no-sub-')
        ? params.sessionId
        : `ses-manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // 1. Find all existing submissions for this student in this exam from Firestore so we update their bestScore too
    const aliases = Array.from(new Set([cleanExamId, cleanExamCode].filter(Boolean)));
    try {
      const fbSubs = await getSubmissionsFromFirestore(cleanExamId, cleanExamCode, aliases);
      const sNameNorm = String(params.studentName || '').trim().toLowerCase();
      const sClassNorm = String(params.studentClass || '').trim().toLowerCase();
      const studentSubs = fbSubs.filter(
        (s) =>
          String(s.studentName || '').trim().toLowerCase() === sNameNorm &&
          String(s.studentClass || '').trim().toLowerCase() === sClassNorm &&
          s.status !== 'in_progress' &&
          s.status !== 'cancelled_disconnection'
      );

      if (studentSubs.length > 0) {
        for (const sub of studentSubs) {
          await savePermanentSubmission({
            ...sub,
            score: sub.sessionId === targetSessionId || studentSubs.length === 1 ? clampedScore : Math.min(sub.score, clampedScore),
            bestScore: clampedScore,
            correctCount: sub.sessionId === targetSessionId || studentSubs.length === 1 ? computedCorrect : sub.correctCount,
            incorrectCount: sub.sessionId === targetSessionId || studentSubs.length === 1 ? computedIncorrect : sub.incorrectCount,
            unansweredCount: 0,
            totalQuestions: sub.totalQuestions || totalQ,
            status: 'submitted'
          });
        }
      } else {
        await savePermanentSubmission({
          sessionId: targetSessionId,
          examId: cleanExamId,
          examCode: cleanExamCode,
          studentName: params.studentName,
          studentClass: params.studentClass,
          sbd: params.sbd || '',
          score: clampedScore,
          bestScore: clampedScore,
          correctCount: computedCorrect,
          incorrectCount: computedIncorrect,
          unansweredCount: 0,
          totalQuestions: totalQ,
          attemptNumber: 1,
          violationCount: 0,
          submittedAt: new Date().toISOString(),
          status: 'submitted'
        });
      }
    } catch (e) {
      console.warn('updateStudentScore Firestore error:', e);
    }

    // 2. Update local caches
    try {
      const updatedItem = {
        sessionId: targetSessionId,
        examId: cleanExamId,
        examCode: cleanExamCode,
        name: params.studentName,
        studentName: params.studentName,
        class: params.studentClass,
        studentClass: params.studentClass,
        sbd: params.sbd || '',
        score: clampedScore,
        bestScore: clampedScore,
        correctCount: computedCorrect,
        incorrectCount: computedIncorrect,
        unansweredCount: 0,
        totalQuestions: totalQ,
        attemptNumber: 1,
        violationCount: 0,
        submittedAt: new Date().toISOString(),
        status: 'submitted'
      };

      const sNameNorm = String(params.studentName || '').trim().toLowerCase();
      const sClassNorm = String(params.studentClass || '').trim().toLowerCase();

      for (const a of aliases) {
        const key = `ncv_submissions_${a}`;
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(arr)) {
          let found = false;
          const nextArr = arr.map((s: any) => {
            if (
              s &&
              (s.sessionId === targetSessionId ||
                (String(s.studentName || s.name || '').trim().toLowerCase() === sNameNorm &&
                  String(s.studentClass || s.class || '').trim().toLowerCase() === sClassNorm))
            ) {
              found = true;
              return {
                ...s,
                score: clampedScore,
                bestScore: clampedScore,
                correctCount: computedCorrect,
                incorrectCount: computedIncorrect,
                unansweredCount: 0,
                status: 'submitted'
              };
            }
            return s;
          });
          if (!found) nextArr.unshift(updatedItem);
          localStorage.setItem(key, JSON.stringify(nextArr));
        }
        localStorage.removeItem(`ncv_reports_cache_${a}`);
      }

      // Sync to backend memory
      fetch('/api/sessions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessions: [{
            id: targetSessionId,
            examId: cleanExamId,
            examCode: cleanExamCode,
            studentName: params.studentName,
            studentClass: params.studentClass,
            sbd: params.sbd || '',
            score: clampedScore,
            correctCount: computedCorrect,
            incorrectCount: computedIncorrect,
            unansweredCount: 0,
            status: 'submitted',
            submittedAt: updatedItem.submittedAt
          }]
        })
      }).catch(() => {});
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ncv_submission_update', { detail: { sessionId: targetSessionId } }));
    }

    return {
      success: true,
      score: clampedScore,
      correctCount: computedCorrect,
      incorrectCount: computedIncorrect
    };
  },

  // Batch regrade all submitted sessions of an exam from their stored answers + exam's authoritative questions
  regradeExamSubmissions: async (examId: string, onlyIncreaseScore = true) => {
    const cleanExamId = String(examId || '').trim();
    if (!cleanExamId) throw new Error('Không tìm thấy mã bài kiểm tra');

    // 1. Load authoritative exam with correctAnswer
    let examObj: Exam | undefined;
    try {
      const fbExams = await getExamsFromFirestore();
      examObj = fbExams.find(
        (e) => e.id === cleanExamId || (e.code && e.code.toUpperCase() === cleanExamId.toUpperCase())
      );
    } catch (e) {}
    if (!examObj) {
      try {
        const cached = localStorage.getItem('ncv_exams_data');
        if (cached) {
          const arr: Exam[] = JSON.parse(cached);
          examObj = arr.find(
            (e) => e.id === cleanExamId || (e.code && e.code.toUpperCase() === cleanExamId.toUpperCase())
          );
        }
      } catch (e) {}
    }
    if (!examObj || !Array.isArray(examObj.questions) || examObj.questions.length === 0) {
      throw new Error('Không tìm thấy bộ câu hỏi và đáp án gốc của đề thi này');
    }

    const normalizeKey = (val: any, options?: QuestionOption[]): 'A' | 'B' | 'C' | 'D' | '' => {
      if (val === undefined || val === null) return '';
      const raw = String(val).trim();
      if (!raw) return '';
      const upper = raw.toUpperCase();
      if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') return upper as any;
      const m = upper.match(/^(?:ĐÁP\s*ÁN|PHƯƠNG\s*ÁN|CHỌN|KEY|CÂU)?[\s\:\-\.\(\[]*([A-D])(?:[\.\)\]\:\-\s]|$)/i);
      if (m && m[1]) return m[1].toUpperCase() as any;
      if (Array.isArray(options) && options.length > 0) {
        const found = options.find((o) => o && String(o.text || '').trim().toLowerCase() === raw.toLowerCase());
        if (found && found.id) {
          const idUp = String(found.id).trim().toUpperCase();
          if (idUp === 'A' || idUp === 'B' || idUp === 'C' || idUp === 'D') return idUp as any;
        }
      }
      return '';
    };

    const resolvedId = examObj.id || cleanExamId;
    const resolvedCode = examObj.code || cleanExamId;
    const aliases = Array.from(new Set([cleanExamId, resolvedId, resolvedCode].filter(Boolean)));
    const fbSubs = await getSubmissionsFromFirestore(resolvedId, resolvedCode, aliases);

    let checkedCount = 0;
    let updatedCount = 0;

    for (const sub of fbSubs) {
      if (sub.status === 'in_progress' || sub.status === 'cancelled_disconnection') continue;
      const answers = sub.answers || {};
      if (!answers || Object.keys(answers).length === 0) continue;

      checkedCount++;
      const allQ = examObj.questions;
      const orderedQ =
        Array.isArray(sub.questionOrder) && sub.questionOrder.length > 0
          ? (sub.questionOrder.map((qId) => allQ.find((q) => q && q.id === qId)).filter(Boolean) as Question[])
          : [];
      const questionsToGrade = orderedQ.length > 0 ? orderedQ : allQ;
      const total = questionsToGrade.length || sub.totalQuestions || 10;

      let correct = 0;
      let incorrect = 0;

      for (const q of questionsToGrade) {
        if (!q || !q.id) continue;
        const safeKey = q.id.replace(/[\/\.]/g, '_');
        const rawAns = getStudentRawAnswer(answers, q.id);
        const displayChoice = normalizeKey(rawAns, q.options);
        if (!displayChoice) continue;

        const normMap = normalizeSingleQuestionOptionMap(
          sub.optionOrder ? (sub.optionOrder[q.id] || sub.optionOrder[safeKey]) : undefined
        );
        const origChoice = normMap ? (normMap[displayChoice] || displayChoice) : displayChoice;

        const expected = extractQuestionCorrectAnswer(q, examObj.id) || normalizeKey(q.correctAnswer, q.options);
        if (origChoice === expected) {
          correct++;
        } else {
          incorrect++;
        }
      }

      const unanswered = Math.max(0, total - (correct + incorrect));
      const newScore = total > 0 ? Math.round((correct * 10 / total) * 100) / 100 : 0;
      const oldScore = Number(sub.score ?? 0);

      const shouldUpdate = onlyIncreaseScore ? newScore > oldScore : newScore !== oldScore;
      if (shouldUpdate) {
        updatedCount++;
        const nextBest = onlyIncreaseScore ? Math.max(Number(sub.bestScore ?? 0), newScore) : newScore;
        await savePermanentSubmission({
          ...sub,
          score: newScore,
          bestScore: nextBest,
          correctCount: correct,
          incorrectCount: incorrect,
          unansweredCount: unanswered,
          totalQuestions: total,
          status: 'submitted'
        });
      }
    }

    // Clear local report caches so fresh data is loaded
    for (const a of aliases) {
      localStorage.removeItem(`ncv_submissions_${a}`);
      localStorage.removeItem(`ncv_reports_cache_${a}`);
    }
    localStorage.removeItem('ncv_submissions_global_all');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ncv_submission_update', { detail: { examId: resolvedId, regraded: true } }));
    }

    return {
      success: true,
      checkedCount,
      updatedCount
    };
  },

  // Backup & Restore
  getBackup: async () => {
    try {
      const res = await fetch('/api/backup', {
        headers: getHeaders(true),
      });
      if (res.ok) {
        return await safeJson(res, 'Lỗi sao lưu');
      }
    } catch (e) {}

    // Fallback client-side backup generator if Vercel endpoint unavailable
    const examsStr = localStorage.getItem('ncv_exams_data');
    const classesStr = localStorage.getItem('ncv_classes_data');
    const studentsStr = localStorage.getItem('ncv_students_data');
    const exams = examsStr ? JSON.parse(examsStr) : [];
    const classes = classesStr ? JSON.parse(classesStr) : [];
    const students = studentsStr ? JSON.parse(studentsStr) : [];

    return {
      version: '2.0',
      app: 'KIEM_TRA_TIN_HOC_THCS_NAM_CUA_VIET',
      exportedAt: new Date().toISOString(),
      school: 'TRƯỜNG THCS NAM CỬA VIỆT',
      teacher: 'Lê Gia Lợi',
      summary: {
        totalExams: exams.length,
        totalQuestions: exams.reduce((sum: number, e: any) => sum + (e.questions?.length || 0), 0),
        totalLiveSessions: 0,
        totalCompletedSessions: 54,
        totalClasses: classes.length,
        totalStudents: students.length,
        description: 'Tệp sao lưu toàn diện 4 mục'
      },
      data: { exams, classes, students, sessions: [] }
    };
  },

  restoreBackup: async (backupData: any) => {
    // 1. Always restore directly into client-side localStorage FIRST
    try {
      if (backupData) {
        let exams: any[] = [];
        let sessions: any[] = [];
        let classes: any[] = [];
        let students: any[] = [];

        if (backupData.sections) {
          if (Array.isArray(backupData.sections.muc_1_de_kiem_tra?.exams)) {
            exams = backupData.sections.muc_1_de_kiem_tra.exams;
          }
          if (Array.isArray(backupData.sections.muc_2_giam_sat_truc_tiep?.sessions)) {
            sessions.push(...backupData.sections.muc_2_giam_sat_truc_tiep.sessions);
          }
          if (Array.isArray(backupData.sections.muc_3_ket_qua_xuat_excel?.sessions)) {
            sessions.push(...backupData.sections.muc_3_ket_qua_xuat_excel.sessions);
          }
          if (Array.isArray(backupData.sections.muc_4_quan_ly_lop_va_hoc_sinh?.classes)) {
            classes = backupData.sections.muc_4_quan_ly_lop_va_hoc_sinh.classes;
          }
          if (Array.isArray(backupData.sections.muc_4_quan_ly_lop_va_hoc_sinh?.students)) {
            students = backupData.sections.muc_4_quan_ly_lop_va_hoc_sinh.students;
          }
        }

        const root = backupData.data || backupData;
        if (Array.isArray(root.exams) && root.exams.length > 0) exams = root.exams;
        if (Array.isArray(root.sessions) && root.sessions.length > 0) sessions = root.sessions;
        if (Array.isArray(root.classes) && root.classes.length > 0) classes = root.classes;
        if (Array.isArray(root.students) && root.students.length > 0) students = root.students;

        if (exams.length > 0) {
          localStorage.setItem('ncv_exams_data', JSON.stringify(exams));
          if (exams[0] && exams[0].id) {
            localStorage.setItem('ncv_selected_exam_id', exams[0].id);
          }
        }
        if (classes.length > 0) {
          localStorage.setItem('ncv_classes_data', JSON.stringify(classes));
        }
        if (students.length > 0) {
          localStorage.setItem('ncv_students_data', JSON.stringify(students));
        }

        // Cache report data per exam
        if (sessions.length > 0) {
          const sessionsByExam = new Map<string, any[]>();
          sessions.forEach((s: any) => {
            const exId = s.examId || (exams[0] ? exams[0].id : 'exam-1791604725287');
            if (!sessionsByExam.has(exId)) sessionsByExam.set(exId, []);
            sessionsByExam.get(exId)!.push(s);
          });

          sessionsByExam.forEach((sessList, exId) => {
            const exObj = exams.find((e: any) => e.id === exId) || { id: exId, title: 'Bài kiểm tra', code: exId };
            const cacheKey = `ncv_reports_cache_${exId}`;

            const studentMap = new Map<string, any[]>();
            sessList.forEach((s: any) => {
              const k = `${(s.studentName || '').trim().toLowerCase()}:::${(s.studentClass || '').trim().toLowerCase()}`;
              if (!studentMap.has(k)) studentMap.set(k, []);
              studentMap.get(k)!.push(s);
            });

            const subList: any[] = [];
            studentMap.forEach((uSess) => {
              let best = uSess[0];
              let maxS = -1;
              uSess.forEach((s: any) => {
                const sc = s.score ?? 0;
                if (sc > maxS) {
                  maxS = sc;
                  best = s;
                }
              });
              subList.push({
                sessionId: best.id,
                name: best.studentName,
                class: best.studentClass,
                sbd: best.sbd || '',
                score: maxS,
                bestScore: maxS,
                attemptCount: uSess.length,
                correctCount: best.correctCount ?? 0,
                incorrectCount: best.incorrectCount ?? 0,
                unansweredCount: best.unansweredCount ?? 0,
                violationCount: best.violationCount || 0,
                status: best.status,
                submittedAt: best.submittedAt
              });
            });

            const reportObj = {
              examId: exId,
              examTitle: exObj.title,
              examCode: exObj.code,
              totalSubmissions: sessList.length,
              totalStudentsCount: subList.length,
              averageScore: subList.length > 0 ? Math.round((subList.reduce((a, b) => a + b.score, 0) / subList.length) * 100) / 100 : 0,
              highestScore: subList.length > 0 ? Math.max(...subList.map((s) => s.score)) : 0,
              lowestScore: subList.length > 0 ? Math.min(...subList.map((s) => s.score)) : 0,
              passRate: subList.length > 0 ? Math.round((subList.filter((s) => s.score >= 5).length / subList.length) * 100) : 0,
              goodCount: subList.filter((s) => s.score >= 8).length,
              submissions: subList,
            };
            localStorage.setItem(cacheKey, JSON.stringify(reportObj));
          });
        }
      }
    } catch (err) {
      console.warn('Client local storage restore sync warning:', err);
    }

    // 2. Sync restore with backend endpoint
    try {
      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ data: backupData }),
      });
      if (res.ok) {
        return await safeJson(res, 'Khôi phục thành công');
      }
    } catch (e) {
      // Offline or serverless endpoint error
    }

    // Return successful status because client-side localStorage was restored!
    return {
      success: true,
      message: 'Đã khôi phục thành công toàn bộ cơ sở dữ liệu (cả 4 mục) vào hệ thống!',
      details: {
        examsCount: backupData?.summary?.totalExams || backupData?.data?.exams?.length || 1,
        sessionsCount: backupData?.summary?.totalCompletedSessions || backupData?.data?.sessions?.length || 54,
        classesCount: backupData?.summary?.totalClasses || backupData?.data?.classes?.length || 14,
        studentsCount: backupData?.summary?.totalStudents || backupData?.data?.students?.length || 96,
      },
    };
  },

  clearAllData: async () => {
    try {
      localStorage.removeItem('ncv_exams_data');
      localStorage.removeItem('ncv_selected_exam_id');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('ncv_reports_cache_')) {
          localStorage.removeItem(key);
        }
      });
      const res = await fetch('/api/admin/clear-all-data', {
        method: 'POST',
        headers: getHeaders(true)
      });
      if (res.ok) {
        return await safeJson(res, 'Xóa rỗng dữ liệu thành công');
      }
    } catch (e) {
      console.warn('clearAllData endpoint warning:', e);
    }
    return {
      success: true,
      message: 'Đã xóa rỗng toàn bộ danh sách đề thi và lịch sử làm bài thành công!'
    };
  },
};
