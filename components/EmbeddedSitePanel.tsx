"use client";

import { useState } from "react";
import Link from "next/link";

export default function EmbeddedSitePanel({
  emoji,
  title,
  path,
  iframeTitle,
}: {
  emoji: string;
  title: string;
  path: string;
  iframeTitle: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">
          {emoji} {title}
        </div>
      </div>

      <div className="border border-neutral-300 rounded-xl px-3 py-2 flex items-center gap-2 bg-neutral-50">
        <span className="text-xs font-bold text-neutral-500 shrink-0">🔗 URL</span>
        <span className="text-xs text-neutral-600 flex-1 truncate">{url}</span>
        <button
          className="text-xs bg-neutral-700 text-white font-bold rounded-lg px-3 py-1.5 shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "복사됨!" : "복사"}
        </button>
        <a href={path} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-700 underline shrink-0">
          새 탭에서 열기 →
        </a>
      </div>

      <div className="border border-neutral-300 rounded-xl overflow-hidden flex-1 bg-white">
        <iframe src={path} className="w-full h-full min-h-[600px]" title={iframeTitle} />
      </div>
    </div>
  );
}
