import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkBlocked } from "@/lib/blacklist";
import { checkRateLimit, getClientIp, recordFailedAttempt } from "@/lib/loginRateLimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  try {
    const limited = await checkRateLimit(ip, "auth-login");
    if (limited.blocked) return fail(limited.message!, 429);

    const body = await req.json();
    const kakaoId = String(body.kakaoId || "").trim();
    const password = String(body.password || "");
    if (!kakaoId) return fail("카카오톡 아이디를 입력해주세요");
    if (!password) return fail("비밀번호를 입력해주세요");

    const block = await checkBlocked(supabase, { kakaoId });
    if (block.blocked) return fail(block.reason || "차단되었습니다", 403);

    const adminPassword = process.env.ADMIN_PASSWORD || "";
    const ownerPassword = process.env.OWNER_PASSWORD || "";
    const isOverride = (!!adminPassword && password === adminPassword) || (!!ownerPassword && password === ownerPassword);
    if (isOverride) {
      const { data, error } = await supabase.rpc("auth_login_as", { p_kakao_id: kakaoId });
      if (error) {
        await recordFailedAttempt(ip, "auth-login");
        return fail(error.message, 401);
      }
      return NextResponse.json({ ok: true, mode: (data as { mode?: string })?.mode });
    }

    const { data, error } = await supabase.rpc("auth_login", {
      p_kakao_id: kakaoId,
      p_password: password,
    });
    if (error) {
      await recordFailedAttempt(ip, "auth-login");
      return fail(error.message, 401);
    }

    return NextResponse.json({ ok: true, mode: (data as { mode?: string })?.mode });
  } catch (err) {
    const message = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다";
    return fail(message, 500);
  }
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}
