import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };
import {
  sealExamQuestions,
  sealOptionOrder,
  unsealOptionOrder,
  hashPasswordSync,
  isHashedPassword,
} from '../utils/security.ts';

// Set Firestore log level to avoid benign offline / backend timeout warnings in preview environments
try {
  setLogLevel('error');
} catch (e) {}

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// CRITICAL: Initialize Firestore with experimentalAutoDetectLongPolling to prevent WebSocket 10s timeout warnings in iframes/proxies
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  // If already initialized, get existing instance
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const firestore = firestoreInstance;

export interface FirestoreSubmission {
  sessionId: string;
  examId: string;
  examCode: string;
  studentName: string;
  studentClass: string;
  sbd?: string;
  score: number;
  bestScore?: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalQuestions: number;
  attemptNumber: number;
  violationCount: number;
  submittedAt: string;
  status: string;
  startedAt?: string;
  answeredCount?: number;
  answers?: Record<string, string>;
  questionOrder?: string[];
  optionOrder?: Record<string, Record<string, string>>;
}

// 1. Initial Student Session in Firestore (Saved when student ENTERS the exam room)
export async function saveStudentSessionToFirestore(session: {
  sessionId: string;
  examId: string;
  examCode: string;
  studentName: string;
  studentClass: string;
  sbd?: string;
  status: 'in_progress' | 'submitted' | 'locked';
  startedAt?: string;
  attemptNumber?: number;
  totalQuestions?: number;
  violationCount?: number;
  answeredCount?: number;
  questionOrder?: string[];
  optionOrder?: Record<string, Record<string, string>>;
}): Promise<boolean> {
  if (!session || !session.sessionId) return false;
  try {
    const docId = `sub_${session.sessionId}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const cleanExamId = String(session.examId || '').trim();
    const cleanExamCode = String(session.examCode || cleanExamId).trim();

    const payload: Record<string, any> = {
      sessionId: String(session.sessionId),
      examId: cleanExamId,
      examCode: cleanExamCode,
      studentName: String(session.studentName || 'Học sinh').trim(),
      studentClass: String(session.studentClass || '').trim(),
      sbd: String(session.sbd || '').trim(),
      status: session.status || 'in_progress',
      startedAt: session.startedAt || new Date().toISOString(),
      attemptNumber: Number(session.attemptNumber) || 1,
      totalQuestions: Number(session.totalQuestions) || 10,
      violationCount: Number(session.violationCount) || 0,
      answeredCount: Number(session.answeredCount) || 0,
      updatedAt: new Date().toISOString()
    };

    if (Array.isArray(session.questionOrder) && session.questionOrder.length > 0) {
      payload.questionOrder = session.questionOrder.map(String);
    }
    if (session.optionOrder) {
      payload.sealedOptionOrder =
        typeof session.optionOrder === 'string'
          ? session.optionOrder
          : sealOptionOrder(session.optionOrder as any, String(session.sessionId));
    }

    await setDoc(doc(firestore, 'submissions', docId), payload, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firebase] saveStudentSessionToFirestore error:', err);
    return false;
  }
}

// 2. Update session progress (answeredCount, violationCount) in Firestore during the exam
export async function updateSessionProgressInFirestore(params: {
  sessionId: string;
  answeredCount?: number;
  violationCount?: number;
  isLocked?: boolean;
}): Promise<void> {
  if (!params.sessionId) return;
  try {
    const docId = `sub_${params.sessionId}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const update: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };
    if (params.answeredCount !== undefined) update.answeredCount = Number(params.answeredCount);
    if (params.violationCount !== undefined) update.violationCount = Number(params.violationCount);
    if (params.isLocked !== undefined) {
      update.isLocked = Boolean(params.isLocked);
      if (params.isLocked) update.status = 'locked';
    }
    await setDoc(doc(firestore, 'submissions', docId), update, { merge: true });
  } catch (err) {
    // silent catch to preserve UI responsiveness
  }
}

