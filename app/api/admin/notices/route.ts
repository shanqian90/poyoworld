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
  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data || [] });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  const body = await req.json();
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  const importance = ["일반", "중요", "긴급"].includes(body.importance) ? body.importance : "일반";
  const pinned = !!body.pinned;
  const author = body.author ? String(body.author).trim() : null;

  if (!title) return NextResponse.json({ ok: false, message: "제목을 입력해주세요" }, { status: 400 });
  if (!content) return NextResponse.json({ ok: false, message: "내용을 입력해주세요" }, { status: 400 });

  const { data, error } = await supabase
    .from("notices")
    .insert({ title, content, importance, pinned, author })
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ ok: false, message: "잘못된 요청입니다" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.content !== undefined) patch.content = String(body.content).trim();
  if (body.importance !== undefined && ["일반", "중요", "긴급"].includes(body.importance)) patch.importance = body.importance;
  if (body.pinned !== undefined) patch.pinned = !!body.pinned;
  if (body.author !== undefined) patch.author = body.author ? String(body.author).trim() : null;

  const { data, error } = await supabase.from("notices").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, message: "잘못된 요청입니다" }, { status: 400 });
  const { error } = await supabase.from("notices").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
