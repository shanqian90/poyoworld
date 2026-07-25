"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sanitizePasswordInput } from "@/lib/password";

export default function StaffLoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function doLogin() {
    if (!loginId.trim()) {
      setError("아이디를 입력해주세요");
      return;
    }
    if (password.length < 4) {
      setError("비밀번호는 4자 이상 입력해주세요");
      return;
    }
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: loginId.trim(), password, remember }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || "로그인에 실패했습니다");
        return;
      }
      if (data.mode === "claimed") setInfo("🎉 비밀번호가 등록되었어요!");
      router.replace("/staff");
    } catch {
      setError("로그인 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm bg-white border-2 border-neutral-800 rounded-3xl p-6 shadow-lg">
        <div className="text-center text-2xl font-extrabold text-neutral-800 mb-1">👔 직원 로그인</div>
        <div className="text-center text-sm text-neutral-500 mb-4">출퇴근인증</div>
        <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-3 text-xs text-neutral-500 leading-relaxed text-center mb-4">
          아이디와 비밀번호를 입력해주세요
          <br />
          처음이면 지금 입력한 비밀번호로 자동 등록됩니다
        </div>

        <label className="block text-sm font-bold text-neutral-700 mb-1">아이디</label>
        <input
          className="w-full border border-neutral-300 rounded-xl px-3 py-3 text-sm outline-none focus:border-neutral-800 mb-3"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doLogin()}
        />
        <label className="block text-sm font-bold text-neutral-700 mb-1">비밀번호</label>
        <input
          type="password"
          className="w-full border border-neutral-300 rounded-xl px-3 py-3 text-sm outline-none focus:border-neutral-800"
          value={password}
          onChange={(e) => setPassword(sanitizePasswordInput(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && doLogin()}
        />

        <label className="flex items-center gap-2 mt-3 text-xs font-bold text-neutral-600">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          자동로그인 (이 기기에서 로그인 상태 유지)
        </label>

        <button
          className="w-full mt-4 bg-neutral-800 text-white font-extrabold rounded-xl py-3 disabled:opacity-60"
          onClick={doLogin}
          disabled={loading}
        >
          {loading ? "확인 중..." : "로그인"}
        </button>

        {info && (
          <div className="mt-3 bg-green-50 border border-green-300 text-green-800 text-sm rounded-xl px-3 py-2">{info}</div>
        )}
        {error && (
          <div className="mt-3 bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2 whitespace-pre-line">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
