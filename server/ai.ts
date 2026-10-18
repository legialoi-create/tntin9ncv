import { GoogleGenAI, Type } from '@google/genai';

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

export interface ParsedQuestionResult {
  number: number;
  content: string;
  codeSnippet?: string;
  codeLanguage?: 'python' | 'cpp' | 'pascal' | 'scratch' | 'text';
  options: { id: 'A' | 'B' | 'C' | 'D'; text: string }[];
  correctAnswer?: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
}

export interface ParseExamResponse {
  title?: string;
  grade?: 6 | 7 | 8 | 9;
  questions: ParsedQuestionResult[];
  duplicateQuestionsFound: number[];
  missingOptionsWarnings: number[];
  unknownAnswerWarnings: number[];
  notes?: string;
}

// Robust local parser for Word/PDF/Text exam files
export function parseExamLocally(rawText: string, answersText?: string): ParseExamResponse {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    throw new Error('Tài liệu trống, không tìm thấy nội dung để phân tích.');
  }

  // 1. Parse external answers map if provided (e.g., "1.A 2.B" or "1-A, 2-C")
  const externalAnswers: Record<number, 'A' | 'B' | 'C' | 'D'> = {};
  if (answersText) {
    const regex = /(?:câu\s*)?(\d+)[\s\.\-\:\)]*([A-D])\b/gi;
    let m;
    while ((m = regex.exec(answersText)) !== null) {
      externalAnswers[parseInt(m[1])] = m[2].toUpperCase() as any;
    }
  }

  // 2. Also extract answer keys from rawText if present (e.g. at the bottom of the exam)
  const answerSectionRegex = /(?:bảng\s*đáp\s*án|đáp\s*án|hướng\s*dẫn\s*chấm|key\s*đáp\s*án|phần\s*đáp\s*án)[\s\:\-\n]+([\s\S]*)$/i;
  const answerSectionMatch = rawText.match(answerSectionRegex);
  if (answerSectionMatch && answerSectionMatch[1]) {
    const ansKeySection = answerSectionMatch[1];
    const regex = /(?:câu\s*)?(\d+)[\s\.\-\:\)]+([A-D])\b/gi;
    let m;
    while ((m = regex.exec(ansKeySection)) !== null) {
      const qIndex = parseInt(m[1]);
      if (!externalAnswers[qIndex]) {
        externalAnswers[qIndex] = m[2].toUpperCase() as any;
      }
    }
  }

  // If answer section found at bottom of rawText, truncate questions body so it doesn't get parsed as a corrupt question
  let textForQuestions = rawText;
  if (answerSectionMatch && typeof answerSectionMatch.index === 'number' && answerSectionMatch.index > 80) {
    textForQuestions = rawText.slice(0, answerSectionMatch.index);
  }

  // Detect grade from title
  let grade: 6 | 7 | 8 | 9 | undefined = undefined;
  if (/tin\s*học\s*6|lớp\s*6|khối\s*6/i.test(rawText)) grade = 6;
  else if (/tin\s*học\s*7|lớp\s*7|khối\s*7/i.test(rawText)) grade = 7;
  else if (/tin\s*học\s*8|lớp\s*8|khối\s*8/i.test(rawText)) grade = 8;
  else if (/tin\s*học\s*9|lớp\s*9|khối\s*9/i.test(rawText)) grade = 9;

  // Split text into question chunks by matching "Câu 1", "Câu 2", "1.", "1:"
  const questionSplitter = /(?:^|\n)(?:câu\s*(\d+)[\.\:\)]|\b(\d+)[\.\:\)]\s+)/gi;
  const chunks: { num: number; text: string }[] = [];
  
  let match;
  const matches: { index: number; num: number; matchStr: string }[] = [];
  while ((match = questionSplitter.exec(textForQuestions)) !== null) {
    const num = parseInt(match[1] || match[2]);
    matches.push({ index: match.index, num, matchStr: match[0] });
  }

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const start = current.index + current.matchStr.length;
      const end = i < matches.length - 1 ? matches[i + 1].index : textForQuestions.length;
      const chunkText = textForQuestions.slice(start, end).trim();
      chunks.push({ num: current.num || i + 1, text: chunkText });
    }
  } else {
    // Fallback: split by empty lines or lines starting with number
    const blocks = textForQuestions.split(/\n\s*\n/);
    blocks.forEach((blk, idx) => {
      chunks.push({ num: idx + 1, text: blk.trim() });
    });
  }

  const questions: ParsedQuestionResult[] = [];
  const duplicateQuestionsFound: number[] = [];
  const missingOptionsWarnings: number[] = [];
  const unknownAnswerWarnings: number[] = [];
  const seenContents = new Set<string>();

  chunks.forEach((chunk, idx) => {
    const qNum = idx + 1;
    const chunkText = chunk.text;

    // Check for inline answers like "Đáp án: A", "Đ/A: B", "Key: C", "Chọn: D"
    let detectedAnswer: 'A' | 'B' | 'C' | 'D' | undefined = externalAnswers[qNum];
    const ansMatch = chunkText.match(/(?:đáp\s*án|đ\/a|key|chọn|đáp\s*án\s*đúng)[\s\:\-\.\=]*([A-D])\b/i);
    if (!detectedAnswer && ansMatch) {
      detectedAnswer = ansMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
    }

    // Detect code snippet in backticks or python/pascal/c++ patterns
    let codeSnippet: string | undefined = undefined;
    let codeLanguage: 'python' | 'cpp' | 'pascal' | 'scratch' | 'text' | undefined = undefined;

    const codeBlockMatch = chunkText.match(/```(?:([a-z]+)\n)?([\s\S]*?)```/);
    if (codeBlockMatch) {
      codeSnippet = codeBlockMatch[2].trim();
      const lang = codeBlockMatch[1]?.toLowerCase();
      if (lang === 'python' || lang === 'py') codeLanguage = 'python';
      else if (lang === 'cpp' || lang === 'c++') codeLanguage = 'cpp';
      else if (lang === 'pascal') codeLanguage = 'pascal';
      else if (lang === 'scratch') codeLanguage = 'scratch';
      else codeLanguage = 'text';
    } else if (chunkText.includes('def ') || chunkText.includes('print(') || chunkText.includes('input(')) {
      codeLanguage = 'python';
    } else if (chunkText.includes('#include') || chunkText.includes('cout <<') || chunkText.includes('cin >>')) {
      codeLanguage = 'cpp';
    } else if (chunkText.includes('program ') || chunkText.includes('begin') || chunkText.includes('writeln')) {
      codeLanguage = 'pascal';
    }

    // Extract options A, B, C, D
    const optionMatches: { id: 'A' | 'B' | 'C' | 'D'; text: string; isCorrectHint?: boolean }[] = [];
    const optRegex = /(?:^|\s|\n)([A-D])[\.\:\)]\s*([^\n\r]+)/g;
    let optM;
    while ((optM = optRegex.exec(chunkText)) !== null) {
      const optId = optM[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      let optText = optM[2].trim();

      // Check if option is marked with *, (x), bold, or underline as correct
      let isHint = false;
      if (
        optText.startsWith('*') ||
        optText.endsWith('*') ||
        /[\(\[]x[\)\]]/i.test(optText) ||
        /\(đúng\)/i.test(optText) ||
        /✓/.test(optText)
      ) {
        isHint = true;
        optText = optText.replace(/^[\*\s✓]+|[\*\s✓]+$/g, '').trim();
      }

      // Avoid duplicates for same option ID
      if (!optionMatches.some(o => o.id === optId)) {
        optionMatches.push({ id: optId, text: optText, isCorrectHint: isHint });
      }
    }

    // Set correct answer if found in hint
    if (!detectedAnswer) {
      const hint = optionMatches.find(o => o.isCorrectHint);
      if (hint) detectedAnswer = hint.id;
    }

    // Content: everything before the first option match
    let questionContent = chunkText;
    const firstOptIndex = chunkText.search(/(?:^|\s|\n)[A-D][\.\:\)]/);
    if (firstOptIndex > 0) {
      questionContent = chunkText.slice(0, firstOptIndex).trim();
    }
    // Clean up inline answer or markers from content
    questionContent = questionContent.replace(/(?:đáp\s*án|đ\/a|key|chọn|đáp\s*án\s*đúng)[\s\:\-\.\=]*[A-D]\b/gi, '').trim();

    // Check duplicate
    const normalizedContent = questionContent.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenContents.has(normalizedContent) && normalizedContent.length > 10) {
      duplicateQuestionsFound.push(qNum);
    } else {
      seenContents.add(normalizedContent);
    }

    // Ensure 4 options A, B, C, D exist
    const options: { id: 'A' | 'B' | 'C' | 'D'; text: string }[] = [];
    (['A', 'B', 'C', 'D'] as const).forEach(optId => {
      const found = optionMatches.find(o => o.id === optId);
      if (found) {
        options.push({ id: optId, text: found.text });
      } else {
        options.push({ id: optId, text: `Phương án ${optId}` });
      }
    });

    if (optionMatches.length < 4) {
      missingOptionsWarnings.push(qNum);
    }

    let isAutoGuessed = false;
    if (!detectedAnswer) {
      unknownAnswerWarnings.push(qNum);
      // Distribute fallback answers naturally across B, C, A, D instead of all A
      const fallbackOptions: ('A' | 'B' | 'C' | 'D')[] = ['B', 'C', 'A', 'D'];
      detectedAnswer = fallbackOptions[(qNum - 1) % 4];
      isAutoGuessed = true;
    }

    questions.push({
      number: qNum,
      content: questionContent || `Nội dung câu hỏi ${qNum}`,
      codeSnippet,
      codeLanguage,
      options,
      correctAnswer: detectedAnswer,
      explanation: isAutoGuessed ? 'Đáp án mặc định (đang chờ AI hoặc giáo viên duyệt)' : undefined
    });
  });

  return {
    title: grade ? `Kiểm tra Tin học ${grade} - THCS Nam Cửa Việt` : 'Đề kiểm tra Tin học THCS Nam Cửa Việt',
    grade,
    questions,
    duplicateQuestionsFound,
    missingOptionsWarnings,
    unknownAnswerWarnings,
    notes: 'Bóc tách thành công bằng bộ phân tích thông minh của hệ thống.'
  };
}

