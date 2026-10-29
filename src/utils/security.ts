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
 * Hỗ trợ cả mảng QuestionOption[] ([{id:'A', text:'...'}]) và object ({A:'...', B:'...'})
 */
export function normalizeOptionKey(
  val: unknown,
  options?: Array<{ id?: string; text?: string }> | { A?: string; B?: string; C?: string; D?: string }
): 'A' | 'B' | 'C' | 'D' | '' {
  if (val === undefined || val === null) return '';
  const raw = String(val).normalize('NFC').trim();
  if (!raw || raw.startsWith('ncv$v2$')) return '';
  const upper = raw.toUpperCase();
  if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') {
    return upper as 'A' | 'B' | 'C' | 'D';
  }
  const prefixMatch = upper.match(
    /^(?:ĐÁP\s*ÁN|PHƯƠNG\s*ÁN|CHỌN|KEY|CÂU)?[\s\:\-\.\(\[]*([A-D])(?:[\.\)\]\:\-\s]|$)/i
  );
  if (prefixMatch && prefixMatch[1]) {
    const letter = prefixMatch[1].toUpperCase();
    if (letter === 'A' || letter === 'B' || letter === 'C' || letter === 'D') {
      return letter as 'A' | 'B' | 'C' | 'D';
    }
  }
  if (Array.isArray(options) && options.length > 0) {
    const rawLower = raw.toLowerCase();
    const matchedOpt = options.find(
      (o) => o && String(o.text ?? '').normalize('NFC').trim().toLowerCase() === rawLower
    );
    if (matchedOpt && matchedOpt.id) {
      const optId = String(matchedOpt.id).trim().toUpperCase();
      if (optId === 'A' || optId === 'B' || optId === 'C' || optId === 'D') {
        return optId as 'A' | 'B' | 'C' | 'D';
      }
    }
  } else if (options && typeof options === 'object') {
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
 * Chuẩn hoá 4 phương án A, B, C, D của một câu hỏi để đảm bảo luôn theo đúng thứ tự chuẩn A, B, C, D
 */
export function normalizeQuestionOptions(
  rawOptions: unknown
): Array<{ id: 'A' | 'B' | 'C' | 'D'; text: string }> {
  const letters: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  if (Array.isArray(rawOptions) && rawOptions.length > 0) {
    return letters.map((letter, idx) => {
      const byId = rawOptions.find(
        (o: any) => o && typeof o === 'object' && normalizeOptionKey(o.id) === letter
      );
      const fallbackItem = rawOptions[idx];
      const chosen = byId || fallbackItem;
      let text = '';
      if (typeof chosen === 'string') {
        text = chosen.trim();
      } else if (chosen && typeof chosen === 'object') {
        text = String(chosen.text ?? chosen.content ?? '').trim();
      }
      return {
        id: letter,
        text,
      };
    });
  }
  if (rawOptions && typeof rawOptions === 'object') {
    const obj = rawOptions as Record<string, any>;
    return letters.map((letter) => ({
      id: letter,
      text: String(obj[letter] ?? obj[letter.toLowerCase()] ?? '').trim(),
    }));
  }
  return letters.map((letter) => ({ id: letter, text: '' }));
}

/**
 * Chuẩn hoá bản đồ đảo đáp án của 1 câu hỏi về dạng { A: '...', B: '...', C: '...', D: '...' }
 */
export function normalizeSingleQuestionOptionMap(
  rawMap: unknown
): Record<'A' | 'B' | 'C' | 'D', 'A' | 'B' | 'C' | 'D'> | null {
  const letters: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  if (!rawMap) return null;
  if (Array.isArray(rawMap) && rawMap.length >= 4) {
    const a = normalizeOptionKey(rawMap[0]) || 'A';
    const b = normalizeOptionKey(rawMap[1]) || 'B';
    const c = normalizeOptionKey(rawMap[2]) || 'C';
    const d = normalizeOptionKey(rawMap[3]) || 'D';
    return { A: a, B: b, C: c, D: d };
  }
  if (typeof rawMap === 'object') {
    const obj = rawMap as Record<string, any>;
    const result: Record<'A' | 'B' | 'C' | 'D', 'A' | 'B' | 'C' | 'D'> = {
      A: 'A',
      B: 'B',
      C: 'C',
      D: 'D',
    };
    let hasValid = false;
    for (const letter of letters) {
      const candidate = obj[letter] ?? obj[letter.toLowerCase()];
      const norm = normalizeOptionKey(candidate);
      if (norm) {
        result[letter] = norm;
        hasValid = true;
      }
    }
    return hasValid ? result : null;
  }
  return null;
}

/**
 * Khôi phục bản đồ đảo đáp án (optionOrder) từ danh sách câu hỏi hiển thị trên màn hình học sinh (displayedQuestions)
 * đối chiếu với bộ câu hỏi gốc trong đề thi (examQuestions).
 * Giúp chấm đúng 100% ngay cả khi phiên thi bị mất kết nối hoặc thiếu sealedOptionOrder.
 */
export function reconstructOptionOrderFromDisplayedQuestions(
  displayedQuestions: unknown,
  examQuestions: unknown
): Record<string, Record<'A' | 'B' | 'C' | 'D', 'A' | 'B' | 'C' | 'D'>> {
  const reconstructed: Record<string, Record<'A' | 'B' | 'C' | 'D', 'A' | 'B' | 'C' | 'D'>> = {};
  if (!Array.isArray(displayedQuestions) || !Array.isArray(examQuestions)) {
    return reconstructed;
  }

  const letters: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  for (const sq of displayedQuestions) {
    if (!sq || !sq.id || !Array.isArray(sq.options)) continue;
    const sqId = String(sq.id);
    const safeSqId = sqId.replace(/[\/\.]/g, '_');
    const origQ = examQuestions.find(
      (q: any) =>
        q &&
        (String(q.id) === sqId || String(q.id).replace(/[\/\.]/g, '_') === safeSqId)
    );
    if (!origQ || !origQ.options) continue;

    const origOpts = normalizeQuestionOptions(origQ.options);
    const dispOpts = normalizeQuestionOptions(sq.options);

    const usedOrigIds = new Set<'A' | 'B' | 'C' | 'D'>();
    const mapping: Partial<Record<'A' | 'B' | 'C' | 'D', 'A' | 'B' | 'C' | 'D'>> = {};
    let matchedCount = 0;

    for (const dispOpt of dispOpts) {
      const dispTextNorm = String(dispOpt.text || '').normalize('NFC').trim().toLowerCase();
      if (!dispTextNorm) continue;
      const foundOrig = origOpts.find(
        (o) =>
          !usedOrigIds.has(o.id) &&
          String(o.text || '').normalize('NFC').trim().toLowerCase() === dispTextNorm
      );
      if (foundOrig) {
        mapping[dispOpt.id] = foundOrig.id;
        usedOrigIds.add(foundOrig.id);
        matchedCount++;
      }
    }

    if (matchedCount >= 3) {
      const remainingOrig = letters.filter((l) => !usedOrigIds.has(l));
      let remIdx = 0;
      const fullMap: Record<'A' | 'B' | 'C' | 'D', 'A' | 'B' | 'C' | 'D'> = {
        A: mapping.A || remainingOrig[remIdx++] || 'A',
        B: mapping.B || remainingOrig[remIdx++] || 'B',
        C: mapping.C || remainingOrig[remIdx++] || 'C',
        D: mapping.D || remainingOrig[remIdx++] || 'D',
      };
      reconstructed[origQ.id] = fullMap;
      reconstructed[sqId] = fullMap;
    }
  }

  return reconstructed;
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
 * Ưu tiên đáp án dạng rõ nếu giáo viên vừa chỉnh sửa (q.correctAnswer = 'A'|'B'|'C'|'D'),
 * sau đó giải mã an toàn với đa khoá dự phòng để không bao giờ bị lệch khi đổi mã đề / nhân bản đề.
 */
export function extractQuestionCorrectAnswer(q: any, examId?: string): 'A' | 'B' | 'C' | 'D' | '' {
  if (!q) return '';
  const qId = String(q.id || '');

  // 1. Nếu q.correctAnswer đang ở dạng rõ ('A' | 'B' | 'C' | 'D'), ưu tiên tuyệt đối (khi GV vừa sửa đáp án)
  if (q.correctAnswer && !isSealedValue(q.correctAnswer)) {
    const plainDirect = normalizeOptionKey(q.correctAnswer, q.options);
    if (plainDirect) return plainDirect;
  }

  // 2. Giải mã từ chuỗi đã mã hoá (q.correctAnswer hoặc q._ak)
  const candidates = [q.correctAnswer, q._ak].filter(Boolean);
  const candidateSalts = Array.from(
    new Set([
      `Q_ANS::${examId || ''}::${qId}`,
      `Q_ANS::${q._eid || ''}::${qId}`,
      `Q_ANS::::${qId}`,
      `Q_ANS::GLOBAL::${qId}`,
    ])
  );

  for (const rawCandidate of candidates) {
    if (isSealedValue(rawCandidate)) {
      for (const salt of candidateSalts) {
        const unsealed = unsealValue(rawCandidate, salt);
        if (unsealed) {
          const norm = normalizeOptionKey(unsealed, q.options);
          if (norm) return norm;
        }
      }
    } else {
      const norm = normalizeOptionKey(rawCandidate, q.options);
      if (norm) return norm;
    }
  }

  return '';
}

/**
 * Giải mã lời giải thích của 1 câu hỏi
 */
export function extractQuestionExplanation(q: any, examId?: string): string {
  if (!q) return '';
  const qId = String(q.id || '');
  if (q.explanation && !isSealedValue(q.explanation)) {
    return String(q.explanation);
  }
  const candidates = [q.explanation, q._ek].filter(Boolean);
  const candidateSalts = Array.from(
    new Set([
      `Q_EXP::${examId || ''}::${qId}`,
      `Q_EXP::${q._eid || ''}::${qId}`,
      `Q_EXP::::${qId}`,
      `Q_EXP::GLOBAL::${qId}`,
    ])
  );
  for (const rawCandidate of candidates) {
    if (isSealedValue(rawCandidate)) {
      for (const salt of candidateSalts) {
        const unsealed = unsealValue(rawCandidate, salt);
        if (unsealed) return unsealed;
      }
    } else {
      return String(rawCandidate || '');
    }
  }
  return '';
}

/**
 * Mã hoá toàn bộ đáp án & giải thích trong đề thi trước khi lưu vào Firestore / LocalStorage
 * Đồng thời chuẩn hoá ID câu hỏi duy nhất và thứ tự phương án gốc A, B, C, D.
 */
export function sealExamQuestions<T extends Record<string, any>>(exam: T): T {
  if (!exam || !Array.isArray(exam.questions)) return exam;
  const examId = String(exam.id || '');
  const seenIds = new Set<string>();

  const sealedQuestions = exam.questions.map((q: any, idx: number) => {
    let qId = String(q?.id || `q-${idx + 1}`).trim();
    if (!qId || seenIds.has(qId)) {
      qId = `${qId || 'q'}-${idx + 1}`;
    }
    seenIds.add(qId);

    const normalizedOpts = normalizeQuestionOptions(q?.options);
    const plainAns = extractQuestionCorrectAnswer({ ...q, options: normalizedOpts }, examId) || 'A';
    const plainExp = extractQuestionExplanation(q, examId);
    const sealedAns = sealValue(plainAns, `Q_ANS::${examId}::${qId}`, true);
    const sealedExp = plainExp ? sealValue(plainExp, `Q_EXP::${examId}::${qId}`, true) : '';
    return {
      ...q,
      id: qId,
      number: q?.number || idx + 1,
      options: normalizedOpts,
      correctAnswer: sealedAns,
      _ak: sealedAns,
      _eid: examId,
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
  const seenIds = new Set<string>();

  const unsealedQuestions = exam.questions.map((q: any, idx: number) => {
    let qId = String(q?.id || `q-${idx + 1}`).trim();
    if (!qId || seenIds.has(qId)) {
      qId = `${qId || 'q'}-${idx + 1}`;
    }
    seenIds.add(qId);

    const normalizedOpts = normalizeQuestionOptions(q?.options);
    const plainAns = extractQuestionCorrectAnswer({ ...q, options: normalizedOpts }, examId) || 'A';
    const plainExp = extractQuestionExplanation(q, examId);
    const clone = {
      ...q,
      id: qId,
      number: q?.number || idx + 1,
      options: normalizedOpts,
      correctAnswer: plainAns,
      explanation: plainExp,
    };
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
    questions: sealed.questions.map((q: any, idx: number) => ({
      id: q.id,
      number: q.number || idx + 1,
      content: q.content || q.text || '',
      text: q.text || q.content || '',
      codeSnippet: q.codeSnippet,
      codeLanguage: q.codeLanguage,
      imageUrl: q.imageUrl,
      options: q.options,
      _ak: q._ak || q.correctAnswer,
      _eid: q._eid || sealed.id,
      // Tuyệt đối không trả về correctAnswer dạng A/B/C/D hay explanation dạng rõ
    })),
  };
}

/**
 * Mã hoá và giải mã thứ tự đảo đáp án (optionOrder) của từng phiên thi
 */
export function sealOptionOrder(
  optionOrder: Record<string, any>,
  sessionId: string
): string {
  if (!optionOrder) return '';
  if (typeof optionOrder === 'string') {
    if (isSealedValue(optionOrder)) return optionOrder;
  }
  const cleanSid = String(sessionId || '').trim();
  const salt = cleanSid ? `OPT_ORDER::${cleanSid}` : 'OPT_ORDER::GLOBAL';
  return sealValue(JSON.stringify(optionOrder), salt);
}

export function unsealOptionOrder(
  sealedOrRaw: unknown,
  sessionId: string
): Record<string, any> {
  if (!sealedOrRaw) return {};
  if (typeof sealedOrRaw === 'string') {
    if (isSealedValue(sealedOrRaw)) {
      const cleanSid = String(sessionId || '').trim();
      const candidateSalts = Array.from(
        new Set([
          `OPT_ORDER::${cleanSid}`,
          `OPT_ORDER::${sessionId || ''}`,
          'OPT_ORDER::GLOBAL',
          'OPT_ORDER::',
        ])
      );
      for (const salt of candidateSalts) {
        const json = unsealValue(sealedOrRaw, salt);
        if (json) {
          try {
            const parsed = JSON.parse(json);
            if (parsed && typeof parsed === 'object') return parsed;
          } catch {
            // continue
          }
        }
      }
      return {};
    }
    try {
      const parsed = JSON.parse(sealedOrRaw);
      if (parsed && typeof parsed === 'object') return parsed;
      return {};
    } catch {
      return {};
    }
  }
  if (typeof sealedOrRaw === 'object') {
    return sealedOrRaw as Record<string, any>;
  }
  return {};
}

const BROKEN_V2_COLLISION_SUFFIX = '$84fb1d0a451ef26b6f8eda8a9e0ae8dcc006a64876caaab07efea650ce6aa250';

export function isCorruptedPasswordHash(val: unknown): boolean {
  return typeof val === 'string' && val.endsWith(BROKEN_V2_COLLISION_SUFFIX);
}

/**
 * Băm mật khẩu đồng bộ đa vòng có Salt (Dùng cho cả Browser và Server, không lưu mật khẩu rõ)
 * Định dạng: ncv_pw$v3$<saltHex>$<hashHex>
 */
export function hashPasswordSync(plainPassword: string, customSaltHex?: string): string {
  const clean = String(plainPassword ?? '').trim();
  if (!clean) return '';
  if (
    (clean.startsWith('ncv_pw$v3$') || clean.startsWith('ncv_pw$v2$') || clean.startsWith('pbkdf2$')) &&
    !isCorruptedPasswordHash(clean)
  ) {
    return clean;
  }
  const saltHex = customSaltHex || generateIvHex();
  let roundDigestHex = clean;
  for (let round = 0; round < 16; round++) {
    const roundBytes = deriveKeyBytes(`PW_HASH_V3::R${round}::${saltHex}`, `${clean}::${roundDigestHex}`, 32);
    roundDigestHex = bytesToHex(roundBytes);
  }
  return `ncv_pw$v3$${saltHex}$${roundDigestHex}`;
}

export function isHashedPassword(val: unknown): boolean {
  if (typeof val !== 'string' || isCorruptedPasswordHash(val)) return false;
  return val.startsWith('ncv_pw$v3$') || val.startsWith('ncv_pw$v2$') || val.startsWith('pbkdf2$');
}

/**
 * Kiểm tra mật khẩu người dùng nhập vào so với mật khẩu lưu trữ (Hỗ trợ ncv_pw$v3$ và plain-text)
 */
export function verifyPasswordSync(inputPassword: string, storedPassword: string): boolean {
  const cleanInput = String(inputPassword ?? '').trim();
  const cleanStored = String(storedPassword ?? '').trim();
  if (!cleanInput || !cleanStored || isCorruptedPasswordHash(cleanStored)) return false;

  if (cleanStored.startsWith('ncv_pw$v3$')) {
    const parts = cleanStored.split('$');
    if (parts.length !== 4) return false;
    const saltHex = parts[2];
    const computed = hashPasswordSync(cleanInput, saltHex);
    return computed === cleanStored;
  }

  if (cleanStored.startsWith('ncv_pw$v2$')) {
    return false;
  }

  return cleanInput === cleanStored;
}

/**
 * Danh sách mã băm một chiều (Salted Hash ncv_pw$v3$) của mật khẩu Giáo viên mặc định ban đầu.
 * Tuyệt đối KHÔNG lưu chuỗi mật khẩu gốc (plain-text) trong mã nguồn để học sinh mở F12 cũng không thể dò được.
 */
const TEACHER_PASSWORD_SALT = '7a9e3b5c1d8f';
export const DEFAULT_TEACHER_PASSWORD_HASH =
  'ncv_pw$v3$7a9e3b5c1d8f$51ca636f0897d1e7e7b4caf440c23fbd3b7c16589fa2dd87b758ba51a5785f76';

const VALID_TEACHER_PASSWORD_HASHES = new Set<string>([
  DEFAULT_TEACHER_PASSWORD_HASH,
  'ncv_pw$v3$7a9e3b5c1d8f$a6c5782d0fc9d6de398e507caac6ba69250caa1f24098f5a36de3a9e5ca565c0',
  'ncv_pw$v3$7a9e3b5c1d8f$b549320d02eaf9589eefd41aedda7b8d94be25c30fae719c5a269c3ecf061669',
  'ncv_pw$v3$7a9e3b5c1d8f$9a7925f53021f74d08821b700f74f3ce317cb8a8d784ad28d8648ce6fd09c866',
  'ncv_pw$v3$7a9e3b5c1d8f$111599a0466227f0570d8e27a6c3961f828b9472a9cc424a76ebfdcf11ab4394',
  'ncv_pw$v3$7a9e3b5c1d8f$44ad871a43ff4164bcc27257ced8e667f632a17b63a1e47e63627475d259920d',
  'ncv_pw$v3$7a9e3b5c1d8f$df164a850998099261cac99a10d4d42d4682422b89690c6b80ee726bb26c6a90',
]);

export function isDefaultTeacherPasswordHash(storedHash: string | undefined | null): boolean {
  if (!storedHash) return true;
  const clean = String(storedHash).trim();
  if (!clean) return true;
  return VALID_TEACHER_PASSWORD_HASHES.has(clean);
}

export function verifyTeacherPasswordHash(inputPassword: string): boolean {
  const raw = String(inputPassword ?? '').trim();
  if (!raw) return false;
  const candidate1 = hashPasswordSync(raw, TEACHER_PASSWORD_SALT);
  if (VALID_TEACHER_PASSWORD_HASHES.has(candidate1)) return true;
  const collapsedSpace = raw.replace(/\s+/g, ' ');
  const candidate2 = hashPasswordSync(collapsedSpace, TEACHER_PASSWORD_SALT);
  if (VALID_TEACHER_PASSWORD_HASHES.has(candidate2)) return true;
  const collapsed = raw.replace(/\s+/g, '');
  const candidate3 = hashPasswordSync(collapsed, TEACHER_PASSWORD_SALT);
  return VALID_TEACHER_PASSWORD_HASHES.has(candidate3);
}

const TEACHER_EMAIL_VAULT_CONTEXT = 'TEACHER_EMAIL_RECOVERY_VAULT_V3';

/**
 * Mã hoá mật khẩu hiện tại của Giáo viên thành chuỗi niêm phong (ncv$v2$...)
 * để phục vụ gửi lại mật khẩu về email chính chủ legialoi@gmail.com khi quên.
 * Không lưu mật khẩu dạng rõ trong code hay localStorage.
 */
export function sealTeacherPasswordVault(plainPassword: string): string {
  const clean = String(plainPassword ?? '').trim();
  if (!clean) return '';
  if (isSealedValue(clean)) return clean;
  return sealValue(clean, TEACHER_EMAIL_VAULT_CONTEXT, true);
}

/**
 * Giải mã mật khẩu hiện tại của Giáo viên từ chuỗi niêm phong
 */
export function unsealTeacherPasswordVault(sealedVault: unknown): string {
  if (!sealedVault || typeof sealedVault !== 'string') return '';
  const trimmed = sealedVault.trim();
  if (!isSealedValue(trimmed)) return '';
  return unsealValue(trimmed, TEACHER_EMAIL_VAULT_CONTEXT);
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
 * Ánh xạ đáp án học sinh chọn trên giao diện (đã đảo thứ tự A/B/C/D) về lại đáp án gốc của câu hỏi.
 * Hỗ trợ cả optionOrder dạng object { A: 'C', B: 'A', ... } và dạng mảng ['C', 'A', 'D', 'B'].
 */
export function resolveStudentOriginalChoice(
  rawChoice: unknown,
  qId: string,
  optionOrderMap: Record<string, any> | undefined | null,
  options?: Array<{ id?: string; text?: string }> | { A?: string; B?: string; C?: string; D?: string }
): 'A' | 'B' | 'C' | 'D' | '' {
  const normalizedChoice = normalizeOptionKey(rawChoice, options);
  if (!normalizedChoice) return '';

  const safeKey = String(qId).replace(/[\/\.]/g, '_');
  const rawOrder = optionOrderMap?.[qId] || optionOrderMap?.[safeKey];
  const normMap = normalizeSingleQuestionOptionMap(rawOrder);
  if (normMap && normMap[normalizedChoice]) {
    return normMap[normalizedChoice];
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
  optionOrder?: Record<string, any> | string;
  sealedOptionOrder?: string;
  displayedQuestions?: any[];
  answers?: Record<string, string>;
  sessionId?: string;
}): GradeResult {
  const {
    exam,
    questionOrder,
    optionOrder,
    sealedOptionOrder,
    displayedQuestions,
    answers,
    sessionId = '',
  } = params;
  const allQuestions: any[] = Array.isArray(exam?.questions) ? exam.questions : [];
  const examId = String(exam?.id || '');

  // Giải mã optionOrder nếu ở dạng sealed, đồng thời bổ sung dự phòng từ displayedQuestions nếu có
  const fromDisplayed = reconstructOptionOrderFromDisplayedQuestions(displayedQuestions, allQuestions);
  const fromSealed = unsealOptionOrder(sealedOptionOrder || optionOrder, sessionId);
  const resolvedOptionOrder: Record<string, any> = {
    ...fromDisplayed,
    ...(fromSealed && typeof fromSealed === 'object' ? fromSealed : {}),
  };

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
