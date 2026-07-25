import { SupabaseClient } from "@supabase/supabase-js";

export { romanizeKorean, safeSegment, safeFolderName, codeNameSegment } from "./textSafe";

/** Postgres/Storage 원문 에러 메시지를 자주 나오는 케이스만 한국어로 치환 */
export function toKoreanErrorMessage(raw: string): string {
  if (/duplicate key value violates unique constraint/i.test(raw)) {
    if (/uq_orders_order_no/i.test(raw)) return "이미 등록된 주문번호입니다. 주문번호를 다시 확인해주세요.";
    return "이미 등록된 데이터입니다 (중복)";
  }
  if (/invalid key/i.test(raw)) return "이미지 파일명에 문제가 있어 저장하지 못했습니다. 다시 시도해주세요.";
  return raw;
}

export function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("이미지 데이터 형식이 올바르지 않습니다");
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new Error("이미지 데이터가 비어 있습니다");
  return { mime, buffer };
}

export function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "jpg";
}

export async function uploadImage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  dataUrl: string
): Promise<string> {
  const { mime, buffer } = parseDataUrl(dataUrl);
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: mime,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
