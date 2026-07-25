import crypto from "crypto";

const DOMAIN = "https://api-gateway.coupang.com";
const DEEPLINK_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";

type DeeplinkData = { originalUrl: string; shortenUrl: string; landingUrl: string };
type DeeplinkResponse = { rCode: string; rMessage: string; data?: DeeplinkData[] };

function signedDate() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = String(now.getUTCFullYear()).slice(-2);
  const month = pad(now.getUTCMonth() + 1);
  const day = pad(now.getUTCDate());
  const hour = pad(now.getUTCHours());
  const minute = pad(now.getUTCMinutes());
  const second = pad(now.getUTCSeconds());
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

function authHeader(method: string, pathWithQuery: string) {
  const accessKey = process.env.COUPANG_ACCESS_KEY || "";
  const secretKey = process.env.COUPANG_SECRET_KEY || "";
  const datetime = signedDate();
  const message = datetime + method.toUpperCase() + pathWithQuery;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

export function isCoupangUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)coupang\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

export function buildCoupangSearchUrl(keyword: string): string {
  return `https://www.coupang.com/np/search?component=&q=${encodeURIComponent(keyword)}&channel=user`;
}

export async function createDeeplinks(
  urls: string[]
): Promise<{ ok: true; links: DeeplinkData[] } | { ok: false; message: string }> {
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;
  if (!accessKey || !secretKey) {
    return { ok: false, message: "쿠팡파트너스 API 키(COUPANG_ACCESS_KEY/COUPANG_SECRET_KEY)가 설정되지 않았습니다" };
  }

  try {
    const res = await fetch(`${DOMAIN}${DEEPLINK_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader("POST", DEEPLINK_PATH),
      },
      body: JSON.stringify({ coupangUrls: urls, subId: "" }),
    });
    const text = await res.text();
    let data: DeeplinkResponse | null = null;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, message: `쿠팡파트너스 API 응답 파싱 실패 (${res.status})` };
    }
    if (!res.ok || !data || data.rCode !== "0") {
      return { ok: false, message: data?.rMessage || `쿠팡파트너스 API 오류 (${res.status})` };
    }
    return { ok: true, links: data.data || [] };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "쿠팡파트너스 API 호출 중 오류가 발생했습니다" };
  }
}
