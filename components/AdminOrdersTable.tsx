"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { computeKFlags, computeAddressDupFlags, computeBatchCompleteFlags, K_FLAG_INFO, ADDRESS_DUP_COLOR, BATCH_COMPLETE_COLOR } from "@/lib/mainFlags";
import { fileToDataUrl, readClipboardImageFile } from "@/lib/clipboardImage";

export type AdminOrderRow = {
  id: number;
  seq: string | null;
  date_mmdd: string;
  company_code: string | null;
  company_name: string | null;
  platform: string | null;
  product_url: string | null;
  product_name: string;
  option_text: string;
  review_type: string | null;
  review_url: string | null;
  manager: string | null;
  real_manager: string | null;
  order_image: string | null;
  order_no: string | null;
  buyer: string | null;
  receiver: string | null;
  user_id: string | null;
  phone: string | null;
  address: string | null;
  account_text: string | null;
  amount: number | null;
  review_fee: number;
  review_done: boolean;
  paid: boolean;
  paid_date: string | null;
  company_paid: string | null;
  delivery: string | null;
  tracking: string | null;
  remark: string | null;
  created_at: string;
  hidden_from_active: boolean;
  full_date: string | null;
  _group: "a" | "b" | null;
};

type Field = keyof AdminOrderRow;
type Kind = "text" | "toggle";

function fmt(n: number | null) {
  return (n || 0).toLocaleString("ko-KR");
}

function formatPaidDate(value: string) {
  const m = value.match(/^\d{4}-(\d{1,2})-(\d{1,2})/);
  if (m) return `${Number(m[1])}/${Number(m[2])}`;
  return value;
}

const LINK_FIELDS = new Set<Field>(["product_url", "review_url", "order_image"]);
const TOGGLE_LABELS: Partial<Record<Field, [string, string]>> = {
  review_done: ["완료", "미완료"],
  paid: ["완료", "대기"],
};

const COLUMNS: { key: Field; label: string; align?: "right"; kind?: Kind; defaultWidth: number }[] = [
  { key: "seq", label: "순번", defaultWidth: 60 },
  { key: "date_mmdd", label: "날짜", defaultWidth: 60 },
  { key: "company_code", label: "업체코드", defaultWidth: 80 },
  { key: "company_name", label: "업체명", defaultWidth: 110 },
  { key: "platform", label: "플랫폼명", defaultWidth: 80 },
  { key: "product_url", label: "제품URL", defaultWidth: 90 },
  { key: "product_name", label: "제품명", defaultWidth: 140 },
  { key: "option_text", label: "구매옵션", defaultWidth: 110 },
  { key: "review_type", label: "리뷰종류", defaultWidth: 90 },
  { key: "review_url", label: "리뷰이미지", defaultWidth: 90 },
  { key: "manager", label: "예정", defaultWidth: 70 },
  { key: "real_manager", label: "실진행", defaultWidth: 70 },
  { key: "order_image", label: "구매이미지", defaultWidth: 90 },
  { key: "order_no", label: "주문번호", defaultWidth: 130 },
  { key: "buyer", label: "구매자", defaultWidth: 80 },
  { key: "receiver", label: "수취인", defaultWidth: 80 },
  { key: "user_id", label: "아이디", defaultWidth: 90 },
  { key: "phone", label: "전화번호", defaultWidth: 110 },
  { key: "address", label: "주소", defaultWidth: 160 },
  { key: "account_text", label: "계좌", defaultWidth: 150 },
  { key: "amount", label: "금액", align: "right", defaultWidth: 80 },
  { key: "review_fee", label: "리뷰금액", align: "right", defaultWidth: 80 },
  { key: "review_done", label: "리뷰작성", kind: "toggle", defaultWidth: 70 },
  { key: "paid", label: "입금", kind: "toggle", defaultWidth: 70 },
  { key: "paid_date", label: "입금일", defaultWidth: 90 },
  { key: "company_paid", label: "업체입금(입금자명)", defaultWidth: 100 },
  { key: "delivery", label: "택배대행", defaultWidth: 90 },
  { key: "tracking", label: "운송장번호", defaultWidth: 110 },
];

