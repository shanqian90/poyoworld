import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkBlocked } from "@/lib/blacklist";
import { extFromMime, parseDataUrl, uploadImage } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rowId = Number(body.rowId);
    const images: string[] = Array.isArray(body.images) ? body.images : [];
    if (!rowId) return fail("rowId가 없습니다");
    if (!images.length) return fail("업로드할 이미지가 없습니다");

    const { data: row, error: rowErr } = await supabase
      .from("orders")
      .select("id, phone, receiver, order_no, paid")
      .eq("id", rowId)
      .single();
    if (rowErr || !row) return fail("주문 정보를 찾을 수 없습니다");
    if (!row.order_no || !row.receiver) return fail("주문 정보가 없는 행입니다");

    const block = await checkBlocked(supabase, { phones: [row.phone] });
    if (block.blocked) return fail(block.reason || "차단되었습니다", 403);

    const uploaded: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const { mime } = parseDataUrl(images[i]);
      const ext = extFromMime(mime);
      const path = `${rowId}/${Date.now()}_${i + 1}.${ext}`;
      uploaded.push(await uploadImage(supabase, "review-images", path, images[i]));
    }

    const { error: updErr } = await supabase
      .from("orders")
      .update({ review_url: uploaded.join("\n"), review_done: true })
      .eq("id", rowId);
    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ ok: true, count: uploaded.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "업로드 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}
