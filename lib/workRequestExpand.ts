// 원본 Apps Script(Code.gs)의 메인시트 생성 로직을 그대로 이식

const BULK_QTY_THRESHOLD = 100;
const BULK_DISCOUNT = 500;

export function discountUnit(baseUnit: number, qty: number): number {
  const b = Number(baseUnit || 0);
  return Number(qty || 0) >= BULK_QTY_THRESHOLD ? Math.max(0, b - BULK_DISCOUNT) : b;
}

/** "1/2/1" → [1,2,1]. 총건수 남으면 패턴 반복, 넘치면 자름. "3" → [3,3,3...] */
export function parseDailyPlan(raw: string, totalCount: number): number[] {
  const total = Number(totalCount) || 0;
  if (!total) return [];
  const parts = String(raw || "")
    .split(/[\/,\s]+/)
    .map((v) => Number(String(v).replace(/[^0-9]/g, "")))
    .filter((n) => n > 0);
  if (!parts.length) return [];
  const plan: number[] = [];
  let remain = total;
  let i = 0;
  let guard = 0;
  while (remain > 0 && guard++ < 400) {
    const n = Math.min(parts[i % parts.length], remain);
    plan.push(n);
    remain -= n;
    i++;
  }
  return plan;
}

function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

/** 시작일 기준 offsetDays 만큼 진행일을 더한 날짜 (주말진행=N 이면 토/일 skip) */
export function addDaysByWeekendRule(startDate: Date, offsetDays: number, weekendWork: boolean): Date {
  const date = new Date(startDate);
  date.setHours(0, 0, 0, 0);
  if (weekendWork) {
    date.setDate(date.getDate() + offsetDays);
    return date;
  }
  while (isWeekend(date)) date.setDate(date.getDate() + 1);
  let added = 0;
  while (added < offsetDays) {
    date.setDate(date.getDate() + 1);
    if (!isWeekend(date)) added++;
  }
  return date;
}

const REVIEW_TYPE_ORDER = ["단순구매", "별점", "텍스트", "포토", "영상"];
const REVIEW_TYPE_LABEL: Record<string, string> = {
  별점: "별점",
  텍스트: "텍스트 150자",
  포토: "포토4장이상+텍200자",
  영상: "영상",
  단순구매: "단순구매",
};

function sortReviewTypes(arr: string[]): string[] {
  return arr.slice().sort((a, b) => {
    const ia = REVIEW_TYPE_ORDER.indexOf(a);
    const ib = REVIEW_TYPE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

function labelReviewTypes(arr: string[]): string[] {
  return arr.map((v) => REVIEW_TYPE_LABEL[v] || v);
}

function inferSingleReviewLabel(text: string): string {
  if (text.includes("단순구매")) return "단순구매";
  if (text.includes("영상")) return "영상";
  if (text.includes("포토")) return "포토";
  if (text.includes("별점")) return "별점";
  if (text.includes("텍스트")) return "텍스트";
  return "텍스트";
}

/** "포토8 텍3 별3" 같은 자유 텍스트를 totalCount 개의 리뷰타입 배열로 확장 */
export function expandReviewTypes(reviewTypeRaw: string, totalCount: number): string[] {
  const result: string[] = [];
  const text = String(reviewTypeRaw || "").trim();
  if (!text) {
    while (result.length < totalCount) result.push("텍스트");
    return labelReviewTypes(result);
  }
  const normalized = text
    .replace(/원고제공|포토제공|이미지제공|사진제공|가이드제공|콘티제공/gi, " ")
    .replace(/포토후기|포토리뷰|사진리뷰|사진/gi, "포토")
    .replace(/텍스트후기|텍스트리뷰|일반리뷰|글리뷰|글/gi, "텍스트")
    .replace(/텍(?!스트)/gi, "텍스트")
    .replace(/영상후기|영상리뷰|동영상|비디오/gi, "영상")
    .replace(/별점후기|별점리뷰/gi, "별점")
    .replace(/별(?!점)/gi, "별점")
    .replace(/단순구매|구매만|구매(?!키워드)/gi, "단순구매")
    .replace(/건/gi, "")
    .replace(/[,/\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const regex = /(포토|텍스트|별점|영상|단순구매)\s*(\d+)?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalized)) !== null) {
    const count = match[2] ? Number(match[2]) || 0 : 1;
    for (let i = 0; i < count; i++) result.push(match[1]);
  }
  if (result.length === 0) {
    const singleType = inferSingleReviewLabel(normalized);
    while (result.length < totalCount) result.push(singleType);
    return labelReviewTypes(result.slice(0, totalCount));
  }
  while (result.length < totalCount) result.push(result[result.length - 1] || "텍스트");
  return labelReviewTypes(sortReviewTypes(result.slice(0, totalCount)));
}

export function detectPlatform(url: string): string {
  const text = String(url || "").toLowerCase();
  if (!text) return "";
  if (text.includes("coupang")) return "쿠팡";
  if (text.includes("naver.com")) return "네이버";
  if (text.includes("11st.co.kr")) return "11번가";
  if (text.includes("gmarket.co.kr")) return "지마켓";
  if (text.includes("auction.co.kr")) return "옥션";
  return "";
}

export function fmtMMDD(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}${dd}`;
}

type WorkRequestForGuide = {
  company_code: string | null;
  company_name: string;
  product_url: string | null;
  keyword: string;
  product_option: string | null;
  product_price: number | null;
  review_type: string | null;
  real_shipping: boolean;
};

/** 진행요청서 한 건으로부터 구매가이드(guide_products) 삽입 행을 만든다 */
export function buildGuideRow(r: WorkRequestForGuide): Record<string, unknown> {
  return {
    active: true,
    code: r.company_code,
    company: r.company_name,
    platform: detectPlatform(r.product_url || ""),
    short_name: r.keyword,
    option_text: r.product_option,
    product_url: r.product_url,
    price: r.product_price,
    review_type: r.review_type,
    delivery: r.real_shipping ? "실배송" : "빈박스",
  };
}
