"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type StaffRow = {
  id: string;
  name: string;
  login_id: string;
  active: boolean;
  hourly_wage: number;
  account_text: string | null;
  withhold_tax: boolean;
  is_fixed_salary: boolean;
};
type AttendanceRow = {
  id: number;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  hours: number | null;
  daily_pay: number | null;
  net_pay: number | null;
  paid_at: string | null;
};

function won(n: number | null) {
  return `${Number(n || 0).toLocaleString("ko-KR")}원`;
}
function mmdd(dateStr: string | null) {
  if (!dateStr) return "-";
  return `✅ ${dateStr.slice(5).replace("-", "/")}`;
}

// 급여일: 매월 15일 · 전월 근무분을 지급 (예: 6월 근무분 → 7월 15일 지급)
function suggestedPayDate(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-15`;
}

function recentMonths(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export default function AttendanceOverview() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payBusy, setPayBusy] = useState(false);

  const [wageInput, setWageInput] = useState("");
  const [wageSaving, setWageSaving] = useState(false);
  const [wageMsg, setWageMsg] = useState("");

  function loadStaffList() {
    fetch("/api/admin/staff")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setLoadError(data.message || "직원 목록을 불러오지 못했습니다");
          return;
        }
        setStaff(data.rows || []);
      })
      .catch(() => setLoadError("직원 목록을 불러오는 중 오류가 발생했습니다"));
  }

  useEffect(() => {
    loadStaffList();
  }, []);

  async function loadAttendance(staffId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("staff_attendance")
        .select("id, work_date, clock_in, clock_out, hours, daily_pay, net_pay, paid_at")
        .eq("staff_id", staffId)
        .order("work_date", { ascending: false });
      if (!error) setRows((data || []) as AttendanceRow[]);
    } finally {
      setLoading(false);
    }
  }

  async function selectStaff(s: StaffRow) {
    setSelected(s);
    setSelectedMonth("");
    setWageInput(String(s.hourly_wage || ""));
    setWageMsg("");
    await loadAttendance(s.id);
  }

  const groups = useMemo(() => {
    const map = new Map<string, AttendanceRow[]>();
    rows.forEach((r) => {
      const key = r.work_date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries());
  }, [rows]);

  // 고정월급제는 출퇴근 기록이 없을 수 있으니 최근 12개월을 항상 선택지로 제공한다
  const monthOptions = useMemo(() => {
    if (!selected?.is_fixed_salary) return groups.map(([m]) => m);
    const set = new Set<string>([...recentMonths(12), ...groups.map(([m]) => m)]);
    return Array.from(set).sort().reverse();
  }, [selected, groups]);

  const paidMonthSet = useMemo(() => {
    const set = new Set<string>();
    groups.forEach(([m, gRows]) => {
      if (gRows.length > 0 && gRows.every((r) => r.paid_at)) set.add(m);
    });
    return set;
  }, [groups]);

  function isMonthPaid(m: string) {
    return paidMonthSet.has(m);
  }

  function stepMonth(delta: number) {
    const idx = monthOptions.indexOf(selectedMonth);
    if (idx === -1) return;
    const next = monthOptions[idx + delta];
    if (next) setSelectedMonth(next);
  }

  useEffect(() => {
    if (!monthOptions.length) return;
    if (monthOptions.includes(selectedMonth)) return;
    // 미입금 중 가장 이른(과거) 달을 기본값으로, 전부 입금완료면 최신 달
    const unpaidAsc = monthOptions.filter((m) => !isMonthPaid(m)).sort();
    setSelectedMonth(unpaidAsc.length ? unpaidAsc[0] : monthOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOptions]);

  useEffect(() => {
    if (selectedMonth) setPayDate(suggestedPayDate(selectedMonth));
  }, [selectedMonth]);

  const current = groups.find(([m]) => m === selectedMonth);
  const monthRows = current?.[1] || [];
  const totalHours = monthRows.reduce((s, r) => s + (r.hours || 0), 0);
  const totalDaily = monthRows.reduce((s, r) => s + (r.daily_pay || 0), 0);
  const totalNet = monthRows.reduce((s, r) => s + (r.net_pay || 0), 0);
  const allPaid = monthRows.length > 0 && monthRows.every((r) => r.paid_at);
  const paidOnDate = monthRows.find((r) => r.paid_at)?.paid_at;

  async function saveWage() {
    if (!selected) return;
    const amount = Number(wageInput);
    if (!amount || amount < 0) {
      setWageMsg("금액을 입력해주세요");
      return;
    }
    setWageSaving(true);
    setWageMsg("");
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          name: selected.name,
          loginId: selected.login_id,
          accountText: selected.account_text || "",
          hourlyWage: amount,
          withholdTax: selected.withhold_tax,
          active: selected.active,
          isFixedSalary: selected.is_fixed_salary,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setWageMsg(data.message || "저장 실패");
        return;
      }
      setWageMsg("✅ 저장되었습니다");
      setSelected({ ...selected, hourly_wage: amount });
      loadStaffList();
    } finally {
      setWageSaving(false);
    }
  }

  async function syncExpense(paid: boolean, amount: number, date: string) {
    if (!selected) return;
    const sourceRef = `staff:${selected.id}:${selectedMonth}`;
    await supabase.from("expenses").delete().eq("source_ref", sourceRef);
    if (paid) {
      await supabase.from("expenses").insert({
        category: "인건비",
        person_name: selected.name,
        amount,
        expense_date: date,
        memo: `${selectedMonth.replace("-", "년 ")}월 급여`,
        source: "payroll",
        source_ref: sourceRef,
      });
    }
  }

  async function markPaid() {
    if (!selected) return;
    if (!payDate) {
      alert("입금일을 선택해주세요");
      return;
    }
    setPayBusy(true);
    try {
      if (selected.is_fixed_salary) {
        const amount = selected.hourly_wage;
        if (!confirm(`${selectedMonth.replace("-", "년 ")}월 고정월급 ${won(amount)}을 ${payDate}에 입금 처리할까요?`)) return;
        if (monthRows.length) {
          const { error } = await supabase
            .from("staff_attendance")
            .update({ paid_at: payDate, net_pay: amount, daily_pay: amount })
            .in(
              "id",
              monthRows.map((r) => r.id)
            );
          if (error) {
            alert(error.message);
            return;
          }
        } else {
          const { error } = await supabase.from("staff_attendance").insert({
            staff_id: selected.id,
            work_date: `${selectedMonth}-01`,
            daily_pay: amount,
            net_pay: amount,
            paid_at: payDate,
          });
          if (error) {
            alert(error.message);
            return;
          }
        }
        await syncExpense(true, amount, payDate);
      } else {
        if (!monthRows.length) return;
        if (!confirm(`${selectedMonth.replace("-", "년 ")}월 급여 ${won(totalNet)}을 ${payDate}에 입금 처리할까요?`)) return;
        const { error } = await supabase
          .from("staff_attendance")
          .update({ paid_at: payDate })
          .in(
            "id",
            monthRows.map((r) => r.id)
          );
        if (error) {
          alert(error.message);
          return;
        }
        await syncExpense(true, totalNet, payDate);
      }
      await loadAttendance(selected.id);
    } finally {
      setPayBusy(false);
    }
  }

  async function cancelPaid() {
    if (!selected || !monthRows.length) return;
    if (!confirm(`${selectedMonth.replace("-", "년 ")}월 입금 처리를 취소할까요?`)) return;
    setPayBusy(true);
    try {
      const ids = monthRows.map((r) => r.id);
      const { error } = await supabase.from("staff_attendance").update({ paid_at: null }).in("id", ids);
      if (error) {
        alert(error.message);
        return;
      }
      await syncExpense(false, 0, "");
      await loadAttendance(selected.id);
    } finally {
      setPayBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">⏰ 관리자조회</div>
      </div>
      <div className="text-xs text-neutral-400">
        직원이 직접 출퇴근을 기록하는 페이지는 왼쪽 사이드바의 &quot;직원사이트&quot;에서 링크를 확인할 수 있어요(/staff/login).
        여기서는 전체 직원의 출퇴근 현황과 일급 계산 결과를 조회하고, 월별 급여를 입금 처리합니다.
      </div>

      {loadError && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">{loadError}</div>
      )}

      <div className="flex gap-3 flex-1 min-h-0">
        <div className="w-60 shrink-0 border border-neutral-300 rounded-xl flex flex-col overflow-hidden">
          <div className="bg-neutral-100 text-xs font-bold text-neutral-500 px-3 py-2">직원 목록</div>
          <div className="overflow-y-auto flex-1">
            {staff.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStaff(s)}
                className={`w-full text-left px-3 py-2 text-xs border-b border-neutral-100 hover:bg-neutral-50 ${
                  selected?.id === s.id ? "bg-emerald-50" : ""
                }`}
              >
                <div className="font-bold">
                  {s.name} {!s.active && <span className="text-neutral-400">(퇴사)</span>}
                  {s.is_fixed_salary && <span className="text-[10px] text-neutral-400 ml-1">고정월급</span>}
                </div>
                <div className="text-neutral-400">{s.login_id}</div>
              </button>
            ))}
            {!staff.length && <div className="text-center text-xs text-neutral-400 py-6">등록된 직원이 없습니다</div>}
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-auto">
          {!selected && <div className="text-center text-sm text-neutral-400 py-10">왼쪽에서 직원을 선택해주세요</div>}
          {selected && loading && <div className="text-center text-sm text-neutral-400 py-10">불러오는 중...</div>}

          {selected && !loading && selected.is_fixed_salary && (
            <div className="flex flex-col gap-3 max-w-lg">
              <div className="border border-neutral-300 rounded-xl p-3 bg-white">
                <div className="text-xs font-bold text-neutral-500 mb-2">💰 고정 월급 (수정 가능)</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm flex-1"
                    value={wageInput}
                    onChange={(e) => setWageInput(e.target.value)}
                  />
                  <span className="text-xs text-neutral-500">원/월</span>
                  <button
                    className="bg-neutral-800 text-white text-xs font-bold rounded-lg px-3 py-1.5 disabled:opacity-60"
                    onClick={saveWage}
                    disabled={wageSaving}
                  >
                    {wageSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
                {wageMsg && <div className="text-xs text-neutral-500 mt-1.5">{wageMsg}</div>}
              </div>

              <div className="border border-neutral-300 rounded-xl p-3 bg-white">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <button
                    className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm text-neutral-500 disabled:opacity-30"
                    onClick={() => stepMonth(1)}
                    disabled={monthOptions.indexOf(selectedMonth) >= monthOptions.length - 1}
                    title="이전 달"
                  >
                    ◀
                  </button>
                  <select
                    className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm font-bold bg-white"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>
                        {m.replace("-", "년 ")}월{isMonthPaid(m) ? " ✅" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm text-neutral-500 disabled:opacity-30"
                    onClick={() => stepMonth(-1)}
                    disabled={monthOptions.indexOf(selectedMonth) <= 0}
                    title="다음 달"
                  >
                    ▶
                  </button>
                  {allPaid ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                      ✅ 입금완료 ({paidOnDate})
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-3 py-1">
                      미입금
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                  {allPaid ? (
                    <button
                      className="text-xs font-bold text-neutral-500 border border-neutral-300 rounded-lg px-3 py-1.5 disabled:opacity-60"
                      onClick={cancelPaid}
                      disabled={payBusy}
                    >
                      {payBusy ? "처리 중..." : "입금취소"}
                    </button>
                  ) : (
                    <button
                      className="text-xs font-bold text-white bg-emerald-600 rounded-lg px-3 py-1.5 disabled:opacity-60"
                      onClick={markPaid}
                      disabled={payBusy}
                    >
                      {payBusy ? "처리 중..." : "입금처리"}
                    </button>
                  )}
                  <span className="text-sm font-bold text-neutral-700 ml-auto">{won(selected.hourly_wage)}</span>
                </div>
              </div>
            </div>
          )}

          {selected && !loading && !selected.is_fixed_salary && groups.length === 0 && (
            <div className="text-center text-sm text-neutral-400 py-10">출퇴근 기록이 없습니다</div>
          )}
          {selected && !loading && !selected.is_fixed_salary && groups.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm text-neutral-500 disabled:opacity-30"
                  onClick={() => stepMonth(1)}
                  disabled={monthOptions.indexOf(selectedMonth) >= monthOptions.length - 1}
                  title="이전 달"
                >
                  ◀
                </button>
                <select
                  className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm font-bold bg-white"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {m.replace("-", "년 ")}월{isMonthPaid(m) ? " ✅" : ""}
                    </option>
                  ))}
                </select>
                <button
                  className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm text-neutral-500 disabled:opacity-30"
                  onClick={() => stepMonth(-1)}
                  disabled={monthOptions.indexOf(selectedMonth) <= 0}
                  title="다음 달"
                >
                  ▶
                </button>
                {allPaid ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                    ✅ 입금완료 ({paidOnDate})
                  </span>
                ) : (
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-3 py-1">
                    미입금
                  </span>
                )}
                <div className="flex-1" />
                <input
                  type="date"
                  className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
                {allPaid ? (
                  <button
                    className="text-xs font-bold text-neutral-500 border border-neutral-300 rounded-lg px-3 py-1.5 disabled:opacity-60"
                    onClick={cancelPaid}
                    disabled={payBusy}
                  >
                    {payBusy ? "처리 중..." : "입금취소"}
                  </button>
                ) : (
                  <button
                    className="text-xs font-bold text-white bg-emerald-600 rounded-lg px-3 py-1.5 disabled:opacity-60"
                    onClick={markPaid}
                    disabled={payBusy}
                  >
                    {payBusy ? "처리 중..." : "입금처리"}
                  </button>
                )}
              </div>

              <div className="border border-neutral-300 rounded-xl overflow-auto">
                <div className="bg-neutral-800 text-white text-sm font-bold px-3 py-2">{selectedMonth.replace("-", "년 ")}월</div>
                <table className="w-full text-xs border-collapse min-w-[650px]">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th className="px-2 py-1.5 text-left">일자</th>
                      <th className="px-2 py-1.5 text-center">출근</th>
                      <th className="px-2 py-1.5 text-center">퇴근</th>
                      <th className="px-2 py-1.5 text-center">근무시간</th>
                      <th className="px-2 py-1.5 text-right">일급</th>
                      <th className="px-2 py-1.5 text-right">실수령액</th>
                      <th className="px-2 py-1.5 text-center">입금</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthRows.map((r) => (
                      <tr key={r.id} className="border-t border-neutral-100">
                        <td className="px-2 py-1.5">{r.work_date}</td>
                        <td className="px-2 py-1.5 text-center">{r.clock_in || "-"}</td>
                        <td className="px-2 py-1.5 text-center">{r.clock_out || "-"}</td>
                        <td className="px-2 py-1.5 text-center">{r.hours ?? "-"}</td>
                        <td className="px-2 py-1.5 text-right">{r.daily_pay != null ? won(r.daily_pay) : "-"}</td>
                        <td className="px-2 py-1.5 text-right font-bold">{r.net_pay != null ? won(r.net_pay) : "-"}</td>
                        <td className="px-2 py-1.5 text-center">{mmdd(r.paid_at)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-bold">
                      <td className="px-2 py-1.5" colSpan={3}>
                        합계
                      </td>
                      <td className="px-2 py-1.5 text-center">{Math.round(totalHours * 100) / 100}</td>
                      <td className="px-2 py-1.5 text-right">{won(totalDaily)}</td>
                      <td className="px-2 py-1.5 text-right">{won(totalNet)}</td>
                      <td className="px-2 py-1.5 text-center"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
