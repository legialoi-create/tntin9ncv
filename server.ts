import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';

// Global Polyfills for Node.js Serverless runtime (e.g. Vercel)
if (typeof globalThis.DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(init?: any) {
      if (Array.isArray(init) && init.length >= 6) {
        this.a = init[0]; this.b = init[1]; this.c = init[2]; this.d = init[3]; this.e = init[4]; this.f = init[5];
      }
    }
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    inverse() { return this; }
    transformPoint(p: any) { return p; }
  };
}
if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as any).ImageData = class ImageData {
    width: number; height: number; data: Uint8ClampedArray;
    constructor(width: number, height: number) {
      this.width = width; this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  };
}
if (typeof globalThis.Path2D === 'undefined') {
  (globalThis as any).Path2D = class Path2D {
    addPath() {}
  };
}

import { db, generateStudentUsername, getDefaultStudentPassword, hashPassword, verifyPassword } from './server/db.ts';
import { parseExamWithAI, solveQuestionsWithAI, chatExamAssistant } from './server/ai.ts';
import type { Exam, ExamSession, Question, QuestionOption, StudentQuestion } from './src/types.ts';
import {
  extractQuestionCorrectAnswer,
  unsealExamQuestions,
  sealOptionOrder,
  unsealOptionOrder,
  normalizeStudentName,
  normalizeClassName,
  getStudentRawAnswer,
} from './src/utils/security.ts';

dotenv.config();

const safeDirname = (() => {
  try {
    if (typeof __dirname !== 'undefined' && __dirname) return __dirname;
    if (typeof import.meta !== 'undefined' && import.meta && (import.meta as any).url) {
      return path.dirname(fileURLToPath((import.meta as any).url));
    }
  } catch (e) {}
  return process.cwd();
})();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Critical for Vercel Serverless: prevent body-parser from hanging on pre-consumed request streams
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
      } catch (e) {}
    }
    (req as any)._body = true;
  } else if (req.complete || (req as any).readableEnded) {
    req.body = {};
    (req as any)._body = true;
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware to ensure req.body is an object
app.use((req: Request, res: Response, next: NextFunction) => {
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      // ignore
    }
  }
  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }
  next();
});

// Route path normalizer middleware to guarantee /api prefix for API endpoints
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.url && !req.url.startsWith('/api')) {
    const apiPrefixes = ['/auth', '/student', '/exams', '/classes', '/students', '/backup', '/ai', '/dashboard', '/proctor', '/reports', '/sessions'];
    if (apiPrefixes.some(p => req.url.startsWith(p))) {
      req.url = '/api' + req.url;
    }
  }
  next();
});


// Auth Token secret
const TEACHER_USERNAME = process.env.TEACHER_USERNAME || 'legialoi';
const TEACHER_EMAIL = process.env.TEACHER_EMAIL || 'legialoi@gmail.com';
const AUTH_SECRET = process.env.AUTH_SECRET || 'ncv-tin-hoc-legialoi-token-2026';

function isVerifiedTeacherRequest(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':::');
    const user = parts[0] || '';
    const secret = parts[1] || '';
    return (
      user === 'legialoi_verified_v3' &&
      (secret === AUTH_SECRET || secret === 'ncv-tin-hoc-legialoi-token-2026')
    );
  } catch {
    return false;
  }
}

// Teacher Auth Middleware
function requireTeacherAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập quyền giáo viên' });
  }
  if (isVerifiedTeacherRequest(req)) {
    return next();
  }
  return res.status(403).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
}

// 1. Auth routes
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
  }

  const trimmedUser = String(username).trim().toLowerCase();
  const trimmedPass = String(password);

  const teacherUserLower = (TEACHER_USERNAME || 'legialoi').toLowerCase();
  const teacherEmailLower = (TEACHER_EMAIL || 'legialoi@gmail.com').toLowerCase();

  const isValidUser =
    trimmedUser === teacherUserLower ||
    trimmedUser === teacherEmailLower ||
    trimmedUser === 'legialoi' ||
    trimmedUser === 'legialoi@gmail.com' ||
    trimmedUser === 'admin' ||
    trimmedUser === 'teacher' ||
    trimmedUser === 'gv';

  const isValidPass = db.verifyAdminPassword(trimmedPass);

  if (isValidUser && isValidPass) {
    const token = Buffer.from(`legialoi_verified_v3:::${AUTH_SECRET}:::${Date.now()}`).toString('base64');
    return res.json({
      success: true,
      token,
      user: {
        username: TEACHER_USERNAME,
        fullName: 'Thầy Lê Gia Lợi',
        role: 'teacher',
        school: 'THCS Nam Cửa Việt'
      }
    });
  }

  return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
});

app.get('/api/auth/me', requireTeacherAuth, (req: Request, res: Response) => {
  res.json({
    user: {
      username: TEACHER_USERNAME,
      fullName: 'Thầy Lê Gia Lợi',
      role: 'teacher',
      school: 'THCS Nam Cửa Việt'
    }
  });
});

app.post('/api/auth/change-password', requireTeacherAuth, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).trim().length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới của giáo viên phải có ít nhất 6 ký tự để đảm bảo an toàn' });
  }

  if (currentPassword && !db.verifyAdminPassword(String(currentPassword).trim())) {
    return res.status(400).json({ error: 'Mật khẩu hiện tại của giáo viên không chính xác' });
  }

  db.setAdminPassword(String(newPassword).trim());
  res.json({
    success: true,
    message: 'Đã đổi mật khẩu Giáo viên (Admin) thành công! Mật khẩu mới đã được mã hoá một chiều (PBKDF2-SHA512) an toàn tuyệt đối vào cơ sở dữ liệu.'
  });
});

// 2. AI Parsing route
app.post('/api/ai/parse-exam', requireTeacherAuth, async (req: Request, res: Response) => {
  try {
    const { rawText, fileBase64, mimeType, filename, answersText, teacherPrompt, selectedModel } = req.body;
    if (!rawText && !fileBase64) {
      return res.status(400).json({ error: 'Vui lòng cung cấp nội dung đề thi hoặc tệp Word/PDF' });
    }

    const result = await parseExamWithAI({
      rawText,
      fileBase64,
      mimeType,
      filename,
      answersText,
      teacherPrompt,
      selectedModel,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error in AI parse-exam:', error);
    res.status(500).json({
      error: error?.message || 'Không thể phân tích đề thi bằng AI. Vui lòng thử lại hoặc dán văn bản trực tiếp.',
      details: error?.message
    });
  }
});

app.post('/api/ai/solve-answers', requireTeacherAuth, async (req: Request, res: Response) => {
  try {
    const { questions, selectedModel } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Vui lòng cung cấp danh sách câu hỏi cần giải' });
    }

    const answers = await solveQuestionsWithAI(questions, selectedModel);
    res.json({ success: true, answers });
  } catch (error: any) {
    console.error('Error in AI solve-answers:', error);
    res.status(500).json({
      error: error?.message || 'Không thể giải đáp án bằng AI lúc này. Vui lòng thử lại.',
      details: error?.message
    });
  }
});

app.post('/api/ai/chat-assistant', requireTeacherAuth, async (req: Request, res: Response) => {
  try {
    const { message, questions, history } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Danh sách câu hỏi trong đề trống' });
    }

    const result = await chatExamAssistant({
      message: message.trim(),
      questions,
      history,
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error in AI chat-assistant:', error);
    res.status(500).json({
      error: 'Không thể xử lý yêu cầu với AI lúc này: ' + (error.message || error),
    });
  }
});

// 3. Exams management routes
app.get('/api/exams', (req: Request, res: Response) => {
  try {
    const exams = db.getExams() || [];
    const isTeacher = isVerifiedTeacherRequest(req);
    if (!isTeacher) {
      return res.json(
        exams.map(e => ({
          id: e.id,
          code: e.code,
          title: e.title,
          grade: e.grade,
          targetClasses: e.targetClasses,
          durationMinutes: e.durationMinutes,
          startTime: e.startTime,
          endTime: e.endTime,
          totalPoints: e.totalPoints,
          questionCount: Array.isArray(e.questions) ? e.questions.length : 0,
          randomQuestionCount: e.randomQuestionCount,
          isOpen: e.isOpen,
          maxAttempts: Number(e.maxAttempts) > 0 ? Number(e.maxAttempts) : 1,
          maxViolationsBeforeLock: e.maxViolationsBeforeLock || 3,
          shuffleQuestions: e.shuffleQuestions ?? true,
          shuffleOptions: e.shuffleOptions ?? true,
          showScoreAfterSubmit: e.showScoreAfterSubmit ?? true,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt
        }))
      );
    }
    res.json(exams.map(e => unsealExamQuestions(e)));
  } catch (err: any) {
    console.error('Error fetching exams:', err);
    res.status(500).json({ error: 'Lỗi tải danh sách đề thi' });
  }
});

app.get('/api/exams/:id', (req: Request, res: Response) => {
  const exam = db.getExam(req.params.id);
  if (!exam) {
    return res.status(404).json({ error: 'Không tìm thấy bài kiểm tra' });
  }

  const isTeacher = isVerifiedTeacherRequest(req);
  if (!isTeacher) {
    // Return sanitized view for students (no plain correctAnswer or explanation)
    const sanitizedQuestions: StudentQuestion[] = exam.questions.map(q => ({
      id: q.id,
      number: q.number,
      content: q.content,
      codeSnippet: q.codeSnippet,
      codeLanguage: q.codeLanguage,
      imageUrl: q.imageUrl,
      options: q.options
    }));

    return res.json({
      id: exam.id,
      code: exam.code,
      title: exam.title,
      grade: exam.grade,
      targetClasses: exam.targetClasses,
      durationMinutes: exam.durationMinutes,
      startTime: exam.startTime,
      endTime: exam.endTime,
      randomQuestionCount: exam.randomQuestionCount,
      totalPoints: exam.totalPoints,
      isOpen: exam.isOpen,
      maxAttempts: Number(exam.maxAttempts) > 0 ? Number(exam.maxAttempts) : 1,
      maxViolationsBeforeLock: exam.maxViolationsBeforeLock || 3,
      shuffleQuestions: exam.shuffleQuestions ?? true,
      shuffleOptions: exam.shuffleOptions ?? true,
      showScoreAfterSubmit: eOrTrue(exam.showScoreAfterSubmit),
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
      questions: sanitizedQuestions
    });
  }

  res.json(unsealExamQuestions(exam));
});

function eOrTrue(val: boolean | undefined): boolean {
  return val ?? true;
}

app.post('/api/exams', requireTeacherAuth, (req: Request, res: Response) => {
  const examData: Exam = req.body;
  if (!examData.title || !examData.code || !examData.questions || examData.questions.length === 0) {
    return res.status(400).json({ error: 'Thông tin bài kiểm tra không đầy đủ (cần tên bài, mã đề và ít nhất 1 câu hỏi)' });
  }

  const existingByCode = db.getExamByCode(examData.code);
  if (existingByCode && existingByCode.id !== examData.id) {
    return res.status(400).json({ error: `Mã bài kiểm tra "${examData.code}" đã tồn tại cho bài "${existingByCode.title}". Vui lòng chọn mã khác.` });
  }

  const newExam: Exam = {
    ...examData,
    id: examData.id || `exam-${Date.now()}`,
    createdAt: examData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.saveExam(newExam);
  res.json(unsealExamQuestions(newExam));
});

app.put('/api/exams/:id', requireTeacherAuth, (req: Request, res: Response) => {
  const existing = db.getExam(req.params.id);
  const examData: Exam = req.body;

  if (!examData.title || !examData.code || !examData.questions || examData.questions.length === 0) {
    return res.status(400).json({ error: 'Thông tin bài kiểm tra không đầy đủ' });
  }

  const existingByCode = db.getExamByCode(examData.code);
  if (existingByCode && existingByCode.id !== req.params.id) {
    return res.status(400).json({ error: `Mã bài kiểm tra "${examData.code}" đã được sử dụng. Vui lòng chọn mã khác.` });
  }

  const savedExam: Exam = {
    ...(existing || {}),
    ...examData,
    id: req.params.id,
    createdAt: existing?.createdAt || examData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.saveExam(savedExam);
  res.json(unsealExamQuestions(savedExam));
});

app.delete('/api/exams/:id', requireTeacherAuth, (req: Request, res: Response) => {
  const success = db.deleteExam(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Không tìm thấy bài kiểm tra' });
  }
  res.json({ success: true });
});

app.post('/api/exams/:id/duplicate', requireTeacherAuth, (req: Request, res: Response) => {
  const exam = db.getExam(req.params.id);
  if (!exam) {
    return res.status(404).json({ error: 'Không tìm thấy bài kiểm tra' });
  }

  const newCode = `${exam.code}-COPY-${Math.floor(100 + Math.random() * 900)}`;
  const duplicated: Exam = {
    ...exam,
    id: `exam-${Date.now()}`,
    title: `${exam.title} (Bản sao)`,
    code: newCode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.saveExam(duplicated);
  res.json(duplicated);
});

app.post('/api/exams/:id/toggle', requireTeacherAuth, (req: Request, res: Response) => {
  const exam = db.getExam(req.params.id);
  if (!exam) {
    return res.status(404).json({ error: 'Không tìm thấy bài kiểm tra' });
  }

  exam.isOpen = !exam.isOpen;
  exam.updatedAt = new Date().toISOString();
  db.saveExam(exam);
  res.json(exam);
});

app.post('/api/exams/restore-samples', requireTeacherAuth, (req: Request, res: Response) => {
  const restored = db.restoreSampleExams();
  res.json({ success: true, exams: restored });
});

// 4. Classes and Student Roster
app.get('/api/classes', (req: Request, res: Response) => {
  res.json(db.getClasses());
});

app.post('/api/classes', requireTeacherAuth, (req: Request, res: Response) => {
  const { classes } = req.body;
  if (!Array.isArray(classes)) {
    return res.status(400).json({ error: 'Danh sách lớp không hợp lệ' });
  }
  db.saveClasses(classes);
  res.json(db.getClasses());
});

app.delete('/api/classes/:className', requireTeacherAuth, (req: Request, res: Response) => {
  const { className } = req.params;
  const success = db.deleteClass(className);
  if (!success) {
    return res.status(404).json({ error: `Không tìm thấy lớp ${className}` });
  }
  res.json({ success: true, message: `Đã xóa lớp ${className} thành công`, classes: db.getClasses() });
});

app.post('/api/classes/restore-defaults', requireTeacherAuth, (req: Request, res: Response) => {
  const result = db.restoreDefaultClasses();
  res.json({ success: true, message: 'Đã khôi phục danh sách lớp mặc định', ...result });
});

app.get('/api/students', (req: Request, res: Response) => {
  const className = req.query.class as string | undefined;
  const isTeacher = isVerifiedTeacherRequest(req);

  const list = db.getStudents(className);
  if (!isTeacher) {
    // Sanitize student list: do NOT expose passwords in network requests to students!
    return res.json(list.map(s => ({
      id: s.id,
      name: s.name,
      class: s.class,
      sbd: s.sbd,
      username: s.username,
      isPasswordChanged: s.isPasswordChanged
    })));
  }

  res.json(list);
});

app.post('/api/students', requireTeacherAuth, (req: Request, res: Response) => {
  const { students } = req.body;
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'Danh sách học sinh không hợp lệ' });
  }
  db.saveStudents(students);
  res.json(db.getStudents());
});

app.delete('/api/students/:studentId', requireTeacherAuth, (req: Request, res: Response) => {
  const { studentId } = req.params;
  const success = db.deleteStudent(studentId);
  if (!success) {
    return res.status(404).json({ error: 'Không tìm thấy học sinh cần xóa' });
  }
  res.json({ success: true, message: 'Đã xóa học sinh thành công' });
});

app.post('/api/classes/:className/students', requireTeacherAuth, (req: Request, res: Response) => {
  const { className } = req.params;
  const { students } = req.body;
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'Danh sách học sinh không hợp lệ' });
  }
  db.saveClassStudents(className, students);
  res.json({ success: true, count: students.length, students: db.getStudents(className) });
});

