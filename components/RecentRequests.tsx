"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type WorkRequestReuse = {
  productUrl: string;
  startDate: string;
  option: string;
  keyword: string;
  price: string;
  total: string;
  daily: string;
  review: string;
  options: {
    realShip: string;
    payAgent: string;
    shipAgent: string;
    weekend: string;
    taxBill: string;
  };
};

type RequestItem = {
  id: number;
  receipt_no: string;
  start_date: string;
  keyword: string;
  product_url: string | null;
  product_option: string | null;
  product_price: number | null;
  total_count: number;
  daily_plan: string | null;
  review_type: string | null;
  real_shipping: boolean;
  payment_agency: boolean;
  delivery_agency: boolean;
  weekend_work: boolean;
  tax_bill: boolean;
  status: string;
  created_at: string;
};

export default function RecentRequests({
  vendorId,
  onReuse,
}: {
  vendorId: string;
  onReuse: (r: WorkRequestReuse) => void;
}) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("work_requests")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (!cancelled) {
          setItems((data || []) as RequestItem[]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (loading) return null;
  if (!items.length) return null;

  return (
    <div className="mb-4">
      <div className="text-xs font-bold text-neutral-500 mb-1.5">🕘 최근 제출한 요청 (최대 5개)</div>
      <div className="flex flex-col gap-1.5">
        {items.map((r) => (
          <div key={r.id} className="border border-neutral-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 bg-neutral-50">
            <div className="min-w-0 text-xs">
              <div className="font-bold text-neutral-700 truncate">{r.keyword}</div>
              <div className="text-neutral-400 truncate">
                {r.start_date} · {r.product_option || "-"} · {r.total_count}건 · {r.status}
              </div>
            </div>
            <button
              className="shrink-0 text-[11px] font-bold text-emerald-700 border border-emerald-300 rounded px-2 py-1"
              onClick={() =>
                onReuse({
                  productUrl: r.product_url || "",
                  startDate: r.start_date,
                  option: r.product_option || "",
                  keyword: r.keyword,
                  price: r.product_price != null ? String(r.product_price) : "",
                  total: String(r.total_count),
                  daily: r.daily_plan || "",
                  review: r.review_type || "",
                  options: {
                    realShip: r.real_shipping ? "Y" : "N",
                    payAgent: r.payment_agency ? "Y" : "N",
                    shipAgent: r.delivery_agency ? "Y" : "N",
                    weekend: r.weekend_work ? "Y" : "N",
                    taxBill: r.tax_bill ? "Y" : "N",
                  },
                })
              }
            >
              복사해서 새로 입력
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
