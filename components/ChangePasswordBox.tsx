"use client";

import { useState } from "react";

export default function ChangePasswordBox({ kakaoId }: { kakaoId: string }) {
  const [open, setOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit() {
    setMsg("");
    if (newPassword.length < 4) {
      setMsg("새 비밀번호는 4자 이상 입력해주세요");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kakaoId, oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg("❌ " + (data.message || "변경 실패"));
        return;
      }
      setMsg("✅ 비밀번호가 변경되었습니다");
      setOldPassword("");
      setNewPassword("");
    } catch {
      setMsg("❌ 처리 중 오류가 발생했습니다");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-xs">
      <button className="underline text-neutral-500" onClick={() => setOpen((v) => !v)}>
        {open ? "비밀번호 변경 닫기" : "🔑 비밀번호 변경"}
      </button>
      {open && (
        <div className="mt-2 border border-neutral-200 rounded-xl p-2.5 flex flex-col gap-1.5 bg-neutral-50">
          <input
            type="password"
            className="border border-neutral-300 rounded-lg px-2 py-1.5 text-xs"
            placeholder="현재 비밀번호"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
          <input
            type="password"
            className="border border-neutral-300 rounded-lg px-2 py-1.5 text-xs"
            placeholder="새 비밀번호 (4자 이상)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            className="bg-neutral-800 text-white rounded-lg py-1.5 text-xs font-bold disabled:opacity-60"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "변경 중..." : "변경하기"}
          </button>
          {msg && <div>{msg}</div>}
        </div>
      )}
    </div>
  );
}
