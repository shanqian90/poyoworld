"use client";

import { useCallback, useEffect, useMemo, useState, memo } from "react";
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

const AccountRow = memo(function AccountRow({
  row,
  rowNumber,
  savingId,
  resettingId,
  onResetPassword,
  onEditRow,
  onDeleteRow,
}: {
  row: Account;
  rowNumber: number;
  savingId: string | null;
  resettingId: string | null;
  onResetPassword: (kakaoId: string) => void;
  onEditRow: (row: Account) => void;
  onDeleteRow: (id: string) => void;
}) {
  return (
    <tr className="border-b border-neutral-200">
      <td className="px-1 py-1.5 border-r border-neutral-200 text-center text-neutral-400 select-none">{rowNumber}</td>
      {COLUMNS.map((c) => (
        <td
          key={c.key}
          className="px-2 py-1.5 border-r border-neutral-200 whitespace-nowrap text-center overflow-hidden text-ellipsis"
          title={row[c.key] || undefined}
        >
          {row[c.key] || ""}
        </td>
      ))}
      <td className="px-2 py-1.5 border-r border-neutral-200 text-center">
        <button
          className="bg-neutral-700 text-white text-[11px] font-bold rounded-full px-2 py-0.5 disabled:opacity-60"
          onClick={() => onResetPassword(row.kakao_id)}
          disabled={resettingId === row.kakao_id || savingId === row.id}
        >
          초기화
        </button>
      </td>
      <td className="px-2 py-1.5 border-r border-neutral-200 text-center">
        <button
          className="bg-sky-600 text-white text-[11px] font-bold rounded-full px-2.5 py-0.5"
          onClick={() => onEditRow(row)}
        >
          수정
        </button>
      </td>
      <td className="px-2 py-1.5">
        <button
          className="text-neutral-400 hover:text-rose-600 font-bold px-1"
          onClick={() => onDeleteRow(row.id)}
          title="계정 삭제"
        >
          ✕
        </button>
      </td>
    </tr>
  );
});

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
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [resettingId, setResettingId] = useState<string | null>(null);

  const [editingRow, setEditingRow] = useState<Account | null>(null);
  const [editForm, setEditForm] = useState<Record<Field, string>>({} as Record<Field, string>);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) =>
      [r.kakao_id, r.store, r.buyer, r.receiver, r.user_id, r.phone, r.holder].join(" ").toLowerCase().includes(query)
    );
  }, [rows, q]);

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

  const deleteRow = useCallback(async (id: string) => {
    if (!confirm("이 계정을 삭제할까요?")) return;
    const res = await fetch(`/api/admin/accounts/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "삭제 실패");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const resetPassword = useCallback(async (kakaoId: string) => {
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
  }, []);

  const openEdit = useCallback((row: Account) => {
    setEditingRow(row);
    setEditForm(Object.fromEntries(COLUMNS.map((c) => [c.key, row[c.key] || ""])) as Record<Field, string>);
  }, []);

  function closeEdit() {
    setEditingRow(null);
  }

  async function saveEdit() {
    if (!editingRow) return;
    setSavingId(editingRow.id);
    try {
      const res = await fetch(`/api/admin/accounts/${editingRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: editForm }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "저장 실패");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === editingRow.id ? { ...r, ...editForm } : r)));
      setEditingRow(null);
    } catch {
      alert("저장 중 오류가 발생했습니다");
    } finally {
      setSavingId(null);
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
        <span className="text-xs text-neutral-400">보기 전용입니다 · 수정 버튼으로 편집하세요</span>
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

      {resetMsg && <div className="bg-neutral-800 text-white text-sm rounded-xl px-3 py-2">{resetMsg}</div>}
      {(loadError || fetchError) && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">
          {loadError || fetchError}
        </div>
      )}
      {fetching && <div className="text-center text-sm text-neutral-500 font-bold py-2">🌸 불러오는 중...</div>}

      <div className="border border-neutral-300 rounded-xl overflow-auto flex-1">
        <table className="text-xs border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 36 }} />
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: c.defaultWidth }} />
            ))}
            <col style={{ width: 70 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 36 }} />
          </colgroup>
          <thead className="sticky top-0 bg-neutral-800 text-white z-10">
            <tr>
              <th className="px-1 py-2 text-center border-r border-neutral-700"></th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700 overflow-hidden">
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">비번초기화</th>
              <th className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700"></th>
              <th className="px-2 py-2 text-center whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, ri) => (
              <AccountRow
                key={r.id}
                row={r}
                rowNumber={ri + 1}
                savingId={savingId}
                resettingId={resettingId}
                onResetPassword={resetPassword}
                onEditRow={openEdit}
                onDeleteRow={deleteRow}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 4} className="text-center text-neutral-400 py-8">
                  등록된 계정이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeEdit}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-extrabold text-neutral-700 mb-3">✏️ 계정 수정</div>
            <div className="flex flex-col gap-2">
              {COLUMNS.map((c) => (
                <label key={c.key} className="flex flex-col gap-1 text-xs">
                  <span className="font-bold text-neutral-500">{c.label}</span>
                  <input
                    className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm"
                    value={editForm[c.key] ?? ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, [c.key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                className="flex-1 text-xs font-bold text-neutral-500 border border-neutral-300 rounded-lg py-2"
                onClick={closeEdit}
              >
                취소
              </button>
              <button
                className="flex-1 text-xs font-bold text-white bg-sky-600 rounded-lg py-2 disabled:opacity-60"
                onClick={saveEdit}
                disabled={savingId === editingRow.id}
              >
                {savingId === editingRow.id ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
