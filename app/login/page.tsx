"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getKakaoId, setKakaoId } from "@/lib/session";
import { sanitizePasswordInput } from "@/lib/password";

export default function LoginPage() {
  const router = useRouter();
  const [kakaoId, setKakaoIdInput] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (getKakaoId()) router.replace("/home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doLogin() {
    const id = kakaoId.trim();
    if (!id) {
      setError("카카오톡 아이디를 입력해주세요");
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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kakaoId: id, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || "로그인에 실패했습니다");
        return;
      }
      if (data.mode === "signup") setInfo("🎉 신규 가입 완료! 바로 시작할게요");
      if (data.mode === "claimed") setInfo("🎉 비밀번호가 등록되었어요! 다음부터 이 비밀번호로 로그인하세요");
      setKakaoId(id);
      router.replace("/home");
    } catch {
      setError("로그인 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border-2 border-rose-200 rounded-3xl p-6 shadow-lg shadow-rose-200/40">
        <div className="text-center text-2xl font-extrabold text-rose-500 mb-1">
          🌸 구매제출 🌸
        </div>
        <div className="text-center text-sm text-neutral-500 mb-4">진행자 로그인</div>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-neutral-500 leading-relaxed text-center mb-4">
          아이디와 비밀번호를 입력해주세요
          <br />
          처음이면 자동 가입, 기존 아이디면 비밀번호가 그대로 등록됩니다 😊
        </div>

        <label className="block text-sm font-bold text-rose-600 mb-1">💬 카카오톡 아이디</label>
        <input
          className="w-full border border-rose-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-rose-400 mb-3"
          placeholder="예: hong1234"
          value={kakaoId}
          onChange={(e) => setKakaoIdInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doLogin()}
        />

        <label className="block text-sm font-bold text-rose-600 mb-1">🔒 비밀번호 (영문/숫자/특수문자, 4자 이상)</label>
        <input
          type="password"
          className="w-full border border-rose-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-rose-400"
          value={password}
          onChange={(e) => setPassword(sanitizePasswordInput(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && doLogin()}
        />

        <button
          className="w-full mt-4 bg-gradient-to-r from-rose-400 to-rose-500 text-white font-extrabold rounded-xl py-3 disabled:opacity-60"
          onClick={doLogin}
          disabled={loading}
        >
          {loading ? "확인 중..." : "🌸 로그인"}
        </button>

        {info && (
          <div className="mt-3 bg-green-50 border border-green-300 text-green-800 text-sm rounded-xl px-3 py-2 whitespace-pre-line">
            {info}
          </div>
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
