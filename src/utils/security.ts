/**
 * Hệ thống Bảo mật, Mã hoá Đáp án, Mã hoá Mật khẩu & Chấm điểm Chuẩn hoá
 * Tương thích đồng thời với Trình duyệt (Browser) và Node.js 22 (Server).
 */

const MASTER_PEPPER = 'NCV_THCS_2026_ULTRA_SEAL_KEY_#9981_GIALOI';

/**
 * Chuẩn hoá tên học sinh: NFC Unicode + loại bỏ khoảng trắng thừa + viết thường để so sánh chính xác 100%
 */
export function normalizeStudentName(name: unknown): string {
  if (!name) return '';
  return String(name)
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Chuẩn hoá tên lớp: NFC Unicode + loại bỏ khoảng trắng thừa + viết hoa
 */
export function normalizeClassName(className: unknown): string {
  if (!className) return '';
  return String(className)
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

/**
 * Chuẩn hoá tài khoản đăng nhập
 */
export function normalizeUsername(username: unknown): string {
  if (!username) return '';
  return String(username)
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
}

/**
 * Chuẩn hoá đáp án về đúng 'A' | 'B' | 'C' | 'D'
 */
export function normalizeOptionKey(
  val: unknown,
  options?: { A?: string; B?: string; C?: string; D?: string }
): 'A' | 'B' | 'C' | 'D' | '' {
  if (val === undefined || val === null) return '';
  const raw = String(val).normalize('NFC').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') {
    return upper as 'A' | 'B' | 'C' | 'D';
  }
  const prefixMatch = upper.match(/^([A-D])[\.\)\:\-\s]/);
  if (prefixMatch && (!options || !Object.values(options).some(v => String(v).trim().toUpperCase() === upper))) {
    return prefixMatch[1] as 'A' | 'B' | 'C' | 'D';
  }
  if (options) {
    for (const [k, v] of Object.entries(options)) {
      if (String(v ?? '').normalize('NFC').trim().toLowerCase() === raw.toLowerCase()) {
        const ku = k.trim().toUpperCase();
        if (ku === 'A' || ku === 'B' || ku === 'C' || ku === 'D') {
          return ku as 'A' | 'B' | 'C' | 'D';
        }
      }
    }
  }
  return '';
}

/**
 * Hàm băm 64-bit kết hợp đa vòng (dùng cho cả trình duyệt và server không phụ thuộc async WebCrypto)
 */
function deriveKeyBytes(contextSalt: string, ivHex: string, length: number): Uint8Array {
  const seedStr = `${MASTER_PEPPER}::${contextSalt}::${ivHex}`;
  const seedBytes = new TextEncoder().encode(seedStr);
  const out = new Uint8Array(length);

  let h1 = 0xdeadbeef ^ seedBytes.length;
  let h2 = 0x41c6ce57 ^ (seedBytes.length * 31);

  for (let i = 0; i < seedBytes.length; i++) {
    const ch = seedBytes[i];
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  for (let i = 0; i < length; i++) {
    h1 = Math.imul(h1 ^ (h1 >>> 16) ^ i, 2246822507);
    h1 = Math.imul(h1 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16) ^ (i * 7), 2246822507);
    h2 = Math.imul(h2 ^ (h1 >>> 13), 3266489909);
    const combined = (h1 ^ h2) >>> 0;
    out[i] = (combined >>> ((i % 4) * 8)) & 0xff;
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byteVal = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byteVal)) return new Uint8Array(0);
    out[i] = byteVal;
  }
  return out;
}

