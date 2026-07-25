"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";

export type WorkRequestRow = {
  id: number;
  start_date: string;
  receipt_no: string;
  company_code: string | null;
  company_name: string;
  biz_no: string | null;
  owner_name: string | null;
  phone: string | null;
  login_id: string | null;
  email: string | null;
  issue_date: string | null;
  deposit_amount: number | null;
  deposit_date: string | null;
  image_url: string | null;
  weekend_work: boolean;
  unit_price: number;
  product_url: string | null;
  product_option: string | null;
  product_price: number | null;
  keyword: string;
  total_count: number;
  daily_plan: string | null;
  review_type: string | null;
  real_shipping: boolean;
  payment_agency: boolean;
  delivery_agency: boolean;
  tax_bill: boolean;
  biz_file_url: string | null;
  status: string;
  main_created: boolean;
  guide_created: boolean;
  memo: string | null;
};

type Field = keyof WorkRequestRow;
type Kind = "text" | "bool";

const LINK_FIELDS = new Set<Field>(["image_url", "biz_file_url"]);
const BOOL_FIELDS = new Set<Field>(["weekend_work", "real_shipping", "payment_agency", "delivery_agency", "tax_bill", "main_created"]);
const STATUS_STYLE: Record<string, string> = {
  접수: "bg-emerald-500 text-white",
  대기: "bg-pink-400 text-white",
  진행중: "bg-sky-400 text-white",
  취소: "bg-red-900 text-white",
  완료: "bg-neutral-500 text-white",
  미입금: "bg-amber-600 text-white",
};

const COLUMNS: { key: Field; label: string; align?: "right"; kind?: Kind; defaultWidth: number }[] = [
  { key: "start_date", label: "시작일", defaultWidth: 90 },
  { key: "receipt_no", label: "접수번호", defaultWidth: 130 },
  { key: "company_code", label: "업체코드", defaultWidth: 80 },
  { key: "company_name", label: "업체명", defaultWidth: 110 },
  { key: "biz_no", label: "사업자번호", defaultWidth: 100 },
  { key: "owner_name", label: "대표자명", defaultWidth: 80 },
  { key: "phone", label: "전화번호", defaultWidth: 110 },
  { key: "email", label: "이메일", defaultWidth: 150 },
  { key: "issue_date", label: "발행일", defaultWidth: 90 },
  { key: "deposit_amount", label: "입금금액", align: "right", defaultWidth: 90 },
  { key: "deposit_date", label: "입금일", defaultWidth: 90 },
  { key: "image_url", label: "이미지", defaultWidth: 70 },
  { key: "weekend_work", label: "주말진행", kind: "bool", defaultWidth: 80 },
  { key: "unit_price", label: "계약단가", align: "right", defaultWidth: 80 },
  { key: "product_url", label: "진행제품URL", defaultWidth: 70 },
  { key: "product_option", label: "제품옵션", defaultWidth: 100 },
  { key: "product_price", label: "제품판매가", align: "right", defaultWidth: 90 },
  { key: "keyword", label: "검색키워드", defaultWidth: 120 },
  { key: "total_count", label: "총진행건수", align: "right", defaultWidth: 80 },
  { key: "daily_plan", label: "일진행건수", defaultWidth: 90 },
  { key: "review_type", label: "리뷰종류", defaultWidth: 110 },
  { key: "real_shipping", label: "제품실제배송여부", kind: "bool", defaultWidth: 90 },
  { key: "payment_agency", label: "입금대행", kind: "bool", defaultWidth: 80 },
  { key: "delivery_agency", label: "택배대행", kind: "bool", defaultWidth: 80 },
  { key: "tax_bill", label: "세금계산서", kind: "bool", defaultWidth: 80 },
  { key: "biz_file_url", label: "사업자등록증", defaultWidth: 90 },
  { key: "status", label: "진행상태 (접수/대기/진행중/취소/완료/미입금)", defaultWidth: 130 },
  { key: "main_created", label: "생성", kind: "bool", defaultWidth: 70 },
  { key: "memo", label: "업체요구사항", defaultWidth: 140 },
];

