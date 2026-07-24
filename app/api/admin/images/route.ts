import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

const BUCKETS = new Set(["purchase-images", "review-images"]);

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket") || "";
  const company = (searchParams.get("company") || "").trim();
  const date = (searchParams.get("date") || "").trim();
  if (!BUCKETS.has(bucket)) {
    return NextResponse.json({ ok: false, message: "잘못된 저장소입니다" }, { status: 400 });
  }
  if (!company) {
    return NextResponse.json({ ok: false, message: "업체코드 또는 업체명을 입력해주세요" }, { status: 400 });
  }

  const folderPath = date ? `${company}/${date}` : company;
  const { data, error } = await supabase.storage.from(bucket).list(folderPath, {
    limit: 200,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const files = (data || [])
    .filter((f) => f.id) // 폴더 항목 제외, 실제 파일만
    .map((f) => {
      const path = `${folderPath}/${f.name}`;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      return { name: f.name, url: urlData.publicUrl };
    });

  return NextResponse.json({ ok: true, files, folderPath });
}
