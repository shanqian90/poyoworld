"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  id: number;
  date_mmdd: string;
  company_name: string | null;
  product_name: string;
  order_no: string | null;
  manager: string | null;
  real_manager: string | null;
};

const THRESHOLD_DAYS = 10;

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
function fmtDay(mmdd: string) {
  if (!mmdd || mmdd.length !== 4) return mmdd;
  return `${Number(mmdd.slice(0, 2))}/${mmdd.slice(2)}`;
}

export default function ExpelledList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [blacklisted, setBlacklisted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyName, setBusyName] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const [ordersRes, nameListRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, date_mmdd, company_name, product_name, order_no, manager, real_manager")
          .not("order_no", "is", null)
          .eq("review_done", false)
          .order("date_mmdd", { ascending: true }),
        fetch("/api/admin/name-list").then((r) => r.json()),
      ]);
      if (ordersRes.error) {
        setLoadError(ordersRes.error.message);
        return;
      }
      setRows((ordersRes.data || []) as Row[]);
      if (nameListRes.ok) {
        setBlacklisted(new Set((nameListRes.blacklist || []).map((b: { value: string }) => b.value)));
      }
    } catch {
      setLoadError("불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  const overdue = useMemo(
    () => rows.filter((r) => daysSinceMmdd(r.date_mmdd) >= THRESHOLD_DAYS),
    [rows]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    overdue.forEach((r) => {
      const name = (r.real_manager || r.manager || "(미지정)").trim() || "(미지정)";
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [overdue]);

  async function registerBlacklist(name: string) {
    if (!confirm(`"${name}" 님을 블랙리스트에 등록할까요?`)) return;
    setBusyName(name);
    try {
      const res = await fetch("/api/admin/name-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "blacklist", value: name, reason: `리뷰 미제출 ${THRESHOLD_DAYS}일 경과 자동 등록` }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "등록 실패");
        return;
      }
      setBlacklisted((prev) => new Set(prev).add(name));
    } finally {
      setBusyName(null);
    }
  }

  function confirmName(name: string) {
    setConfirmed((prev) => new Set(prev).add(name));
  }

  const visibleGroups = groups.filter(([name]) => !confirmed.has(name));

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3 gap-3">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">🚷 퇴출명단</div>
        <span className="text-xs text-neutral-500">{visibleGroups.length.toLocaleString("ko-KR")}명</span>
        {confirmed.size > 0 && (
          <button className="text-xs text-neutral-400 underline" onClick={() => setConfirmed(new Set())}>
            확인 처리 {confirmed.size}건 다시 보기
          </button>
        )}
      </div>
      <div className="text-xs text-neutral-400">
        구매(주문번호)는 완료되었지만 리뷰 미제출이 {THRESHOLD_DAYS}일 이상 지난 진행자를 이름별로 모아 보여줍니다. 확정 시 블랙리스트에 등록되어
        이후 구매/리뷰 제출이 차단됩니다.
      </div>

      {loading && <div className="text-center text-sm text-neutral-400 py-10">불러오는 중...</div>}
      {loadError && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">{loadError}</div>
      )}

      {!loading && !loadError && (
        <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
          {visibleGroups.map(([name, items]) => {
            const isBlacklisted = blacklisted.has(name);
            const maxDays = Math.max(...items.map((r) => daysSinceMmdd(r.date_mmdd)));
            return (
              <div key={name} className="border border-neutral-300 rounded-xl bg-white overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-50 border-b border-neutral-200">
                  <span className="font-extrabold text-neutral-800">{name}</span>
                  <span className="text-xs text-neutral-500">
                    미제출 {items.length}건 · 최대 {maxDays}일 경과
                  </span>
                  <div className="flex-1" />
                  {isBlacklisted ? (
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">🚫 블랙리스트 등록됨</span>
                  ) : (
                    <>
                      <button
                        className="text-xs font-bold text-neutral-600 bg-white border border-neutral-300 rounded-lg px-3 py-1.5"
                        onClick={() => confirmName(name)}
                      >
                        확인
                      </button>
                      <button
                        className="text-xs font-bold text-white bg-rose-600 rounded-lg px-3 py-1.5 disabled:opacity-60"
                        onClick={() => registerBlacklist(name)}
                        disabled={busyName === name}
                      >
                        {busyName === name ? "등록 중..." : "블랙리스트 등록"}
                      </button>
                    </>
                  )}
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th className="px-2 py-1.5 text-center">진행일자</th>
                      <th className="px-2 py-1.5 text-center">경과일</th>
                      <th className="px-2 py-1.5 text-center">업체명</th>
                      <th className="px-2 py-1.5 text-center">제품명</th>
                      <th className="px-2 py-1.5 text-center">주문번호</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.id} className="border-t border-neutral-100">
                        <td className="px-2 py-1.5 text-center">{fmtDay(r.date_mmdd)}</td>
                        <td className="px-2 py-1.5 text-center text-rose-600 font-bold">{daysSinceMmdd(r.date_mmdd)}일</td>
                        <td className="px-2 py-1.5 text-center">{r.company_name}</td>
                        <td className="px-2 py-1.5 text-center">{r.product_name}</td>
                        <td className="px-2 py-1.5 text-center font-mono">{r.order_no}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {!visibleGroups.length && (
            <div className="text-center text-sm text-neutral-400 py-10">퇴출 대상이 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}
