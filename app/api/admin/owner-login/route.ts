import { NextRequest, NextResponse } from "next/server";
import { OWNER_COOKIE, computeOwnerToken } from "@/lib/ownerAuth";
import { checkRateLimit, getClientIp, recordFailedAttempt } from "@/lib/loginRateLimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limited = await checkRateLimit(ip, "owner-login");
  if (limited.blocked) {
    return NextResponse.json({ ok: false, message: limited.message }, { status: 429 });
  }

  const body = await req.json();
  const password = String(body.password || "");
  const expected = process.env.OWNER_PASSWORD || "";

  if (!expected || password !== expected) {
    await recordFailedAttempt(ip, "owner-login");
    return NextResponse.json({ ok: false, message: "비밀번호가 일치하지 않습니다" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, computeOwnerToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
