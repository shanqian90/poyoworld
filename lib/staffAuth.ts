import crypto from "crypto";

export const STAFF_COOKIE = "poyo_staff";
export const STAFF_REMEMBER_MAX_AGE = 60 * 60 * 24 * 365; // 자동로그인: 1년
export const STAFF_SESSION_MAX_AGE = 60 * 60 * 24; // 기본: 1일

function secret(): string {
  return process.env.STAFF_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

export function signStaffToken(staffId: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(staffId).digest("hex");
  return `${staffId}.${sig}`;
}

export function verifyStaffToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const staffId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret()).update(staffId).digest("hex");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return staffId;
}
