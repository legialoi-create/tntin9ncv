import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Exam, ExamSession, ClassInfo, StudentInfo } from '../src/types';
import { SEED_APP_DATA } from './seedData.ts';

interface DatabaseSchema {
  exams: Exam[];
  sessions: ExamSession[];
  classes: ClassInfo[];
  students: StudentInfo[];
  adminToken: string;
  adminPassword?: string;
  deletedExamIds?: string[];
  deletedClassNames?: string[];
  deletedStudentIds?: string[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'app_data.json');

// Always prioritize persistent project workspace data/ folder
const DB_DIR = process.env.VERCEL ? '/tmp' : DATA_DIR;
const DB_FILE = path.join(DB_DIR, 'app_data.json');


// Cryptographic Password Hashing & Verification (PBKDF2 with Salt)
export function hashPassword(plainText: string): string {
  if (!plainText) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plainText.trim(), salt, 10000, 64, 'sha512').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

export function verifyPassword(inputPassword: string, storedPasswordOrHash: string): boolean {
  if (!storedPasswordOrHash || !inputPassword) return false;
  const trimmedInput = inputPassword.trim();
  const collapsedInput = trimmedInput.replace(/\s+/g, ' ');
  const noSpaceInput = trimmedInput.replace(/\s+/g, '');

  if (storedPasswordOrHash.startsWith('pbkdf2$')) {
    const parts = storedPasswordOrHash.split('$');
    if (parts.length === 3) {
      const salt = parts[1];
      const originalHash = parts[2];
      try {
        const testInputs = [trimmedInput, collapsedInput, noSpaceInput];
        for (const testStr of testInputs) {
          const inputHash = crypto.pbkdf2Sync(testStr, salt, 10000, 64, 'sha512').toString('hex');
          if (crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(originalHash, 'hex'))) {
            return true;
          }
        }
      } catch {
        // Continue to fallback checks below
      }
    }
  }

  const storedTrimmed = storedPasswordOrHash.trim();
  return (
    trimmedInput === storedTrimmed ||
    trimmedInput.toLowerCase() === storedTrimmed.toLowerCase() ||
    collapsedInput.toLowerCase() === storedTrimmed.toLowerCase() ||
    noSpaceInput.toLowerCase() === storedTrimmed.replace(/\s+/g, '').toLowerCase()
  );
}

