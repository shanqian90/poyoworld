import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다" }, { status: 401 });
  }

  const days = req.nextUrl.searchParams.get("days");

  const PAGE_SIZE = 1000;
  const rows: Record<string, unknown>[] = [];
  let loadError: string | null = null;
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from("work_requests").select("*").order("id", { ascending: true });
    if (days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(days));
      query = query.gte("start_date", cutoff.toISOString().slice(0, 10));
    }
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      loadError = error.message;
      break;
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return NextResponse.json({ ok: true, rows, loadError });
}

function receiptNo(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const startDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const { data, error } = await supabase
    .from("work_requests")
    .insert({
      receipt_no: receiptNo(),
      company_name: "새 업체",
      start_date: startDate,
      keyword: "",
      total_count: 0,
      status: "접수",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, row: data });
}