// 3. Permanent Student Submission to Firestore (Saved on final submit or time expiry)
export async function savePermanentSubmission(sub: FirestoreSubmission): Promise<boolean> {
  if (!sub || !sub.sessionId) return false;
  try {
    const docId = `sub_${sub.sessionId}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const cleanExamId = String(sub.examId || '').trim();
    const cleanExamCode = String(sub.examCode || cleanExamId).trim();

    // Sanitize data: NEVER allow undefined in Firestore!
    const cleanPayload: Record<string, any> = {
      sessionId: String(sub.sessionId),
      examId: cleanExamId,
      examCode: cleanExamCode,
      studentName: String(sub.studentName || 'Học sinh').trim(),
      studentClass: String(sub.studentClass || '').trim(),
      sbd: String(sub.sbd || '').trim(),
      score: typeof sub.score === 'number' && !isNaN(sub.score) ? sub.score : 0,
      bestScore: typeof sub.bestScore === 'number' && !isNaN(sub.bestScore) ? sub.bestScore : (typeof sub.score === 'number' && !isNaN(sub.score) ? sub.score : 0),
      correctCount: Number(sub.correctCount) || 0,
      incorrectCount: Number(sub.incorrectCount) || 0,
      unansweredCount: Number(sub.unansweredCount) || 0,
      totalQuestions: Number(sub.totalQuestions) || 10,
      attemptNumber: Number(sub.attemptNumber) || 1,
      violationCount: Number(sub.violationCount) || 0,
      submittedAt: sub.submittedAt || new Date().toISOString(),
      status: 'submitted',
      updatedAt: new Date().toISOString()
    };

    if (sub.answers && typeof sub.answers === 'object') {
      const cleanAnswers: Record<string, string> = {};
      Object.entries(sub.answers).forEach(([k, v]) => {
        if (k && v !== undefined && v !== null) {
          const safeKey = k.replace(/[\/\.]/g, '_');
          cleanAnswers[safeKey] = String(v);
        }
      });
      cleanPayload.answers = cleanAnswers;
    }

    if (Array.isArray(sub.questionOrder) && sub.questionOrder.length > 0) {
      cleanPayload.questionOrder = sub.questionOrder.map(String);
    }
    if (sub.optionOrder) {
      cleanPayload.sealedOptionOrder =
        typeof sub.optionOrder === 'string'
          ? sub.optionOrder
          : sealOptionOrder(sub.optionOrder as any, String(sub.sessionId));
    }

    await setDoc(doc(firestore, 'submissions', docId), cleanPayload, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firebase] savePermanentSubmission error:', err);
    return false;
  }
}

// 4. Load all student sessions & permanent submissions for an exam from Firestore
export async function getSubmissionsFromFirestore(
  examId?: string,
  examCode?: string,
  additionalAliases?: string[]
): Promise<FirestoreSubmission[]> {
  const results: FirestoreSubmission[] = [];
  const aliasSet = new Set<string>();
  const normSet = new Set<string>();

  const addAlias = (val?: string) => {
    if (!val || typeof val !== 'string') return;
    const trimmed = val.trim().toUpperCase();
    if (trimmed && trimmed !== 'ALL') {
      aliasSet.add(trimmed);
      const norm = trimmed.replace(/[^A-Z0-9]/g, '');
      if (norm) normSet.add(norm);
    }
  };

  addAlias(examId);
  addAlias(examCode);
  if (Array.isArray(additionalAliases)) {
    additionalAliases.forEach(addAlias);
  }

  try {
    // 0. Load deleted exams blacklist from memory cache to ensure submissions from deleted exams are never returned
    const deletedArr = await getDeletedExamsFromFirestore();
    const deletedSet = new Set<string>(deletedArr);

    const colRef = collection(firestore, 'submissions');
    const snap = await getDocs(colRef);

    snap.forEach((d) => {
      const data = d.data() as any;
      if (!data) return;
      const sExamId = String(data.examId || '').trim().toUpperCase();
      const sExamCode = String(data.examCode || '').trim().toUpperCase();
      const sNormId = sExamId.replace(/[^A-Z0-9]/g, '');
      const sNormCode = sExamCode.replace(/[^A-Z0-9]/g, '');

      // Strictly ignore submissions whose exam is in the deleted exams list
      if ((sExamId && deletedSet.has(sExamId)) || (sExamCode && deletedSet.has(sExamCode)) || (sNormId && deletedSet.has(sNormId))) {
        return;
      }

      let isMatch = false;
      if (aliasSet.size === 0) {
        // No filter specified: return all submissions
        isMatch = true;
      } else {
        isMatch = (sExamId !== '' && aliasSet.has(sExamId)) ||
                  (sExamCode !== '' && aliasSet.has(sExamCode)) ||
                  (sNormId !== '' && normSet.has(sNormId)) ||
                  (sNormCode !== '' && normSet.has(sNormCode));
      }

      if (isMatch) {
        const rawScore = data.score !== undefined ? Number(data.score) : undefined;
        const rawBest = data.bestScore !== undefined ? Number(data.bestScore) : undefined;
        const computedScore = rawScore !== undefined && !isNaN(rawScore) ? rawScore : (rawBest !== undefined && !isNaN(rawBest) ? rawBest : 0);
        const computedBest = rawBest !== undefined && !isNaN(rawBest) ? rawBest : computedScore;

          const resolvedSessionId = String(data.sessionId || d.id.replace(/^sub_/, ''));
          const decodedOptionOrder = unsealOptionOrder(
            data.sealedOptionOrder || data.optionOrder,
            resolvedSessionId
          );

          results.push({
            sessionId: resolvedSessionId,
            examId: String(data.examId || examId || ''),
            examCode: String(data.examCode || examCode || data.examId || ''),
            studentName: String(data.studentName || data.name || 'Học sinh').trim(),
            studentClass: String(data.studentClass || data.class || '').trim(),
            sbd: data.sbd ? String(data.sbd).trim() : undefined,
            score: computedScore,
            bestScore: computedBest,
            correctCount: Number(data.correctCount) || 0,
            incorrectCount: Number(data.incorrectCount) || 0,
            unansweredCount: Number(data.unansweredCount) || 0,
            totalQuestions: Number(data.totalQuestions) || 10,
            attemptNumber: Number(data.attemptNumber) || 1,
            violationCount: Number(data.violationCount) || 0,
            submittedAt: data.submittedAt || data.updatedAt || new Date().toISOString(),
            status: data.status || 'submitted',
            startedAt: data.startedAt,
            answeredCount: Number(data.answeredCount) || (data.status === 'submitted' ? (Number(data.totalQuestions) || 10) : 0),
            answers: data.answers || {},
            questionOrder: Array.isArray(data.questionOrder) ? data.questionOrder : undefined,
            optionOrder: Object.keys(decodedOptionOrder).length > 0 ? (decodedOptionOrder as any) : undefined
          });
        }
    });
  } catch (err) {
    console.warn('[Firebase] getSubmissionsFromFirestore error:', err);
  }

  return results;
}

// 5. Delete a single student submission from Firestore (when admin explicitly deletes it)
export async function deleteSingleSubmissionFromFirestore(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  const docId = `sub_${sessionId}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
  try {
    await deleteDoc(doc(firestore, 'submissions', docId));
    return true;
  } catch (err) {
    console.warn('[Firebase] deleteSingleSubmissionFromFirestore error:', err);
    return false;
  }
}

// 6. Delete all submissions for an exam from Firestore when teacher deletes an exam (Permanent cascading deletion)
export async function deleteSubmissionsForExamFromFirestore(
  examId: string,
  examCode?: string,
  additionalAliases?: string[]
): Promise<number> {
  if (!examId && !examCode) return 0;
  const aliasSet = new Set<string>();
  const normSet = new Set<string>();

  const registerKey = (val?: string) => {
    if (!val || typeof val !== 'string') return;
    const clean = val.trim();
    if (!clean) return;
    const upper = clean.toUpperCase();
    aliasSet.add(upper);
    aliasSet.add(clean);
    const norm = upper.replace(/[^A-Z0-9]/g, '');
    if (norm) normSet.add(norm);
  };

  registerKey(examId);
  registerKey(examCode);
  if (Array.isArray(additionalAliases)) {
    additionalAliases.forEach(registerKey);
  }

  let deletedCount = 0;
  try {
    const colRef = collection(firestore, 'submissions');
    const snap = await getDocs(colRef);
    const deletePromises: Promise<void>[] = [];

    snap.forEach((d) => {
      const data = d.data();
      if (!data) return;
      const sExamId = String(data.examId || '').trim();
      const sExamCode = String(data.examCode || '').trim();
      const sUpperId = sExamId.toUpperCase();
      const sUpperCode = sExamCode.toUpperCase();
      const sNormId = sUpperId.replace(/[^A-Z0-9]/g, '');
      const sNormCode = sUpperCode.replace(/[^A-Z0-9]/g, '');

      const isMatch =
        (sUpperId !== '' && aliasSet.has(sUpperId)) ||
        (sUpperCode !== '' && aliasSet.has(sUpperCode)) ||
        (sNormId !== '' && normSet.has(sNormId)) ||
        (sNormCode !== '' && normSet.has(sNormCode));

      if (isMatch) {
        deletePromises.push(deleteDoc(d.ref));
        deletedCount++;
      }
    });

    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('[Firebase] deleteSubmissionsForExamFromFirestore error:', err);
  }

  return deletedCount;
}

// 4. Record Deleted Exam in Firestore to permanently prevent resurrection across Vercel cold starts
export async function recordDeletedExamInFirestore(examId: string, examCode?: string): Promise<void> {
  if (!examId) return;
  cachedDeletedExams = null;
  cachedExams = null;
  try {
    sessionStorage.removeItem('ncv_fb_del_exams');
    sessionStorage.removeItem('ncv_fb_exams');
  } catch (e) {}
  const cleanId = examId.trim();
  const upperId = cleanId.toUpperCase();
  const upperCode = examCode ? examCode.trim().toUpperCase() : '';

  try {
    const promises: Promise<any>[] = [
      setDoc(doc(firestore, 'deleted_exams', upperId), {
        id: upperId,
        deletedAt: new Date().toISOString()
      }, { merge: true }),
      deleteDoc(doc(firestore, 'exams', cleanId)),
      deleteDoc(doc(firestore, 'exams', upperId))
    ];

    if (upperCode) {
      promises.push(
        setDoc(doc(firestore, 'deleted_exams', upperCode), {
          id: upperCode,
          deletedAt: new Date().toISOString()
        }, { merge: true }),
        deleteDoc(doc(firestore, 'exams', upperCode))
      );
    }

    // Also scan exams collection to delete any docs with matching id or code
    try {
      const colRef = collection(firestore, 'exams');
      const snap = await getDocs(colRef);
      snap.forEach((d) => {
        const data = d.data();
        const dId = String(data?.id || d.id || '').trim().toUpperCase();
        const dCode = String(data?.code || '').trim().toUpperCase();
        if (dId === upperId || (upperCode && (dCode === upperCode || dId === upperCode))) {
          promises.push(deleteDoc(d.ref));
        }
      });
    } catch (e) {}

    await Promise.all(promises);
  } catch (err) {
    console.warn('[Firebase] recordDeletedExamInFirestore error:', err);
  }
}

// 5. Get all deleted exam IDs/codes from Firestore (with 5-minute memory + sessionStorage cache)
let cachedDeletedExams: { ids: string[]; timestamp: number } | null = null;

export async function getDeletedExamsFromFirestore(forceRefresh = false): Promise<string[]> {
  const now = Date.now();
  if (!forceRefresh) {
    if (cachedDeletedExams && now - cachedDeletedExams.timestamp < 300000) {
      return cachedDeletedExams.ids;
    }
    try {
      const ss = sessionStorage.getItem('ncv_fb_del_exams');
      if (ss) {
        const parsed = JSON.parse(ss);
        if (parsed && Array.isArray(parsed.ids) && now - parsed.timestamp < 300000) {
          cachedDeletedExams = parsed;
          return parsed.ids;
        }
      }
    } catch (e) {}
  }

  const ids: string[] = [];
  try {
    const colRef = collection(firestore, 'deleted_exams');
    const snap = await getDocs(colRef);
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.id) {
        ids.push(String(data.id).trim().toUpperCase());
      } else if (d.id) {
        ids.push(d.id.trim().toUpperCase());
      }
    });
    cachedDeletedExams = { ids, timestamp: now };
    try {
      sessionStorage.setItem('ncv_fb_del_exams', JSON.stringify(cachedDeletedExams));
    } catch (e) {}
  } catch (err) {
    console.warn('[Firebase] getDeletedExamsFromFirestore error:', err);
    if (cachedDeletedExams) return cachedDeletedExams.ids;
  }
  return ids;
}

