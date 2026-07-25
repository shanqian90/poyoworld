"use client";

import { useEffect, useState } from "react";

function seedFromToday(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

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
    <div className="bg-white border border-emerald-800 rounded-2xl px-4 py-3 mb-3 flex items-center justify-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-800 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-900" />
      </span>
      <span className="text-sm text-neutral-600">
        오늘 <span className="font-extrabold text-emerald-900 tabular-nums">{joined.toLocaleString("ko-KR")}</span>명이
        체험단에 참여했어요
      </span>
    </div>
  );
}
