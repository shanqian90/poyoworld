import crypto from "crypto";

export const OWNER_COOKIE = "poyo_owner";

export function computeOwnerToken(): string {
  const secret = process.env.OWNER_PASSWORD || "";
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function isValidOwnerToken(token: string | undefined): boolean {
  if (!token) return false;
  return token === computeOwnerToken();
}
