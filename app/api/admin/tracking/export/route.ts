import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    return NextResponse.json({ ok: false, message: "선택된 항목이 없습니다" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select("order_no, receiver, address, phone, product_name")
    .in("id", ids)
    .not("order_no", "is", null);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const rows: (string | number)[][] = [
    ["받는분성명", "받는분우편번호", "받는분주소(전체,분할)", "받는분전화번호", "품목명", "고객주문번호", "내품명", "내품수량", "배송메세지1", "기타1"],
  ];
  for (const r of data || []) {
    rows.push([r.receiver || "", "", r.address || "", r.phone || "", r.product_name || "", r.order_no || "", r.product_name || "", 1, "", ""]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "운송장");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tracking-export.xlsx"`,
    },
  });
}
