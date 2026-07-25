import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

const EDITABLE_FIELDS = new Set([
  "start_date",
  "receipt_no",
  "company_code",
  "company_name",
  "biz_no",
  "owner_name",
  "phone",
  "login_id",
  "email",
  "issue_date",
  "deposit_amount",
  "deposit_date",
  "image_url",
  "weekend_work",
  "unit_price",
  "product_url",
  "product_option",
  "product_price",
  "keyword",
  "total_count",
  "daily_plan",
  "review_type",
  "real_shipping",
  "payment_agency",
  "delivery_agency",
  "tax_bill",
  "biz_file_url",
  "status",
  "main_created",
  "memo",
]);

const NUMBER_FIELDS = new Set(["unit_price", "product_price", "total_count", "deposit_amount"]);
const BOOL_FIELDS = new Set(["weekend_work", "real_shipping", "payment_agency", "delivery_agency", "tax_bill", "main_created"]);
const NOT_NULL_TEXT_FIELDS = new Set(["receipt_no", "company_name", "keyword"]);

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
  if (field === "start_date" && (value === "" || value == null)) {
    return NextResponse.json({ ok: true }); // 필수 날짜는 비울 수 없음 - 기존 값 유지
  }
  if (value === "") value = NOT_NULL_TEXT_FIELDS.has(field) ? "" : null;
  if (value !== null) {
    if (NUMBER_FIELDS.has(field)) value = Number(value);
    else if (BOOL_FIELDS.has(field)) value = !!value;
  }

  const { error } = await supabase
    .from("work_requests")
    .update({ [field]: value })
    .eq("id", rowId);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

  const { error } = await supabase.from("work_requests").delete().eq("id", rowId);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
