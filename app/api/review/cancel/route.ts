import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rowId = Number(body.rowId);
    if (!rowId) return NextResponse.json({ ok: false, message: "rowId가 없습니다" }, { status: 400 });

    const { data: row, error: rowErr } = await supabase
      .from("orders")
      .select("id, paid")
      .eq("id", rowId)
      .single();
    if (rowErr || !row) {
      return NextResponse.json({ ok: false, message: "주문 정보를 찾을 수 없습니다" }, { status: 404 });
    }
    if (row.paid) {
      return NextResponse.json(
        { ok: false, message: "입금 완료된 건은 리뷰를 재제출할 수 없습니다" },
        { status: 400 }
      );
    }

    const { error: updErr } = await supabase
      .from("orders")
      .update({ review_url: null, review_done: false, review_submitted_at: null })
      .eq("id", rowId);
    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "취소 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
