import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

const EDITABLE_FIELDS = new Set([
  "kakao_id",
  "store",
  "buyer",
  "receiver",
  "user_id",
  "phone",
  "address",
  "bank",
  "account_no",
  "holder",
]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const field = String(body.field || "");
  if (!EDITABLE_FIELDS.has(field)) {
    return NextResponse.json({ ok: false, message: "수정할 수 없는 항목입니다" }, { status: 400 });
  }

  const value = body.value === "" || body.value == null ? "" : String(body.value);

  const { error } = await supabase
    .from("accounts")
    .update({ [field]: value })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  void req;

  const { id } = await ctx.params;
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
