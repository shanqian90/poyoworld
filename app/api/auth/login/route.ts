import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkBlocked } from "@/lib/blacklist";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kakaoId = String(body.kakaoId || "").trim();
    const password = String(body.password || "");
    if (!kakaoId) return fail("카카오톡 아이디를 입력해주세요");
    if (!password) return fail("비밀번호를 입력해주세요");

    const block = await checkBlocked(supabase, { kakaoId });
    if (block.blocked) return fail(block.reason || "차단되었습니다", 403);

    const { data, error } = await supabase.rpc("auth_login", {
      p_kakao_id: kakaoId,
      p_password: password,
    });
    if (error) return fail(error.message, 401);

    return NextResponse.json({ ok: true, mode: (data as { mode?: string })?.mode });
  } catch (err) {
    const message = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다";
    return fail(message, 500);
  }
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}
