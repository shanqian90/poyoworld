import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { buildEstimateData } from "@/lib/estimate";
import { getEstimateSourceRows } from "@/lib/estimateRows";
import { uploadImage } from "@/lib/storage";

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
    const imageDataUrl = String(body.imageDataUrl || "");
    if (!writeDate || !companyName) {
      return NextResponse.json({ ok: false, message: "업체를 먼저 선택해주세요" }, { status: 400 });
    }
    if (!imageDataUrl) {
      return NextResponse.json({ ok: false, message: "견적서 이미지가 없습니다" }, { status: 400 });
    }

    const { rows, ids } = await getEstimateSourceRows(supabase, writeDate, companyCode, companyName);
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

    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const issueDateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const depositDateStr =
      writeDate.length === 4 ? `${today.getFullYear()}-${writeDate.slice(0, 2)}-${writeDate.slice(2, 4)}` : null;

    const safeCode = (companyCode || "noCode").replace(/[^a-zA-Z0-9-]+/g, "");
    const fileName = `${writeDate}_${safeCode}_${Date.now()}.png`;
    const imageUrl = await uploadImage(
      supabase,
      "estimate-images",
      `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}/${fileName}`,
      imageDataUrl
    );

    for (let i = 0; i < ids.length; i++) {
      const update: Record<string, unknown> = { issue_date: issueDateStr, deposit_date: depositDateStr };
      if (i === 0) {
        update.image_url = imageUrl;
        update.deposit_amount = data.summary.invoiceAmount;
      }
      const { error } = await supabase.from("work_requests").update(update).eq("id", ids[i]);
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, imageUrl, invoiceAmount: data.summary.invoiceAmount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "저장 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
