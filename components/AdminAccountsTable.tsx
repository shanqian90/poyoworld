"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { Account } from "@/lib/types";

type Field = keyof Account;

const COLUMNS: { key: Field; label: string; defaultWidth: number }[] = [
  { key: "kakao_id", label: "카카오톡아이디", defaultWidth: 120 },
  { key: "store", label: "별칭", defaultWidth: 90 },
  { key: "buyer", label: "구매자", defaultWidth: 90 },
  { key: "receiver", label: "수취인", defaultWidth: 90 },
  { key: "user_id", label: "아이디", defaultWidth: 120 },
  { key: "phone", label: "전화번호", defaultWidth: 120 },
  { key: "address", label: "주소", defaultWidth: 200 },
  { key: "bank", label: "은행", defaultWidth: 100 },
  { key: "account_no", label: "계좌번호", defaultWidth: 140 },
  { key: "holder", label: "계좌주", defaultWidth: 90 },
];

export default function AdminAccountsTable({
  rows: initialRows,
  loadError,
  fetchUrl,
}: {
  rows: Account[];
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
  const [hoverCell, setHoverCell] = useState<{ id: string; field: Field } | null>(null);
  const [resetMsg, setResetMsg] = useState("");
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]))
  );
  const [dragAnchor, setDragAnchor] = useState<{ id: string; field: Field } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const cellKey = (id: string, field: Field) => `${id}:${field}`;
  const colKeys = COLUMNS.map((c) => c.key);
  type UndoEntry = { id: string; field: Field; prevValue: string };
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
      const topRow = filtered[bounds.rowLo];
      if (!topRow) continue;
      const value = (topRow[field] as string) ?? "";
      for (let ri = bounds.rowLo + 1; ri <= bounds.rowHi; ri++) {
        const row = filtered[ri];
        if (!row) continue;
        batch.push({ id: row.id, field, prevValue: (row[field] as string) ?? "" });
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

  function startDrag(row: Account, field: Field) {
    setDragAnchor({ id: row.id, field });
    focusRef.current = { id: row.id, field };
    setIsDragging(true);
    setSelectedCells(new Set([cellKey(row.id, field)]));
  }

  function dragOver(row: Account, field: Field) {
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
          const id = key.slice(0, idx);
          const field = key.slice(idx + 1) as Field;
          const current = rows.find((r) => r.id === id);
          if (!current) return;
          batch.push({ id, field, prevValue: (current[field] as string) ?? "" });
          saveField(id, field, "", false);
        });
        if (batch.length) undoStack.current.push(batch);
        return;
      }
      if (!hoverCell) return;
      saveField(hoverCell.id, hoverCell.field, "");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverCell, editing, selectedCells, dragAnchor]);

  function selectWholeRow(row: Account, e?: ReactMouseEvent) {
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
    if (!query) return rows;
    return rows.filter((r) =>
      [r.kakao_id, r.store, r.buyer, r.receiver, r.user_id, r.phone, r.holder].join(" ").toLowerCase().includes(query)
    );
  }, [rows, q]);

  async function saveField(id: string, field: Field, value: string, pushUndo = true) {
    if (pushUndo) {
      const current = rows.find((r) => r.id === id);
      if (current) undoStack.current.push([{ id, field, prevValue: (current[field] as string) ?? "" }]);
    }
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, {
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

  function startEdit(row: Account, field: Field) {
    setEditing({ id: row.id, field });
    setEditValue(row[field] || "");
  }

  function commitEdit() {
    if (!editing) return;
    saveField(editing.id, editing.field, editValue.trim());
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

  async function createRow(): Promise<Account | null> {
    try {
      const res = await fetch("/api/admin/accounts", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "추가 실패");
        return null;
      }
      return data.row as Account;
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
        if (!field) continue;
        const value = grid[ri][ci].trim();
        batch.push({ id: targetRow.id, field, prevValue: (targetRow[field] as string) ?? "" });
        saveField(targetRow.id, field, value, false);
      }
    }
    if (batch.length) undoStack.current.push(batch);
  }

  async function deleteRow(id: string) {
    if (!confirm("이 계정을 삭제할까요?")) return;
    const res = await fetch(`/api/admin/accounts/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "삭제 실패");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function resetPassword(kakaoId: string) {
    const id = kakaoId.trim();
    if (!id) {
      setResetMsg("카카오톡아이디가 없는 계정입니다");
      return;
    }
    if (!confirm(`${id} 진행자의 비밀번호를 초기화할까요?`)) return;
    setResettingId(id);
    setResetMsg("");
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: id }),
      });
      const data = await res.json();
      setResetMsg(data.ok ? `✅ ${id} 비밀번호가 초기화되었습니다` : `❌ ${data.message || "초기화 실패"}`);
    } catch {
      setResetMsg("❌ 초기화 중 오류가 발생했습니다");
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">👤 계정관리</div>
        <span className="text-xs text-neutral-500">{filtered.length.toLocaleString("ko-KR")}건</span>
        <span className="text-xs text-neutral-400">칸에 마우스 올리고 Delete로 지우기</span>
        <div className="flex-1" />
        <input
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm w-64"
          placeholder="카카오톡아이디·별칭·구매자·수취인·아이디·전화번호·계좌주 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="text-xs bg-neutral-800 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-60"
          onClick={addRow}
          disabled={adding}
        >
          {adding ? "추가 중..." : "+ 새 계정 추가"}
        </button>
      </div>

      {resetMsg && (
        <div className="bg-neutral-800 text-white text-sm rounded-xl px-3 py-2">{resetMsg}</div>
      )}
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
              <th className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">비번초기화</th>
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
                  const isSelected = selectedCells.has(cellKey(r.id, c.key));
                  return (
                    <td
                      key={c.key}
                      className="px-2 py-1.5 border-r border-neutral-200 whitespace-nowrap text-center cursor-text hover:bg-black/5 overflow-hidden text-ellipsis select-none"
                      style={{ boxShadow: isSelected ? "inset 0 0 0 2px #2563eb" : undefined }}
                      onDoubleClick={() => !isEditing && startEdit(r, c.key)}
                      onMouseDown={() => startDrag(r, c.key)}
                      onMouseEnter={() => {
                        setHoverCell({ id: r.id, field: c.key });
                        dragOver(r, c.key);
                      }}
                      onMouseLeave={() => setHoverCell((h) => (h && h.id === r.id && h.field === c.key ? null : h))}
                      title={val || undefined}
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
                      ) : (
                        val || ""
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 border-r border-neutral-200 text-center">
                  <button
                    className="bg-neutral-700 text-white text-[11px] font-bold rounded-full px-2 py-0.5 disabled:opacity-60"
                    onClick={() => resetPassword(r.kakao_id)}
                    disabled={resettingId === r.kakao_id || savingId === r.id}
                  >
                    초기화
                  </button>
                </td>
                <td className="px-2 py-1.5">
                  <button
                    className="text-neutral-400 hover:text-rose-600 font-bold px-1"
                    onClick={() => deleteRow(r.id)}
                    title="계정 삭제"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 3} className="text-center text-neutral-400 py-8">
                  등록된 계정이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
