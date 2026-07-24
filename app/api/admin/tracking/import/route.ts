import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

function normHeader(h: string): string {
  return String(h || "").replace(/\s+/g, "").trim();
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ ok: false, message: "파일을 첨부해주세요" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (!rows.length) {
    return NextResponse.json({ ok: false, message: "엑셀에 데이터가 없습니다" }, { status: 400 });
  }

  // 헤더 이름 유연 매칭: 고객주문번호/주문번호, 운송장번호/송장번호
  const sample = rows[0];
  const orderKey = Object.keys(sample).find((k) => /고객주문번호|주문번호/.test(normHeader(k)));
  const trackingKey = Object.keys(sample).find((k) => /운송장번호|송장번호/.test(normHeader(k)));

  if (!orderKey || !trackingKey) {
    return NextResponse.json(
      { ok: false, message: "엑셀에서 '고객주문번호'와 '운송장번호' 컬럼을 찾지 못했습니다" },
      { status: 400 }
    );
  }

  let matched = 0;
  const unmatched: string[] = [];

  for (const row of rows) {
    const orderNo = String(row[orderKey] ?? "").trim();
    const tracking = String(row[trackingKey] ?? "").trim();
    if (!orderNo || !tracking) continue;

    const { data, error } = await supabase
      .from("orders")
      .update({ tracking })
      .eq("order_no", orderNo)
      .select("id");

    if (error) {
      unmatched.push(orderNo);
      continue;
    }
    if (data && data.length) matched++;
    else unmatched.push(orderNo);
  }

  return NextResponse.json({ ok: true, matched, unmatched });
}
