"use client";

import { useEffect, useState } from "react";

function seedFromToday(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export default function TrustCounters() {
  const [joined, setJoined] = useState(0);
  const [salesUp, setSalesUp] = useState(0);

  useEffect(() => {
    const seed = seedFromToday();
    const baseJoined = 120 + (seed % 47);
    const baseSalesUp = 180 + (seed % 65);
    setJoined(baseJoined);
    setSalesUp(baseSalesUp);

    const timer = setInterval(() => {
      setJoined((v) => v + (Math.random() < 0.35 ? 1 : 0));
      setSalesUp((v) => Math.min(999, v + (Math.random() < 0.2 ? 1 : 0)));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <div className="bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-center">
        <div className="text-[11px] font-bold text-neutral-400">🔥 오늘 참여</div>
        <div className="text-lg font-extrabold text-emerald-700 tabular-nums">{joined.toLocaleString("ko-KR")}명</div>
      </div>
      <div className="bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-center">
        <div className="text-[11px] font-bold text-neutral-400">📈 시작 후 매출상승</div>
        <div className="text-lg font-extrabold text-emerald-700 tabular-nums">+{salesUp.toLocaleString("ko-KR")}%</div>
      </div>
    </div>
  );
}
