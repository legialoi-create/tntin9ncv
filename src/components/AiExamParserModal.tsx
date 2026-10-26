import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  X,
  RotateCw,
  Save,
  Check,
  School,
  Layers,
  Shuffle,
  Send,
  Bot,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  CalendarClock,
  Timer,
  Info
} from 'lucide-react';
import { Exam, Question, QuestionOption, GradeLevel } from '../types';
import { api } from '../services/api';
import { CodeBlock } from './CodeBlock';
import { extractTextFromDocxFile, extractTextFromFile, parseExamLocally } from '../utils/localExamParser';

interface AiExamParserModalProps {
  onClose: () => void;
  onSaved: (exam: Exam) => void;
  classesList: string[];
  initialExam?: Exam | null;
}

export const AiExamParserModal: React.FC<AiExamParserModalProps> = ({
  onClose,
  onSaved,
  classesList,
  initialExam = null,
}) => {
  const isEditing = Boolean(initialExam);
  const [step, setStep] = useState<'upload' | 'review'>(isEditing ? 'review' : 'upload');
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');

  // Input states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [answersText, setAnswersText] = useState('');
  const [teacherPrompt, setTeacherPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Review states
  const [examTitle, setExamTitle] = useState(initialExam?.title || '');
  const [examCode, setExamCode] = useState(
    initialExam?.code || `TIN8-NCV${Math.floor(10 + Math.random() * 90)}`
  );
  const initGrade = (initialExam?.grade as GradeLevel) || 8;
  const [examGrade, setExamGrade] = useState<GradeLevel>(initGrade);
  const [targetClasses, setTargetClasses] = useState<string[]>(() => {
    if (initialExam?.targetClasses && initialExam.targetClasses.length > 0) {
      return Array.from(new Set(initialExam.targetClasses.map((c) => c.trim()))).filter(Boolean);
    }
    const matching = classesList.filter((c) => c.startsWith(String(initGrade)));
    return matching.length > 0 ? matching : [`${initGrade}A`, `${initGrade}B`];
  });
  const [durationMinutes, setDurationMinutes] = useState(initialExam?.durationMinutes || 45);

  // Format to YYYY-MM-DDTHH:mm for datetime-local input
  const formatDatetimeForInput = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const [startTime, setStartTime] = useState<string>(() => formatDatetimeForInput(initialExam?.startTime));
  const [endTime, setEndTime] = useState<string>(() => formatDatetimeForInput(initialExam?.endTime));

  const setStartNow = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    setStartTime(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
  };

  const addMinutesToEnd = (mins: number) => {
    const baseDate = startTime ? new Date(startTime) : new Date();
    const endDate = new Date(baseDate.getTime() + mins * 60000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    setEndTime(`${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`);
  };

  const setEndToday = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    setEndTime(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59`);
  };

  const [shuffleQuestions, setShuffleQuestions] = useState(
    initialExam ? initialExam.shuffleQuestions ?? true : true
  );
  const [shuffleOptions, setShuffleOptions] = useState(
    initialExam ? initialExam.shuffleOptions ?? true : true
  );
  const [showScoreAfterSubmit, setShowScoreAfterSubmit] = useState(
    initialExam ? initialExam.showScoreAfterSubmit ?? true : true
  );
  const [maxViolationsBeforeLock, setMaxViolationsBeforeLock] = useState(
    initialExam?.maxViolationsBeforeLock || 3
  );
  const [maxAttempts, setMaxAttempts] = useState<number>(
    initialExam?.maxAttempts || 1
  );
  const [randomQuestionCount, setRandomQuestionCount] = useState<number | ''>(
    initialExam?.randomQuestionCount && initialExam.randomQuestionCount > 0
      ? initialExam.randomQuestionCount
      : ''
  );

  // Questions parsed
  const [questions, setQuestions] = useState<Question[]>(initialExam?.questions || []);
  const [warnings, setWarnings] = useState<{
    duplicates: number[];
    missingOptions: number[];
    unknownAnswers: number[];
    notes?: string;
  }>({ duplicates: [], missingOptions: [], unknownAnswers: [] });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSolvingAnswers, setIsSolvingAnswers] = useState(false);
  const [solveAnswersSuccess, setSolveAnswersSuccess] = useState<string | null>(null);

  // Missing info validation state
  const [missingInfoState, setMissingInfoState] = useState<{
    show: boolean;
    titleMissing?: boolean;
    codeMissing?: boolean;
    classesMissing?: boolean;
    durationMissing?: boolean;
    questionsEmpty?: boolean;
    invalidQuestionNumbers?: number[];
    messages: string[];
  } | null>(null);
  const [showMissingAlertModal, setShowMissingAlertModal] = useState<boolean>(false);

  // Refs for auto-focus and scrolling to missing fields
  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const examTitleInputRef = useRef<HTMLInputElement | null>(null);
  const examCodeInputRef = useRef<HTMLInputElement | null>(null);
  const durationInputRef = useRef<HTMLInputElement | null>(null);
  const classesSectionRef = useRef<HTMLDivElement | null>(null);

  // AI Chat Assistant states
  const [chatMessages, setChatMessages] = useState<
    {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      time: string;
      updatedCount?: number;
    }[]
  >([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Xin chào Thầy! Thầy có thể nhắn trực tiếp yêu cầu ở đây: ví dụ "Hãy giải và chọn đáp án chính xác theo đề", "Đề này có đáp án là: 1B, 2C, 3A, 4D...", "Sửa câu 5 thành C", hoặc "Giải thích tại sao câu 2 chọn B". Tôi sẽ giải đáp và tự động cập nhật đáp án cho Thầy ngay lập tức!',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // When exam grade changes, suggest relevant target classes for that grade
  const handleGradeChange = (newGrade: GradeLevel) => {
    setExamGrade(newGrade);
    const fallbackList = ['6A', '6B', '6C', '7A', '7B', '7C', '8A', '8B', '8C', '9A', '9B', '9C'];
    const currentList = classesList.length > 0 ? classesList : fallbackList;
    const matching = currentList.filter((c) => c.startsWith(String(newGrade)));
    const target = matching.length > 0 ? matching : [`${newGrade}A`, `${newGrade}B`];
    setTargetClasses(Array.from(new Set(target.map((c) => c.trim()))));

    // Update suggested exam code if user hasn't edited it significantly
    if (!isEditing && /^TIN\d-NCV\d+$/i.test(examCode)) {
      setExamCode(`TIN${newGrade}-NCV${Math.floor(10 + Math.random() * 90)}`);
    }
  };

  // Toggle a single class selection
  const toggleClass = (className: string) => {
    const cleanName = className.trim();
    setTargetClasses((prev) => {
      const normalized = prev.map((c) => c.trim());
      return normalized.includes(cleanName)
        ? normalized.filter((c) => c !== cleanName)
        : [...normalized, cleanName];
    });
  };

  // Select all classes of current grade (or toggle off if all are already selected)
  const selectAllGradeClasses = () => {
    const fallbackList = ['6A', '6B', '6C', '7A', '7B', '7C', '8A', '8B', '8C', '9A', '9B', '9C'];
    const currentList = classesList.length > 0 ? classesList : fallbackList;
    const matching = currentList.filter((c) => c.startsWith(String(examGrade)));
    const gradeClasses = matching.length > 0 ? matching : [`${examGrade}A`, `${examGrade}B`];

    setTargetClasses((prev) => {
      const cleanPrev = Array.from(new Set(prev.map((c) => c.trim())));
      const allSelected = gradeClasses.every((c) => cleanPrev.includes(c));
      if (allSelected) {
        // Toggle off this grade's classes
        return cleanPrev.filter((c) => !gradeClasses.includes(c));
      } else {
        // Add all classes of this grade
        return Array.from(new Set([...cleanPrev, ...gradeClasses]));
      }
    });
  };

  // File handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Trigger AI Parsing
  const handleParse = async () => {
    setErrorMsg(null);
    setSaveError(null);
    if (activeTab === 'file' && !selectedFile) {
      setErrorMsg('Vui lòng chọn một tệp Word (.docx, .doc), PDF hoặc ảnh đề thi');
      return;
    }
    if (activeTab === 'text' && !rawText.trim()) {
      setErrorMsg('Vui lòng dán nội dung đề thi vào khung văn bản');
      return;
    }

    setIsParsing(true);
    try {
      let fileBase64: string | undefined = undefined;
      let mimeType: string | undefined = undefined;
      let filename: string | undefined = undefined;
      let extractedText: string | undefined = activeTab === 'text' ? rawText : undefined;

      if (selectedFile) {
        if (
          selectedFile.name.endsWith('.docx') ||
          selectedFile.name.endsWith('.doc') ||
          selectedFile.type.includes('word') ||
          selectedFile.type.includes('docx')
        ) {
          try {
            const docxText = await extractTextFromDocxFile(selectedFile);
            if (docxText && docxText.trim().length > 0) {
              extractedText = docxText;
            }
          } catch (e) {
            console.warn('Docx extraction warning:', e);
          }
        }
        fileBase64 = await fileToBase64(selectedFile);
        mimeType = selectedFile.type;
        filename = selectedFile.name;
      }

      const res = await api.parseExamWithAI({
        rawText: extractedText,
        fileBase64,
        mimeType,
        filename,
        answersText: answersText.trim() ? answersText.trim() : undefined,
        teacherPrompt: teacherPrompt.trim() ? teacherPrompt.trim() : undefined,
        selectedModel,
      });

      if (!res.questions || res.questions.length === 0) {
        throw new Error('Không tìm thấy câu hỏi trắc nghiệm nào trong tài liệu. Vui lòng kiểm tra lại định dạng đề.');
      }

      // Convert parsed questions into standard Question models
      const convertedQuestions: Question[] = res.questions.map((q: any, idx: number) => {
        const opts: QuestionOption[] = (['A', 'B', 'C', 'D'] as const).map((letter) => {
          const found = q.options?.find((o: any) => o.id?.toUpperCase() === letter);
          return {
            id: letter,
            text: found ? found.text : '',
          };
        });

        let resolvedAns: 'A' | 'B' | 'C' | 'D' = 'A';
        if (q.correctAnswer && ['A', 'B', 'C', 'D'].includes(q.correctAnswer.toUpperCase())) {
          resolvedAns = q.correctAnswer.toUpperCase() as any;
        } else {
          // If no answer provided, distribute fallback across B, C, A, D instead of all A
          const fallbackList: ('A' | 'B' | 'C' | 'D')[] = ['B', 'C', 'A', 'D'];
          resolvedAns = fallbackList[idx % 4];
        }

        return {
          id: `q-${Date.now()}-${idx + 1}`,
          number: idx + 1,
          content: q.content || `Câu hỏi ${idx + 1}`,
          codeSnippet: q.codeSnippet,
          codeLanguage: q.codeLanguage,
          options: opts,
          correctAnswer: resolvedAns,
          explanation: q.explanation,
        };
      });

      setQuestions(convertedQuestions);
      if (res.title) setExamTitle(res.title);
      if (res.grade && [6, 7, 8, 9].includes(res.grade)) {
        handleGradeChange(res.grade as GradeLevel);
      }

      setWarnings({
        duplicates: res.duplicateQuestionsFound || [],
        missingOptions: res.missingOptionsWarnings || [],
        unknownAnswers: res.unknownAnswerWarnings || [],
        notes: res.notes,
      });

      setStep('review');
    } catch (err: any) {
      console.warn('AI Parsing failed, attempting local rule-based parsing fallback:', err);
      // Automatic client-side fallback if AI API hits quota limit, network error or timeout
      let fallbackText = activeTab === 'text' ? rawText : '';
      if (!fallbackText && selectedFile) {
        try {
          fallbackText = await extractTextFromFile(selectedFile);
        } catch (e) {}
      }

      if (fallbackText && fallbackText.trim().length > 0) {
        try {
          const localRes = parseExamLocally(fallbackText, answersText);
          if (localRes && localRes.questions && localRes.questions.length > 0) {
            const convertedQuestions: Question[] = localRes.questions.map((q: any, idx: number) => {
              const opts: QuestionOption[] = (['A', 'B', 'C', 'D'] as const).map((letter) => {
                const found = q.options?.find((o: any) => o.id?.toUpperCase() === letter);
                return {
                  id: letter,
                  text: found ? found.text : '',
                };
              });

              let resolvedAns: 'A' | 'B' | 'C' | 'D' = 'A';
              if (q.correctAnswer && ['A', 'B', 'C', 'D'].includes(q.correctAnswer.toUpperCase())) {
                resolvedAns = q.correctAnswer.toUpperCase() as any;
              } else {
                const fallbackList: ('A' | 'B' | 'C' | 'D')[] = ['B', 'C', 'A', 'D'];
                resolvedAns = fallbackList[idx % 4];
              }

              return {
                id: `q-${Date.now()}-${idx + 1}`,
                number: idx + 1,
                content: q.content || `Câu hỏi ${idx + 1}`,
                codeSnippet: q.codeSnippet,
                codeLanguage: q.codeLanguage,
                options: opts,
                correctAnswer: resolvedAns,
                explanation: q.explanation,
              };
            });

            setQuestions(convertedQuestions);
            if (localRes.title) setExamTitle(localRes.title);
            if (localRes.grade && [6, 7, 8, 9].includes(localRes.grade)) {
              handleGradeChange(localRes.grade as GradeLevel);
            }
            setStep('review');
            setWarnings({
              duplicates: localRes.duplicateQuestionsFound || [],
              missingOptions: localRes.missingOptionsWarnings || [],
              unknownAnswers: localRes.unknownAnswerWarnings || [],
              notes: localRes.notes || 'Đã phân tích bóc tách thành công bằng Bộ bóc tách Cục bộ (Offline Engine).',
            });
            return;
          }
        } catch (localErr) {
          console.warn('Local parser fallback error:', localErr);
        }
      }

      setErrorMsg(err.message || 'Lỗi bóc tách đề thi. Vui lòng kiểm tra lại tệp hoặc dán trực tiếp nội dung.');
    } finally {
      setIsParsing(false);
    }
  };

  // Trigger Gemini AI to solve all questions and accurately set correct answers
  const handleAiSolveAnswers = async () => {
    if (questions.length === 0) return;
    setIsSolvingAnswers(true);
    setSaveError(null);
    setSolveAnswersSuccess(null);
    try {
      const res = await api.solveQuestionsWithAI(questions, selectedModel);
      if (res && res.answers && res.answers.length > 0) {
        const ansMap = new Map(res.answers.map((a) => [a.number, a]));
        setQuestions((prev) =>
          prev.map((q) => {
            const solved = ansMap.get(q.number);
            if (solved) {
              return {
                ...q,
                correctAnswer: solved.correctAnswer,
                explanation: solved.explanation || q.explanation,
              };
            }
            return q;
          })
        );
        setSolveAnswersSuccess(`✓ AI đã giải chi tiết và chọn đáp án chính xác cho ${res.answers.length} câu hỏi!`);
        setTimeout(() => setSolveAnswersSuccess(null), 6000);
      }
    } catch (err: any) {
      setSaveError(err.message || 'Lỗi khi AI giải đề. Vui lòng thử lại.');
    } finally {
      setIsSolvingAnswers(false);
    }
  };

  // Handle sending message in AI Chat Assistant
  const handleSendChatMessage = async (presetText?: string) => {
    const textToSend = (presetText || chatInput).trim();
    if (!textToSend || isChatting || questions.length === 0) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatting(true);

    try {
      const history = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.chatExamAssistant({
        message: textToSend,
        questions,
        history,
      });

      let updatedCount = 0;
      if (res && res.updatedAnswers && res.updatedAnswers.length > 0) {
        updatedCount = res.updatedAnswers.length;
        const ansMap = new Map(res.updatedAnswers.map((a) => [a.number, a]));
        setQuestions((prev) =>
          prev.map((q) => {
            const upd = ansMap.get(q.number);
            if (upd) {
              return {
                ...q,
                correctAnswer: upd.correctAnswer,
                explanation: upd.explanation || q.explanation,
              };
            }
            return q;
          })
        );
      }

      const aiMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant' as const,
        content: res.reply || 'Đã xử lý xong yêu cầu của Thầy.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        updatedCount: updatedCount > 0 ? updatedCount : undefined,
      };

      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant' as const,
        content: '⚠️ ' + (err.message || 'Lỗi kết nối với AI. Vui lòng thử lại.'),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsChatting(false);
      setTimeout(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Update a question field
  const handleUpdateQuestion = (idx: number, patch: Partial<Question>) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...patch };
      return updated;
    });
    if (missingInfoState) {
      setMissingInfoState((prev) => {
        if (!prev) return null;
        const qNum = questions[idx]?.number || idx + 1;
        return {
          ...prev,
          invalidQuestionNumbers: prev.invalidQuestionNumbers?.filter((n) => n !== qNum),
        };
      });
    }
  };

  // Update an option text
  const handleUpdateOption = (qIdx: number, optId: 'A' | 'B' | 'C' | 'D', text: string) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const q = updated[qIdx];
      const newOpts = q.options.map((o) => (o.id === optId ? { ...o, text } : o));
      updated[qIdx] = { ...q, options: newOpts };
      return updated;
    });
    if (missingInfoState) {
      setMissingInfoState((prev) => {
        if (!prev) return null;
        const qNum = questions[qIdx]?.number || qIdx + 1;
        return {
          ...prev,
          invalidQuestionNumbers: prev.invalidQuestionNumbers?.filter((n) => n !== qNum),
        };
      });
    }
  };

  // Delete question
  const handleDeleteQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, number: i + 1 })));
  };

  // Add blank question
  const handleAddQuestion = () => {
    const newQ: Question = {
      id: `q-${Date.now()}-${questions.length + 1}`,
      number: questions.length + 1,
      content: 'Nội dung câu hỏi mới...',
      options: [
        { id: 'A', text: 'Phương án A' },
        { id: 'B', text: 'Phương án B' },
        { id: 'C', text: 'Phương án C' },
        { id: 'D', text: 'Phương án D' },
      ],
      correctAnswer: 'A',
    };
    setQuestions([...questions, newQ]);
  };

  // Save finalized exam to DB with comprehensive validation
  const handleSaveExam = async () => {
    setSaveError(null);
    setMissingInfoState(null);

    const titleClean = examTitle.trim();
    const codeClean = examCode.trim().toUpperCase();
    const parsedDuration = Number(durationMinutes);
    const durationValid = !isNaN(parsedDuration) && parsedDuration >= 5 && parsedDuration <= 180;
    const cleanClasses = Array.from(new Set(targetClasses.map((c) => c.trim()))).filter(Boolean);
    const hasTargetClasses = cleanClasses.length > 0;

    const missingItems: string[] = [];
    let titleMissing = false;
    let codeMissing = false;
    let classesMissing = false;
    let durationMissing = false;
    let questionsEmpty = false;
    const invalidQuestionNumbers: number[] = [];

    if (!titleClean) {
      titleMissing = true;
      missingItems.push('Tên bài kiểm tra (đang để trống)');
    }

    if (!codeClean) {
      codeMissing = true;
      missingItems.push('Mã bài kiểm tra (đang để trống)');
    }

    if (!hasTargetClasses) {
      classesMissing = true;
      missingItems.push(`Lớp áp dụng (vui lòng chọn ít nhất 1 lớp cho khối ${examGrade})`);
    }

    if (!durationValid) {
      durationMissing = true;
      missingItems.push('Thời gian làm bài (phải từ 5 đến 180 phút)');
    }

    if (startTime && endTime) {
      const sMs = new Date(startTime).getTime();
      const eMs = new Date(endTime).getTime();
      if (!isNaN(sMs) && !isNaN(eMs) && eMs <= sMs) {
        missingItems.push('Thời gian kết thúc ca thi phải sau thời gian bắt đầu');
      }
    }

    if (questions.length === 0) {
      questionsEmpty = true;
      missingItems.push('Danh sách câu hỏi (đề kiểm tra chưa có câu hỏi nào)');
    } else {
      questions.forEach((q, idx) => {
        const qNum = q.number || idx + 1;
        const hasContent = Boolean(q.content && q.content.trim().length > 0);
        const hasValidOpts = Boolean(
          q.options &&
          q.options.length >= 2 &&
          q.options.every((opt) => opt.text && opt.text.trim().length > 0)
        );
        const hasValidAns = Boolean(
          q.correctAnswer && ['A', 'B', 'C', 'D'].includes(q.correctAnswer)
        );

        if (!hasContent || !hasValidOpts || !hasValidAns) {
          invalidQuestionNumbers.push(qNum);
        }
      });

      if (invalidQuestionNumbers.length > 0) {
        missingItems.push(
          `Câu ${invalidQuestionNumbers.slice(0, 6).join(', ')}${
            invalidQuestionNumbers.length > 6 ? ` và ${invalidQuestionNumbers.length - 6} câu khác` : ''
          } (đang thiếu nội dung câu hỏi hoặc chưa điền đủ các phương án A, B, C, D)`
        );
      }
    }

    // IF MISSING INFORMATION: Show prominent alert and guide the teacher
    if (missingItems.length > 0) {
      const stateObj = {
        show: true,
        titleMissing,
        codeMissing,
        classesMissing,
        durationMissing,
        questionsEmpty,
        invalidQuestionNumbers,
        messages: missingItems,
      };

      setMissingInfoState(stateObj);
      setShowMissingAlertModal(true);
      setSaveError(
        `⚠️ Hãy nhập đủ thông tin trước khi lưu đề kiểm tra! Các mục còn thiếu: ${missingItems.join('; ')}.`
      );

      // Smooth scroll to the first missing element so the teacher can fill it immediately
      setTimeout(() => {
        if (titleMissing && examTitleInputRef.current) {
          examTitleInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          examTitleInputRef.current.focus();
        } else if (codeMissing && examCodeInputRef.current) {
          examCodeInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          examCodeInputRef.current.focus();
        } else if (classesMissing && classesSectionRef.current) {
          classesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (durationMissing && durationInputRef.current) {
          durationInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          durationInputRef.current.focus();
        } else if (modalContentRef.current) {
          modalContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);

      return;
    }

    const finalClasses = cleanClasses;

    setIsSaving(true);
    try {
      const parsedRandom = randomQuestionCount !== '' ? Number(randomQuestionCount) : undefined;
      const validRandom = (parsedRandom && parsedRandom > 0 && parsedRandom < questions.length)
        ? parsedRandom
        : undefined;

      const isNew = !initialExam;
      const examToSave: Exam = {
        id: initialExam ? initialExam.id : `exam-${Date.now()}`,
        code: codeClean,
        title: titleClean,
        grade: examGrade,
        targetClasses: finalClasses,
        durationMinutes: parsedDuration,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        totalPoints: 10,
        questions,
        randomQuestionCount: validRandom,
        isOpen: initialExam ? initialExam.isOpen : true,
        shuffleQuestions,
        shuffleOptions,
        showScoreAfterSubmit,
        maxViolationsBeforeLock: Number(maxViolationsBeforeLock) || 3,
        maxAttempts: Number(maxAttempts) || 1,
        createdAt: initialExam?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await api.saveExam(examToSave, isNew);
      setSaveSuccess(true);
      setTimeout(() => {
        onSaved(saved);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Save exam error:', err);
      setSaveError(err.message || 'Lỗi lưu bài kiểm tra. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsSaving(false);
    }
  };

  // Distinct clean target classes
  const cleanTargetClasses = Array.from(new Set(targetClasses.map((c) => c.trim()))).filter(Boolean);

  // Available classes for target selection
  const fallbackClasses = ['6A', '6B', '6C', '7A', '7B', '7C', '8A', '8B', '8C', '9A', '9B', '9C'];
  const baseClasses = classesList.length > 0 ? classesList : fallbackClasses;

  // Make sure ALL classes in targetClasses are available as clickable buttons so count matches 100%
  const allAvailableClasses = Array.from(new Set([...baseClasses, ...cleanTargetClasses])).filter(Boolean);
  const currentGradeClasses = allAvailableClasses.filter((c) => c.startsWith(String(examGrade)));
  const otherGradeClasses = allAvailableClasses.filter((c) => !c.startsWith(String(examGrade)));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Missing Information Alert Modal */}
      {showMissingAlertModal && missingInfoState && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-red-500 max-w-lg w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="w-11 h-11 rounded-2xl bg-red-100 flex items-center justify-center shrink-0 shadow-inner">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-red-900 leading-tight">
                  HÃY NHẬP ĐỦ THÔNG TIN!
                </h3>
                <p className="text-xs text-red-600 font-medium">
                  Hệ thống không thể lưu đề kiểm tra khi còn thiếu dữ liệu bắt buộc
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-2">
              <p className="text-xs font-bold text-red-900 uppercase tracking-wide">
                Các mục còn thiếu cần hoàn thành:
              </p>
              <ul className="space-y-1.5 text-xs text-red-800">
                {missingInfoState.messages.map((msg, i) => (
                  <li key={i} className="flex items-start space-x-2 font-medium">
                    <span className="text-red-500 font-extrabold shrink-0">•</span>
                    <span>{msg}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-slate-500">
              💡 Thầy vui lòng điền các ô có viền đỏ bên dưới rồi nhấn lại nút <b>Lưu đề kiểm tra</b>.
            </p>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMissingAlertModal(false)}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-red-200 transition cursor-pointer flex items-center space-x-1.5"
              >
                <span>Đã hiểu, tôi sẽ nhập đủ thông tin</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {isEditing
                  ? 'Chỉnh sửa Đề kiểm tra Tin học'
                  : step === 'upload'
                  ? 'AI Tự động bóc tách Đề kiểm tra Tin học'
                  : 'Duyệt & Lưu Đề kiểm tra vào hệ thống'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? `Chỉnh sửa nội dung và thông số đề ${examCode}`
                  : 'Nhận diện Word (.docx), PDF, giữ nguyên code Python/Pascal/C++/Scratch'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div ref={modalContentRef} className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
              {activeTab === 'file' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('text');
                    setErrorMsg(null);
                  }}
                  className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold cursor-pointer transition shrink-0"
                >
                  Chuyển sang dán văn bản
                </button>
              )}
            </div>
          )}

          {step === 'upload' ? (
            /* STEP 1: UPLOAD & INPUT */
            <div className="space-y-6">
              {/* Tabs: Upload File vs Paste Text */}
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('file')}
                  className={`py-2.5 px-5 font-bold text-sm border-b-2 transition cursor-pointer flex items-center space-x-2 ${
                    activeTab === 'file'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Tải tệp Word / PDF / Ảnh đề</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  className={`py-2.5 px-5 font-bold text-sm border-b-2 transition cursor-pointer flex items-center space-x-2 ${
                    activeTab === 'text'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Dán nội dung văn bản</span>
                </button>
              </div>

              {activeTab === 'file' ? (
                /* File dropzone */
                <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 text-center bg-slate-50 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept=".docx,.doc,.pdf,image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                    <Upload className="w-7 h-7" />
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-bold text-slate-900 mb-1">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-indigo-600 font-medium">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Nhấn để đổi tệp khác
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-slate-800 mb-1">
                        Kéo thả hoặc nhấp để chọn tệp đề thi
                      </p>
                      <p className="text-xs text-slate-500">
                        Hỗ trợ Microsoft Word (.docx, .doc), PDF văn bản, PDF ảnh quét, hình chụp đề
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Paste Text */
                <div>
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Nội dung câu hỏi và đáp án
                    </label>
                    <div className="flex items-center space-x-1.5 text-[11px]">
                      <span className="text-slate-400 font-semibold">Chèn mẫu nhanh:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setRawText(`ĐỀ KIỂM TRA TIN HỌC 6 - CHỦ ĐỀ MẠNG VÀ THÔNG TIN
Câu 1: Thông tin là gì?
A. Là những gì đem lại hiểu biết cho con người về thế giới xung quanh
B. Là những dòng chữ in trên sách báo
C. Là tín hiệu âm thanh phát ra từ loa
D. Là các con số trong bảng tính
Đáp án: A

Câu 2: Thiết bị nào sau đây là thiết bị vào của máy tính?
A. Màn hình
B. Bàn phím
C. Máy in
D. Loa
Đáp án: B

Câu 3: Đâu là một địa chỉ trang web hợp lệ?
A. C:\\TaiLieu\\TinHoc6.docx
B. thcsnamcuaviet@gmail.com
C. https://thcsnamcuaviet.edu.vn
D. 192.168.1.1.999
Đáp án: C

Câu 4: Thiết bị nào sau đây dùng để xuất thông tin ra giấy?
A. Chuột máy tính
B. Bàn phím
C. Máy quét (Scanner)
D. Máy in
Đáp án: D`);
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-indigo-700 rounded border border-slate-200 font-medium cursor-pointer"
                      >
                        Tin 6
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRawText(`ĐỀ KIỂM TRA TIN HỌC 7 - BẢNG TÍNH EXCEL VÀ PHẦN MỀM
Câu 1: Trong Excel, ký hiệu nào bắt buộc phải đứng đầu công thức?
A. Dấu =
B. Dấu :
C. Dấu ?
D. Dấu #
Đáp án: A

Câu 2: Hàm nào sau đây dùng để tính tổng trong bảng tính Excel?
A. SUM
B. AVERAGE
C. COUNT
D. MAX
Đáp án: A

Câu 3: Cho bảng tính, công thức =AVERAGE(2, 4, 6) cho kết quả là:
A. 12
B. 4
C. 6
D. 2
Đáp án: B

Câu 4: Địa chỉ ô nào sau đây là địa chỉ tuyệt đối trong Excel?
A. A1
B. $A$1
C. A$1
D. $A1
Đáp án: B`);
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-indigo-700 rounded border border-slate-200 font-medium cursor-pointer"
                      >
                        Tin 7
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRawText(`ĐỀ KIỂM TRA TIN HỌC 8 - LẬP TRÌNH VÀ THUẬT TOÁN
Câu 1: Trong Python, từ khóa nào dùng để định nghĩa một hàm?
A. function
B. def
C. define
D. func
Đáp án: B

Câu 2: Đoạn chương trình Python sau in ra kết quả gì?
\`\`\`python
x = 5
y = 10
print(x + y * 2)
\`\`\`
A. 30
B. 25
C. 20
D. 15
Đáp án: B

Câu 3: Kiểu dữ liệu nào dùng để lưu trữ số nguyên trong Python?
A. float
B. str
C. int
D. bool
Đáp án: C

Câu 4: Lệnh nào dùng để nhập dữ liệu từ bàn phím trong Python?
A. print()
B. write()
C. input()
D. read()
Đáp án: C`);
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-indigo-700 rounded border border-slate-200 font-medium cursor-pointer"
                      >
                        Tin 8
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRawText(`ĐỀ KIỂM TRA TIN HỌC 9 - CƠ SỞ DỮ LIỆU VÀ MẠNG XÃ HỘI
Câu 1: Khóa chính của bảng trong cơ sở dữ liệu có đặc điểm gì?
A. Có thể chứa giá trị trùng lặp
B. Giá trị duy nhất phân biệt từng bản ghi và không được để trống
C. Có thể để trống
D. Chỉ chứa kiểu dữ liệu văn bản
Đáp án: B

Câu 2: Tác động tiêu cực nào sau đây có thể xảy ra khi lạm dụng mạng xã hội?
A. Tăng cường kết nối bạn bè
B. Tiếp cận thông tin nhanh chóng
C. Nguy cơ nghiện mạng và giảm tương tác thực tế
D. Học tập hiệu quả hơn
Đáp án: C

Câu 3: Đâu là một hệ quản trị cơ sở dữ liệu phổ biến?
A. Microsoft Word
B. Microsoft Access
C. Paint
D. Windows Media Player
Đáp án: B

Câu 4: Thuật toán tìm kiếm nhị phân áp dụng cho danh sách nào?
A. Danh sách đã được sắp xếp
B. Danh sách bất kỳ chưa sắp xếp
C. Danh sách toàn số âm
D. Danh sách chỉ có 2 phần tử
Đáp án: A`);
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-indigo-700 rounded border border-slate-200 font-medium cursor-pointer"
                      >
                        Tin 9
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={8}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Dán toàn bộ nội dung đề kiểm tra tại đây... Ví dụ:&#10;Câu 1: Trong Pascal, từ khóa khai báo biến là?&#10;A. Var  B. Program  C. Const  D. Uses&#10;Đáp án: B"
                    className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-mono text-slate-800 outline-none transition"
                  />
                </div>
              )}

              {/* Optional: Separate Answer Key */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bảng đáp án đính kèm riêng (Nếu đề thi chưa có đáp án)
                </label>
                <textarea
                  rows={2}
                  value={answersText}
                  onChange={(e) => setAnswersText(e.target.value)}
                  placeholder="Ví dụ: 1-A, 2-B, 3-C, 4-D hoặc 1.A 2.B 3.C (Không bắt buộc)"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  💡 Nếu đề không có đáp án và không nhập bảng này, AI sẽ tự động suy luận để chọn đáp án chuẩn xác nhất.
                </p>
              </div>

              {/* Multi-Model AI Version Selector */}
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2.5 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center space-x-1.5">
                    <Bot className="w-4 h-4 text-amber-400" />
                    <span>Chọn phiên bản mô hình AI bóc tách & giải đề</span>
                  </label>
                  <span className="text-[10px] bg-slate-800 text-emerald-400 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                    Multi-Model Active
                  </span>
                </div>

                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="auto">⚡ Tự động (Hệ thống tự chọn mô hình AI tối ưu & tự động chuyển dự phòng khi lỗi)</option>
                  <option value="gemini-3.8-flash">🚀 Gemini 3.8 Flash (Mô hình mới nhất, xử lý nhanh & chính xác)</option>
                  <option value="gemini-3.1-flash-lite">⚡ Gemini 3.1 Flash Lite (Siêu phản hồi, tiết kiệm hạn mức)</option>
                  <option value="gemini-2.5-flash">🌟 Gemini 2.5 Flash (Phiên bản ổn định cao)</option>
                  <option value="gemini-2.0-flash">🔮 Gemini 2.0 Flash (Hỗ trợ tốt nhất tài liệu đa phương tiện)</option>
                  <option value="gemini-1.5-flash">💎 Gemini 1.5 Flash (Xử lý chuỗi văn bản dài)</option>
                  <option value="local">💻 Bộ phân tích Cục bộ (Bóc tách trực tiếp bằng mã nguồn không cần mạng/AI)</option>
                </select>
                <p className="text-[11px] text-slate-400 leading-normal">
                  💡 Thầy có thể linh hoạt chọn phiên bản AI khác nếu phiên bản hiện tại gặp bận mạng hoặc hết hạn mức.
                </p>
              </div>

              {/* Teacher Prompt / Custom Instructions for AI */}
              <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/80 to-blue-50/90 p-4 rounded-xl border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Lời nhắc / Yêu cầu chọn đáp án gửi cho AI (Tùy chọn)</span>
                  </label>
                  <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                    Prompt AI
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={teacherPrompt}
                  onChange={(e) => setTeacherPrompt(e.target.value)}
                  placeholder="Ví dụ: 'Hãy giải các câu hỏi và chọn đáp án chính xác theo chương trình Tin học 8 sách Cánh diều', 'Đề này đáp án là: 1B, 2C, 3A, 4D...', 'Kiểm tra kỹ các câu lập trình Python'..."
                  className="w-full px-3.5 py-2.5 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
                />
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-indigo-900/70 font-semibold">Gợi ý nhanh:</span>
                  <button
                    type="button"
                    onClick={() => setTeacherPrompt('Hãy giải chi tiết toàn bộ các câu hỏi trắc nghiệm Tin học và tự động chọn đáp án đúng chuẩn xác nhất.')}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-medium cursor-pointer"
                  >
                    🧠 Giải & chọn đáp án chuẩn
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherPrompt('Hãy chọn đáp án theo chương trình Tin học THCS mới (Kết nối tri thức / Cánh diều).')}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-medium cursor-pointer"
                  >
                    📚 Theo chuẩn SGK mới
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherPrompt('Kiểm tra chạy thử thật kỹ kết quả các đoạn code Python, C++, Pascal và công thức Excel để chọn đáp án.')}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-medium cursor-pointer"
                  >
                    💻 Kiểm tra code & Excel
                  </button>
                </div>
              </div>


              {/* Action Button */}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={isParsing}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isParsing ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>AI đang đọc và bóc tách đề...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>BẮT ĐẦU BÓC TÁCH BẰNG AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: REVIEW & EDIT QUESTIONS */
            <div className="space-y-6">
              {/* Prominent Missing Information Alert Banner */}
              {missingInfoState && missingInfoState.show && (
                <div className="p-4 bg-red-50 border-2 border-red-500 rounded-2xl text-red-900 shadow-md space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2 text-red-700 font-extrabold text-sm sm:text-base">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                      <span>HÃY NHẬP ĐỦ THÔNG TIN TRƯỚC KHI LƯU ĐỀ KIỂM TRA!</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMissingInfoState(null)}
                      className="text-red-400 hover:text-red-700 p-1 text-xs cursor-pointer font-bold"
                      title="Đóng thông báo"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-red-700 font-semibold">
                    Đề kiểm tra vẫn còn thiếu các thông tin bắt buộc dưới đây. Vui lòng bổ sung đầy đủ trước khi lưu:
                  </p>
                  <ul className="list-disc list-inside text-xs font-bold text-red-800 space-y-1 bg-white/80 p-2.5 rounded-xl border border-red-200">
                    {missingInfoState.messages.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings and Quality Alert Banner */}
              {(warnings.duplicates.length > 0 ||
                warnings.missingOptions.length > 0 ||
                warnings.unknownAnswers.length > 0) && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-900">
                  <div className="flex items-center space-x-1.5 font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>CẢNH BÁO TỪ HỆ THỐNG KIỂM TRA ĐỀ:</span>
                  </div>
                  {warnings.duplicates.length > 0 && (
                    <p>• Phát hiện câu hỏi trùng lặp: Câu {warnings.duplicates.join(', ')}</p>
                  )}
                  {warnings.missingOptions.length > 0 && (
                    <p>• Câu thiếu phương án: Câu {warnings.missingOptions.join(', ')}</p>
                  )}
                  {warnings.unknownAnswers.length > 0 && (
                    <p>
                      • Tài liệu không nêu đáp án cho: Câu {warnings.unknownAnswers.join(', ')} (Vui lòng chọn đáp án đúng bên dưới).
                    </p>
                  )}
                </div>
              )}

              {/* General Exam Config */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                    <span>
                      Tên bài kiểm tra <span className="text-red-500">*</span>
                    </span>
                    {missingInfoState?.titleMissing && (
                      <span className="text-red-600 text-[11px] font-bold">
                        ⚠️ Hãy nhập tên bài kiểm tra
                      </span>
                    )}
                  </label>
                  <input
                    ref={examTitleInputRef}
                    type="text"
                    value={examTitle}
                    onChange={(e) => {
                      setExamTitle(e.target.value);
                      if (missingInfoState?.titleMissing && e.target.value.trim()) {
                        setMissingInfoState((prev) => (prev ? { ...prev, titleMissing: false } : null));
                      }
                    }}
                    placeholder="Ví dụ: Kiểm tra giữa kỳ 1 Tin học 8"
                    className={`w-full px-3 py-2 bg-white rounded-lg text-sm font-semibold outline-none transition border ${
                      missingInfoState?.titleMissing
                        ? 'border-red-500 ring-2 ring-red-300 bg-red-50/50'
                        : 'border-slate-300 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                    <span>
                      Mã bài kiểm tra <span className="text-red-500">*</span>
                    </span>
                    {missingInfoState?.codeMissing && (
                      <span className="text-red-600 text-[11px] font-bold">
                        ⚠️ Hãy nhập mã đề
                      </span>
                    )}
                  </label>
                  <input
                    ref={examCodeInputRef}
                    type="text"
                    value={examCode}
                    onChange={(e) => {
                      setExamCode(e.target.value);
                      if (missingInfoState?.codeMissing && e.target.value.trim()) {
                        setMissingInfoState((prev) => (prev ? { ...prev, codeMissing: false } : null));
                      }
                    }}
                    placeholder="TIN8-NCV01"
                    className={`w-full px-3 py-2 bg-white rounded-lg text-sm font-mono font-bold uppercase outline-none transition border ${
                      missingInfoState?.codeMissing
                        ? 'border-red-500 ring-2 ring-red-300 bg-red-50/50'
                        : 'border-slate-300 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Khối lớp
                  </label>
                  <select
                    value={examGrade}
                    onChange={(e) => handleGradeChange(Number(e.target.value) as GradeLevel)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold outline-none cursor-pointer"
                  >
                    <option value={6}>Khối 6</option>
                    <option value={7}>Khối 7</option>
                    <option value={8}>Khối 8</option>
                    <option value={9}>Khối 9</option>
                  </select>
                </div>

                {/* DEDICATED EXAM SCHEDULE & DURATION SECTION */}
                <div className="sm:col-span-2 md:col-span-4 bg-gradient-to-br from-indigo-50/95 via-slate-50 to-purple-50/90 p-4 rounded-xl border border-indigo-200/90 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-indigo-100">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Clock className="w-4 h-4 text-amber-300" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-1.5">
                          <span>Cài đặt Thời gian làm bài & Khung giờ mở ca thi</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Quy định số phút làm bài và thời gian bắt đầu, kết thúc cho phép học sinh vào phòng thi
                        </p>
                      </div>
                    </div>

                    {/* Live Schedule Status Badge */}
                    <div>
                      {startTime || endTime ? (
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center space-x-1.5 shadow-2xs">
                          <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Đã lên lịch mở ca thi</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1.5 shadow-2xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Mở tự do (Theo công tắc đề thi)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* 1. THỜI GIAN LÀM BÀI (PHÚT) */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between">
                      <div>
                        <label className="block font-bold text-slate-800 text-xs mb-1.5 flex items-center justify-between">
                          <span className="flex items-center space-x-1.5 text-indigo-950">
                            <Timer className="w-3.5 h-3.5 text-indigo-600" />
                            <span>1. Thời gian làm bài (phút) *</span>
                          </span>
                          {missingInfoState?.durationMissing && (
                            <span className="text-red-600 text-[11px] font-bold">⚠️ Cần nhập</span>
                          )}
                        </label>
                        <input
                          ref={durationInputRef}
                          type="number"
                          min={5}
                          max={180}
                          value={durationMinutes}
                          onChange={(e) => {
                            setDurationMinutes(Number(e.target.value));
                            if (missingInfoState?.durationMissing && Number(e.target.value) >= 5) {
                              setMissingInfoState((prev) => (prev ? { ...prev, durationMissing: false } : null));
                            }
                          }}
                          className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm font-bold text-slate-900 outline-none transition focus:bg-white focus:border-indigo-500 ${
                            missingInfoState?.durationMissing ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-300'
                          }`}
                        />
                      </div>

                      {/* Quick Presets */}
                      <div className="pt-1">
                        <span className="text-[10px] text-slate-400 font-medium block mb-1">Mốc phổ biến:</span>
                        <div className="flex flex-wrap gap-1">
                          {[15, 30, 45, 60, 90].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => {
                                setDurationMinutes(mins);
                                if (missingInfoState?.durationMissing) {
                                  setMissingInfoState((prev) => (prev ? { ...prev, durationMissing: false } : null));
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer border ${
                                durationMinutes === mins
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                              }`}
                            >
                              {mins}p
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 2. THỜI GIAN BẮT ĐẦU */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block font-bold text-slate-800 text-xs flex items-center space-x-1.5 text-emerald-950">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            <span>2. Thời gian bắt đầu</span>
                          </label>
                          {startTime && (
                            <button
                              type="button"
                              onClick={() => setStartTime('')}
                              className="text-[10px] text-red-500 hover:text-red-700 font-semibold underline cursor-pointer"
                            >
                              Xóa lịch
                            </button>
                          )}
                        </div>
                        <input
                          type="datetime-local"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none transition focus:bg-white focus:border-indigo-500 cursor-pointer"
                        />
                      </div>

                      {/* Quick Helpers for Start */}
                      <div className="pt-1 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={setStartNow}
                          className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold cursor-pointer transition"
                        >
                          ⚡ Bắt đầu ngay
                        </button>
                        <span className="text-[10px] text-slate-400">
                          {startTime ? `Mở lúc: ${new Date(startTime).toLocaleTimeString('vi-VN')} ${new Date(startTime).toLocaleDateString('vi-VN')}` : '(Để trống: mở tự do)'}
                        </span>
                      </div>
                    </div>

                    {/* 3. THỜI GIAN KẾT THÚC */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block font-bold text-slate-800 text-xs flex items-center space-x-1.5 text-purple-950">
                            <CalendarClock className="w-3.5 h-3.5 text-purple-600" />
                            <span>3. Thời gian kết thúc</span>
                          </label>
                          {endTime && (
                            <button
                              type="button"
                              onClick={() => setEndTime('')}
                              className="text-[10px] text-red-500 hover:text-red-700 font-semibold underline cursor-pointer"
                            >
                              Không giới hạn
                            </button>
                          )}
                        </div>
                        <input
                          type="datetime-local"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none transition focus:bg-white focus:border-indigo-500 cursor-pointer"
                        />
                      </div>

                      {/* Quick Helpers for End */}
                      <div className="pt-1 flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => addMinutesToEnd(durationMinutes || 45)}
                          className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-[11px] font-bold cursor-pointer transition"
                          title="Cộng thêm thời gian làm bài vào giờ kết thúc"
                        >
                          +{durationMinutes || 45}p
                        </button>
                        <button
                          type="button"
                          onClick={() => addMinutesToEnd(90)}
                          className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-[11px] font-bold cursor-pointer transition"
                        >
                          +90p
                        </button>
                        <button
                          type="button"
                          onClick={setEndToday}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-[11px] font-semibold cursor-pointer transition"
                        >
                          Hết ngày
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Explanatory & Rule Box */}
                  <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-lg border border-indigo-100/90 flex items-start space-x-2">
                    <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p>
                        <b>Quy chế thi THCS Nam Cửa Việt:</b> Mỗi học sinh khi vào phòng thi sẽ có đúng <b>{durationMinutes} phút</b> làm bài đếm ngược.
                      </p>
                      {startTime || endTime ? (
                        <p className="text-indigo-800 font-semibold">
                          📅 Ca thi này được bảo vệ bởi khung giờ: {startTime ? `từ ${new Date(startTime).toLocaleTimeString('vi-VN')} ngày ${new Date(startTime).toLocaleDateString('vi-VN')}` : 'ngay bây giờ'} {endTime ? `đến ${new Date(endTime).toLocaleTimeString('vi-VN')} ngày ${new Date(endTime).toLocaleDateString('vi-VN')}` : 'không giới hạn'}. Học sinh vào ngoài khung giờ này sẽ không thể làm bài.
                        </p>
                      ) : (
                        <p className="text-slate-500">
                          💡 Nếu không nhập giờ bắt đầu/kết thúc, bài thi sẽ luôn mở tự do khi giáo viên bật công tắc <b>"Đang mở thi"</b>.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Số lần cảnh báo trước khi khóa
                  </label>
                  <select
                    value={maxViolationsBeforeLock}
                    onChange={(e) => setMaxViolationsBeforeLock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm font-bold text-amber-900 outline-none cursor-pointer focus:ring-2 focus:ring-amber-500"
                  >
                    <option value={1}>1 lần (Khóa ngay khi vi phạm lần 1)</option>
                    <option value={2}>2 lần (Cảnh báo 1 lần, lần 2 khóa)</option>
                    <option value={3}>3 lần (Mặc định: Cảnh báo 2 lần, lần 3 khóa)</option>
                    <option value={4}>4 lần (Cảnh báo 3 lần, lần 4 khóa)</option>
                    <option value={5}>5 lần (Cảnh báo 4 lần, lần 5 khóa)</option>
                    <option value={10}>10 lần (Cảnh báo nhắc nhở nhẹ)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Số lần học sinh được làm bài
                  </label>
                  <select
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-sm font-bold text-indigo-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={1}>1 lần (Chỉ làm 1 lần)</option>
                    <option value={2}>2 lần (Lấy điểm cao nhất)</option>
                    <option value={3}>3 lần (Lấy điểm cao nhất)</option>
                    <option value={4}>4 lần (Lấy điểm cao nhất)</option>
                    <option value={5}>5 lần (Lấy điểm cao nhất)</option>
                    <option value={10}>10 lần (Luyện tập tự do)</option>
                  </select>
                </div>

                {/* Target Classes Selection */}
                <div
                  ref={classesSectionRef}
                  className={`sm:col-span-2 bg-white p-3 rounded-lg border transition ${
                    missingInfoState?.classesMissing
                      ? 'border-red-500 ring-2 ring-red-300 bg-red-50/30'
                      : 'border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-slate-700 flex items-center space-x-1">
                      <School className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Lớp áp dụng kiểm tra ({cleanTargetClasses.length} lớp):</span>
                    </span>
                    {missingInfoState?.classesMissing && (
                      <span className="text-red-600 text-[11px] font-bold">
                        ⚠️ Chưa chọn lớp nào
                      </span>
                    )}
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          selectAllGradeClasses();
                          if (missingInfoState?.classesMissing) {
                            setMissingInfoState((prev) => (prev ? { ...prev, classesMissing: false } : null));
                          }
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md border border-indigo-200 cursor-pointer transition"
                      >
                        + Chọn tất cả khối {examGrade}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetClasses([])}
                        className="text-[11px] font-medium text-slate-500 hover:text-red-600 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded-md border border-slate-200 cursor-pointer transition"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  {/* Summary of currently selected classes */}
                  <div className="mb-2.5">
                    {cleanTargetClasses.length > 0 ? (
                      <div className="text-xs text-indigo-950 bg-indigo-50/80 px-2.5 py-1.5 rounded-lg border border-indigo-200 flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-indigo-700">Đã chọn ({cleanTargetClasses.length} lớp):</span>
                        <div className="flex flex-wrap gap-1">
                          {cleanTargetClasses.map((c) => (
                            <span key={c} className="font-bold bg-white text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-300 text-[11px]">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 flex items-center space-x-1">
                        <span>⚠️ Chưa chọn lớp nào (0 lớp). Vui lòng chọn lớp để học sinh có thể vào làm bài.</span>
                      </div>
                    )}
                  </div>

                  {/* Buttons for current grade */}
                  <div className="space-y-2">
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Các lớp Khối {examGrade}:</span>
                        <span className="text-slate-400 font-normal">
                          {currentGradeClasses.filter((c) => cleanTargetClasses.includes(c)).length} / {currentGradeClasses.length} lớp được chọn
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {currentGradeClasses.map((cls) => {
                          const isSelected = cleanTargetClasses.includes(cls);
                          return (
                            <button
                              key={cls}
                              type="button"
                              onClick={() => {
                                toggleClass(cls);
                                if (missingInfoState?.classesMissing) {
                                  setMissingInfoState((prev) => (prev ? { ...prev, classesMissing: false } : null));
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                              }`}
                            >
                              {cls} {isSelected && '✓'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Classes of other grades if applicable */}
                    {otherGradeClasses.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Các khối khác (nếu thi liên khối):</span>
                          {otherGradeClasses.filter((c) => cleanTargetClasses.includes(c)).length > 0 && (
                            <span className="text-purple-700 font-bold">
                              Đang chọn {otherGradeClasses.filter((c) => cleanTargetClasses.includes(c)).length} lớp khối khác
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {otherGradeClasses.map((cls) => {
                            const isSelected = cleanTargetClasses.includes(cls);
                            return (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => {
                                  toggleClass(cls);
                                  if (missingInfoState?.classesMissing) {
                                    setMissingInfoState((prev) => (prev ? { ...prev, classesMissing: false } : null));
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer border ${
                                  isSelected
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs ring-1 ring-purple-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {cls} {isSelected && '✓'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Random question subset selection */}
                <div className="sm:col-span-2 md:col-span-4 bg-gradient-to-r from-indigo-50/80 via-blue-50/70 to-purple-50/80 p-3.5 sm:p-4 rounded-xl border border-indigo-200/90 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label className="font-extrabold text-indigo-950 flex items-center space-x-2 text-xs sm:text-sm">
                      <Shuffle className="w-4 h-4 text-indigo-600" />
                      <span>Số câu bốc ngẫu nhiên cho mỗi lượt làm bài</span>
                    </label>
                    <span className="text-xs font-bold text-indigo-700 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200 shadow-2xs">
                      Ngân hàng hiện có: <b className="text-indigo-900">{questions.length} câu</b>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={questions.length}
                        value={randomQuestionCount}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(1, Math.min(questions.length, Number(e.target.value)));
                          setRandomQuestionCount(val);
                        }}
                        placeholder={`Tất cả ${questions.length} câu`}
                        className="w-36 px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-sm font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setRandomQuestionCount('')}
                        className={`px-2.5 py-1.5 rounded-lg font-semibold border text-xs cursor-pointer transition ${
                          randomQuestionCount === ''
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Thi toàn bộ ({questions.length} câu)
                      </button>

                      {questions.length > 10 && (
                        <button
                          type="button"
                          onClick={() => setRandomQuestionCount(10)}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold border text-xs cursor-pointer transition ${
                            randomQuestionCount === 10
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Bốc 10 câu
                        </button>
                      )}

                      {questions.length > 20 && (
                        <button
                          type="button"
                          onClick={() => setRandomQuestionCount(20)}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold border text-xs cursor-pointer transition ${
                            randomQuestionCount === 20
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Bốc 20 câu
                        </button>
                      )}

                      {questions.length > 30 && (
                        <button
                          type="button"
                          onClick={() => setRandomQuestionCount(30)}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold border text-xs cursor-pointer transition ${
                            randomQuestionCount === 30
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Bốc 30 câu
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] sm:text-xs text-indigo-950/80 mt-2 leading-relaxed">
                    {randomQuestionCount && Number(randomQuestionCount) > 0 && Number(randomQuestionCount) < questions.length ? (
                      <span className="font-semibold text-emerald-800 bg-emerald-50/80 border border-emerald-200 px-2 py-1 rounded-md inline-block">
                        ✓ <b>Chế độ bốc đề ngẫu nhiên đang BẬT:</b> Mỗi học sinh sẽ được bốc ngẫu nhiên <b>{randomQuestionCount} câu</b> từ ngân hàng {questions.length} câu. Khi học sinh làm lại lần khác, hệ thống sẽ tiếp tục bốc ngẫu nhiên bộ câu hỏi khác và đảo vị trí đáp án.
                      </span>
                    ) : (
                      <span>
                        💡 <b>Cách hoạt động:</b> Nếu đề có 40 câu nhưng Thầy chỉ muốn kiểm tra 20 câu, hãy nhập <b>20</b> vào ô trên. Mỗi học sinh và mỗi lần làm lại sẽ tự động nhận 20 câu ngẫu nhiên khác nhau từ 40 câu của ngân hàng đề.
                      </span>
                    )}
                  </p>
                </div>

                {/* Toggles */}
                <div className="sm:col-span-2 md:col-span-4 flex flex-wrap gap-4 pt-2 border-t border-slate-200">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-700">Trộn thứ tự câu hỏi</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shuffleOptions}
                      onChange={(e) => setShuffleOptions(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-700">Trộn vị trí đáp án A-B-C-D</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showScoreAfterSubmit}
                      onChange={(e) => setShowScoreAfterSubmit(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-700">Cho xem điểm ngay sau nộp</span>
                  </label>
                </div>
              </div>

              {/* AI Chat Assistant / Command Box */}
              <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-2 border-indigo-400/60 rounded-2xl p-4 text-white shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-800/80">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-inner">
                      <Bot className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm sm:text-base text-white flex items-center space-x-2">
                        <span>Ô CHÁT VỚI AI: YÊU CẦU CHỌN & ĐỔI ĐÁP ÁN THEO ĐỀ</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono">
                          Gemini AI
                        </span>
                      </h4>
                      <p className="text-xs text-indigo-200">
                        Thầy có thể gõ bất kỳ yêu cầu nào (vd: "Chọn đáp án theo đề", "Đề này đáp án là: 1B, 2C, 3A...", "Sửa câu 5 thành C")
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className="text-indigo-300 hover:text-white p-1 rounded-lg hover:bg-indigo-800/60 transition cursor-pointer flex items-center space-x-1 text-xs"
                    title={isChatOpen ? 'Thu gọn khung chát' : 'Mở rộng khung chát'}
                  >
                    <span>{isChatOpen ? 'Thu gọn' : 'Mở ô chát'}</span>
                    {isChatOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {isChatOpen && (
                  <div className="space-y-3 pt-1">
                    {/* Quick Suggestion Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-indigo-300 text-[11px] font-semibold flex items-center space-x-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Yêu cầu mẫu:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSendChatMessage('Hãy giải toàn bộ câu hỏi và tự động chọn đáp án đúng chuẩn xác nhất theo đề thi Tin học.')}
                        disabled={isChatting}
                        className="px-2.5 py-1 bg-indigo-800/70 hover:bg-indigo-700 text-indigo-100 rounded-lg border border-indigo-600/60 transition text-[11px] font-medium cursor-pointer"
                      >
                        🧠 Giải toàn bộ & chọn đáp án chuẩn
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChatInput('Bảng đáp án của đề này là: 1.');
                        }}
                        className="px-2.5 py-1 bg-indigo-800/70 hover:bg-indigo-700 text-indigo-100 rounded-lg border border-indigo-600/60 transition text-[11px] font-medium cursor-pointer"
                      >
                        📋 Nhập bảng đáp án riêng (vd: 1.A 2.B...)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendChatMessage('Kiểm tra kỹ các câu hỏi có đoạn mã lập trình Python, C++, Pascal để chọn đúng đáp án output.')}
                        disabled={isChatting}
                        className="px-2.5 py-1 bg-indigo-800/70 hover:bg-indigo-700 text-indigo-100 rounded-lg border border-indigo-600/60 transition text-[11px] font-medium cursor-pointer"
                      >
                        💻 Kiểm tra các câu có code
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendChatMessage('Hãy kiểm tra và giải thích lý do chọn đáp án của từng câu hỏi.')}
                        disabled={isChatting}
                        className="px-2.5 py-1 bg-indigo-800/70 hover:bg-indigo-700 text-indigo-100 rounded-lg border border-indigo-600/60 transition text-[11px] font-medium cursor-pointer"
                      >
                        📖 Giải thích chi tiết đáp án
                      </button>
                    </div>

                    {/* Messages stream */}
                    <div className="bg-slate-950/70 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2.5 border border-indigo-800/50 text-xs">
                      {chatMessages.map((msg) => {
                        const isUser = msg.role === 'user';
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 space-y-1 shadow-sm ${
                                isUser
                                  ? 'bg-indigo-600 text-white rounded-tr-xs'
                                  : 'bg-slate-800 text-indigo-100 border border-slate-700 rounded-tl-xs'
                              }`}
                            >
                              <div className="flex items-center justify-between space-x-2 text-[10px] opacity-75">
                                <span className="font-bold flex items-center space-x-1">
                                  {isUser ? (
                                    <span>Thầy Lê Gia Lợi</span>
                                  ) : (
                                    <>
                                      <Bot className="w-3 h-3 text-amber-300" />
                                      <span>Trợ lý AI</span>
                                    </>
                                  )}
                                </span>
                                <span>{msg.time}</span>
                              </div>
                              <p className="whitespace-pre-wrap leading-relaxed text-xs">{msg.content}</p>
                              {msg.updatedCount && (
                                <div className="mt-1.5 p-1.5 bg-emerald-500/20 border border-emerald-400/40 rounded-lg text-emerald-300 text-[11px] font-bold flex items-center space-x-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>Đã tự động cập nhật đáp án cho {msg.updatedCount} câu hỏi!</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {isChatting && (
                        <div className="flex justify-start">
                          <div className="bg-slate-800 text-indigo-200 border border-slate-700 rounded-2xl rounded-tl-xs px-3.5 py-2.5 flex items-center space-x-2">
                            <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
                            <span className="text-xs">AI đang suy luận giải đề & cập nhật đáp án...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatMessagesEndRef} />
                    </div>

                    {/* Chat Input Bar */}
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendChatMessage();
                            }
                          }}
                          disabled={isChatting}
                          placeholder="Nhập yêu cầu cho AI (vd: 'Chọn đáp án theo đề', 'Đáp án là: 1A, 2C...', 'Sửa câu 3 thành D')..."
                          className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950/80 border border-indigo-400/60 rounded-xl text-xs sm:text-sm text-white placeholder-indigo-300/50 outline-none focus:ring-2 focus:ring-indigo-400 transition"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSendChatMessage()}
                        disabled={isChatting || !chatInput.trim()}
                        className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-500 hover:to-emerald-500 disabled:opacity-40 text-slate-950 rounded-xl font-bold text-xs sm:text-sm transition flex items-center space-x-1.5 shadow-md cursor-pointer shrink-0 active:scale-95"
                      >
                        <Send className="w-4 h-4" />
                        <span>Gửi yêu cầu</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Answer Matrix & AI Auto-Solve Section */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-indigo-500/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4.5 h-4.5 text-amber-400" />
                      <h4 className="font-extrabold text-sm text-white tracking-wide">
                        BẢNG ĐÁP ÁN NHANH (Click A, B, C, D để đổi trực tiếp)
                      </h4>
                    </div>
                    <p className="text-xs text-indigo-200 mt-1 flex flex-wrap items-center gap-2">
                      <span>Phân bố đáp án:</span>
                      <span className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded">
                        A: {questions.filter((q) => q.correctAnswer === 'A').length}
                      </span>
                      <span className="bg-sky-950/80 border border-sky-500/40 text-sky-300 font-mono font-bold px-2 py-0.5 rounded">
                        B: {questions.filter((q) => q.correctAnswer === 'B').length}
                      </span>
                      <span className="bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono font-bold px-2 py-0.5 rounded">
                        C: {questions.filter((q) => q.correctAnswer === 'C').length}
                      </span>
                      <span className="bg-purple-950/80 border border-purple-500/40 text-purple-300 font-mono font-bold px-2 py-0.5 rounded">
                        D: {questions.filter((q) => q.correctAnswer === 'D').length}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAiSolveAnswers}
                    disabled={isSolvingAnswers || questions.length === 0}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition shadow-md cursor-pointer ${
                      isSolvingAnswers
                        ? 'bg-indigo-800 text-indigo-300 cursor-wait'
                        : 'bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-400 hover:from-amber-500 hover:to-emerald-500 text-slate-950 shadow-amber-500/20 active:scale-95'
                    }`}
                    title="Yêu cầu AI phân tích kiến thức Tin học và giải tự động toàn bộ câu hỏi để chọn đáp án đúng chuẩn xác"
                  >
                    <Sparkles className={`w-4 h-4 ${isSolvingAnswers ? 'animate-spin text-indigo-300' : 'text-slate-950'}`} />
                    <span>{isSolvingAnswers ? 'AI đang suy luận & giải đề...' : '🧠 AI giải & tự động chọn đáp án đúng'}</span>
                  </button>
                </div>

                {/* Compact Grid for Quick Answer Selection */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-1 text-xs">
                  {questions.map((q, qIdx) => (
                    <div
                      key={q.id || qIdx}
                      className="bg-slate-800/90 border border-slate-700/80 rounded-lg p-1.5 flex items-center justify-between"
                    >
                      <span className="text-[11px] font-bold text-slate-300 font-mono">
                        C{qIdx + 1}:
                      </span>
                      <div className="flex items-center space-x-1">
                        {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                          const isSelected = q.correctAnswer === letter;
                          return (
                            <button
                              key={letter}
                              type="button"
                              onClick={() => handleUpdateQuestion(qIdx, { correctAnswer: letter })}
                              className={`w-5 h-5 rounded text-[11px] font-extrabold transition cursor-pointer flex items-center justify-center ${
                                isSelected
                                  ? 'bg-emerald-500 text-slate-950 font-black shadow-xs ring-1 ring-emerald-300'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                              title={`Câu ${qIdx + 1}: Click để chọn đáp án [${letter}]`}
                            >
                              {letter}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {solveAnswersSuccess && (
                  <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 font-medium flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{solveAnswersSuccess}</span>
                  </div>
                )}
              </div>

              {/* Question list for detailed editing */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Chi tiết từng câu hỏi ({questions.length} câu)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm câu hỏi mới</span>
                  </button>
                </div>

                {/* Helpful Tip for Teacher */}
                <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center space-x-2 shadow-2xs">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <b>Mẹo sửa đáp án:</b> Thầy chỉ cần <b>click vào ô [A], [B], [C], [D]</b> hoặc nút <b>[Chọn làm đúng]</b> của phương án bất kỳ để đổi đáp án ngay lập tức.
                  </span>
                </div>

                {questions.map((q, idx) => {
                  const qNum = q.number || idx + 1;
                  const isQInvalid = missingInfoState?.invalidQuestionNumbers?.includes(qNum);
                  return (
                    <div
                      key={q.id || idx}
                      className={`rounded-xl p-4 shadow-xs space-y-3 transition border-2 ${
                        isQInvalid
                          ? 'bg-red-50/30 border-red-500 ring-2 ring-red-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      {isQInvalid && (
                        <div className="p-2.5 bg-red-100 border border-red-300 rounded-lg text-xs font-bold text-red-800 flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          <span>
                            ⚠️ Hãy nhập đủ thông tin cho Câu {idx + 1}: Vui lòng điền nội dung câu hỏi và các phương án A, B, C, D!
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs uppercase px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md">
                            Câu {idx + 1}
                          </span>
                          <span className="text-xs text-slate-600">
                            Đáp án đúng: <b className="text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded font-mono font-bold text-sm">[{q.correctAnswer}]</b>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(idx)}
                          className="text-red-500 hover:text-red-700 p-1 rounded-md text-xs flex items-center space-x-1 cursor-pointer"
                        >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa câu</span>
                      </button>
                    </div>

                    {/* Content textarea */}
                    <div>
                      <textarea
                        rows={2}
                        value={q.content}
                        onChange={(e) => handleUpdateQuestion(idx, { content: e.target.value })}
                        placeholder="Nội dung câu hỏi..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-500 font-medium"
                      />
                    </div>

                    {/* Optional code snippet preview and editor */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Đoạn code chương trình (nếu có):</span>
                        <select
                          value={q.codeLanguage || 'text'}
                          onChange={(e) => handleUpdateQuestion(idx, { codeLanguage: e.target.value as any })}
                          className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono cursor-pointer"
                        >
                          <option value="python">Python</option>
                          <option value="cpp">C++</option>
                          <option value="pascal">Pascal</option>
                          <option value="scratch">Scratch</option>
                          <option value="text">Văn bản thuần</option>
                        </select>
                      </div>
                      <textarea
                        rows={2}
                        value={q.codeSnippet || ''}
                        onChange={(e) => handleUpdateQuestion(idx, { codeSnippet: e.target.value })}
                        placeholder="Nếu câu hỏi có đoạn code, dán vào đây..."
                        className="w-full px-3 py-1.5 bg-slate-900 text-emerald-300 font-mono text-xs rounded-lg outline-none"
                      />
                    </div>

                    {/* Options A, B, C, D & Correct Answer Picker */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                        const opt = q.options.find((o) => o.id === letter);
                        const isCorrect = q.correctAnswer === letter;
                        return (
                          <div
                            key={letter}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                handleUpdateQuestion(idx, { correctAnswer: letter });
                              }
                            }}
                            className={`flex items-center space-x-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                              isCorrect
                                ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
                                : 'bg-slate-50/70 border-slate-200 hover:bg-emerald-50/40 hover:border-emerald-300'
                            }`}
                            title={`Click để đặt [${letter}] làm đáp án đúng`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateQuestion(idx, { correctAnswer: letter });
                              }}
                              className={`w-8 h-8 rounded-lg font-extrabold text-xs sm:text-sm flex items-center justify-center shrink-0 cursor-pointer transition ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-300'
                                  : 'bg-slate-200 text-slate-700 hover:bg-emerald-200 hover:text-emerald-900'
                              }`}
                              title={`Click vào đây để đặt [${letter}] làm đáp án đúng`}
                            >
                              {letter}
                            </button>
                            <input
                              type="text"
                              value={opt ? opt.text : ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleUpdateOption(idx, letter, e.target.value)}
                              placeholder={`Nội dung phương án ${letter}...`}
                              className="flex-1 bg-transparent text-xs sm:text-sm text-slate-800 outline-none font-medium cursor-text"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateQuestion(idx, { correctAnswer: letter });
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition shrink-0 flex items-center space-x-1 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-100/70'
                              }`}
                              title={`Click để đặt [${letter}] làm đáp án đúng`}
                            >
                              {isCorrect ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>ĐÚNG</span>
                                </>
                              ) : (
                                <span>Chọn đúng</span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation if available */}
                    {q.explanation && (
                      <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 p-2 rounded-lg flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span><b>Giải thích:</b> {q.explanation}</span>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>

              {/* Save Feedback Alerts */}
              {missingInfoState && missingInfoState.show && (
                <div className="p-4 bg-red-50 border-2 border-red-500 text-red-900 rounded-xl text-xs sm:text-sm flex items-start space-x-2.5 shadow-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-red-900">
                      HÃY NHẬP ĐỦ THÔNG TIN TRƯỚC KHI LƯU ĐỀ KIỂM TRA!
                    </p>
                    <p className="text-xs text-red-700">
                      Vui lòng hoàn thành các thông tin còn thiếu: <b>{missingInfoState.messages.join(' • ')}</b>
                    </p>
                  </div>
                </div>
              )}

              {saveError && !missingInfoState && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs sm:text-sm flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{saveError}</span>
                </div>
              )}

              {saveSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="font-bold">Đã lưu bài kiểm tra thành công vào ngân hàng đề! Đang đồng bộ...</span>
                </div>
              )}

              {/* Save Footer Bar */}
              <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t border-slate-200 flex items-center justify-between">
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    Quay lại tải tệp
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    Đóng
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveExam}
                  disabled={isSaving || saveSuccess}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Đang lưu bài thi vào cơ sở dữ liệu...</span>
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Đã lưu thành công!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>LƯU ĐỀ KIỂM TRA ({questions.length} CÂU)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
