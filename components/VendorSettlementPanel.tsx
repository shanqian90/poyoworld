"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type VendorGroup = { loginId: string; companies: { code: string | null; name: string }[]; lastRequestDate: string | null };
type VendorWindowFilter = "전체" | "30일" | "7일" | "직접";
type RequestRow = {
  id: number;
  start_date: string;
  receipt_no: string;
  company_code: string | null;
  company_name: string;
  issue_date: string | null;
  deposit_amount: number | null;
  memo: string | null;
  tax_bill: boolean;
  status: string;
};
type PaymentRow = { id: string; amount: number; paid_date: string; memo: string | null };

type StatusFilter = "전체" | "접수" | "대기" | "진행중";
type RangeFilter = "전체" | "30일" | "7일";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function withinRange(dateStr: string | null, range: RangeFilter): boolean {
  if (range === "전체") return true;
  if (!dateStr) return false;
  const days = range === "30일" ? 30 : 7;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(dateStr) >= cutoff;
}

export default function VendorSettlementPanel() {
  const [vendors, setVendors] = useState<VendorGroup[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<VendorGroup | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [totals, setTotals] = useState({ totalRequested: 0, totalPaid: 0, balance: 0 });
  const [loading, setLoading] = useState(false);

  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(todayISO());
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("전체");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("전체");
  const [vendorWindow, setVendorWindow] = useState<VendorWindowFilter>("전체");
  const [vendorCustomDate, setVendorCustomDate] = useState(todayISO());

  useEffect(() => {
    fetch("/api/admin/vendor-settlement/vendors")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setVendors(data.vendors || []);
      });
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = vendors;
    if (query) {
      list = list.filter(
        (v) =>
          v.loginId.toLowerCase().includes(query) ||
          v.companies.some((c) => c.name.toLowerCase().includes(query) || (c.code || "").toLowerCase().includes(query))
      );
    }
    if (vendorWindow !== "전체") {
      let cutoff: Date;
      if (vendorWindow === "직접") {
        cutoff = new Date(vendorCustomDate);
      } else {
        cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - (vendorWindow === "30일" ? 30 : 7));
      }
      list = list.filter((v) => v.lastRequestDate && new Date(v.lastRequestDate) >= cutoff);
    }
    return list;
  }, [vendors, q, vendorWindow, vendorCustomDate]);

  async function selectVendor(v: VendorGroup) {
    setSelected(v);
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/vendor-settlement?loginId=${encodeURIComponent(v.loginId)}`);
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "조회 실패");
        return;
      }
      setRequests(data.requests || []);
      setPayments(data.payments || []);
      setTotals({ totalRequested: data.totalRequested, totalPaid: data.totalPaid, balance: data.balance });
    } finally {
      setLoading(false);
    }
  }

  async function addPayment() {
    if (!selected) return;
    const amt = Number(amount);
    if (!amt) {
      setMsg("입금액을 입력해주세요");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/vendor-settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: selected.loginId, amount: amt, paidDate, memo }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "등록 실패");
        return;
      }
      setAmount("");
      setMemo("");
      selectVendor(selected);
    } finally {
      setBusy(false);
    }
  }

  async function deletePayment(id: string) {
    if (!confirm("이 입금 내역을 삭제할까요?")) return;
    const res = await fetch(`/api/admin/vendor-settlement?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "삭제 실패");
      return;
    }
    if (selected) selectVendor(selected);
  }

  const filteredRequests = useMemo(() => {
    return requests.filter(
      (r) => (statusFilter === "전체" || r.status === statusFilter) && withinRange(r.start_date, rangeFilter)
    );
  }, [requests, statusFilter, rangeFilter]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => withinRange(p.paid_date, rangeFilter));
  }, [payments, rangeFilter]);

  async function updateIssueDate(id: number, value: string) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, issue_date: value } : r)));
    const res = await fetch(`/api/admin/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "issue_date", value }),
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "저장 실패");
      if (selected) selectVendor(selected);
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Link href="/admin/estimate" className="text-sm font-bold text-neutral-500 underline">
          ← 견적서 발행
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">🧾 업체정산</div>
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        <div className="w-72 shrink-0 border border-neutral-300 rounded-xl flex flex-col overflow-hidden">
          <input
            className="border-b border-neutral-200 px-3 py-2 text-sm outline-none"
            placeholder="업체명·업체코드·아이디 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="border-b border-neutral-200 px-2 py-1.5 flex flex-col gap-1.5">
            <div className="flex gap-1 flex-wrap">
              {(["전체", "7일", "30일", "직접"] as VendorWindowFilter[]).map((w) => (
                <button
                  key={w}
                  className={`text-[11px] rounded-lg px-2 py-1 font-bold border ${
                    vendorWindow === w ? "bg-neutral-800 text-white border-neutral-800" : "bg-white text-neutral-600 border-neutral-300"
                  }`}
                  onClick={() => setVendorWindow(w)}
                >
                  {w === "전체" ? "전체업체" : w === "직접" ? "직접입력" : `최근${w}이내`}
                </button>
              ))}
            </div>
            {vendorWindow === "직접" && (
              <input
                type="date"
                className="border border-neutral-300 rounded-lg px-2 py-1 text-xs"
                value={vendorCustomDate}
                onChange={(e) => setVendorCustomDate(e.target.value)}
              />
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map((v) => (
              <button
                key={v.loginId}
                onClick={() => selectVendor(v)}
                className={`w-full text-left px-3 py-2 text-xs border-b border-neutral-100 hover:bg-neutral-50 ${
                  selected?.loginId === v.loginId ? "bg-emerald-50" : ""
                }`}
              >
                <div className="font-bold">{v.loginId}</div>
                <div className="text-neutral-400 truncate">
                  {v.companies.map((c) => `${c.code ? c.code + " " : ""}${c.name}`).join(", ")}
                </div>
              </button>
            ))}
            {!filtered.length && <div className="text-center text-xs text-neutral-400 py-6">업체가 없습니다</div>}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {!selected && (
            <div className="text-center text-sm text-neutral-400 py-10">왼쪽에서 업체를 선택해주세요</div>
          )}
          {selected && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-center">
                  <div className="text-[11px] text-neutral-500">총 요청금액</div>
                  <div className="text-lg font-extrabold">₩{totals.totalRequested.toLocaleString("ko-KR")}</div>
                </div>
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-center">
                  <div className="text-[11px] text-neutral-500">총 입금액</div>
                  <div className="text-lg font-extrabold">₩{totals.totalPaid.toLocaleString("ko-KR")}</div>
                </div>
                <div
                  className={`rounded-xl px-3 py-2 text-center border ${
                    totals.balance >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
                  }`}
                >
                  <div className="text-[11px] text-neutral-500">{totals.balance >= 0 ? "잔액(저축)" : "부족액"}</div>
                  <div className={`text-lg font-extrabold ${totals.balance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    ₩{Math.abs(totals.balance).toLocaleString("ko-KR")}
                  </div>
                </div>
              </div>

              <div className="border border-neutral-300 rounded-xl p-3 bg-white">
                <div className="text-xs font-bold text-neutral-600 mb-2">💰 입금 등록</div>
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="number"
                    className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm w-32"
                    placeholder="입금액"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <input
                    type="date"
                    className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                  />
                  <input
                    className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[120px]"
                    placeholder="메모 (선택)"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                  <button
                    className="bg-emerald-600 text-white text-xs font-bold rounded-lg px-3 py-1.5 disabled:opacity-60"
                    onClick={addPayment}
                    disabled={busy}
                  >
                    {busy ? "등록 중..." : "등록"}
                  </button>
                </div>
                {msg && <div className="text-xs text-neutral-500 mt-1.5">{msg}</div>}
              </div>

              {loading && <div className="text-center text-sm text-neutral-400 py-6">불러오는 중...</div>}

              {!loading && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-neutral-500">진행상태</span>
                  {(["전체", "접수", "대기", "진행중"] as StatusFilter[]).map((s) => (
                    <button
                      key={s}
                      className={`rounded-lg px-2.5 py-1 font-bold border ${
                        statusFilter === s ? "bg-neutral-800 text-white border-neutral-800" : "bg-white text-neutral-600 border-neutral-300"
                      }`}
                      onClick={() => setStatusFilter(s)}
                    >
                      {s}
                    </button>
                  ))}
                  <span className="font-bold text-neutral-500 ml-3">기간</span>
                  {(["전체", "30일", "7일"] as RangeFilter[]).map((r) => (
                    <button
                      key={r}
                      className={`rounded-lg px-2.5 py-1 font-bold border ${
                        rangeFilter === r ? "bg-neutral-800 text-white border-neutral-800" : "bg-white text-neutral-600 border-neutral-300"
                      }`}
                      onClick={() => setRangeFilter(r)}
                    >
                      {r === "전체" ? "전체내역" : `최근${r}이내`}
                    </button>
                  ))}
                </div>
              )}

              {!loading && (
                <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                  <div className="border border-neutral-300 rounded-xl overflow-auto">
                    <div className="sticky top-0 bg-neutral-800 text-white text-xs font-bold px-3 py-2">📝 견적서 발행 이력</div>
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-neutral-100">
                        <tr>
                          <th className="px-2 py-1.5 text-center">세금계산서 발행일</th>
                          <th className="px-2 py-1.5 text-center">업체</th>
                          <th className="px-2 py-1.5 text-center">요청금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRequests.map((r) => (
                          <tr key={r.id} className="border-b border-neutral-100">
                            <td className="px-1 py-1 text-center">
                              {r.tax_bill ? (
                                <input
                                  type="date"
                                  className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                                  value={r.issue_date || ""}
                                  onChange={(e) => updateIssueDate(r.id, e.target.value)}
                                />
                              ) : (
                                <span className="text-neutral-400">미요청</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-center">{r.company_code} {r.company_name}</td>
                            <td className="px-2 py-1.5 text-center">₩{(r.deposit_amount || 0).toLocaleString("ko-KR")}</td>
                          </tr>
                        ))}
                        {!filteredRequests.length && (
                          <tr>
                            <td colSpan={3} className="text-center text-neutral-400 py-4">
                              발행 이력이 없습니다
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="border border-neutral-300 rounded-xl overflow-auto">
                    <div className="sticky top-0 bg-neutral-800 text-white text-xs font-bold px-3 py-2">💳 실제 입금 이력</div>
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-neutral-100">
                        <tr>
                          <th className="px-2 py-1.5 text-center">입금일</th>
                          <th className="px-2 py-1.5 text-center">금액</th>
                          <th className="px-2 py-1.5 text-center">메모</th>
                          <th className="px-2 py-1.5 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((p) => (
                          <tr key={p.id} className="border-b border-neutral-100">
                            <td className="px-2 py-1.5 text-center">{p.paid_date}</td>
                            <td className="px-2 py-1.5 text-center">₩{p.amount.toLocaleString("ko-KR")}</td>
                            <td className="px-2 py-1.5 text-center">{p.memo}</td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                className="text-neutral-400 hover:text-rose-600 font-bold"
                                onClick={() => deletePayment(p.id)}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!filteredPayments.length && (
                          <tr>
                            <td colSpan={4} className="text-center text-neutral-400 py-4">
                              입금 이력이 없습니다
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
