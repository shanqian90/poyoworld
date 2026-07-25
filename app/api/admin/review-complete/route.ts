import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

type GroupInput = { key: string; code: string; company: string; product: string; startMmdd: string };

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const groups: GroupInput[] = Array.isArray(body.groups) ? body.groups : [];
  if (!groups.length) return NextResponse.json({ ok: true, fresh: [] });

  const keys = groups.map((g) => g.key);
  const { data: seenRows, error } = await supabase.from("review_complete_seen").select("seen_key").in("seen_key", keys);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const seenSet = new Set((seenRows || []).map((r) => r.seen_key));
  const fresh = groups.filter((g) => !seenSet.has(g.key));

  if (fresh.length) {
    const { error: insErr } = await supabase
      .from("review_complete_seen")
      .insert(fresh.map((g) => ({ seen_key: g.key })));
    if (insErr) return NextResponse.json({ ok: false, message: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fresh });
}
