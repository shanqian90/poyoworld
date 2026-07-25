// ── 한글 로마자 표기 (국립국어원 로마자표기법 근사치) ──────────────
// Supabase Storage 키는 ASCII만 허용하므로, 폴더/파일명에 한글이 섞이면
// "Invalid key" 오류가 난다. 완전히 지우면 사람이 못 알아보니, 대신
// 발음 기반 로마자로 바꿔서 ASCII이면서도 어느 정도 읽을 수 있게 한다.
// 브라우저(클라이언트 컴포넌트)에서도 그대로 쓸 수 있도록 Node 전용 모듈(crypto, Buffer)에
// 의존하지 않는다.
const CHO = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const JUNG = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
];
const JONG = [
  "", "g", "k", "gs", "n", "nj", "nh", "d", "l", "lg", "lm", "lb", "ls", "lt", "lp", "lh", "m", "b", "bs", "s", "ss", "ng",
  "j", "ch", "k", "t", "p", "h",
];

export function romanizeKorean(text: string): string {
  let out = "";
  for (const ch of String(text || "")) {
    const code = ch.codePointAt(0) || 0;
    if (code >= 0xac00 && code <= 0xd7a3) {
      const offset = code - 0xac00;
      const cho = Math.floor(offset / (21 * 28));
      const jung = Math.floor((offset % (21 * 28)) / 28);
      const jong = offset % 28;
      out += CHO[cho] + JUNG[jung] + JONG[jong];
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch;
    } else {
      out += " ";
    }
  }
  return out;
}

function simpleHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** 한글이 섞인 자유 텍스트를 스토리지 키에 안전한 ASCII 세그먼트로 변환 (읽을 수 있게 로마자화) */
export function safeSegment(text?: string | null, fallback = "unknown"): string {
  const romanized = romanizeKorean(String(text || ""))
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (romanized) return romanized;
  return `x_${simpleHash(String(text || fallback))}`;
}

/** Supabase Storage 키는 ASCII 안전 문자만 허용 — 한글 등 유니코드가 섞이면 "Invalid key" 오류가 남 */
export function safeFolderName(code?: string | null, name?: string | null): string {
  const asciiCode = String(code || "").replace(/[^a-zA-Z0-9-]+/g, "").trim();
  if (asciiCode) return asciiCode;
  return safeSegment(name, code || "unknown");
}

/** "업체코드+업체명" 형태의 폴더명을 안전하게 생성 (코드가 없으면 이름만 로마자화) */
export function codeNameSegment(code?: string | null, name?: string | null, sep = "_"): string {
  const c = String(code || "").replace(/[^a-zA-Z0-9-]+/g, "").trim();
  const n = safeSegment(name, code || "unknown");
  if (c && n) return `${c}${sep}${n}`;
  return c || n;
}