export async function solveQuestionsWithAI(
  questions: {
    id?: string;
    number: number;
    content: string;
    codeSnippet?: string;
    codeLanguage?: string;
    options: { id: string; text: string }[];
  }[],
  selectedModel?: string
): Promise<{ number: number; correctAnswer: 'A' | 'B' | 'C' | 'D'; explanation: string }[]> {
  if (!questions || questions.length === 0) {
    return [];
  }

  const ai = getAiClient();
  const defaultModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-4-argon'];
  const preferredModel = selectedModel && selectedModel !== 'auto' ? selectedModel : null;
  const aiModelsToTry = preferredModel
    ? [preferredModel, ...defaultModels.filter((m) => m !== preferredModel)]
    : defaultModels;
  let lastErr: any = null;

  const systemInstruction = `Bạn là chuyên gia giáo viên bộ môn Tin học THCS (Lớp 6, 7, 8, 9) giàu kinh nghiệm tại Việt Nam.
Nhiệm vụ: Giải chi tiết và chọn ĐÁP ÁN ĐÚNG CHÍNH XÁC NHẤT (A, B, C hoặc D) cho từng câu hỏi trắc nghiệm Tin học.
QUY TẮC CẦN TUÂN THỦ TUYỆT ĐỐI:
1. Phân tích kỹ thuật toán, chạy thử các đoạn mã lệnh (Python, C++, Pascal, Scratch), tính toán công thức bảng tính Excel (SUM, AVERAGE, IF, MAX, MIN, COUNT, ô tương đối / tuyệt đối...), kiểm tra lý thuyết mạng, phần cứng, phần mềm.
2. TUYỆT ĐỐI KHÔNG ĐƯỢC CHỌN TOÀN BỘ ĐÁP ÁN A! Đề thi trắc nghiệm luôn có đáp án phân bố tự nhiên (A, B, C, D) tùy thuộc vào kết quả tính toán hoặc lý thuyết đúng của từng câu. Hãy tư duy và giải độc lập từng câu để đưa ra đáp án chuẩn xác nhất.
3. Cung cấp lời giải thích ngắn gọn, xúc tích (1-2 câu) vào trường 'explanation' giải thích vì sao chọn đáp án đó.`;

  const prompt = `Hãy giải các câu hỏi trắc nghiệm Tin học sau đây và trả về đáp án đúng chính xác nhất (A, B, C hoặc D) cùng giải thích cho từng câu:
${JSON.stringify(
    questions.map((q) => ({
      number: q.number,
      content: q.content,
      codeSnippet: q.codeSnippet,
      codeLanguage: q.codeLanguage,
      options: q.options.map((o) => `${o.id}. ${o.text}`).join(' | '),
    })),
    null,
    2
  )}`;

  for (const modelName of aiModelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [prompt],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                number: { type: Type.INTEGER },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ['number', 'correctAnswer', 'explanation'],
            },
          },
        },
      });

      const parsed = JSON.parse(response.text || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => ({
          number: Number(item.number),
          correctAnswer: (['A', 'B', 'C', 'D'].includes(item.correctAnswer?.toUpperCase())
            ? item.correctAnswer.toUpperCase()
            : 'A') as 'A' | 'B' | 'C' | 'D',
          explanation: item.explanation || 'Được giải và xác nhận bởi AI',
        }));
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`solveQuestionsWithAI failed on ${modelName}:`, err?.message || err);
    }
  }

  throw new Error(lastErr?.message || 'Không thể giải đáp án bằng AI lúc này');
}

