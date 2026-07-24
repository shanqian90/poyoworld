import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSlotMap } from "@/lib/slots";

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date") || "";
    if (!/^\d{4}$/.test(date)) {
      return NextResponse.json({ ok: false, message: "날짜는 MMDD 4자리로 입력해주세요" }, { status: 400 });
    }
    const map = await getSlotMap(supabase, date);
    return NextResponse.json({ ok: true, map });
  } catch (err) {
    const message = err instanceof Error ? err.message : "조회 중 오류";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
