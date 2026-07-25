import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다" }, { status: 401 });
  }

  const PAGE_SIZE = 1000;
  const rows: Record<string, unknown>[] = [];
  let loadError: string | null = null;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("kakao_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      loadError = error.message;
      break;
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return NextResponse.json({ ok: true, rows, loadError });
}

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      kakao_id: "",
      store: "새 계정",
      buyer: "",
      receiver: "",
      user_id: "",
      phone: "",
      address: "",
      bank: "",
      account_no: "",
      holder: "",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, row: data });
}
