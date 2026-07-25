"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { Vendor } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import { codeNameSegment } from "@/lib/storage";

type Field = keyof Vendor;

const COLUMNS: { key: Field; label: string; align?: "right"; defaultWidth: number }[] = [
  { key: "company_code", label: "업체코드", defaultWidth: 90 },
  { key: "company_name", label: "업체명", defaultWidth: 140 },
  { key: "biz_no", label: "사업자번호", defaultWidth: 110 },
  { key: "owner_name", label: "대표자명", defaultWidth: 90 },
  { key: "login_id", label: "아이디(전화번호)", defaultWidth: 140 },
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
  const [sortKey, setSortKey] = useState<Field>("company_code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editing, setEditing] = useState<{ id: string; field: Field } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploadingBizId, setUploadingBizId] = useState<string | null>(null);
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
  type UndoEntry = { id: string; field: Field; prevValue: string | number | null };
  const undoStack = useRef<UndoEntry[][]>([]);

  function undo() {
    const batch = undoStack.current.pop();
    if (!batch) return;
    batch.forEach((entry) => saveField(entry.id, entry.field, entry.prevValue, false));
  }

  function fillDown() {
    const bounds = selectionBounds();
    if (!bounds) return;
    const batch: UndoEntry[] = [];
    for (let ci = bounds.colLo; ci <= bounds.colHi; ci++) {
      const field = colKeys[ci];
      if (!clearableField(field)) continue;
      const topRow = filtered[bounds.rowLo];
      if (!topRow) continue;
      const value = topRow[field] as string | number | null;
      for (let ri = bounds.rowLo + 1; ri <= bounds.rowHi; ri++) {
        const row = filtered[ri];
        if (!row) continue;
        batch.push({ id: row.id, field, prevValue: row[field] as string | number | null });
        saveField(row.id, field, value, false);
      }
    }
    if (batch.length) undoStack.current.push(batch);
  }

  const focusRef = useRef<{ id: string; field: Field } | null>(null);

  function moveSelection(dRow: number, dCol: number, extend = false) {
    const from = focusRef.current || dragAnchor;
    if (!from) return;
    const ri = filtered.findIndex((r) => r.id === from.id);
    const ci = colKeys.indexOf(from.field);
    if (ri === -1 || ci === -1) return;
    const nextRi = Math.min(Math.max(ri + dRow, 0), filtered.length - 1);
    const nextCi = Math.min(Math.max(ci + dCol, 0), colKeys.length - 1);
    const row = filtered[nextRi];
    if (!row) return;
    const field = colKeys[nextCi];
    focusRef.current = { id: row.id, field };
    if (extend && dragAnchor) {
      const rowA = filtered.findIndex((r) => r.id === dragAnchor.id);
      const colA = colKeys.indexOf(dragAnchor.field);
      const [rowLo, rowHi] = rowA <= nextRi ? [rowA, nextRi] : [nextRi, rowA];
      const [colLo, colHi] = colA <= nextCi ? [colA, nextCi] : [nextCi, colA];
      const next = new Set<string>();
      for (let r2 = rowLo; r2 <= rowHi; r2++) {
        for (let c2 = colLo; c2 <= colHi; c2++) next.add(cellKey(filtered[r2].id, colKeys[c2]));
      }
      setSelectedCells(next);
    } else {
      setDragAnchor({ id: row.id, field });
      setSelectedCells(new Set([cellKey(row.id, field)]));
    }
  }

  function startDrag(row: Vendor, field: Field) {
    setDragAnchor({ id: row.id, field });
    focusRef.current = { id: row.id, field };
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
        navigator.clipboard.readText().then((text) => pasteGrid(text));
        return;
      }

      if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey) && !inInput) {
        e.preventDefault();
        undo();
        return;
      }

      if ((e.key === "d" || e.key === "D") && (e.ctrlKey || e.metaKey) && !inInput && selectedCells.size > 1) {
        e.preventDefault();
        fillDown();
        return;
      }

      if (!editing && !inInput && dragAnchor && !e.ctrlKey && !e.metaKey) {
        if (e.key === "Enter") {
          e.preventDefault();
          const row = filtered.find((r) => r.id === dragAnchor.id);
          if (row && !LINK_FIELDS.has(dragAnchor.field)) startEdit(row, dragAnchor.field);
          return;
        }
        if (e.key === "Escape") {
          setSelectedCells(new Set());
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          const dRow = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
          const dCol = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          moveSelection(dRow, dCol, e.shiftKey);
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          moveSelection(0, e.shiftKey ? -1 : 1);
          return;
        }
      }

      if (editing) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (inInput) return;
      if (selectedCells.size > 1) {
        const batch: UndoEntry[] = [];
        selectedCells.forEach((key) => {
          const idx = key.lastIndexOf(":");
          const id = key.slice(0, idx);
          const field = key.slice(idx + 1) as Field;
          if (!clearableField(field)) return;
          const current = rows.find((r) => r.id === id);
          if (!current) return;
          batch.push({ id, field, prevValue: current[field] as string | number | null });
          saveField(id, field, null, false);
        });
        if (batch.length) undoStack.current.push(batch);
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

  function selectWholeRow(row: Vendor, e?: ReactMouseEvent) {
    if (e?.shiftKey && dragAnchor) {
      const rowA = filtered.findIndex((r) => r.id === dragAnchor.id);
      const rowB = filtered.findIndex((r) => r.id === row.id);
      if (rowA !== -1 && rowB !== -1) {
        const [lo, hi] = rowA <= rowB ? [rowA, rowB] : [rowB, rowA];
        const next = new Set<string>();
        for (let ri = lo; ri <= hi; ri++) {
          for (const k of colKeys) next.add(cellKey(filtered[ri].id, k));
        }
        setSelectedCells(next);
        return;
      }
    }
    setDragAnchor({ id: row.id, field: colKeys[0] });
    setSelectedCells(new Set(colKeys.map((k) => cellKey(row.id, k))));
  }

  function toggleSort(key: Field) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = rows;
    if (query) {
      list = list.filter((r) =>
        [r.company_name, r.company_code, r.biz_no, r.owner_name, r.login_id, r.email].join(" ").toLowerCase().includes(query)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (NUMBER_FIELDS.has(sortKey)) return (Number(av) - Number(bv)) * dir;
      return String(av).localeCompare(String(bv), "ko") * dir;
    });
  }, [rows, q, sortKey, sortDir]);

  async function saveField(id: string, field: Field, value: string | number | null, pushUndo = true) {
    if (pushUndo) {
      const current = rows.find((r) => r.id === id);
      if (current) undoStack.current.push([{ id, field, prevValue: current[field] as string | number | null }]);
    }
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
      const row = await createRow();
      if (row) {
        setRows((prev) => [...prev, row]);
        setQ("");
      }
    } finally {
      setAdding(false);
    }
  }

  async function createRow(): Promise<Vendor | null> {
    try {
      const res = await fetch("/api/admin/vendors", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "추가 실패");
        return null;
      }
      return data.row as Vendor;
    } catch {
      alert("추가 중 오류가 발생했습니다");
      return null;
    }
  }

  async function pasteGrid(text: string) {
    if (!dragAnchor) return;
    const lines = text.replace(/\r/g, "").split("\n");
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    const grid = lines.map((line) => line.split("\t"));
    if (!grid.length) return;
    const startRow = filtered.findIndex((r) => r.id === dragAnchor.id);
    const startCol = colKeys.indexOf(dragAnchor.field);
    if (startRow === -1 || startCol === -1) return;
    const localRows = filtered.slice();
    const batch: UndoEntry[] = [];
    for (let ri = 0; ri < grid.length; ri++) {
      let targetRow = localRows[startRow + ri];
      if (!targetRow) {
        const row = await createRow();
        if (!row) break;
        targetRow = row;
        localRows.push(row);
        setRows((prev) => [...prev, row]);
      }
      for (let ci = 0; ci < grid[ri].length; ci++) {
        const field = colKeys[startCol + ci];
        if (!field || !clearableField(field)) continue;
        const raw = grid[ri][ci].trim();
        const value = raw === "" ? null : NUMBER_FIELDS.has(field) ? Number(raw) : raw;
        batch.push({ id: targetRow.id, field, prevValue: targetRow[field] as string | number | null });
        saveField(targetRow.id, field, value, false);
      }
    }
    if (batch.length) undoStack.current.push(batch);
  }

  async function uploadBizFile(row: Vendor, file: File) {
    setUploadingBizId(row.id);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const segment = codeNameSegment(row.company_code, row.company_name);
      const path = `${segment}_bizreg_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("vendor-files")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) {
        alert("업로드 실패: " + upErr.message);
        return;
      }
      const { data: urlData } = supabase.storage.from("vendor-files").getPublicUrl(path);
      await saveField(row.id, "biz_file_url", urlData.publicUrl);
    } finally {
      setUploadingBizId(null);
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
          style={{ tableLayout: "fixed", width: COLUMNS.reduce((sum, c) => sum + (widths[c.key] ?? c.defaultWidth), 36 + 36) }}
        >
          <colgroup>
            <col style={{ width: 36 }} />
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] }} />
            ))}
            <col style={{ width: 36 }} />
          </colgroup>
          <thead className="sticky top-0 bg-neutral-800 text-white z-10">
            <tr>
              <th className="px-1 py-2 text-center border-r border-neutral-700"></th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="relative px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700 overflow-hidden cursor-pointer select-none"
                  onClick={() => toggleSort(c.key)}
                  title="클릭하여 정렬"
                >
                  {c.label}
                  {sortKey === c.key && <span className="ml-0.5">{sortDir === "asc" ? "▲" : "▼"}</span>}
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
            {filtered.map((r, ri) => (
              <tr key={r.id} className="border-b border-neutral-200">
                <td
                  className="px-1 py-1.5 border-r border-neutral-200 text-center text-neutral-400 cursor-pointer hover:bg-neutral-200 select-none"
                  onClick={(e) => selectWholeRow(r, e)}
                >
                  {ri + 1}
                </td>
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
                      onDoubleClick={() => !isEditing && !isLink && startEdit(r, c.key)}
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
                      ) : isLink ? (
                        <label
                          className="text-blue-600 underline cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {uploadingBizId === r.id ? "업로드중..." : "+ 추가"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingBizId === r.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadBizFile(r, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
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
                <td colSpan={COLUMNS.length + 2} className="text-center text-neutral-400 py-8">
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