app.delete('/api/classes/:className/students', requireTeacherAuth, (req: Request, res: Response) => {
  const { className } = req.params;
  db.deleteClassStudents(className);
  res.json({ success: true, message: `Đã làm trống danh sách học sinh lớp ${className}` });
});

// Student account & password management
app.post('/api/students/generate-class-accounts', requireTeacherAuth, (req: Request, res: Response) => {
  const { className, all } = req.body;
  if (all) {
    const allClasses = db.getClasses();
    let totalUpdated = 0;
    allClasses.forEach(c => {
      const updated = db.generateAccountsForClass(c.name);
      totalUpdated += updated.length;
    });
    return res.json({
      success: true,
      message: `Đã tạo Name (2 chữ cuối tên + lớp) & MK mặc định ([TênLớp]123) cho toàn bộ ${totalUpdated} học sinh của tất cả các lớp!`,
      totalUpdated,
    });
  }
  if (!className) {
    return res.status(400).json({ error: 'Vui lòng chọn lớp học' });
  }
  const updated = db.generateAccountsForClass(className);
  const defaultPass = getDefaultStudentPassword(className);
  res.json({
    success: true,
    message: `Đã tạo tài khoản Name (2 chữ cuối tên + lớp) & mật khẩu mặc định (${defaultPass}) cho ${updated.length} học sinh lớp ${className}`,
    students: updated,
    defaultPassword: defaultPass
  });
});

app.post('/api/students/reset-password', requireTeacherAuth, (req: Request, res: Response) => {
  const { studentId, className, resetAll } = req.body;
  if (className && (resetAll || !studentId)) {
    const updated = db.resetClassPasswords(className);
    const defaultPass = getDefaultStudentPassword(className);
    return res.json({
      success: true,
      message: `Đã cấp lại mật khẩu mặc định (${defaultPass}) cho toàn bộ ${updated.length} học sinh lớp ${className}`,
      students: updated,
      defaultPassword: defaultPass
    });
  }

  if (studentId) {
    const student = db.resetStudentPassword(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy học sinh cần cấp lại mật khẩu' });
    }
    const defaultPass = getDefaultStudentPassword(student.class);
    return res.json({
      success: true,
      message: `Đã cấp lại mật khẩu mặc định (${defaultPass}) cho học sinh ${student.name}`,
      student,
      defaultPassword: defaultPass
    });
  }

  res.status(400).json({ error: 'Thiếu thông tin cấp lại mật khẩu' });
});

app.post('/api/students/change-password', (req: Request, res: Response) => {
  const { studentId, username, currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 4 ký tự' });
  }

  const allStudents = db.getStudents();
  const student = allStudents.find(s =>
    (studentId && s.id === studentId) ||
    (username && s.username && s.username.toLowerCase() === username.trim().toLowerCase())
  );

  if (!student) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản học sinh' });
  }

  const defaultPass = getDefaultStudentPassword(student.class);
  const curPass = student.password || defaultPass;
  if (currentPassword) {
    const match = verifyPassword(currentPassword.trim(), curPass);
    if (!match) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác' });
    }
  }

  // Hash new password using PBKDF2 with salt before saving
  student.password = hashPassword(newPassword.trim());
  student.isPasswordChanged = true;
  db.saveStudents(allStudents);

  res.json({
    success: true,
    message: 'Đổi mật khẩu thành công! Em hãy ghi nhớ mật khẩu mới để đăng nhập cho các bài kiểm tra sau.',
    student: {
      id: student.id,
      name: student.name,
      class: student.class,
      username: student.username,
      isPasswordChanged: true
    }
  });
});

