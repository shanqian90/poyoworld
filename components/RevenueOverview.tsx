"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Expense = {
  id: number;
  category: string;
  person_name: string | null;
  amount: number;
  expense_date: string;
  memo: string | null;
  source: string | null;
};

type MonthStat = {
  month: number;
  totalCount: number;
  emptyBoxCount: number;
  realShipRevenue: number;
  emptyBoxRevenue: number;
  deliveryRevenue: number;
  reviewCost: number;
  manualCost: number;
  profit: number;
};
type CompanyProfit = { key: string; name: string; code: string | null; revenue: number; cost: number; profit: number };
type ExpenseItem = { month: number; name: string; qty: number; unitPrice: number; total: number };
type Tab = "월별매출" | "지출상세" | "TOP업체";

const emptyForm = { category: "인건비", personName: "", amount: "", expenseDate: "", memo: "" };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function won(n: number) {
  return `₩${Number(n || 0).toLocaleString("ko-KR")}`;
}
function emptyMonths(): MonthStat[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    totalCount: 0,
    emptyBoxCount: 0,
    realShipRevenue: 0,
    emptyBoxRevenue: 0,
    deliveryRevenue: 0,
    reviewCost: 0,
    manualCost: 0,
    profit: 0,
  }));
}

export default function RevenueOverview() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, expenseDate: todayISO() });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });

  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [yearLoading, setYearLoading] = useState(true);
  const [yearError, setYearError] = useState("");
  const [months, setMonths] = useState<MonthStat[]>(emptyMonths());
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [topCompanies, setTopCompanies] = useState<CompanyProfit[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("월별매출");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    loadYearly(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function loadYears() {
    const { data, error } = await supabase.from("work_requests").select("start_date");
    if (error || !data) return;
    const years = new Set<number>();
    data.forEach((r) => {
      if (r.start_date) years.add(new Date(r.start_date).getFullYear());
    });
    years.add(new Date().getFullYear());
    const list = Array.from(years).sort((a, b) => b - a);
    setAvailableYears(list);
  }

  async function loadYearly(y: number) {
    setYearLoading(true);
    setYearError("");
    try {
      const start = `${y}-01-01`;
      const end = `${y + 1}-01-01`;
      const [requestsRes, expensesRes] = await Promise.all([
        supabase
          .from("work_requests")
          .select("company_code, company_name, start_date, unit_price, total_count, real_shipping, delivery_agency")
          .gte("start_date", start)
          .lt("start_date", end),
        supabase
          .from("expenses")
          .select("category, amount, expense_date")
          .gte("expense_date", start)
          .lt("expense_date", end),
      ]);
      if (requestsRes.error) {
        setYearError(requestsRes.error.message);
        return;
      }
      if (expensesRes.error) {
        setYearError(expensesRes.error.message);
        return;
      }

      const monthStats = emptyMonths();
      const byCompany = new Map<string, CompanyProfit>();

      (requestsRes.data || []).forEach((r) => {
        const totalCount = Number(r.total_count) || 0;
        const unitPrice = Number(r.unit_price) || 0;
        const revenue = unitPrice * totalCount;
        const deliveryBonus = r.delivery_agency ? 200 * totalCount : 0;
        const reviewCost = r.real_shipping ? 0 : 1000 * totalCount;
        const idx = new Date(r.start_date).getMonth();

        monthStats[idx].totalCount += totalCount;
        if (r.real_shipping) {
          monthStats[idx].realShipRevenue += revenue;
        } else {
          monthStats[idx].emptyBoxRevenue += revenue;
          monthStats[idx].emptyBoxCount += totalCount;
        }
        monthStats[idx].deliveryRevenue += deliveryBonus;
        monthStats[idx].reviewCost += reviewCost;

        const key = r.company_code || r.company_name || "미상";
        const name = r.company_name || r.company_code || "미상";
        const entry = byCompany.get(key) || { key, name, code: r.company_code || null, revenue: 0, cost: 0, profit: 0 };
        entry.revenue += revenue + deliveryBonus;
        entry.cost += reviewCost;
        byCompany.set(key, entry);
      });

      const manualByMonthCategory = new Map<string, { qty: number; total: number }>();
      (expensesRes.data || []).forEach((e) => {
        const idx = new Date(e.expense_date).getMonth();
        const amt = Number(e.amount) || 0;
        monthStats[idx].manualCost += amt;
        const key = `${idx}||${e.category || "기타"}`;
        const entry = manualByMonthCategory.get(key) || { qty: 0, total: 0 };
        entry.qty += 1;
        entry.total += amt;
        manualByMonthCategory.set(key, entry);
      });

      monthStats.forEach((m) => {
        m.profit = m.realShipRevenue + m.emptyBoxRevenue + m.deliveryRevenue - m.reviewCost;
      });

      const items: ExpenseItem[] = [];
      monthStats.forEach((m) => {
        if (m.emptyBoxCount > 0) {
          items.push({ month: m.month, name: "빈박스 리뷰비", qty: m.emptyBoxCount, unitPrice: 1000, total: m.reviewCost });
        }
      });
      manualByMonthCategory.forEach((v, key) => {
        const [idxStr, category] = key.split("||");
        items.push({
          month: Number(idxStr) + 1,
          name: category,
          qty: v.qty,
          unitPrice: Math.round(v.total / v.qty),
          total: v.total,
        });
      });
      items.sort((a, b) => a.month - b.month);

      const top = Array.from(byCompany.values())
        .map((c) => ({ ...c, profit: c.revenue - c.cost }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10);

      setMonths(monthStats);
      setExpenseItems(items);
      setTopCompanies(top);
    } finally {
      setYearLoading(false);
    }
  }

  const yearTotals = useMemo(
    () =>
      months.reduce(
        (acc, m) => ({
          totalCount: acc.totalCount + m.totalCount,
          realShipRevenue: acc.realShipRevenue + m.realShipRevenue,
          emptyBoxRevenue: acc.emptyBoxRevenue + m.emptyBoxRevenue,
          deliveryRevenue: acc.deliveryRevenue + m.deliveryRevenue,
          reviewCost: acc.reviewCost + m.reviewCost,
          manualCost: acc.manualCost + m.manualCost,
          profit: acc.profit + m.profit,
        }),
        { totalCount: 0, realShipRevenue: 0, emptyBoxRevenue: 0, deliveryRevenue: 0, reviewCost: 0, manualCost: 0, profit: 0 }
      ),
    [months]
  );

  const expenseTotalCost = yearTotals.reviewCost + yearTotals.manualCost;

  const visibleMonths = useMemo(
    () =>
      months.filter(
        (m) => m.totalCount > 0 || m.realShipRevenue > 0 || m.emptyBoxRevenue > 0 || m.deliveryRevenue > 0 || m.manualCost > 0
      ),
    [months]
  );

  const chartPoints = useMemo(() => {
    const w = 600;
    const h = 160;
    const pad = 24;
    const values = visibleMonths.map((m) => m.realShipRevenue + m.emptyBoxRevenue + m.deliveryRevenue);
    const max = Math.max(1, ...values);
    const n = visibleMonths.length;
    return visibleMonths.map((m, i) => {
      const x = n <= 1 ? w / 2 : pad + (i / (n - 1)) * (w - pad * 2);
      const y = h - pad - (values[i] / max) * (h - pad * 2);
      return { x, y, value: values[i], month: m.month };
    });
  }, [visibleMonths]);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, category, person_name, amount, expense_date, memo, source")
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("expense_date", { ascending: false });
      if (error) {
        setLoadError(error.message);
        return;
      }
      setRows((data || []) as Expense[]);
    } finally {
      setLoading(false);
    }
  }

  async function addExpense() {
    if (!form.amount || Number(form.amount) <= 0) {
      setMsg("금액을 입력해주세요");
      return;
    }
    if (!form.expenseDate) {
      setMsg("날짜를 입력해주세요");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const { error } = await supabase.from("expenses").insert({
        category: form.category.trim() || "기타",
        person_name: form.personName.trim() || null,
        amount: Number(form.amount),
        expense_date: form.expenseDate,
        memo: form.memo.trim() || null,
        source: "manual",
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      setForm({ ...emptyForm, expenseDate: todayISO() });
      setShowForm(false);
      load();
      loadYearly(year);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r: Expense) {
    setEditingId(r.id);
    setEditForm({
      category: r.category,
      personName: r.person_name || "",
      amount: String(r.amount),
      expenseDate: r.expense_date,
      memo: r.memo || "",
    });
  }

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          category: editForm.category.trim() || "기타",
          person_name: editForm.personName.trim() || null,
          amount: Number(editForm.amount) || 0,
          expense_date: editForm.expenseDate,
          memo: editForm.memo.trim() || null,
        })
        .eq("id", id);
      if (error) {
        alert(error.message);
        return;
      }
      setEditingId(null);
      load();
      loadYearly(year);
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(id: number) {
    if (!confirm("이 지출 내역을 삭제할까요?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
    loadYearly(year);
  }

  const total = rows.reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <div className="flex-1 flex flex-col p-3 gap-3">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">📈 현황관리</div>
      </div>
      <div className="border border-neutral-300 rounded-xl p-4 bg-white">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="flex bg-neutral-100 rounded-lg p-0.5">
            {(["월별매출", "지출상세", "TOP업체"] as Tab[]).map((t) => (
              <button
                key={t}
                className={`text-xs font-bold rounded-md px-3 py-1.5 ${
                  activeTab === t ? "bg-white text-neutral-800 shadow" : "text-neutral-500"
                }`}
                onClick={() => setActiveTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <select
            className="border border-neutral-300 rounded-lg px-2 py-1 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>

        {yearError && (
          <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2 mb-2">{yearError}</div>
        )}

        {yearLoading ? (
          <div className="text-center text-sm text-neutral-400 py-10">불러오는 중...</div>
        ) : activeTab === "월별매출" ? (
          <>
            {!visibleMonths.length ? (
              <div className="text-center text-sm text-neutral-400 py-10">{year}년 데이터가 없습니다</div>
            ) : (
              <>
                <div className="mb-2">
                  <svg viewBox="0 0 600 160" className="w-full" style={{ height: 160 }}>
                    {chartPoints.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#60a5fa"
                        strokeWidth={2.5}
                        points={chartPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                      />
                    )}
                    {chartPoints.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#3b82f6">
                        <title>{`${p.month}월 매출 ${won(p.value)}`}</title>
                      </circle>
                    ))}
                  </svg>
                  <div className="flex mt-1">
                    {visibleMonths.map((m, i) => (
                      <div
                        key={m.month}
                        className="text-center text-[10px] text-neutral-400"
                        style={{ flex: i === 0 || i === visibleMonths.length - 1 ? "0 0 auto" : 1 }}
                      >
                        {year}-{String(m.month).padStart(2, "0")}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-neutral-200 rounded-xl overflow-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-neutral-100">
                      <tr>
                        <th className="px-2 py-1.5 text-center">월</th>
                        <th className="px-2 py-1.5 text-center">총진행</th>
                        <th className="px-2 py-1.5 text-center">실배송</th>
                        <th className="px-2 py-1.5 text-center">빈박스</th>
                        <th className="px-2 py-1.5 text-center">택배대행</th>
                        <th className="px-2 py-1.5 text-center">지출</th>
                        <th className="px-2 py-1.5 text-center">순이익</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMonths.map((m) => (
                        <tr key={m.month} className="border-b border-neutral-100">
                          <td className="px-2 py-1.5 text-center">{year}-{String(m.month).padStart(2, "0")}</td>
                          <td className="px-2 py-1.5 text-center">{m.totalCount.toLocaleString("ko-KR")}건</td>
                          <td className="px-2 py-1.5 text-center">{won(m.realShipRevenue)}</td>
                          <td className="px-2 py-1.5 text-center">{won(m.emptyBoxRevenue)}</td>
                          <td className="px-2 py-1.5 text-center">{won(m.deliveryRevenue)}</td>
                          <td className="px-2 py-1.5 text-center text-rose-600">-{won(m.reviewCost)}</td>
                          <td className="px-2 py-1.5 text-center font-bold text-emerald-600">{won(m.profit)}</td>
                        </tr>
                      ))}
                      <tr className="bg-neutral-50 font-bold">
                        <td className="px-2 py-1.5 text-center">합계</td>
                        <td className="px-2 py-1.5 text-center">{yearTotals.totalCount.toLocaleString("ko-KR")}건</td>
                        <td className="px-2 py-1.5 text-center">{won(yearTotals.realShipRevenue)}</td>
                        <td className="px-2 py-1.5 text-center">{won(yearTotals.emptyBoxRevenue)}</td>
                        <td className="px-2 py-1.5 text-center">{won(yearTotals.deliveryRevenue)}</td>
                        <td className="px-2 py-1.5 text-center text-rose-600">-{won(yearTotals.reviewCost)}</td>
                        <td className="px-2 py-1.5 text-center text-emerald-600">{won(yearTotals.profit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        ) : activeTab === "지출상세" ? (
          <>
            <div className="text-sm mb-2">
              <span className="text-neutral-500">{year}년 지출 합계 </span>
              <span className="font-extrabold text-rose-700">-{won(expenseTotalCost)}</span>
              <span className="text-neutral-400"> (리뷰비 {won(yearTotals.reviewCost)} + 인건비/기타 {won(yearTotals.manualCost)})</span>
            </div>
            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-neutral-100">
                  <tr>
                    <th className="px-2 py-1.5 text-center">월</th>
                    <th className="px-2 py-1.5 text-center">지출내역</th>
                    <th className="px-2 py-1.5 text-center">수량</th>
                    <th className="px-2 py-1.5 text-center">지출금액</th>
                    <th className="px-2 py-1.5 text-center">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseItems.map((it, i) => (
                    <tr key={i} className="border-b border-neutral-100">
                      <td className="px-2 py-1.5 text-center">{it.month}월</td>
                      <td className="px-2 py-1.5 text-center">{it.name}</td>
                      <td className="px-2 py-1.5 text-center">{it.qty.toLocaleString("ko-KR")}</td>
                      <td className="px-2 py-1.5 text-center">{won(it.unitPrice)}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-rose-600">-{won(it.total)}</td>
                    </tr>
                  ))}
                  {!expenseItems.length && (
                    <tr>
                      <td colSpan={5} className="text-center text-neutral-400 py-4">
                        {year}년 지출 내역이 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="border border-neutral-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="px-2 py-1.5 text-center">순위</th>
                  <th className="px-2 py-1.5 text-center">업체코드</th>
                  <th className="px-2 py-1.5 text-center">순수익</th>
                </tr>
              </thead>
              <tbody>
                {topCompanies.map((c, i) => (
                  <tr key={c.key} className="border-b border-neutral-100">
                    <td className="px-2 py-1.5 text-center font-bold">{i + 1}</td>
                    <td className="px-2 py-1.5 text-center">{c.code || c.name}</td>
                    <td className="px-2 py-1.5 text-center font-bold text-emerald-600">{won(c.profit)}</td>
                  </tr>
                ))}
                {!topCompanies.length && (
                  <tr>
                    <td colSpan={3} className="text-center text-neutral-400 py-4">
                      {year}년 데이터가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeTab === "지출상세" && (
      <div className="border border-neutral-300 rounded-xl p-4 bg-white">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <div className="font-extrabold text-neutral-700">💸 지출내역 (수동 등록/인건비)</div>
          <input
            type="date"
            className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-neutral-400 text-sm">~</span>
          <input
            type="date"
            className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <span className="text-sm font-bold text-neutral-700">{rows.length}건 · 합계 {won(total)}</span>
          <div className="flex-1" />
          <button
            className="text-sm bg-neutral-800 text-white font-bold rounded-lg px-4 py-2"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "닫기" : "+ 지출 추가"}
          </button>
        </div>

        {showForm && (
          <div className="border border-neutral-200 rounded-xl p-3 mb-3 bg-neutral-50 flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap">
              <input
                className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-28"
                placeholder="구분"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <input
                className="border border-neutral-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[100px]"
                placeholder="이름/대상"
                value={form.personName}
                onChange={(e) => setForm({ ...form, personName: e.target.value })}
              />
              <input
                type="number"
                className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-32"
                placeholder="금액"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
              <input
                type="date"
                className="border border-neutral-300 rounded-lg px-2 py-2 text-sm"
                value={form.expenseDate}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              />
              <input
                className="border border-neutral-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[120px]"
                placeholder="메모 (선택)"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                className="bg-emerald-600 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-60"
                onClick={addExpense}
                disabled={saving}
              >
                {saving ? "저장 중..." : "등록"}
              </button>
              {msg && <span className="text-xs text-rose-600">{msg}</span>}
            </div>
          </div>
        )}

        {loading && <div className="text-center text-sm text-neutral-400 py-10">불러오는 중...</div>}
        {loadError && (
          <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">{loadError}</div>
        )}

        {!loading && !loadError && (
          <div className="border border-neutral-200 rounded-xl overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-neutral-800 text-white sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-center">날짜</th>
                  <th className="px-2 py-2 text-center">구분</th>
                  <th className="px-2 py-2 text-center">이름/대상</th>
                  <th className="px-2 py-2 text-center">금액</th>
                  <th className="px-2 py-2 text-center">메모</th>
                  <th className="px-2 py-2 text-center">관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) =>
                  editingId === r.id ? (
                    <tr key={r.id} className="border-b border-neutral-200 bg-amber-50">
                      <td className="px-1 py-1">
                        <input
                          type="date"
                          className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                          value={editForm.expenseDate}
                          onChange={(e) => setEditForm({ ...editForm, expenseDate: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                          value={editForm.personName}
                          onChange={(e) => setEditForm({ ...editForm, personName: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                          value={editForm.amount}
                          onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          className="border border-neutral-300 rounded px-1 py-1 text-xs w-full"
                          value={editForm.memo}
                          onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center whitespace-nowrap">
                        <button
                          className="text-xs font-bold text-emerald-700 underline mr-2"
                          onClick={() => saveEdit(r.id)}
                          disabled={saving}
                        >
                          저장
                        </button>
                        <button className="text-xs font-bold text-neutral-500 underline" onClick={() => setEditingId(null)}>
                          취소
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="border-b border-neutral-200">
                      <td className="px-2 py-1.5 text-center">{r.expense_date}</td>
                      <td className="px-2 py-1.5 text-center">{r.category}</td>
                      <td className="px-2 py-1.5 text-center">{r.person_name || "-"}</td>
                      <td className="px-2 py-1.5 text-center font-bold">{won(r.amount)}</td>
                      <td className="px-2 py-1.5 text-center">{r.memo || "-"}</td>
                      <td className="px-2 py-1.5 text-center whitespace-nowrap">
                        <button className="text-xs font-bold text-neutral-500 underline mr-2" onClick={() => startEdit(r)}>
                          수정
                        </button>
                        <button className="text-xs font-bold text-rose-500 underline" onClick={() => deleteExpense(r.id)}>
                          삭제
                        </button>
                      </td>
                    </tr>
                  )
                )}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="text-center text-neutral-400 py-8">
                      해당 기간에 지출 내역이 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