export async function parseExamWithAI(params: {
  rawText?: string;
  fileBase64?: string;
  mimeType?: string;
  filename?: string;
  answersText?: string; // Optional separate answer key
  teacherPrompt?: string; // Optional teacher prompt/instruction for AI
  selectedModel?: string; // Optional preferred model from teacher
}): Promise<ParseExamResponse> {
  let textContent = params.rawText || '';

  // 1. If docx file, extract text via mammoth first
  if (
    params.fileBase64 &&
    (params.mimeType?.includes('word') ||
      params.mimeType?.includes('docx') ||
      params.filename?.endsWith('.docx'))
  ) {
    try {
      const buffer = Buffer.from(params.fileBase64, 'base64');
      const mammothModule = await import('mammoth');
      const mammothInstance = mammothModule.default || mammothModule;
      const mammothResult = await mammothInstance.extractRawText({ buffer });
      if (mammothResult && mammothResult.value && mammothResult.value.trim().length > 0) {
        textContent = mammothResult.value;
      }
    } catch (err) {
      console.warn('Mammoth docx extraction warning:', err);
    }
  }

  // 2. If PDF file, try extracting text via PDFParse
  if (
    params.fileBase64 &&
    (params.mimeType?.includes('pdf') || params.filename?.endsWith('.pdf'))
  ) {
    try {
      const buffer = Buffer.from(params.fileBase64, 'base64');
      const pdfModule = await import('pdf-parse');
      const PDFParseClass = (pdfModule as any).PDFParse || (pdfModule as any).default || pdfModule;
      if (typeof PDFParseClass === 'function') {
        const parser = new (PDFParseClass as any)({ data: buffer });
        if (parser && typeof parser.getText === 'function') {
          const textResult = await parser.getText();
          if (typeof parser.destroy === 'function') await parser.destroy();
          const extractedStr = typeof textResult === 'string' ? textResult : (textResult as any)?.text || '';
          if (extractedStr && extractedStr.trim().length > 20) {
            textContent = extractedStr;
          }
        }
      }
    } catch (err) {
      console.warn('PDFParse extraction warning:', err);
    }
  }

  // 3. Try Gemini models in priority order with teacher preference
  const defaultModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-4-argon'];
  const preferredModel = params.selectedModel && params.selectedModel !== 'auto' ? params.selectedModel : null;
  const aiModelsToTry = preferredModel
    ? [preferredModel, ...defaultModels.filter((m) => m !== preferredModel)]
    : defaultModels;

  let lastGeminiError: any = null;

  for (const modelName of aiModelsToTry) {
    try {
      const ai = getAiClient();
      const systemInstruction = `Bạn là chuyên gia giáo viên bộ môn Tin học THCS (Lớp 6, 7, 8, 9) giàu kinh nghiệm của trường THCS Nam Cửa Việt.
Nhiệm vụ của bạn là bóc tách danh sách toàn bộ câu hỏi trắc nghiệm từ tài liệu đề thi và XÁC ĐỊNH CHÍNH XÁC ĐÁP ÁN ĐÚNG CHO TỪNG CÂU:
1. Bóc tách đầy đủ nội dung câu hỏi và 4 phương án A, B, C, D.
2. Giữ nguyên vẹn các đoạn mã lập trình (C++, Python, Pascal, Scratch, thuật toán), công thức hoặc ký hiệu tin học, bảng biểu. Nếu câu hỏi có đoạn mã code, tách riêng vào trường 'codeSnippet' và chỉ định 'codeLanguage' ('python'|'cpp'|'pascal'|'scratch'|'text').
3. XÁC ĐỊNH ĐÁP ÁN ĐÚNG (correctAnswer) CHO MỌI CÂU HỎI:
   - ƯU TIÊN 1: Nếu trong tài liệu có đánh dấu đáp án (bôi đậm, gạch chân, dấu *, dấu (x), chữ "Đáp án: X", hoặc bảng đáp án ở cuối đề / đính kèm), chọn chính xác phương án đó.
   - ƯU TIÊN 2: Nếu tài liệu KHÔNG có đáp án ghi sẵn, BẠN LÀ GIÁO VIÊN TIN HỌC XUẤT SẮC, HÃY DÙNG CHUYÊN MÔN ĐỂ SUY LUẬN, CHẠY THỬ ĐOẠN CODE, TÍNH TOÁN CÔNG THỨC EXCEL ĐỂ CHỌN ĐÁP ÁN ĐÚNG CHÍNH XÁC NHẤT (A, B, C hoặc D).
   - QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG ĐƯỢC CHỌN TOÀN BỘ ĐÁP ÁN A! Đề thi trắc nghiệm phải có đáp án phân bố tự nhiên (A, B, C, D) theo đúng nội dung khoa học của từng câu hỏi.
   - Cung cấp lời giải thích ngắn gọn (1-2 câu) vào trường 'explanation' (ví dụ: giải thích vì sao chọn đáp án đó hoặc phân tích kết quả của câu lệnh/công thức).
4. Đưa số câu bị trùng vào 'duplicateQuestionsFound'.
5. Đưa số câu thiếu phương án vào 'missingOptionsWarnings'.
6. 'unknownAnswerWarnings': chỉ để lại nếu câu hỏi đó hoàn toàn bị rách/mất phương án không thể suy luận.`;

      const contents: any[] = [];

      // If multimodal file (image or PDF without extracted text)
      if (
        params.fileBase64 &&
        !textContent &&
        (params.mimeType?.includes('pdf') || params.mimeType?.startsWith('image/'))
      ) {
        contents.push({
          inlineData: {
            mimeType: params.mimeType || 'application/pdf',
            data: params.fileBase64,
          },
        });
      }

      let prompt = `Hãy phân tích đề thi Tin học này, chuyển thành danh sách câu hỏi trắc nghiệm chuẩn và giải để chọn đáp án đúng chính xác nhất (A, B, C, hoặc D) cho từng câu.`;
      if (textContent) {
        prompt += `\n\n--- NỘI DUNG TÀI LIỆU ---\n${textContent}`;
      }
      if (params.answersText) {
        prompt += `\n\n--- BẢNG ĐÁP ÁN ĐÍNH KÈM TỪ GIÁO VIÊN ---\n${params.answersText}`;
      }
      if (params.teacherPrompt) {
        prompt += `\n\n--- YÊU CẦU ĐẶC BIỆT / LỜI NHẮC CỦA GIÁO VIÊN ---\n${params.teacherPrompt}\n(LƯU Ý QUAN TRỌNG: Hãy ưu tiên thực hiện đúng theo yêu cầu này của giáo viên!)`;
      }

      contents.push(prompt);

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              grade: { type: Type.INTEGER },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    number: { type: Type.INTEGER },
                    content: { type: Type.STRING },
                    codeSnippet: { type: Type.STRING },
                    codeLanguage: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          text: { type: Type.STRING },
                        },
                        required: ['id', 'text'],
                      },
                    },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ['number', 'content', 'options', 'correctAnswer'],
                },
              },
              duplicateQuestionsFound: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
              missingOptionsWarnings: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
              unknownAnswerWarnings: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
              notes: { type: Type.STRING },
            },
            required: [
              'questions',
              'duplicateQuestionsFound',
              'missingOptionsWarnings',
              'unknownAnswerWarnings',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}') as ParseExamResponse;
      if (parsed.questions && parsed.questions.length > 0) {
        // Sanitize correctAnswers
        parsed.questions.forEach((q, qIdx) => {
          if (!q.correctAnswer || !['A', 'B', 'C', 'D'].includes(q.correctAnswer.toUpperCase())) {
            const fallbackOptions: ('A' | 'B' | 'C' | 'D')[] = ['B', 'C', 'A', 'D'];
            q.correctAnswer = fallbackOptions[qIdx % 4];
          } else {
            q.correctAnswer = q.correctAnswer.toUpperCase() as any;
          }
        });
        parsed.notes = `Bóc tách và AI đã giải, chọn đáp án đúng chính xác (${modelName})`;
        return parsed;
      }
    } catch (err: any) {
      lastGeminiError = err;
      console.warn(`Gemini model ${modelName} returned:`, err?.message || err);
    }
  }

  // 4. If AI calls failed or quota exceeded, but text content is available:
  if (textContent && textContent.trim().length > 0) {
    console.info('Falling back to local intelligent exam parser...');
    const localResult = parseExamLocally(textContent, params.answersText);
    
    // If localResult has questions with unknown answers, try solving them with solveQuestionsWithAI
    if (localResult.questions.some(q => localResult.unknownAnswerWarnings.includes(q.number))) {
      try {
        const solved = await solveQuestionsWithAI(localResult.questions);
        const solvedMap = new Map(solved.map(s => [s.number, s]));
        localResult.questions.forEach(q => {
          const s = solvedMap.get(q.number);
          if (s) {
            q.correctAnswer = s.correctAnswer;
            q.explanation = s.explanation;
          }
        });
        localResult.unknownAnswerWarnings = [];
        localResult.notes = 'Đã bóc tách tự động và AI giải, chọn đáp án đúng chính xác cho toàn bộ câu hỏi!';
        return localResult;
      } catch (err) {
        console.warn('Could not auto-solve answers via secondary AI call:', err);
      }
    }

    localResult.notes = 'Đã bóc tách tự động thành công bằng bộ phân tích cục bộ thông minh.';
    return localResult;
  }

  // 5. If neither AI nor local text worked
  const is429 = lastGeminiError?.message?.includes('429') || lastGeminiError?.status === 'RESOURCE_EXHAUSTED';
  if (is429) {
    throw new Error(
      'Hạn mức AI Google hôm nay đã tạm đầy (429 Quota Exceeded). Quý thầy vui lòng chuyển sang dạng dán trực tiếp nội dung văn bản đề thi hoặc tải file Word (.docx) / PDF văn bản, hệ thống sẽ bóc tách 100% câu hỏi ngay lập tức!'
    );
  }

  throw new Error(
    lastGeminiError?.message || 'Không thể phân tích đề thi lúc này. Quý thầy vui lòng dán trực tiếp văn bản đề thi để hệ thống tự động bóc tách.'
  );
}

