import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import type { AdminOrderRow } from "@/components/AdminOrdersTable";

function isGroupStart(seq: string | null): boolean {
  if (!seq) return false;
  const m = String(seq).trim().match(/-\s*(\d+)\s*$/);
  return !!(m && Number(m[1]) === 1);
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const PAGE_SIZE = 1000;
  let all: AdminOrderRow[] = [];
  let loadError: string | null = null;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("hidden_from_active", false)
      .gte("created_at", cutoff.toISOString())
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      loadError = error.message;
      break;
    }
    all = all.concat((data || []) as AdminOrderRow[]);
    if (!data || data.length < PAGE_SIZE) break;
  }

  let groupIdx = -1;
  const colored = all.map((r) => {
    if (isGroupStart(r.seq)) groupIdx++;
    const color: "a" | "b" | null = groupIdx < 0 ? null : groupIdx % 2 === 0 ? "a" : "b";
    return { ...r, _group: color };
  });

  return NextResponse.json({ ok: true, rows: colored, loadError });
}