// 6. Unmark a deleted exam when teacher explicitly restores or recreates it
export async function unmarkDeletedExamInFirestore(examId: string, examCode?: string): Promise<void> {
  if (!examId) return;
  cachedDeletedExams = null;
  try {
    sessionStorage.removeItem('ncv_fb_del_exams');
  } catch (e) {}
  const upperId = examId.trim().toUpperCase();
  const upperCode = examCode ? examCode.trim().toUpperCase() : '';
  try {
    const promises: Promise<any>[] = [
      deleteDoc(doc(firestore, 'deleted_exams', upperId))
    ];
    if (upperCode) {
      promises.push(deleteDoc(doc(firestore, 'deleted_exams', upperCode)));
    }
    await Promise.all(promises);
  } catch (err) {
    console.warn('[Firebase] unmarkDeletedExamInFirestore error:', err);
  }
}

let cachedExams: { list: any[]; timestamp: number } | null = null;

// 7. Save custom exam to Firestore for permanent cross-device persistence
export async function saveExamToFirestore(exam: any): Promise<void> {
  if (!exam || !exam.id) return;
  cachedExams = null; // Invalidate cache on write
  try {
    sessionStorage.removeItem('ncv_fb_exams');
  } catch (e) {}
  try {
    const upperId = String(exam.id).trim().toUpperCase();
    const upperCode = exam.code ? String(exam.code).trim().toUpperCase() : '';
    await unmarkDeletedExamInFirestore(upperId, upperCode);
    const sealedExam = sealExamQuestions(exam);
    await setDoc(doc(firestore, 'exams', String(exam.id).trim()), {
      ...sealedExam,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('[Firebase] saveExamToFirestore error:', err);
  }
}

// 8. Get custom exams saved in Firestore (with 5-minute memory + sessionStorage cache)
export async function getExamsFromFirestore(forceRefresh = false): Promise<any[]> {
  const now = Date.now();
  if (!forceRefresh) {
    if (cachedExams && now - cachedExams.timestamp < 300000) {
      return cachedExams.list;
    }
    try {
      const ss = sessionStorage.getItem('ncv_fb_exams');
      if (ss) {
        const parsed = JSON.parse(ss);
        if (parsed && Array.isArray(parsed.list) && now - parsed.timestamp < 300000) {
          cachedExams = parsed;
          return parsed.list;
        }
      }
    } catch (e) {}
  }

  const exams: any[] = [];
  try {
    // Also load deleted exams from Firestore first so we never return deleted exams
    const deletedArr = await getDeletedExamsFromFirestore(forceRefresh);
    const deletedSet = new Set<string>(deletedArr);

    const colRef = collection(firestore, 'exams');
    const snap = await getDocs(colRef);
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.id && data.title) {
        const uId = String(data.id).trim().toUpperCase();
        const uCode = String(data.code || '').trim().toUpperCase();
        if (!deletedSet.has(uId) && (!uCode || !deletedSet.has(uCode))) {
          exams.push(data);
        }
      }
    });
    cachedExams = { list: exams, timestamp: now };
    try {
      sessionStorage.setItem('ncv_fb_exams', JSON.stringify(cachedExams));
    } catch (e) {}
  } catch (err) {
    console.warn('[Firebase] getExamsFromFirestore error:', err);
    if (cachedExams) return cachedExams.list;
  }
  return exams;
}

