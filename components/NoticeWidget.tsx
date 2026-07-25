"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Notice } from "@/lib/types";

const IMPORTANCE_STYLE: Record<Notice["importance"], string> = {
  일반: "bg-neutral-100 text-neutral-600",
  중요: "bg-amber-100 text-amber-700",
  긴급: "bg-rose-100 text-rose-700",
};

const SEEN_KEY = "poyo_notice_seen_ids";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function NoticeWidget() {
  const [rows, setRows] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("notices")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return;
    const list = (data || []) as Notice[];
    setRows(list);

    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    } catch {
      /* ignore */
    }
    const seenSet = new Set(seen);
    setUnseenCount(list.filter((n) => !seenSet.has(n.id)).length);
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(rows.map((r) => r.id)));
      } catch {
        /* ignore */
      }
      setUnseenCount(0);
    }
  }

  if (!rows.length) return null;

  return (
    <div className="mb-3 border border-rose-200 rounded-xl bg-rose-50/60 overflow-hidden">
      <button className="w-full flex items-center gap-2 px-3 py-2.5 text-left" onClick={toggleOpen}>
        <span className="text-sm">📌</span>
        <span className="text-sm font-extrabold text-rose-600 flex-1">중요사항</span>
        {unseenCount > 0 && (
          <span className="text-[11px] font-bold bg-rose-500 text-white rounded-full px-2 py-0.5">새 글 {unseenCount}</span>
        )}
        <span className="text-xs text-neutral-400">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {open && (
        <div className="border-t border-rose-200 flex flex-col divide-y divide-rose-100">
          {rows.map((n) => (
            <div key={n.id} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                {n.pinned && <span className="text-xs">📌</span>}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${IMPORTANCE_STYLE[n.importance]}`}>
                  {n.importance}
                </span>
                <span className="text-sm font-extrabold text-neutral-800">{n.title}</span>
                <span className="text-[11px] text-neutral-400 ml-auto">{fmtDate(n.created_at)}</span>
              </div>
              <div className="text-xs text-neutral-600 whitespace-pre-line">{n.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
