import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { normalizeKakaoId, todayMMDD } from "@/lib/phone";
import { checkBlocked } from "@/lib/blacklist";
import { getSlotMap } from "@/lib/slots";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kakaoIdRaw = String(body.kakaoId || "").trim();
    if (!kakaoIdRaw) {
      return NextResponse.json({ ok: false, message: "카카오톡 아이디를 입력해주세요" }, { status: 400 });
    }
    const kakaoId = normalizeKakaoId(kakaoIdRaw);

    const block = await checkBlocked(supabase, { kakaoId });
    if (block.blocked) {
      return NextResponse.json({ ok: false, message: block.reason }, { status: 403 });
    }

    const { data: accounts, error: accErr } = await supabase
      .from("accounts")
      .select("*")
      .ilike("kakao_id", kakaoIdRaw)
      .order("created_at", { ascending: true });
    if (accErr) throw new Error(accErr.message);

    const { data: guideProducts, error: guideErr } = await supabase
      .from("guide_products")
      .select("*")
      .eq("active", true)
      .order("number_text", { ascending: true });
    if (guideErr) throw new Error(guideErr.message);

    const filteredGuides = (guideProducts || []).filter(
      (g) => g.deadline !== "마감" && g.deadline !== "종료"
    );

    const todayMap = await getSlotMap(supabase, todayMMDD());

    return NextResponse.json({
      ok: true,
      kakaoId: kakaoIdRaw,
      accounts: accounts || [],
      guideProducts: filteredGuides,
      todayMap,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
