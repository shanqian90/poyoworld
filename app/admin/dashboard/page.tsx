import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { todayMMDD } from "@/lib/phone";

async function countRows(builder: PromiseLike<{ count: number | null }>) {
  const { count } = await builder;
  return count || 0;
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  const today = todayMMDD();

  const [
    todayCount,
    unassignedCount,
    reviewMissingCount,
    pendingRequestCount,
    activeVendorRows,
    depositWaitingRows,
  ] = await Promise.all([
    countRows(supabase.from("orders").select("*", { count: "exact", head: true }).eq("date_mmdd", today)),
    countRows(
      supabase.from("orders").select("*", { count: "exact", head: true }).or("manager.is.null,manager.eq.")
    ),
    countRows(
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .not("order_no", "is", null)
        .eq("review_done", false)
    ),
    countRows(
      supabase
        .from("work_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "접수")
        .eq("main_created", false)
    ),
    supabase.from("guide_products").select("code").eq("active", true),
    supabase
      .from("orders")
      .select("amount, review_fee")
      .eq("paid", false)
      .eq("review_done", true),
  ]);

  const activeVendorCount = new Set(
    (activeVendorRows.data || []).map((r) => r.code).filter(Boolean)
  ).size;
  const depositWaitingAmount = (depositWaitingRows.data || []).reduce(
    (sum, r) => sum + (r.amount || 0) + (r.review_fee || 0),
    0
  );

  const cards = [
    { label: "오늘 진행건수", value: `${todayCount.toLocaleString("ko-KR")}건`, href: "/admin", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { label: "예정 미배정", value: `${unassignedCount.toLocaleString("ko-KR")}건`, href: "/admin", color: "bg-amber-50 border-amber-200 text-amber-700" },
    { label: "리뷰 미제출", value: `${reviewMissingCount.toLocaleString("ko-KR")}건`, href: "/admin/review-missing", color: "bg-rose-50 border-rose-200 text-rose-700" },
    { label: "작업요청서 대기", value: `${pendingRequestCount.toLocaleString("ko-KR")}건`, href: "/admin/requests", color: "bg-violet-50 border-violet-200 text-violet-700" },
    { label: "진행중 업체", value: `${activeVendorCount.toLocaleString("ko-KR")}개사`, href: "/admin/guides", color: "bg-sky-50 border-sky-200 text-sky-700" },
    { label: "입금대기 금액", value: `₩${depositWaitingAmount.toLocaleString("ko-KR")}`, href: "/admin/settlement", color: "bg-neutral-50 border-neutral-300 text-neutral-700" },
  ];

  return (
    <div className="flex-1 flex flex-col p-3 gap-4">
      <div className="text-lg font-extrabold text-neutral-700">📊 진행상황 대시보드</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`rounded-2xl border px-4 py-4 flex flex-col gap-1 hover:shadow-md transition-shadow ${c.color}`}
          >
            <div className="text-xs font-bold opacity-80">{c.label}</div>
            <div className="text-2xl font-extrabold">{c.value}</div>
          </Link>
        ))}
      </div>
      <div className="text-xs text-neutral-400">
        각 카드를 누르면 해당 목록으로 이동합니다. 정산관리/리뷰미제출 페이지는 준비 중입니다.
      </div>
    </div>
  );
}