// Helper to sort students in their exact class roster order (1, 2, ..., 10 instead of 1, 10, 2)
export function sortStudentsByRosterOrder<T extends { id?: string; sbd?: string; stt?: number }>(students: T[]): T[] {
  return [...students].sort((a, b) => {
    if (typeof a.stt === 'number' && typeof b.stt === 'number' && a.stt !== b.stt) {
      return a.stt - b.stt;
    }
    const sbdMatchA = String(a.sbd || '').match(/(\d+)\s*$/);
    const sbdMatchB = String(b.sbd || '').match(/(\d+)\s*$/);
    if (sbdMatchA && sbdMatchB) {
      const numA = parseInt(sbdMatchA[1], 10);
      const numB = parseInt(sbdMatchB[1], 10);
      if (numA !== numB) return numA - numB;
    }
    const idMatchA = String(a.id || '').match(/-(\d+)$/);
    const idMatchB = String(b.id || '').match(/-(\d+)$/);
    if (idMatchA && idMatchB) {
      const idNumA = parseInt(idMatchA[1], 10);
      const idNumB = parseInt(idMatchB[1], 10);
      if (idNumA !== idNumB) return idNumA - idNumB;
    }
    return 0;
  });
}

// 9. Save a single student or batch of students to Firestore
export async function saveStudentsToFirestore(students: any[]): Promise<boolean> {
  if (!Array.isArray(students) || students.length === 0) return true;
  try {
    // Track per-class index if stt not explicitly set
    const classCounter: Record<string, number> = {};
    const promises = students.map((s) => {
      if (!s || !s.id) return Promise.resolve();
      const clsKey = String(s.class || '').trim().toUpperCase();
      classCounter[clsKey] = (classCounter[clsKey] || 0) + 1;
      const sttVal = typeof s.stt === 'number' && s.stt > 0 ? s.stt : classCounter[clsKey];

      const rawPass = s.password ? String(s.password).trim() : '';
      const safeHashedPass = rawPass
        ? isHashedPassword(rawPass)
          ? rawPass
          : hashPasswordSync(rawPass)
        : '';

      const docId = `st_${s.id}`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      const payload: Record<string, any> = {
        id: String(s.id),
        name: String(s.name || '').trim(),
        class: String(s.class || '').trim(),
        sbd: s.sbd ? String(s.sbd).trim() : '',
        stt: sttVal,
        username: s.username ? String(s.username).trim() : '',
        password: safeHashedPass,
        isPasswordChanged: Boolean(s.isPasswordChanged),
        updatedAt: new Date().toISOString()
      };
      return setDoc(doc(firestore, 'students', docId), payload, { merge: true });
    });
    await Promise.all(promises);
    cachedStudents = null; // Invalidate cache on student write
    try {
      sessionStorage.removeItem('ncv_fb_students');
    } catch (e) {}
    return true;
  } catch (err) {
    console.warn('[Firebase] saveStudentsToFirestore error:', err);
    return false;
  }
}