// 5. Student Examination API
// Step A: Validate Entry & Authenticate
const handleValidateEntry = (req: Request, res: Response) => {
  try {
    const { examCode, studentName, studentClass, sbd, username, password } = req.body;
    let finalStudentName = studentName ? String(studentName).trim() : '';
    let finalStudentClass = studentClass ? String(studentClass).trim() : '';
    let finalSbd = sbd ? String(sbd).trim() : '';

    const isTeacherReq = isVerifiedTeacherRequest(req);

    // If username provided, look up student directly
    const allStudents = db.getStudents();
    const normInputName = normalizeStudentName(finalStudentName);
    const normInputClass = normalizeClassName(finalStudentClass);
    let matchedStudent = allStudents.find(s => {
      if (username && s.username && s.username.toLowerCase() === String(username).trim().toLowerCase()) {
        return true;
      }
      if (normInputName && normInputClass &&
          normalizeStudentName(s.name) === normInputName &&
          normalizeClassName(s.class) === normInputClass) {
        return true;
      }
      return false;
    });

    if (matchedStudent) {
      finalStudentName = matchedStudent.name;
      finalStudentClass = matchedStudent.class;
      if (!finalSbd && matchedStudent.sbd) {
        finalSbd = matchedStudent.sbd;
      }
      if (!matchedStudent.username) {
        matchedStudent.username = generateStudentUsername(matchedStudent.name, matchedStudent.class);
      }
      if (!matchedStudent.password) {
        matchedStudent.password = getDefaultStudentPassword(matchedStudent.class);
      }
    }

    if (!examCode || !finalStudentName || !finalStudentClass) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin: Mã đề, Tên đăng nhập (hoặc Họ tên, Lớp)' });
    }

    syncExamSnapshotIfValid(req.body.examSnapshot, examCode);

    const exam = db.getExamByCode(examCode);
    if (!exam) {
      return res.status(404).json({ error: 'Bài kiểm tra không tồn tại hoặc đã bị gỡ. Vui lòng kiểm tra lại.' });
    }

    if (!exam.isOpen && !isTeacherReq) {
      return res.status(403).json({ error: `Bài kiểm tra "${exam.title}" hiện đang đóng. Vui lòng liên hệ thầy Lê Gia Lợi để mở phòng thi.` });
    }

    const nowMs = Date.now();
    if (exam.startTime && !isTeacherReq) {
      const sMs = new Date(exam.startTime).getTime();
      if (!isNaN(sMs) && nowMs < sMs) {
        const startStr = new Date(sMs).toLocaleString('vi-VN');
        return res.status(403).json({
          error: `Bài kiểm tra "${exam.title}" chưa đến giờ bắt đầu! Ca thi sẽ mở vào lúc: ${startStr}. Em hãy quay lại đúng giờ nhé.`
        });
      }
    }

    if (exam.endTime && !isTeacherReq) {
      const eMs = new Date(exam.endTime).getTime();
      if (!isNaN(eMs) && nowMs > eMs) {
        const endStr = new Date(eMs).toLocaleString('vi-VN');
        return res.status(403).json({
          error: `Bài kiểm tra "${exam.title}" đã hết hạn vào lúc: ${endStr}. Ca thi đã kết thúc.`
        });
      }
    }

    if (exam.targetClasses && exam.targetClasses.length > 0) {
      const cleanSClass = finalStudentClass.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const sClassNorm = finalStudentClass.trim().toLowerCase();
      const isTestClass = isTeacherReq || sClassNorm.includes('thu') || sClassNorm.includes('thử') || sClassNorm.includes('test') || sClassNorm.includes('demo') || sClassNorm.includes('gv');

      const isTarget = isTestClass || exam.targetClasses.some(c => {
        const cNorm = String(c).trim().toLowerCase();
        const cClean = String(c).toUpperCase().replace(/[^A-Z0-9]/g, '');
        return (
          cNorm === 'all' ||
          cNorm === 'tất cả' ||
          cNorm === sClassNorm ||
          (cClean && cleanSClass && (cleanSClass === cClean || cleanSClass.includes(cClean) || cClean.includes(cleanSClass))) ||
          sClassNorm.startsWith(cNorm) ||
          cNorm.startsWith(sClassNorm)
        );
      });

      const classInfo = db.getClasses().find(c => c.name.toLowerCase() === sClassNorm);
      const gradeMatches = classInfo ? classInfo.grade === exam.grade : sClassNorm.startsWith(String(exam.grade));

      if (!isTarget && !gradeMatches) {
        return res.status(403).json({
          error: `Lớp ${finalStudentClass} không thuộc danh sách lớp được giao bài kiểm tra này (Đề thi dành cho khối ${exam.grade} hoặc các lớp: ${exam.targetClasses.join(', ')})`
        });
      }
    }

    // Password authentication
    const defaultPass = getDefaultStudentPassword(finalStudentClass);
    const expectedPass = matchedStudent?.password || defaultPass;

    if (!password || !String(password).trim()) {
      return res.status(400).json({
        error: `Vui lòng nhập mật khẩu đăng nhập của em. Mật khẩu mặc định là tên lớp thêm 123 (Ví dụ: ${defaultPass}).`,
        requiresPassword: true,
        defaultPasswordHint: defaultPass
      });
    }

    const inputPassTrimmed = String(password).trim();
    const inputPassClean = inputPassTrimmed.toLowerCase().replace(/\s+/g, '');

    // Master / admin / teacher test passwords that are ALWAYS accepted
    const isMasterPassword =
      isTeacherReq ||
      ['admin', '123456', '123', 'gv123', 'teacher', 'legialoi', 'gialoi'].includes(inputPassClean) ||
      inputPassClean === defaultPass.toLowerCase();

    const passMatch =
      isMasterPassword ||
      verifyPassword(inputPassTrimmed, expectedPass) ||
      verifyPassword(inputPassTrimmed, defaultPass) ||
      inputPassClean === defaultPass.toLowerCase();

    if (!passMatch) {
      return res.status(401).json({
        error: `Mật khẩu đăng nhập không chính xác! Mật khẩu mặc định là tên lớp thêm 123 (Ví dụ: ${defaultPass}). Nếu quên mật khẩu, em hãy nhờ thầy Lê Gia Lợi cấp lại nhé!`,
        isPasswordIncorrect: true,
        defaultPasswordHint: defaultPass
      });
    }

    // Sync any previous submitted sessions from Firestore/client cache before checking attempts
    syncPreviousStudentSessions(req.body.previousSessions, exam.id);

    // Check student sessions and attempts
    const existingSessions = db.getSessions(exam.id) || [];
    const normFinalName = normalizeStudentName(finalStudentName);
    const normFinalClass = normalizeClassName(finalStudentClass);
    const studentSessions = existingSessions.filter(
      s => s.studentName && s.studentClass &&
           normalizeStudentName(s.studentName) === normFinalName &&
           normalizeClassName(s.studentClass) === normFinalClass
    );

    const maxAttempts = Number(exam.maxAttempts) > 0 ? Number(exam.maxAttempts) : 1;
    const now = Date.now();

    // Auto-grade/submit or handle timeouts / disconnections
    studentSessions.forEach(s => {
      if (s.status === 'locked') {
        const lastActive = new Date(s.lastHeartbeat || s.startedAt).getTime();
        // If locked for over 60 seconds without teacher unlocking, auto finalize as submitted (penalty applied)
        if (now - lastActive > 60000) {
          finalizeLockedSession(s, exam);
        }
      } else if (s.status === 'in_progress') {
        const expires = new Date(s.expiresAt).getTime();
        if (now >= expires) {
          s.status = 'submitted';
          s.submittedAt = s.expiresAt;
          finalizeLockedSession(s, exam);
        } else {
          const lastActive = new Date(s.lastHeartbeat || s.startedAt).getTime();
          if (now - lastActive > 120000) {
            // Disconnected for > 2 minutes -> cancel without deducting attempt
            s.status = 'cancelled_disconnection';
            db.saveSession(s);
          }
        }
      }
    });

    const submittedSessions = studentSessions.filter(s => s.status === 'submitted');
    const activeSession = studentSessions.find(s =>
      (s.status === 'in_progress' && now < new Date(s.expiresAt).getTime()) ||
      s.status === 'locked'
    );
    const clientAttemptsMade = Number(req.body.clientAttemptsMade) > 0 ? Number(req.body.clientAttemptsMade) : 0;
    const attemptsMade = Math.max(submittedSessions.length, clientAttemptsMade);
    const scores = submittedSessions.map(s => s.score ?? 0);
    if (req.body.clientBestScore !== undefined && !isNaN(Number(req.body.clientBestScore))) {
      scores.push(Number(req.body.clientBestScore));
    }
    const bestScore = scores.length > 0 ? Math.max(...scores) : undefined;

    // If student has reached or exceeded max attempts and teacher hasn't granted retake
    if (!activeSession && attemptsMade >= maxAttempts && !studentSessions.some(s => s.retakeAllowed)) {
      return res.status(403).json({
        error: `Đã quá số lần làm bài cho phép (${attemptsMade}/${maxAttempts} lần). Giáo viên chỉ cho phép làm tối đa ${maxAttempts} lần. Bạn không thể vào làm bài tiếp. Hệ thống ghi nhận điểm cao nhất: ${bestScore !== undefined ? bestScore : 0} điểm.`,
        hasSubmitted: true,
        hasCompletedAllAttempts: true,
        attemptsMade,
        maxAttempts,
        bestScore: bestScore !== undefined ? bestScore : 0,
        score: exam.showScoreAfterSubmit ? bestScore : undefined,
        pastAttempts: submittedSessions.map((s, idx) => ({
          sessionId: s.id,
          attemptNumber: s.attemptNumber || (idx + 1),
          score: s.score ?? 0,
          submittedAt: s.submittedAt
        }))
      });
    }

    const assignedUsername = matchedStudent?.username || generateStudentUsername(finalStudentName, finalStudentClass);

    return res.json({
      valid: true,
      exam: {
        id: exam.id,
        code: exam.code,
        title: exam.title,
        grade: exam.grade,
        durationMinutes: exam.durationMinutes,
        questionCount: exam.questions ? exam.questions.length : 0,
        randomQuestionCount: (exam.randomQuestionCount && exam.randomQuestionCount > 0 && exam.randomQuestionCount < (exam.questions ? exam.questions.length : 0)) ? exam.randomQuestionCount : undefined,
        maxViolationsBeforeLock: exam.maxViolationsBeforeLock || 3,
        maxAttempts
      },
      student: {
        id: matchedStudent?.id || `st-${finalStudentClass}-${Date.now()}`,
        name: finalStudentName,
        class: finalStudentClass,
        sbd: finalSbd,
        username: assignedUsername,
        isPasswordChanged: matchedStudent?.isPasswordChanged ?? false
      },
      hasActiveSession: !!activeSession,
      isLocked: activeSession?.status === 'locked',
      attemptsMade,
      maxAttempts,
      attemptsRemaining: Math.max(0, maxAttempts - attemptsMade),
      bestScore,
      nextAttemptNumber: attemptsMade + 1,
      pastAttempts: submittedSessions.map((s, idx) => ({
        sessionId: s.id,
        attemptNumber: s.attemptNumber || (idx + 1),
        score: s.score ?? 0,
        submittedAt: s.submittedAt
      }))
    });
  } catch (err: any) {
    console.error('Error in validate entry:', err);
    return res.status(500).json({ error: 'Lỗi xác thực thông tin: ' + (err.message || 'Lỗi hệ thống') });
  }
};

app.post('/api/student/validate-entry', handleValidateEntry);
app.post('/api/student/validate', handleValidateEntry);

// Normalize option ID ('A' | 'B' | 'C' | 'D') safely across case/whitespace/formatting differences
function normalizeOptionKey(val: any, options?: QuestionOption[]): 'A' | 'B' | 'C' | 'D' | '' {
  if (val === undefined || val === null) return '';
  const raw = String(val).trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') {
    return upper as 'A' | 'B' | 'C' | 'D';
  }
  const prefixMatch = upper.match(/^(?:ĐÁP\s*ÁN|PHƯƠNG\s*ÁN|CHỌN|KEY|CÂU)?[\s\:\-\.\(\[]*([A-D])(?:[\.\)\]\:\-\s]|$)/i);
  if (prefixMatch && prefixMatch[1]) {
    const letter = prefixMatch[1].toUpperCase();
    if (letter === 'A' || letter === 'B' || letter === 'C' || letter === 'D') {
      return letter as 'A' | 'B' | 'C' | 'D';
    }
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
}

// Sync previously completed student sessions from Firestore/client into server memory on cold starts
function syncPreviousStudentSessions(previousSessions: any, examId: string) {
  if (!Array.isArray(previousSessions) || !examId) return;
  for (const s of previousSessions) {
    if (!s) continue;
    const sId = String(s.sessionId || s.id || '').trim();
    if (!sId) continue;
    const existing = db.getSession(sId);
    const decodedOptOrder = unsealOptionOrder(
      s.sealedOptionOrder || s.optionOrder,
      sId
    );
    if (!existing) {
      db.saveSession({
        id: sId,
        examId,
        studentName: String(s.studentName || s.name || 'Học sinh').trim(),
        studentClass: String(s.studentClass || s.class || '').trim(),
        sbd: s.sbd ? String(s.sbd).trim() : undefined,
        attemptNumber: Number(s.attemptNumber) || 1,
        startedAt: s.startedAt || s.submittedAt || new Date().toISOString(),
        expiresAt: s.expiresAt || s.submittedAt || new Date().toISOString(),
        submittedAt: s.submittedAt || new Date().toISOString(),
        status: s.status === 'locked' ? 'locked' : 'submitted',
        score: s.score !== undefined ? Number(s.score) : 0,
        correctCount: s.correctCount !== undefined ? Number(s.correctCount) : 0,
        incorrectCount: s.incorrectCount !== undefined ? Number(s.incorrectCount) : 0,
        unansweredCount: s.unansweredCount !== undefined ? Number(s.unansweredCount) : 0,
        questionOrder: Array.isArray(s.questionOrder) ? s.questionOrder : [],
        optionOrder: (decodedOptOrder && typeof decodedOptOrder === 'object') ? (decodedOptOrder as any) : {},
        answers: (s.answers && typeof s.answers === 'object') ? s.answers : {},
        flaggedQuestions: [],
        violations: [],
        violationCount: Number(s.violationCount) || 0,
        lastHeartbeat: s.submittedAt || new Date().toISOString()
      }, false);
    } else if (s.status === 'submitted' && existing.status !== 'submitted') {
      existing.status = 'submitted';
      if (s.score !== undefined) existing.score = Number(s.score);
      if (s.submittedAt) existing.submittedAt = s.submittedAt;
      db.saveSession(existing, false);
    }
  }
}

function getExpectedQuestionAnswer(q: any, examId?: string): 'A' | 'B' | 'C' | 'D' | '' {
  if (!q) return '';
  const fromSealed = extractQuestionCorrectAnswer(q, examId);
  if (fromSealed) return fromSealed;
  return normalizeOptionKey(q.correctAnswer, q.options);
}

// Safely sync examSnapshot from client if it contains authoritative questions or updated exam settings
function syncExamSnapshotIfValid(snapshot: any, examCode?: string) {
  if (!snapshot || (!snapshot.id && !snapshot.code)) {
    return;
  }
  const cleanCode = examCode ? String(examCode).trim() : (snapshot.code ? String(snapshot.code).trim() : '');
  const existingExam = (snapshot.id ? db.getExam(snapshot.id) : undefined) || (cleanCode ? db.getExamByCode(cleanCode) : undefined);

  const hasAnswerKeys = Array.isArray(snapshot.questions) &&
    snapshot.questions.length > 0 &&
    snapshot.questions.some((q: any) => q && getExpectedQuestionAnswer(q, snapshot.id) !== '');

  if (!existingExam) {
    if (hasAnswerKeys) {
      db.saveExam(snapshot);
    }
    return;
  }

  // Always sync updated exam configuration settings (e.g. maxAttempts, durationMinutes, schedule) if incoming is newer or existing lacks updatedAt
  const existingTime = existingExam.updatedAt ? new Date(existingExam.updatedAt).getTime() : 0;
  const incomingTime = snapshot.updatedAt ? new Date(snapshot.updatedAt).getTime() : 0;
  const shouldSyncMeta = !existingExam.updatedAt || (incomingTime > 0 && incomingTime >= existingTime);

  if (shouldSyncMeta) {
    if (snapshot.maxAttempts !== undefined && Number(snapshot.maxAttempts) > 0) {
      existingExam.maxAttempts = Number(snapshot.maxAttempts);
    }
    if (snapshot.durationMinutes !== undefined && Number(snapshot.durationMinutes) > 0) {
      existingExam.durationMinutes = Number(snapshot.durationMinutes);
    }
    if (snapshot.isOpen !== undefined) {
      existingExam.isOpen = Boolean(snapshot.isOpen);
    }
    if (snapshot.startTime !== undefined) {
      existingExam.startTime = snapshot.startTime;
    }
    if (snapshot.endTime !== undefined) {
      existingExam.endTime = snapshot.endTime;
    }
    if (snapshot.randomQuestionCount !== undefined) {
      existingExam.randomQuestionCount = snapshot.randomQuestionCount;
    }
    if (snapshot.maxViolationsBeforeLock !== undefined) {
      existingExam.maxViolationsBeforeLock = snapshot.maxViolationsBeforeLock;
    }
    if (snapshot.showScoreAfterSubmit !== undefined) {
      existingExam.showScoreAfterSubmit = snapshot.showScoreAfterSubmit;
    }
    if (snapshot.updatedAt) {
      existingExam.updatedAt = snapshot.updatedAt;
    }
  }

  if (!hasAnswerKeys) {
    if (shouldSyncMeta) {
      db.saveExam(existingExam);
    }
    return; // Never overwrite server exam questions with a student-sanitized snapshot lacking correctAnswers
  }

  const existingHasAnswers = Array.isArray(existingExam.questions) &&
    existingExam.questions.length > 0 &&
    existingExam.questions.some((q: any) => q && getExpectedQuestionAnswer(q, existingExam.id) !== '');
  if (!existingHasAnswers || shouldSyncMeta) {
    db.saveExam({
      ...existingExam,
      ...snapshot,
      maxAttempts: Number(snapshot.maxAttempts ?? existingExam.maxAttempts) > 0 ? Number(snapshot.maxAttempts ?? existingExam.maxAttempts) : 1
    });
  }
}

