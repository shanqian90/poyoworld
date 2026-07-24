"use client";

import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { Vendor } from "@/lib/types";

type Field = keyof Vendor;

const COLUMNS: { key: Field; label: string; align?: "right"; defaultWidth: number }[] = [
  { key: "company_code", label: "업체코드", defaultWidth: 90 },
  { key: "company_name", label: "업체명", defaultWidth: 140 },
  { key: "biz_no", label: "사업자번호", defaultWidth: 110 },
  { key: "owner_name", label: "대표자명", defaultWidth: 90 },
  { key: "login_id", label: "아이디(전화/이메일)", defaultWidth: 140 },
  { key: "email", label: "이메일", defaultWidth: 160 },
  { key: "real_ship_price", label: "실배송 단가", align: "right", defaultWidth: 90 },
  { key: "empty_box_price", label: "빈박스 단가", align: "right", defaultWidth: 90 },
  { key: "biz_file_url", label: "사업자등록증", defaultWidth: 90 },
];

const LINK_FIELDS = new Set<Field>(["biz_file_url"]);
const NUMBER_FIELDS = new Set<Field>(["real_ship_price", "empty_box_price"]);

export default function AdminVendorsTable({
  rows: initialRows,
  loadError,
}: {
  rows: Vendor[];
  loadError: string | null;
}) {
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: string; field: Field } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [hoverCell, setHoverCell] = useState<{ id: string; field: Field } | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]))
  );
  const [dragAnchor, setDragAnchor] = useState<{ id: string; field: Field } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const cellKey = (id: string, field: Field) => `${id}:${field}`;
  const colKeys = COLUMNS.map((c) => c.key);
  const clearableField = (f: Field) => !LINK_FIELDS.has(f);

  function startDrag(row: Vendor, field: Field) {
    setDragAnchor({ id: row.id, field });
    setIsDragging(true);
    setSelectedCells(new Set([cellKey(row.id, field)]));
  }

  function dragOver(row: Vendor, field: Field) {
    if (!isDragging || !dragAnchor) return;
    const rowA = filtered.findIndex((r) => r.id === dragAnchor.id);
    const rowB = filtered.findIndex((r) => r.id === row.id);
    const colA = colKeys.indexOf(dragAnchor.field);
    const colB = colKeys.indexOf(field);
    const [rowLo, rowHi] = rowA <= rowB ? [rowA, rowB] : [rowB, rowA];
    const [colLo, colHi] = colA <= colB ? [colA, colB] : [colB, colA];
    const next = new Set<string>();
    for (let ri = rowLo; ri <= rowHi; ri++) {
      for (let ci = colLo; ci <= colHi; ci++) next.add(cellKey(filtered[ri].id, colKeys[ci]));
    }
    setSelectedCells(next);
  }

  useEffect(() => {
    function onUp() {
      setIsDragging(false);
    }
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  function selectionBounds() {
    if (!selectedCells.size) return null;
    let rowLo = Infinity, rowHi = -Infinity, colLo = Infinity, colHi = -Infinity;
    selectedCells.forEach((key) => {
      const idx = key.lastIndexOf(":");
      const id = key.slice(0, idx);
      const field = key.slice(idx + 1) as Field;
      const ri = filtered.findIndex((r) => r.id === id);
      const ci = colKeys.indexOf(field);
      if (ri < rowLo) rowLo = ri;
      if (ri > rowHi) rowHi = ri;
      if (ci < colLo) colLo = ci;
      if (ci > colHi) colHi = ci;
    });
    return { rowLo, rowHi, colLo, colHi };
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if ((e.key === "c" || e.key === "C") && (e.ctrlKey || e.metaKey) && !inInput && selectedCells.size > 0) {
        const bounds = selectionBounds();
        if (!bounds) return;
        const lines: string[] = [];
        for (let ri = bounds.rowLo; ri <= bounds.rowHi; ri++) {
          const cells: string[] = [];
          for (let ci = bounds.colLo; ci <= bounds.colHi; ci++) {
            const v = filtered[ri][colKeys[ci]];
            cells.push(v == null ? "" : String(v));
          }
          lines.push(cells.join("\t"));
        }
        navigator.clipboard.writeText(lines.join("\n"));
        return;
      }

      if ((e.key === "v" || e.key === "V") && (e.ctrlKey || e.metaKey) && !inInput && dragAnchor) {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          const grid = text.replace(/\r/g, "").split("\n").map((line) => line.split("\t"));
          const startRow = filtered.findIndex((r) => r.id === dragAnchor.id);
          const startCol = colKeys.indexOf(dragAnchor.field);
          if (startRow === -1 || startCol === -1) return;
          for (let ri = 0; ri < grid.length; ri++) {
            const targetRow = filtered[startRow + ri];
            if (!targetRow) break;
            for (let ci = 0; ci < grid[ri].length; ci++) {
              const field = colKeys[startCol + ci];
              if (!field || !clearableField(field)) continue;
              const raw = grid[ri][ci].trim();
              const value = raw === "" ? null : NUMBER_FIELDS.has(field) ? Number(raw) : raw;
              saveField(targetRow.id, field, value);
            }
          }
        });
        return;
      }

      if (editing) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (inInput) return;
      if (selectedCells.size > 1) {
        selectedCells.forEach((key) => {
          const idx = key.lastIndexOf(":");
          const id = key.slice(0, idx);
          const field = key.slice(idx + 1) as Field;
          if (clearableField(field)) saveField(id, field, null);
        });
        return;
      }
      if (!hoverCell) return;
      if (LINK_FIELDS.has(hoverCell.field)) return;
      saveField(hoverCell.id, hoverCell.field, null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverCell, editing, selectedCells, dragAnchor]);

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

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) =>
      [r.company_name, r.company_code, r.biz_no, r.owner_name, r.login_id, r.email].join(" ").toLowerCase().includes(query)
    );
  }, [rows, q]);

  async function saveField(id: string, field: Field, value: string | number | null) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/vendors/${id}`, {
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

  function startEdit(row: Vendor, field: Field) {
    setEditing({ id: row.id, field });
    const v = row[field];
    setEditValue(v == null ? "" : String(v));
  }

  function commitEdit() {
    if (!editing) return;
    const field = editing.field;
    const raw = editValue.trim();
    const value = raw === "" ? null : NUMBER_FIELDS.has(field) ? Number(raw) : raw;
    saveField(editing.id, field, value);
    setEditing(null);
  }

  function cancelEdit() {
    setEditing(null);
  }

  function moveEdit(delta: number) {
    if (!editing) return;
    const field = editing.field;
    const id = editing.id;
    commitEdit();
    const idx = filtered.findIndex((r) => r.id === id);
    const next = filtered[idx + delta];
    if (next) startEdit(next, field);
  }

  async function addRow() {
    setAdding(true);
    try {
      const res = await fetch("/api/admin/vendors", { method: "POST" });
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
    if (!confirm("이 업체를 삭제할까요?")) return;
    const res = await fetch(`/api/admin/vendors/${id}`, { method: "DELETE" });
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
        <Link href="/admin/requests" className="text-sm font-bold text-neutral-500 underline">
          ← 작업요청서
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">🏢 업체리스트</div>
        <span className="text-xs text-neutral-500">{filtered.length.toLocaleString("ko-KR")}건</span>
        <span className="text-xs text-neutral-400">셀을 클릭하면 바로 수정, 칸에 마우스 올리고 Delete로 지우기</span>
        <div className="flex-1" />
        <input
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm w-64"
          placeholder="업체명·업체코드·사업자번호·대표자명·아이디 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="text-xs bg-neutral-800 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-60"
          onClick={addRow}
          disabled={adding}
        >
          {adding ? "추가 중..." : "+ 새 업체 추가"}
        </button>
      </div>

      {loadError && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">{loadError}</div>
      )}

      <div className="border border-neutral-300 rounded-xl overflow-auto flex-1">
        <table
          className="text-xs border-collapse"
          style={{ tableLayout: "fixed", width: COLUMNS.reduce((sum, c) => sum + (widths[c.key] ?? c.defaultWidth), 36) }}
        >
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] }} />
            ))}
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
              <th className="px-2 py-2 text-center whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-neutral-200">
                {COLUMNS.map((c) => {
                  const isEditing = editing?.id === r.id && editing.field === c.key;
                  const val = r[c.key];
                  const isLink = LINK_FIELDS.has(c.key);
                  const isSelected = selectedCells.has(cellKey(r.id, c.key));
                  return (
                    <td
                      key={c.key}
                      className="px-2 py-1.5 border-r border-neutral-200 whitespace-nowrap text-center cursor-text hover:bg-black/5 overflow-hidden text-ellipsis select-none"
                      style={{ boxShadow: isSelected ? "inset 0 0 0 2px #2563eb" : undefined }}
                      onClick={() => !isEditing && !isLink && startEdit(r, c.key)}
                      onMouseDown={() => startDrag(r, c.key)}
                      onMouseEnter={() => {
                        setHoverCell({ id: r.id, field: c.key });
                        dragOver(r, c.key);
                      }}
                      onMouseLeave={() => setHoverCell((h) => (h && h.id === r.id && h.field === c.key ? null : h))}
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
                            else if (e.key === "Escape") cancelEdit();
                            else if (e.key === "ArrowDown") {
                              e.preventDefault();
                              moveEdit(1);
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              moveEdit(-1);
                            }
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
                <td className="px-2 py-1.5">
                  <button
                    className="text-neutral-400 hover:text-rose-600 font-bold px-1"
                    onClick={() => deleteRow(r.id)}
                    title="업체 삭제"
                    disabled={savingId === r.id}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="text-center text-neutral-400 py-8">
                  업체가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
