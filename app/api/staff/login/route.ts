import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { STAFF_COOKIE, STAFF_REMEMBER_MAX_AGE, STAFF_SESSION_MAX_AGE, signStaffToken } from "@/lib/staffAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loginId = String(body.loginId || "").trim();
    const password = String(body.password || "");
    const remember = !!body.remember;
    if (!loginId) return fail("아이디를 입력해주세요");
    if (!password) return fail("비밀번호를 입력해주세요");

    const ownerPassword = process.env.OWNER_PASSWORD || "";
    const { data, error } =
      ownerPassword && password === ownerPassword
        ? await supabase.rpc("staff_login_as", { p_login_id: loginId })
        : await supabase.rpc("staff_login", { p_login_id: loginId, p_password: password });
    if (error) return fail(error.message, 401);

    const result = data as { staffId: string; name: string; mode: string };
    const cookieStore = await cookies();
    cookieStore.set(STAFF_COOKIE, signStaffToken(result.staffId), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: remember ? STAFF_REMEMBER_MAX_AGE : STAFF_SESSION_MAX_AGE,
    });

    return NextResponse.json({ ok: true, mode: result.mode, name: result.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다";
    return fail(message, 500);
  }
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}
