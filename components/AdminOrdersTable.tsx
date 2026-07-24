"use client";

import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { computeKFlags, computeAddressDupFlags, computeBatchCompleteFlags, K_FLAG_INFO, ADDRESS_DUP_COLOR, BATCH_COMPLETE_COLOR } from "@/lib/mainFlags";

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
  company_paid: boolean;
  delivery: string | null;
  tracking: string | null;
  remark: string | null;
  _group: "a" | "b" | null;
};

type Field = keyof AdminOrderRow;
type Kind = "text" | "toggle";

function fmt(n: number | null) {
  return (n || 0).toLocaleString("ko-KR");
}

const LINK_FIELDS = new Set<Field>(["product_url", "review_url", "order_image"]);
const TOGGLE_LABELS: Partial<Record<Field, [string, string]>> = {
  review_done: ["완료", "미완료"],
  paid: ["완료", "대기"],
  company_paid: ["완료", "대기"],
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
  { key: "company_paid", label: "업체입금", kind: "toggle", defaultWidth: 70 },
  { key: "delivery", label: "택배대행", defaultWidth: 90 },
  { key: "tracking", label: "운송장번호", defaultWidth: 110 },
];

const TOGGLE_KEYS = new Set<Field>(COLUMNS.filter((c) => c.kind === "toggle").map((c) => c.key));