// In-memory + sessionStorage cache for students with 5-minute TTL
let cachedStudents: { list: any[]; timestamp: number } | null = null;

// 10. Get students from Firestore (cached 5m to minimize Firestore reads)
export async function getStudentsFromFirestore(className?: string, forceRefresh = false): Promise<any[]> {
  const now = Date.now();
  const targetClass = className ? className.trim().toUpperCase() : '';

  if (!forceRefresh) {
    if (cachedStudents && now - cachedStudents.timestamp < 300000) {
      if (!targetClass) return cachedStudents.list;
      return sortStudentsByRosterOrder(
        cachedStudents.list.filter((s) => String(s.class || '').trim().toUpperCase() === targetClass)
      );
    }
    try {
      const ss = sessionStorage.getItem('ncv_fb_students');
      if (ss) {
        const parsed = JSON.parse(ss);
        if (parsed && Array.isArray(parsed.list) && now - parsed.timestamp < 300000) {
          cachedStudents = parsed;
          if (!targetClass) return parsed.list;
          return sortStudentsByRosterOrder(
            parsed.list.filter((s: any) => String(s.class || '').trim().toUpperCase() === targetClass)
          );
        }
      }
    } catch (e) {}
  }

  let list: any[] = [];
  try {
    const colRef = collection(firestore, 'students');
    const snap = await getDocs(colRef);
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.id && data.name) {
        list.push({
          id: String(data.id),
          name: String(data.name),
          class: String(data.class),
          sbd: data.sbd ? String(data.sbd) : undefined,
          stt: typeof data.stt === 'number' ? data.stt : undefined,
          username: data.username ? String(data.username) : undefined,
          password: data.password ? String(data.password) : undefined,
          isPasswordChanged: Boolean(data.isPasswordChanged)
        });
      }
    });
    list = sortStudentsByRosterOrder(list);
    cachedStudents = { list, timestamp: now };
    try {
      sessionStorage.setItem('ncv_fb_students', JSON.stringify(cachedStudents));
    } catch (e) {}
  } catch (err) {
    console.warn('[Firebase] getStudentsFromFirestore error:', err);
    if (cachedStudents) {
      if (!targetClass) return cachedStudents.list;
      return sortStudentsByRosterOrder(
        cachedStudents.list.filter((s) => String(s.class || '').trim().toUpperCase() === targetClass)
      );
    }
  }

  if (!targetClass) return list;
  return sortStudentsByRosterOrder(list.filter((s) => String(s.class || '').trim().toUpperCase() === targetClass));
}