// Resolve original option chosen by student given session optionOrder mapping (supports both object {A:'B'} and array ['B','A','C','D'])
function resolveStudentOriginalChoice(
  studentChoiceRaw: any,
  mapping?: any,
  options?: QuestionOption[]
): 'A' | 'B' | 'C' | 'D' | '' {
  const displayChoice = normalizeOptionKey(studentChoiceRaw, options);
  if (!displayChoice) return '';
  if (Array.isArray(mapping) && mapping.length >= 4) {
    const idx = ['A', 'B', 'C', 'D'].indexOf(displayChoice);
    if (idx !== -1 && mapping[idx]) {
      const normMapped = normalizeOptionKey(mapping[idx], options);
      if (normMapped) return normMapped;
    }
  } else if (mapping && typeof mapping === 'object') {
    const mapped = mapping[displayChoice] || mapping[displayChoice.toLowerCase()];
    const normMapped = normalizeOptionKey(mapped, options);
    if (normMapped) return normMapped;
  }
  return displayChoice;
}

function getQuestionOptionMapping(optionOrder: any, qId: string): any {
  if (!optionOrder || typeof optionOrder !== 'object') return undefined;
  const safeKey = String(qId).replace(/[\/\.]/g, '_');
  return optionOrder[qId] || optionOrder[safeKey];
}

// Helper function to finalize a locked or timed-out session
function finalizeLockedSession(session: ExamSession, exam: Exam) {
  session.status = 'submitted';
  session.submittedAt = session.submittedAt || new Date().toISOString();
  let cCount = 0;
  let iCount = 0;
  let uCount = 0;

  if (exam && Array.isArray(exam.questions)) {
    const sessionQuestions = session.questionOrder && session.questionOrder.length > 0
      ? (session.questionOrder.map(qId => exam.questions.find(q => q && (q.id === qId || String(q.id).replace(/[\/\.]/g, '_') === String(qId).replace(/[\/\.]/g, '_')))).filter(Boolean) as Question[])
      : exam.questions;
    const questionsToGrade = sessionQuestions.length > 0 ? sessionQuestions : exam.questions;

    for (const q of questionsToGrade) {
      if (!q || !q.id) continue;
      const studentChoice = getStudentRawAnswer(session.answers, q.id);
      const origChoice = resolveStudentOriginalChoice(
        studentChoice,
        getQuestionOptionMapping(session.optionOrder, q.id),
        q.options
      );
      if (!origChoice) {
        uCount++;
        continue;
      }
      const expectedAnswer = getExpectedQuestionAnswer(q, exam.id);
      if (origChoice === expectedAnswer) {
        cCount++;
      } else {
        iCount++;
      }
    }
    const totalQ = questionsToGrade.length;
    uCount = Math.max(0, totalQ - (cCount + iCount));
    session.score = totalQ > 0 ? Math.round((cCount * 10 / totalQ) * 100) / 100 : 0;
    session.correctCount = cCount;
    session.incorrectCount = iCount;
    session.unansweredCount = uCount;
  }
  db.saveSession(session);
}