export default function AdminOrdersTable({
  rows: initialRows,
  loadError,
}: {
  rows: AdminOrderRow[];
  loadError: string | null;
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

  function startDrag(row: AdminOrderRow, field: Field) {
    setDragAnchor({ id: row.id, field });
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
              const value = raw === "" ? null : field === "amount" || field === "review_fee" ? Number(raw) : raw;
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
          const id = Number(key.slice(0, idx));
          const field = key.slice(idx + 1) as Field;
          if (clearableField(field)) saveField(id, field, null);
        });
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
  const [newName, setNewName] = useState("");
  const [newNameKind, setNewNameKind] = useState<"blacklist" | "whitelist">("blacklist");

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

  async function addNameEntry() {
    const value = newName.trim();
    if (!value) return;
    const res = await fetch("/api/admin/name-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: newNameKind, value }),
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "추가 실패");
      return;
    }
    setNewName("");
    loadNameLists();
  }

  async function removeNameEntry(kind: "blacklist" | "whitelist", id: string) {
    const res = await fetch(`/api/admin/name-list?kind=${kind}&id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "삭제 실패");
      return;
    }
    loadNameLists();
  }

  const blacklistSet = useMemo(() => new Set(blacklistNames.map((n) => n.value)), [blacklistNames]);
  const whitelistSet = useMemo(() => new Set(whitelistNames.map((n) => n.value)), [whitelistNames]);
  const kFlags = useMemo(() => computeKFlags(rows, blacklistSet, whitelistSet), [rows, blacklistSet, whitelistSet]);
  const addressDupFlags = useMemo(() => computeAddressDupFlags(rows), [rows]);
  const batchCompleteFlags = useMemo(() => computeBatchCompleteFlags(rows), [rows]);

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

  async function saveField(id: number, field: Field, value: string | number | boolean | null) {
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
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    } catch {
      alert("저장 중 오류가 발생했습니다");
    } finally {
      setSavingId(null);
    }
  }

  function startEdit(row: AdminOrderRow, field: Field) {
    setEditing({ id: row.id, field });
    const v = row[field];
    setEditValue(v == null ? "" : String(v));
  }

  function commitEdit() {
    if (!editing) return;
    const field = editing.field;
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

  async function toggleBool(row: AdminOrderRow, field: "paid" | "review_done" | "company_paid") {
    await saveField(row.id, field, !row[field]);
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
      const res = await fetch("/api/admin/orders", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "추가 실패");
        return;
      }
      setRows((prev) => [...prev, { ...data.row, _group: null }]);
    } catch {
      alert("추가 중 오류가 발생했습니다");
    } finally {
      setAdding(false);
    }
  }

  function deleteRow(id: number) {
    const index = rows.findIndex((r) => r.id === id);
    if (index === -1) return;
    const row = rows[index];
    setRows((prev) => prev.filter((r) => r.id !== id));
    const timer = setTimeout(async () => {
      setPendingDeletes((prev) => prev.filter((p) => p.row.id !== id));
      const res = await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
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

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <div className="text-lg font-extrabold text-neutral-700">📋 메인 전체보기</div>
        <span className="text-xs text-neutral-500">{filtered.length.toLocaleString("ko-KR")}건</span>
        <span className="text-xs text-neutral-400">셀을 클릭하면 바로 수정할 수 있어요</span>
        <Link href="/admin/requests" className="text-xs font-bold text-emerald-700 underline">
          📝 작업요청서 →
        </Link>
        <Link href="/admin/guides" className="text-xs font-bold text-emerald-700 underline">
          🌷 구매가이드 →
        </Link>
        <Link href="/admin/accounts" className="text-xs font-bold text-emerald-700 underline">
          👤 계정관리 →
        </Link>
        <Link href="/admin/tools" className="text-xs font-bold text-emerald-700 underline">
          🧰 관리도구 →
        </Link>
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
          🚩 예정 블랙/화이트리스트
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

          <div className="flex gap-2 items-center">
            <select
              className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm"
              value={newNameKind}
              onChange={(e) => setNewNameKind(e.target.value as "blacklist" | "whitelist")}
            >
              <option value="blacklist">블랙리스트</option>
              <option value="whitelist">화이트리스트</option>
            </select>
            <input
              className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm flex-1"
              placeholder="진행자 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNameEntry()}
            />
            <button className="text-xs bg-neutral-800 text-white rounded-lg px-3 py-1.5 font-bold" onClick={addNameEntry}>
              추가
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-bold text-rose-600 mb-1">블랙리스트</div>
              <div className="flex flex-wrap gap-1.5">
                {blacklistNames.map((n) => (
                  <span key={n.id} className="bg-rose-100 text-rose-700 text-xs rounded-full px-2 py-0.5 flex items-center gap-1">
                    {n.value}
                    <button className="font-bold" onClick={() => removeNameEntry("blacklist", n.id)}>
                      ×
                    </button>
                  </span>
                ))}
                {!blacklistNames.length && <span className="text-xs text-neutral-400">없음</span>}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-blue-600 mb-1">화이트리스트</div>
              <div className="flex flex-wrap gap-1.5">
                {whitelistNames.map((n) => (
                  <span key={n.id} className="bg-blue-100 text-blue-700 text-xs rounded-full px-2 py-0.5 flex items-center gap-1">
                    {n.value}
                    <button className="font-bold" onClick={() => removeNameEntry("whitelist", n.id)}>
                      ×
                    </button>
                  </span>
                ))}
                {!whitelistNames.length && <span className="text-xs text-neutral-400">없음</span>}
              </div>
            </div>
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
                {p.row.product_name || "행"} 삭제됨
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
                  if (c.kind === "toggle") {
                    const on = !!r[c.key];
                    const [onLabel, offLabel] = TOGGLE_LABELS[c.key] || ["완료", "대기"];
                    return (
                      <td key={c.key} className="px-2 py-1.5 border-r border-neutral-200 text-center overflow-hidden">
                        <button
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            on ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                          }`}
                          onClick={() => toggleBool(r, c.key as "review_done" | "paid" | "company_paid")}
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
                      onClick={() => !isEditing && startEdit(r, c.key)}
                      onMouseDown={() => startDrag(r, c.key)}
                      onMouseEnter={() => {
                        setHoverCell({ id: r.id, field: c.key });
                        dragOver(r, c.key);
                      }}
                      onMouseLeave={() => setHoverCell((h) => (h && h.id === r.id && h.field === c.key ? null : h))}
                      title={flagTitle || (typeof val === "string" ? val : undefined)}
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
    </div>
  );
}
