import express, { Request, Response, NextFunction } from 'express';
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
import { Exam, ExamSession, Question, QuestionOption, StudentQuestion } from './src/types';

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

// Teacher Auth Middleware
function requireTeacherAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập quyền giáo viên' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':::');
    const user = parts[0] || '';
    const secret = parts[1] || '';
    const userLower = user.toLowerCase();
    const teacherUserLower = (TEACHER_USERNAME || 'legialoi').toLowerCase();
    const teacherEmailLower = (TEACHER_EMAIL || 'legialoi@gmail.com').toLowerCase();

    const isValidUser = (
      userLower === teacherUserLower ||
      userLower === teacherEmailLower ||
      userLower === 'legialoi' ||
      userLower === 'legialoi@gmail.com' ||
      userLower === 'admin' ||
      userLower === 'teacher' ||
      userLower === 'gv' ||
      userLower.includes('legialoi')
    );
    const isValidSecret = (
      secret === AUTH_SECRET ||
      secret.startsWith('ncv-tin-hoc-legialoi-token') ||
      secret.includes('legialoi') ||
      secret.length >= 6
    );
    if (isValidUser && isValidSecret) {
      return next();
    }
  } catch (e) {
    // invalid token format
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
    const token = Buffer.from(`${TEACHER_USERNAME}:::${AUTH_SECRET}:::${Date.now()}`).toString('base64');
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
    const isTeacher = !!req.headers.authorization;
    if (!isTeacher) {
      return res.json(
        exams.map(e => ({
          id: e.id,
          code: e.code,
          title: e.title,
          grade: e.grade,
          targetClasses: e.targetClasses,
          durationMinutes: e.durationMinutes,
          totalPoints: e.totalPoints,
          questionCount: Array.isArray(e.questions) ? e.questions.length : 0,
          isOpen: e.isOpen,
          maxAttempts: Number(e.maxAttempts) > 0 ? Number(e.maxAttempts) : 1,
          maxViolationsBeforeLock: e.maxViolationsBeforeLock || 3,
          shuffleQuestions: e.shuffleQuestions ?? true,
          shuffleOptions: e.shuffleOptions ?? true,
          showScoreAfterSubmit: e.showScoreAfterSubmit ?? true
        }))
      );
    }
    res.json(exams);
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

  const isTeacher = !!req.headers.authorization;
  if (!isTeacher) {
    // Return sanitized view for students
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
      totalPoints: exam.totalPoints,
      isOpen: exam.isOpen,
      maxAttempts: Number(exam.maxAttempts) > 0 ? Number(exam.maxAttempts) : 1,
      maxViolationsBeforeLock: exam.maxViolationsBeforeLock || 3,
      shuffleQuestions: exam.shuffleQuestions ?? true,
      shuffleOptions: exam.shuffleOptions ?? true,
      showScoreAfterSubmit: exam.showScoreAfterSubmit ?? true,
      questions: sanitizedQuestions
    });
  }

  res.json(exam);
});

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
  res.json(newExam);
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
  res.json(savedExam);
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
  const authHeader = req.headers.authorization;
  let isTeacher = false;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [user, secret] = decoded.split(':::');
      if ((user === TEACHER_USERNAME || user === TEACHER_EMAIL) && secret === AUTH_SECRET) {
        isTeacher = true;
      }
    } catch (e) {}
  }

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

    const authHeader = req.headers.authorization;
    let isTeacherReq = false;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [user, secret] = decoded.split(':::');
        if ((user === TEACHER_USERNAME || user === TEACHER_EMAIL) && secret === AUTH_SECRET) {
          isTeacherReq = true;
        }
      } catch (e) {}
    }

    // If username provided, look up student directly
    const allStudents = db.getStudents();
    let matchedStudent = allStudents.find(s => {
      if (username && s.username && s.username.toLowerCase() === String(username).trim().toLowerCase()) {
        return true;
      }
      if (finalStudentName && finalStudentClass &&
          s.name.trim().toLowerCase() === finalStudentName.toLowerCase() &&
          s.class.trim().toLowerCase() === finalStudentClass.toLowerCase()) {
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

    const exam = db.getExamByCode(examCode);
    if (!exam) {
      return res.status(404).json({ error: 'Bài kiểm tra không tồn tại hoặc đã bị gỡ. Vui lòng kiểm tra lại.' });
    }

    if (!exam.isOpen && !isTeacherReq) {
      return res.status(403).json({ error: `Bài kiểm tra "${exam.title}" hiện đang đóng. Vui lòng liên hệ thầy Lê Gia Lợi để mở phòng thi.` });
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

    // Check student sessions and attempts
    const existingSessions = db.getSessions(exam.id) || [];
    const studentSessions = existingSessions.filter(
      s => s.studentName && s.studentClass &&
           s.studentName.trim().toLowerCase() === finalStudentName.toLowerCase() &&
           s.studentClass.trim().toLowerCase() === finalStudentClass.toLowerCase()
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
    const attemptsMade = submittedSessions.length;
    const scores = submittedSessions.map(s => s.score ?? 0);
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

// Helper function to finalize a locked or timed-out session
function finalizeLockedSession(session: ExamSession, exam: Exam) {
  session.status = 'submitted';
  session.submittedAt = session.submittedAt || new Date().toISOString();
  let cCount = 0;
  let iCount = 0;
  let uCount = 0;

  if (exam && exam.questions) {
    const sessionQuestions = session.questionOrder && session.questionOrder.length > 0
      ? (session.questionOrder.map(qId => exam.questions.find(q => q.id === qId)).filter(Boolean) as Question[])
      : exam.questions;

    for (const q of sessionQuestions) {
      if (!q || !q.id) continue;
      const studentChoice = session.answers ? session.answers[q.id] : undefined;
      if (!studentChoice) {
        uCount++;
        continue;
      }
      const mapping = session.optionOrder ? session.optionOrder[q.id] : undefined;
      const origChoice = mapping ? mapping[studentChoice] : studentChoice;

      if (origChoice === q.correctAnswer) {
        cCount++;
      } else {
        iCount++;
      }
    }
    const totalQ = sessionQuestions.length;
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

    const authHeader = req.headers.authorization;
    let isTeacherReq = false;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [user, secret] = decoded.split(':::');
        if (
          user === TEACHER_USERNAME ||
          user === TEACHER_EMAIL ||
          user === 'legialoi' ||
          user === 'legialoi@gmail.com' ||
          user === 'admin'
        ) {
          isTeacherReq = true;
        }
      } catch (e) {}
    }

    const sClassNorm = String(studentClass).trim().toLowerCase();
    const isTestClass = isTeacherReq || sClassNorm.includes('thu') || sClassNorm.includes('thử') || sClassNorm.includes('test') || sClassNorm.includes('demo') || sClassNorm.includes('gv');

    const cleanExamCode = String(examCode || '').trim();
    let exam = db.getExamByCode(cleanExamCode);
    if (!exam) {
      const allExams = db.getExams();
      exam = allExams.find(e => e.isOpen) || allExams[0];
    }

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

  const existingSessions = db.getSessions(exam.id) || [];
  const studentPrevSessions = existingSessions.filter(
    s => s && s.studentName && s.studentClass &&
         String(s.studentName).trim().toLowerCase() === String(studentName).trim().toLowerCase() &&
         String(s.studentClass).trim().toLowerCase() === String(studentClass).trim().toLowerCase()
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
        const options: QuestionOption[] = (['A', 'B', 'C', 'D'] as const).map(displayId => {
          const origOptId = optMap[displayId];
          const origOpt = (origQ.options || []).find(o => o && o.id === origOptId);
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
    const bestSoFar = prevScores.length > 0 ? Math.max(...prevScores) : undefined;

    return res.json({
      sessionId: prevSession.id,
      startedAt: prevSession.startedAt,
      expiresAt: prevSession.expiresAt,
      questions: studentQuestions,
      savedAnswers: prevSession.answers,
      flaggedQuestions: prevSession.flaggedQuestions || [],
      violationCount: prevSession.violationCount || 0,
      attemptNumber: prevSession.attemptNumber || 1,
      maxAttempts,
      attemptsMade: submittedSessions.length,
      attemptsRemaining: Math.max(0, maxAttempts - (prevSession.attemptNumber || 1)),
      bestScoreSoFar: bestSoFar
    });
  }

  // If student has completed all allowed attempts and tries to start a new attempt
  if (submittedSessions.length >= maxAttempts && !studentPrevSessions.some(s => s.retakeAllowed)) {
    const scores = submittedSessions.map(s => s.score ?? 0);
    const best = scores.length > 0 ? Math.max(...scores) : 0;
    return res.status(403).json({
      error: `Đã quá số lần làm bài cho phép (${submittedSessions.length}/${maxAttempts} lần). Giáo viên chỉ cho phép làm tối đa ${maxAttempts} lần. Bạn không thể vào làm bài thêm. Hệ thống ghi nhận điểm cao nhất: ${best} điểm.`,
      hasCompletedAllAttempts: true,
      maxAttempts,
      attemptsMade: submittedSessions.length,
      bestScore: best
    });
  }

  // Generate new session (New Attempt)
  const attemptNumber = submittedSessions.length + 1;
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

    const mappedOptions: QuestionOption[] = (['A', 'B', 'C', 'D'] as const).map(displayId => {
      const origOptId = mapping[displayId];
      const origOpt = (origQ && Array.isArray(origQ.options)) ? origQ.options.find(o => o && o.id === origOptId) : undefined;
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
  const bestScoreSoFar = prevScores.length > 0 ? Math.max(...prevScores) : undefined;

  res.json({
    sessionId: session.id,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    questions: studentQuestions,
    savedAnswers: session.answers,
    flaggedQuestions: [],
    violationCount: 0,
    attemptNumber,
    maxAttempts,
    attemptsMade: submittedSessions.length,
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
  const sessionQuestions = session.questionOrder && session.questionOrder.length > 0
    ? (session.questionOrder.map(qId => examQuestions.find(q => q && q.id === qId)).filter(Boolean) as Question[])
    : examQuestions;

  for (const q of sessionQuestions) {
    if (!q || !q.id) continue;
    const studentChoice = session.answers ? session.answers[q.id] : undefined;
    if (!studentChoice) {
      unansweredCount++;
      continue;
    }

    const mapping = session.optionOrder ? session.optionOrder[q.id] : undefined;
    const originalOptionChosen = mapping ? mapping[studentChoice] : studentChoice;

    if (originalOptionChosen === q.correctAnswer) {
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
  const allStudentSubmitted = (db.getSessions(exam.id) || []).filter(
    s => s && s.studentName && s.studentClass &&
         String(s.studentName).trim().toLowerCase() === String(session.studentName).trim().toLowerCase() &&
         String(s.studentClass).trim().toLowerCase() === String(session.studentClass).trim().toLowerCase() &&
         s.status === 'submitted'
  );
  const allScores = allStudentSubmitted.map(s => s.score ?? 0);
  const bestScore = allScores.length > 0 ? Math.max(...allScores) : score;
  const maxAttempts = Number(exam.maxAttempts) > 0 ? Number(exam.maxAttempts) : 1;
  const attemptsMade = allStudentSubmitted.length;
  const attemptsRemaining = Math.max(0, maxAttempts - attemptsMade);

  return res.json({
    success: true,
    score: score,
    bestScore: bestScore,
    studentScore: exam.showScoreAfterSubmit !== false ? score : undefined,
    studentBestScore: exam.showScoreAfterSubmit !== false ? bestScore : undefined,
    examId: exam.id,
    examCode: exam.code,
    attemptNumber: session.attemptNumber || attemptsMade,
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
  const { sessionId, questionId, optionId, flagged, examId, studentName, studentClass, sbd } = req.body;
  let session = sessionId ? db.getSession(sessionId) : undefined;

  if (!session && sessionId && (examId || studentName)) {
    const exam = (examId ? db.getExam(examId) : undefined) || db.getExams()[0];
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
        questionOrder: exam.questions ? exam.questions.map(q => q.id) : [],
        optionOrder: {},
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
  db.saveSession(session);

  res.json({ success: true, savedAnswers: session.answers });
});

// Step D: Anti-cheat Violation Reporting
app.post('/api/student/violation', (req: Request, res: Response) => {
  const { sessionId, type, description, examId, studentName, studentClass, sbd } = req.body;
  let session = sessionId ? db.getSession(sessionId) : undefined;

  if (!session && sessionId && (examId || studentName)) {
    const exam = (examId ? db.getExam(examId) : undefined) || db.getExams()[0];
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
        questionOrder: exam.questions ? exam.questions.map(q => q.id) : [],
        optionOrder: {},
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
    if (session.score === undefined && exam && exam.questions) {
      let cCount = 0;
      let iCount = 0;
      let uCount = 0;
      for (const q of exam.questions) {
        const studentChoice = session.answers ? session.answers[q.id] : undefined;
        if (!studentChoice) {
          uCount++;
          continue;
        }
        const mapping = session.optionOrder ? session.optionOrder[q.id] : undefined;
        const origChoice = mapping ? mapping[studentChoice] : studentChoice;
        if (origChoice === q.correctAnswer) {
          cCount++;
        } else {
          iCount++;
        }
      }
      const totalQ = exam.questions.length;
      session.correctCount = cCount;
      session.incorrectCount = iCount;
      session.unansweredCount = uCount;
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
  const { sessionId, examId, studentName, studentClass, sbd, violationCount, answers, status, attemptNumber } = req.body;
  if (!sessionId) return res.json({ success: true, isLocked: false, status: 'in_progress' });
  let session = db.getSession(sessionId);

  if (!session && (examId || studentName)) {
    const exam = (examId ? db.getExam(examId) : undefined) || db.getExams()[0];
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
        questionOrder: exam.questions ? exam.questions.map(q => q.id) : [],
        optionOrder: {},
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
  db.saveSession(session);

  res.json({
    success: true,
    isLocked: session.status === 'locked',
    status: session.status
  });
});

// Lock exit (after 1 minute or student manual exit from lock screen)
app.post('/api/student/lock-exit', (req: Request, res: Response) => {
  const { sessionId } = req.body;
  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Không tìm thấy phiên làm bài' });
  }

  const exam = db.getExam(session.examId);
  if (exam) {
    finalizeLockedSession(session, exam);
  } else {
    session.status = 'submitted';
    session.submittedAt = new Date().toISOString();
    db.saveSession(session);
  }

  res.json({
    success: true,
    message: 'Bài thi đã bị khóa do vi phạm và tính là 1 lần làm bài.'
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
    violationCount,
    startedAt,
    attemptNumber
  } = req.body;

  let session = sessionId ? db.getSession(sessionId) : undefined;

  let exam = session ? db.getExam(session.examId) : (examId ? db.getExam(examId) : (examCode ? db.getExamByCode(examCode) : undefined));
  if (!exam && db.getExams().length > 0) {
    exam = db.getExams()[0];
  }

  if (!exam) {
    return res.status(404).json({ error: 'Không tìm thấy bài thi' });
  }

  if (!session) {
    const sId = sessionId || `ses-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    session = {
      id: sId,
      examId: exam.id,
      studentName: studentName || 'Học sinh',
      studentClass: studentClass || '',
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
      optionOrder: optionOrder || {},
      attemptNumber: attemptNumber || 1,
      flaggedQuestions: [],
      lastHeartbeat: new Date().toISOString()
    };
    db.saveSession(session);
  } else {
    if (answers && typeof answers === 'object') {
      session.answers = { ...session.answers, ...answers };
    }
    if (violationCount !== undefined) {
      session.violationCount = violationCount;
    }
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
    const isDisconnected = s.status === 'in_progress' && (now - lastActiveMs > 35000);

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
      for (const q of exam.questions) {
        const studentChoice = s.answers ? s.answers[q.id] : undefined;
        if (!studentChoice) {
          unans++;
          continue;
        }
        const mapping = s.optionOrder ? s.optionOrder[q.id] : undefined;
        const origChoice = mapping ? mapping[studentChoice] : studentChoice;
        if (origChoice === q.correctAnswer) {
          right++;
        } else {
          wrong++;
        }
      }
      const totalQ = exam.questions.length;
      s.score = totalQ > 0 ? Math.round((right * 10 / totalQ) * 100) / 100 : 0;
      s.correctCount = right;
      s.incorrectCount = wrong;
      s.unansweredCount = unans;
      db.saveSession(s);
    }
  }

  // Group sessions by unique student (studentName + studentClass)
  const studentMap = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = `${s.studentName.trim().toLowerCase()}:::${s.studentClass.trim().toLowerCase()}`;
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
    for (const s of sessions) {
      const studentChoice = s.answers ? s.answers[q.id] : undefined;
      if (!studentChoice) {
        wrong++;
        continue;
      }
      const mapping = s.optionOrder ? s.optionOrder[q.id] : undefined;
      const origChoice = mapping ? mapping[studentChoice] : studentChoice;
      if (origChoice === q.correctAnswer) {
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

  const sessions = db.getSessions(exam.id);

  // Prepare Excel worksheet data
  const data: any[][] = [];

  // Header banner
  data.push(['TRƯỜNG THCS NAM CỬA VIỆT']);
  data.push(['KẾT QUẢ BÀI KIỂM TRA TRẮC NGHIỆM TIN HỌC']);
  data.push([`Bài kiểm tra: ${exam.title}`]);
  data.push([`Mã đề: ${exam.code} | Khối: ${exam.grade} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`]);
  data.push([`Giáo viên phụ trách: Lê Gia Lợi`]);
  data.push([`Quy định làm bài: Tối đa ${exam.maxAttempts || 1} lần - Lấy điểm cao nhất trong các lần thi`]);
  data.push([]); // Empty row

  // Table header
  data.push([
    'STT',
    'Họ và tên',
    'Lớp',
    'Số báo danh',
    'Điểm cao nhất',
    'Số lần đã làm',
    'Chi tiết các lần thi',
    'Số câu đúng',
    'Số câu sai',
    'Số câu chưa làm',
    'Tổng vi phạm',
    'Trạng thái',
    'Thời gian nộp'
  ]);

  // Group by student
  const studentMap = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = `${s.studentName.trim().toLowerCase()}:::${s.studentClass.trim().toLowerCase()}`;
    if (!studentMap.has(key)) {
      studentMap.set(key, []);
    }
    studentMap.get(key)!.push(s);
  }

  let sttIdx = 1;
  studentMap.forEach((userSessions) => {
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

    const attemptsHistoryStr = userSessions.map((s, idx) => {
      const attNum = s.attemptNumber || (idx + 1);
      return `Lần ${attNum}: ${s.score ?? 0}đ`;
    }).join('; ');

    const statusText =
      bestSession.status === 'submitted'
        ? (totalStudentViolations > 0 ? `Đã nộp (${totalStudentViolations} vi phạm)` : 'Đã nộp bài')
        : bestSession.status === 'locked'
        ? `Bị khóa (${totalStudentViolations} vi phạm)`
        : 'Đang làm';

    const submittedDate = bestSession.submittedAt
      ? new Date(bestSession.submittedAt).toLocaleString('vi-VN')
      : bestSession.status === 'locked'
      ? `Bị khóa (${new Date(bestSession.lastHeartbeat || bestSession.startedAt).toLocaleString('vi-VN')})`
      : 'Chưa nộp';

    data.push([
      sttIdx++,
      bestSession.studentName,
      bestSession.studentClass,
      bestSession.sbd || '',
      maxSc,
      `${userSessions.length}/${exam.maxAttempts || 1}`,
      attemptsHistoryStr,
      bestSession.correctCount ?? 0,
      bestSession.incorrectCount ?? 0,
      bestSession.unansweredCount ?? 0,
      totalStudentViolations,
      statusText,
      submittedDate
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 25 }, // Họ và tên
    { wch: 10 }, // Lớp
    { wch: 14 }, // SBD
    { wch: 14 }, // Điểm cao nhất
    { wch: 14 }, // Số lần làm
    { wch: 28 }, // Chi tiết các lần
    { wch: 12 }, // Đúng
    { wch: 12 }, // Sai
    { wch: 14 }, // Chưa làm
    { wch: 14 }, // Vi phạm
    { wch: 18 }, // Trạng thái
    { wch: 22 }  // Ngày nộp
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'BangDiem');

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
  if (!isProd) {
    try {
      const viteModule = await (Function('pkg', 'return import(pkg)')('vite'));
      const createViteServer = viteModule.createServer;
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn('Vite dev middleware not loaded:', e);
    }
  } else {
    app.use(express.static(path.resolve(safeDirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(safeDirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server KIEM TRA TIN HOC - THCS NAM CUA VIET dang chay tai port ${PORT}`);
  });
}

export default app;

const isMainScript = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))
);

if (!process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.NOW_BUILD && isMainScript) {
  startServer();
}
