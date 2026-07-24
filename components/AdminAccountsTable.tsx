"use client";

import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
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
}: {
  rows: Account[];
  loadError: string | null;
}) {
  const [rows, setRows] = useState(initialRows);
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (editing) return;
      if ((e.key !== "Delete" && e.key !== "Backspace") || !hoverCell) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      saveField(hoverCell.id, hoverCell.field, "");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverCell, editing]);

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
      [r.kakao_id, r.store, r.buyer, r.receiver, r.user_id, r.phone].join(" ").toLowerCase().includes(query)
    );
  }, [rows, q]);

  async function saveField(id: string, field: Field, value: string) {
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
      const res = await fetch("/api/admin/accounts", { method: "POST" });
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
          placeholder="카카오톡아이디·별칭·구매자·수취인·아이디·전화번호 검색"
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
      {loadError && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">{loadError}</div>
      )}

      <div className="border border-neutral-300 rounded-xl overflow-auto flex-1">
        <table
          className="text-xs border-collapse"
          style={{ tableLayout: "fixed", width: COLUMNS.reduce((sum, c) => sum + (widths[c.key] ?? c.defaultWidth), 70 + 36) }}
        >
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
              <th className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">비번초기화</th>
              <th className="px-2 py-2 text-center whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-neutral-200">
                {COLUMNS.map((c) => {
                  const isEditing = editing?.id === r.id && editing.field === c.key;
                  const val = r[c.key];
                  return (
                    <td
                      key={c.key}
                      className="px-2 py-1.5 border-r border-neutral-200 whitespace-nowrap text-center cursor-text hover:bg-black/5 overflow-hidden text-ellipsis select-none"
                      onClick={() => !isEditing && startEdit(r, c.key)}
                      onMouseEnter={() => setHoverCell({ id: r.id, field: c.key })}
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
                <td colSpan={COLUMNS.length + 2} className="text-center text-neutral-400 py-8">
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