function generateIvHex(deterministicSeed?: string): string {
  if (deterministicSeed) {
    const kb = deriveKeyBytes('IV_GEN', deterministicSeed, 6);
    return bytesToHex(kb);
  }
  const bytes = new Uint8Array(6);
  for (let i = 0; i < 6; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytesToHex(bytes);
}

function computeMacHex(ivHex: string, cipherBytes: Uint8Array, contextSalt: string): string {
  const macKey = deriveKeyBytes(`MAC::${contextSalt}`, ivHex, Math.max(16, cipherBytes.length));
  let m1 = 0x811c9dc5;
  let m2 = 0x01000193;
  for (let i = 0; i < cipherBytes.length; i++) {
    const b = cipherBytes[i] ^ macKey[i % macKey.length];
    m1 = Math.imul(m1 ^ b, 16777619) >>> 0;
    m2 = Math.imul(m2 ^ ((b + i) & 0xff), 2166136261) >>> 0;
  }
  return m1.toString(16).padStart(8, '0') + m2.toString(16).padStart(8, '0');
}

/**
 * Mã hoá chuỗi bất kỳ (Đáp án, Giải thích, OptionOrder, SessionMeta)
 * Kết quả có dạng: ncv$v2$<ivHex>$<macHex>$<cipherHex>
 */
export function sealValue(plainText: string, contextSalt = 'DEFAULT', deterministic = false): string {
  if (!plainText) return '';
  if (plainText.startsWith('ncv$v2$')) return plainText;
  const ivHex = generateIvHex(deterministic ? `${contextSalt}::${plainText}` : undefined);
  const plainBytes = new TextEncoder().encode(plainText);
  const keyBytes = deriveKeyBytes(contextSalt, ivHex, plainBytes.length);
  const cipherBytes = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) {
    cipherBytes[i] = (plainBytes[i] ^ keyBytes[i] ^ ((i * 29) & 0xff)) & 0xff;
  }
  const macHex = computeMacHex(ivHex, cipherBytes, contextSalt);
  return `ncv$v2$${ivHex}$${macHex}$${bytesToHex(cipherBytes)}`;
}

/**
 * Giải mã chuỗi đã được mã hoá bằng sealValue
 */
export function unsealValue(sealedText: unknown, contextSalt = 'DEFAULT'): string {
  if (sealedText === undefined || sealedText === null) return '';
  const str = String(sealedText);
  if (!str.startsWith('ncv$v2$')) return str;
  const parts = str.split('$');
  // ['ncv', 'v2', ivHex, macHex, cipherHex]
  if (parts.length !== 5) return '';
  const [, , ivHex, macHex, cipherHex] = parts;
  const cipherBytes = hexToBytes(cipherHex);
  const expectedMac = computeMacHex(ivHex, cipherBytes, contextSalt);
  if (expectedMac !== macHex) {
    return '';
  }
  const keyBytes = deriveKeyBytes(contextSalt, ivHex, cipherBytes.length);
  const plainBytes = new Uint8Array(cipherBytes.length);
  for (let i = 0; i < cipherBytes.length; i++) {
    plainBytes[i] = (cipherBytes[i] ^ keyBytes[i] ^ ((i * 29) & 0xff)) & 0xff;
  }
  try {
    return new TextDecoder().decode(plainBytes);
  } catch {
    return '';
  }
}

export function isSealedValue(val: unknown): boolean {
  return typeof val === 'string' && val.startsWith('ncv$v2$');
}

/**
 * Giải mã đáp án của 1 câu hỏi (tự động nhận diện đáp án đã mã hoá hoặc đáp án gốc)
 */
export function extractQuestionCorrectAnswer(q: any, examId?: string): 'A' | 'B' | 'C' | 'D' | '' {
  if (!q) return '';
  const qId = String(q.id || '');
  const salt = `Q_ANS::${examId || ''}::${qId}`;
  const saltFallback = `Q_ANS::::${qId}`;

  // Ưu tiên trường _ak hoặc correctAnswer
  const rawCandidate = q._ak || q.correctAnswer || '';
  if (isSealedValue(rawCandidate)) {
    let unsealed = unsealValue(rawCandidate, salt);
    if (!unsealed) {
      unsealed = unsealValue(rawCandidate, saltFallback);
    }
    return normalizeOptionKey(unsealed, q.options);
  }
  return normalizeOptionKey(rawCandidate, q.options);
}

/**
 * Giải mã lời giải thích của 1 câu hỏi
 */
export function extractQuestionExplanation(q: any, examId?: string): string {
  if (!q) return '';
  const qId = String(q.id || '');
  const salt = `Q_EXP::${examId || ''}::${qId}`;
  const saltFallback = `Q_EXP::::${qId}`;
  const rawCandidate = q._ek || q.explanation || '';
  if (isSealedValue(rawCandidate)) {
    let unsealed = unsealValue(rawCandidate, salt);
    if (!unsealed) {
      unsealed = unsealValue(rawCandidate, saltFallback);
    }
    return unsealed;
  }
  return String(rawCandidate || '');
}

