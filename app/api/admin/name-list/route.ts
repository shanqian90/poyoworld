import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  return isValidAdminToken(token);
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  const [bl, wl] = await Promise.all([
    supabase.from("blacklist").select("id, value, reason").eq("type", "name").order("created_at", { ascending: true }),
    supabase.from("whitelist").select("id, value, note").eq("type", "name").order("created_at", { ascending: true }),
  ]);
  if (bl.error) return NextResponse.json({ ok: false, message: bl.error.message }, { status: 500 });
  if (wl.error) return NextResponse.json({ ok: false, message: wl.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, blacklist: bl.data || [], whitelist: wl.data || [] });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  const body = await req.json();
  const kind = body.kind === "whitelist" ? "whitelist" : "blacklist";
  const table = kind === "whitelist" ? "whitelist" : "blacklist";

  if (Array.isArray(body.entries)) {
    const rows = body.entries
      .map((e: { value?: string; reason?: string; note?: string }) => {
        const value = String(e.value || "").trim();
        if (!value) return null;
        const extra = kind === "whitelist" ? { note: e.note || null } : { reason: e.reason || null };
        return { type: "name", value, ...extra };
      })
      .filter(Boolean);
    if (!rows.length) return NextResponse.json({ ok: false, message: "추가할 이름이 없습니다" }, { status: 400 });
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "type,value", ignoreDuplicates: true });
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: rows.length });
  }

  const value = String(body.value || "").trim();
  if (!value) return NextResponse.json({ ok: false, message: "이름을 입력해주세요" }, { status: 400 });
  const extra = kind === "whitelist" ? { note: body.note || null } : { reason: body.reason || null };
  const { error } = await supabase.from(table).insert({ type: "name", value, ...extra });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  const body = await req.json();
  const kind = body.kind === "whitelist" ? "whitelist" : "blacklist";
  const table = kind === "whitelist" ? "whitelist" : "blacklist";
  const id = String(body.id || "");
  const field = body.field === "reason" || body.field === "note" ? body.field : "value";
  if (!id) return NextResponse.json({ ok: false, message: "잘못된 요청입니다" }, { status: 400 });
  const value = field === "value" ? String(body.value || "").trim() : body.value || null;
  if (field === "value" && !value) return NextResponse.json({ ok: false, message: "이름을 입력해주세요" }, { status: 400 });
  const { error } = await supabase.from(table).update({ [field]: value }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") === "whitelist" ? "whitelist" : "blacklist";
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, message: "잘못된 요청입니다" }, { status: 400 });
  const { error } = await supabase.from(kind).delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