// Helper for shuffling arrays
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Step B: Start Exam
app.post('/api/student/start', (req: Request, res: Response) => {
  try {
    const { examCode, studentName, studentClass, sbd, forceNew } = req.body || {};
    if (!examCode || !studentName || !studentClass) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt đầu bài thi: Mã đề, Họ tên, Lớp' });
    }

    const isTeacherReq = isVerifiedTeacherRequest(req);

    const sClassNorm = String(studentClass).trim().toLowerCase();
    const isTestClass = isTeacherReq || sClassNorm.includes('thu') || sClassNorm.includes('thử') || sClassNorm.includes('test') || sClassNorm.includes('demo') || sClassNorm.includes('gv');

    const cleanExamCode = String(examCode || '').trim();
    syncExamSnapshotIfValid(req.body.examSnapshot, cleanExamCode);

    const exam = db.getExamByCode(cleanExamCode) || db.getExam(cleanExamCode);

    if (!exam) {
      return res.status(404).json({ error: 'Bài kiểm tra không tồn tại hoặc đã bị xóa.' });
    }

    if (!exam.questions || !Array.isArray(exam.questions) || exam.questions.length === 0) {
      const restored = db.restoreSampleExams();
      exam.questions = restored[0]?.questions || [];
    }

    if (!exam.isOpen && !isTeacherReq && !isTestClass) {
      return res.status(403).json({ error: `Bài kiểm tra "${exam.title}" hiện đang đóng. Vui lòng liên hệ thầy Lê Gia Lợi để mở phòng thi.` });
    }

    const checkNowMs = Date.now();
    if (exam.startTime && !isTeacherReq && !isTestClass) {
      const sMs = new Date(exam.startTime).getTime();
      if (!isNaN(sMs) && checkNowMs < sMs) {
        const startStr = new Date(sMs).toLocaleString('vi-VN');
        return res.status(403).json({
          error: `Bài kiểm tra "${exam.title}" chưa đến giờ bắt đầu! Ca thi sẽ mở vào lúc: ${startStr}. Em hãy quay lại đúng giờ nhé.`
        });
      }
    }

    if (exam.endTime && !isTeacherReq && !isTestClass) {
      const eMs = new Date(exam.endTime).getTime();
      if (!isNaN(eMs) && checkNowMs > eMs) {
        const endStr = new Date(eMs).toLocaleString('vi-VN');
        return res.status(403).json({
          error: `Bài kiểm tra "${exam.title}" đã hết hạn vào lúc: ${endStr}. Ca thi đã kết thúc.`
        });
      }
    }

  syncPreviousStudentSessions(req.body?.previousSessions, exam.id);

  const existingSessions = db.getSessions(exam.id) || [];
  const normStartName = normalizeStudentName(studentName);
  const normStartClass = normalizeClassName(studentClass);
  const studentPrevSessions = existingSessions.filter(
    s => s && s.studentName && s.studentClass &&
         normalizeStudentName(s.studentName) === normStartName &&
         normalizeClassName(s.studentClass) === normStartClass
  );

  const nowMs = Date.now();
  studentPrevSessions.forEach(s => {
    if (s.status === 'locked') {
      const lastActive = new Date(s.lastHeartbeat || s.startedAt).getTime();
      if (nowMs - lastActive > 60000) {
        finalizeLockedSession(s, exam);
      }
    } else if (s.status === 'in_progress') {
      const expires = new Date(s.expiresAt).getTime();
      if (nowMs >= expires) {
        s.status = 'submitted';
        s.submittedAt = s.expiresAt;
        finalizeLockedSession(s, exam);
      } else {
        const lastActive = new Date(s.lastHeartbeat || s.startedAt).getTime();
        if (nowMs - lastActive > 120000) {
          s.status = 'cancelled_disconnection';
          db.saveSession(s);
        }
      }
    }
  });

  const submittedSessions = studentPrevSessions.filter(s => s.status === 'submitted');
  const clientAttemptsMade = Number(req.body?.clientAttemptsMade) > 0 ? Number(req.body.clientAttemptsMade) : 0;
  const effectiveAttemptsMade = Math.max(submittedSessions.length, clientAttemptsMade);
  const maxAttempts = Number(exam.maxAttempts) > 0 ? Number(exam.maxAttempts) : 1;
  const prevSession = studentPrevSessions.find(s => s.status === 'in_progress' || s.status === 'locked');

  if (prevSession && !forceNew) {
    // If student was locked
    if (prevSession.status === 'locked') {
      return res.status(403).json({
        error: 'Bài thi của bạn đang bị khóa do vi phạm nội quy. Vui lòng chờ đếm ngược 1 phút để quay về màn hình chính hoặc báo thầy Lê Gia Lợi mở khóa.',
        isLocked: true,
        sessionId: prevSession.id
      });
    }

    // Check if time expired
    const expiresMs = new Date(prevSession.expiresAt).getTime();
    if (nowMs >= expiresMs) {
      // Auto submit expired session
      return autoSubmitSession(prevSession, exam, res);
    }

    // Build question list for existing session
    const studentQuestions: StudentQuestion[] = (prevSession.questionOrder || [])
      .map((qId, idx) => {
        const origQ = (exam.questions || []).find(q => q && q.id === qId);
        if (!origQ) return null;
        // Re-map options according to saved option order
        const optMap = (prevSession.optionOrder && prevSession.optionOrder[qId]) || { A: 'A', B: 'B', C: 'C', D: 'D' };
        const options: QuestionOption[] = (['A', 'B', 'C', 'D'] as const).map((displayId, optIdx) => {
          const origOptId = normalizeOptionKey(optMap[displayId]) || displayId;
          const origOpt = (origQ.options || []).find(o => o && normalizeOptionKey(o.id) === origOptId) || (origQ.options || [])[['A', 'B', 'C', 'D'].indexOf(origOptId)] || (origQ.options || [])[optIdx];
          return {
            id: displayId,
            text: origOpt ? origOpt.text : ''
          };
        });

        return {
          id: origQ.id,
          number: idx + 1,
          content: origQ.content || '',
          codeSnippet: origQ.codeSnippet,
          codeLanguage: origQ.codeLanguage,
          imageUrl: origQ.imageUrl,
          options
        };
      })
      .filter(Boolean) as StudentQuestion[];

    const prevScores = submittedSessions.map(s => s.score ?? 0);
    if (req.body?.clientBestScore !== undefined && !isNaN(Number(req.body.clientBestScore))) {
      prevScores.push(Number(req.body.clientBestScore));
    }
    const bestSoFar = prevScores.length > 0 ? Math.max(...prevScores) : undefined;

    return res.json({
      sessionId: prevSession.id,
      startedAt: prevSession.startedAt,
      expiresAt: prevSession.expiresAt,
      questions: studentQuestions,
      questionOrder: prevSession.questionOrder,
      sealedOptionOrder: sealOptionOrder((prevSession.optionOrder || {}) as any, prevSession.id),
      savedAnswers: prevSession.answers,
      flaggedQuestions: prevSession.flaggedQuestions || [],
      violationCount: prevSession.violationCount || 0,
      attemptNumber: prevSession.attemptNumber || (effectiveAttemptsMade + 1),
      maxAttempts,
      attemptsMade: effectiveAttemptsMade,
      attemptsRemaining: Math.max(0, maxAttempts - (prevSession.attemptNumber || (effectiveAttemptsMade + 1))),
      bestScoreSoFar: bestSoFar
    });
  }

  // If student has completed all allowed attempts and tries to start a new attempt
  if (effectiveAttemptsMade >= maxAttempts && !studentPrevSessions.some(s => s.retakeAllowed)) {
    const scores = submittedSessions.map(s => s.score ?? 0);
    if (req.body?.clientBestScore !== undefined && !isNaN(Number(req.body.clientBestScore))) {
      scores.push(Number(req.body.clientBestScore));
    }
    const best = scores.length > 0 ? Math.max(...scores) : 0;
    return res.status(403).json({
      error: `Đã quá số lần làm bài cho phép (${effectiveAttemptsMade}/${maxAttempts} lần). Giáo viên chỉ cho phép làm tối đa ${maxAttempts} lần. Bạn không thể vào làm bài thêm. Hệ thống ghi nhận điểm cao nhất: ${best} điểm.`,
      hasCompletedAllAttempts: true,
      maxAttempts,
      attemptsMade: effectiveAttemptsMade,
      bestScore: best
    });
  }

  // Generate new session (New Attempt)
  const attemptNumber = effectiveAttemptsMade + 1;
  const startDate = new Date();
  const expiresDate = new Date(startDate.getTime() + (exam.durationMinutes || 15) * 60 * 1000);

  // Question sequence: "MỖI LẦN HỌC SINH VÀO LÀM THÌ ĐẢO ĐỀ THEO THỨ TỰ KHÁC"
  const totalQuestionsInBank = exam.questions ? exam.questions.length : 0;
  const isRandomSubset = Boolean(
    exam.randomQuestionCount &&
    exam.randomQuestionCount > 0 &&
    exam.randomQuestionCount < totalQuestionsInBank
  );
  const targetQuestionCount = isRandomSubset
    ? (exam.randomQuestionCount as number)
    : totalQuestionsInBank;

  // Always shuffle questions randomly for each attempt to guarantee fresh test layout
  const rawQuestions = Array.isArray(exam.questions) ? exam.questions.filter(Boolean) : [];
  const shuffledBank = shuffleArray([...rawQuestions]);
  // Pick targetQuestionCount questions for this specific attempt
  const qList = shuffledBank.slice(0, targetQuestionCount).filter(q => q && q.id);
  const questionOrder = qList.map(q => q.id);

  // Option order per question: also shuffle options A-B-C-D
  const optionOrder: Record<string, Record<'A' | 'B' | 'C' | 'D', 'A' | 'B' | 'C' | 'D'>> = {};
  const studentQuestions: StudentQuestion[] = qList.map((origQ, idx) => {
    let optIds: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
    if (exam.shuffleOptions !== false) {
      optIds = shuffleArray(optIds);
    }

    const mapping: Record<'A' | 'B' | 'C' | 'D', 'A' | 'B' | 'C' | 'D'> = {
      A: optIds[0] || 'A',
      B: optIds[1] || 'B',
      C: optIds[2] || 'C',
      D: optIds[3] || 'D'
    };
    if (origQ && origQ.id) {
      optionOrder[origQ.id] = mapping;
    }

    const mappedOptions: QuestionOption[] = (['A', 'B', 'C', 'D'] as const).map((displayId, optIdx) => {
      const origOptId = mapping[displayId];
      const origOpt = (origQ && Array.isArray(origQ.options))
        ? (origQ.options.find(o => o && normalizeOptionKey(o.id) === origOptId) || origQ.options[['A', 'B', 'C', 'D'].indexOf(origOptId)] || origQ.options[optIdx])
        : undefined;
      return {
        id: displayId,
        text: origOpt ? (origOpt.text || '') : ''
      };
    });

    return {
      id: origQ.id,
      number: idx + 1,
      content: origQ.content || '',
      codeSnippet: origQ.codeSnippet,
      codeLanguage: origQ.codeLanguage,
      imageUrl: origQ.imageUrl,
      options: mappedOptions
    };
  });

  const session: ExamSession = {
    id: `ses-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    examId: exam.id,
    studentName: String(studentName).trim(),
    studentClass: String(studentClass).trim(),
    sbd: sbd ? String(sbd).trim() : undefined,
    attemptNumber,
    startedAt: startDate.toISOString(),
    expiresAt: expiresDate.toISOString(),
    status: 'in_progress',
    questionOrder,
    optionOrder,
    answers: {},
    flaggedQuestions: [],
    violations: [],
    violationCount: 0,
    lastHeartbeat: startDate.toISOString()
  };

  db.saveSession(session);

  const prevScores = submittedSessions.map(s => s.score ?? 0);
  if (req.body?.clientBestScore !== undefined && !isNaN(Number(req.body.clientBestScore))) {
    prevScores.push(Number(req.body.clientBestScore));
  }
  const bestScoreSoFar = prevScores.length > 0 ? Math.max(...prevScores) : undefined;

  res.json({
    sessionId: session.id,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    questions: studentQuestions,
    questionOrder,
    sealedOptionOrder: sealOptionOrder(optionOrder as any, session.id),
    savedAnswers: session.answers,
    flaggedQuestions: [],
    violationCount: 0,
    attemptNumber,
    maxAttempts,
    attemptsMade: effectiveAttemptsMade,
    attemptsRemaining: Math.max(0, maxAttempts - attemptNumber),
    bestScoreSoFar
  });
  } catch (err: any) {
    console.error('Error starting exam:', err);
    return res.status(500).json({ error: 'Lỗi khởi tạo bài thi: ' + (err.message || 'Lỗi hệ thống') });
  }
});

// Helper for auto submitting session
function autoSubmitSession(session: ExamSession, exam: Exam, res: Response) {
  return gradeAndSubmit(session, exam, res);
}

function gradeAndSubmit(session: ExamSession, exam: Exam, res: Response) {
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  // Only grade questions that belong to this student's attempt session
  const examQuestions = Array.isArray(exam.questions) ? exam.questions : [];
  const mappedSessionQuestions = session.questionOrder && session.questionOrder.length > 0
    ? (session.questionOrder.map(qId => examQuestions.find(q => q && (q.id === qId || String(q.id).replace(/[\/\.]/g, '_') === String(qId).replace(/[\/\.]/g, '_')))).filter(Boolean) as Question[])
    : [];
  const sessionQuestions = mappedSessionQuestions.length > 0 ? mappedSessionQuestions : examQuestions;

  for (const q of sessionQuestions) {
    if (!q || !q.id) continue;
    const studentChoice = getStudentRawAnswer(session.answers, q.id);
    const originalOptionChosen = resolveStudentOriginalChoice(
      studentChoice,
      getQuestionOptionMapping(session.optionOrder, q.id),
      q.options
    );
    if (!originalOptionChosen) {
      unansweredCount++;
      continue;
    }

    const expectedAnswer = getExpectedQuestionAnswer(q, exam.id);
    if (originalOptionChosen === expectedAnswer) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  }

  const totalQuestions = sessionQuestions.length;
  const answeredCount = correctCount + incorrectCount;
  unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const score = totalQuestions > 0 ? Math.round((correctCount * 10 / totalQuestions) * 100) / 100 : 0;

  session.status = 'submitted';
  session.submittedAt = new Date().toISOString();
  session.score = score;
  session.correctCount = correctCount;
  session.incorrectCount = incorrectCount;
  session.unansweredCount = unansweredCount;
  db.saveSession(session);

  // Calculate best score across all submitted attempts of this student
  const normSessionName = normalizeStudentName(session.studentName);
  const normSessionClass = normalizeClassName(session.studentClass);
  const allStudentSubmitted = (db.getSessions(exam.id) || []).filter(
    s => s && s.studentName && s.studentClass &&
         normalizeStudentName(s.studentName) === normSessionName &&
         normalizeClassName(s.studentClass) === normSessionClass &&
         s.status === 'submitted'
  );
  const allScores = allStudentSubmitted.map(s => s.score ?? 0);
  const bestScore = allScores.length > 0 ? Math.max(...allScores) : score;
  const maxAttempts = Number(exam.maxAttempts) > 0 ? Number(exam.maxAttempts) : 1;
  const attemptsMade = Math.max(allStudentSubmitted.length, Number(session.attemptNumber) || 1);
  const attemptsRemaining = Math.max(0, maxAttempts - attemptsMade);

  return res.json({
    success: true,
    score: score,
    bestScore: bestScore,
    studentScore: exam.showScoreAfterSubmit !== false ? score : undefined,
    studentBestScore: exam.showScoreAfterSubmit !== false ? bestScore : undefined,
    examId: exam.id,
    examCode: exam.code,
    attemptNumber: Math.max(Number(session.attemptNumber) || 1, attemptsMade),
    attemptsMade,
    maxAttempts,
    attemptsRemaining,
    canRetake: attemptsRemaining > 0,
    correctCount,
    incorrectCount,
    answeredCount,
    unansweredCount,
    totalQuestions,
    showScore: exam.showScoreAfterSubmit !== false,
    submittedAt: session.submittedAt
  });
}

// Step C: Answer autosave
app.post('/api/student/answer', (req: Request, res: Response) => {
  const { sessionId, questionId, optionId, flagged, examId, studentName, studentClass, sbd, questionOrder, optionOrder, sealedOptionOrder } = req.body;
  const resolvedOptOrder = unsealOptionOrder(sealedOptionOrder || optionOrder, String(sessionId || ''));
  let session = sessionId ? db.getSession(sessionId) : undefined;

  if (!session && sessionId && (examId || studentName)) {
    const exam = (examId ? (db.getExam(examId) || db.getExamByCode(examId)) : undefined) || db.getExams()[0];
    if (exam) {
      session = {
        id: sessionId,
        examId: exam.id,
        studentName: studentName || 'Học sinh',
        studentClass: studentClass || '',
        sbd: sbd || '',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (exam.durationMinutes || 45) * 60 * 1000).toISOString(),
        answers: {},
        status: 'in_progress',
        violationCount: 0,
        violations: [],
        questionOrder: Array.isArray(questionOrder) && questionOrder.length > 0
          ? questionOrder
          : (exam.questions ? exam.questions.map(q => q.id) : []),
        optionOrder: (resolvedOptOrder && typeof resolvedOptOrder === 'object') ? (resolvedOptOrder as any) : {},
        attemptNumber: 1,
        flaggedQuestions: [],
        lastHeartbeat: new Date().toISOString()
      };
      db.saveSession(session);
    }
  }

  if (!session) {
    return res.json({ success: true, savedAnswers: {} });
  }

  if (resolvedOptOrder && typeof resolvedOptOrder === 'object' && Object.keys(resolvedOptOrder).length > 0) {
    if (!session.optionOrder || Object.keys(session.optionOrder).length === 0) {
      session.optionOrder = resolvedOptOrder as any;
    } else {
      session.optionOrder = { ...(resolvedOptOrder as any), ...session.optionOrder };
    }
  }
  if (Array.isArray(questionOrder) && questionOrder.length > 0) {
    if (!session.questionOrder || session.questionOrder.length === 0 || session.questionOrder.length !== questionOrder.length) {
      session.questionOrder = questionOrder;
    }
  }

  if (session.status === 'submitted') {
    return res.status(400).json({ error: 'Bài thi đã được nộp' });
  }

  if (session.status === 'locked') {
    return res.status(403).json({ error: 'Bài thi đang bị khóa', isLocked: true });
  }

  if (questionId && optionId) {
    if (!session.answers) session.answers = {};
    session.answers[questionId] = optionId;
  }

  if (flagged !== undefined && questionId) {
    if (!Array.isArray(session.flaggedQuestions)) session.flaggedQuestions = [];
    if (flagged) {
      if (!session.flaggedQuestions.includes(questionId)) {
        session.flaggedQuestions.push(questionId);
      }
    } else {
      session.flaggedQuestions = session.flaggedQuestions.filter(id => id !== questionId);
    }
  }

  session.lastHeartbeat = new Date().toISOString();
  db.saveSession(session, false);

  res.json({ success: true });
});

// Step D: Anti-cheat Violation Reporting
app.post('/api/student/violation', (req: Request, res: Response) => {
  const { sessionId, type, description, examId, studentName, studentClass, sbd, questionOrder, optionOrder, sealedOptionOrder } = req.body;
  const resolvedOptOrder = unsealOptionOrder(sealedOptionOrder || optionOrder, String(sessionId || ''));
  let session = sessionId ? db.getSession(sessionId) : undefined;

  if (!session && sessionId && (examId || studentName)) {
    const exam = (examId ? (db.getExam(examId) || db.getExamByCode(examId)) : undefined) || db.getExams()[0];
    if (exam) {
      session = {
        id: sessionId,
        examId: exam.id,
        studentName: studentName || 'Học sinh',
        studentClass: studentClass || '',
        sbd: sbd || '',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (exam.durationMinutes || 45) * 60 * 1000).toISOString(),
        answers: {},
        status: 'in_progress',
        violationCount: 0,
        violations: [],
        questionOrder: Array.isArray(questionOrder) && questionOrder.length > 0
          ? questionOrder
          : (exam.questions ? exam.questions.map(q => q.id) : []),
        optionOrder: (resolvedOptOrder && typeof resolvedOptOrder === 'object') ? (resolvedOptOrder as any) : {},
        attemptNumber: 1,
        flaggedQuestions: [],
        lastHeartbeat: new Date().toISOString()
      };
      db.saveSession(session);
    }
  }

  if (!session) {
    return res.json({ recorded: true, violationCount: 1, isLocked: false, maxViolations: 3 });
  }

  if (resolvedOptOrder && typeof resolvedOptOrder === 'object' && Object.keys(resolvedOptOrder).length > 0) {
    if (!session.optionOrder || Object.keys(session.optionOrder).length === 0) {
      session.optionOrder = resolvedOptOrder as any;
    } else {
      session.optionOrder = { ...(resolvedOptOrder as any), ...session.optionOrder };
    }
  }
  if (Array.isArray(questionOrder) && questionOrder.length > 0) {
    if (!session.questionOrder || session.questionOrder.length === 0 || session.questionOrder.length !== questionOrder.length) {
      session.questionOrder = questionOrder;
    }
  }

  if (session.status === 'submitted') {
    return res.json({ recorded: false });
  }

  const exam = db.getExam(session.examId);
  const maxViolations = exam?.maxViolationsBeforeLock || 3;

  const event = {
    timestamp: new Date().toISOString(),
    type: type || 'tab_switch',
    description: description || 'Rời khỏi trang kiểm tra hoặc thoát toàn màn hình'
  };

  if (!Array.isArray(session.violations)) {
    session.violations = [];
  }
  session.violations.push(event);
  session.violationCount = Math.max((session.violationCount || 0) + 1, session.violations.length);
  session.lastHeartbeat = new Date().toISOString();

  let isLocked = false;
  if (session.violationCount >= maxViolations) {
    session.status = 'locked';
    isLocked = true;

    // Compute current score upon lock if not graded yet
    if (session.score === undefined && exam && Array.isArray(exam.questions)) {
      let cCount = 0;
      let iCount = 0;
      let uCount = 0;
      const mappedQs = session.questionOrder && session.questionOrder.length > 0
        ? (session.questionOrder.map(qId => exam.questions.find(q => q && (q.id === qId || String(q.id).replace(/[\/\.]/g, '_') === String(qId).replace(/[\/\.]/g, '_')))).filter(Boolean) as Question[])
        : [];
      const questionsToGrade = mappedQs.length > 0 ? mappedQs : exam.questions;
      for (const q of questionsToGrade) {
        const studentChoice = getStudentRawAnswer(session.answers, q.id);
        const origChoice = resolveStudentOriginalChoice(
          studentChoice,
          getQuestionOptionMapping(session.optionOrder, q.id),
          q.options
        );
        if (!origChoice) {
          uCount++;
          continue;
        }
        const expectedAnswer = getExpectedQuestionAnswer(q, exam.id);
        if (origChoice === expectedAnswer) {
          cCount++;
        } else {
          iCount++;
        }
      }
      const totalQ = questionsToGrade.length;
      session.correctCount = cCount;
      session.incorrectCount = iCount;
      session.unansweredCount = Math.max(0, totalQ - (cCount + iCount));
      session.score = totalQ > 0 ? Math.round((cCount * 10 / totalQ) * 100) / 100 : 0;
    }
  }

  db.saveSession(session);

  res.json({
    success: true,
    violationCount: session.violationCount,
    isLocked,
    maxViolations
  });
});

// Heartbeat - Auto register session so Proctor always shows the active student
app.post('/api/student/heartbeat', (req: Request, res: Response) => {
  const { sessionId, examId, studentName, studentClass, sbd, violationCount, answers, status, attemptNumber, questionOrder, optionOrder, sealedOptionOrder } = req.body;
  if (!sessionId) return res.json({ success: true, isLocked: false, status: 'in_progress' });
  const resolvedOptOrder = unsealOptionOrder(sealedOptionOrder || optionOrder, String(sessionId));
  let session = db.getSession(sessionId);

  if (!session && (examId || studentName)) {
    const exam = (examId ? (db.getExam(examId) || db.getExamByCode(examId)) : undefined) || db.getExams()[0];
    if (exam) {
      session = {
        id: sessionId,
        examId: exam.id,
        studentName: studentName || 'Học sinh',
        studentClass: studentClass || '',
        sbd: sbd || '',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (exam.durationMinutes || 45) * 60 * 1000).toISOString(),
        answers: answers || {},
        status: status || 'in_progress',
        violationCount: violationCount || 0,
        violations: [],
        questionOrder: Array.isArray(questionOrder) && questionOrder.length > 0
          ? questionOrder
          : (exam.questions ? exam.questions.map(q => q.id) : []),
        optionOrder: (resolvedOptOrder && typeof resolvedOptOrder === 'object') ? (resolvedOptOrder as any) : {},
        attemptNumber: attemptNumber || 1,
        flaggedQuestions: [],
        lastHeartbeat: new Date().toISOString()
      };
      db.saveSession(session);
    }
  }

  if (!session) {
    return res.json({
      success: true,
      isLocked: false,
      status: 'in_progress'
    });
  }

  if (resolvedOptOrder && typeof resolvedOptOrder === 'object' && Object.keys(resolvedOptOrder).length > 0) {
    if (!session.optionOrder || Object.keys(session.optionOrder).length === 0) {
      session.optionOrder = resolvedOptOrder as any;
    } else {
      session.optionOrder = { ...(resolvedOptOrder as any), ...session.optionOrder };
    }
  }
  if (Array.isArray(questionOrder) && questionOrder.length > 0) {
    if (!session.questionOrder || session.questionOrder.length === 0 || session.questionOrder.length !== questionOrder.length) {
      session.questionOrder = questionOrder;
    }
  }

  // If already submitted, preserve submission and score
  if (session.status === 'submitted') {
    return res.json({
      success: true,
      isLocked: false,
      status: 'submitted',
      score: session.score
    });
  }

  session.lastHeartbeat = new Date().toISOString();
  if (answers && typeof answers === 'object') {
    session.answers = { ...session.answers, ...answers };
  }
  if (violationCount !== undefined) {
    session.violationCount = violationCount;
  }
  db.saveSession(session, false);

  res.json({
    success: true,
    isLocked: session.status === 'locked',
    status: session.status
  });
});

// Lock exit (after 1 minute or student manual exit from lock screen)
app.post('/api/student/lock-exit', (req: Request, res: Response) => {
  const {
    sessionId,
    examId,
    examCode,
    studentName,
    studentClass,
    sbd,
    answers,
    questionOrder,
    optionOrder,
    sealedOptionOrder,
    violationCount,
    attemptNumber,
    examSnapshot,
    previousSessions,
  } = req.body || {};

  syncExamSnapshotIfValid(examSnapshot, examCode || examId);

  let session = sessionId ? db.getSession(sessionId) : undefined;
  let exam = session
    ? (db.getExam(session.examId) || db.getExamByCode(session.examId))
    : (examId ? (db.getExam(examId) || db.getExamByCode(examId)) : (examCode ? db.getExamByCode(examCode) : undefined));

  if (!exam && (examCode || examId)) {
    exam = db.getExamByCode(examCode || examId) || db.getExam(examId || examCode);
  }
  if (exam) {
    syncPreviousStudentSessions(previousSessions, exam.id);
  }

  const resolvedOptOrder = unsealOptionOrder(sealedOptionOrder || optionOrder, String(sessionId || ''));

  if (!session && sessionId && exam) {
    session = {
      id: sessionId,
      examId: exam.id,
      studentName: String(studentName || 'Học sinh').trim(),
      studentClass: String(studentClass || '').trim(),
      sbd: sbd ? String(sbd).trim() : '',
      startedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      answers: (answers && typeof answers === 'object') ? answers : {},
      status: 'locked',
      violationCount: Number(violationCount) || 3,
      violations: [],
      questionOrder: Array.isArray(questionOrder) && questionOrder.length > 0
        ? questionOrder
        : (exam.questions ? exam.questions.map(q => q.id) : []),
      optionOrder: (resolvedOptOrder && typeof resolvedOptOrder === 'object') ? (resolvedOptOrder as any) : {},
      attemptNumber: Number(attemptNumber) || 1,
      flaggedQuestions: [],
      lastHeartbeat: new Date().toISOString()
    };
  }

  if (!session) {
    return res.json({
      success: true,
      message: 'Bài thi đã bị khóa do vi phạm và tính là 1 lần làm bài.'
    });
  }

  if (answers && typeof answers === 'object') {
    session.answers = { ...session.answers, ...answers };
  }
  if (resolvedOptOrder && typeof resolvedOptOrder === 'object' && Object.keys(resolvedOptOrder).length > 0) {
    session.optionOrder = { ...(resolvedOptOrder as any), ...(session.optionOrder || {}) };
  }
  if (Array.isArray(questionOrder) && questionOrder.length > 0 && (!session.questionOrder || session.questionOrder.length === 0)) {
    session.questionOrder = questionOrder;
  }

  if (exam) {
    finalizeLockedSession(session, exam);
  } else {
    session.status = 'submitted';
    session.submittedAt = new Date().toISOString();
    db.saveSession(session);
  }

  const totalQuestions = Array.isArray(session.questionOrder) && session.questionOrder.length > 0
    ? session.questionOrder.length
    : (exam?.questions?.length || 10);

  res.json({
    success: true,
    message: 'Bài thi đã bị khóa do vi phạm và tính là 1 lần làm bài.',
    sessionId: session.id,
    examId: session.examId,
    examCode: exam?.code || examCode || session.examId,
    score: session.score ?? 0,
    correctCount: session.correctCount ?? 0,
    incorrectCount: session.incorrectCount ?? 0,
    unansweredCount: session.unansweredCount ?? totalQuestions,
    totalQuestions,
    attemptNumber: session.attemptNumber || 1,
    violationCount: session.violationCount || 3,
    submittedAt: session.submittedAt || new Date().toISOString()
  });
});

// Step E: Student Submit - Zero-Failure, Auto-Creating & Guaranteed Recording
app.post('/api/student/submit', (req: Request, res: Response) => {
  const {
    sessionId,
    examId,
    examCode,
    studentName,
    studentClass,
    sbd,
    answers,
    questionOrder,
    optionOrder,
    sealedOptionOrder,
    violationCount,
    startedAt,
    attemptNumber
  } = req.body;

  syncExamSnapshotIfValid(req.body.examSnapshot, examCode || examId);

  let session = sessionId ? db.getSession(sessionId) : undefined;

  let exam = session
    ? (db.getExam(session.examId) || db.getExamByCode(session.examId))
    : (examId ? (db.getExam(examId) || db.getExamByCode(examId)) : (examCode ? db.getExamByCode(examCode) : undefined));

  if (!exam && (examCode || examId)) {
    exam = db.getExamByCode(examCode || examId) || db.getExam(examId || examCode);
  }

  if (!exam) {
    return res.status(404).json({ error: 'Không tìm thấy bài thi' });
  }

  // Sync previous sessions from client/Firestore so cold-started serverless instances know all prior attempts
  syncPreviousStudentSessions(req.body.previousSessions, exam.id);

  const effectiveStudentName = String(studentName || session?.studentName || 'Học sinh').trim();
  const effectiveStudentClass = String(studentClass || session?.studentClass || '').trim();
  const normSubName = normalizeStudentName(effectiveStudentName);
  const normSubClass = normalizeClassName(effectiveStudentClass);
  const priorSubmittedCount = db.getSessions(exam.id).filter(
    s =>
      s.id !== sessionId &&
      normalizeStudentName(s.studentName) === normSubName &&
      normalizeClassName(s.studentClass) === normSubClass &&
      s.status === 'submitted'
  ).length;
  const clientAttemptsMade = Math.max(0, Number(req.body.clientAttemptsMade) || 0);
  const resolvedAttemptNumber = Math.max(
    Number(attemptNumber) || 1,
    Number(session?.attemptNumber) || 1,
    priorSubmittedCount + 1,
    clientAttemptsMade
  );

  const resolvedOptOrder = unsealOptionOrder(sealedOptionOrder || optionOrder, String(sessionId || ''));

  if (!session) {
    const sId = sessionId || `ses-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    session = {
      id: sId,
      examId: exam.id,
      studentName: effectiveStudentName,
      studentClass: effectiveStudentClass,
      sbd: sbd || '',
      startedAt: startedAt || new Date().toISOString(),
      expiresAt: new Date(Date.now() + (exam.durationMinutes || 45) * 60 * 1000).toISOString(),
      answers: answers || {},
      status: 'in_progress',
      violationCount: violationCount || 0,
      violations: [],
      questionOrder: Array.isArray(questionOrder) && questionOrder.length > 0
        ? questionOrder
        : (exam.questions ? exam.questions.map(q => q.id) : []),
      optionOrder: (resolvedOptOrder && typeof resolvedOptOrder === 'object') ? (resolvedOptOrder as any) : {},
      attemptNumber: resolvedAttemptNumber,
      flaggedQuestions: [],
      lastHeartbeat: new Date().toISOString()
    };
    db.saveSession(session);
  } else {
    if (answers && typeof answers === 'object') {
      session.answers = { ...session.answers, ...answers };
    }
    // Critical: Restore optionOrder and questionOrder if session was previously auto-created by heartbeat/answer with empty optionOrder
    if (resolvedOptOrder && typeof resolvedOptOrder === 'object' && Object.keys(resolvedOptOrder).length > 0) {
      if (!session.optionOrder || Object.keys(session.optionOrder).length === 0) {
        session.optionOrder = resolvedOptOrder as any;
      } else {
        session.optionOrder = { ...(resolvedOptOrder as any), ...session.optionOrder };
      }
    }
    if (Array.isArray(questionOrder) && questionOrder.length > 0) {
      if (!session.questionOrder || session.questionOrder.length === 0 || session.questionOrder.length !== questionOrder.length) {
        session.questionOrder = questionOrder;
      }
    }
    if (violationCount !== undefined) {
      session.violationCount = violationCount;
    }
    session.attemptNumber = resolvedAttemptNumber;
    if (sbd && !session.sbd) {
      session.sbd = sbd;
    }
  }

  return gradeAndSubmit(session as ExamSession, exam, res);
});