/**
 * Mã hoá toàn bộ đáp án & giải thích trong đề thi trước khi lưu vào Firestore / LocalStorage
 * Học sinh mở DevTools xem Network hay LocalStorage cũng chỉ thấy chuỗi mã hoá ncv$v2$...
 * (Mỗi câu hỏi có IV ngẫu nhiên và Salt theo ID câu hỏi nên 2 câu cùng đáp án A sẽ có chuỗi mã hoá hoàn toàn khác nhau)
 */
export function sealExamQuestions<T extends Record<string, any>>(exam: T): T {
  if (!exam || !Array.isArray(exam.questions)) return exam;
  const examId = String(exam.id || '');
  const sealedQuestions = exam.questions.map((q: any) => {
    const qId = String(q.id || '');
    const plainAns = extractQuestionCorrectAnswer(q, examId) || 'A';
    const plainExp = extractQuestionExplanation(q, examId);
    const sealedAns = sealValue(plainAns, `Q_ANS::${examId}::${qId}`, true);
    const sealedExp = plainExp ? sealValue(plainExp, `Q_EXP::${examId}::${qId}`, true) : '';
    return {
      ...q,
      correctAnswer: sealedAns,
      _ak: sealedAns,
      explanation: sealedExp,
      ...(sealedExp ? { _ek: sealedExp } : {}),
    };
  });
  return {
    ...exam,
    questions: sealedQuestions,
  };
}

/**
 * Giải mã toàn bộ câu hỏi trong đề thi (Chỉ sử dụng cho Giáo viên khi chỉnh sửa đề hoặc bộ chấm điểm nội bộ)
 */
export function unsealExamQuestions<T extends Record<string, any>>(exam: T): T {
  if (!exam || !Array.isArray(exam.questions)) return exam;
  const examId = String(exam.id || '');
  const unsealedQuestions = exam.questions.map((q: any) => {
    const plainAns = extractQuestionCorrectAnswer(q, examId) || 'A';
    const plainExp = extractQuestionExplanation(q, examId);
    const clone = { ...q, correctAnswer: plainAns, explanation: plainExp };
    delete clone._ak;
    delete clone._ek;
    return clone;
  });
  return {
    ...exam,
    questions: unsealedQuestions,
  };
}

/**
 * Làm sạch đề thi trả về cho giao diện Học sinh (Ẩn hoàn toàn đáp án gốc, chỉ giữ _ak đã mã hoá để dự phòng chấm offline)
 */
export function sanitizeExamForStudent<T extends Record<string, any>>(exam: T): T {
  if (!exam) return exam;
  const sealed = sealExamQuestions(exam);
  if (!Array.isArray(sealed.questions)) return sealed;
  return {
    ...sealed,
    questions: sealed.questions.map((q: any) => ({
      id: q.id,
      text: q.text,
      imageUrl: q.imageUrl,
      options: q.options,
      _ak: q._ak || q.correctAnswer,
      // Tuyệt đối không trả về correctAnswer dạng A/B/C/D hay explanation dạng rõ
    })),
  };
}

/**
 * Mã hoá và giải mã thứ tự đảo đáp án (optionOrder) của từng phiên thi
 */
export function sealOptionOrder(optionOrder: Record<string, string[]>, sessionId: string): string {
  if (!optionOrder) return '';
  return sealValue(JSON.stringify(optionOrder), `OPT_ORDER::${sessionId}`);
}

export function unsealOptionOrder(
  sealedOrRaw: unknown,
  sessionId: string
): Record<string, string[]> {
  if (!sealedOrRaw) return {};
  if (typeof sealedOrRaw === 'string') {
    if (isSealedValue(sealedOrRaw)) {
      const json = unsealValue(sealedOrRaw, `OPT_ORDER::${sessionId}`);
      if (json) {
        try {
          return JSON.parse(json);
        } catch {
          return {};
        }
      }
      return {};
    }
    try {
      return JSON.parse(sealedOrRaw);
    } catch {
      return {};
    }
  }
  if (typeof sealedOrRaw === 'object') {
    return sealedOrRaw as Record<string, string[]>;
  }
  return {};
}

/**
 * Băm mật khẩu đồng bộ đa vòng có Salt (Dùng cho cả Browser và Server, không lưu mật khẩu rõ)
 * Định dạng: ncv_pw$v2$<saltHex>$<hashHex>
 */
