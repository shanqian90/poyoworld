import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

const CSV_PATH = "C:\\Users\\임휘영\\Downloads\\1_메인시트 - 계정관리.csv";
const SUPABASE_URL = "https://gbbwqubgujfuoolvedbq.supabase.co";
const ANON_KEY = "sb_publishable_4kiw_xZ0N_zdMh0UleFFug_6rL2uko7";

function toStr(v) {
  return String(v == null ? "" : v).trim();
}

const raw = readFileSync(CSV_PATH);
const records = parse(raw, { skip_empty_lines: true });
const dataRows = records.slice(1); // 헤더: 카카오톡아이디,별칭,구매자,수취인,아이디,전화번호,주소,은행,계좌번호,계좌주,최근로그인,횟수

const accounts = dataRows
  .filter((r) => toStr(r[0]) || toStr(r[2])) // 카카오톡아이디 또는 구매자 있는 행만
  .map((r) => ({
    kakao_id: toStr(r[0]),
    store: toStr(r[1]),
    buyer: toStr(r[2]),
    receiver: toStr(r[3]),
    user_id: toStr(r[4]),
    phone: toStr(r[5]),
    address: toStr(r[6]),
    bank: toStr(r[7]),
    account_no: toStr(r[8]),
    holder: toStr(r[9]),
  }));

console.log(`계정 ${accounts.length}건 가져올 준비 완료`);

const chunkSize = 500;
for (let i = 0; i < accounts.length; i += chunkSize) {
  const chunk = accounts.slice(i, i + chunkSize);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/accounts`, {
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
    console.error(`삽입 실패 (chunk ${i}):`, res.status, await res.text());
  } else {
    console.log(`계정 ${chunk.length}건 저장 완료 (chunk ${i})`);
  }
}
console.log("완료");
