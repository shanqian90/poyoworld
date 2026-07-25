import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { createDeeplinks, buildCoupangSearchUrl, isCoupangUrl } from "@/lib/coupangPartners";

async function extractImageUrl(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  void req;

  const { id } = await ctx.params;
  const { data: row, error: loadError } = await supabase
    .from("guide_products")
    .select("id, product_url, short_name, buy_type")
    .eq("id", id)
    .single();
  if (loadError || !row) {
    return NextResponse.json({ ok: false, message: loadError?.message || "제품을 찾을 수 없습니다" }, { status: 404 });
  }
  if (!row.product_url) {
    return NextResponse.json({ ok: false, message: "제품링크가 없습니다" }, { status: 400 });
  }

  const originalUrl = row.product_url;
  const isKeywordBuy = row.buy_type === "키워드구매";
  const update: Record<string, string> = {};
  const notes: string[] = [];

  const imageUrl = await extractImageUrl(originalUrl);
  if (imageUrl) update.image_url = imageUrl;
  else notes.push("제품 이미지를 찾지 못했습니다");

  if (isCoupangUrl(originalUrl)) {
    const searchUrl = buildCoupangSearchUrl(row.short_name || "");
    const result = await createDeeplinks([originalUrl, searchUrl]);
    if (result.ok) {
      const productLink = result.links.find((l) => l.originalUrl === originalUrl);
      const keywordLink = result.links.find((l) => l.originalUrl === searchUrl);
      if (keywordLink?.shortenUrl) update.keyword_url = keywordLink.shortenUrl;
      if (isKeywordBuy) update.product_url = row.short_name || originalUrl;
      else if (productLink?.shortenUrl) update.product_url = productLink.shortenUrl;
      if (!productLink || !keywordLink) notes.push("일부 링크 변환에 실패했습니다");
    } else {
      notes.push(`쿠팡파트너스 링크 변환 실패: ${result.message}`);
      if (isKeywordBuy) update.product_url = row.short_name || originalUrl;
    }
  } else {
    notes.push("쿠팡 상품 링크가 아니어서 파트너스 링크 변환은 건너뛰었습니다");
    if (isKeywordBuy) update.product_url = row.short_name || originalUrl;
  }

  if (Object.keys(update).length) {
    const { error } = await supabase.from("guide_products").update(update).eq("id", id);
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, updated: update, message: notes.join(" / ") || undefined });
}
