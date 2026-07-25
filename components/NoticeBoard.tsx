"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Notice } from "@/lib/types";

const IMPORTANCE_OPTIONS: Notice["importance"][] = ["일반", "중요", "긴급"];

const IMPORTANCE_STYLE: Record<Notice["importance"], string> = {
  일반: "bg-neutral-100 text-neutral-600",
  중요: "bg-amber-100 text-amber-700",
  긴급: "bg-rose-100 text-rose-700",
};

const emptyForm = { title: "", content: "", importance: "일반" as Notice["importance"], pinned: false, author: "" };

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NoticeBoard() {
  const [rows, setRows] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/admin/notices");
      const data = await res.json();
      if (!data.ok) {
        setLoadError(data.message || "불러오기 실패");
        return;
      }
      setRows(data.rows || []);
    } catch {
      setLoadError("불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  async function createNotice() {
    if (!form.title.trim() || !form.content.trim()) {
      setMsg("제목과 내용을 입력해주세요");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "등록 실패");
        return;
      }
      setForm({ ...emptyForm });
      setShowNew(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(n: Notice) {
    setEditingId(n.id);
    setEditForm({ title: n.title, content: n.content, importance: n.importance, pinned: n.pinned, author: n.author || "" });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/notices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editForm }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "수정 실패");
        return;
      }
      setEditingId(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function togglePin(n: Notice) {
    await fetch("/api/admin/notices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id, pinned: !n.pinned }),
    });
    load();
  }

  async function deleteNotice(id: string) {
    if (!confirm("이 공지를 삭제할까요?")) return;
    const res = await fetch(`/api/admin/notices?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "삭제 실패");
      return;
    }
    load();
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">📌 중요사항</div>
        <span className="text-xs text-neutral-500">{rows.length.toLocaleString("ko-KR")}건</span>
        <div className="flex-1" />
        <button
          className="text-sm bg-neutral-800 text-white font-bold rounded-lg px-4 py-2"
          onClick={() => setShowNew((v) => !v)}
        >
          {showNew ? "닫기" : "+ 새 글쓰기"}
        </button>
      </div>

      {showNew && (
        <div className="border-2 border-neutral-300 rounded-xl p-3 bg-white flex flex-col gap-2">
          <div className="flex gap-2 items-center flex-wrap">
            <input
              className="border border-neutral-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px] font-bold"
              placeholder="제목"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <select
              className="border border-neutral-300 rounded-lg px-2 py-2 text-sm"
              value={form.importance}
              onChange={(e) => setForm({ ...form, importance: e.target.value as Notice["importance"] })}
            >
              {IMPORTANCE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <input
              className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-28"
              placeholder="작성자"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
            />
            <label className="text-xs font-bold text-neutral-500 flex items-center gap-1">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
              상단 고정
            </label>
          </div>
          <textarea
            className="border border-neutral-300 rounded-lg px-3 py-2 text-sm min-h-28"
            placeholder="내용을 입력해주세요"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <button
              className="bg-emerald-600 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-60"
              onClick={createNotice}
              disabled={saving}
            >
              {saving ? "등록 중..." : "등록"}
            </button>
            {msg && <span className="text-xs text-rose-600">{msg}</span>}
          </div>
        </div>
      )}

      {loading && <div className="text-center text-sm text-neutral-400 py-10">불러오는 중...</div>}
      {loadError && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">{loadError}</div>
      )}

      {!loading && !loadError && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 items-start">
          {rows.map((n) => (
            <div
              key={n.id}
              className={`border border-neutral-300 rounded-xl p-3 bg-white ${editingId === n.id ? "col-span-full" : ""}`}
            >
              {editingId === n.id ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-center flex-wrap">
                    <input
                      className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px] font-bold"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                    <select
                      className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm"
                      value={editForm.importance}
                      onChange={(e) => setEditForm({ ...editForm, importance: e.target.value as Notice["importance"] })}
                    >
                      {IMPORTANCE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    <input
                      className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm w-24"
                      value={editForm.author}
                      onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                    />
                    <label className="text-xs font-bold text-neutral-500 flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={editForm.pinned}
                        onChange={(e) => setEditForm({ ...editForm, pinned: e.target.checked })}
                      />
                      고정
                    </label>
                  </div>
                  <textarea
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm min-h-24"
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <button
                      className="bg-emerald-600 text-white text-xs font-bold rounded-lg px-3 py-1.5 disabled:opacity-60"
                      onClick={() => saveEdit(n.id)}
                      disabled={saving}
                    >
                      저장
                    </button>
                    <button
                      className="text-xs font-bold text-neutral-500 border border-neutral-300 rounded-lg px-3 py-1.5"
                      onClick={() => setEditingId(null)}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    {n.pinned && <span className="text-xs">📌</span>}
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${IMPORTANCE_STYLE[n.importance]}`}>
                      {n.importance}
                    </span>
                  </div>
                  <div className="font-extrabold text-neutral-800 break-words mb-1">{n.title}</div>
                  <div className="text-[11px] text-neutral-400 mb-2">
                    {n.author ? `${n.author} · ` : ""}
                    {fmtDate(n.created_at)}
                  </div>
                  <div className="text-sm text-neutral-600 whitespace-pre-line break-words mb-2">{n.content}</div>
                  <div className="flex gap-2 flex-wrap">
                    <button className="text-xs font-bold text-neutral-500 underline" onClick={() => togglePin(n)}>
                      {n.pinned ? "고정 해제" : "상단 고정"}
                    </button>
                    <button className="text-xs font-bold text-neutral-500 underline" onClick={() => startEdit(n)}>
                      수정
                    </button>
                    <button className="text-xs font-bold text-rose-500 underline" onClick={() => deleteNotice(n.id)}>
                      삭제
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {!rows.length && (
            <div className="col-span-full text-center text-sm text-neutral-400 py-10">등록된 공지가 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}
