"use client";

import { useEffect, useState } from "react";
import { GuideProduct } from "@/lib/types";
import { buildKakaoGuide } from "@/lib/kakaoGuide";

const FORM_LINK_KEY = "kakao_guide_form_link";

export default function KakaoGuideModal({
  row,
  onClose,
}: {
  row: GuideProduct;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("쿠/실/로켓");
  const [product, setProduct] = useState("");
  const [reviewGuide, setReviewGuide] = useState("");
  const [formLink, setFormLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const num = (row.number_text || "").trim();
    setProduct(`${num ? num + " " : ""}${row.short_name}`.trim());
    setReviewGuide(row.review_type || "");
    const saved = localStorage.getItem(FORM_LINK_KEY);
    setFormLink(saved || `${window.location.origin}/login`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  function updateFormLink(v: string) {
    setFormLink(v);
    localStorage.setItem(FORM_LINK_KEY, v);
  }

  const preview = buildKakaoGuide({ title, product, reviewGuide, formLink });

  async function copy() {
    try {
      await navigator.clipboard.writeText(preview);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = preview;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-extrabold text-neutral-700">🌷 카카오톡 가이드 생성기</div>
          <button className="text-neutral-400 font-bold px-1" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          <label className="text-xs font-bold text-rose-500">첫 줄</label>
          <input
            className="border border-rose-200 rounded-lg px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="text-xs font-bold text-rose-500">제품명 (숫자 입력시 자동으로 "N번" 변환, 줄바꿈 가능)</label>
          <textarea
            className="border border-rose-200 rounded-lg px-3 py-2 text-sm"
            rows={2}
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          />
          <label className="text-xs font-bold text-rose-500">리뷰 가이드 (여러 줄 가능)</label>
          <textarea
            className="border border-rose-200 rounded-lg px-3 py-2 text-sm"
            rows={2}
            value={reviewGuide}
            onChange={(e) => setReviewGuide(e.target.value)}
          />
          <label className="text-xs font-bold text-rose-500">구매폼 링크</label>
          <input
            className="border border-rose-200 rounded-lg px-3 py-2 text-sm"
            value={formLink}
            onChange={(e) => updateFormLink(e.target.value)}
          />
        </div>

        <button
          className={`w-full rounded-xl py-3 font-extrabold mb-3 ${
            copied ? "bg-rose-100 text-rose-700" : "bg-gradient-to-r from-rose-400 to-rose-500 text-white"
          }`}
          onClick={copy}
        >
          {copied ? "✓ 복사 완료!" : "📋 복사하기"}
        </button>

        <div className="text-xs font-bold text-neutral-500 mb-1">미리보기</div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs whitespace-pre-wrap break-all font-mono text-neutral-700 max-h-72 overflow-y-auto">
          {preview}
        </div>
      </div>
    </div>
  );
}
