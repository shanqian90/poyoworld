import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

type Row = {
  id: number;
  date_mmdd: string;
  company_code: string | null;
  company_name: string | null;
  platform: string | null;
  product_url: string | null;
  product_name: string;
  option_text: string;
  review_type: string | null;
  review_url: string | null;
  manager: string | null;
  real_manager: string | null;
  order_image: string | null;
  order_no: string | null;
  buyer: string | null;
  receiver: string | null;
  user_id: string | null;
  phone: string | null;
  address: string | null;
  account_text: string | null;
  amount: number | null;
  review_fee: number;
  paid: boolean;
  paid_date: string | null;
  company_paid: string | null;
  delivery: string | null;
  tracking: string | null;
};

function daysSinceMmdd(mmdd: string): number {
  if (!/^\d{4}$/.test(mmdd)) return -1;
  const month = Number(mmdd.slice(0, 2)) - 1;
  const day = Number(mmdd.slice(2));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let target = new Date(today.getFullYear(), month, day);
  if (target.getTime() > today.getTime()) {
    target = new Date(today.getFullYear() - 1, month, day);
  }
  return Math.round((today.getTime() - target.getTime()) / 86400000);
}

const COLS: { key: keyof Row; label: string; align?: "right" }[] = [
  { key: "date_mmdd", label: "날짜" },
  { key: "company_code", label: "업체코드" },
  { key: "company_name", label: "업체명" },
  { key: "platform", label: "플랫폼명" },
  { key: "product_name", label: "제품명" },
  { key: "option_text", label: "구매옵션" },
  { key: "review_type", label: "리뷰종류" },
  { key: "manager", label: "예정" },
  { key: "real_manager", label: "실진행" },
  { key: "order_no", label: "주문번호" },
  { key: "buyer", label: "구매자" },
  { key: "receiver", label: "수취인" },
  { key: "user_id", label: "아이디" },
  { key: "phone", label: "전화번호" },
  { key: "address", label: "주소" },
  { key: "account_text", label: "계좌" },
  { key: "amount", label: "금액", align: "right" },
  { key: "review_fee", label: "리뷰금액", align: "right" },
  { key: "paid", label: "입금" },
  { key: "paid_date", label: "입금일" },
  { key: "company_paid", label: "업체입금" },
  { key: "delivery", label: "택배대행" },
  { key: "tracking", label: "운송장번호" },
];

export default async function AdminReviewMissingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, date_mmdd, company_code, company_name, platform, product_url, product_name, option_text, review_type, review_url, manager, real_manager, order_image, order_no, buyer, receiver, user_id, phone, address, account_text, amount, review_fee, paid, paid_date, company_paid, delivery, tracking"
    )
    .not("order_no", "is", null)
    .eq("review_done", false)
    .order("date_mmdd", { ascending: true });

  const rows = ((data || []) as Row[]).filter((r) => daysSinceMmdd(r.date_mmdd) >= 8);

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3 gap-3 min-w-0">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">📮 리뷰 미제출 명단</div>
        <span className="text-xs text-neutral-500">{rows.length.toLocaleString("ko-KR")}건</span>
      </div>
      <div className="text-xs text-neutral-400">
        구매(주문번호)는 완료되었지만 아직 리뷰를 제출하지 않은 건 중 진행일자 기준 8일 이상 지난 건만 표시합니다.
      </div>
      {error && <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">{error.message}</div>}
      <div className="border border-neutral-300 rounded-xl overflow-auto flex-1">
        <table className="text-xs border-collapse w-full min-w-max">
          <thead className="bg-neutral-800 text-white sticky top-0">
            <tr>
              <th className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">순번</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">구매이미지</th>
              <th className="px-2 py-2 text-center whitespace-nowrap">리뷰이미지</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-neutral-200">
                <td className="px-2 py-1.5 text-center border-r border-neutral-100">{i + 1}</td>
                {COLS.map((c) => {
                  const v = r[c.key];
                  let content: ReactNode = v ?? "—";
                  if (c.key === "paid") content = v ? "✅" : "❌";
                  if (c.key === "amount" || c.key === "review_fee") {
                    content = `${Number(v || 0).toLocaleString("ko-KR")}원`;
                  }
                  return (
                    <td
                      key={c.key}
                      className={`px-2 py-1.5 border-r border-neutral-100 whitespace-nowrap ${
                        c.align === "right" ? "text-right" : "text-center"
                      }`}
                    >
                      {content}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center border-r border-neutral-100">
                  {r.order_image ? (
                    <a href={r.order_image} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-bold">
                      보기
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-1.5 text-center">
                  {r.review_url ? (
                    <a href={r.review_url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-bold">
                      보기
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={COLS.length + 3} className="text-center text-neutral-400 py-8">
                  리뷰 미제출 건이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
