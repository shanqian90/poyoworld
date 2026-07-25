import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  return isValidAdminToken(token);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const loginId = String(body.loginId || "").trim();
  const companyCode = body.companyCode ? String(body.companyCode) : null;
  const companyName = String(body.companyName || "").trim();
  const productName = body.productName ? String(body.productName) : null;
  const amount = Number(body.amount);
  const chargeDate = String(body.chargeDate || "").trim();
  const memo = body.memo ? String(body.memo) : null;

  if (!loginId) return NextResponse.json({ ok: false, message: "업체를 선택해주세요" }, { status: 400 });
  if (!companyName) return NextResponse.json({ ok: false, message: "업체명을 입력해주세요" }, { status: 400 });
  if (!amount) return NextResponse.json({ ok: false, message: "금액을 입력해주세요" }, { status: 400 });
  if (!chargeDate) return NextResponse.json({ ok: false, message: "날짜를 입력해주세요" }, { status: 400 });

  const { data, error } = await supabase
    .from("vendor_charges")
    .insert({ login_id: loginId, company_code: companyCode, company_name: companyName, product_name: productName, amount, charge_date: chargeDate, memo })
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

  const companyCode = body.companyCode ? String(body.companyCode) : null;
  const companyName = String(body.companyName || "").trim();
  const productName = body.productName ? String(body.productName) : null;
  const amount = Number(body.amount);
  const chargeDate = String(body.chargeDate || "").trim();
  const memo = body.memo ? String(body.memo) : null;

  if (!companyName) return NextResponse.json({ ok: false, message: "업체명을 입력해주세요" }, { status: 400 });
  if (!amount) return NextResponse.json({ ok: false, message: "금액을 입력해주세요" }, { status: 400 });
  if (!chargeDate) return NextResponse.json({ ok: false, message: "날짜를 입력해주세요" }, { status: 400 });

  const { error } = await supabase
    .from("vendor_charges")
    .update({ company_code: companyCode, company_name: companyName, product_name: productName, amount, charge_date: chargeDate, memo })
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
  const { error } = await supabase.from("vendor_charges").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
