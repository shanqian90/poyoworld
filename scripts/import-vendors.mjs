import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

const CSV_PATH = "C:\\Users\\임휘영\\Downloads\\0_업체견적서 - 계정관리.csv";
const SUPABASE_URL = "https://gbbwqubgujfuoolvedbq.supabase.co";
const ANON_KEY = "sb_publishable_4kiw_xZ0N_zdMh0UleFFug_6rL2uko7";

function toStr(v) {
  const s = String(v == null ? "" : v).trim();
  return s === "" ? null : s;
}
function toNum(v, def) {
  const s = String(v || "").trim();
  if (!s) return def;
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? def : n;
}

const raw = readFileSync(CSV_PATH);
const records = parse(raw, { skip_empty_lines: true });
const dataRows = records.slice(1); // 1행: 헤더

const vendors = dataRows
  .filter((r) => toStr(r[3])) // 업체명 있는 행만
  .map((r) => ({
    login_id: toStr(r[1]),
    company_code: toStr(r[2]),
    company_name: toStr(r[3]),
    biz_no: toStr(r[4]),
    owner_name: toStr(r[5]),
    email: toStr(r[6]),
    real_ship_price: toNum(r[7], 3000),
    empty_box_price: toNum(r[8], 3500),
    biz_file_url: toStr(r[10]),
  }));

console.log(`업체 ${vendors.length}건 가져올 준비 완료`);

const res = await fetch(`${SUPABASE_URL}/rest/v1/vendors`, {
  method: "POST",
  headers: {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  },
  body: JSON.stringify(vendors),
});

if (!res.ok) {
  console.error("업체 삽입 실패:", res.status, await res.text());
  process.exit(1);
}
console.log(`업체 ${vendors.length}건 저장 완료`);

// 로그인 아이디(전화번호)가 있는 업체는 users 테이블에도 미리 등록
// (password_hash = null → 처음 로그인 시도할 때 비밀번호 설정 화면이 뜸)
const loginIds = [...new Set(vendors.map((v) => v.login_id).filter(Boolean))];
console.log(`로그인 계정 시딩 대상: ${loginIds.length}개`);

let seeded = 0;
for (const id of loginIds) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/seed_legacy_kakao_id`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_kakao_id: id }),
  });
  if (r.ok) seeded++;
  else console.error("시딩 실패:", id, r.status, await r.text());
}
console.log(`로그인 계정 시딩 완료: ${seeded}/${loginIds.length}`);
