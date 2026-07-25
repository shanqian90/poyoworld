import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const from = req.nextUrl.searchParams.get("from") || "";
  const to = req.nextUrl.searchParams.get("to") || "";
  const modeParam = req.nextUrl.searchParams.get("mode");
  const mode = modeParam === "unpaid" ? "unpaid" : modeParam === "pending" ? "pending" : "paid";
  const q = (req.nextUrl.searchParams.get("q") || "").trim().replace(/,/g, " ");

  if (mode !== "pending" && (!from || !to)) {
    return NextResponse.json({ ok: false, message: "조회 기간을 입력해주세요" }, { status: 400 });
  }

  let query = supabase
    .from("orders")
    .select(
      "id, date_mmdd, paid_date, company_name, product_name, option_text, order_no, buyer, receiver, phone, account_text, review_url, amount, review_fee, paid"
    );

  if (mode === "paid") {
    query = query.eq("paid", true).gte("paid_date", from).lte("paid_date", to).order("paid_date", { ascending: false });
  } else if (mode === "pending") {
    query = query
      .eq("paid", false)
      .eq("review_done", true)
      .not("order_no", "is", null)
      .order("date_mmdd", { ascending: false });
  } else {
    const fromMmdd = from.replace(/-/g, "").slice(4);
    const toMmdd = to.replace(/-/g, "").slice(4);
    query = query
      .eq("paid", false)
      .not("order_no", "is", null)
      .gte("date_mmdd", fromMmdd)
      .lte("date_mmdd", toMmdd)
      .order("date_mmdd", { ascending: false });
  }

  if (q) {
    query = query.or(`buyer.ilike.%${q}%,receiver.ilike.%${q}%,phone.ilike.%${q}%,product_name.ilike.%${q}%,order_no.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data || [] });
}
