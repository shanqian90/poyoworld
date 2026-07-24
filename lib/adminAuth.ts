import crypto from "crypto";

export const ADMIN_COOKIE = "poyo_admin";

export function computeAdminToken(): string {
  const secret = process.env.ADMIN_PASSWORD || "";
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function isValidAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  return token === computeAdminToken();
}
