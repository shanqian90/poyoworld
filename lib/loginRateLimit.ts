import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

const WINDOW_MS = 15 * 60 * 1000; // 15분
const MAX_ATTEMPTS = 8;

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimit(
  ip: string,
  scope: string
): Promise<{ blocked: boolean; message?: string }> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("scope", scope)
    .gte("created_at", since);
  if (error) return { blocked: false };
  if ((count || 0) >= MAX_ATTEMPTS) {
    return { blocked: true, message: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요" };
  }
  return { blocked: false };
}

export async function recordFailedAttempt(ip: string, scope: string): Promise<void> {
  await supabase.from("login_attempts").insert({ ip, scope });
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("login_attempts").delete().lt("created_at", oneDayAgo);
}
