"use client";

import { useEffect, useState } from "react";

function seedFromToday(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const CURVE_PATH = "M4,50 C55,50 85,44 110,32 C140,17 165,10 196,6";

export default function TrustCounters() {
  const [joined, setJoined] = useState(0);

  useEffect(() => {
    const seed = seedFromToday();
    setJoined(120 + (seed % 47));
    const timer = setInterval(() => {
      setJoined((v) => v + (Math.random() < 0.35 ? 1 : 0));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-[1fr_1.6fr] gap-2 mb-3">
      <div className="bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-center flex flex-col justify-center">
        <div className="text-[11px] font-bold text-neutral-400">🔥 오늘 참여</div>
        <div className="text-lg font-extrabold text-emerald-700 tabular-nums">{joined.toLocaleString("ko-KR")}명</div>
      </div>

      <div className="bg-white border border-emerald-200 rounded-xl px-3 py-2 relative overflow-hidden">
        <div className="text-[11px] font-bold text-neutral-400 mb-0.5">📊 체험단 진행 효과</div>
        <svg viewBox="0 0 200 60" className="w-full h-9">
          <line x1="4" y1="50" x2="196" y2="50" stroke="#d4d4d4" strokeWidth="2" strokeDasharray="4 3" />
          <path d={CURVE_PATH} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
          <circle r="3.5" fill="#059669">
            <animateMotion dur="2.6s" repeatCount="indefinite" path={CURVE_PATH} />
          </circle>
          <circle r="6" fill="#059669" opacity="0.25">
            <animateMotion dur="2.6s" repeatCount="indefinite" path={CURVE_PATH} />
            <animate attributeName="r" values="4;8;4" dur="1.3s" repeatCount="indefinite" />
          </circle>
        </svg>
        <div className="flex justify-between text-[10px] font-bold px-0.5">
          <span className="text-neutral-400">체험단 미진행 0%</span>
          <span className="text-emerald-600">진행 후 매출 상승 ↑</span>
        </div>
      </div>
    </div>
  );
}
