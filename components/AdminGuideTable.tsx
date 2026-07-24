"use client";

import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { GuideProduct } from "@/lib/types";
import KakaoGuideModal from "@/components/KakaoGuideModal";

type Field = keyof GuideProduct;
type Kind = "text" | "toggle" | "checked_at";

const LINK_FIELDS = new Set<Field>(["product_url", "image_url"]);

const COLUMNS: { key: Field; label: string; align?: "right"; kind?: Kind; defaultWidth: number }[] = [
  { key: "active", label: "진행여부", kind: "toggle", defaultWidth: 70 },
  { key: "code", label: "업체코드", defaultWidth: 80 },
  { key: "company", label: "업체명", defaultWidth: 110 },
  { key: "platform", label: "진행플랫폼", defaultWidth: 90 },
  { key: "number_text", label: "번호", defaultWidth: 60 },
  { key: "short_name", label: "간단제품명", defaultWidth: 130 },
  { key: "full_name", label: "풀제품명", defaultWidth: 160 },
  { key: "option_text", label: "옵션", defaultWidth: 110 },
  { key: "note", label: "기타전달사항", defaultWidth: 140 },
  { key: "product_url", label: "제품링크", defaultWidth: 90 },
  { key: "price", label: "가격", align: "right", defaultWidth: 80 },
  { key: "review_fee", label: "리뷰비", defaultWidth: 80 },
  { key: "payback_name", label: "페이백명", defaultWidth: 100 },
  { key: "status", label: "상태", defaultWidth: 90 },
  { key: "buy_type", label: "구매유형", defaultWidth: 100 },
  { key: "review_type", label: "리뷰가이드", defaultWidth: 140 },
  { key: "delivery", label: "배송형태", defaultWidth: 90 },
  { key: "image_url", label: "이미지링크", defaultWidth: 90 },
  { key: "deadline", label: "마감", defaultWidth: 90 },
  { key: "checked_at", label: "시간기록", kind: "checked_at", defaultWidth: 130 },
];

