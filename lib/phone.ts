export function normalizePhoneDigits(v: string): string {
  return String(v || "").replace(/\D/g, "");
}

export function formatPhone(v: string): string {
  const digits = normalizePhoneDigits(v);
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("010")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10 && digits.startsWith("10")) {
    return `010-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 10 && digits.startsWith("010")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return v;
}

export function formatPhoneLive(v: string): string {
  // 이메일 등 숫자가 아닌 문자가 섞여있으면 그대로 둔다 (전화번호일 때만 하이픈 자동삽입)
  if (/[^\d\s-]/.test(v)) return v;
  const digits = normalizePhoneDigits(v);
  if (!digits) return v;
  if (digits.startsWith("010")) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  return v;
}

export function normalizeKakaoId(v: string): string {
  return String(v || "").trim().toLowerCase();
}

export function todayMMDD(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}${dd}`;
}
