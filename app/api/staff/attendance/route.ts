import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { STAFF_COOKIE, verifyStaffToken } from "@/lib/staffAuth";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function toMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

async function requireStaffId() {
  const cookieStore = await cookies();
  return verifyStaffToken(cookieStore.get(STAFF_COOKIE)?.value);
}

export async function GET() {
  const staffId = await requireStaffId();
  if (!staffId) return NextResponse.json({ ok: false, message: "로그인이 필요합니다" }, { status: 401 });

  const { data, error } = await supabase
    .from("staff_attendance")
    .select("*")
    .eq("staff_id", staffId)
    .order("work_date", { ascending: false });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, rows: data || [] });
}

export async function POST() {
  const staffId = await requireStaffId();
  if (!staffId) return NextResponse.json({ ok: false, message: "로그인이 필요합니다" }, { status: 401 });

  const workDate = todayISO();
  const { data: existing } = await supabase
    .from("staff_attendance")
    .select("id, clock_in")
    .eq("staff_id", staffId)
    .eq("work_date", workDate)
    .maybeSingle();

  if (existing?.clock_in) {
    return NextResponse.json({ ok: false, message: "오늘은 이미 출근 처리되었습니다" }, { status: 400 });
  }

  const clockIn = nowHM();
  const { error } = existing
    ? await supabase.from("staff_attendance").update({ clock_in: clockIn }).eq("id", existing.id)
    : await supabase.from("staff_attendance").insert({ staff_id: staffId, work_date: workDate, clock_in: clockIn });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, clockIn });
}

export async function PATCH() {
  const staffId = await requireStaffId();
  if (!staffId) return NextResponse.json({ ok: false, message: "로그인이 필요합니다" }, { status: 401 });

  const workDate = todayISO();
  const { data: existing } = await supabase
    .from("staff_attendance")
    .select("id, clock_in, clock_out, lunch_minutes")
    .eq("staff_id", staffId)
    .eq("work_date", workDate)
    .maybeSingle();

  if (!existing?.clock_in) {
    return NextResponse.json({ ok: false, message: "출근 기록이 없습니다" }, { status: 400 });
  }
  if (existing.clock_out) {
    return NextResponse.json({ ok: false, message: "오늘은 이미 퇴근 처리되었습니다" }, { status: 400 });
  }

  const { data: profile, error: profileErr } = await supabase.rpc("get_staff_profile", { p_staff_id: staffId });
  if (profileErr) return NextResponse.json({ ok: false, message: profileErr.message }, { status: 500 });

  const clockOut = nowHM();
  const lunchMinutes = Number(existing.lunch_minutes) || 0;
  const minutes = Math.max(0, toMinutes(clockOut) - toMinutes(existing.clock_in) - lunchMinutes);
  const hours = Math.round((minutes / 60) * 100) / 100;
  const hourlyWage = Number(profile.hourlyWage) || 0;
  const dailyPay = Math.round(hours * hourlyWage);
  const netPay = profile.withholdTax ? Math.round(dailyPay * 0.967) : dailyPay;

  const { error } = await supabase
    .from("staff_attendance")
    .update({ clock_out: clockOut, hours, hourly_wage: hourlyWage, daily_pay: dailyPay, net_pay: netPay })
    .eq("id", existing.id);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, clockOut, hours, dailyPay, netPay });
}

export async function PUT(req: NextRequest) {
  const staffId = await requireStaffId();
  if (!staffId) return NextResponse.json({ ok: false, message: "로그인이 필요합니다" }, { status: 401 });

  const body = await req.json();
  const lunchMinutes = Math.max(0, Number(body.lunchMinutes) || 0);

  const workDate = todayISO();
  const { data: existing } = await supabase
    .from("staff_attendance")
    .select("id, clock_in, clock_out")
    .eq("staff_id", staffId)
    .eq("work_date", workDate)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ ok: false, message: "출근 기록이 없습니다" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { lunch_minutes: lunchMinutes };

  if (existing.clock_in && existing.clock_out) {
    const { data: profile, error: profileErr } = await supabase.rpc("get_staff_profile", { p_staff_id: staffId });
    if (profileErr) return NextResponse.json({ ok: false, message: profileErr.message }, { status: 500 });

    const minutes = Math.max(0, toMinutes(existing.clock_out) - toMinutes(existing.clock_in) - lunchMinutes);
    const hours = Math.round((minutes / 60) * 100) / 100;
    const hourlyWage = Number(profile.hourlyWage) || 0;
    const dailyPay = Math.round(hours * hourlyWage);
    const netPay = profile.withholdTax ? Math.round(dailyPay * 0.967) : dailyPay;
    Object.assign(patch, { hours, hourly_wage: hourlyWage, daily_pay: dailyPay, net_pay: netPay });
  }

  const { error } = await supabase.from("staff_attendance").update(patch).eq("id", existing.id);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
