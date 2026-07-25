import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

const TABLES = ["orders", "work_requests", "vendors", "notices", "accounts", "blacklist", "whitelist"] as const;

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const entries = await Promise.all(
    TABLES.map(async (table) => {
      try {
        const { data } = await supabase.from(table).select("created_at").order("created_at", { ascending: false }).limit(1);
        return [table, data?.[0]?.created_at || null] as const;
      } catch {
        return [table, null] as const;
      }
    })
  );

  return NextResponse.json({ ok: true, latest: Object.fromEntries(entries) });
}
