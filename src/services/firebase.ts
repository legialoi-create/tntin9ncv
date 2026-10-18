import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// CRITICAL: Must pass firestoreDatabaseId
export const firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test connection on boot
if (typeof window !== 'undefined') {
  (async function testConnection() {
    try {
      await getDocFromServer(doc(firestore, 'test', 'connection'));
    } catch (error: any) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('[Firebase] Offline or checking configuration');
      }
    }
  })();
}

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

  if (examId && examId.trim() !== '' && examId.toUpperCase() !== 'ALL') {
    aliasSet.add(examId.trim().toUpperCase());
  }
  if (examCode && examCode.trim() !== '') {
    aliasSet.add(examCode.trim().toUpperCase());
  }
  if (Array.isArray(additionalAliases)) {
    for (const a of additionalAliases) {
      if (a && typeof a === 'string' && a.trim() !== '') {
        aliasSet.add(a.trim().toUpperCase());
      }
    }
  }

  try {
    const colRef = collection(firestore, 'submissions');
    const snap = await getDocs(colRef);

    snap.forEach((d) => {
      const data = d.data() as any;
      if (!data) return;
      const sExamId = String(data.examId || '').trim().toUpperCase();
      const sExamCode = String(data.examCode || '').trim().toUpperCase();

      let isMatch = false;
      if (aliasSet.size === 0) {
        // No filter specified: return all submissions
        isMatch = true;
      } else {
        isMatch = (sExamId !== '' && aliasSet.has(sExamId)) ||
                  (sExamCode !== '' && aliasSet.has(sExamCode));
      }

      if (isMatch) {
        const rawScore = data.score !== undefined ? Number(data.score) : undefined;
        const rawBest = data.bestScore !== undefined ? Number(data.bestScore) : undefined;
        const computedScore = rawScore !== undefined && !isNaN(rawScore) ? rawScore : (rawBest !== undefined && !isNaN(rawBest) ? rawBest : 0);
        const computedBest = rawBest !== undefined && !isNaN(rawBest) ? rawBest : computedScore;

        results.push({
          sessionId: String(data.sessionId || d.id.replace(/^sub_/, '')),
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
          answers: data.answers || {}
        });
      }
    });
  } catch (err) {
    console.warn('[Firebase] getSubmissionsFromFirestore error:', err);
  }

  return results;
}

// 5. Delete all submissions for an exam from Firestore when teacher deletes an exam
export async function deleteSubmissionsForExamFromFirestore(
  examId: string,
  examCode?: string,
  additionalAliases?: string[]
): Promise<void> {
  if (!examId) return;
  const aliasSet = new Set<string>();
  aliasSet.add(examId.trim().toUpperCase());
  if (examCode) aliasSet.add(examCode.trim().toUpperCase());
  if (Array.isArray(additionalAliases)) {
    for (const a of additionalAliases) {
      if (a) aliasSet.add(String(a).trim().toUpperCase());
    }
  }

  try {
    const colRef = collection(firestore, 'submissions');
    const snap = await getDocs(colRef);
    const deletePromises: Promise<void>[] = [];

    snap.forEach((d) => {
      const data = d.data();
      const sExamId = String(data.examId || '').trim().toUpperCase();
      const sExamCode = String(data.examCode || '').trim().toUpperCase();
      if ((sExamId && aliasSet.has(sExamId)) || (sExamCode && aliasSet.has(sExamCode))) {
        deletePromises.push(deleteDoc(d.ref));
      }
    });

    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('[Firebase] deleteSubmissionsForExamFromFirestore error:', err);
  }
}

// 4. Record Deleted Exam in Firestore to permanently prevent resurrection across Vercel cold starts
export async function recordDeletedExamInFirestore(examId: string, examCode?: string): Promise<void> {
  if (!examId) return;
  const upperId = examId.trim().toUpperCase();
  const upperCode = examCode ? examCode.trim().toUpperCase() : '';

  try {
    const promises: Promise<any>[] = [
      setDoc(doc(firestore, 'deleted_exams', upperId), {
        id: upperId,
        deletedAt: new Date().toISOString()
      }, { merge: true }),
      deleteDoc(doc(firestore, 'exams', examId.trim()))
    ];

    if (upperCode) {
      promises.push(
        setDoc(doc(firestore, 'deleted_exams', upperCode), {
          id: upperCode,
          deletedAt: new Date().toISOString()
        }, { merge: true })
      );
    }

    await Promise.all(promises);
  } catch (err) {
    console.warn('[Firebase] recordDeletedExamInFirestore error:', err);
  }
}

// 5. Get all deleted exam IDs/codes from Firestore
export async function getDeletedExamsFromFirestore(): Promise<string[]> {
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
  } catch (err) {
    console.warn('[Firebase] getDeletedExamsFromFirestore error:', err);
  }
  return ids;
}

// 6. Unmark a deleted exam when teacher explicitly restores or recreates it
export async function unmarkDeletedExamInFirestore(examId: string, examCode?: string): Promise<void> {
  if (!examId) return;
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

// 7. Save custom exam to Firestore for permanent cross-device persistence
export async function saveExamToFirestore(exam: any): Promise<void> {
  if (!exam || !exam.id) return;
  try {
    const upperId = String(exam.id).trim().toUpperCase();
    const upperCode = exam.code ? String(exam.code).trim().toUpperCase() : '';
    await unmarkDeletedExamInFirestore(upperId, upperCode);
    await setDoc(doc(firestore, 'exams', String(exam.id).trim()), {
      ...exam,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('[Firebase] saveExamToFirestore error:', err);
  }
}

// 8. Get custom exams saved in Firestore
export async function getExamsFromFirestore(): Promise<any[]> {
  const exams: any[] = [];
  try {
    const colRef = collection(firestore, 'exams');
    const snap = await getDocs(colRef);
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.id && data.title) {
        exams.push(data);
      }
    });
  } catch (err) {
    console.warn('[Firebase] getExamsFromFirestore error:', err);
  }
  return exams;
}
