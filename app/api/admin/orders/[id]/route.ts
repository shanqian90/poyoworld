import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

const EDITABLE_FIELDS = new Set([
  "seq",
  "date_mmdd",
  "company_code",
  "company_name",
  "platform",
  "product_url",
  "product_name",
  "option_text",
  "review_type",
  "review_url",
  "manager",
  "real_manager",
  "order_no",
  "buyer",
  "receiver",
  "user_id",
  "phone",
  "address",
  "account_text",
  "amount",
  "review_fee",
  "review_done",
  "paid",
  "paid_date",
  "company_paid",
  "delivery",
  "tracking",
  "remark",
  "hidden_from_active",
  "full_date",
]);

const NUMBER_FIELDS = new Set(["amount", "review_fee"]);
const BOOL_FIELDS = new Set(["review_done", "paid", "hidden_from_active"]);
const NOT_NULL_TEXT_FIELDS = new Set(["date_mmdd", "product_name", "option_text"]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!rowId) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다" }, { status: 400 });
  }

  const body = await req.json();
  const field = String(body.field || "");
  if (!EDITABLE_FIELDS.has(field)) {
    return NextResponse.json({ ok: false, message: "수정할 수 없는 항목입니다" }, { status: 400 });
  }

  let value = body.value;
  if (value === "") value = NOT_NULL_TEXT_FIELDS.has(field) ? "" : null;
  if (value !== null) {
    if (NUMBER_FIELDS.has(field)) value = Number(value);
    else if (BOOL_FIELDS.has(field)) value = !!value;
  }

  let update: Record<string, unknown> = { [field]: value };
  if (field === "full_date" && typeof value === "string") {
    const m = value.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (!m) {
      return NextResponse.json({ ok: false, message: "날짜 형식이 올바르지 않습니다" }, { status: 400 });
    }
    update = { full_date: value, date_mmdd: `${m[1]}${m[2]}` };
  }

  const { error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", rowId);

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
  const rowId = Number(id);
  if (!rowId) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다" }, { status: 400 });
  }

  const { error } = await supabase.from("orders").delete().eq("id", rowId);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
