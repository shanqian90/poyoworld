"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { todayMMDD } from "@/lib/phone";

type Row = {
  id: number;
  date_mmdd: string;
  paid_date: string | null;
  company_name: string | null;
  product_name: string;
  option_text: string | null;
  order_no: string | null;
  buyer: string | null;
  receiver: string | null;
  phone: string | null;
  account_text: string | null;
  review_url: string | null;
  amount: number | null;
  review_fee: number | null;
  paid: boolean;
};

type Mode = "pending" | "paid" | "unpaid";

type PreviewRow = {
  id: number;
  date_mmdd: string;
  company_name: string | null;
  product_name: string;
  option_text: string | null;
  order_no: string | null;
  buyer: string | null;
  receiver: string | null;
  amount: number | null;
  review_fee: number | null;
  account_text: string | null;
  review_url: string | null;
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SettlementPanel() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [mode, setMode] = useState<Mode>("paid");
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [transferIds, setTransferIds] = useState<number[]>([]);
  const [transferMsg, setTransferMsg] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  useEffect(() => {
    loadPreview();
  }, []);

  async function loadPreview() {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/bulk-transfer/preview");
      const data = await res.json();
      if (data.ok) setPreviewRows(data.rows || []);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function downloadTransfer() {
    setTransferBusy(true);
    setTransferMsg("");
    try {
      const res = await fetch("/api/admin/bulk-transfer/export");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setTransferMsg(data?.message || "다운로드 실패");
        return;
      }
      const idsHeader = res.headers.get("X-Order-Ids") || "";
      const ids = idsHeader ? idsHeader.split(",").map(Number).filter(Boolean) : [];
      setTransferIds(ids);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${todayMMDD()} 입금내역.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setTransferMsg(`✅ ${ids.length}건 다운로드 완료. 이체 완료 후 아래 버튼으로 입금완료 처리하세요.`);
    } catch {
      setTransferMsg("다운로드 중 오류가 발생했습니다");
    } finally {
      setTransferBusy(false);
    }
  }

  async function markPaid() {
    if (!transferIds.length) return;
    if (!confirm(`${transferIds.length}건을 입금완료로 표시할까요?`)) return;
    setMarkingPaid(true);
    try {
      const res = await fetch("/api/admin/bulk-transfer/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: transferIds }),
      });
      const data = await res.json();
      if (!data.ok) {
        setTransferMsg("❌ " + (data.message || "처리 실패"));
        return;
      }
      setTransferMsg(`✅ ${data.count}건 입금완료 처리되었습니다`);
      setTransferIds([]);
      loadPreview();
    } catch {
      setTransferMsg("처리 중 오류가 발생했습니다");
    } finally {
      setMarkingPaid(false);
    }
  }

  async function search() {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams({ from, to, mode });
      if (keyword.trim()) params.set("q", keyword.trim());
      const res = await fetch(`/api/admin/settlement?${params.toString()}`);
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "조회 실패");
        return;
      }
      setRows(data.rows || []);
      if (!data.rows?.length) {
        setMsg(
          mode === "paid"
            ? "해당 기간에 입금완료된 건이 없습니다"
            : mode === "pending"
              ? "리뷰완료 + 입금예정 건이 없습니다"
              : "해당 기간에 미입금 건이 없습니다"
        );
      }
    } catch {
      setMsg("조회 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  const total = rows.reduce((sum, r) => sum + (r.amount || 0) + (r.review_fee || 0), 0);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">💰 정산관리</div>
      </div>

      <div className="border border-neutral-300 rounded-xl p-4 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <div className="font-extrabold text-neutral-700">💸 대량이체 엑셀</div>
          <div className="flex-1" />
          <button
            className="bg-neutral-800 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-60"
            onClick={downloadTransfer}
            disabled={transferBusy}
          >
            {transferBusy ? "생성 중..." : "엑셀 다운로드"}
          </button>
          <button
            className="bg-emerald-600 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-60"
            onClick={markPaid}
            disabled={!transferIds.length || markingPaid}
          >
            {markingPaid ? "처리 중..." : `입금완료 처리 (${transferIds.length}건)`}
          </button>
        </div>
        <div className="text-xs text-neutral-500 mb-2">
          리뷰작성 완료 + 입금 대기 + 계좌정보가 있는 건만 뽑아서 은행 대량이체용 엑셀을 만듭니다.
        </div>
        {transferMsg && <div className="text-xs text-neutral-600 mb-2 whitespace-pre-line">{transferMsg}</div>}

        <div className="border-t border-neutral-200 pt-3">
          <div className="text-xs font-bold text-neutral-500 mb-2">
            {previewLoading ? "불러오는 중..." : `리뷰완료 + 입금대기 목록 (${previewRows.length}건)`}
          </div>
          {previewRows.length > 0 && (
            <div className="border border-neutral-200 rounded-lg overflow-auto max-h-80">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-neutral-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-center">순번</th>
                    <th className="px-2 py-1.5 text-left">날짜</th>
                    <th className="px-2 py-1.5 text-left">업체명</th>
                    <th className="px-2 py-1.5 text-left">제품</th>
                    <th className="px-2 py-1.5 text-center">리뷰</th>
                    <th className="px-2 py-1.5 text-left">구매자</th>
                    <th className="px-2 py-1.5 text-left">금액</th>
                    <th className="px-2 py-1.5 text-left">계좌</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="px-2 py-1 text-center">{i + 1}</td>
                      <td className="px-2 py-1">{r.date_mmdd}</td>
                      <td className="px-2 py-1">{r.company_name || "-"}</td>
                      <td className="px-2 py-1">
                        {r.product_name}
                        {r.option_text ? ` (${r.option_text})` : ""}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {r.review_url ? (
                          <button
                            className="underline text-emerald-700 font-bold"
                            onClick={() => setZoomImage(r.review_url!.split("\n")[0])}
                          >
                            보기
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-2 py-1">{r.buyer || r.receiver || "-"}</td>
                      <td className="px-2 py-1">
                        {((Number(r.amount) || 0) + (Number(r.review_fee) || 0)).toLocaleString()}원
                      </td>
                      <td className="px-2 py-1 max-w-[140px] truncate">{r.account_text || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="border border-neutral-300 rounded-xl p-4 bg-white">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className="font-extrabold text-neutral-700">📅 정산 조회</div>
          <div className="flex bg-neutral-100 rounded-lg p-0.5 ml-1">
            <button
              className={`text-xs font-bold rounded-md px-3 py-1.5 ${mode === "pending" ? "bg-white text-sky-600 shadow" : "text-neutral-500"}`}
              onClick={() => setMode("pending")}
            >
              입금예정 조회
            </button>
            <button
              className={`text-xs font-bold rounded-md px-3 py-1.5 ${mode === "paid" ? "bg-white text-neutral-800 shadow" : "text-neutral-500"}`}
              onClick={() => setMode("paid")}
            >
              입금완료 조회
            </button>
            <button
              className={`text-xs font-bold rounded-md px-3 py-1.5 ${mode === "unpaid" ? "bg-white text-rose-600 shadow" : "text-neutral-500"}`}
              onClick={() => setMode("unpaid")}
            >
              미입금 조회
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {mode !== "pending" && (
            <>
              <input
                type="date"
                className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <span className="text-neutral-400">~</span>
              <input
                type="date"
                className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </>
          )}
          <input
            className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]"
            placeholder="이름 · 전화번호 · 제품명 · 주문번호 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button
            className="bg-neutral-800 text-white text-xs font-bold rounded-lg px-4 py-2 disabled:opacity-60"
            onClick={search}
            disabled={loading}
          >
            {loading ? "조회 중..." : "조회"}
          </button>
        </div>
        {rows.length > 0 && (
          <div className="text-sm font-bold text-emerald-700 mt-2">
            {rows.length}건 · 합계 ₩{total.toLocaleString("ko-KR")}
          </div>
        )}
        {msg && <div className="text-xs text-neutral-500 mt-2">{msg}</div>}
      </div>

      <div className="border border-neutral-300 rounded-xl overflow-auto flex-1">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-neutral-800 text-white sticky top-0">
            <tr>
              <th className="px-2 py-2 text-center">순번</th>
              <th className="px-2 py-2 text-center">{mode === "paid" ? "입금일" : "진행일자"}</th>
              <th className="px-2 py-2 text-center">업체명</th>
              <th className="px-2 py-2 text-center">제품명</th>
              <th className="px-2 py-2 text-center">주문번호</th>
              <th className="px-2 py-2 text-center">구매자</th>
              <th className="px-2 py-2 text-center">수취인</th>
              <th className="px-2 py-2 text-center">전화번호</th>
              <th className="px-2 py-2 text-center">계좌</th>
              <th className="px-2 py-2 text-center">금액</th>
              <th className="px-2 py-2 text-center">리뷰</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-neutral-200">
                <td className="px-2 py-1.5 text-center">{i + 1}</td>
                <td className="px-2 py-1.5 text-center">{r.paid_date || r.date_mmdd}</td>
                <td className="px-2 py-1.5 text-center">{r.company_name}</td>
                <td className="px-2 py-1.5 text-center">
                  {r.product_name}
                  {r.option_text ? ` (${r.option_text})` : ""}
                </td>
                <td className="px-2 py-1.5 text-center font-mono">{r.order_no}</td>
                <td className="px-2 py-1.5 text-center">{r.buyer}</td>
                <td className="px-2 py-1.5 text-center">{r.receiver}</td>
                <td className="px-2 py-1.5 text-center">{r.phone}</td>
                <td className="px-2 py-1.5 text-center max-w-[140px] truncate">{r.account_text || "-"}</td>
                <td className="px-2 py-1.5 text-center">₩{((r.amount || 0) + (r.review_fee || 0)).toLocaleString("ko-KR")}</td>
                <td className="px-2 py-1.5 text-center">
                  {r.review_url ? (
                    <button
                      className="underline text-emerald-700 font-bold"
                      onClick={() => setZoomImage(r.review_url!.split("\n")[0])}
                    >
                      보기
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={11} className="text-center text-neutral-400 py-8">
                  조회된 목록이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setZoomImage(null)}
        >
          {zoomImage.includes("drive.google.com") ? (
            <iframe
              src={zoomImage}
              className="w-full h-full max-w-3xl max-h-[85vh] rounded-xl bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img src={zoomImage} alt="리뷰 이미지" className="max-w-full max-h-full rounded-xl" />
          )}
        </div>
      )}
    </div>
  );
}
