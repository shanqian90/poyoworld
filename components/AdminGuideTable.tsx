"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { GuideProduct } from "@/lib/types";
import KakaoGuideModal from "@/components/KakaoGuideModal";
import { fileToDataUrl, readClipboardImageFile } from "@/lib/clipboardImage";
import { todayMMDD } from "@/lib/phone";

type Field = keyof GuideProduct;
type Kind = "text" | "toggle" | "select";

const LINK_FIELDS = new Set<Field>(["image_url", "keyword_url"]);
const SELECT_OPTIONS: Partial<Record<Field, string[]>> = {
  buy_type: ["키워드구매", "링크구매"],
};

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
  { key: "buy_type", label: "구매유형", kind: "select", defaultWidth: 100 },
  { key: "review_type", label: "리뷰가이드", defaultWidth: 140 },
  { key: "delivery", label: "배송형태", defaultWidth: 90 },
  { key: "keyword_url", label: "키워드링크", defaultWidth: 90 },
  { key: "image_url", label: "이미지링크", defaultWidth: 90 },
];


export default function AdminGuideTable({
  rows: initialRows,
  loadError,
  fetchUrl,
}: {
  rows: GuideProduct[];
  loadError: string | null;
  fetchUrl?: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [fetching, setFetching] = useState(!!fetchUrl);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!fetchUrl) return;
    setFetching(true);
    fetch(fetchUrl)
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) {
          setFetchError(data.message || "불러오기 실패");
          return;
        }
        setRows(data.rows || []);
        if (data.loadError) setFetchError(data.loadError);
      })
      .catch(() => setFetchError("불러오는 중 오류가 발생했습니다"))
      .finally(() => setFetching(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: string; field: Field } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [guideRow, setGuideRow] = useState<GuideProduct | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]))
  );
  const [hoverCell, setHoverCell] = useState<{ id: string; field: Field } | null>(null);
  const [dragAnchor, setDragAnchor] = useState<{ id: string; field: Field } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const cellKey = (id: string, field: Field) => `${id}:${field}`;
  const colKeys = COLUMNS.map((c) => c.key);
  const clearableField = (f: Field) => {
    const col = COLUMNS.find((c) => c.key === f);
    return !!col && col.kind !== "toggle" && !LINK_FIELDS.has(f);
  };
  type UndoEntry = { id: string; field: Field; prevValue: string | number | boolean | null };
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
      const value = topRow[field] as string | number | boolean | null;
      for (let ri = bounds.rowLo + 1; ri <= bounds.rowHi; ri++) {
        const row = filtered[ri];
        if (!row) continue;
        batch.push({ id: row.id, field, prevValue: row[field] as string | number | boolean | null });
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

  function startDrag(row: GuideProduct, field: Field) {
    setDragAnchor({ id: row.id, field });
    focusRef.current = { id: row.id, field };
    setIsDragging(true);
    setSelectedCells(new Set([cellKey(row.id, field)]));
  }

  function dragOver(row: GuideProduct, field: Field) {
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
        handlePasteCommand();
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
          const col = COLUMNS.find((c) => c.key === dragAnchor.field);
          if (row && col && col.kind !== "toggle" && !LINK_FIELDS.has(dragAnchor.field)) startEdit(row, dragAnchor.field);
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
          batch.push({ id, field, prevValue: current[field] as string | number | boolean | null });
          saveField(id, field, null, false);
        });
        if (batch.length) undoStack.current.push(batch);
        return;
      }
      if (!hoverCell) return;
      const col = COLUMNS.find((c) => c.key === hoverCell.field);
      if (!col || col.kind === "toggle" || LINK_FIELDS.has(hoverCell.field)) return;
      saveField(hoverCell.id, hoverCell.field, null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverCell, editing, selectedCells, dragAnchor]);

  function selectWholeRow(row: GuideProduct, e?: ReactMouseEvent) {
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
  const [sortKey, setSortKey] = useState<Field | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columnFilters, setColumnFilters] = useState<Partial<Record<Field, Set<string>>>>({});
  const [openFilterKey, setOpenFilterKey] = useState<Field | null>(null);
  const [filterSearch, setFilterSearch] = useState("");

  function toggleSort(key: Field) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function getSelectedSet(key: Field): Set<string> {
    return columnFilters[key] || new Set(distinctValues[key] || []);
  }

  function toggleFilterValue(key: Field, value: string) {
    setColumnFilters((prev) => {
      const current = new Set(prev[key] || distinctValues[key] || []);
      if (current.has(value)) current.delete(value);
      else current.add(value);
      const next = { ...prev };
      if (current.size >= (distinctValues[key]?.length || 0)) delete next[key];
      else next[key] = current;
      return next;
    });
  }

  function selectAllFilter(key: Field) {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function clearAllFilter(key: Field) {
    setColumnFilters((prev) => ({ ...prev, [key]: new Set() }));
  }

  function clearAllFilters() {
    setColumnFilters({});
  }

  const [filterPos, setFilterPos] = useState<{ left: number; top: number } | null>(null);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!openFilterKey) return;
    function onDocClick(e: MouseEvent) {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setOpenFilterKey(null);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openFilterKey]);

  function valueLabel(col: (typeof COLUMNS)[number], row: GuideProduct): string {
    const v = row[col.key];
    if (col.kind === "toggle") return v ? "예" : "아니오";
    if (v == null || v === "") return "(빈 값)";
    return String(v);
  }

  const searched = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeOnly && !r.active) return false;
      if (!query) return true;
      return [r.company, r.short_name, r.full_name, r.code, r.platform].join(" ").toLowerCase().includes(query);
    });
  }, [rows, q, activeOnly]);

  const distinctValues = useMemo(() => {
    const map = {} as Record<Field, string[]>;
    for (const col of COLUMNS) {
      const set = new Set<string>();
      searched.forEach((r) => set.add(valueLabel(col, r)));
      map[col.key] = Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched]);

  const columnFilteredRows = useMemo(() => {
    const keys = Object.keys(columnFilters) as Field[];
    if (!keys.length) return searched;
    return searched.filter((r) =>
      keys.every((k) => {
        const set = columnFilters[k];
        if (!set) return true;
        const col = COLUMNS.find((c) => c.key === k);
        if (!col) return true;
        return set.has(valueLabel(col, r));
      })
    );
  }, [searched, columnFilters]);

  const filtered = useMemo(() => {
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      return [...columnFilteredRows].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
        if (typeof av === "boolean" && typeof bv === "boolean") return (av === bv ? 0 : av ? -1 : 1) * dir;
        return String(av).localeCompare(String(bv), "ko") * dir;
      });
    }
    return columnFilteredRows
      .map((r, i) => ({ r, i }))
      .sort((a, b) => {
        const na = Number(a.r.number_text);
        const nb = Number(b.r.number_text);
        const va = a.r.number_text && !Number.isNaN(na) ? na : Infinity;
        const vb = b.r.number_text && !Number.isNaN(nb) ? nb : Infinity;
        if (va !== vb) return va - vb;
        return a.i - b.i;
      })
      .map((x) => x.r);
  }, [columnFilteredRows, sortKey, sortDir]);

  async function saveField(id: string, field: Field, value: string | number | boolean | null, pushUndo = true) {
    if (pushUndo) {
      const current = rows.find((r) => r.id === id);
      if (current) undoStack.current.push([{ id, field, prevValue: current[field] as string | number | boolean | null }]);
    }
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
      if (field === "option_text" && typeof value === "string" && value.includes("/빈")) {
        saveField(id, "delivery", "빈박스", false);
        saveField(id, "review_fee", "1000", false);
      }
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

  function moveEdit(delta: number) {
    if (!editing) return;
    const field = editing.field;
    const id = editing.id;
    commitEdit();
    const idx = filtered.findIndex((r) => r.id === id);
    const next = filtered[idx + delta];
    if (next) startEdit(next, field);
  }

  async function toggleBool(row: GuideProduct, field: "active") {
    await saveField(row.id, field, !row[field]);
  }

  async function addRow() {
    setAdding(true);
    try {
      const row = await createRow();
      if (row) {
        setRows((prev) => [...prev, row]);
        setQ("");
        setActiveOnly(false);
      }
    } finally {
      setAdding(false);
    }
  }

  const [refreshingPayback, setRefreshingPayback] = useState(false);

  async function refreshPaybackDates() {
    if (!confirm(`진행중(예)인 ${filtered.filter((r) => r.active).length}건의 페이백명을 오늘 날짜(${todayMMDD()})로 변경할까요?`)) return;
    setRefreshingPayback(true);
    const mmdd = todayMMDD();
    const batch: UndoEntry[] = [];
    try {
      for (const row of filtered) {
        if (!row.active || !row.short_name) continue;
        const next = `${mmdd} ${row.short_name}`;
        if (next === row.payback_name) continue;
        batch.push({ id: row.id, field: "payback_name", prevValue: row.payback_name });
        await saveField(row.id, "payback_name", next, false);
      }
      if (batch.length) undoStack.current.push(batch);
    } finally {
      setRefreshingPayback(false);
    }
  }

  const [autofillingId, setAutofillingId] = useState<string | null>(null);
  const [autofillingAll, setAutofillingAll] = useState(false);

  async function runAutofill(row: GuideProduct): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await fetch(`/api/admin/guides/${row.id}/autofill`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) return { ok: false, message: data.message || "자동채우기 실패" };
      if (data.updated && Object.keys(data.updated).length) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...data.updated } : r)));
      }
      return { ok: true, message: data.message };
    } catch {
      return { ok: false, message: "자동채우기 중 오류가 발생했습니다" };
    }
  }

  async function autofillAll() {
    const targets = filtered.filter((r) => r.product_url);
    if (!targets.length) {
      alert("제품링크가 있는 항목이 없습니다");
      return;
    }
    if (!confirm(`제품링크가 있는 ${targets.length}건을 순서대로 자동채우기 할까요?`)) return;
    setAutofillingAll(true);
    let success = 0;
    let failed = 0;
    try {
      for (const row of targets) {
        setAutofillingId(row.id);
        const result = await runAutofill(row);
        if (result.ok) success++;
        else failed++;
      }
    } finally {
      setAutofillingId(null);
      setAutofillingAll(false);
      alert(`✅ 자동채우기 완료: 성공 ${success}건${failed ? `, 실패 ${failed}건` : ""}`);
    }
  }

  async function createRow(): Promise<GuideProduct | null> {
    try {
      const res = await fetch("/api/admin/guides", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "추가 실패");
        return null;
      }
      return data.row as GuideProduct;
    } catch {
      alert("추가 중 오류가 발생했습니다");
      return null;
    }
  }

  async function handlePasteCommand() {
    if (!dragAnchor) return;
    if (dragAnchor.field === "image_url" && selectedCells.size <= 1) {
      const file = await readClipboardImageFile(`guide_${dragAnchor.id}`);
      if (file) {
        const row = filtered.find((r) => r.id === dragAnchor.id);
        if (row) await pasteImageToRow(row);
        return;
      }
    }
    const text = await navigator.clipboard.readText();
    pasteGrid(text);
  }

  async function pasteImageToRow(row: GuideProduct) {
    const file = await readClipboardImageFile(`guide_${row.id}`);
    if (!file) return;
    setSavingId(row.id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch(`/api/admin/guides/${row.id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "이미지 업로드 실패");
        return;
      }
      undoStack.current.push([{ id: row.id, field: "image_url", prevValue: row.image_url }]);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, image_url: data.url } : r)));
    } catch {
      alert("이미지 업로드 중 오류가 발생했습니다");
    } finally {
      setSavingId(null);
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
        const value = raw === "" ? null : field === "price" ? Number(raw) : raw;
        batch.push({ id: targetRow.id, field, prevValue: targetRow[field] as string | number | boolean | null });
        saveField(targetRow.id, field, value, false);
      }
    }
    if (batch.length) undoStack.current.push(batch);
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
        {Object.keys(columnFilters).length > 0 && (
          <button
            className="text-xs bg-rose-100 text-rose-700 rounded-lg px-3 py-1.5 font-bold border border-rose-300"
            onClick={clearAllFilters}
          >
            ✕ 필터 초기화 ({Object.keys(columnFilters).length})
          </button>
        )}
        <button
          className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-60"
          onClick={autofillAll}
          disabled={autofillingAll || autofillingId !== null}
        >
          {autofillingAll ? "채우는 중..." : "🔗 전체 자동채우기"}
        </button>
        <button
          className="text-xs bg-amber-600 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-60"
          onClick={refreshPaybackDates}
          disabled={refreshingPayback}
        >
          {refreshingPayback ? "변경 중..." : `💳 페이백명 오늘 날짜로 (${todayMMDD()})`}
        </button>
        <button
          className="text-xs bg-neutral-800 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-60"
          onClick={addRow}
          disabled={adding}
        >
          {adding ? "추가 중..." : "+ 새 행 추가"}
        </button>
      </div>

      {(loadError || fetchError) && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">
          {loadError || fetchError}
        </div>
      )}
      {fetching && <div className="text-center text-sm text-neutral-500 font-bold py-2">🌸 불러오는 중...</div>}

      <div className="border border-neutral-300 rounded-xl overflow-auto flex-1">
        <table
          className="text-xs border-collapse"
          style={{ tableLayout: "fixed", width: COLUMNS.reduce((sum, c) => sum + (widths[c.key] ?? c.defaultWidth), 70 + 36 + 36) }}
        >
          <colgroup>
            <col style={{ width: 36 }} />
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] }} />
            ))}
            <col style={{ width: 70 }} />
            <col style={{ width: 36 }} />
          </colgroup>
          <thead className="sticky top-0 bg-neutral-800 text-white z-10">
            <tr>
              <th className="px-1 py-2 text-center border-r border-neutral-700"></th>
              {COLUMNS.map((c) => {
                const hasFilter = !!columnFilters[c.key];
                return (
                  <th key={c.key} className="relative px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">
                    <span className="cursor-pointer select-none hover:underline" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      {sortKey === c.key && <span className="ml-0.5">{sortDir === "asc" ? "▲" : "▼"}</span>}
                    </span>
                    <button
                      className={`ml-1 text-[10px] leading-none align-middle ${
                        hasFilter ? "text-amber-400" : "text-neutral-400 hover:text-white"
                      }`}
                      title="필터"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openFilterKey === c.key) {
                          setOpenFilterKey(null);
                          return;
                        }
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setFilterPos({ left: rect.left, top: rect.bottom + 4 });
                        setFilterSearch("");
                        setOpenFilterKey(c.key);
                      }}
                    >
                      ▾
                    </button>
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-rose-400/70"
                      onMouseDown={(e) => startResize(e, c.key)}
                    />
                  </th>
                );
              })}
              <th className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">가이드</th>
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
                  if (c.kind === "toggle") {
                    const on = !!r[c.key];
                    return (
                      <td
                        key={c.key}
                        className={`px-2 py-1.5 border-r border-b border-neutral-300 text-center overflow-hidden cursor-pointer font-bold text-xs ${
                          on ? "bg-emerald-400 text-white" : "bg-neutral-50 text-neutral-400"
                        }`}
                        onClick={() => toggleBool(r, c.key as "active")}
                      >
                        {savingId === r.id ? "..." : on ? "예" : "아니오"}
                      </td>
                    );
                  }
                  if (c.kind === "select") {
                    const options = SELECT_OPTIONS[c.key] || [];
                    const val = (r[c.key] as string) ?? "";
                    return (
                      <td key={c.key} className="px-2 py-1.5 border-r border-neutral-200 text-center overflow-hidden">
                        <select
                          className="w-full border border-neutral-300 rounded px-1 py-0.5 text-xs outline-none text-center bg-white"
                          value={val}
                          onChange={(e) => saveField(r.id, c.key, e.target.value || null)}
                          disabled={savingId === r.id}
                        >
                          <option value="">-</option>
                          {options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  }
                  const isEditing = editing?.id === r.id && editing.field === c.key;
                  const val = r[c.key];
                  const isLink = LINK_FIELDS.has(c.key);
                  const isSelected = selectedCells.has(cellKey(r.id, c.key));
                  return (
                    <td
                      key={c.key}
                      className={`px-2 py-1.5 border-r border-neutral-200 text-center cursor-text hover:bg-black/5 select-none ${
                        c.key === "note" ? "whitespace-pre-line" : "whitespace-nowrap overflow-hidden text-ellipsis"
                      }`}
                      style={{ boxShadow: isSelected ? "inset 0 0 0 2px #2563eb" : undefined }}
                      onDoubleClick={() => !isEditing && startEdit(r, c.key)}
                      onMouseDown={() => startDrag(r, c.key)}
                      onMouseEnter={() => {
                        setHoverCell({ id: r.id, field: c.key });
                        dragOver(r, c.key);
                      }}
                      onMouseLeave={() => setHoverCell((h) => (h && h.id === r.id && h.field === c.key ? null : h))}
                      title={typeof val === "string" ? val : undefined}
                    >
                      {isEditing && c.key === "note" ? (
                        <textarea
                          autoFocus
                          rows={3}
                          className="w-full min-w-[120px] border border-rose-400 rounded px-1 py-0.5 text-xs outline-none text-left resize-y"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : isEditing ? (
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
                <td
                  className="px-2 py-1.5 border-r border-neutral-200 text-center cursor-pointer bg-rose-500 text-white font-bold text-xs"
                  onClick={() => setGuideRow(r)}
                >
                  생성
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

      {openFilterKey && filterPos && (
        <div
          ref={filterPanelRef}
          className="fixed z-50 bg-white border border-neutral-300 rounded-lg shadow-xl w-56 max-h-80 flex flex-col text-xs text-neutral-800"
          style={{ left: filterPos.left, top: filterPos.top }}
        >
          <div className="p-2 border-b border-neutral-200">
            <input
              autoFocus
              className="w-full border border-neutral-300 rounded px-2 py-1 text-xs"
              placeholder="값 검색"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-100 text-neutral-500">
            <button className="hover:underline" onClick={() => selectAllFilter(openFilterKey)}>
              전체 선택
            </button>
            <button className="hover:underline" onClick={() => clearAllFilter(openFilterKey)}>
              전체 해제
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            {(distinctValues[openFilterKey] || [])
              .filter((v) => v.toLowerCase().includes(filterSearch.toLowerCase()))
              .map((v) => {
                const selected = getSelectedSet(openFilterKey).has(v);
                return (
                  <label
                    key={v}
                    className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-neutral-100 cursor-pointer"
                  >
                    <input type="checkbox" checked={selected} onChange={() => toggleFilterValue(openFilterKey, v)} />
                    <span className="truncate">{v}</span>
                  </label>
                );
              })}
            {!(distinctValues[openFilterKey] || []).length && (
              <div className="text-center text-neutral-400 py-3">값이 없습니다</div>
            )}
          </div>
          <div className="p-1.5 border-t border-neutral-200 text-right">
            <button
              className="text-emerald-700 font-bold px-2 py-1 hover:underline"
              onClick={() => setOpenFilterKey(null)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