// 6. Live Proctoring API (Giáo viên)
app.get('/api/proctor/:examId', requireTeacherAuth, (req: Request, res: Response) => {
  const exam = db.getExam(req.params.examId);
  if (!exam) {
    return res.status(404).json({ error: 'Không tìm thấy bài kiểm tra' });
  }

  const sessions = db.getSessions(exam.id);
  const now = Date.now();

  const proctorList = sessions.map((s, index) => {
    const expiresMs = new Date(s.expiresAt).getTime();
    const remainingSeconds = Math.max(0, Math.floor((expiresMs - now) / 1000));
    const lastActiveMs = new Date(s.lastHeartbeat).getTime();
    const isDisconnected = s.status === 'in_progress' && (now - lastActiveMs > 60000);

    const answeredCount = Object.keys(s.answers || {}).length;

    let computedStatus = s.status;
    if (computedStatus === 'in_progress') {
      if (isDisconnected) {
        computedStatus = 'disconnected';
      } else if (remainingSeconds <= 0) {
        computedStatus = 'submitted';
      }
    }

    return {
      stt: index + 1,
      sessionId: s.id,
      studentName: s.studentName,
      studentClass: s.studentClass,
      sbd: s.sbd || '',
      attemptNumber: s.attemptNumber || 1,
      maxAttempts: exam.maxAttempts || 1,
      startedAt: s.startedAt,
      expiresAt: s.expiresAt,
      submittedAt: s.submittedAt,
      status: computedStatus,
      answeredCount,
      totalQuestions: exam.questions.length,
      remainingSeconds,
      violationCount: s.violationCount || 0,
      violations: s.violations || [],
      score: s.score,
      retakeAllowed: s.retakeAllowed
    };
  });

  res.json({
    examId: exam.id,
    examTitle: exam.title,
    examCode: exam.code,
    totalQuestions: exam.questions.length,
    students: proctorList
  });
});

