"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type RequestRow = {
  id: number;
  start_date: string;
  company_code: string | null;
  company_name: string;
  issue_date: string | null;
  deposit_amount: number | null;
  tax_bill: boolean;
};
type PaymentRow = { id: string; amount: number; paid_date: string; memo: string | null };

export default function VendorSettlementTab({ loginId }: { loginId: string }) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginId]);

  async function load() {
    setLoading(true);
    const [requestsRes, paymentsRes] = await Promise.all([
      supabase
        .from("work_requests")
        .select("id, start_date, company_code, company_name, issue_date, deposit_amount, tax_bill")
        .ilike("login_id", loginId)
        .order("start_date", { ascending: false }),
      supabase
        .from("vendor_payments")
        .select("id, amount, paid_date, memo")
        .ilike("login_id", loginId)
        .order("paid_date", { ascending: false }),
    ]);
    if (!requestsRes.error) setRequests((requestsRes.data || []) as RequestRow[]);
    if (!paymentsRes.error) setPayments((paymentsRes.data || []) as PaymentRow[]);
    setLoading(false);
  }

  if (loading) {
    return <div className="text-center text-sm text-neutral-500 py-10">불러오는 중...</div>;
  }

  const totalRequested = requests.reduce((sum, r) => sum + (r.deposit_amount || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const balance = totalPaid - totalRequested;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-800/5 border border-emerald-800 rounded-xl px-2 py-2 text-center">
          <div className="text-[11px] text-neutral-500">총 요청금액</div>
          <div className="text-sm font-extrabold text-emerald-900">₩{totalRequested.toLocaleString("ko-KR")}</div>
        </div>
        <div className="bg-emerald-800/5 border border-emerald-800 rounded-xl px-2 py-2 text-center">
          <div className="text-[11px] text-neutral-500">총 입금액</div>
          <div className="text-sm font-extrabold text-emerald-900">₩{totalPaid.toLocaleString("ko-KR")}</div>
        </div>
        <div
          className={`rounded-xl px-2 py-2 text-center border ${
            balance >= 0 ? "bg-emerald-800/5 border-emerald-800" : "bg-rose-50 border-rose-200"
          }`}
        >
          <div className="text-[11px] text-neutral-500">{balance >= 0 ? "잔액(저축)" : "부족액"}</div>
          <div className={`text-sm font-extrabold ${balance >= 0 ? "text-emerald-900" : "text-rose-700"}`}>
            ₩{Math.abs(balance).toLocaleString("ko-KR")}
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-neutral-500 mb-1.5">📝 견적서 발행 이력</div>
        <div className="border border-neutral-200 rounded-xl overflow-auto max-h-64">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-neutral-100 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-center">세금계산서 발행일</th>
                <th className="px-2 py-1.5 text-center">업체</th>
                <th className="px-2 py-1.5 text-center">요청금액</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100">
                  <td className="px-2 py-1.5 text-center">
                    {r.tax_bill ? r.issue_date || "미발행" : <span className="text-neutral-400">미요청</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {r.company_code} {r.company_name}
                  </td>
                  <td className="px-2 py-1.5 text-center">₩{(r.deposit_amount || 0).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
              {!requests.length && (
                <tr>
                  <td colSpan={3} className="text-center text-neutral-400 py-4">
                    발행 이력이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-neutral-500 mb-1.5">💳 실제 입금 이력</div>
        <div className="border border-neutral-200 rounded-xl overflow-auto max-h-64">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-neutral-100 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-center">입금일</th>
                <th className="px-2 py-1.5 text-center">금액</th>
                <th className="px-2 py-1.5 text-center">메모</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100">
                  <td className="px-2 py-1.5 text-center">{p.paid_date}</td>
                  <td className="px-2 py-1.5 text-center">₩{p.amount.toLocaleString("ko-KR")}</td>
                  <td className="px-2 py-1.5 text-center">{p.memo}</td>
                </tr>
              ))}
              {!payments.length && (
                <tr>
                  <td colSpan={3} className="text-center text-neutral-400 py-4">
                    입금 이력이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
