import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { extractMmddFromReceipt, toNumber } from "@/lib/estimate";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("work_requests")
    .select("receipt_no, company_code, company_name, status, issue_date, total_count, tax_bill")
    .ilike("status", "%접수%")
    .is("issue_date", null);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const grouped = new Map<
    string,
    {
      writeDate: string;
      companyCode: string;
      companyName: string;
      display: string;
      itemCount: number;
      totalQty: number;
      taxBill: boolean;
    }
  >();
  (data || []).forEach((r) => {
    const writeDate = extractMmddFromReceipt(r.receipt_no);
    const companyCode = String(r.company_code || "").trim();
    const companyName = String(r.company_name || "").trim();
    if (!writeDate || !companyName) return;
    const key = [writeDate, companyCode, companyName].join("||");
    if (!grouped.has(key)) {
      grouped.set(key, {
        writeDate, companyCode, companyName,
        display: [writeDate, companyCode, companyName].filter(Boolean).join("  "),
        itemCount: 0, totalQty: 0, taxBill: !!r.tax_bill,
      });
    }
    const g = grouped.get(key)!;
    g.itemCount += 1;
    g.totalQty += toNumber(r.total_count);
  });

  const options = Array.from(grouped.values()).sort((a, b) => a.display.localeCompare(b.display, "ko"));
  return NextResponse.json({ ok: true, options });
}
