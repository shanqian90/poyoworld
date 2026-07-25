import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { STAFF_COOKIE, verifyStaffToken } from "@/lib/staffAuth";

export async function GET() {
  const cookieStore = await cookies();
  const staffId = verifyStaffToken(cookieStore.get(STAFF_COOKIE)?.value);
  if (!staffId) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_staff_profile", { p_staff_id: staffId });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, profile: data });
}
