const KEY = "poyo_kakao_id";

export function getKakaoId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setKakaoId(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

export function clearKakaoId() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
