import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { normalizePhoneDigits } from "@/lib/phone";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phones: string[] = Array.isArray(body.phones) ? body.phones : [];
    const normalized = phones.map((p) => normalizePhoneDigits(p)).filter((p) => p.length >= 10);
    if (!normalized.length) {
      return NextResponse.json({ ok: true, todoList: [], paidList: [] });
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .not("order_no", "is", null)
      .not("receiver", "is", null)
      .order("id", { ascending: false });
    if (error) throw new Error(error.message);

    const phoneSet = new Set(normalized);
    const rows = (data || []).filter((r) => phoneSet.has(normalizePhoneDigits(r.phone || "")));

    const todoList = rows.filter((r) => !r.paid);
    const paidList = rows.filter((r) => r.paid);

    return NextResponse.json({ ok: true, todoList, paidList });
  } catch (err) {
    const message = err instanceof Error ? err.message : "조회 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
