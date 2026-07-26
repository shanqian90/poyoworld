import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

const HEADERS = [
  "순번",
  "날짜",
  "업체코드",
  "업체명",
  "플랫폼명",
  "제품URL",
  "제품명",
  "구매옵션",
  "리뷰종류",
  "리뷰이미지",
  "예정",
  "실진행",
  "구매이미지",
  "주문번호",
  "구매자",
  "수취인",
  "아이디",
  "전화번호",
  "주소",
  "계좌",
  "금액",
  "리뷰금액",
  "리뷰작성",
  "입금",
  "입금일",
  "업체입금(입금자명)",
  "택배대행",
  "운송장번호",
];

function boolLabel(v: boolean | null): string {
  return v ? "완료" : "미완료";
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const year = Number(body.year);
  const month = Number(body.month);
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다" }, { status: 400 });
  }

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const { data: rows, error: selectError } = await supabase
    .from("orders")
    .select("*")
    .or(
      `and(full_date.gte.${start},full_date.lt.${end}),and(full_date.is.null,created_at.gte.${start},created_at.lt.${end})`
    );

  if (selectError) {
    return NextResponse.json({ ok: false, message: selectError.message }, { status: 500 });
  }
  if (!rows || !rows.length) {
    return NextResponse.json({ ok: false, message: `${year}년 ${month}월 진행건이 없습니다` }, { status: 400 });
  }

  const aoa: (string | number)[][] = [HEADERS];
  for (const r of rows) {
    aoa.push([
      r.seq || "",
      r.date_mmdd || "",
      r.company_code || "",
      r.company_name || "",
      r.platform || "",
      r.product_url || "",
      r.product_name || "",
      r.option_text || "",
      r.review_type || "",
      r.review_url || "",
      r.manager || "",
      r.real_manager || "",
      r.order_image || "",
      r.order_no || "",
      r.buyer || "",
      r.receiver || "",
      r.user_id || "",
      r.phone || "",
      r.address || "",
      r.account_text || "",
      r.amount ?? "",
      r.review_fee ?? "",
      boolLabel(r.review_done),
      boolLabel(r.paid),
      r.paid_date || "",
      r.company_paid || "",
      r.delivery || "",
      r.tracking || "",
    ]);
  }

  const ids = rows.map((r) => r.id);
  const { error: delError, count } = await supabase.from("orders").delete({ count: "exact" }).in("id", ids);
  if (delError) {
    return NextResponse.json({ ok: false, message: delError.message }, { status: 500 });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, "전체보기_삭제백업");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        `${year}년${month}월_전체보기_삭제백업.xlsx`
      )}`,
      "X-Deleted-Count": String(count ?? ids.length),
      "X-Deleted-Ids": JSON.stringify(ids),
    },
  });
}
