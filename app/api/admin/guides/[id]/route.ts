import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

const EDITABLE_FIELDS = new Set([
  "active",
  "code",
  "company",
  "platform",
  "number_text",
  "short_name",
  "full_name",
  "option_text",
  "note",
  "product_url",
  "price",
  "review_fee",
  "payback_name",
  "has_receipt",
  "buy_type",
  "review_type",
  "delivery",
  "image_url",
  "deadline",
  "checked_at",
]);

const NUMBER_FIELDS = new Set(["price"]);
const BOOL_FIELDS = new Set(["active", "has_receipt"]);

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
  if (value === "") value = null;
  if (value !== null) {
    if (NUMBER_FIELDS.has(field)) value = Number(value);
    else if (BOOL_FIELDS.has(field)) value = !!value;
  }

  const { error } = await supabase
    .from("guide_products")
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
  const { error } = await supabase.from("guide_products").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