// 11. Delete single student from Firestore
export async function deleteStudentFromFirestore(studentId: string): Promise<void> {
  if (!studentId) return;
  cachedStudents = null; // Invalidate cache
  try {
    sessionStorage.removeItem('ncv_fb_students');
  } catch (e) {}
  const docId = `st_${studentId}`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  try {
    await deleteDoc(doc(firestore, 'students', docId));
  } catch (err) {
    console.warn('[Firebase] deleteStudentFromFirestore error:', err);
  }
}

// 12. Delete all students of a class from Firestore
export async function deleteClassStudentsFromFirestore(className: string): Promise<void> {
  if (!className) return;
  cachedStudents = null; // Invalidate cache
  try {
    sessionStorage.removeItem('ncv_fb_students');
  } catch (e) {}
  const targetClass = className.trim().toUpperCase();
  try {
    const colRef = collection(firestore, 'students');
    const snap = await getDocs(colRef);
    const deletePromises: Promise<void>[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data && String(data.class || '').trim().toUpperCase() === targetClass) {
        deletePromises.push(deleteDoc(d.ref));
      }
    });
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('[Firebase] deleteClassStudentsFromFirestore error:', err);
  }
}

// In-memory + sessionStorage cache for classes and deleted classes (5-minute TTL)
let cachedClasses: { list: any[]; timestamp: number } | null = null;
let cachedDeletedClasses: { ids: string[]; timestamp: number } | null = null;

