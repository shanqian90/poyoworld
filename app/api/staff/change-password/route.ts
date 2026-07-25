import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { STAFF_COOKIE, verifyStaffToken } from "@/lib/staffAuth";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const staffId = verifyStaffToken(cookieStore.get(STAFF_COOKIE)?.value);
  if (!staffId) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { error } = await supabase.rpc("staff_change_password", {
      p_staff_id: staffId,
      p_old_password: body.oldPassword ? String(body.oldPassword) : null,
      p_new_password: String(body.newPassword || ""),
    });
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "변경 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
