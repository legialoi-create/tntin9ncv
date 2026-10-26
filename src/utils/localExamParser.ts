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
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (result && result.value && result.value.trim().length > 0) {
      return result.value;
    }
  } catch (err) {
    console.warn('Mammoth docx extraction error:', err);
  }
  return '';
}

export async function extractTextFromFile(file: File): Promise<string> {
  // If plain text or markdown
  if (
    file.type.includes('text') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.md') ||
    file.name.endsWith('.csv')
  ) {
    try {
      return await file.text();
    } catch (e) {
      console.warn('Text file read error:', e);
    }
  }

  // If docx
  if (
    file.name.endsWith('.docx') ||
    file.name.endsWith('.doc') ||
    file.type.includes('word') ||
    file.type.includes('docx')
  ) {
    const docxText = await extractTextFromDocxFile(file);
    if (docxText && docxText.trim().length > 0) {
      return docxText;
    }
  }

  return '';
}

export function parseExamLocally(rawText: string, answersText?: string): ParseExamResponse {
  const cleanInput = (rawText || '').trim();
  if (!cleanInput) {
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
  const answerSectionMatch = cleanInput.match(answerSectionRegex);
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
  let textForQuestions = cleanInput;
  if (answerSectionMatch && typeof answerSectionMatch.index === 'number' && answerSectionMatch.index > 80) {
    textForQuestions = cleanInput.slice(0, answerSectionMatch.index);
  }

  // Detect grade from title or body
  let grade: 6 | 7 | 8 | 9 | undefined = undefined;
  if (/tin\s*học\s*6|lớp\s*6|khối\s*6/i.test(cleanInput)) grade = 6;
  else if (/tin\s*học\s*7|lớp\s*7|khối\s*7/i.test(cleanInput)) grade = 7;
  else if (/tin\s*học\s*8|lớp\s*8|khối\s*8/i.test(cleanInput)) grade = 8;
  else if (/tin\s*học\s*9|lớp\s*9|khối\s*9/i.test(cleanInput)) grade = 9;

  // Detect title from first non-empty lines
  let detectedTitle = '';
  const firstLines = cleanInput.split('\n').map((l) => l.trim()).filter(Boolean);
  if (firstLines.length > 0) {
    const candidate = firstLines[0];
    if (
      !/^(?:câu|bài|\d+[\.\:\)])/i.test(candidate) &&
      candidate.length < 120 &&
      (candidate.toUpperCase().includes('ĐỀ') ||
        candidate.toUpperCase().includes('KIỂM TRA') ||
        candidate.toUpperCase().includes('TIN HỌC'))
    ) {
      detectedTitle = candidate.replace(/^[\#\*\-\s]+|[\#\*\-\s]+$/g, '').trim();
    }
  }

  // Split text into question chunks by matching "Câu 1", "Câu 2", "Bài 1", "1.", "1:", "1)", "1/"
  const questionSplitter = /(?:^|\n)(?:(?:câu|bài)\s*(\d+)[\.\:\)\-\s]|\b(\d+)[\.\:\)\/]\s+)/gi;
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
    // Fallback: split by double line breaks
    const blocks = textForQuestions.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    blocks.forEach((blk, idx) => {
      chunks.push({ num: idx + 1, text: blk });
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

    // Advanced Option Extractor (Handles single line "A. 1 B. 2 C. 3 D. 4", multiline, lowercase, slash, etc.)
    const optionMatches: { id: 'A' | 'B' | 'C' | 'D'; text: string; isCorrectHint?: boolean }[] = [];

    // Regex to find option markers: [A-D][.:)/-]
    const optMarkerRegex = /(?:^|[\n\r]|\s{2,}|\t)(?:(?:\(|\[)?([A-D]|[a-d])(?:\)|\])?[\.\:\)\/\-]\s*)/g;
    const optMarkerPositions: { optId: 'A' | 'B' | 'C' | 'D'; start: number; end: number }[] = [];

    let oMatch;
    while ((oMatch = optMarkerRegex.exec(chunkText)) !== null) {
      const letter = oMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      optMarkerPositions.push({
        optId: letter,
        start: oMatch.index,
        end: oMatch.index + oMatch[0].length,
      });
    }

    if (optMarkerPositions.length > 0) {
      for (let i = 0; i < optMarkerPositions.length; i++) {
        const curOpt = optMarkerPositions[i];
        const nextStart = i < optMarkerPositions.length - 1 ? optMarkerPositions[i + 1].start : chunkText.length;
        let optBody = chunkText.slice(curOpt.end, nextStart).trim();

        // Strip inline answer statement at the end of option D
        optBody = optBody.replace(/(?:đáp\s*án|đ\/a|key|chọn|đáp\s*án\s*đúng)[\s\:\-\.\=]*[A-D]\b/gi, '').trim();

        let isHint = false;
        if (
          optBody.startsWith('*') ||
          optBody.endsWith('*') ||
          /[\(\[]x[\)\]]/i.test(optBody) ||
          /\(đúng\)/i.test(optBody) ||
          /✓/.test(optBody)
        ) {
          isHint = true;
          optBody = optBody.replace(/^[\*\s✓]+|[\*\s✓]+$/g, '').trim();
        }

        if (!optionMatches.some((o) => o.id === curOpt.optId)) {
          optionMatches.push({ id: curOpt.optId, text: optBody, isCorrectHint: isHint });
        }
      }
    }

    // Check if any option had an answer hint
    if (!detectedAnswer) {
      const hint = optionMatches.find((o) => o.isCorrectHint);
      if (hint) detectedAnswer = hint.id;
    }

    // Extract Question Content (everything before the first option marker)
    let questionContent = chunkText;
    if (optMarkerPositions.length > 0) {
      questionContent = chunkText.slice(0, optMarkerPositions[0].start).trim();
    }
    questionContent = questionContent
      .replace(/(?:đáp\s*án|đ\/a|key|chọn|đáp\s*án\s*đúng)[\s\:\-\.\=]*[A-D]\b/gi, '')
      .trim();

    // Check duplicate questions
    const normalizedContent = questionContent.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenContents.has(normalizedContent) && normalizedContent.length > 10) {
      duplicateQuestionsFound.push(qNum);
    } else {
      seenContents.add(normalizedContent);
    }

    // Ensure all 4 options A, B, C, D exist with non-empty text
    const options: { id: 'A' | 'B' | 'C' | 'D'; text: string }[] = [];
    (['A', 'B', 'C', 'D'] as const).forEach((optId) => {
      const found = optionMatches.find((o) => o.id === optId);
      if (found && found.text && found.text.trim()) {
        options.push({ id: optId, text: found.text.trim() });
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
      explanation: isAutoGuessed ? 'Đáp án được khởi tạo mặc định (Thầy có thể sửa lại)' : undefined,
    });
  });

  const finalTitle =
    detectedTitle ||
    (grade
      ? `Đề kiểm tra Tin học ${grade} - THCS Nam Cửa Việt`
      : 'Đề kiểm tra Tin học - THCS Nam Cửa Việt');

  return {
    title: finalTitle,
    grade,
    questions,
    duplicateQuestionsFound,
    missingOptionsWarnings,
    unknownAnswerWarnings,
    notes: 'Bóc tách thành công bằng bộ phân tích tự động thông minh.',
  };
}
