import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { extFromMime, parseDataUrl, safeFolderName, toKoreanErrorMessage, uploadImage } from "@/lib/storage";

const FIELD_BUCKET: Record<string, string> = {
  order_image: "purchase-images",
  review_url: "review-images",
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const field = String(body.field || "");
    const imageDataUrl = String(body.imageDataUrl || "");
    const bucket = FIELD_BUCKET[field];
    if (!bucket) return NextResponse.json({ ok: false, message: "지원하지 않는 항목입니다" }, { status: 400 });
    if (!imageDataUrl) return NextResponse.json({ ok: false, message: "이미지가 없습니다" }, { status: 400 });

    const { data: row, error: rowErr } = await supabase
      .from("orders")
      .select("id, company_code, company_name, date_mmdd")
      .eq("id", id)
      .single();
    if (rowErr || !row) return NextResponse.json({ ok: false, message: "주문을 찾을 수 없습니다" }, { status: 404 });

    const { mime } = parseDataUrl(imageDataUrl);
    const ext = extFromMime(mime);
    const companyFolder = safeFolderName(row.company_code, row.company_name);
    const path = `${row.date_mmdd}/${companyFolder}/${id}_${Date.now()}.${ext}`;
    const url = await uploadImage(supabase, bucket, path, imageDataUrl);

    const { error } = await supabase.from("orders").update({ [field]: url }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    const message = err instanceof Error ? toKoreanErrorMessage(err.message) : "업로드 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
