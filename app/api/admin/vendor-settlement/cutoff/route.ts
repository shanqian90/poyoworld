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
  const cutoffDate = String(body.cutoffDate || "").trim();
  if (!loginId) return NextResponse.json({ ok: false, message: "업체를 선택해주세요" }, { status: 400 });
  if (!cutoffDate) return NextResponse.json({ ok: false, message: "기준일을 입력해주세요" }, { status: 400 });

  const { error } = await supabase
    .from("vendor_settlement_cutoff")
    .upsert({ login_id: loginId, cutoff_date: cutoffDate, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  const loginId = (req.nextUrl.searchParams.get("loginId") || "").trim();
  if (!loginId) return NextResponse.json({ ok: false, message: "업체를 선택해주세요" }, { status: 400 });

  const { error } = await supabase.from("vendor_settlement_cutoff").delete().ilike("login_id", loginId);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
