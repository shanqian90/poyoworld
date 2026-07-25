"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { sanitizePasswordInput } from "@/lib/password";

type AttendanceRow = {
  id: number;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  hours: number | null;
  hourly_wage: number | null;
  daily_pay: number | null;
  net_pay: number | null;
  lunch_minutes: number | null;
  paid_at: string | null;
};

type Profile = { id: string; name: string; loginId: string; accountText: string | null; hourlyWage: number; withholdTax: boolean };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function won(n: number | null) {
  return `${Number(n || 0).toLocaleString("ko-KR")}원`;
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  const weekday = "일월화수목금토"[new Date(iso).getDay()];
  return `${y}년 ${m}월 ${d}일 (${weekday})`;
}
function hm(t: string | null) {
  return t ? t.slice(0, 5) : "-";
}
function paidLabel(dateStr: string | null) {
  if (!dateStr) return "-";
  return `✅ ${dateStr.slice(5).replace("-", "/")}`;
}
function monthLabel(m: string) {
  return `${m.replace("-", "년 ")}월`;
}
function shiftMonth(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function StaffPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const [lunchInput, setLunchInput] = useState("0");
  const [lunchSaving, setLunchSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [meRes, attRes] = await Promise.all([fetch("/api/staff/me"), fetch("/api/staff/attendance")]);
      if (meRes.status === 401) {
        router.replace("/staff/login");
        return;
      }
      const meData = await meRes.json();
      const attData = await attRes.json();
      if (meData.ok) setProfile(meData.profile);
      if (attData.ok) setRows(attData.rows || []);
    } finally {
      setLoading(false);
    }
  }

  const today = todayISO();
  const todayRow = rows.find((r) => r.work_date === today);

  useEffect(() => {
    setLunchInput(String(todayRow?.lunch_minutes ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayRow?.id]);

  async function saveLunch() {
    setLunchSaving(true);
    try {
      const res = await fetch("/api/staff/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lunchMinutes: Number(lunchInput) || 0 }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "점심시간 저장 실패");
        return;
      }
      load();
    } finally {
      setLunchSaving(false);
    }
  }

  async function clockIn() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/staff/attendance", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "출근 처리 실패");
        return;
      }
      setMsg(`✅ 출근 처리되었습니다 (${data.clockIn})`);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/staff/attendance", { method: "PATCH" });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "퇴근 처리 실패");
        return;
      }
      setMsg(`✅ 퇴근 처리되었습니다 (${data.clockOut}, ${data.hours}시간 · ${won(data.netPay)})`);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    if (newPw.length < 4) {
      setPwMsg("새 비밀번호는 4자 이상 입력해주세요");
      return;
    }
    setPwBusy(true);
    setPwMsg("");
    try {
      const res = await fetch("/api/staff/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!data.ok) {
        setPwMsg(data.message || "변경 실패");
        return;
      }
      setPwMsg("✅ 비밀번호가 변경되었습니다");
      setOldPw("");
      setNewPw("");
    } finally {
      setPwBusy(false);
    }
  }

  async function doLogout() {
    await fetch("/api/staff/logout", { method: "POST" });
    router.replace("/staff/login");
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

  const thisMonthKey = today.slice(0, 7);
  const payDate = `${monthLabel(shiftMonth(thisMonthKey, 1))} 15일`;

  const thisMonthRows = groups.find(([m]) => m === thisMonthKey)?.[1] || [];
  const thisMonthTotals = {
    hours: thisMonthRows.reduce((s, r) => s + (r.hours || 0), 0),
    daily: thisMonthRows.reduce((s, r) => s + (r.daily_pay || 0), 0),
    net: thisMonthRows.reduce((s, r) => s + (r.net_pay || 0), 0),
  };

  const recentRows = [...rows]
    .filter((r) => r.clock_in)
    .sort((a, b) => (a.work_date < b.work_date ? 1 : -1))
    .slice(0, 10);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">불러오는 중...</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-100 px-3 py-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-3">
        <div className="bg-white border-2 border-neutral-800 rounded-3xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-extrabold text-neutral-800">👔 {profile?.name} 님</div>
            <button className="text-xs underline text-neutral-500" onClick={doLogout}>
              로그아웃
            </button>
          </div>

          <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 mb-3">
            <div className="text-sm font-bold text-neutral-700 mb-2">{fmtDate(today)}</div>
            <div className="flex gap-2">
              <button
                className="flex-1 bg-neutral-800 text-white font-extrabold rounded-xl py-3 disabled:opacity-40"
                onClick={clockIn}
                disabled={busy || !!todayRow?.clock_in}
              >
                {todayRow?.clock_in ? `출근 ${hm(todayRow.clock_in)}` : "출근하기"}
              </button>
              <button
                className="flex-1 bg-rose-600 text-white font-extrabold rounded-xl py-3 disabled:opacity-40"
                onClick={clockOut}
                disabled={busy || !todayRow?.clock_in || !!todayRow?.clock_out}
              >
                {todayRow?.clock_out ? `퇴근 ${hm(todayRow.clock_out)}` : "퇴근하기"}
              </button>
            </div>
            {msg && <div className="text-xs text-neutral-600 mt-2">{msg}</div>}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-200">
              <span className="text-xs font-bold text-neutral-500">점심시간 차감</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  className="w-20 border border-neutral-300 rounded-lg px-2 py-1 text-sm text-right"
                  value={lunchInput}
                  onChange={(e) => setLunchInput(e.target.value)}
                  onBlur={saveLunch}
                  disabled={lunchSaving || !todayRow?.clock_in}
                />
                <span className="text-xs text-neutral-500">분</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs font-bold text-neutral-500">근무시간</span>
              <span className="text-sm font-bold text-neutral-800">{todayRow?.hours != null ? `${todayRow.hours}시간` : "- -"}</span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs font-bold text-neutral-500">오늘 일급</span>
              <span className="text-sm font-bold text-neutral-800">{todayRow?.daily_pay != null ? won(todayRow.daily_pay) : "- -"}</span>
            </div>
          </div>

          <div className="rounded-xl px-3 py-3 mb-3 bg-neutral-800 text-white">
            <div className="text-xs font-bold text-neutral-300 mb-2">
              {monthLabel(thisMonthKey)} 누적 · {payDate} 입금예정
            </div>
            <div className="flex items-center justify-between text-sm py-0.5">
              <span className="text-neutral-300">총시간</span>
              <span className="font-bold">{Math.round(thisMonthTotals.hours * 100) / 100}시간</span>
            </div>
            <div className="flex items-center justify-between text-sm py-0.5">
              <span className="text-neutral-300">누적합계</span>
              <span className="font-bold">{won(thisMonthTotals.daily)}</span>
            </div>
            {profile?.withholdTax && (
              <div className="flex items-center justify-between text-sm py-0.5">
                <span className="text-neutral-300">세금공제 (3.3%)</span>
                <span className="font-bold text-rose-300">-{won(thisMonthTotals.daily - thisMonthTotals.net)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-base pt-1.5 mt-1 border-t border-neutral-600">
              <span className="text-neutral-300">실수령액</span>
              <span className="font-extrabold">{won(thisMonthTotals.net)}</span>
            </div>
          </div>

          {recentRows.length > 0 && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3 mb-3">
              <div className="text-xs font-bold text-neutral-500 mb-2">{profile?.name} 최근 기록</div>
              <div className="flex flex-col gap-2">
                {recentRows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-neutral-700">{fmtDate(r.work_date)}</div>
                      <div className="text-neutral-400">
                        {hm(r.clock_in)} ~ {hm(r.clock_out)} · {r.hours != null ? `${r.hours}시간` : "-"}
                      </div>
                    </div>
                    <div className="font-bold text-neutral-800">{r.net_pay != null ? won(r.net_pay) : "-"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <details className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2">
            <summary className="text-xs font-bold text-neutral-500 cursor-pointer">🔑 비밀번호 변경</summary>
            <div className="flex flex-col gap-2 mt-2">
              <input
                type="password"
                className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                placeholder="현재 비밀번호"
                value={oldPw}
                onChange={(e) => setOldPw(sanitizePasswordInput(e.target.value))}
              />
              <input
                type="password"
                className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                placeholder="새 비밀번호 (4자 이상)"
                value={newPw}
                onChange={(e) => setNewPw(sanitizePasswordInput(e.target.value))}
              />
              <button
                className="bg-neutral-800 text-white text-sm font-bold rounded-lg py-2 disabled:opacity-60"
                onClick={changePassword}
                disabled={pwBusy}
              >
                {pwBusy ? "변경 중..." : "변경"}
              </button>
              {pwMsg && <div className="text-xs text-neutral-600">{pwMsg}</div>}
            </div>
          </details>
        </div>

        <div className="bg-white border-2 border-neutral-800 rounded-3xl p-4">
          <div className="text-lg font-extrabold text-neutral-800 mb-3">📋 월급명세서</div>
          {groups.length === 0 && <div className="text-center text-sm text-neutral-400 py-8">출퇴근 기록이 없습니다</div>}
          <div className="flex flex-col gap-4">
            {groups.map(([month, monthRows], idx) => {
              const totalHours = monthRows.reduce((s, r) => s + (r.hours || 0), 0);
              const totalDaily = monthRows.reduce((s, r) => s + (r.daily_pay || 0), 0);
              const totalNet = monthRows.reduce((s, r) => s + (r.net_pay || 0), 0);
              const isPaid = monthRows.length > 0 && monthRows.every((r) => r.paid_at);
              return (
                <details key={month} className="border border-neutral-200 rounded-xl overflow-hidden" open={idx === 0}>
                  <summary className="bg-neutral-800 text-white text-sm font-bold px-3 py-2 cursor-pointer flex items-center justify-between gap-2">
                    <span>
                      {monthLabel(shiftMonth(month, 1))} 급여명세서 ({monthLabel(month)} 근무분)
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isPaid ? "bg-emerald-500 text-white" : "bg-neutral-600 text-neutral-200"
                      }`}
                    >
                      {isPaid ? "✅ 입금완료" : "미입금"}
                    </span>
                  </summary>
                  <div className="overflow-x-auto">
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
                            <td className="px-2 py-1.5 text-center">{hm(r.clock_in)}</td>
                            <td className="px-2 py-1.5 text-center">{hm(r.clock_out)}</td>
                            <td className="px-2 py-1.5 text-center">{r.hours ?? "-"}</td>
                            <td className="px-2 py-1.5 text-right">{r.daily_pay != null ? won(r.daily_pay) : "-"}</td>
                            <td className="px-2 py-1.5 text-right font-bold">{r.net_pay != null ? won(r.net_pay) : "-"}</td>
                            <td className="px-2 py-1.5 text-center">{paidLabel(r.paid_at)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-bold">
                          <td className="px-2 py-1.5" colSpan={3}>
                            합계
                          </td>
                          <td className="px-2 py-1.5 text-center">{Math.round(totalHours * 100) / 100}</td>
                          <td className="px-2 py-1.5 text-right">{won(totalDaily)}</td>
                          <td className="px-2 py-1.5 text-right">{won(totalNet)}</td>
                          <td className="px-2 py-1.5"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
