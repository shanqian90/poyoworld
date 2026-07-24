import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

const CSV_PATH = "C:\\Users\\임휘영\\Downloads\\1_메인시트 - 메인.csv";
const SUPABASE_URL = "https://gbbwqubgujfuoolvedbq.supabase.co";
const ANON_KEY = "sb_publishable_4kiw_xZ0N_zdMh0UleFFug_6rL2uko7";

function toBool(v) {
  return String(v || "").trim().toUpperCase() === "TRUE";
}
function toNum(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}
function toStr(v) {
  const s = String(v == null ? "" : v).trim();
  return s === "" ? null : s;
}
function toOrderNo(v) {
  const s = toStr(v);
  if (!s || s === "리뷰 도움이돼요 필수") return null; // 잘못 들어간 안내문구 -> 빈 슬롯 처리
  return s;
}
function toDate(v) {
  const s = String(v || "").trim();
  return s === "" ? null : s;
}

const raw = readFileSync(CSV_PATH);
const records = parse(raw, { skip_empty_lines: true });

// 1행: 장식용 헤더, 2행: 실제 컬럼명 -> 3행부터가 데이터
const dataRows = records.slice(2);

const rows = dataRows
  .filter((r) => toStr(r[3])) // 업체명이 없는 완전 빈 행은 제외
  .map((r) => ({
    seq: toStr(r[0]),
    date_mmdd: toStr(r[1]) || "0000",
    company_code: toStr(r[2]),
    company_name: toStr(r[3]),
    platform: toStr(r[4]),
    product_url: toStr(r[5]),
    product_name: toStr(r[6]) || "미지정",
    option_text: toStr(r[7]) || "미지정",
    review_type: toStr(r[8]),
    review_url: toStr(r[9]),
    manager: toStr(r[10]),
    real_manager: toStr(r[11]),
    order_image: toStr(r[12]),
    order_no: toOrderNo(r[13]),
    buyer: toStr(r[14]),
    receiver: toStr(r[15]),
    user_id: toStr(r[16]),
    phone: toStr(r[17]),
    address: toStr(r[18]),
    account_text: toStr(r[19]),
    amount: toNum(r[20]),
    review_fee: toNum(r[21]) || 0,
    review_done: toBool(r[22]),
    paid: toBool(r[23]),
    paid_date: toDate(r[24]),
    company_paid: toBool(r[25]),
    delivery: toStr(r[26]),
    tracking: toStr(r[27]),
    remark: toStr(r[28]),
  }));

console.log(`총 ${rows.length}건 가져올 준비 완료`);

const BATCH = 200;
let inserted = 0;
let failedBatches = [];

for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(chunk),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`배치 ${i}~${i + chunk.length} 실패:`, res.status, text.slice(0, 500));
    failedBatches.push({ start: i, size: chunk.length, error: text.slice(0, 300) });
  } else {
    inserted += chunk.length;
    console.log(`진행 ${inserted}/${rows.length}`);
  }
}

console.log(`\n완료: ${inserted}건 저장, 실패 배치 ${failedBatches.length}개`);
if (failedBatches.length) {
  console.log(JSON.stringify(failedBatches, null, 2));
}