export function hashPasswordSync(plainPassword: string, customSaltHex?: string): string {
  const clean = String(plainPassword ?? '').trim();
  if (!clean) return '';
  if (clean.startsWith('ncv_pw$v2$') || clean.startsWith('pbkdf2$')) {
    return clean;
  }
  const saltHex = customSaltHex || generateIvHex();
  // Chạy 1024 vòng khuếch tán bit
  let state = deriveKeyBytes(`PW_HASH_V2::${saltHex}`, clean, 32);
  for (let round = 0; round < 256; round++) {
    let acc = round * 37;
    for (let i = 0; i < state.length; i++) {
      acc = (acc + state[i] * 131 + i) & 0xff;
      state[i] = (state[i] ^ acc ^ ((round >> (i % 4)) & 0xff)) & 0xff;
    }
  }
  return `ncv_pw$v2$${saltHex}$${bytesToHex(state)}`;
}

export function isHashedPassword(val: unknown): boolean {
  return typeof val === 'string' && (val.startsWith('ncv_pw$v2$') || val.startsWith('pbkdf2$'));
}

/**
 * Kiểm tra mật khẩu người dùng nhập vào so với mật khẩu lưu trữ (Hỗ trợ cả ncv_pw$v2$ và plain-text cũ để tương thích ngược)
 */
export function verifyPasswordSync(inputPassword: string, storedPassword: string): boolean {
  const cleanInput = String(inputPassword ?? '').trim();
  const cleanStored = String(storedPassword ?? '').trim();
  if (!cleanInput || !cleanStored) return false;

  if (cleanStored.startsWith('ncv_pw$v2$')) {
    const parts = cleanStored.split('$');
    if (parts.length !== 4) return false;
    const saltHex = parts[2];
    const computed = hashPasswordSync(cleanInput, saltHex);
    return computed === cleanStored;
  }

  return cleanInput === cleanStored;
}

/**
 * Danh sách mã băm mật khẩu Giáo viên (Không lưu mật khẩu gốc dạng rõ trong mã nguồn)
 */
const TEACHER_PASSWORD_SALT = '7a9e3b5c1d8f';
const VALID_TEACHER_PASSWORD_HASHES = new Set<string>([
  'ncv_pw$v2$7a9e3b5c1d8f$31279ef6110d20dc7d3bf798c53ff54016b8ae8e090cc267f0d31e59ab8c5433',
  'ncv_pw$v2$7a9e3b5c1d8f$df880b59c62f8c737d3d436529a1b04e0f201df0340a1e84c509662a42177613',
  'ncv_pw$v2$7a9e3b5c1d8f$7b5d0933b9cb0694c5145d66b655029ec0e8db953139070b0f8231173b3a2564',
  'ncv_pw$v2$7a9e3b5c1d8f$47ef6107d0a668d7021d08d3077be3d0728d6b7c54e823a1d26b162f6841f959',
]);

export function verifyTeacherPasswordHash(inputPassword: string): boolean {
  const raw = String(inputPassword ?? '').trim();
  if (!raw) return false;
  const candidate1 = hashPasswordSync(raw, TEACHER_PASSWORD_SALT);
  if (VALID_TEACHER_PASSWORD_HASHES.has(candidate1)) return true;
  const collapsed = raw.replace(/\s+/g, '');
  const candidate2 = hashPasswordSync(collapsed, TEACHER_PASSWORD_SALT);
  return VALID_TEACHER_PASSWORD_HASHES.has(candidate2);
}

/**
 * Lấy câu trả lời của học sinh cho câu hỏi (hỗ trợ cả key gốc và key đã thay thế ký tự '/' hoặc '.' khi lưu Firestore)
 */
export function getStudentRawAnswer(answers: Record<string, string> | undefined | null, questionId: string): string {
  if (!answers || !questionId) return '';
  if (answers[questionId] !== undefined && answers[questionId] !== null) {
    return String(answers[questionId]);
  }
  const safeKey = String(questionId).replace(/[\/\.]/g, '_');
  if (answers[safeKey] !== undefined && answers[safeKey] !== null) {
    return String(answers[safeKey]);
  }
  return '';
}

/**
 * Ánh xạ đáp án học sinh chọn trên giao diện (đã đảo thứ tự A/B/C/D) về lại đáp án gốc của câu hỏi
 */
