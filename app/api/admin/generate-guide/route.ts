import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { buildGuideRow } from "@/lib/workRequestExpand";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  void req;

  const { data: pending, error } = await supabase
    .from("work_requests")
    .select("*")
    .eq("status", "접수")
    .eq("guide_created", false)
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  if (!pending || !pending.length) {
    return NextResponse.json({ ok: true, guideRows: 0, requestCount: 0 });
  }

  const guideRows = pending.map((r) => buildGuideRow(r));
  const doneIds = pending.map((r) => r.id);

  const { error: guideErr } = await supabase.from("guide_products").insert(guideRows);
  if (guideErr) {
    return NextResponse.json({ ok: false, message: `구매가이드 생성 실패: ${guideErr.message}` }, { status: 500 });
  }

  const { error: updErr } = await supabase.from("work_requests").update({ guide_created: true }).in("id", doneIds);
  if (updErr) {
    return NextResponse.json({ ok: false, message: `상태 업데이트 실패: ${updErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, guideRows: guideRows.length, requestCount: doneIds.length });
}
