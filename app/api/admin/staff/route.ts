import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  return isValidAdminToken(token);
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  const { data, error } = await supabase.rpc("admin_list_staff");
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data || [] });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  const body = await req.json();
  const { data, error } = await supabase.rpc("admin_upsert_staff", {
    p_id: body.id || null,
    p_name: String(body.name || "").trim(),
    p_login_id: String(body.loginId || "").trim(),
    p_account_text: body.accountText ? String(body.accountText).trim() : null,
    p_hourly_wage: Number(body.hourlyWage) || 0,
    p_withhold_tax: !!body.withholdTax,
    p_active: body.active !== false,
    p_is_fixed_salary: !!body.isFixedSalary,
  });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data?.id });
}
