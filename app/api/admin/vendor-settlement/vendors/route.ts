import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const [vendorsRes, requestsRes] = await Promise.all([
    supabase.from("vendors").select("login_id, company_code, company_name").order("login_id", { ascending: true }),
    supabase.from("work_requests").select("login_id, start_date"),
  ]);

  if (vendorsRes.error) return NextResponse.json({ ok: false, message: vendorsRes.error.message }, { status: 500 });
  if (requestsRes.error) return NextResponse.json({ ok: false, message: requestsRes.error.message }, { status: 500 });

  const lastRequestDate = new Map<string, string>();
  (requestsRes.data || []).forEach((r) => {
    const loginId = (r.login_id || "").trim();
    if (!loginId || !r.start_date) return;
    const cur = lastRequestDate.get(loginId);
    if (!cur || r.start_date > cur) lastRequestDate.set(loginId, r.start_date);
  });

  const grouped = new Map<
    string,
    { loginId: string; companies: { code: string | null; name: string }[]; lastRequestDate: string | null }
  >();
  for (const v of vendorsRes.data || []) {
    const loginId = (v.login_id || "").trim();
    if (!loginId) continue;
    if (!grouped.has(loginId)) grouped.set(loginId, { loginId, companies: [], lastRequestDate: lastRequestDate.get(loginId) || null });
    grouped.get(loginId)!.companies.push({ code: v.company_code, name: v.company_name });
  }

  return NextResponse.json({ ok: true, vendors: Array.from(grouped.values()) });
}
