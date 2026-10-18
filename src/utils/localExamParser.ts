import mammoth from 'mammoth';

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

export async function extractTextFromDocxFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

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

  // If answer section found at bottom of rawText, truncate questions body
  let textForQuestions = rawText;
  if (answerSectionMatch && typeof answerSectionMatch.index === 'number' && answerSectionMatch.index > 80) {
    textForQuestions = rawText.slice(0, answerSectionMatch.index);
  }

  // Detect grade from title or body
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
    // Fallback: split by empty lines or blocks
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

    // Check for inline answers
    let detectedAnswer: 'A' | 'B' | 'C' | 'D' | undefined = externalAnswers[qNum];
    const ansMatch = chunkText.match(/(?:đáp\s*án|đ\/a|key|chọn|đáp\s*án\s*đúng)[\s\:\-\.\=]*([A-D])\b/i);
    if (!detectedAnswer && ansMatch) {
      detectedAnswer = ansMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
    }

    // Detect code snippet
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

      if (!optionMatches.some(o => o.id === optId)) {
        optionMatches.push({ id: optId, text: optText, isCorrectHint: isHint });
      }
    }

    if (!detectedAnswer) {
      const hint = optionMatches.find(o => o.isCorrectHint);
      if (hint) detectedAnswer = hint.id;
    }

    let questionContent = chunkText;
    const firstOptIndex = chunkText.search(/(?:^|\s|\n)[A-D][\.\:\)]/);
    if (firstOptIndex > 0) {
      questionContent = chunkText.slice(0, firstOptIndex).trim();
    }
    questionContent = questionContent.replace(/(?:đáp\s*án|đ\/a|key|chọn|đáp\s*án\s*đúng)[\s\:\-\.\=]*[A-D]\b/gi, '').trim();

    const normalizedContent = questionContent.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenContents.has(normalizedContent) && normalizedContent.length > 10) {
      duplicateQuestionsFound.push(qNum);
    } else {
      seenContents.add(normalizedContent);
    }

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
      explanation: isAutoGuessed ? 'Đáp án tự động được thiết lập' : undefined
    });
  });

  return {
    title: grade ? `Kiểm tra Tin học ${grade} - THCS Nam Cửa Việt` : 'Đề kiểm tra Tin học THCS Nam Cửa Việt',
    grade,
    questions,
    duplicateQuestionsFound,
    missingOptionsWarnings,
    unknownAnswerWarnings,
    notes: 'Bóc tách thành công bằng bộ phân tích tự động thông minh.'
  };
}