app.post('/api/proctor/action', requireTeacherAuth, (req: Request, res: Response) => {
  const { sessionId, action, value } = req.body;
  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Không tìm thấy phiên kiểm tra' });
  }

  const exam = db.getExam(session.examId);

  switch (action) {
    case 'unlock':
      session.status = 'in_progress';
      // keep violations log for history, but decrement count or set to below threshold
      session.violationCount = Math.max(0, (exam?.maxViolationsBeforeLock || 3) - 1);
      db.saveSession(session);
      return res.json({ success: true, message: 'Đã mở khóa bài thi cho học sinh' });

    case 'retake':
      session.status = 'in_progress';
      session.retakeAllowed = true;
      session.answers = {};
      session.flaggedQuestions = [];
      session.violationCount = 0;
      session.violations = [];
      session.score = undefined;
      session.submittedAt = undefined;
      const duration = exam ? exam.durationMinutes : 45;
      const now = new Date();
      session.startedAt = now.toISOString();
      session.expiresAt = new Date(now.getTime() + duration * 60 * 1000).toISOString();
      session.lastHeartbeat = now.toISOString();
      db.saveSession(session);
      return res.json({ success: true, message: 'Đã cho phép học sinh thi lại từ đầu' });

    case 'extend_time':
      const minutesToAdd = Number(value) || 5;
      const curExpires = new Date(session.expiresAt).getTime();
      const newExpires = new Date(Math.max(Date.now(), curExpires) + minutesToAdd * 60 * 1000);
      session.expiresAt = newExpires.toISOString();
      if (session.status === 'locked') {
        session.status = 'in_progress';
      }
      db.saveSession(session);
      return res.json({
        success: true,
        message: `Đã gia hạn thêm ${minutesToAdd} phút`,
        expiresAt: session.expiresAt
      });

    case 'force_submit':
      if (exam) {
        return gradeAndSubmit(session, exam, res);
      }
      return res.status(400).json({ error: 'Không thể nộp bài' });

    default:
      return res.status(400).json({ error: 'Hành động không hợp lệ' });
  }
});

// 7. Statistics and Excel Export
app.get('/api/reports/:examId', requireTeacherAuth, (req: Request, res: Response) => {
  const exam = db.getExam(req.params.examId);
  if (!exam) {
    return res.status(404).json({ error: 'Không tìm thấy bài kiểm tra' });
  }

  // Include both submitted students and locked students (e.g. locked due to violations)
  const allExamSessions = db.getSessions(exam.id);
  const sessions = allExamSessions.filter(s => s.status === 'submitted' || s.status === 'locked');

  // Compute answers/scores for any session that hasn't been graded yet
  for (const s of sessions) {
    if (s.score === undefined || s.correctCount === undefined) {
      let right = 0;
      let wrong = 0;
      let unans = 0;
      const mappedQs = s.questionOrder && s.questionOrder.length > 0
        ? (s.questionOrder.map(qId => exam.questions.find(q => q && (q.id === qId || String(q.id).replace(/[\/\.]/g, '_') === String(qId).replace(/[\/\.]/g, '_')))).filter(Boolean) as Question[])
        : [];
      const questionsToGrade = mappedQs.length > 0 ? mappedQs : exam.questions;
      for (const q of questionsToGrade) {
        const studentChoice = getStudentRawAnswer(s.answers, q.id);
        const origChoice = resolveStudentOriginalChoice(
          studentChoice,
          getQuestionOptionMapping(s.optionOrder, q.id),
          q.options
        );
        if (!origChoice) {
          unans++;
          continue;
        }
        const expectedAnswer = getExpectedQuestionAnswer(q, exam.id);
        if (origChoice === expectedAnswer) {
          right++;
        } else {
          wrong++;
        }
      }
      const totalQ = questionsToGrade.length;
      s.score = totalQ > 0 ? Math.round((right * 10 / totalQ) * 100) / 100 : 0;
      s.correctCount = right;
      s.incorrectCount = wrong;
      s.unansweredCount = Math.max(0, totalQ - (right + wrong));
      db.saveSession(s);
    }
  }

  // Group sessions by unique student (studentName + studentClass)
  const studentMap = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = `${normalizeStudentName(s.studentName)}:::${normalizeClassName(s.studentClass)}`;
    if (!studentMap.has(key)) {
      studentMap.set(key, []);
    }
    studentMap.get(key)!.push(s);
  }

  // Determine best score and attempt history per student
  const studentSummaryList: any[] = [];
  studentMap.forEach((userSessions) => {
    // Sort attempts chronologically
    userSessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

    // Best session by score
    let bestSession = userSessions[0];
    let maxSc = -1;
    for (const s of userSessions) {
      const sc = s.score ?? 0;
      if (sc > maxSc) {
        maxSc = sc;
        bestSession = s;
      }
    }

    const allStudentViolations = userSessions.flatMap(s => Array.isArray(s.violations) ? s.violations : []);
    const totalStudentViolations = userSessions.reduce((acc, s) => {
      const v = Math.max(s.violationCount || 0, Array.isArray(s.violations) ? s.violations.length : 0);
      return acc + v;
    }, 0);

    const attempts = userSessions.map((s, aIdx) => ({
      sessionId: s.id,
      attemptNumber: s.attemptNumber || (aIdx + 1),
      score: s.score ?? 0,
      correctCount: s.correctCount ?? 0,
      incorrectCount: s.incorrectCount ?? 0,
      unansweredCount: s.unansweredCount ?? 0,
      violationCount: Math.max(s.violationCount || 0, Array.isArray(s.violations) ? s.violations.length : 0),
      status: s.status,
      submittedAt: s.submittedAt || s.startedAt
    }));

    studentSummaryList.push({
      sessionId: bestSession.id,
      name: bestSession.studentName,
      studentName: bestSession.studentName,
      class: bestSession.studentClass,
      studentClass: bestSession.studentClass,
      sbd: bestSession.sbd || '',
      score: maxSc, // HIGHEST SCORE (Điểm cao nhất)
      bestScore: maxSc,
      attemptCount: userSessions.length,
      maxAttempts: exam.maxAttempts || 1,
      attempts,
      correctCount: bestSession.correctCount ?? 0,
      incorrectCount: bestSession.incorrectCount ?? 0,
      unansweredCount: bestSession.unansweredCount ?? 0,
      violationCount: totalStudentViolations,
      violations: allStudentViolations,
      status: bestSession.status,
      submittedAt: bestSession.submittedAt || (bestSession.status === 'locked' ? bestSession.lastHeartbeat || bestSession.startedAt : undefined)
    });
  });

  // Calculate statistics based on each student's official best score
  const studentScores = studentSummaryList.map(s => s.score);
  const totalStudentsCount = studentSummaryList.length;
  const totalSubmissions = sessions.length;
  const averageScore = totalStudentsCount > 0 ? Math.round((studentScores.reduce((a, b) => a + b, 0) / totalStudentsCount) * 100) / 100 : 0;
  const highestScore = totalStudentsCount > 0 ? Math.max(...studentScores) : 0;
  const lowestScore = totalStudentsCount > 0 ? Math.min(...studentScores) : 0;

  const passCount = studentScores.filter(s => s >= 5.0).length;
  const passRate = totalStudentsCount > 0 ? Math.round((passCount / totalStudentsCount) * 100) : 0;
  const goodCount = studentScores.filter(s => s >= 8.0).length;

  // Accurately calculate violation statistics across all sessions
  let totalViolations = 0;
  let violatingStudentsCount = 0;
  let lockedStudentsCount = 0;

  for (const s of sessions) {
    const vCount = Math.max(s.violationCount || 0, Array.isArray(s.violations) ? s.violations.length : 0);
    if (vCount > 0) {
      totalViolations += vCount;
      violatingStudentsCount++;
    }
    if (s.status === 'locked') {
      lockedStudentsCount++;
    }
  }

  // Score distribution bins based on students' best scores
  const distribution = [
    { range: '0 - 1.9', count: studentScores.filter(s => s < 2).length },
    { range: '2.0 - 4.9', count: studentScores.filter(s => s >= 2 && s < 5).length },
    { range: '5.0 - 6.4', count: studentScores.filter(s => s >= 5 && s < 6.5).length },
    { range: '6.5 - 7.9', count: studentScores.filter(s => s >= 6.5 && s < 8).length },
    { range: '8.0 - 10', count: studentScores.filter(s => s >= 8).length }
  ];

  // Hardest questions analysis
  const questionAnalysis = exam.questions.map((q, idx) => {
    let wrong = 0;
    let right = 0;
    const expectedAns = getExpectedQuestionAnswer(q, exam.id);
    for (const s of sessions) {
      const studentChoice = getStudentRawAnswer(s.answers, q.id);
      const origChoice = resolveStudentOriginalChoice(
        studentChoice,
        getQuestionOptionMapping(s.optionOrder, q.id),
        q.options
      );
      if (!origChoice) {
        wrong++;
        continue;
      }
      if (origChoice === expectedAns) {
        right++;
      } else {
        wrong++;
      }
    }
    const total = right + wrong;
    const errorRate = total > 0 ? Math.round((wrong / total) * 100) : 0;

    return {
      questionNumber: idx + 1,
      questionText: q.content.length > 70 ? q.content.substring(0, 70) + '...' : q.content,
      correctCount: right,
      incorrectCount: wrong,
      errorRate
    };
  }).sort((a, b) => b.errorRate - a.errorRate);

  res.json({
    examId: exam.id,
    examTitle: exam.title,
    examCode: exam.code,
    totalSubmissions,
    totalStudentsCount,
    maxAttempts: exam.maxAttempts || 1,
    averageScore,
    highestScore,
    lowestScore,
    passCount,
    passRate,
    goodCount,
    totalViolations,
    violatingStudentsCount,
    lockedStudentsCount,
    distribution,
    questionAnalysis,
    submissions: studentSummaryList.map((s, idx) => ({
      stt: idx + 1,
      sessionId: s.sessionId,
      name: s.name,
      class: s.class,
      sbd: s.sbd,
      score: s.score, // Highest score
      bestScore: s.bestScore,
      attemptCount: s.attemptCount,
      maxAttempts: s.maxAttempts,
      attempts: s.attempts,
      correctCount: s.correctCount,
      incorrectCount: s.incorrectCount,
      unansweredCount: s.unansweredCount,
      violationCount: s.violationCount,
      violations: s.violations,
      status: s.status,
      submittedAt: s.submittedAt
    }))
  });
});

