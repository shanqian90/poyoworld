import { SupabaseClient } from "@supabase/supabase-js";

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
