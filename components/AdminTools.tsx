"use client";

import { useState } from "react";
import Link from "next/link";
import { todayMMDD } from "@/lib/phone";

type TrackRow = {
  id: number;
  order_no: string | null;
  receiver: string | null;
  address: string | null;
  phone: string | null;
  product_name: string | null;
  tracking: string | null;
  date_mmdd: string;
};

export default function AdminTools() {
  const [transferIds, setTransferIds] = useState<number[]>([]);
  const [transferMsg, setTransferMsg] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  const [trackFrom, setTrackFrom] = useState(todayMMDD());
  const [trackTo, setTrackTo] = useState(todayMMDD());
  const [trackRows, setTrackRows] = useState<TrackRow[]>([]);
  const [trackChecked, setTrackChecked] = useState<Record<number, boolean>>({});
  const [trackLoadBusy, setTrackLoadBusy] = useState(false);
  const [trackExportBusy, setTrackExportBusy] = useState(false);
  const [trackExportMsg, setTrackExportMsg] = useState("");

  const [trackFile, setTrackFile] = useState<File | null>(null);
  const [trackImportBusy, setTrackImportBusy] = useState(false);
  const [trackImportMsg, setTrackImportMsg] = useState("");

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
      a.download = "bulk-transfer.xlsx";
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
    } catch {
      setTransferMsg("처리 중 오류가 발생했습니다");
    } finally {
      setMarkingPaid(false);
    }
  }

  async function loadTrackPreview() {
    if (!/^\d{4}$/.test(trackFrom) || !/^\d{4}$/.test(trackTo)) {
      setTrackExportMsg("날짜는 MMDD 4자리로 입력해주세요");
      return;
    }
    setTrackLoadBusy(true);
    setTrackExportMsg("");
    try {
      const res = await fetch(`/api/admin/tracking/preview?from=${trackFrom}&to=${trackTo}`);
      const data = await res.json();
      if (!data.ok) {
        setTrackExportMsg(data.message || "조회 실패");
        return;
      }
      const rows: TrackRow[] = data.rows || [];
      setTrackRows(rows);
      const next: Record<number, boolean> = {};
      rows.forEach((r) => {
        if (!r.tracking) next[r.id] = true;
      });
      setTrackChecked(next);
    } catch {
      setTrackExportMsg("조회 중 오류가 발생했습니다");
    } finally {
      setTrackLoadBusy(false);
    }
  }

  function toggleTrackRow(id: number, hasTracking: boolean) {
    if (hasTracking) return;
    setTrackChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const checkedIds = Object.entries(trackChecked)
    .filter(([, v]) => v)
    .map(([k]) => Number(k));

  async function downloadTrackingSelected() {
    if (!checkedIds.length) {
      setTrackExportMsg("선택된 항목이 없습니다");
      return;
    }
    setTrackExportBusy(true);
    setTrackExportMsg("");
    try {
      const res = await fetch("/api/admin/tracking/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: checkedIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setTrackExportMsg(data?.message || "다운로드 실패");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tracking-${trackFrom}-${trackTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setTrackExportMsg(`✅ ${checkedIds.length}건 다운로드 완료`);
    } catch {
      setTrackExportMsg("다운로드 중 오류가 발생했습니다");
    } finally {
      setTrackExportBusy(false);
    }
  }

  async function uploadTracking() {
    if (!trackFile) {
      setTrackImportMsg("파일을 선택해주세요");
      return;
    }
    setTrackImportBusy(true);
    setTrackImportMsg("");
    try {
      const fd = new FormData();
      fd.append("file", trackFile);
      const res = await fetch("/api/admin/tracking/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) {
        setTrackImportMsg("❌ " + (data.message || "업로드 실패"));
        return;
      }
      setTrackImportMsg(
        `✅ ${data.matched}건 반영 완료` +
          (data.unmatched?.length ? ` · 매칭 실패 ${data.unmatched.length}건: ${data.unmatched.slice(0, 5).join(", ")}` : "")
      );
    } catch {
      setTrackImportMsg("업로드 중 오류가 발생했습니다");
    } finally {
      setTrackImportBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">🧰 관리 도구</div>
      </div>

      <div className="border border-neutral-300 rounded-xl p-4 bg-white">
        <div className="font-extrabold text-neutral-700 mb-1">💸 대량이체 엑셀</div>
        <div className="text-xs text-neutral-500 mb-3">
          리뷰작성 완료 + 입금 대기 + 계좌정보가 있는 건만 뽑아서 은행 대량이체용 엑셀을 만듭니다.
        </div>
        <div className="flex gap-2">
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
            {markingPaid ? "처리 중..." : `이 목록 입금완료 처리 (${transferIds.length}건)`}
          </button>
        </div>
        {transferMsg && <div className="text-xs text-neutral-600 mt-2 whitespace-pre-line">{transferMsg}</div>}
      </div>

      <div className="border border-neutral-300 rounded-xl p-4 bg-white">
        <div className="font-extrabold text-neutral-700 mb-1">🚚 운송장번호 엑셀</div>
        <div className="text-xs text-neutral-500 mb-3">
          기간을 선택해서 조회하면, 택배대행(Y)인 주문 중 운송장번호가 없는 건만 체크된 상태로 나와요. 이미 운송장이 있는 건은 회색으로 표시되고 선택할 수 없어요.
        </div>
        <div className="flex gap-2 mb-3 items-center flex-wrap">
          <input
            className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-28"
            placeholder="시작 MMDD"
            maxLength={4}
            value={trackFrom}
            onChange={(e) => setTrackFrom(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <span className="text-neutral-400 text-sm">~</span>
          <input
            className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-28"
            placeholder="종료 MMDD"
            maxLength={4}
            value={trackTo}
            onChange={(e) => setTrackTo(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <button
            className="bg-neutral-700 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-60"
            onClick={loadTrackPreview}
            disabled={trackLoadBusy}
          >
            {trackLoadBusy ? "조회 중..." : "조회"}
          </button>
          <button
            className="bg-neutral-800 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-60"
            onClick={downloadTrackingSelected}
            disabled={trackExportBusy || !checkedIds.length}
          >
            {trackExportBusy ? "생성 중..." : `선택 항목 다운로드 (${checkedIds.length}건)`}
          </button>
        </div>
        {trackExportMsg && <div className="text-xs text-neutral-600 mb-3">{trackExportMsg}</div>}

        {trackRows.length > 0 && (
          <div className="border border-neutral-200 rounded-lg overflow-auto max-h-72 mb-3">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-neutral-100 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5"></th>
                  <th className="px-2 py-1.5 text-left">날짜</th>
                  <th className="px-2 py-1.5 text-left">주문번호</th>
                  <th className="px-2 py-1.5 text-left">수취인</th>
                  <th className="px-2 py-1.5 text-left">전화번호</th>
                  <th className="px-2 py-1.5 text-left">운송장번호</th>
                </tr>
              </thead>
              <tbody>
                {trackRows.map((r) => {
                  const hasTracking = !!r.tracking;
                  return (
                    <tr key={r.id} className={hasTracking ? "bg-neutral-100 text-neutral-400" : ""}>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={!!trackChecked[r.id]}
                          disabled={hasTracking}
                          onChange={() => toggleTrackRow(r.id, hasTracking)}
                        />
                      </td>
                      <td className="px-2 py-1">{r.date_mmdd}</td>
                      <td className="px-2 py-1">{r.order_no}</td>
                      <td className="px-2 py-1">{r.receiver}</td>
                      <td className="px-2 py-1">{r.phone}</td>
                      <td className="px-2 py-1">{r.tracking || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-neutral-200 pt-3">
          <div className="text-xs font-bold text-neutral-500 mb-2">
            택배사에서 받은 엑셀(고객주문번호+운송장번호 포함)을 업로드하면 자동으로 매칭돼요
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setTrackFile(e.target.files?.[0] || null)}
              className="text-xs"
            />
            <button
              className="bg-emerald-600 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-60 shrink-0"
              onClick={uploadTracking}
              disabled={trackImportBusy || !trackFile}
            >
              {trackImportBusy ? "업로드 중..." : "업로드"}
            </button>
          </div>
          {trackImportMsg && <div className="text-xs text-neutral-600 mt-2 whitespace-pre-line">{trackImportMsg}</div>}
        </div>
      </div>
    </div>
  );
}
