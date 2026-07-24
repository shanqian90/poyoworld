const KEY = "vendor_login_id";

export function getVendorLoginId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setVendorLoginId(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

export function clearVendorLoginId() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
