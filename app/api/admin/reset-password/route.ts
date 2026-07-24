import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const loginId = String(body.loginId || "").trim();
  if (!loginId) {
    return NextResponse.json({ ok: false, message: "아이디를 입력해주세요" }, { status: 400 });
  }

  const { error } = await supabase.rpc("admin_reset_password", {
    p_login_id: loginId,
    p_admin_password: process.env.ADMIN_PASSWORD || "",
  });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