function fmtChecked(v: string | null) {
  if (!v) return "미확인";
  const d = new Date(v);
  return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminGuideTable({
  rows: initialRows,
  loadError,
}: {
  rows: GuideProduct[];
  loadError: string | null;
}) {
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: string; field: Field } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [guideRow, setGuideRow] = useState<GuideProduct | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]))
  );

  function startResize(e: ReactMouseEvent, key: Field) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widths[key] ?? 100;
    function onMove(ev: MouseEvent) {
      const next = Math.max(36, startWidth + (ev.clientX - startX));
      setWidths((prev) => ({ ...prev, [key]: next }));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const [activeOnly, setActiveOnly] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeOnly && !r.active) return false;
      if (!query) return true;
      return [r.company, r.short_name, r.full_name, r.code, r.platform].join(" ").toLowerCase().includes(query);
    });
  }, [rows, q, activeOnly]);

  async function saveField(id: string, field: Field, value: string | number | boolean | null) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/guides/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "저장 실패");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    } catch {
      alert("저장 중 오류가 발생했습니다");
    } finally {
      setSavingId(null);
    }
  }

  function startEdit(row: GuideProduct, field: Field) {
    setEditing({ id: row.id, field });
    const v = row[field];
    setEditValue(v == null ? "" : String(v));
  }

  function commitEdit() {
    if (!editing) return;
    const field = editing.field;
    const raw = editValue.trim();
    const value = raw === "" ? null : field === "price" ? Number(raw) : raw;
    saveField(editing.id, field, value);
    setEditing(null);
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function toggleBool(row: GuideProduct, field: "active") {
    await saveField(row.id, field, !row[field]);
  }

  async function toggleChecked(row: GuideProduct) {
    await saveField(row.id, "checked_at", row.checked_at ? null : new Date().toISOString());
  }

  async function addRow() {
    setAdding(true);
    try {
      const res = await fetch("/api/admin/guides", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "추가 실패");
        return;
      }
      setRows((prev) => [...prev, data.row]);
    } catch {
      alert("추가 중 오류가 발생했습니다");
    } finally {
      setAdding(false);
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("이 행을 삭제할까요?")) return;
    const res = await fetch(`/api/admin/guides/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "삭제 실패");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <div className="text-lg font-extrabold text-neutral-700">📋 구매가이드 관리</div>
        <span className="text-xs text-neutral-500">{filtered.length.toLocaleString("ko-KR")}건</span>
        <span className="text-xs text-neutral-400">셀을 클릭하면 바로 수정할 수 있어요</span>
        <Link href="/admin" className="text-xs font-bold text-emerald-700 underline">
          ← 메인 전체보기
        </Link>
        <div className="flex-1" />
        <button
          className={`text-xs rounded-lg px-3 py-1.5 font-bold border ${
            activeOnly ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-neutral-600 border-neutral-300"
          }`}
          onClick={() => setActiveOnly((v) => !v)}
        >
          {activeOnly ? "✓ 진행여부 예만" : "진행여부 예만 보기"}
        </button>
        <input
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm w-56"
          placeholder="업체명·제품명·업체코드 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="text-xs bg-neutral-800 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-60"
          onClick={addRow}
          disabled={adding}
        >
          {adding ? "추가 중..." : "+ 새 행 추가"}
        </button>
      </div>

      {loadError && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">
          {loadError}
        </div>
      )}

      <div className="border border-neutral-300 rounded-xl overflow-auto flex-1">
        <table className="text-xs border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] }} />
            ))}
            <col style={{ width: 70 }} />
            <col style={{ width: 36 }} />
          </colgroup>
          <thead className="sticky top-0 bg-neutral-800 text-white z-10">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="relative px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700 overflow-hidden"
                >
                  {c.label}
                  <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-rose-400/70"
                    onMouseDown={(e) => startResize(e, c.key)}
                  />
                </th>
              ))}
              <th className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">가이드</th>
              <th className="px-2 py-2 text-center whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-neutral-200">
                {COLUMNS.map((c) => {
                  if (c.kind === "toggle") {
                    const on = !!r[c.key];
                    return (
                      <td key={c.key} className="px-2 py-1.5 border-r border-neutral-200 text-center overflow-hidden">
                        <button
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            on ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                          }`}
                          onClick={() => toggleBool(r, c.key as "active")}
                          disabled={savingId === r.id}
                        >
                          {on ? "예" : "아니오"}
                        </button>
                      </td>
                    );
                  }
                  if (c.kind === "checked_at") {
                    return (
                      <td key={c.key} className="px-2 py-1.5 border-r border-neutral-200 text-center overflow-hidden">
                        <button
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                            r.checked_at ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                          }`}
                          onClick={() => toggleChecked(r)}
                          disabled={savingId === r.id}
                        >
                          {fmtChecked(r.checked_at)}
                        </button>
                      </td>
                    );
                  }
                  const isEditing = editing?.id === r.id && editing.field === c.key;
                  const val = r[c.key];
                  const isLink = LINK_FIELDS.has(c.key);
                  return (
                    <td
                      key={c.key}
                      className="px-2 py-1.5 border-r border-neutral-200 whitespace-nowrap text-center cursor-text hover:bg-black/5 overflow-hidden text-ellipsis"
                      onClick={() => !isEditing && startEdit(r, c.key)}
                      title={typeof val === "string" ? val : undefined}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          className="w-full min-w-[36px] border border-rose-400 rounded px-1 py-0.5 text-xs outline-none text-center"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : isLink && val ? (
                        <a
                          href={String(val)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          보기
                        </a>
                      ) : c.align === "right" ? (
                        val != null ? Number(val).toLocaleString("ko-KR") : ""
                      ) : (
                        (val as string) ?? ""
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 border-r border-neutral-200 text-center">
                  <button
                    className="bg-rose-500 text-white text-[11px] font-bold rounded-full px-2 py-0.5"
                    onClick={() => setGuideRow(r)}
                  >
                    🌷 생성
                  </button>
                </td>
                <td className="px-2 py-1.5">
                  <button
                    className="text-neutral-400 hover:text-rose-600 font-bold px-1"
                    onClick={() => deleteRow(r.id)}
                    title="행 삭제"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {guideRow && <KakaoGuideModal row={guideRow} onClose={() => setGuideRow(null)} />}
    </div>
  );
}