const TOGGLE_KEYS = new Set<Field>(COLUMNS.filter((c) => c.kind === "toggle").map((c) => c.key));

export default function AdminOrdersTable({
  rows: initialRows,
  loadError,
  mode = "full",
  title = "📋 메인 전체보기",
}: {
  rows: AdminOrderRow[];
  loadError: string | null;
  mode?: "full" | "active";
  title?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [editing, setEditing] = useState<{ id: number; field: Field } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]))
  );
  const now = new Date();
  const [bulkYear, setBulkYear] = useState(now.getFullYear());
  const [bulkMonth, setBulkMonth] = useState(now.getMonth() + 1);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState<
    { row: AdminOrderRow; index: number; timer: ReturnType<typeof setTimeout> }[]
  >([]);

  const [hoverCell, setHoverCell] = useState<{ id: number; field: Field } | null>(null);

  const [dragAnchor, setDragAnchor] = useState<{ id: number; field: Field } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const cellKey = (id: number, field: Field) => `${id}:${field}`;
  const clearableField = (f: Field) => !TOGGLE_KEYS.has(f) && !LINK_FIELDS.has(f) && f !== "seq";
  const colKeys = COLUMNS.map((c) => c.key);
  type UndoEntry = { id: number; field: Field; prevValue: string | number | boolean | null };
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

  const focusRef = useRef<{ id: number; field: Field } | null>(null);

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

  function startDrag(row: AdminOrderRow, field: Field) {
    setDragAnchor({ id: row.id, field });
    focusRef.current = { id: row.id, field };
    setIsDragging(true);
    setSelectedCells(new Set([cellKey(row.id, field)]));
  }

  function dragOver(row: AdminOrderRow, field: Field) {
    if (!isDragging || !dragAnchor) return;
    const rowA = filtered.findIndex((r) => r.id === dragAnchor.id);
    const rowB = filtered.findIndex((r) => r.id === row.id);
    const colA = colKeys.indexOf(dragAnchor.field);
    const colB = colKeys.indexOf(field);
    const [rowLo, rowHi] = rowA <= rowB ? [rowA, rowB] : [rowB, rowA];
    const [colLo, colHi] = colA <= colB ? [colA, colB] : [colB, colA];
    const next = new Set<string>();
    for (let ri = rowLo; ri <= rowHi; ri++) {
      for (let ci = colLo; ci <= colHi; ci++) {
        next.add(cellKey(filtered[ri].id, colKeys[ci]));
      }
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
      const id = Number(key.slice(0, idx));
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
            const row = filtered[ri];
            const field = colKeys[ci];
            const v = row[field];
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
          if (row) startEdit(row, dragAnchor.field);
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
          const id = Number(key.slice(0, idx));
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
      if (!clearableField(hoverCell.field)) return;
      saveField(hoverCell.id, hoverCell.field, null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverCell, editing, selectedCells, dragAnchor]);

  type NameEntry = { id: string; value: string };
  const [blacklistNames, setBlacklistNames] = useState<NameEntry[]>([]);
  const [whitelistNames, setWhitelistNames] = useState<NameEntry[]>([]);
  const [showNameManager, setShowNameManager] = useState(false);

  useEffect(() => {
    loadNameLists();
  }, []);

  async function loadNameLists() {
    try {
      const res = await fetch("/api/admin/name-list");
      const data = await res.json();
      if (data.ok) {
        setBlacklistNames(data.blacklist || []);
        setWhitelistNames(data.whitelist || []);
      }
    } catch {
      /* 무시 - 목록 없이도 표는 동작 */
    }
  }

  const blacklistSet = useMemo(() => new Set(blacklistNames.map((n) => n.value)), [blacklistNames]);
  const whitelistSet = useMemo(() => new Set(whitelistNames.map((n) => n.value)), [whitelistNames]);
  const kFlags = useMemo(() => computeKFlags(rows, blacklistSet, whitelistSet), [rows, blacklistSet, whitelistSet]);
  const addressDupFlags = useMemo(() => computeAddressDupFlags(rows), [rows]);
  const batchCompleteFlags = useMemo(() => computeBatchCompleteFlags(rows), [rows]);

  function selectWholeRow(row: AdminOrderRow, e?: ReactMouseEvent) {
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

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const date = dateFilter.trim();
    return rows.filter((r) => {
      if (date && r.date_mmdd !== date) return false;
      if (!query) return true;
      const hay = [r.company_name, r.product_name, r.order_no, r.buyer, r.receiver, r.phone, r.address, r.tracking]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [rows, q, dateFilter]);

  async function saveField(id: number, field: Field, value: string | number | boolean | null, pushUndo = true) {
    if (pushUndo) {
      const current = rows.find((r) => r.id === id);
      if (current) undoStack.current.push([{ id, field, prevValue: current[field] as string | number | boolean | null }]);
    }
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "저장 실패");
        return;
      }
      if (field === "full_date" && typeof value === "string") {
        const m = value.match(/^\d{4}-(\d{2})-(\d{2})$/);
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, full_date: value, date_mmdd: m ? `${m[1]}${m[2]}` : r.date_mmdd } : r))
        );
      } else {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
      }
    } catch {
      alert("저장 중 오류가 발생했습니다");
    } finally {
      setSavingId(null);
    }
  }

  function guessFullDate(row: AdminOrderRow): string {
    if (row.full_date) return row.full_date;
    const m = String(row.date_mmdd || "").match(/^(\d{2})(\d{2})$/);
    const year = row.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear();
    if (!m) return "";
    return `${year}-${m[1]}-${m[2]}`;
  }

  function startEdit(row: AdminOrderRow, field: Field) {
    setEditing({ id: row.id, field });
    if (field === "date_mmdd") {
      setEditValue(guessFullDate(row));
      return;
    }
    const v = row[field];
    setEditValue(v == null ? "" : String(v));
  }

  function commitEdit() {
    if (!editing) return;
    const field = editing.field;
    if (field === "date_mmdd") {
      if (editValue) saveField(editing.id, "full_date", editValue);
      setEditing(null);
      return;
    }
    const raw = editValue.trim();
    const value = raw === "" ? null : field === "amount" || field === "review_fee" ? Number(raw) : raw;
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

  async function toggleBool(row: AdminOrderRow, field: "paid" | "review_done") {
    const next = !row[field];
    await saveField(row.id, field, next);
    if (field === "paid") {
      const todayStr = new Date().toISOString().slice(0, 10);
      await saveField(row.id, "paid_date", next ? todayStr : null, false);
    }
  }

  async function doLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const [adding, setAdding] = useState(false);

  async function addRow() {
    setAdding(true);
    try {
      const row = await createRow();
      if (row) {
        setRows((prev) => [...prev, row]);
        setQ("");
        setDateFilter("");
      }
    } finally {
      setAdding(false);
    }
  }

  async function createRow(): Promise<AdminOrderRow | null> {
    try {
      const res = await fetch("/api/admin/orders", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "추가 실패");
        return null;
      }
      return { ...data.row, _group: null };
    } catch {
      alert("추가 중 오류가 발생했습니다");
      return null;
    }
  }

  const IMAGE_UPLOAD_FIELDS = new Set<Field>(["order_image", "review_url"]);

  async function handlePasteCommand() {
    if (!dragAnchor) return;
    if (IMAGE_UPLOAD_FIELDS.has(dragAnchor.field) && selectedCells.size <= 1) {
      const file = await readClipboardImageFile(`order_${dragAnchor.id}`);
      if (file) {
        const row = filtered.find((r) => r.id === dragAnchor.id);
        if (row) await pasteImageToRow(row, dragAnchor.field);
        return;
      }
    }
    const text = await navigator.clipboard.readText();
    pasteGrid(text);
  }

  async function pasteImageToRow(row: AdminOrderRow, field: Field) {
    const file = await readClipboardImageFile(`order_${row.id}`);
    if (!file) return;
    setSavingId(row.id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch(`/api/admin/orders/${row.id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, imageDataUrl: dataUrl }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "이미지 업로드 실패");
        return;
      }
      undoStack.current.push([{ id: row.id, field, prevValue: row[field] as string | number | boolean | null }]);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [field]: data.url } : r)));
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
        const value = raw === "" ? null : field === "amount" || field === "review_fee" ? Number(raw) : raw;
        batch.push({ id: targetRow.id, field, prevValue: targetRow[field] as string | number | boolean | null });
        saveField(targetRow.id, field, value, false);
      }
    }
    if (batch.length) undoStack.current.push(batch);
  }

  function deleteRow(id: number) {
    const index = rows.findIndex((r) => r.id === id);
    if (index === -1) return;
    const row = rows[index];
    setRows((prev) => prev.filter((r) => r.id !== id));
    const timer = setTimeout(async () => {
      setPendingDeletes((prev) => prev.filter((p) => p.row.id !== id));
      const res =
        mode === "active"
          ? await fetch(`/api/admin/orders/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ field: "hidden_from_active", value: true }),
            })
          : await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "삭제 실패");
        setRows((prev) => {
          const next = [...prev];
          next.splice(index, 0, row);
          return next;
        });
      }
    }, 5000);
    setPendingDeletes((prev) => [...prev, { row, index, timer }]);
  }

  function resolvedDate(row: AdminOrderRow): Date {
    return new Date(row.full_date || row.created_at);
  }

  const availableYearMonths = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const d = resolvedDate(r);
      set.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    });
    return set;
  }, [rows]);
  const availableYears = useMemo(
    () => Array.from(new Set(Array.from(availableYearMonths).map((k) => Number(k.split("-")[0])))).sort((a, b) => b - a),
    [availableYearMonths]
  );
  const availableMonthsForYear = useMemo(
    () =>
      Array.from(availableYearMonths)
        .filter((k) => Number(k.split("-")[0]) === bulkYear)
        .map((k) => Number(k.split("-")[1]))
        .sort((a, b) => a - b),
    [availableYearMonths, bulkYear]
  );

  useEffect(() => {
    if (!availableYears.length) return;
    if (!availableYears.includes(bulkYear)) setBulkYear(availableYears[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableYears]);

  useEffect(() => {
    if (!availableMonthsForYear.length) return;
    if (!availableMonthsForYear.includes(bulkMonth)) setBulkMonth(availableMonthsForYear[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableMonthsForYear]);

  async function bulkDeleteMonth() {
    const count = rows.filter((r) => {
      const d = resolvedDate(r);
      return d.getFullYear() === bulkYear && d.getMonth() + 1 === bulkMonth;
    }).length;
    if (!count) {
      alert(`${bulkYear}년 ${bulkMonth}월 진행건이 없습니다`);
      return;
    }
    if (!confirm(`${bulkYear}년 ${bulkMonth}월 진행건 ${count}건을 전체 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return;
    const pw = prompt("삭제하려면 비밀번호를 입력하세요");
    if (pw === null) return;
    if (pw !== "0596") {
      alert("비밀번호가 올바르지 않습니다");
      return;
    }
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/orders/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: bulkYear, month: bulkMonth }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "삭제 실패");
        return;
      }
      setRows((prev) =>
        prev.filter((r) => {
          const d = resolvedDate(r);
          return !(d.getFullYear() === bulkYear && d.getMonth() + 1 === bulkMonth);
        })
      );
      alert(`✅ ${data.deleted}건 삭제되었습니다`);
    } finally {
      setBulkDeleting(false);
    }
  }

  function undoDelete(id: number) {
    setPendingDeletes((prev) => {
      const found = prev.find((p) => p.row.id === id);
      if (found) {
        clearTimeout(found.timer);
        setRows((r) => {
          const next = [...r];
          next.splice(Math.min(found.index, next.length), 0, found.row);
          return next;
        });
      }
      return prev.filter((p) => p.row.id !== id);
    });
  }

  const [reviewCompleteMsgs, setReviewCompleteMsgs] = useState<{ key: string; company: string; product: string; msg: string }[] | null>(null);
  const [checkingReview, setCheckingReview] = useState(false);

  function fmtStartDay(mmdd: string) {
    if (!mmdd || mmdd.length !== 4) return mmdd;
    return `${Number(mmdd.slice(0, 2))}/${mmdd.slice(2)}`;
  }

  async function checkReviewComplete() {
    setCheckingReview(true);
    try {
      const groups = new Map<string, { code: string; company: string; product: string; total: number; done: number; minMmdd: string }>();
      for (const r of rows) {
        const orderNo = (r.order_no || "").trim();
        if (!orderNo) continue; // 예정 슬롯 제외
        const code = (r.company_code || "").trim();
        const company = (r.company_name || "").trim();
        const product = (r.product_name || "").trim();
        if (!code || !product) continue;
        const key = `${code}|${company}|${product}`;
        if (!groups.has(key)) groups.set(key, { code, company, product, total: 0, done: 0, minMmdd: r.date_mmdd });
        const g = groups.get(key)!;
        g.total++;
        if (r.review_done) g.done++;
        if (r.date_mmdd && r.date_mmdd < g.minMmdd) g.minMmdd = r.date_mmdd;
      }

      const completed = Array.from(groups.entries())
        .filter(([, g]) => g.total > 0 && g.done === g.total)
        .map(([key, g]) => ({ key, ...g }));

      if (!completed.length) {
        alert("아직 전체 완료된 제품이 없습니다");
        return;
      }

      const res = await fetch("/api/admin/review-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groups: completed.map((g) => ({ key: g.key, code: g.code, company: g.company, product: g.product, startMmdd: g.minMmdd })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "확인 실패");
        return;
      }
      const fresh: { key: string; code: string; company: string; product: string; startMmdd: string }[] = data.fresh || [];
      if (!fresh.length) {
        alert("새로 완료된 제품이 없습니다\n(이전에 확인한 건은 제외됩니다)");
        return;
      }
      setReviewCompleteMsgs(
        fresh.map((g) => ({
          key: g.key,
          company: `${g.code} ${g.company}`,
          product: g.product,
          msg: `${fmtStartDay(g.startMmdd)}에 맡겨주신 ${g.product} 리뷰 전체완료 했습니다`,
        }))
      );
    } finally {
      setCheckingReview(false);
    }
  }

  const SUPABASE_PROJECT_REF = "gbbwqubgujfuoolvedbq";
  const IMAGE_FOLDER_LINKS = [
    { label: "📁 구매이미지", bucket: "purchase-images" },
    { label: "📁 리뷰이미지", bucket: "review-images" },
  ];

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2 flex-wrap">
        {IMAGE_FOLDER_LINKS.map((f) => (
          <a
            key={f.bucket}
            href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/storage/buckets/${f.bucket}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-neutral-700 text-white font-bold rounded-lg px-2.5 py-1 hover:bg-neutral-800"
          >
            {f.label} →
          </a>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-lg font-extrabold text-neutral-700">{title}</div>
        <span className="text-xs text-neutral-500">{filtered.length.toLocaleString("ko-KR")}건</span>
        <span className="text-xs text-neutral-400">셀을 클릭하면 바로 수정할 수 있어요</span>
        <div className="flex-1" />
        <input
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm w-24"
          placeholder="날짜 MMDD"
          maxLength={4}
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value.replace(/[^0-9]/g, ""))}
        />
        <input
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm w-64"
          placeholder="업체명·제품명·주문번호·구매자·수취인·전화번호·운송장 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="text-xs border border-neutral-300 rounded-lg px-3 py-1.5 font-bold text-neutral-600"
          onClick={() => setShowNameManager((v) => !v)}
        >
          🚩 색상 안내
        </button>
        <button
          className="text-xs bg-rose-600 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-60"
          onClick={checkReviewComplete}
          disabled={checkingReview}
        >
          {checkingReview ? "확인 중..." : "📋 업체리뷰확인"}
        </button>
        <button
          className="text-xs bg-neutral-800 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-60"
          onClick={addRow}
          disabled={adding}
        >
          {adding ? "추가 중..." : "+ 새 행 추가"}
        </button>
        <button className="text-xs border border-neutral-300 rounded-lg px-3 py-1.5 font-bold text-neutral-600" onClick={doLogout}>
          로그아웃
        </button>
      </div>

      {mode === "full" && (
        <div className="flex items-center gap-2 border border-rose-200 bg-rose-50 rounded-xl px-3 py-2">
          <span className="text-xs font-bold text-rose-600 shrink-0">🗑️ 년도/월 진행건 전체삭제 (날짜 기준)</span>
          <select
            className="border border-neutral-300 rounded-lg px-2 py-1 text-xs"
            value={bulkYear}
            onChange={(e) => setBulkYear(Number(e.target.value))}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select
            className="border border-neutral-300 rounded-lg px-2 py-1 text-xs"
            value={bulkMonth}
            onChange={(e) => setBulkMonth(Number(e.target.value))}
          >
            {availableMonthsForYear.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          <button
            className="text-xs bg-rose-600 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-60"
            onClick={bulkDeleteMonth}
            disabled={bulkDeleting}
          >
            {bulkDeleting ? "삭제 중..." : "전체삭제"}
          </button>
        </div>
      )}

      {showNameManager && (
        <div className="border border-neutral-300 rounded-xl p-3 bg-neutral-50 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3 text-[11px] font-bold">
            {(Object.keys(K_FLAG_INFO) as (keyof typeof K_FLAG_INFO)[]).map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border border-neutral-300" style={{ backgroundColor: K_FLAG_INFO[k].color }} />
                {K_FLAG_INFO[k].label}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border border-neutral-300" style={{ backgroundColor: ADDRESS_DUP_COLOR }} />
              주소 중복(주소열)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border border-neutral-300" style={{ backgroundColor: BATCH_COMPLETE_COLOR }} />
              해당건 완료(실진행열)
            </span>
          </div>
          <div className="flex gap-3 text-xs">
            <Link href="/admin/blacklist" className="font-bold text-rose-600 underline">
              🚫 블랙리스트 관리 →
            </Link>
            <Link href="/admin/whitelist" className="font-bold text-emerald-700 underline">
              ✅ 화이트리스트 관리 →
            </Link>
          </div>
        </div>
      )}

      {pendingDeletes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {pendingDeletes.map((p) => (
            <div
              key={p.row.id}
              className="bg-neutral-800 text-white text-sm rounded-xl px-3 py-2 flex items-center gap-3"
            >
              <span>
                {p.row.product_name || "행"} {mode === "active" ? "숨김 처리됨 (전체보기에는 남아있어요)" : "삭제됨"}
              </span>
              <button className="text-rose-300 font-bold underline" onClick={() => undoDelete(p.row.id)}>
                되돌리기
              </button>
            </div>
          ))}
        </div>
      )}

      {loadError && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">
          {loadError}
        </div>
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
                    const [onLabel, offLabel] = TOGGLE_LABELS[c.key] || ["완료", "대기"];
                    return (
                      <td key={c.key} className="px-2 py-1.5 border-r border-neutral-200 text-center overflow-hidden">
                        <button
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            on ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                          }`}
                          onClick={() => toggleBool(r, c.key as "review_done" | "paid")}
                          disabled={savingId === r.id}
                        >
                          {on ? onLabel : offLabel}
                        </button>
                      </td>
                    );
                  }
                  const isEditing = editing?.id === r.id && editing.field === c.key;
                  const val = r[c.key];
                  let flagBg: string | undefined;
                  let flagTitle: string | undefined;
                  if (c.key === "seq") {
                    flagBg = r._group === "a" ? "#FFF1A6" : r._group === "b" ? "#FAD2E1" : undefined;
                  } else if (c.key === "manager") {
                    const flag = kFlags.get(r.id);
                    if (flag) {
                      flagBg = K_FLAG_INFO[flag].color;
                      flagTitle = K_FLAG_INFO[flag].label;
                    }
                  } else if (c.key === "address" && addressDupFlags.has(r.id)) {
                    flagBg = ADDRESS_DUP_COLOR;
                    flagTitle = "주소 중복(21일내)";
                  } else if (c.key === "real_manager" && batchCompleteFlags.has(r.id)) {
                    flagBg = BATCH_COMPLETE_COLOR;
                    flagTitle = "해당건 완료";
                  }
                  const isLink = LINK_FIELDS.has(c.key);
                  const urls = isLink
                    ? String(val || "")
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : [];
                  const isSelected = selectedCells.has(cellKey(r.id, c.key));
                  return (
                    <td
                      key={c.key}
                      className="px-2 py-1.5 border-r border-neutral-200 whitespace-nowrap text-center cursor-text hover:bg-black/5 overflow-hidden text-ellipsis select-none"
                      style={{ backgroundColor: flagBg, boxShadow: isSelected ? "inset 0 0 0 2px #2563eb" : undefined }}
                      onDoubleClick={() => !isEditing && startEdit(r, c.key)}
                      onMouseDown={() => startDrag(r, c.key)}
                      onMouseEnter={() => {
                        setHoverCell({ id: r.id, field: c.key });
                        dragOver(r, c.key);
                      }}
                      onMouseLeave={() => setHoverCell((h) => (h && h.id === r.id && h.field === c.key ? null : h))}
                      title={flagTitle || (c.key === "date_mmdd" ? guessFullDate(r) : typeof val === "string" ? val : undefined)}
                    >
                      {isEditing && c.key === "date_mmdd" ? (
                        <div className="flex items-center gap-0.5 min-w-[120px] border border-rose-400 rounded px-1 py-0.5 bg-white">
                          <span className="text-xs shrink-0">📅</span>
                          <input
                            autoFocus
                            type="date"
                            className="w-full text-xs outline-none text-center"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              else if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        </div>
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
                      ) : isLink ? (
                        urls.length ? (
                          <span className="inline-flex gap-1">
                            {urls.map((u, i) => (
                              <a
                                key={i}
                                href={u}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                보기{urls.length > 1 ? i + 1 : ""}
                              </a>
                            ))}
                          </span>
                        ) : (
                          ""
                        )
                      ) : c.align === "right" ? (
                        fmt(val as number)
                      ) : c.key === "paid_date" && val ? (
                        formatPaidDate(val as string)
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
                    title={mode === "active" ? "체험단진행에서 숨기기 (전체보기에는 남아있음)" : "행 삭제"}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reviewCompleteMsgs && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setReviewCompleteMsgs(null)}>
          <div
            className="bg-white rounded-2xl p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-extrabold text-rose-600">✅ 전체 리뷰 완료 · {reviewCompleteMsgs.length}개 제품</div>
              <button
                className="text-xs bg-rose-600 text-white font-bold rounded-lg px-3 py-1.5"
                onClick={() => {
                  navigator.clipboard.writeText(reviewCompleteMsgs.map((m) => m.msg).join("\n"));
                }}
              >
                전체 복사
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {reviewCompleteMsgs.map((m) => (
                <div key={m.key} className="border border-rose-200 rounded-xl p-3 bg-rose-50/40">
                  <div className="text-xs font-bold text-neutral-500">{m.company}</div>
                  <div className="text-sm font-extrabold text-neutral-800 mb-1.5">{m.product}</div>
                  <div className="flex gap-2">
                    <textarea readOnly className="flex-1 text-xs border border-rose-200 rounded-lg px-2 py-1.5 bg-white resize-none" value={m.msg} />
                    <button
                      className="text-xs bg-rose-600 text-white font-bold rounded-lg px-3 shrink-0"
                      onClick={() => navigator.clipboard.writeText(m.msg)}
                    >
                      복사
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="w-full mt-3 text-xs font-bold text-neutral-500 border border-neutral-300 rounded-lg py-2"
              onClick={() => setReviewCompleteMsgs(null)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