function invalidateClassesCache() {
  cachedClasses = null;
  cachedDeletedClasses = null;
  try {
    sessionStorage.removeItem('ncv_fb_classes');
    sessionStorage.removeItem('ncv_fb_del_classes');
  } catch (e) {}
}

// 13. Save classes metadata to Firestore
export async function saveClassesToFirestore(classes: any[]): Promise<void> {
  if (!Array.isArray(classes)) return;
  invalidateClassesCache();
  try {
    const promises = classes.map((c) => {
      if (!c || !c.name) return Promise.resolve();
      const docId = `cls_${c.name.trim().toUpperCase()}`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      return setDoc(doc(firestore, 'classes', docId), {
        name: String(c.name).trim(),
        grade: Number(c.grade) || 6,
        studentCount: Number(c.studentCount) || 0,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });
    await Promise.all(promises);
  } catch (err) {
    console.warn('[Firebase] saveClassesToFirestore error:', err);
  }
}

// 14. Get classes from Firestore (cached 5m to minimize read ops)
export async function getClassesFromFirestore(forceRefresh = false): Promise<any[]> {
  const now = Date.now();
  if (!forceRefresh) {
    if (cachedClasses && now - cachedClasses.timestamp < 300000) {
      return cachedClasses.list;
    }
    try {
      const ss = sessionStorage.getItem('ncv_fb_classes');
      if (ss) {
        const parsed = JSON.parse(ss);
        if (parsed && Array.isArray(parsed.list) && now - parsed.timestamp < 300000) {
          cachedClasses = parsed;
          return parsed.list;
        }
      }
    } catch (e) {}
  }

  const classes: any[] = [];
  try {
    const deletedArr = await getDeletedClassesFromFirestore(forceRefresh);
    const deletedSet = new Set<string>(deletedArr);

    const colRef = collection(firestore, 'classes');
    const snap = await getDocs(colRef);
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.name) {
        const upper = String(data.name).trim().toUpperCase();
        if (!deletedSet.has(upper)) {
          classes.push({
            name: String(data.name).trim(),
            grade: Number(data.grade) || 6,
            studentCount: Number(data.studentCount) || 0
          });
        }
      }
    });
    cachedClasses = { list: classes, timestamp: now };
    try {
      sessionStorage.setItem('ncv_fb_classes', JSON.stringify(cachedClasses));
    } catch (e) {}
  } catch (err) {
    console.warn('[Firebase] getClassesFromFirestore error:', err);
    if (cachedClasses) return cachedClasses.list;
  }
  return classes;
}

