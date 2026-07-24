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
  if (!/^\d{4}$/.test(from) || !/^\d{4}$/.test(to)) {
    return NextResponse.json({ ok: false, message: "날짜는 MMDD 4자리로 입력해주세요" }, { status: 400 });
  }

  // 택배대행(Y)인 것만 = delivery 값이 채워진 것만, 실제 주문건만
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_no, receiver, address, phone, product_name, tracking, date_mmdd")
    .not("delivery", "is", null)
    .neq("delivery", "")
    .not("order_no", "is", null)
    .gte("date_mmdd", from)
    .lte("date_mmdd", to)
    .order("date_mmdd", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data || [] });
}
