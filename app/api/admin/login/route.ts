import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, computeAdminToken } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const password = String(body.password || "");
  const expected = process.env.ADMIN_PASSWORD || "";

  if (!expected || password !== expected) {
    return NextResponse.json({ ok: false, message: "비밀번호가 일치하지 않습니다" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, computeAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90일 (자동로그인 유지)
  });
  return res;
}
