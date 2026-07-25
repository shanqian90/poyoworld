import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kakaoId = String(body.kakaoId || "").trim();
    const oldPassword = String(body.oldPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!kakaoId) return fail("아이디를 입력해주세요");
    if (newPassword.length < 4) return fail("새 비밀번호는 4자 이상 입력해주세요");

    const { error } = await supabase.rpc("auth_change_password", {
      p_kakao_id: kakaoId,
      p_old_password: oldPassword,
      p_new_password: newPassword,
    });
    if (error) return fail(error.message);

    return NextResponse.json({ ok: true });
  } catch {
    return fail("처리 중 오류가 발생했습니다", 500);
  }
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}
