import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  return isValidAdminToken(token);
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const loginId = (req.nextUrl.searchParams.get("loginId") || "").trim();
  if (!loginId) {
    return NextResponse.json({ ok: false, message: "업체를 선택해주세요" }, { status: 400 });
  }

  const [requestsRes, paymentsRes, chargesRes] = await Promise.all([
    supabase
      .from("work_requests")
      .select(
        "id, start_date, receipt_no, company_code, company_name, issue_date, deposit_amount, memo, tax_bill, status, keyword, total_count, image_url, vendors(company_code)"
      )
      .ilike("login_id", loginId)
      .order("start_date", { ascending: false }),
    supabase
      .from("vendor_payments")
      .select("id, amount, paid_date, memo, company_code, company_name")
      .ilike("login_id", loginId)
      .order("paid_date", { ascending: false }),
    supabase
      .from("vendor_charges")
      .select("id, company_code, company_name, product_name, amount, charge_date, memo")
      .ilike("login_id", loginId)
      .order("charge_date", { ascending: false }),
  ]);

  if (requestsRes.error) return NextResponse.json({ ok: false, message: requestsRes.error.message }, { status: 500 });
  if (paymentsRes.error) return NextResponse.json({ ok: false, message: paymentsRes.error.message }, { status: 500 });
  if (chargesRes.error) return NextResponse.json({ ok: false, message: chargesRes.error.message }, { status: 500 });

  const totalRequested =
    (requestsRes.data || []).reduce((sum, r) => sum + (r.deposit_amount || 0), 0) +
    (chargesRes.data || []).reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalPaid = (paymentsRes.data || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  return NextResponse.json({
    ok: true,
    requests: requestsRes.data || [],
    payments: paymentsRes.data || [],
    charges: chargesRes.data || [],
    totalRequested,
    totalPaid,
    balance: totalPaid - totalRequested,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const loginId = String(body.loginId || "").trim();
  const amount = Number(body.amount);
  const paidDate = String(body.paidDate || "").trim();
  const memo = body.memo ? String(body.memo) : null;
  const companyCode = body.companyCode ? String(body.companyCode) : null;
  const companyName = body.companyName ? String(body.companyName) : null;

  if (!loginId) return NextResponse.json({ ok: false, message: "업체를 선택해주세요" }, { status: 400 });
  if (!amount) return NextResponse.json({ ok: false, message: "입금액을 입력해주세요" }, { status: 400 });
  if (!paidDate) return NextResponse.json({ ok: false, message: "입금일을 입력해주세요" }, { status: 400 });

  const { data, error } = await supabase
    .from("vendor_payments")
    .insert({ login_id: loginId, amount, paid_date: paidDate, memo, company_code: companyCode, company_name: companyName })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, row: data });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ ok: false, message: "잘못된 요청입니다" }, { status: 400 });

  const amount = Number(body.amount);
  const paidDate = String(body.paidDate || "").trim();
  if (!amount) return NextResponse.json({ ok: false, message: "입금액을 입력해주세요" }, { status: 400 });
  if (!paidDate) return NextResponse.json({ ok: false, message: "입금일을 입력해주세요" }, { status: 400 });
  const memo = body.memo ? String(body.memo) : null;
  const companyCode = body.companyCode ? String(body.companyCode) : null;
  const companyName = body.companyName ? String(body.companyName) : null;

  const { error } = await supabase
    .from("vendor_payments")
    .update({ amount, paid_date: paidDate, memo, company_code: companyCode, company_name: companyName })
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, message: "잘못된 요청입니다" }, { status: 400 });
  const { error } = await supabase.from("vendor_payments").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
