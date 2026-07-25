"use client";

import { useEffect, useState } from "react";
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
  delivery: string | null;
};

type EditFields = {
  postal: string;
  itemName: string;
  altItemName: string;
  qty: string;
  message: string;
  etc: string;
};

function defaultItemName() {
  return `${todayMMDD()}포요SD`;
}
function emptyEditFields(): EditFields {
  return { postal: "", itemName: defaultItemName(), altItemName: defaultItemName(), qty: "1", message: "", etc: "" };
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToMmdd(iso: string) {
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[1]}${parts[2]}` : "";
}

type ColKey = "receiver" | "postal" | "address" | "phone" | "itemName" | "orderNo" | "altItemName" | "qty" | "message" | "etc";
type ColDef = { key: ColKey; label: string; editable: boolean };
const COLS: ColDef[] = [
  { key: "receiver", label: "받는분성명", editable: false },
  { key: "postal", label: "받는분우편번호", editable: true },
  { key: "address", label: "받는분주소(전체, 분할)", editable: false },
  { key: "phone", label: "받는분전화번호", editable: false },
  { key: "itemName", label: "품목명", editable: true },
  { key: "orderNo", label: "고객주문번호", editable: false },
  { key: "altItemName", label: "내품명", editable: true },
  { key: "qty", label: "내품수량", editable: true },
  { key: "message", label: "배송메세지1", editable: true },
  { key: "etc", label: "기타1", editable: true },
];

export default function DeliveryManager() {
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [trackRows, setTrackRows] = useState<TrackRow[]>([]);
  const [trackChecked, setTrackChecked] = useState<Record<number, boolean>>({});
  const [editFields, setEditFields] = useState<Record<number, EditFields>>({});
  const [trackLoadBusy, setTrackLoadBusy] = useState(false);
  const [trackExportBusy, setTrackExportBusy] = useState(false);
  const [trackExportMsg, setTrackExportMsg] = useState("");

  const [trackFile, setTrackFile] = useState<File | null>(null);
  const [trackImportBusy, setTrackImportBusy] = useState(false);
  const [trackImportMsg, setTrackImportMsg] = useState("");

  const [anchor, setAnchor] = useState<{ row: number; col: number } | null>(null);
  const [focus, setFocus] = useState<{ row: number; col: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    function onUp() {
      setDragging(false);
    }
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  function selRange() {
    if (!anchor || !focus) return null;
    return {
      r0: Math.min(anchor.row, focus.row),
      r1: Math.max(anchor.row, focus.row),
      c0: Math.min(anchor.col, focus.col),
      c1: Math.max(anchor.col, focus.col),
    };
  }
  function isSelected(row: number, col: number) {
    const s = selRange();
    if (!s) return false;
    return row >= s.r0 && row <= s.r1 && col >= s.c0 && col <= s.c1;
  }

  function fillDown() {
    const s = selRange();
    if (!s) return;
    for (let c = s.c0; c <= s.c1; c++) {
      const col = COLS[c];
      if (!col.editable) continue;
      const topRow = trackRows[s.r0];
      if (!topRow) continue;
      const value = (editFields[topRow.id] || emptyEditFields())[col.key as keyof EditFields];
      for (let r = s.r0 + 1; r <= s.r1; r++) {
        const row = trackRows[r];
        if (!row) continue;
        updateField(row.id, col.key as keyof EditFields, value);
      }
    }
  }

  async function copyRange() {
    const s = selRange();
    if (!s) return;
    const lines: string[] = [];
    for (let r = s.r0; r <= s.r1; r++) {
      const row = trackRows[r];
      if (!row) continue;
      const ef = editFields[row.id] || emptyEditFields();
      const cells: string[] = [];
      for (let c = s.c0; c <= s.c1; c++) {
        const col = COLS[c];
        let val = "";
        if (col.editable) val = String(ef[col.key as keyof EditFields] ?? "");
        else if (col.key === "receiver") val = row.receiver || "";
        else if (col.key === "address") val = row.address || "";
        else if (col.key === "phone") val = row.phone || "";
        else if (col.key === "orderNo") val = row.order_no || "";
        cells.push(val);
      }
      lines.push(cells.join("\t"));
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setTrackExportMsg("✅ 복사되었습니다");
    } catch {
      setTrackExportMsg("복사 실패");
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (editingCell) return;
      if (!anchor || !focus) return;
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        fillDown();
      } else if (e.key.toLowerCase() === "c") {
        copyRange();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, focus, editingCell, trackRows, editFields]);

  async function loadTrackPreview() {
    const trackFrom = isoToMmdd(fromDate);
    const trackTo = isoToMmdd(toDate);
    if (!/^\d{4}$/.test(trackFrom) || !/^\d{4}$/.test(trackTo)) {
      setTrackExportMsg("조회 기간을 선택해주세요");
      return;
    }
    setTrackLoadBusy(true);
    setTrackExportMsg("");
    setAnchor(null);
    setFocus(null);
    setEditingCell(null);
    try {
      const res = await fetch(`/api/admin/tracking/preview?from=${trackFrom}&to=${trackTo}`);
      const data = await res.json();
      if (!data.ok) {
        setTrackExportMsg(data.message || "조회 실패");
        return;
      }
      const rows: TrackRow[] = data.rows || [];
      setTrackRows(rows);
      const nextChecked: Record<number, boolean> = {};
      rows.forEach((r) => {
        if (!r.tracking) nextChecked[r.id] = true;
      });
      setTrackChecked(nextChecked);
      setEditFields((prev) => {
        const next: Record<number, EditFields> = {};
        rows.forEach((r) => {
          next[r.id] = prev[r.id] || emptyEditFields();
        });
        return next;
      });
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

  function updateField(id: number, key: keyof EditFields, value: string) {
    setEditFields((prev) => ({ ...prev, [id]: { ...(prev[id] || emptyEditFields()), [key]: value } }));
  }

  function fillDefaultItemNames() {
    const value = defaultItemName();
    setEditFields((prev) => {
      const next = { ...prev };
      trackRows.forEach((r) => {
        next[r.id] = { ...(next[r.id] || emptyEditFields()), itemName: value, altItemName: value };
      });
      return next;
    });
  }

  const selectableRows = trackRows.filter((r) => !r.tracking);
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => trackChecked[r.id]);

  function toggleSelectAll() {
    const next = !allSelected;
    setTrackChecked((prev) => {
      const updated = { ...prev };
      selectableRows.forEach((r) => {
        updated[r.id] = next;
      });
      return updated;
    });
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
      const items = checkedIds.map((id) => ({ id, ...(editFields[id] || emptyEditFields()) }));
      const res = await fetch("/api/admin/tracking/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
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
      a.download = `tracking-${fromDate}-${toDate}.xlsx`;
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
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">🚚 배송관리</div>
      </div>

      <div className="border border-neutral-300 rounded-xl p-4 bg-white">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <div className="font-extrabold text-neutral-700">운송장번호 엑셀</div>
          <div className="flex-1" />
          <input
            type="date"
            className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <span className="text-neutral-400 text-sm">~</span>
          <input
            type="date"
            className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <button
            className="bg-neutral-800 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-60"
            onClick={loadTrackPreview}
            disabled={trackLoadBusy}
          >
            {trackLoadBusy ? "조회 중..." : "조회"}
          </button>
          <button
            className="bg-emerald-600 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-60"
            onClick={downloadTrackingSelected}
            disabled={trackExportBusy || !checkedIds.length}
          >
            {trackExportBusy ? "생성 중..." : `다운로드 (${checkedIds.length}건)`}
          </button>
        </div>
        <div className="text-xs text-neutral-500 mb-2">
          기간을 선택해서 조회하면, 택배대행 신청 + 실제 진행(실진행~계좌까지 기재)된 주문 중 운송장번호가 없는 건만 체크된 상태로
          나와요. 이미 운송장이 있는 건은 회색으로 표시되고 선택할 수 없어요. 표에서 셀 클릭/드래그로 범위 선택 후 Ctrl+D(아래로 채우기),
          Ctrl+C(복사)를 쓸 수 있고, 더블클릭하면 바로 수정할 수 있어요.
        </div>
        {trackExportMsg && <div className="text-xs text-neutral-600 mb-2">{trackExportMsg}</div>}
        {trackRows.length > 0 && (
          <button
            className="text-xs font-bold text-emerald-700 border border-emerald-600 rounded-lg px-3 py-1.5 mb-1"
            onClick={fillDefaultItemNames}
          >
            📋 품목명/내품명 일괄입력 ({defaultItemName()})
          </button>
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

      <div className="border border-neutral-300 rounded-xl overflow-auto flex-1 select-none">
        <table className="text-xs border-collapse w-full min-w-[1300px]">
          <thead className="bg-neutral-800 text-white sticky top-0">
            <tr>
              <th className="px-2 py-2 text-center border-r border-neutral-700">순번</th>
              <th className="px-2 py-2 text-center border-r border-neutral-700">
                <input type="checkbox" checked={allSelected} disabled={!selectableRows.length} onChange={toggleSelectAll} />
              </th>
              {COLS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-center border-r border-neutral-700 whitespace-nowrap">
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 text-center border-r border-neutral-700">택배대행</th>
              <th className="px-2 py-2 text-center">운송장 번호</th>
            </tr>
          </thead>
          <tbody>
            {trackRows.map((r, ri) => {
              const hasTracking = !!r.tracking;
              const f = editFields[r.id] || emptyEditFields();
              return (
                <tr key={r.id} className={`border-b border-neutral-200 ${hasTracking ? "bg-neutral-100 text-neutral-400" : ""}`}>
                  <td
                    className="px-2 py-1.5 text-center border-r border-neutral-100 cursor-pointer"
                    onMouseDown={() => {
                      setAnchor({ row: ri, col: 0 });
                      setFocus({ row: ri, col: COLS.length - 1 });
                      setDragging(true);
                      setEditingCell(null);
                    }}
                    onMouseEnter={() => {
                      if (dragging) setFocus({ row: ri, col: COLS.length - 1 });
                    }}
                  >
                    {ri + 1}
                  </td>
                  <td className="px-2 py-1.5 text-center border-r border-neutral-100">
                    <input
                      type="checkbox"
                      checked={!!trackChecked[r.id]}
                      disabled={hasTracking}
                      onChange={() => toggleTrackRow(r.id, hasTracking)}
                    />
                  </td>
                  {COLS.map((c, ci) => {
                    const selected = isSelected(ri, ci);
                    const isEditing = editingCell?.row === ri && editingCell?.col === ci;
                    let display: string;
                    if (c.editable) display = String(f[c.key as keyof EditFields] ?? "");
                    else if (c.key === "receiver") display = r.receiver || "";
                    else if (c.key === "address") display = r.address || "";
                    else if (c.key === "phone") display = r.phone || "";
                    else display = r.order_no || "";

                    return (
                      <td
                        key={c.key}
                        className={`px-1 py-1 text-center border-r border-neutral-100 ${selected ? "bg-amber-100" : ""} ${
                          c.key === "address" ? "text-left" : ""
                        }`}
                        onMouseDown={() => {
                          setAnchor({ row: ri, col: ci });
                          setFocus({ row: ri, col: ci });
                          setDragging(true);
                          if (!isEditing) setEditingCell(null);
                        }}
                        onMouseEnter={() => {
                          if (dragging) setFocus({ row: ri, col: ci });
                        }}
                        onDoubleClick={() => {
                          if (c.editable) setEditingCell({ row: ri, col: ci });
                        }}
                      >
                        {isEditing && c.editable ? (
                          <input
                            autoFocus
                            className="w-full bg-white outline-none px-1 rounded border border-amber-400"
                            value={String(f[c.key as keyof EditFields] ?? "")}
                            onChange={(e) => updateField(r.id, c.key as keyof EditFields, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Escape") {
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <div className="px-1 truncate">{display || (c.editable ? <span className="text-neutral-300">-</span> : display)}</div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center border-r border-neutral-100" style={{ backgroundColor: r.delivery ? "#F5E6C8" : undefined }}>
                    {r.delivery || "-"}
                  </td>
                  <td className="px-2 py-1.5 text-center">{r.tracking || "-"}</td>
                </tr>
              );
            })}
            {!trackRows.length && (
              <tr>
                <td colSpan={COLS.length + 4} className="text-center text-neutral-400 py-8">
                  조회된 목록이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
