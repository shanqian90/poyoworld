"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getVendorLoginId, setVendorLoginId } from "@/lib/vendorSession";
import { formatPhoneLive } from "@/lib/phone";
import { sanitizePasswordInput } from "@/lib/password";
import TrustCounters from "@/components/TrustCounters";

export default function VendorLoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (getVendorLoginId()) router.replace("/vendor");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doLogin() {
    const id = loginId.trim();
    if (!id) {
      setError("아이디(전화번호 또는 이메일)를 입력해주세요");
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
      if (data.mode === "signup") setInfo("🎉 신규 가입 완료!");
      if (data.mode === "claimed") setInfo("🎉 비밀번호가 등록되었어요!");
      setVendorLoginId(id);
      router.replace("/vendor");
    } catch {
      setError("로그인 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex gap-2 mb-3">
          <a
            href="https://docs.google.com/document/d/1WwjhBng7zMI1GCiR0dTb2JUbqVlnCqAAkvgFXC0tZkA/edit?tab=t.0"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center bg-white border border-emerald-200 rounded-xl py-2.5 text-sm font-bold text-emerald-700"
          >
            📋 진행안내
          </a>
          <a
            href="https://open.kakao.com/o/sCwvgAji"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center bg-white border border-emerald-200 rounded-xl py-2.5 text-sm font-bold text-emerald-700"
          >
            💬 1:1 문의
          </a>
        </div>
        <TrustCounters />
      <div className="w-full bg-white border-2 border-emerald-200 rounded-3xl p-6 shadow-lg shadow-emerald-100">
        <div className="text-center text-2xl font-extrabold text-emerald-700 mb-1">🏢 업체 로그인</div>
        <div className="text-center text-sm text-neutral-500 mb-4">작업요청서 제출</div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-neutral-500 leading-relaxed text-center mb-4">
          아이디(전화번호/이메일)와 비밀번호를 입력해주세요
          <br />
          처음이면 자동 가입됩니다 😊
        </div>

        <label className="block text-sm font-bold text-emerald-700 mb-1">아이디</label>
        <input
          className="w-full border border-emerald-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-emerald-500 mb-3"
          placeholder="전화번호 또는 이메일"
          value={loginId}
          onChange={(e) => setLoginId(formatPhoneLive(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && doLogin()}
        />
        <label className="block text-sm font-bold text-emerald-700 mb-1">비밀번호 (영문/숫자/특수문자, 4자 이상)</label>
        <input
          type="password"
          className="w-full border border-emerald-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-emerald-500"
          value={password}
          onChange={(e) => setPassword(sanitizePasswordInput(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && doLogin()}
        />

        <button
          className="w-full mt-4 bg-emerald-600 text-white font-extrabold rounded-xl py-3 disabled:opacity-60"
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
    </div>
  );
}
