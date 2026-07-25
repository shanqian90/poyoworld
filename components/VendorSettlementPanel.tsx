"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type VendorGroup = {
  loginId: string;
  companies: { code: string | null; name: string; ownerName: string | null }[];
  lastRequestDate: string | null;
};
type VendorWindowFilter = "전체" | "30일" | "7일" | "직접";
type PaymentRow = {
  id: string;
  amount: number;
  paid_date: string;
  memo: string | null;
  company_code: string | null;
  company_name: string | null;
};
type ChargeRow = {
  id: string;
  company_code: string | null;
  company_name: string;
  product_name: string | null;
  amount: number;
  charge_date: string;
  memo: string | null;
};
type Company = { code: string | null; name: string };

type RangeFilter = "전체" | "30일" | "7일";
type SortKey = "reqDate" | "company" | "keyword" | "deposit";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortDate(iso: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${y.slice(2)}/${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function companyKey(c: Company): string {
  return JSON.stringify({ code: c.code, name: c.name });
}

function parseCompanyKey(key: string): Company | null {
  if (!key) return null;
  try {
    return JSON.parse(key);
  } catch {
    return null;
  }
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
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [totals, setTotals] = useState({ totalRequested: 0, totalPaid: 0, balance: 0 });
  const [loading, setLoading] = useState(false);
  const [settlementCutoff, setSettlementCutoff] = useState<string | null>(null);
  const [cutoffInput, setCutoffInput] = useState(todayISO());
  const [cutoffBusy, setCutoffBusy] = useState(false);
  const [showCutoffEdit, setShowCutoffEdit] = useState(false);

  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(todayISO());
  const [memo, setMemo] = useState("");
  const [paymentCompanyKey, setPaymentCompanyKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("전체");
  const [vendorWindow, setVendorWindow] = useState<VendorWindowFilter>("전체");
  const [vendorCustomDate, setVendorCustomDate] = useState(todayISO());
  const [sortKey, setSortKey] = useState<SortKey>("reqDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editPaidDate, setEditPaidDate] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [editPaymentCompanyKey, setEditPaymentCompanyKey] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);

  const [chargeCompanyKey, setChargeCompanyKey] = useState("");
  const [chargeProductName, setChargeProductName] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDate, setChargeDate] = useState(todayISO());
  const [chargeMemo, setChargeMemo] = useState("");
  const [chargeBusy, setChargeBusy] = useState(false);
  const [chargeMsg, setChargeMsg] = useState("");
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [editChargeCompanyKey, setEditChargeCompanyKey] = useState("");
  const [editChargeProductName, setEditChargeProductName] = useState("");
  const [editChargeAmount, setEditChargeAmount] = useState("");
  const [editChargeDate, setEditChargeDate] = useState("");
  const [editChargeMemo, setEditChargeMemo] = useState("");
  const [addingCharge, setAddingCharge] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);

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
          v.companies.some(
            (c) =>
              c.name.toLowerCase().includes(query) ||
              (c.code || "").toLowerCase().includes(query) ||
              (c.ownerName || "").toLowerCase().includes(query)
          )
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
      setPayments(data.payments || []);
      setCharges(data.charges || []);
      setTotals({ totalRequested: data.totalRequested, totalPaid: data.totalPaid, balance: data.balance });
      setSettlementCutoff(data.settlementCutoff || null);
      setCutoffInput(data.settlementCutoff || todayISO());
      setShowCutoffEdit(false);
      setAddingCharge(false);
      setAddingPayment(false);
    } finally {
      setLoading(false);
    }
  }

  async function saveCutoff() {
    if (!selected || !cutoffInput) return;
    setCutoffBusy(true);
    try {
      const res = await fetch("/api/admin/vendor-settlement/cutoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: selected.loginId, cutoffDate: cutoffInput }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "기준일 저장 실패");
        return;
      }
      await selectVendor(selected);
    } finally {
      setCutoffBusy(false);
    }
  }

  async function clearCutoff() {
    if (!selected) return;
    if (!confirm("집계 기준일을 해제할까요? 다시 전체 기간을 집계합니다.")) return;
    setCutoffBusy(true);
    try {
      const res = await fetch(`/api/admin/vendor-settlement/cutoff?loginId=${encodeURIComponent(selected.loginId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "기준일 해제 실패");
        return;
      }
      await selectVendor(selected);
    } finally {
      setCutoffBusy(false);
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
      const comp = parseCompanyKey(paymentCompanyKey);
      const res = await fetch("/api/admin/vendor-settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: selected.loginId,
          amount: amt,
          paidDate,
          memo,
          companyCode: comp?.code || null,
          companyName: comp?.name || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "등록 실패");
        return;
      }
      setAmount("");
      setMemo("");
      setPaymentCompanyKey("");
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

  function startEditPayment(p: PaymentRow) {
    setEditingPaymentId(p.id);
    setEditAmount(String(p.amount));
    setEditPaidDate(p.paid_date);
    setEditMemo(p.memo || "");
    setEditPaymentCompanyKey(companyKey({ code: p.company_code, name: p.company_name || "" }));
  }

  async function saveEditPayment() {
    if (!editingPaymentId) return;
    setPaymentBusy(true);
    try {
      const comp = parseCompanyKey(editPaymentCompanyKey);
      const res = await fetch("/api/admin/vendor-settlement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPaymentId,
          amount: Number(editAmount),
          paidDate: editPaidDate,
          memo: editMemo,
          companyCode: comp?.code || null,
          companyName: comp?.name || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "수정 실패");
        return;
      }
      setEditingPaymentId(null);
      if (selected) selectVendor(selected);
    } finally {
      setPaymentBusy(false);
    }
  }

  async function addCharge() {
    if (!selected) return;
    const comp = parseCompanyKey(chargeCompanyKey);
    const amt = Number(chargeAmount);
    if (!comp?.name) {
      setChargeMsg("업체를 선택해주세요");
      return;
    }
    if (!amt) {
      setChargeMsg("금액을 입력해주세요");
      return;
    }
    setChargeBusy(true);
    setChargeMsg("");
    try {
      const res = await fetch("/api/admin/vendor-settlement/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: selected.loginId,
          companyCode: comp.code,
          companyName: comp.name,
          productName: chargeProductName,
          amount: amt,
          chargeDate,
          memo: chargeMemo,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setChargeMsg(data.message || "등록 실패");
        return;
      }
      setChargeAmount("");
      setChargeMemo("");
      setChargeCompanyKey("");
      setChargeProductName("");
      selectVendor(selected);
    } finally {
      setChargeBusy(false);
    }
  }

  async function deleteCharge(id: string) {
    if (!confirm("이 받을 돈 내역을 삭제할까요?")) return;
    const res = await fetch(`/api/admin/vendor-settlement/charges?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "삭제 실패");
      return;
    }
    if (selected) selectVendor(selected);
  }

  function startEditCharge(c: ChargeRow) {
    setEditingChargeId(c.id);
    setEditChargeAmount(String(c.amount));
    setEditChargeDate(c.charge_date);
    setEditChargeMemo(c.memo || "");
    setEditChargeProductName(c.product_name || "");
    setEditChargeCompanyKey(companyKey({ code: c.company_code, name: c.company_name }));
  }

  async function saveEditCharge() {
    if (!editingChargeId) return;
    const comp = parseCompanyKey(editChargeCompanyKey);
    if (!comp?.name) {
      alert("업체를 선택해주세요");
      return;
    }
    setChargeBusy(true);
    try {
      const res = await fetch("/api/admin/vendor-settlement/charges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingChargeId,
          companyCode: comp.code,
          companyName: comp.name,
          productName: editChargeProductName,
          amount: Number(editChargeAmount),
          chargeDate: editChargeDate,
          memo: editChargeMemo,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "수정 실패");
        return;
      }
      setEditingChargeId(null);
      if (selected) selectVendor(selected);
    } finally {
      setChargeBusy(false);
    }
  }

  const filteredCharges = useMemo(() => {
    return charges.filter((c) => withinRange(c.charge_date, rangeFilter));
  }, [charges, rangeFilter]);

  const sortedCharges = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filteredCharges].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "reqDate":
          av = a.charge_date;
          bv = b.charge_date;
          break;
        case "company":
          av = `${a.company_code || ""}${a.company_name}`;
          bv = `${b.company_code || ""}${b.company_name}`;
          break;
        case "keyword":
          av = a.product_name || "";
          bv = b.product_name || "";
          break;
        case "deposit":
          av = a.amount;
          bv = b.amount;
          break;
      }
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "ko") * dir;
    });
  }, [filteredCharges, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => withinRange(p.paid_date, rangeFilter));
  }, [payments, rangeFilter]);

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
            placeholder="업체명·업체코드·대표자명·아이디 검색"
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
                    {totals.balance < 0 ? "-" : ""}₩{Math.abs(totals.balance).toLocaleString("ko-KR")}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                {settlementCutoff ? (
                  <>
                    <span className="font-bold text-amber-700">
                      📌 {settlementCutoff} 이후 건만 집계 중 (그 이전은 정산완료 처리됨)
                    </span>
                    <button
                      className="ml-auto text-neutral-500 underline font-bold"
                      onClick={clearCutoff}
                      disabled={cutoffBusy}
                    >
                      해제
                    </button>
                  </>
                ) : showCutoffEdit ? (
                  <>
                    <span className="font-bold text-neutral-600">이 날짜 이후 건만 집계:</span>
                    <input
                      type="date"
                      className="border border-neutral-300 rounded-lg px-2 py-1"
                      value={cutoffInput}
                      onChange={(e) => setCutoffInput(e.target.value)}
                    />
                    <button
                      className="bg-neutral-800 text-white rounded-lg px-3 py-1 font-bold disabled:opacity-60"
                      onClick={saveCutoff}
                      disabled={cutoffBusy}
                    >
                      저장
                    </button>
                    <button className="text-neutral-500 underline font-bold" onClick={() => setShowCutoffEdit(false)}>
                      취소
                    </button>
                  </>
                ) : (
                  <button className="font-bold text-amber-700 underline" onClick={() => setShowCutoffEdit(true)}>
                    📌 예전 건은 이미 정산 끝났으면, 집계 기준일 설정하기
                  </button>
                )}
              </div>

              {loading && <div className="text-center text-sm text-neutral-400 py-6">불러오는 중...</div>}

              {!loading && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-neutral-500">기간</span>
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
                    <div className="sticky top-0 bg-neutral-800 text-white text-xs font-bold px-3 py-2 flex items-center justify-between">
                      <span>💵 받을 금액 (수동입력)</span>
                      <button
                        className="bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 text-xs"
                        onClick={() => setAddingCharge(true)}
                      >
                        + 행추가
                      </button>
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-neutral-100">
                        <tr>
                          <SortableTh label="등록일" sortKey="reqDate" active={sortKey} dir={sortDir} onSort={toggleSort} />
                          <SortableTh label="업체" sortKey="company" active={sortKey} dir={sortDir} onSort={toggleSort} />
                          <SortableTh label="제품명" sortKey="keyword" active={sortKey} dir={sortDir} onSort={toggleSort} />
                          <SortableTh label="금액" sortKey="deposit" active={sortKey} dir={sortDir} onSort={toggleSort} />
                          <th className="px-2 py-1.5 text-center">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCharges.map((c) => {
                          const isEditing = editingChargeId === c.id;
                          return (
                            <tr key={c.id} className="border-b border-neutral-100">
                              <td className="px-1 py-1 text-center whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="date"
                                    className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                                    value={editChargeDate}
                                    onChange={(e) => setEditChargeDate(e.target.value)}
                                  />
                                ) : (
                                  shortDate(c.charge_date)
                                )}
                              </td>
                              <td className="px-1 py-1 text-center whitespace-nowrap">
                                {isEditing ? (
                                  <CompanySelect
                                    companies={selected?.companies || []}
                                    value={editChargeCompanyKey}
                                    onChange={setEditChargeCompanyKey}
                                  />
                                ) : (
                                  `${c.company_code || ""} ${c.company_name}`
                                )}
                              </td>
                              <td className="px-1 py-1 text-center">
                                {isEditing ? (
                                  <input
                                    className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                                    placeholder="제품명"
                                    value={editChargeProductName}
                                    onChange={(e) => setEditChargeProductName(e.target.value)}
                                  />
                                ) : (
                                  c.product_name || <span className="text-neutral-400">-</span>
                                )}
                              </td>
                              <td className="px-1 py-1 text-center">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    className="border border-neutral-300 rounded px-1 py-1 text-xs w-24 text-right"
                                    value={editChargeAmount}
                                    onChange={(e) => setEditChargeAmount(e.target.value)}
                                  />
                                ) : (
                                  `₩${c.amount.toLocaleString("ko-KR")}`
                                )}
                              </td>
                              <td className="px-1 py-1 text-center whitespace-nowrap">
                                {isEditing ? (
                                  <span className="whitespace-nowrap">
                                    <button
                                      className="text-emerald-600 font-bold disabled:opacity-50"
                                      onClick={saveEditCharge}
                                      disabled={chargeBusy}
                                    >
                                      저장
                                    </button>
                                    <button className="text-neutral-400 font-bold ml-1" onClick={() => setEditingChargeId(null)}>
                                      취소
                                    </button>
                                  </span>
                                ) : (
                                  <span className="whitespace-nowrap">
                                    <button
                                      className="text-blue-500 hover:text-blue-700 font-bold"
                                      onClick={() => startEditCharge(c)}
                                    >
                                      수정
                                    </button>
                                    <button
                                      className="text-neutral-400 hover:text-rose-600 font-bold ml-1"
                                      onClick={() => deleteCharge(c.id)}
                                    >
                                      ✕
                                    </button>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {addingCharge && (
                          <tr className="border-b border-neutral-100 bg-sky-50/60">
                            <td className="px-1 py-1 text-center">
                              <input
                                type="date"
                                className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                                value={chargeDate}
                                onChange={(e) => setChargeDate(e.target.value)}
                              />
                            </td>
                            <td className="px-1 py-1 text-center">
                              <CompanySelect companies={selected.companies} value={chargeCompanyKey} onChange={setChargeCompanyKey} />
                            </td>
                            <td className="px-1 py-1 text-center">
                              <input
                                className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                                placeholder="제품명"
                                value={chargeProductName}
                                onChange={(e) => setChargeProductName(e.target.value)}
                              />
                            </td>
                            <td className="px-1 py-1 text-center">
                              <input
                                type="number"
                                className="border border-neutral-300 rounded px-1 py-1 text-xs w-24 text-right"
                                placeholder="금액"
                                value={chargeAmount}
                                onChange={(e) => setChargeAmount(e.target.value)}
                              />
                            </td>
                            <td className="px-1 py-1 text-center whitespace-nowrap">
                              <button className="text-emerald-600 font-bold disabled:opacity-50" onClick={addCharge} disabled={chargeBusy}>
                                저장
                              </button>
                              <button
                                className="text-neutral-400 font-bold ml-1"
                                onClick={() => {
                                  setAddingCharge(false);
                                  setChargeAmount("");
                                  setChargeCompanyKey("");
                                  setChargeProductName("");
                                  setChargeMsg("");
                                }}
                              >
                                취소
                              </button>
                            </td>
                          </tr>
                        )}
                        {addingCharge && chargeMsg && (
                          <tr>
                            <td colSpan={5} className="text-center text-rose-500 text-[11px] py-1">
                              {chargeMsg}
                            </td>
                          </tr>
                        )}
                        {!sortedCharges.length && !addingCharge && (
                          <tr>
                            <td colSpan={5} className="text-center text-neutral-400 py-4">
                              등록된 내역이 없습니다
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="border border-neutral-300 rounded-xl overflow-auto">
                    <div className="sticky top-0 bg-neutral-800 text-white text-xs font-bold px-3 py-2 flex items-center justify-between">
                      <span>💳 실제 입금 이력</span>
                      <button
                        className="bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 text-xs"
                        onClick={() => setAddingPayment(true)}
                      >
                        + 행추가
                      </button>
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-neutral-100">
                        <tr>
                          <th className="px-2 py-1.5 text-center">입금일</th>
                          <th className="px-2 py-1.5 text-center">업체</th>
                          <th className="px-2 py-1.5 text-center">금액</th>
                          <th className="px-2 py-1.5 text-center">메모</th>
                          <th className="px-2 py-1.5 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((p) =>
                          editingPaymentId === p.id ? (
                            <tr key={p.id} className="border-b border-neutral-100 bg-emerald-50/50">
                              <td className="px-1 py-1 text-center">
                                <input
                                  type="date"
                                  className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                                  value={editPaidDate}
                                  onChange={(e) => setEditPaidDate(e.target.value)}
                                />
                              </td>
                              <td className="px-1 py-1 text-center">
                                <CompanySelect
                                  companies={selected.companies}
                                  value={editPaymentCompanyKey}
                                  onChange={setEditPaymentCompanyKey}
                                />
                              </td>
                              <td className="px-1 py-1 text-center">
                                <input
                                  type="number"
                                  className="border border-neutral-300 rounded px-1 py-1 text-xs w-20 text-right"
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                />
                              </td>
                              <td className="px-1 py-1 text-center">
                                <input
                                  className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                                  value={editMemo}
                                  onChange={(e) => setEditMemo(e.target.value)}
                                />
                              </td>
                              <td className="px-1 py-1 text-center whitespace-nowrap">
                                <button
                                  className="text-emerald-600 font-bold disabled:opacity-50"
                                  onClick={saveEditPayment}
                                  disabled={paymentBusy}
                                >
                                  저장
                                </button>
                                <button
                                  className="text-neutral-400 font-bold ml-1"
                                  onClick={() => setEditingPaymentId(null)}
                                >
                                  취소
                                </button>
                              </td>
                            </tr>
                          ) : (
                            <tr key={p.id} className="border-b border-neutral-100">
                              <td className="px-2 py-1.5 text-center">{p.paid_date}</td>
                              <td className="px-2 py-1.5 text-center whitespace-nowrap">
                                {p.company_code || p.company_name ? `${p.company_code || ""} ${p.company_name || ""}` : "-"}
                              </td>
                              <td className="px-2 py-1.5 text-center">₩{p.amount.toLocaleString("ko-KR")}</td>
                              <td className="px-2 py-1.5 text-center">{p.memo}</td>
                              <td className="px-2 py-1.5 text-center whitespace-nowrap">
                                <button
                                  className="text-blue-500 hover:text-blue-700 font-bold"
                                  onClick={() => startEditPayment(p)}
                                >
                                  수정
                                </button>
                                <button
                                  className="text-neutral-400 hover:text-rose-600 font-bold ml-1"
                                  onClick={() => deletePayment(p.id)}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          )
                        )}
                        {addingPayment && (
                          <tr className="border-b border-neutral-100 bg-sky-50/60">
                            <td className="px-1 py-1 text-center">
                              <input
                                type="date"
                                className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                                value={paidDate}
                                onChange={(e) => setPaidDate(e.target.value)}
                              />
                            </td>
                            <td className="px-1 py-1 text-center">
                              <CompanySelect companies={selected.companies} value={paymentCompanyKey} onChange={setPaymentCompanyKey} />
                            </td>
                            <td className="px-1 py-1 text-center">
                              <input
                                type="number"
                                className="border border-neutral-300 rounded px-1 py-1 text-xs w-20 text-right"
                                placeholder="금액"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                              />
                            </td>
                            <td className="px-1 py-1 text-center">
                              <input
                                className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                                placeholder="메모 (선택)"
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                              />
                            </td>
                            <td className="px-1 py-1 text-center whitespace-nowrap">
                              <button className="text-emerald-600 font-bold disabled:opacity-50" onClick={addPayment} disabled={busy}>
                                저장
                              </button>
                              <button
                                className="text-neutral-400 font-bold ml-1"
                                onClick={() => {
                                  setAddingPayment(false);
                                  setAmount("");
                                  setMemo("");
                                  setPaymentCompanyKey("");
                                  setMsg("");
                                }}
                              >
                                취소
                              </button>
                            </td>
                          </tr>
                        )}
                        {addingPayment && msg && (
                          <tr>
                            <td colSpan={5} className="text-center text-rose-500 text-[11px] py-1">
                              {msg}
                            </td>
                          </tr>
                        )}
                        {!filteredPayments.length && !addingPayment && (
                          <tr>
                            <td colSpan={5} className="text-center text-neutral-400 py-4">
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

function SortableTh({
  label,
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      className="px-2 py-1.5 text-center cursor-pointer select-none hover:bg-neutral-200"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active === sortKey && <span className="ml-0.5">{dir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );
}

function CompanySelect({
  companies,
  value,
  onChange,
}: {
  companies: { code: string | null; name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="border border-neutral-300 rounded-lg px-2 py-1.5 text-xs bg-white max-w-[140px]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">업체 선택</option>
      {companies.map((c, i) => (
        <option key={i} value={JSON.stringify({ code: c.code, name: c.name })}>
          {c.code ? `${c.code} ${c.name}` : c.name}
        </option>
      ))}
    </select>
  );
}
