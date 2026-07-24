import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { getEstimateSourceRows } from "@/lib/estimateRows";
import { buildGroupRows } from "@/lib/estimateGroupRows";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const writeDate = searchParams.get("writeDate") || "";
  const companyCode = searchParams.get("companyCode") || "";
  const companyName = searchParams.get("companyName") || "";
  const exchangeRate = Number(searchParams.get("exchangeRate") || "0");
  if (!writeDate || !companyName) {
    return NextResponse.json({ ok: false, message: "업체를 먼저 선택해주세요" }, { status: 400 });
  }

  try {
    const { rows } = await getEstimateSourceRows(supabase, writeDate, companyCode, companyName);
    return NextResponse.json({ ok: true, rows: buildGroupRows(rows, exchangeRate) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "조회 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
