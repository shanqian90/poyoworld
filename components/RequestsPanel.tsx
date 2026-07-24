"use client";

import { useState } from "react";
import Link from "next/link";

export type WorkRequestRow = {
  id: number;
  receipt_no: string;
  company_code: string | null;
  company_name: string;
  start_date: string;
  keyword: string;
  product_option: string | null;
  total_count: number;
  daily_plan: string | null;
  review_type: string | null;
  unit_price: number;
  status: string;
  main_created: boolean;
  created_at: string;
};

export default function RequestsPanel({
  rows,
  loadError,
}: {
  rows: WorkRequestRow[];
  loadError: string | null;
}) {
  const [items, setItems] = useState(rows);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [resetId, setResetId] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetting, setResetting] = useState(false);

  async function resetPassword() {
    const id = resetId.trim();
    if (!id) {
      setResetMsg("아이디를 입력해주세요");
      return;
    }
    if (!confirm(`${id} 계정의 비밀번호를 초기화할까요?\n다음 로그인 시 입력하는 비밀번호가 새로 등록됩니다.`)) return;
    setResetting(true);
    setResetMsg("");
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: id }),
      });
      const data = await res.json();
      setResetMsg(data.ok ? `✅ ${id} 비밀번호가 초기화되었습니다` : `❌ ${data.message || "초기화 실패"}`);
      if (data.ok) setResetId("");
    } catch {
      setResetMsg("❌ 초기화 중 오류가 발생했습니다");
    } finally {
      setResetting(false);
    }
  }

  const pendingCount = items.filter((r) => r.status === "접수" && !r.main_created).length;

  async function generate() {
    setGenerating(true);
    setResult("");
    try {
      const res = await fetch("/api/admin/generate-main", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setResult("❌ " + (data.message || "생성 실패"));
        return;
      }
      setResult(
        `✅ 요청 ${data.requestCount}건 처리 → 메인시트 슬롯 ${data.orderRows}건 생성, 구매가이드 ${data.guideRows}건 생성`
      );
      setItems((prev) =>
        prev.map((r) => (r.status === "접수" && !r.main_created ? { ...r, status: "진행중", main_created: true } : r))
      );
    } catch {
      setResult("❌ 생성 중 오류가 발생했습니다");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">📝 작업요청서 목록</div>
        <div className="flex-1" />
        <button
          className="bg-emerald-600 text-white text-sm font-extrabold rounded-lg px-4 py-2 disabled:opacity-60"
          onClick={generate}
          disabled={generating || pendingCount === 0}
        >
          {generating ? "생성 중..." : `메인시트 생성 (대기 ${pendingCount}건)`}
        </button>
      </div>

      <div className="border border-neutral-300 rounded-xl px-3 py-2 flex items-center gap-2 bg-neutral-50">
        <span className="text-xs font-bold text-neutral-500 shrink-0">🔑 비밀번호 초기화</span>
        <input
          className="border border-neutral-300 rounded-lg px-2 py-1 text-sm flex-1"
          placeholder="아이디 (전화번호/카카오톡아이디)"
          value={resetId}
          onChange={(e) => setResetId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && resetPassword()}
        />
        <button
          className="text-xs bg-neutral-700 text-white font-bold rounded-lg px-3 py-1.5 disabled:opacity-60 shrink-0"
          onClick={resetPassword}
          disabled={resetting}
        >
          {resetting ? "처리 중..." : "초기화"}
        </button>
        {resetMsg && <span className="text-xs shrink-0">{resetMsg}</span>}
      </div>

      {loadError && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">{loadError}</div>
      )}
      {result && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm rounded-xl px-3 py-2 whitespace-pre-line">
          {result}
        </div>
      )}

      <div className="border border-neutral-300 rounded-xl overflow-auto">
        <table className="w-full text-xs border-collapse min-w-[1100px]">
          <thead className="bg-neutral-800 text-white">
            <tr>
              {["접수번호", "업체코드", "업체명", "시작일", "제품명", "옵션", "총건수", "일진행", "리뷰종류", "단가", "상태"].map(
                (h) => (
                  <th key={h} className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-neutral-200">
                <Td>{r.receipt_no}</Td>
                <Td>{r.company_code}</Td>
                <Td>{r.company_name}</Td>
                <Td>{r.start_date}</Td>
                <Td>{r.keyword}</Td>
                <Td>{r.product_option}</Td>
                <Td>{r.total_count}</Td>
                <Td>{r.daily_plan}</Td>
                <Td>{r.review_type}</Td>
                <Td>{(r.unit_price || 0).toLocaleString("ko-KR")}</Td>
                <Td>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      r.main_created ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.status}
                    {r.main_created ? " · 생성완료" : ""}
                  </span>
                </Td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center text-neutral-400 py-8">
                  제출된 작업요청서가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5 border-r border-neutral-200 whitespace-nowrap text-center">{children ?? ""}</td>;
}
