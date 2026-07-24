import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { buildEstimateData, buildPreviewHtml } from "@/lib/estimate";
import { getEstimateSourceRows } from "@/lib/estimateRows";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const writeDate = String(body.writeDate || "");
    const companyCode = String(body.companyCode || "");
    const companyName = String(body.companyName || "");
    if (!writeDate || !companyName) {
      return NextResponse.json({ ok: false, message: "업체를 먼저 선택해주세요" }, { status: 400 });
    }

    const { rows } = await getEstimateSourceRows(supabase, writeDate, companyCode, companyName);
    if (!rows.length) {
      return NextResponse.json({ ok: false, message: "선택한 업체의 미발행 데이터가 없습니다" }, { status: 400 });
    }

    const data = buildEstimateData({
      writeDate, companyCode, companyName, rows,
      vatEnabled: !!body.vatEnabled,
      taxRateText: body.taxRateText || "0%",
      note: body.note || "",
      depositEnabled: body.depositEnabled !== false,
      exchangeRate: Number(body.exchangeRate) || 0,
      lang: body.lang === "zh" ? "zh" : "ko",
      extraItemsInput: Array.isArray(body.extraItems) ? body.extraItems : [],
    });

    return NextResponse.json({ ok: true, summary: data.summary, previewHtml: buildPreviewHtml(data) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "미리보기 생성 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
