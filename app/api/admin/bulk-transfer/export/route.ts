import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { lookupBankCode, parseAccountText } from "@/lib/bankCodes";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  void req;

  const { data, error } = await supabase
    .from("orders")
    .select("id, date_mmdd, product_name, account_text, amount, review_fee")
    .eq("review_done", true)
    .eq("paid", false)
    .not("account_text", "is", null)
    .neq("account_text", "")
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const yy = String(new Date().getFullYear()).slice(-2);
  const rows: (string | number)[][] = [
    ["날짜", "은행코드표", "계좌번호", "이체금액", "예금주", "입금계좌메모", "출금계좌메모"],
  ];
  const ids: number[] = [];

  for (const r of data || []) {
    const total = (Number(r.amount) || 0) + (Number(r.review_fee) || 0);
    if (total <= 0) continue;
    const { bank, accountNo, holder } = parseAccountText(r.account_text || "");
    if (!accountNo || !holder) continue;
    const code = lookupBankCode(bank);
    const mmdd = r.date_mmdd || "";
    rows.push([
      yy + mmdd,
      code,
      accountNo,
      total,
      holder,
      (mmdd + (r.product_name || "")).slice(0, 10),
      (mmdd + holder).slice(0, 14),
    ]);
    ids.push(r.id);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "대량이체");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bulk-transfer.xlsx"`,
      "X-Order-Ids": ids.join(","),
    },
  });
}