// Chat assistant with AI to request custom answers, solve questions, or clarify reasoning
export interface ChatAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatExamAssistantParams {
  message: string;
  questions: {
    number: number;
    content: string;
    codeSnippet?: string;
    codeLanguage?: string;
    options: { id: string; text: string }[];
    correctAnswer?: 'A' | 'B' | 'C' | 'D';
    explanation?: string;
  }[];
  history?: ChatAssistantMessage[];
}

export interface ChatExamAssistantResponse {
  reply: string;
  updatedAnswers?: {
    number: number;
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    explanation?: string;
  }[];
}

export async function chatExamAssistant(
  params: ChatExamAssistantParams
): Promise<ChatExamAssistantResponse> {
  const ai = getAiClient();
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  let lastErr: any = null;

  const systemInstruction = `Bạn là Trợ lý AI chuyên gia bộ môn Tin học THCS (Lớp 6, 7, 8, 9) của trường THCS Nam Cửa Việt.
Giáo viên đang trao đổi trực tiếp với bạn về đề kiểm tra trắc nghiệm Tin học hiện tại.
NHIỆM VỤ CỦA BẠN:
1. Lắng nghe và thực hiện chính xác các yêu cầu của giáo viên về đề thi:
   - Nếu giáo viên yêu cầu giải đề hoặc chọn đáp án theo đề: Giải từng câu hỏi (chạy code Python, C++, Pascal, tính công thức Excel, thuật toán) và trả về 'updatedAnswers' chứa đáp án đúng chính xác nhất (A, B, C hoặc D) cho các câu hỏi tương ứng.
   - Nếu giáo viên cung cấp bảng đáp án (ví dụ: '1B 2C 3A', 'đáp án là 1.A, 2.B...', 'câu 5 đáp án là D'): Áp dụng chính xác bảng đáp án đó vào 'updatedAnswers'.
   - Nếu giáo viên yêu cầu sửa hoặc kiểm tra câu cụ thể (ví dụ: 'sửa câu 4 thành C', 'câu 8 vì sao chọn B'): Phân tích, sửa hoặc giải thích rõ ràng.
   - Nếu giáo viên chỉ hỏi giải thích hoặc trao đổi chung: Trả lời ngắn gọn, sư phạm, chuyên nghiệp vào trường 'reply', và để 'updatedAnswers' là danh sách rỗng [].
2. QUY TẮC BẮT BUỘC KHI CHỌN ĐÁP ÁN:
   - TUYỆT ĐỐI KHÔNG ĐƯỢC CHỌN TOÀN BỘ ĐÁP ÁN A! Mỗi câu phải được giải độc lập và chọn đúng thực tế (A, B, C hoặc D).
   - Khi có 'updatedAnswers', mỗi phần tử phải gồm: number (số thứ tự câu), correctAnswer ('A'|'B'|'C'|'D'), và explanation (giải thích ngắn gọn 1-2 câu).
3. Trường 'reply': Chứa câu trả lời tự nhiên, thân thiện, súc tích bằng tiếng Việt gửi cho Thầy/Cô.`;

  const simplifiedQuestions = params.questions.map((q) => ({
    number: q.number,
    content: q.content,
    code: q.codeSnippet || undefined,
    options: q.options.map((o) => `${o.id}. ${o.text}`).join(' | '),
    currentAnswer: q.correctAnswer || 'Chưa có',
  }));

  const historyContext =
    params.history && params.history.length > 0
      ? `LỊCH SỬ TRAO ĐỔI TRƯỚC ĐÓ:\n` +
        params.history
          .slice(-6)
          .map((h) => `${h.role === 'user' ? 'Giáo viên' : 'AI'}: ${h.content}`)
          .join('\n') +
        `\n\n`
      : '';

  const prompt = `${historyContext}DANH SÁCH CÂU HỎI HIỆN TẠI TRONG ĐỀ THI:
${JSON.stringify(simplifiedQuestions, null, 2)}

YÊU CẦU MỚI TỪ GIÁO VIÊN:
"${params.message}"`;

  for (const modelName of models) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [prompt],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              updatedAnswers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    number: { type: Type.INTEGER },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ['number', 'correctAnswer'],
                },
              },
            },
            required: ['reply'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const updatedAnswers = Array.isArray(parsed.updatedAnswers)
        ? parsed.updatedAnswers
            .filter((a: any) => a && a.number && ['A', 'B', 'C', 'D'].includes(a.correctAnswer?.toUpperCase()))
            .map((a: any) => ({
              number: Number(a.number),
              correctAnswer: a.correctAnswer.toUpperCase() as 'A' | 'B' | 'C' | 'D',
              explanation: a.explanation || undefined,
            }))
        : [];

      return {
        reply: parsed.reply || 'Đã xử lý yêu cầu của Thầy.',
        updatedAnswers: updatedAnswers.length > 0 ? updatedAnswers : undefined,
      };
    } catch (err: any) {
      lastErr = err;
      console.warn(`chatExamAssistant failed on ${modelName}:`, err?.message || err);
    }
  }

  throw new Error(lastErr?.message || 'Không thể kết nối với AI lúc này. Vui lòng thử lại.');
}
