import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { extFromMime, parseDataUrl, uploadImage } from "@/lib/storage";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const imageDataUrl = String(body.imageDataUrl || "");
    if (!imageDataUrl) return NextResponse.json({ ok: false, message: "이미지가 없습니다" }, { status: 400 });

    const { mime } = parseDataUrl(imageDataUrl);
    const ext = extFromMime(mime);
    const path = `${id}/${Date.now()}.${ext}`;
    const url = await uploadImage(supabase, "guide-images", path, imageDataUrl);

    const { error } = await supabase.from("guide_products").update({ image_url: url }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "업로드 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