// 15. Delete class from Firestore (permanently remove class doc and all student docs in that class)
export async function deleteClassFromFirestore(className: string): Promise<void> {
  if (!className) return;
  invalidateClassesCache();
  cachedStudents = null;
  try {
    sessionStorage.removeItem('ncv_fb_students');
  } catch (e) {}
  const upper = className.trim().toUpperCase();
  const docId = `cls_${upper}`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  try {
    await Promise.all([
      deleteDoc(doc(firestore, 'classes', docId)),
      deleteClassStudentsFromFirestore(upper),
      recordDeletedClassInFirestore(upper)
    ]);
  } catch (err) {
    console.warn('[Firebase] deleteClassFromFirestore error:', err);
  }
}

// 16. Record Deleted Class in Firestore to prevent resurrection across Vercel cold starts
export async function recordDeletedClassInFirestore(className: string): Promise<void> {
  if (!className) return;
  invalidateClassesCache();
  const upper = className.trim().toUpperCase();
  try {
    await setDoc(doc(firestore, 'deleted_classes', upper), {
      name: upper,
      deletedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('[Firebase] recordDeletedClassInFirestore error:', err);
  }
}

// 17. Get Deleted Classes from Firestore (cached 5m)
export async function getDeletedClassesFromFirestore(forceRefresh = false): Promise<string[]> {
  const now = Date.now();
  if (!forceRefresh) {
    if (cachedDeletedClasses && now - cachedDeletedClasses.timestamp < 300000) {
      return cachedDeletedClasses.ids;
    }
    try {
      const ss = sessionStorage.getItem('ncv_fb_del_classes');
      if (ss) {
        const parsed = JSON.parse(ss);
        if (parsed && Array.isArray(parsed.ids) && now - parsed.timestamp < 300000) {
          cachedDeletedClasses = parsed;
          return parsed.ids;
        }
      }
    } catch (e) {}
  }

  const result: string[] = [];
  try {
    const snap = await getDocs(collection(firestore, 'deleted_classes'));
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.name) {
        result.push(String(data.name).trim().toUpperCase());
      } else if (d.id) {
        result.push(d.id.trim().toUpperCase());
      }
    });
    cachedDeletedClasses = { ids: result, timestamp: now };
    try {
      sessionStorage.setItem('ncv_fb_del_classes', JSON.stringify(cachedDeletedClasses));
    } catch (e) {}
  } catch (err) {
    console.warn('[Firebase] getDeletedClassesFromFirestore error:', err);
    if (cachedDeletedClasses) return cachedDeletedClasses.ids;
  }
  return result;
}

// 18. Unmark Deleted Class from Firestore (when teacher creates or restores a class)
export async function unmarkDeletedClassInFirestore(className: string): Promise<void> {
  if (!className) return;
  invalidateClassesCache();
  const upper = className.trim().toUpperCase();
  try {
    await deleteDoc(doc(firestore, 'deleted_classes', upper));
  } catch (err) {
    console.warn('[Firebase] unmarkDeletedClassInFirestore error:', err);
  }
}

// 19. Save Teacher (Admin) changed password hash to Firestore so it persists permanently across app updates and redeployments
export async function saveTeacherPasswordToFirestore(passwordHash: string): Promise<boolean> {
  if (!passwordHash) return false;
  try {
    await setDoc(
      doc(firestore, 'classes', '__teacher_admin_auth__'),
      {
        role: 'teacher_admin',
        passwordHash: String(passwordHash).trim(),
        isPasswordChanged: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('[Firebase] saveTeacherPasswordToFirestore error:', err);
    return false;
  }
}

// 20. Get Teacher (Admin) changed password hash from Firestore
export async function getTeacherPasswordFromFirestore(): Promise<string | null> {
  try {
    const snap = await getDoc(doc(firestore, 'classes', '__teacher_admin_auth__'));
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.isPasswordChanged && data.passwordHash) {
        const hash = String(data.passwordHash).trim();
        try {
          localStorage.setItem('ncv_admin_password', hash);
        } catch (e) {}
        return hash;
      }
    }
  } catch (err) {
    console.warn('[Firebase] getTeacherPasswordFromFirestore error:', err);
  }
  return null;
}