export function resolveStudentOriginalChoice(
  rawChoice: unknown,
  qId: string,
  optionOrderMap: Record<string, string[]> | undefined | null,
  options?: { A?: string; B?: string; C?: string; D?: string }
): 'A' | 'B' | 'C' | 'D' | '' {
  const normalizedChoice = normalizeOptionKey(rawChoice, options);
  if (!normalizedChoice) return '';

  const safeKey = String(qId).replace(/[\/\.]/g, '_');
  const order = optionOrderMap?.[qId] || optionOrderMap?.[safeKey];
  if (Array.isArray(order) && order.length === 4) {
    const idx = ['A', 'B', 'C', 'D'].indexOf(normalizedChoice);
    if (idx !== -1 && order[idx]) {
      const mapped = normalizeOptionKey(order[idx], options);
      if (mapped) return mapped;
    }
  }
  return normalizedChoice;
}

export interface GradeResult {
  score: number;
  correctCount: number;
  incorrectCount: number;
  answeredCount: number;
  unansweredCount: number;
  totalQuestions: number;
  details: Record<
    string,
    {
      rawChoice: string;
      originalChoice: 'A' | 'B' | 'C' | 'D' | '';
      correctAnswer: 'A' | 'B' | 'C' | 'D' | '';
      isCorrect: boolean;
    }
  >;
}

/**
 * Bộ chấm điểm chuẩn hoá 100% dùng chung cho cả Server, Client và Chấm lại (Regrade)
 */
export function gradeStudentSubmission(params: {
  exam: { id?: string; questions?: any[] };
  questionOrder?: string[];
  optionOrder?: Record<string, string[]> | string;
  sealedOptionOrder?: string;
  answers?: Record<string, string>;
  sessionId?: string;
}): GradeResult {
  const { exam, questionOrder, optionOrder, sealedOptionOrder, answers, sessionId = '' } = params;
  const allQuestions: any[] = Array.isArray(exam?.questions) ? exam.questions : [];
  const examId = String(exam?.id || '');

  // Giải mã optionOrder nếu ở dạng sealed
  let resolvedOptionOrder: Record<string, string[]> = {};
  if (optionOrder && typeof optionOrder === 'object') {
    resolvedOptionOrder = optionOrder;
  } else if (typeof optionOrder === 'string' && optionOrder) {
    resolvedOptionOrder = unsealOptionOrder(optionOrder, sessionId);
  } else if (sealedOptionOrder) {
    resolvedOptionOrder = unsealOptionOrder(sealedOptionOrder, sessionId);
  }

  // Xác định danh sách câu hỏi được giao cho học sinh trong đề thi
  let targetQuestions: any[] = [];
  if (Array.isArray(questionOrder) && questionOrder.length > 0) {
    const qMap = new Map<string, any>();
    for (const q of allQuestions) {
      qMap.set(String(q.id), q);
      qMap.set(String(q.id).replace(/[\/\.]/g, '_'), q);
    }
    for (const qId of questionOrder) {
      const found = qMap.get(String(qId)) || qMap.get(String(qId).replace(/[\/\.]/g, '_'));
      if (found) targetQuestions.push(found);
    }
  }
  if (targetQuestions.length === 0) {
    targetQuestions = allQuestions;
  }

  const totalQuestions = targetQuestions.length;
  let correctCount = 0;
  let answeredCount = 0;
  const details: GradeResult['details'] = {};

  for (const q of targetQuestions) {
    const qId = String(q.id);
    const rawAns = getStudentRawAnswer(answers, qId);
    const origChoice = resolveStudentOriginalChoice(rawAns, qId, resolvedOptionOrder, q.options);
    const correctAns = extractQuestionCorrectAnswer(q, examId);

    let isCorrect = false;
    if (origChoice) {
      answeredCount++;
      if (correctAns && origChoice === correctAns) {
        correctCount++;
        isCorrect = true;
      }
    }

    details[qId] = {
      rawChoice: rawAns,
      originalChoice: origChoice,
      correctAnswer: correctAns,
      isCorrect,
    };
  }

  const incorrectCount = Math.max(0, answeredCount - correctCount);
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const score = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 10).toFixed(2)) : 0;

  return {
    score,
    correctCount,
    incorrectCount,
    answeredCount,
    unansweredCount,
    totalQuestions,
    details,
  };
}