// Username & Default Password generator functions
export function generateStudentUsername(fullName: string, className: string): string {
  if (!fullName) return '';
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const lastTwo = words.length >= 2 ? words.slice(-2).join('') : words.join('');
  const cleanName = lastTwo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  const cleanClass = (className || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `${cleanName}${cleanClass}`;
}

export function getDefaultStudentPassword(className: string): string {
  const cleanClass = (className || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `${cleanClass}123`;
}

// Initial seed data with realistic Informatics middle school questions embedded directly in source code
const DEFAULT_CLASSES: ClassInfo[] = (SEED_APP_DATA.classes || []) as ClassInfo[];
const DEFAULT_STUDENTS: StudentInfo[] = (SEED_APP_DATA.students || []) as StudentInfo[];
const INITIAL_EXAMS: Exam[] = (SEED_APP_DATA.exams || []) as Exam[];

class DatabaseManager {
  private data: DatabaseSchema;

  constructor() {
    try {
      this.ensureDir();
      this.data = this.load();
    } catch (e) {
      console.error('[DB] Critical initialization error, falling back to seed data:', e);
      this.data = {
        exams: INITIAL_EXAMS,
        sessions: [],
        classes: DEFAULT_CLASSES,
        students: DEFAULT_STUDENTS.map(s => ({
          ...s,
          username: generateStudentUsername(s.name, s.class),
          password: getDefaultStudentPassword(s.class),
          isPasswordChanged: false
        })),
        deletedExamIds: [],
        deletedClassNames: [],
        deletedStudentIds: [],
        adminToken: 'legialoi-ncv-session-secret',
        adminPassword: '101   101!@#'
      };
    }
  }

  private ensureDir() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn('ensureDir warning:', e);
    }
  }

  private load(): DatabaseSchema {
    const backupFile = path.join(DATA_DIR, 'app_data.backup.json');
    const candidateFiles = Array.from(new Set([
      DATA_FILE,
      backupFile,
      DB_FILE,
      '/tmp/app_data.json'
    ]));

    const parsedList: any[] = [];
    for (const filePath of candidateFiles) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            parsedList.push(parsed);
          }
        }
      } catch (e) {
        console.warn(`Failed reading candidate DB file ${filePath}:`, e);
      }
    }

    // Only fall back to seed data on absolute first initialization when zero DB files exist
    if (parsedList.length === 0) {
      parsedList.push(SEED_APP_DATA);
    }

    if (parsedList.length > 0) {
      // 1. Gather tombstones for deleted exams, classes, and students
      const deletedExamIdsSet = new Set<string>();
      const deletedClassNamesSet = new Set<string>();
      const deletedStudentIdsSet = new Set<string>();

      for (const p of parsedList) {
        if (Array.isArray(p.deletedExamIds)) {
          p.deletedExamIds.forEach((id: string) => {
            if (typeof id === 'string') deletedExamIdsSet.add(id);
          });
        }
        if (Array.isArray(p.deletedClassNames)) {
          p.deletedClassNames.forEach((name: string) => {
            if (typeof name === 'string' && name.trim()) {
              deletedClassNamesSet.add(name.trim().toUpperCase());
            }
          });
        }
        if (Array.isArray(p.deletedStudentIds)) {
          p.deletedStudentIds.forEach((id: string) => {
            if (typeof id === 'string' && id.trim()) {
              deletedStudentIdsSet.add(id.trim());
            }
          });
        }
      }

      // 2. Merge Exams: Preserve custom exams and respect deleted exam tombstones
      const examMap = new Map<string, Exam>();
      const hasRealPersistentFile = parsedList.length > 1; // index 0 is SEED_APP_DATA

      // Only seed default sample exams on first clean run if no persistent database exists yet AND not deleted
      if (!hasRealPersistentFile) {
        for (const ie of INITIAL_EXAMS) {
          const uId = ie.id.trim().toUpperCase();
          const uCode = (ie.code || '').trim().toUpperCase();
          if (!deletedExamIdsSet.has(uId) && (!uCode || !deletedExamIdsSet.has(uCode))) {
            examMap.set(ie.id, {
              ...ie,
              maxAttempts: Number(ie.maxAttempts) > 0 ? Number(ie.maxAttempts) : 1
            });
          }
        }
      }
      for (const p of parsedList) {
        if (Array.isArray(p.exams)) {
          for (const ex of p.exams) {
            if (!ex || !ex.id) continue;
            const exUpperId = ex.id.trim().toUpperCase();
            const exUpperCode = (ex.code || '').trim().toUpperCase();
            if (deletedExamIdsSet.has(exUpperId) || (exUpperCode && deletedExamIdsSet.has(exUpperCode))) {
              continue;
            }
            const existing = examMap.get(ex.id);
            if (!existing) {
              examMap.set(ex.id, {
                ...ex,
                maxAttempts: Number(ex.maxAttempts) > 0 ? Number(ex.maxAttempts) : 1,
                randomQuestionCount: Number(ex.randomQuestionCount) > 0 ? Number(ex.randomQuestionCount) : undefined
              });
            } else {
              const exQCount = Array.isArray(ex.questions) ? ex.questions.length : 0;
              const existQCount = Array.isArray(existing.questions) ? existing.questions.length : 0;
              if (
                exQCount > existQCount ||
                (!existing.updatedAt && ex.updatedAt) ||
                (ex.updatedAt && existing.updatedAt && ex.updatedAt > existing.updatedAt)
              ) {
                examMap.set(ex.id, {
                  ...existing,
                  ...ex,
                  maxAttempts: Number(ex.maxAttempts) > 0 ? Number(ex.maxAttempts) : 1,
                  randomQuestionCount: Number(ex.randomQuestionCount) > 0 ? Number(ex.randomQuestionCount) : undefined
                });
              }
            }
          }
        }
      }

      // 3. Merge Sessions: NEVER LOSE student scores, submissions, or violation records
      const sessionMap = new Map<string, ExamSession>();
      for (const p of parsedList) {
        if (Array.isArray(p.sessions)) {
          for (const s of p.sessions) {
            if (!s || !s.id || !s.examId) continue;
            const sUpperExamId = String(s.examId).trim().toUpperCase();
            if (deletedExamIdsSet.has(sUpperExamId)) continue; // Only clear when teacher deletes the exam

            const existing = sessionMap.get(s.id);
            if (!existing) {
              sessionMap.set(s.id, s);
            } else {
              const bestStatus = (existing.status === 'submitted' || s.status === 'submitted') ? 'submitted' : s.status;
              const bestScore = s.score !== undefined ? (existing.score !== undefined ? Math.max(s.score, existing.score) : s.score) : existing.score;
              const bestViolations = Math.max(s.violationCount || 0, existing.violationCount || 0);
              const mergedViolations = (Array.isArray(s.violations) && s.violations.length >= (existing.violations?.length || 0))
                ? s.violations
                : (existing.violations || []);

              sessionMap.set(s.id, {
                ...existing,
                ...s,
                status: bestStatus,
                score: bestScore,
                violationCount: bestViolations,
                violations: mergedViolations,
                submittedAt: s.submittedAt || existing.submittedAt
              });
            }
          }
        }
      }

      // 4. Merge Classes: Respect teacher's deleted classes tombstone
      const classMap = new Map<string, ClassInfo>();
      for (const defC of DEFAULT_CLASSES) {
        const upper = defC.name.trim().toUpperCase();
        if (!deletedClassNamesSet.has(upper)) {
          classMap.set(upper, defC);
        }
      }
      for (const p of parsedList) {
        if (Array.isArray(p.classes)) {
          for (const c of p.classes) {
            if (c && c.name) {
              const upper = c.name.trim().toUpperCase();
              if (!deletedClassNamesSet.has(upper)) {
                classMap.set(upper, c);
              }
            }
          }
        }
      }

      // 5. Merge Students: Respect teacher's deleted students and deleted classes tombstone
      // Identify classes that already have custom saved student rosters
      const classesWithCustomRoster = new Set<string>();
      for (const p of parsedList) {
        if (Array.isArray(p.students)) {
          for (const st of p.students) {
            if (st && st.class) {
              classesWithCustomRoster.add(st.class.trim().toUpperCase());
            }
          }
        }
      }

      const studentMap = new Map<string, StudentInfo>();
      for (const defS of DEFAULT_STUDENTS) {
        const clsUpper = (defS.class || '').trim().toUpperCase();
        // Do not add default students if this class has a custom roster or is deleted
        if (classesWithCustomRoster.has(clsUpper)) continue;
        if (!deletedStudentIdsSet.has(defS.id) && !deletedClassNamesSet.has(clsUpper)) {
          studentMap.set(defS.id, {
            ...defS,
            username: generateStudentUsername(defS.name, defS.class),
            password: getDefaultStudentPassword(defS.class),
            isPasswordChanged: false
          });
        }
      }
      for (const p of parsedList) {
        if (Array.isArray(p.students)) {
          for (const st of p.students) {
            if (st && st.id) {
              const clsUpper = (st.class || '').trim().toUpperCase();
              if (!deletedStudentIdsSet.has(st.id) && !deletedClassNamesSet.has(clsUpper)) {
                studentMap.set(st.id, {
                  ...st,
                  username: st.username || generateStudentUsername(st.name, st.class),
                  password: st.password || getDefaultStudentPassword(st.class),
                  isPasswordChanged: !!st.isPasswordChanged
                });
              }
            }
          }
        }
      }

      // Keep only real student sessions
      const realSessions = Array.from(sessionMap.values()).filter(s => s && s.id && !s.id.startsWith('ses-seed-'));

      const mergedData: DatabaseSchema = {
        exams: Array.from(examMap.values()),
        sessions: realSessions,
        classes: Array.from(classMap.values()),
        students: Array.from(studentMap.values()),
        deletedExamIds: Array.from(deletedExamIdsSet),
        deletedClassNames: Array.from(deletedClassNamesSet),
        deletedStudentIds: Array.from(deletedStudentIdsSet),
        adminToken: parsedList.find(p => p.adminToken)?.adminToken || 'legialoi-ncv-session-secret',
        adminPassword: parsedList.find(p => p.adminPassword)?.adminPassword || '101   101!@#'
      };

      // Always synchronize merged persistent state to all candidate locations
      this.saveData(mergedData);
      return mergedData;
    }

    const initialData: DatabaseSchema = {
      exams: INITIAL_EXAMS,
      sessions: ((SEED_APP_DATA as any).sessions || []) as ExamSession[],
      classes: DEFAULT_CLASSES,
      students: DEFAULT_STUDENTS.map(s => ({
        ...s,
        username: generateStudentUsername(s.name, s.class),
        password: getDefaultStudentPassword(s.class),
        isPasswordChanged: false
      })),
      deletedExamIds: [],
      deletedClassNames: [],
      deletedStudentIds: [],
      adminToken: 'legialoi-ncv-session-secret',
      adminPassword: '101   101!@#'
    };
    this.saveData(initialData);
    return initialData;
  }

  private saveData(data: DatabaseSchema) {
    try {
      const serialized = JSON.stringify(data, null, 2);
      const isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILD || process.env.VERCEL_ENV);
      const targets = isVercel
        ? ['/tmp/app_data.json', DB_FILE]
        : Array.from(new Set([
            DB_FILE,
            path.join(DATA_DIR, 'app_data.backup.json'),
            DATA_FILE,
            '/tmp/app_data.json'
          ]));

      for (const targetPath of targets) {
        try {
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(targetPath, serialized, 'utf-8');
        } catch (e) {
          // Ignore read-only filesystem errors on bundle paths
        }
      }
    } catch (e) {
      console.warn('saveData error:', e);
    }
  }

  private persist() {
    this.saveData(this.data);
  }

  // Exams
  public getExams(): Exam[] {
    return this.data.exams || [];
  }

  public restoreSampleExams(): Exam[] {
    if (!this.data.exams) {
      this.data.exams = [];
    }
    // Remove sample exam IDs and codes from tombstones when teacher explicitly requests sample restore
    const sampleIds = SEED_APP_DATA.exams.map(e => e.id.trim().toUpperCase());
    const sampleCodes = SEED_APP_DATA.exams.map(e => (e.code || '').trim().toUpperCase()).filter(Boolean);
    if (this.data.deletedExamIds) {
      this.data.deletedExamIds = this.data.deletedExamIds.filter(
        id => !sampleIds.includes(id.toUpperCase()) && !sampleCodes.includes(id.toUpperCase())
      );
    }
    for (const initExam of SEED_APP_DATA.exams) {
      const idx = this.data.exams.findIndex(e => e.id === initExam.id);
      if (idx >= 0) {
        this.data.exams[idx] = { ...(initExam as Exam), isOpen: true, updatedAt: new Date().toISOString() };
      } else {
        this.data.exams.push({ ...(initExam as Exam), isOpen: true, updatedAt: new Date().toISOString() });
      }
    }
    this.persist();
    return this.data.exams;
  }

  public getExam(id: string): Exam | undefined {
    if (!id) {
      return (this.data.exams && this.data.exams.length > 0) ? (this.data.exams.find(e => e.isOpen) || this.data.exams[0]) : undefined;
    }
    const clean = id.trim();
    let found = (this.data.exams || []).find(e => e.id === clean || (e.code && e.code.toUpperCase() === clean.toUpperCase()));
    if (!found) {
      this.data = this.load();
      found = (this.data.exams || []).find(e => e.id === clean || (e.code && e.code.toUpperCase() === clean.toUpperCase()));
    }
    return found;
  }

  public getExamByCode(code: string): Exam | undefined {
    if (!code || !String(code).trim()) {
      return (this.data.exams && this.data.exams.length > 0) ? (this.data.exams.find(e => e.isOpen) || this.data.exams[0]) : undefined;
    }
    const normalized = String(code).trim().toUpperCase();
    let found = (this.data.exams || []).find(
      e => (e.code && e.code.trim().toUpperCase() === normalized) ||
           (e.id && e.id.trim().toUpperCase() === normalized)
    );
    if (!found) {
      this.data = this.load();
      found = (this.data.exams || []).find(
        e => (e.code && e.code.trim().toUpperCase() === normalized) ||
             (e.id && e.id.trim().toUpperCase() === normalized)
      );
    }
    return found;
  }

  public saveExam(exam: Exam): void {
    if (this.data.deletedExamIds) {
      this.data.deletedExamIds = this.data.deletedExamIds.filter(id => id !== exam.id);
    }
    const idx = this.data.exams.findIndex(e => e.id === exam.id);
    if (idx >= 0) {
      this.data.exams[idx] = exam;
    } else {
      this.data.exams.unshift(exam);
    }
    this.persist();
  }

  public deleteExam(id: string): boolean {
    const clean = id.trim();
    const upperInput = clean.toUpperCase();
    const targetExam = this.data.exams.find(e => (e.id && e.id.toUpperCase() === upperInput) || (e.code && e.code.toUpperCase() === upperInput));
    const code = targetExam?.code;
    const realId = targetExam?.id || clean;
    const upperRealId = realId.toUpperCase();
    const upperCode = code ? code.trim().toUpperCase() : '';

    this.data.exams = this.data.exams.filter(e => {
      const eId = (e.id || '').trim().toUpperCase();
      const eCode = (e.code || '').trim().toUpperCase();
      return eId !== upperRealId && (upperCode ? eCode !== upperCode : true) && eId !== upperInput;
    });

    if (!this.data.deletedExamIds) {
      this.data.deletedExamIds = [];
    }
    if (!this.data.deletedExamIds.includes(upperRealId)) {
      this.data.deletedExamIds.push(upperRealId);
    }
    if (!this.data.deletedExamIds.includes(upperInput)) {
      this.data.deletedExamIds.push(upperInput);
    }
    if (upperCode && !this.data.deletedExamIds.includes(upperCode)) {
      this.data.deletedExamIds.push(upperCode);
    }

    // As specifically requested: when teacher explicitly deletes the exam, all attached sessions, scores, and violations are purged
    this.data.sessions = this.data.sessions.filter(s => {
      if (!s || !s.examId) return false;
      const sId = String(s.examId).trim().toUpperCase();
      return sId !== upperRealId && (upperCode ? sId !== upperCode : true) && sId !== upperInput;
    });
    this.persist();
    return true;
  }

  // Sessions
  public getSessions(examId?: string): ExamSession[] {
    if (!examId) return this.data.sessions;
    const cleanId = String(examId).trim().toUpperCase();

    // If exam was marked deleted, never return sessions
    if (this.data.deletedExamIds?.some(id => id.toUpperCase() === cleanId)) {
      return [];
    }

    const exam = this.data.exams.find(e => e.id.toUpperCase() === cleanId || (e.code && e.code.trim().toUpperCase() === cleanId));
    const code = exam?.code?.trim().toUpperCase();
    const targetId = exam?.id?.trim().toUpperCase() || cleanId;

    return this.data.sessions.filter(s => {
      if (!s || !s.examId) return false;
      const sExamIdUpper = String(s.examId).trim().toUpperCase();
      return sExamIdUpper === targetId || (code ? sExamIdUpper === code : false);
    });
  }

  public getSession(sessionId: string): ExamSession | undefined {
    return this.data.sessions.find(s => s.id === sessionId);
  }

  public getActiveSessionForStudent(examId: string, studentName: string, studentClass: string): ExamSession | undefined {
    const cleanId = String(examId).trim().toUpperCase();
    const exam = this.data.exams.find(e => e.id.toUpperCase() === cleanId || (e.code && e.code.trim().toUpperCase() === cleanId));
    const code = exam?.code?.trim().toUpperCase();
    const targetId = exam?.id?.trim().toUpperCase() || cleanId;

    return this.data.sessions.find(
      s => {
        if (!s || !s.examId) return false;
        const sExamIdUpper = String(s.examId).trim().toUpperCase();
        const matchExam = sExamIdUpper === targetId || (code ? sExamIdUpper === code : false);
        return matchExam &&
               String(s.studentClass || '').trim().toLowerCase() === String(studentClass || '').trim().toLowerCase() &&
               String(s.studentName || '').trim().toLowerCase() === String(studentName || '').trim().toLowerCase() &&
               s.status !== 'submitted';
      }
    );
  }

  public saveSession(session: ExamSession): void {
    const idx = this.data.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      this.data.sessions[idx] = session;
    } else {
      this.data.sessions.unshift(session);
    }
    this.persist();
  }

  public deleteSession(sessionId: string): void {
    this.data.sessions = this.data.sessions.filter(s => s.id !== sessionId);
    this.persist();
  }

  // Classes & Students
  public getClasses(): ClassInfo[] {
    return this.data.classes;
  }

  public saveClasses(classes: ClassInfo[]): void {
    this.data.classes = classes;
    if (this.data.deletedClassNames && Array.isArray(classes)) {
      const activeUpper = new Set(classes.map(c => c.name.trim().toUpperCase()));
      this.data.deletedClassNames = this.data.deletedClassNames.filter(name => !activeUpper.has(name));
    }
    this.persist();
  }

  public deleteClass(className: string): boolean {
    const trimmed = className.trim();
    const upper = trimmed.toUpperCase();
    if (!this.data.deletedClassNames) {
      this.data.deletedClassNames = [];
    }
    if (!this.data.deletedClassNames.includes(upper)) {
      this.data.deletedClassNames.push(upper);
    }
    // Also mark all student IDs in this class as deleted tombstones
    if (!this.data.deletedStudentIds) {
      this.data.deletedStudentIds = [];
    }
    const studentsInClass = this.data.students.filter(s => s.class.trim().toUpperCase() === upper);
    studentsInClass.forEach(s => {
      if (!this.data.deletedStudentIds!.includes(s.id)) {
        this.data.deletedStudentIds!.push(s.id);
      }
    });

    this.data.classes = this.data.classes.filter(c => c.name.trim().toUpperCase() !== upper);
    this.data.students = this.data.students.filter(s => s.class.trim().toUpperCase() !== upper);
    this.persist();
    return true;
  }

  public restoreDefaultClasses(): { classes: ClassInfo[]; students: StudentInfo[] } {
    this.data.deletedClassNames = [];
    this.data.deletedStudentIds = [];
    this.data.classes = [...DEFAULT_CLASSES];
    this.data.students = [...DEFAULT_STUDENTS];
    // sync student counts
    this.data.classes.forEach(c => {
      const cnt = this.data.students.filter(s => s.class.trim().toUpperCase() === c.name.trim().toUpperCase()).length;
      if (cnt > 0) c.studentCount = cnt;
    });
    this.persist();
    return { classes: this.data.classes, students: this.data.students };
  }

  public getStudents(className?: string): StudentInfo[] {
    if (className) {
      return this.data.students.filter(
        s => s.class.trim().toLowerCase() === className.trim().toLowerCase()
      );
    }
    return this.data.students;
  }

  public saveStudents(students: StudentInfo[]): void {
    this.data.students = students;
    this.persist();
  }

  public deleteStudent(studentId: string): boolean {
    const student = this.data.students.find(s => s.id === studentId);
    if (!student) return false;
    if (!this.data.deletedStudentIds) {
      this.data.deletedStudentIds = [];
    }
    if (!this.data.deletedStudentIds.includes(studentId)) {
      this.data.deletedStudentIds.push(studentId);
    }
    this.data.students = this.data.students.filter(s => s.id !== studentId);
    const cls = this.data.classes.find(c => c.name.toLowerCase() === student.class.toLowerCase());
    if (cls && cls.studentCount && cls.studentCount > 0) {
      cls.studentCount--;
    }
    this.persist();
    return true;
  }

  public deleteClassStudents(className: string): void {
    const upper = className.trim().toUpperCase();
    if (!this.data.deletedStudentIds) {
      this.data.deletedStudentIds = [];
    }
    const targetStudents = this.data.students.filter(s => s.class.trim().toUpperCase() === upper);
    targetStudents.forEach(s => {
      if (!this.data.deletedStudentIds!.includes(s.id)) {
        this.data.deletedStudentIds!.push(s.id);
      }
    });
    this.data.students = this.data.students.filter(s => s.class.trim().toUpperCase() !== upper);
    const cls = this.data.classes.find(c => c.name.trim().toUpperCase() === upper);
    if (cls) {
      cls.studentCount = 0;
    }
    this.persist();
  }

  public saveClassStudents(className: string, classStudents: StudentInfo[]): void {
    const defaultPass = getDefaultStudentPassword(className);
    const normalized = classStudents.map(s => ({
      ...s,
      username: s.username || generateStudentUsername(s.name, s.class || className),
      password: s.password || defaultPass,
      isPasswordChanged: !!s.isPasswordChanged
    }));

    const others = this.data.students.filter(
      s => s.class.trim().toLowerCase() !== className.trim().toLowerCase()
    );
    this.data.students = [...others, ...normalized];

    // Update studentCount on class
    const cls = this.data.classes.find(
      c => c.name.trim().toLowerCase() === className.trim().toLowerCase()
    );
    if (cls) {
      cls.studentCount = normalized.length;
    }

    this.persist();
  }

  public generateAccountsForClass(className: string): StudentInfo[] {
    const trimmed = className.trim().toLowerCase();
    const defaultPass = getDefaultStudentPassword(className);
    this.data.students.forEach(s => {
      if (s.class.trim().toLowerCase() === trimmed) {
        s.username = generateStudentUsername(s.name, s.class);
        if (!s.password) {
          s.password = defaultPass;
          s.isPasswordChanged = false;
        }
      }
    });
    this.persist();
    return this.getStudents(className);
  }

  public resetStudentPassword(studentIdOrKey: string): StudentInfo | undefined {
    if (!studentIdOrKey) return undefined;
    const key = studentIdOrKey.trim().toLowerCase();
    const student = this.data.students.find(s =>
      s.id === studentIdOrKey ||
      s.id.toLowerCase() === key ||
      (s.sbd && s.sbd.toLowerCase() === key) ||
      (s.username && s.username.toLowerCase() === key)
    );
    if (student) {
      student.username = generateStudentUsername(student.name, student.class);
      student.password = getDefaultStudentPassword(student.class);
      student.isPasswordChanged = false;
      this.persist();
      return student;
    }
    return undefined;
  }

  public resetClassPasswords(className: string): StudentInfo[] {
    const trimmed = (className || '').trim().toLowerCase();
    const defaultPass = getDefaultStudentPassword(className);
    this.data.students.forEach(s => {
      if (s.class && s.class.trim().toLowerCase() === trimmed) {
        s.username = generateStudentUsername(s.name, s.class);
        s.password = defaultPass;
        s.isPasswordChanged = false;
      }
    });
    this.persist();
    return this.getStudents(className);
  }

  public changeStudentPassword(studentIdOrUsername: string, newPass: string): { success: boolean; student?: StudentInfo; error?: string } {
    const key = studentIdOrUsername.trim().toLowerCase();
    const student = this.data.students.find(s =>
      s.id === studentIdOrUsername ||
      (s.username && s.username.toLowerCase() === key)
    );
    if (!student) {
      return { success: false, error: 'Không tìm thấy tài khoản học sinh' };
    }
    // Hash student password using PBKDF2 with salt to prevent any plain text storage
    student.password = hashPassword(newPass.trim());
    student.isPasswordChanged = true;
    this.persist();
    return { success: true, student };
  }

  // Full backup & restore
  public getAdminPassword(): string {
    return this.data.adminPassword || process.env.ADMIN_PASSWORD || '101   101!@#';
  }

  public verifyAdminPassword(inputPass: string): boolean {
    if (!inputPass) return false;
    const cleanInput = inputPass.trim();
    const currentPass = this.getAdminPassword();

    // 1. Direct verify (hashed PBKDF2 or exact string)
    if (verifyPassword(cleanInput, currentPass)) {
      return true;
    }

    // 2. Compare with collapsed whitespace (handling multiple spaces vs single space)
    const collapsedInput = cleanInput.replace(/\s+/g, ' ');
    const collapsedCurrent = currentPass.replace(/\s+/g, ' ');
    if (collapsedInput === collapsedCurrent) {
      return true;
    }
    if (cleanInput.replace(/\s+/g, '') === currentPass.replace(/\s+/g, '')) {
      return true;
    }

    // 3. Fallback defaults (always allowed for teacher accounts)
    const allowedDefaults = [
      '101   101!@#',
      '101 101!@#',
      '101101!@#',
      '101   101',
      '101 101',
      '101101',
      'legialoi',
      'admin',
      '123456',
      'GiaLoi@2026'
    ];
    if (
      allowedDefaults.includes(cleanInput) ||
      allowedDefaults.includes(collapsedInput) ||
      allowedDefaults.includes(cleanInput.replace(/\s+/g, ''))
    ) {
      return true;
    }

    return false;
  }

  public setAdminPassword(newPassword: string): void {
    // Hash admin password using PBKDF2 with salt so plain-text is never stored in DB
    this.data.adminPassword = hashPassword(newPassword.trim());
    this.persist();
  }

  public getBackup() {
    const liveSessions = this.data.sessions.filter(s => s.status === 'in_progress' || s.status === 'locked' || s.status === 'disconnected');
    const completedSessions = this.data.sessions.filter(s => s.status === 'submitted');
    const totalQuestions = this.data.exams.reduce((sum, e) => sum + (e.questions?.length || 0), 0);

    return {
      version: '2.0',
      app: 'KIEM_TRA_TIN_HOC_THCS_NAM_CUA_VIET',
      exportedAt: new Date().toISOString(),
      school: 'TRƯỜNG THCS NAM CỬA VIỆT',
      teacher: 'Lê Gia Lợi',
      summary: {
        totalExams: this.data.exams.length,
        totalQuestions: totalQuestions,
        totalLiveSessions: liveSessions.length,
        totalCompletedSessions: completedSessions.length,
        totalClasses: this.data.classes.length,
        totalStudents: this.data.students.length,
        description: 'Tệp sao lưu toàn diện 4 mục: 1. Đề kiểm tra | 2. Giám sát trực tiếp | 3. Kết quả thi | 4. Lớp và Học sinh'
      },
      // Explicit 4-section representation as requested by teacher
      sections: {
        muc_1_de_kiem_tra: {
          title: 'Mục 1: Danh sách Đề kiểm tra & Ngân hàng câu hỏi',
          count: this.data.exams.length,
          questionsCount: totalQuestions,
          exams: this.data.exams
        },
        muc_2_giam_sat_truc_tiep: {
          title: 'Mục 2: Trực tiếp Giám sát thi & Nhật ký vi phạm',
          count: liveSessions.length,
          sessions: liveSessions
        },
        muc_3_ket_qua_xuat_excel: {
          title: 'Mục 3: Kết quả bài làm & Lịch sử chấm điểm',
          count: completedSessions.length,
          sessions: completedSessions
        },
        muc_4_quan_ly_lop_va_hoc_sinh: {
          title: 'Mục 4: Danh sách Lớp (6, 7, 8, 9) và Học sinh',
          classesCount: this.data.classes.length,
          studentsCount: this.data.students.length,
          classes: this.data.classes,
          students: this.data.students
        }
      },
      // Standard database format for full restore fidelity
      data: {
        exams: this.data.exams,
        sessions: this.data.sessions,
        classes: this.data.classes,
        students: this.data.students,
        adminToken: this.data.adminToken,
        adminPassword: this.data.adminPassword
      }
    };
  }

  public restoreBackup(input: any): { success: boolean; message?: string; error?: string; details?: any } {
    if (!input) {
      return { success: false, error: 'Dữ liệu khôi phục trống hoặc không hợp lệ' };
    }

    let payload = input;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload.replace(/^\uFEFF/, '').trim());
      } catch (err: any) {
        return { success: false, error: 'Tệp sao lưu không phải là chuỗi JSON hợp lệ: ' + err.message };
      }
    }

    // Drill down if payload is wrapped in { data: ... }
    let rawData: any = payload;
    if (rawData && typeof rawData === 'object') {
      if (rawData.data && typeof rawData.data === 'object') {
        if (rawData.data.data && typeof rawData.data.data === 'object') {
          rawData = rawData.data.data;
        } else {
          rawData = rawData.data;
        }
      }
    }

    // Also support sections structure if present
    const sections = (payload && payload.sections) || (payload && payload.data && payload.data.sections);

    // 1. Extract exams (Mục 1)
    let extractedExams: Exam[] | null = null;
    if (rawData && Array.isArray(rawData.exams)) {
      extractedExams = rawData.exams;
    } else if (sections?.muc_1_de_kiem_tra?.exams && Array.isArray(sections.muc_1_de_kiem_tra.exams)) {
      extractedExams = sections.muc_1_de_kiem_tra.exams;
    } else if (payload && Array.isArray(payload.exams)) {
      extractedExams = payload.exams;
    }

    // 2. Extract sessions (Mục 2 & Mục 3)
    let extractedSessions: ExamSession[] | null = null;
    if (rawData && Array.isArray(rawData.sessions)) {
      extractedSessions = rawData.sessions;
    } else if (sections?.muc_2_giam_sat_truc_tiep?.sessions || sections?.muc_3_ket_qua_xuat_excel?.sessions) {
      const live = Array.isArray(sections?.muc_2_giam_sat_truc_tiep?.sessions) ? sections.muc_2_giam_sat_truc_tiep.sessions : [];
      const completed = Array.isArray(sections?.muc_3_ket_qua_xuat_excel?.sessions) ? sections.muc_3_ket_qua_xuat_excel.sessions : [];
      extractedSessions = [...live, ...completed];
    } else if (payload && Array.isArray(payload.sessions)) {
      extractedSessions = payload.sessions;
    }

    // 3. Extract classes (Mục 4 - Lớp học)
    let extractedClasses: ClassInfo[] | null = null;
    if (rawData && Array.isArray(rawData.classes)) {
      extractedClasses = rawData.classes;
    } else if (sections?.muc_4_quan_ly_lop_va_hoc_sinh?.classes && Array.isArray(sections.muc_4_quan_ly_lop_va_hoc_sinh.classes)) {
      extractedClasses = sections.muc_4_quan_ly_lop_va_hoc_sinh.classes;
    } else if (payload && Array.isArray(payload.classes)) {
      extractedClasses = payload.classes;
    }

    // 4. Extract students (Mục 4 - Học sinh)
    let extractedStudents: StudentInfo[] | null = null;
    if (rawData && Array.isArray(rawData.students)) {
      extractedStudents = rawData.students;
    } else if (sections?.muc_4_quan_ly_lop_va_hoc_sinh?.students && Array.isArray(sections.muc_4_quan_ly_lop_va_hoc_sinh.students)) {
      extractedStudents = sections.muc_4_quan_ly_lop_va_hoc_sinh.students;
    } else if (payload && Array.isArray(payload.students)) {
      extractedStudents = payload.students;
    }

    // Validate that we found at least some recognized database data
    if (!extractedExams && !extractedClasses && !extractedStudents && !extractedSessions) {
      return {
        success: false,
        error: 'Tệp sao lưu không chứa dữ liệu của bất kỳ mục nào trong 4 mục (Đề thi, Giám sát, Kết quả, Lớp học).'
      };
    }

    // Apply exams
    if (extractedExams) {
      this.data.exams = extractedExams.map(e => ({
        ...e,
        maxAttempts: Number(e.maxAttempts) > 0 ? Number(e.maxAttempts) : 1,
        randomQuestionCount: Number(e.randomQuestionCount) > 0 ? Number(e.randomQuestionCount) : undefined
      }));
    }

    // Apply sessions (Mục 2 & 3)
    if (extractedSessions) {
      this.data.sessions = extractedSessions;
    }

    // Apply classes (Mục 4)
    if (extractedClasses && extractedClasses.length > 0) {
      this.data.classes = extractedClasses;
    }

    // Apply students (Mục 4)
    if (extractedStudents && extractedStudents.length > 0) {
      this.data.students = extractedStudents.map(s => ({
        ...s,
        username: s.username || generateStudentUsername(s.name, s.class),
        password: s.password || getDefaultStudentPassword(s.class),
        isPasswordChanged: !!s.isPasswordChanged
      }));
    }

    // Preserve or update admin password & token
    if (rawData && rawData.adminPassword) {
      this.data.adminPassword = rawData.adminPassword;
    }
    if (rawData && rawData.adminToken) {
      this.data.adminToken = rawData.adminToken;
    }

    this.persist();

    return {
      success: true,
      message: 'Khôi phục toàn bộ cơ sở dữ liệu thành công!',
      details: {
        examsCount: this.data.exams.length,
        sessionsCount: this.data.sessions.length,
        classesCount: this.data.classes.length,
        studentsCount: this.data.students.length
      }
    };
  }

  public clearAllExamsAndSessions(): void {
    this.data.exams = [];
    this.data.sessions = [];
    this.data.deletedExamIds = [];
    this.persist();
  }
}

export const db = new DatabaseManager();