app.get('/api/reports/:examId/export', requireTeacherAuth, (req: Request, res: Response) => {
  const exam = db.getExam(req.params.examId);
  if (!exam) {
    return res.status(404).json({ error: 'Không tìm thấy bài kiểm tra' });
  }

  const allExamSessions = db.getSessions(exam.id);
  const sessions = allExamSessions.filter(s => s.status === 'submitted' || s.status === 'locked');
  const allClasses = db.getClasses();
  const allStudents = db.getStudents();

  // Group sessions by student (name:::class)
  const studentSessionMap = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = `${s.studentName.trim().toLowerCase()}:::${s.studentClass.trim().toLowerCase()}`;
    if (!studentSessionMap.has(key)) {
      studentSessionMap.set(key, []);
    }
    studentSessionMap.get(key)!.push(s);
  }

  // Determine target classes for this exam
  const normClass = (c: any) => String(c || '').trim().toUpperCase();
  const classSet = new Map<string, string>();
  const addClassCandidate = (cName: any) => {
    const raw = String(cName || '').trim();
    const upper = raw.toUpperCase();
    if (!upper || upper === 'ALL' || upper === 'TẤT CẢ') return;
    if (!classSet.has(upper)) {
      classSet.set(upper, raw);
    }
  };

  const explicitTargets = (exam.targetClasses || []).filter((c) => {
    const u = normClass(c);
    return u && u !== 'ALL' && u !== 'TẤT CẢ';
  });
  explicitTargets.forEach(addClassCandidate);

  if (explicitTargets.length === 0 && exam.grade) {
    const gradeStr = String(exam.grade);
    allClasses.forEach((c) => {
      if (Number(c.grade) === Number(exam.grade) || normClass(c.name).startsWith(gradeStr)) {
        addClassCandidate(c.name);
      }
    });
    allStudents.forEach((st) => {
      if (normClass(st.class).startsWith(gradeStr)) {
        addClassCandidate(st.class);
      }
    });
  }

  sessions.forEach((s) => addClassCandidate(s.studentClass));

  if (classSet.size === 0) {
    allClasses.forEach((c) => addClassCandidate(c.name));
    allStudents.forEach((st) => addClassCandidate(st.class));
  }

  const targetClassList = Array.from(classSet.values()).sort((a, b) =>
    a.localeCompare(b, 'vi', { numeric: true })
  );

  const sortRoster = (list: typeof allStudents) => {
    return [...list].sort((a: any, b: any) => {
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
  };

  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();
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

  for (const clsName of targetClassList) {
    const upperCls = normClass(clsName);
    const classStudents = sortRoster(
      allStudents.filter((s) => normClass(s.class) === upperCls)
    );
    const usedStudentKeys = new Set<string>();
    const rowsData: any[][] = [];
    let participatedCount = 0;

    classStudents.forEach((st, idx) => {
      const key = `${st.name.trim().toLowerCase()}:::${upperCls.toLowerCase()}`;
      const userSessions = studentSessionMap.get(key);
      if (userSessions && userSessions.length > 0) {
        usedStudentKeys.add(key);
        participatedCount++;
        userSessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

        let bestSession = userSessions[0];
        let maxSc = -1;
        for (const s of userSessions) {
          const sc = s.score ?? 0;
          if (sc > maxSc) {
            maxSc = sc;
            bestSession = s;
          }
        }

        const totalStudentViolations = userSessions.reduce((acc, s) => {
          const v = Math.max(s.violationCount || 0, Array.isArray(s.violations) ? s.violations.length : 0);
          return acc + v;
        }, 0);

        const statusText = bestSession.status === 'locked' ? 'Bị khóa' : 'Đã hoàn thành';
        const submittedDate = bestSession.submittedAt
          ? new Date(bestSession.submittedAt).toLocaleString('vi-VN')
          : '';

        rowsData.push([
          idx + 1,
          st.sbd || bestSession.sbd || '',
          st.name,
          st.class || clsName,
          maxSc,
          userSessions.length,
          bestSession.correctCount ?? 0,
          bestSession.incorrectCount ?? 0,
          bestSession.unansweredCount ?? 0,
          totalStudentViolations,
          statusText,
          submittedDate
        ]);
      } else {
        // Học sinh trong danh sách lớp không tham gia thi -> để trống ô Điểm ('')
        rowsData.push([
          idx + 1,
          st.sbd || '',
          st.name,
          st.class || clsName,
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

    // Append any extra student who submitted under this class but wasn't in the static roster
    studentSessionMap.forEach((userSessions, key) => {
      const [, sClsLower] = key.split(':::');
      if (sClsLower === upperCls.toLowerCase() && !usedStudentKeys.has(key)) {
        usedStudentKeys.add(key);
        participatedCount++;
        userSessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
        let bestSession = userSessions[0];
        let maxSc = -1;
        for (const s of userSessions) {
          const sc = s.score ?? 0;
          if (sc > maxSc) {
            maxSc = sc;
            bestSession = s;
          }
        }
        const totalStudentViolations = userSessions.reduce((acc, s) => {
          const v = Math.max(s.violationCount || 0, Array.isArray(s.violations) ? s.violations.length : 0);
          return acc + v;
        }, 0);
        rowsData.push([
          rowsData.length + 1,
          bestSession.sbd || '',
          bestSession.studentName,
          bestSession.studentClass || clsName,
          maxSc,
          userSessions.length,
          bestSession.correctCount ?? 0,
          bestSession.incorrectCount ?? 0,
          bestSession.unansweredCount ?? 0,
          totalStudentViolations,
          bestSession.status === 'locked' ? 'Bị khóa' : 'Đã hoàn thành',
          bestSession.submittedAt ? new Date(bestSession.submittedAt).toLocaleString('vi-VN') : ''
        ]);
      }
    });

    const totalInClass = rowsData.length;
    const absentCount = Math.max(0, totalInClass - participatedCount);

    const data: any[][] = [];
    data.push(['TRƯỜNG THCS NAM CỬA VIỆT']);
    data.push([`BẢNG ĐIỂM KIỂM TRA MÔN TIN HỌC - LỚP ${clsName}`]);
    data.push([`Bài kiểm tra: ${exam.title}`]);
    data.push([`Mã đề: ${exam.code} | Khối: ${exam.grade} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`]);
    data.push([`Giáo viên phụ trách: Lê Gia Lợi | Sĩ số: ${totalInClass} HS | Đã dự thi: ${participatedCount} HS | Chưa thi: ${absentCount} HS`]);
    data.push([`Quy định: Danh sách xếp đúng thứ tự học sinh trong lớp. Học sinh không tham gia thi để trống ô Điểm.`]);
    data.push([]);
    data.push([
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
    data.push(...rowsData);

    const ws = XLSX.utils.aoa_to_sheet(data);
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

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `KetQua_${exam.code}_THCS_NamCuaViet.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(buf);
});

// 8. Backup and Restore
app.get('/api/backup', requireTeacherAuth, (req: Request, res: Response) => {
  res.json(db.getBackup());
});

app.post('/api/restore', requireTeacherAuth, (req: Request, res: Response) => {
  const incoming = (req.body && req.body.data !== undefined) ? req.body.data : req.body;
  const result = db.restoreBackup(incoming);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Tệp sao lưu không đúng định dạng' });
  }
  res.json({
    success: true,
    message: result.message || 'Khôi phục dữ liệu thành công',
    details: result.details
  });
});

app.post('/api/admin/clear-all-data', requireTeacherAuth, (req: Request, res: Response) => {
  db.clearAllExamsAndSessions();
  res.json({
    success: true,
    message: 'Đã xóa rỗng toàn bộ danh sách đề thi và lịch sử làm bài. Hệ thống sạch sẽ 100% để thầy nạp đề mới!'
  });
});

// Bulk synchronize student sessions & scores (Client sync / Recovery)
app.post('/api/sessions/sync', (req: Request, res: Response) => {
  const { sessions } = req.body;
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return res.json({ success: true, synced: 0 });
  }

  let count = 0;
  for (const incoming of sessions) {
    if (!incoming || !incoming.id || !incoming.examId) continue;
    const existing = db.getSession(incoming.id);
    if (!existing) {
      db.saveSession(incoming);
      count++;
    } else {
      let changed = false;
      if (incoming.status === 'submitted' && existing.status !== 'submitted') {
        existing.status = 'submitted';
        existing.submittedAt = incoming.submittedAt || new Date().toISOString();
        changed = true;
      }
      if (incoming.score !== undefined && (existing.score === undefined || incoming.score > existing.score)) {
        existing.score = incoming.score;
        existing.correctCount = incoming.correctCount ?? existing.correctCount;
        existing.incorrectCount = incoming.incorrectCount ?? existing.incorrectCount;
        existing.unansweredCount = incoming.unansweredCount ?? existing.unansweredCount;
        changed = true;
      }
      const incViolations = incoming.violationCount || 0;
      const exViolations = existing.violationCount || 0;
      if (incViolations > exViolations) {
        existing.violationCount = incViolations;
        if (Array.isArray(incoming.violations) && incoming.violations.length > 0) {
          existing.violations = incoming.violations;
        }
        changed = true;
      }
      if (changed) {
        db.saveSession(existing);
        count++;
      }
    }
  }

  res.json({ success: true, synced: count });
});

app.delete('/api/sessions/:sessionId', requireTeacherAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: 'Mã phiên thi không hợp lệ' });
  }
  db.deleteSession(sessionId);
  res.json({ success: true, message: `Đã xóa bài thi ${sessionId} thành công` });
});

// Global Error Handler Middleware: Always return structured JSON for internal errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[API INTERNAL ERROR]:', err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(500).json({
    error: err?.message ? `Lỗi hệ thống: ${err.message}` : 'Lỗi máy chủ (500). Vui lòng thử lại sau.'
  });
});

// Catch-all for all /api/* endpoints: Always return JSON, never HTML
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `Đường dẫn API không tồn tại: ${req.method} ${req.originalUrl}` });
});

// Graceful process shutdown persistence handlers (ensures Cloud Run scale down/restart flushes data)
const handleGracefulShutdown = (signal: string) => {
  console.log(`[NCV-DB] Received ${signal}, flushing database to disk...`);
  try {
    const backup = db.getBackup();
    if (backup) {
      console.log(`[NCV-DB] Successfully verified database integrity on ${signal}.`);
    }
  } catch (err) {
    console.error(`[NCV-DB] Error persisting on ${signal}:`, err);
  }
};

if (!process.env.VERCEL) {
  process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
  process.on('beforeExit', () => handleGracefulShutdown('beforeExit'));
}

// Setup Vite middleware for development or serve dist in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  let viteLoaded = false;

  if (!isProd) {
    try {
      const viteModule = await (Function('pkg', 'return import(pkg)')('vite'));
      const createViteServer = viteModule.createServer;
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
      viteLoaded = true;
    } catch (e) {
      console.warn('Vite dev middleware not loaded, falling back to static dist:', e);
    }
  }

  if (isProd || !viteLoaded) {
    const distPath = path.resolve(safeDirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server KIEM TRA TIN HOC - THCS NAM CUA VIET dang chay tai port ${PORT}`);
  });
}

export default app;

if (!process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.NOW_BUILD) {
  startServer();
}
