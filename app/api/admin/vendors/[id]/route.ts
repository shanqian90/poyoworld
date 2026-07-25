import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

const EDITABLE_FIELDS = new Set([
  "login_id",
  "company_code",
  "company_name",
  "biz_no",
  "owner_name",
  "email",
  "real_ship_price",
  "empty_box_price",
  "biz_file_url",
]);

const NUMBER_FIELDS = new Set(["real_ship_price", "empty_box_price"]);
const NOT_NULL_TEXT_FIELDS = new Set(["login_id", "company_name"]);

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

  let value = body.value;
  if (value === "") value = NOT_NULL_TEXT_FIELDS.has(field) ? "" : null;
  if (value !== null && NUMBER_FIELDS.has(field)) value = Number(value);

  const { error } = await supabase
    .from("vendors")
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
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