export default function RequestsPanel({
  rows,
  loadError,
  title,
  fetchUrl,
}: {
  rows: WorkRequestRow[];
  loadError: string | null;
  title?: string;
  fetchUrl?: string;
}) {
  const [items, setItems] = useState(rows);
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
        setItems(data.rows || []);
        if (data.loadError) setFetchError(data.loadError);
      })
      .catch(() => setFetchError("불러오는 중 오류가 발생했습니다"))
      .finally(() => setFetching(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [resetId, setResetId] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetting, setResetting] = useState(false);
  const [q, setQ] = useState("");
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]))
  );
  const [editing, setEditing] = useState<{ id: number; field: Field } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<{ id: number; field: Field } | null>(null);
  const [dragAnchor, setDragAnchor] = useState<{ id: number; field: Field } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<Field | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: Field) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  const cellKey = (id: number, field: Field) => `${id}:${field}`;
  const clearableField = (f: Field) => !BOOL_FIELDS.has(f) && !LINK_FIELDS.has(f);
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

  function startDrag(row: WorkRequestRow, field: Field) {
    setDragAnchor({ id: row.id, field });
    focusRef.current = { id: row.id, field };
    setIsDragging(true);
    setSelectedCells(new Set([cellKey(row.id, field)]));
  }

  function dragOver(row: WorkRequestRow, field: Field) {
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
          if (row && !BOOL_FIELDS.has(dragAnchor.field) && !LINK_FIELDS.has(dragAnchor.field) && dragAnchor.field !== "status") {
            startEdit(row, dragAnchor.field);
          }
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
          moveSelection(dRow, dCol);
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
          const current = items.find((r) => r.id === id);
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

  async function saveField(id: number, field: Field, value: string | number | boolean | null, pushUndo = true) {
    if (pushUndo) {
      const current = items.find((r) => r.id === id);
      if (current) undoStack.current.push([{ id, field, prevValue: current[field] as string | number | boolean | null }]);
    }
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "저장 실패");
        return;
      }
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    } catch {
      alert("저장 중 오류가 발생했습니다");
    } finally {
      setSavingId(null);
    }
  }

  function startEdit(row: WorkRequestRow, field: Field) {
    setEditing({ id: row.id, field });
    const v = row[field];
    setEditValue(v == null ? "" : String(v));
  }

  function commitEdit() {
    if (!editing) return;
    const field = editing.field;
    const raw = editValue.trim();
    const isNumberField = field === "unit_price" || field === "product_price" || field === "total_count" || field === "deposit_amount";
    const value = raw === "" ? null : isNumberField ? Number(raw) : raw;
    saveField(editing.id, field, value);
    setEditing(null);
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function toggleBool(row: WorkRequestRow, field: Field) {
    await saveField(row.id, field, !row[field]);
  }

  function moveEdit(delta: number) {
    if (!editing) return;
    commitEdit();
    const idx = filtered.findIndex((r) => r.id === editing.id);
    const next = filtered[idx + delta];
    if (next) startEdit(next, editing.field);
  }

  function selectWholeRow(row: WorkRequestRow, e?: ReactMouseEvent) {
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

  const searched = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((r) =>
      [r.company_name, r.company_code, r.receipt_no, r.keyword].join(" ").toLowerCase().includes(query)
    );
  }, [items, q]);

  const filtered = useMemo(() => {
    if (!sortKey) return searched;
    const key = sortKey;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...searched].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      if (typeof av === "boolean" && typeof bv === "boolean") return (av === bv ? 0 : av ? -1 : 1) * dir;
      return String(av).localeCompare(String(bv), "ko") * dir;
    });
  }, [searched, sortKey, sortDir]);

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

  const [adding, setAdding] = useState(false);

  async function addRow() {
    setAdding(true);
    try {
      const row = await createRow();
      if (row) {
        const ref = filtered.find((r) => r.company_code) || filtered[0];
        const query = q.trim();
        if (ref && (ref.company_name || ref.company_code)) {
          if (ref.company_name) await saveField(row.id, "company_name", ref.company_name, false);
          if (ref.company_code) await saveField(row.id, "company_code", ref.company_code, false);
          row.company_name = ref.company_name;
          row.company_code = ref.company_code;
        } else if (query) {
          await saveField(row.id, "company_name", query, false);
          row.company_name = query;
        }
        setItems((prev) => [...prev, row]);
      }
    } finally {
      setAdding(false);
    }
  }

  const [backingUp, setBackingUp] = useState(false);

  async function backupAndDeleteOld() {
    if (
      !confirm(
        "2개월 이전 데이터를 엑셀로 다운로드하고, DB에서는 삭제할까요?\n(엑셀 파일에 안전하게 보관되니 다운로드 후 삭제됩니다)\n이 작업은 되돌릴 수 없습니다."
      )
    )
      return;
    setBackingUp(true);
    try {
      const res = await fetch("/api/admin/requests/backup-delete", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "실패했습니다");
        return;
      }
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
      const filename = match ? decodeURIComponent(match[1]) : "backup.xlsx";
      const deletedCount = res.headers.get("X-Deleted-Count") || "0";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 2);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      setItems((prev) => prev.filter((r) => r.start_date >= cutoffStr));
      alert(`✅ ${deletedCount}건 다운로드 및 삭제 완료`);
    } finally {
      setBackingUp(false);
    }
  }

  async function createRow(): Promise<WorkRequestRow | null> {
    try {
      const res = await fetch("/api/admin/requests", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "추가 실패");
        return null;
      }
      return data.row as WorkRequestRow;
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
        setItems((prev) => [...prev, row]);
      }
      for (let ci = 0; ci < grid[ri].length; ci++) {
        const field = colKeys[startCol + ci];
        if (!field || !clearableField(field)) continue;
        const raw = grid[ri][ci].trim();
        const isNumberField = field === "unit_price" || field === "product_price" || field === "total_count" || field === "deposit_amount";
        const value = raw === "" ? null : isNumberField ? Number(raw) : raw;
        batch.push({ id: targetRow.id, field, prevValue: targetRow[field] as string | number | boolean | null });
        saveField(targetRow.id, field, value, false);
      }
    }
    if (batch.length) undoStack.current.push(batch);
  }

  async function deleteRow(id: number) {
    if (!confirm("이 요청을 삭제할까요?")) return;
    const res = await fetch(`/api/admin/requests/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "삭제 실패");
      return;
    }
    setItems((prev) => prev.filter((r) => r.id !== id));
  }

  const pendingCount = items.filter((r) => r.status === "접수" && !r.main_created).length;
  const pendingGuideCount = items.filter((r) => r.status === "접수" && !r.guide_created).length;

  const [generatingGuide, setGeneratingGuide] = useState(false);
  const [guideResult, setGuideResult] = useState("");

  async function generateGuideOnly() {
    setGeneratingGuide(true);
    setGuideResult("");
    try {
      const res = await fetch("/api/admin/generate-guide", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setGuideResult("❌ " + (data.message || "생성 실패"));
        return;
      }
      setGuideResult(`✅ 요청 ${data.requestCount}건 처리 → 구매가이드 ${data.guideRows}건 생성`);
      setItems((prev) =>
        prev.map((r) => (r.status === "접수" && !r.guide_created ? { ...r, guide_created: true } : r))
      );
    } catch {
      setGuideResult("❌ 생성 중 오류가 발생했습니다");
    } finally {
      setGeneratingGuide(false);
    }
  }

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
        `✅ 요청 ${data.requestCount}건 처리 → 메인시트 슬롯 ${data.orderRows}건 생성, 구매가이드 ${data.guideRows}건 생성` +
          (data.paymentRowsCreated ? `, 업체정산 입금 ${data.paymentRowsCreated}건 자동등록` : "")
      );
      setItems((prev) =>
        prev.map((r) =>
          r.status === "접수" && !r.main_created ? { ...r, status: "진행중", main_created: true, guide_created: true } : r
        )
      );
    } catch {
      setResult("❌ 생성 중 오류가 발생했습니다");
    } finally {
      setGenerating(false);
    }
  }

  const SUPABASE_PROJECT_REF = "gbbwqubgujfuoolvedbq";
  const IMAGE_FOLDER_LINKS = [
    { label: "📁 업체견적서", bucket: "estimate-images" },
    { label: "📁 사업자등록증", bucket: "vendor-files" },
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
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">📝 {title || "작업요청서 목록"}</div>
        <span className="text-xs text-neutral-500">{filtered.length.toLocaleString("ko-KR")}건</span>
        <Link href="/admin/estimate" className="text-xs font-bold text-emerald-700 underline">
          🧾 견적서 발행 →
        </Link>
        <Link href="/admin/vendors" className="text-xs font-bold text-emerald-700 underline">
          🏢 업체리스트 →
        </Link>
        <div className="flex-1" />
        <input
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm w-56"
          placeholder="업체명·업체코드·접수번호·키워드 검색"
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
        <button
          className="text-xs bg-rose-600 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-60"
          onClick={backupAndDeleteOld}
          disabled={backingUp}
        >
          {backingUp ? "처리 중..." : "🗑️ 2개월 이전 백업삭제"}
        </button>
        <button
          className="bg-sky-600 text-white text-sm font-extrabold rounded-lg px-4 py-2 disabled:opacity-60"
          onClick={generateGuideOnly}
          disabled={generatingGuide || pendingGuideCount === 0}
        >
          {generatingGuide ? "생성 중..." : `구매가이드 생성 (대기 ${pendingGuideCount}건)`}
        </button>
        <button
          className="bg-emerald-600 text-white text-sm font-extrabold rounded-lg px-4 py-2 disabled:opacity-60"
          onClick={generate}
          disabled={generating || pendingCount === 0}
        >
          {generating ? "생성 중..." : `메인시트 생성 (대기 ${pendingCount}건)`}
        </button>
      </div>
      {guideResult && (
        <div className="bg-sky-50 border border-sky-300 text-sky-800 text-sm rounded-xl px-3 py-2 whitespace-pre-line">
          {guideResult}
        </div>
      )}

      <div className="border border-neutral-300 rounded-xl px-3 py-2 flex items-center gap-2 bg-neutral-50">
        <span className="text-xs font-bold text-neutral-500 shrink-0">🔗 업체 웹앱 링크</span>
        <span className="text-xs text-neutral-400 flex-1 truncate">
          {typeof window !== "undefined" ? `${window.location.origin}/vendor/login` : "/vendor/login"}
        </span>
        <button
          className="text-xs bg-neutral-700 text-white font-bold rounded-lg px-3 py-1.5 shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/vendor/login`);
            setResetMsg("✅ 링크가 복사되었습니다");
          }}
        >
          복사
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

      {(loadError || fetchError) && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">
          {loadError || fetchError}
        </div>
      )}
      {fetching && <div className="text-center text-sm text-neutral-500 font-bold py-2">🌸 불러오는 중...</div>}
      {result && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm rounded-xl px-3 py-2 whitespace-pre-line">
          {result}
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
                  className="relative px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700 overflow-hidden cursor-pointer select-none hover:bg-neutral-700"
                  onClick={() => toggleSort(c.key)}
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
                  const val = r[c.key];
                  if (c.kind === "bool" || BOOL_FIELDS.has(c.key)) {
                    const on = !!val;
                    return (
                      <td
                        key={c.key}
                        className={`px-2 py-1.5 border-r border-b border-neutral-300 text-center overflow-hidden cursor-pointer font-bold text-xs ${
                          on ? "bg-emerald-400 text-white" : "bg-neutral-50 text-neutral-400"
                        }`}
                        onClick={() => toggleBool(r, c.key)}
                      >
                        {savingId === r.id ? "..." : c.key === "main_created" ? (on ? "생성완료" : "아니오") : on ? "예" : "아니오"}
                      </td>
                    );
                  }
                  const isLink = LINK_FIELDS.has(c.key);
                  const isEditing = editing?.id === r.id && editing.field === c.key;
                  const isSelected = selectedCells.has(cellKey(r.id, c.key));
                  const needsIssue = c.key === "issue_date" && !r.issue_date && r.tax_bill;
                  const statusStyle = c.key === "status" ? STATUS_STYLE[String(val ?? "")] || "" : "";
                  return (
                    <td
                      key={c.key}
                      className={`px-2 py-1.5 border-r border-neutral-200 whitespace-nowrap text-center overflow-hidden text-ellipsis select-none font-bold ${
                        statusStyle || "cursor-text hover:bg-black/5"
                      }`}
                      style={{
                        boxShadow: isSelected ? "inset 0 0 0 2px #2563eb" : undefined,
                        background: needsIssue && !isSelected ? "#FFFDE0" : undefined,
                      }}
                      title={typeof val === "string" ? val : undefined}
                      onDoubleClick={() => !isEditing && !isLink && startEdit(r, c.key)}
                      onMouseDown={() => startDrag(r, c.key)}
                      onMouseEnter={() => {
                        setHoverCell({ id: r.id, field: c.key });
                        dragOver(r, c.key);
                      }}
                      onMouseLeave={() => setHoverCell((h) => (h && h.id === r.id && h.field === c.key ? null : h))}
                    >
                      {isEditing && c.key === "status" ? (
                        <select
                          autoFocus
                          className="w-full border border-rose-400 rounded px-1 py-0.5 text-xs outline-none text-center bg-white text-neutral-900"
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value);
                            saveField(r.id, "status", e.target.value);
                            setEditing(null);
                          }}
                          onBlur={cancelEdit}
                        >
                          <option value="접수">접수</option>
                          <option value="대기">대기</option>
                          <option value="진행중">진행중</option>
                          <option value="취소">취소</option>
                          <option value="완료">완료</option>
                          <option value="미입금">미입금</option>
                        </select>
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
                      ) : c.key === "status" ? (
                        String(val ?? "")
                      ) : isLink && val ? (
                        <a href={String(val)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
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
                    title="요청 삭제"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="text-center text-neutral-400 py-8">
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
