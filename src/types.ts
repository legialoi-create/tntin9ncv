export type GradeLevel = 6 | 7 | 8 | 9;

export interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface Question {
  id: string;
  number: number;
  content: string; // Question text
  codeSnippet?: string; // C++, Python, Pascal, Scratch code
  codeLanguage?: 'python' | 'cpp' | 'pascal' | 'scratch' | 'text';
  imageUrl?: string;
  options: QuestionOption[];
  correctAnswer: 'A' | 'B' | 'C' | 'D'; // Server-authoritative
  explanation?: string;
  points?: number; // Default 1 (will be normalized to scale of 10)
}

// Student view of question - NEVER has correctAnswer
export interface StudentQuestion {
  id: string;
  number: number;
  content: string;
  codeSnippet?: string;
  codeLanguage?: string;
  imageUrl?: string;
  options: QuestionOption[];
}

export interface Exam {
  id: string;
  code: string; // Mã bài kiểm tra (e.g. THCS-TIN7-01)
  title: string;
  grade: GradeLevel;
  targetClasses?: string[]; // e.g. ["6A1", "6A2"]
  durationMinutes: number; // Thời gian làm bài (phút)
  totalPoints: number; // Mặc định 10
  questions: Question[];
  questionCount?: number;
  isOpen: boolean; // Trạng thái mở/đóng
  startTime?: string;
  endTime?: string;
  shuffleQuestions: boolean; // Trộn thứ tự câu hỏi
  shuffleOptions: boolean; // Trộn vị trí đáp án A, B, C, D
  showScoreAfterSubmit: boolean; // Xem điểm ngay sau khi nộp
  maxViolationsBeforeLock: number; // Số lần cảnh báo trước khi khóa (mặc định 3)
  maxAttempts?: number; // Số lần học sinh được làm bài: 1, 2, 3, 4, 5... (mặc định 1). Hệ thống tự động lấy điểm cao nhất.
  randomQuestionCount?: number; // Số câu hỏi bốc ngẫu nhiên cho mỗi lượt làm bài (ví dụ ngân hàng 40 câu, lấy 20 câu)
  createdAt: string;
  updatedAt: string;
}

export interface ViolationEvent {
  timestamp: string;
  type: 'tab_switch' | 'fullscreen_exit' | 'window_blur' | 'copy_attempt' | 'inspect_attempt';
  description: string;
}

export interface ExamSession {
  id: string;
  examId: string;
  studentName: string;
  studentClass: string;
  sbd?: string;
  attemptNumber?: number; // Lần làm bài thứ mấy (1, 2, 3...)
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  status: 'in_progress' | 'submitted' | 'locked' | 'disconnected' | 'cancelled_disconnection';
  // Question mapping for this student: original question IDs in randomized order
  questionOrder: string[]; 
  // Option mapping: { [questionId]: { 'A': originalId, 'B': originalId, ... } }
  optionOrder: Record<string, Record<'A' | 'B' | 'C' | 'D', 'A' | 'B' | 'C' | 'D'>>;
  // Student answers: { [questionId]: studentChosenOptionId (A/B/C/D based on their view) }
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>;
  flaggedQuestions: string[];
  violations: ViolationEvent[];
  violationCount: number;
  lastHeartbeat: string;
  // Results after submission:
  score?: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  retakeAllowed?: boolean;
}

export interface StudentInfo {
  id: string;
  sbd: string;
  name: string;
  class: string;
  username?: string; // 2 chữ cuối của tên + lớp (ví dụ: vanan9a9)
  password?: string; // Mật khẩu (mặc định: [TênLớp]123, ví dụ: 9A9123)
  isPasswordChanged?: boolean;
}

export interface ClassInfo {
  name: string;
  grade: GradeLevel;
  studentCount?: number;
}

export interface ExamStats {
  examId: string;
  totalSubmissions: number;
  totalStudentsCount?: number; // Số học sinh duy nhất đã làm bài
  maxAttempts?: number; // Số lần làm bài cho phép của đề thi
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passCount: number; // >= 5.0
  passRate: number; // Percentage
  goodCount: number; // >= 8.0
  totalViolations?: number;
  violatingStudentsCount?: number;
  lockedStudentsCount?: number;
  scoreDistribution: {
    range: string;
    count: number;
  }[];
  questionAnalysis: {
    questionNumber: number;
    questionText: string;
    correctCount: number;
    incorrectCount: number;
    errorRate: number;
  }[];
}
