"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function OwnerLoginPage() {
  return (
    <Suspense fallback={null}>
      <OwnerLoginForm />
    </Suspense>
  );
}

function OwnerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function doLogin() {
    if (!password) {
      setError("비밀번호를 입력해주세요");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/owner-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || "로그인 실패");
        return;
      }
      const next = searchParams.get("next") || "/admin/revenue";
      router.replace(next);
      router.refresh();
    } catch {
      setError("로그인 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-screen">
      <div className="w-full max-w-sm bg-white border-2 border-neutral-300 rounded-3xl p-6 shadow-lg">
        <div className="text-center text-xl font-extrabold text-neutral-700 mb-1">🔒 관리자 전용</div>
        <div className="text-center text-sm text-neutral-500 mb-4">사장님 · 담당자만 접근 가능합니다</div>

        <label className="block text-sm font-bold text-neutral-600 mb-1">비밀번호</label>
        <input
          type="password"
          className="w-full border border-neutral-300 rounded-xl px-3 py-3 text-sm outline-none focus:border-neutral-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doLogin()}
          autoFocus
        />
        <button
          className="w-full mt-4 bg-neutral-800 text-white font-extrabold rounded-xl py-3 disabled:opacity-60"
          onClick={doLogin}
          disabled={loading}
        >
          {loading ? "확인 중..." : "확인"}
        </button>
        {error && (
          <div className="mt-3 bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
