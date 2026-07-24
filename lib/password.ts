// 영문/숫자/특수문자만 허용 (한글 등 비ASCII 문자 입력 방지 — IME 조합 이슈 때문)
export function sanitizePasswordInput(v: string): string {
  return v.replace(/[^\x21-\x7E]/g, "");
}
