import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

const HEADERS = [
  "시작일",
  "접수번호",
  "업체코드",
  "업체명",
  "사업자번호",
  "대표자명",
  "전화번호",
  "이메일",
  "발행일",
  "입금금액",
  "입금일",
  "이미지",
  "주말진행",
  "계약단가",
  "진행제품URL",
  "제품옵션",
  "제품판매가",
  "검색키워드",
  "총진행건수",
  "일진행건수",
  "리뷰종류",
  "제품실제배송여부",
  "입금대행",
  "택배대행",
  "세금계산서",
  "사업자등록증",
  "진행상태",
  "생성",
  "업체요구사항",
];

function boolLabel(v: boolean | null): string {
  return v ? "예" : "아니오";
}

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 2);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("work_requests")
    .select("*")
    .lt("start_date", cutoffStr)
    .order("start_date", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const rows = data || [];
  if (!rows.length) {
    return NextResponse.json({ ok: false, message: `${cutoffStr} 이전 데이터가 없습니다` }, { status: 400 });
  }

  const aoa: (string | number)[][] = [HEADERS];
  for (const r of rows) {
    aoa.push([
      r.start_date || "",
      r.receipt_no || "",
      r.company_code || "",
      r.company_name || "",
      r.biz_no || "",
      r.owner_name || "",
      r.phone || "",
      r.email || "",
      r.issue_date || "",
      r.deposit_amount ?? "",
      r.deposit_date || "",
      r.image_url || "",
      boolLabel(r.weekend_work),
      r.unit_price ?? "",
      r.product_url || "",
      r.product_option || "",
      r.product_price ?? "",
      r.keyword || "",
      r.total_count ?? "",
      r.daily_plan || "",
      r.review_type || "",
      boolLabel(r.real_shipping),
      boolLabel(r.payment_agency),
      boolLabel(r.delivery_agency),
      boolLabel(r.tax_bill),
      r.biz_file_url || "",
      r.status || "",
      boolLabel(r.main_created),
      r.memo || "",
    ]);
  }

  const ids = rows.map((r) => r.id);
  const { error: delError } = await supabase.from("work_requests").delete().in("id", ids);
  if (delError) {
    return NextResponse.json({ ok: false, message: delError.message }, { status: 500 });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, "업체견적서_백업");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        `${todayStr} 업체견적서_2개월이전백업.xlsx`
      )}`,
      "X-Deleted-Count": String(ids.length),
    },
  });
}
