import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

const SUPABASE_URL = "https://gbbwqubgujfuoolvedbq.supabase.co";
const ANON_KEY = "sb_publishable_4kiw_xZ0N_zdMh0UleFFug_6rL2uko7";

function toStr(v) {
  const s = String(v == null ? "" : v).trim();
  return s === "" ? null : s;
}

async function insertRows(table, rows) {
  if (!rows.length) return;
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
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
      console.error(`${table} 삽입 실패 (chunk ${i}):`, res.status, await res.text());
    } else {
      console.log(`${table} ${chunk.length}건 저장 완료 (chunk ${i})`);
    }
  }
}

// ── 화이트리스트 ──
const WL_PATH = "C:\\Users\\임휘영\\Downloads\\1_메인시트 - 화이트리스트.csv";
const wlRaw = readFileSync(WL_PATH);
const wlRecords = parse(wlRaw, { skip_empty_lines: true });
const wlNames = wlRecords.slice(1).map((r) => toStr(r[0])).filter(Boolean);
const wlSeen = new Set();
const wlRows = [];
for (const name of wlNames) {
  if (wlSeen.has(name)) continue;
  wlSeen.add(name);
  wlRows.push({ type: "name", value: name });
}
console.log(`화이트리스트 ${wlRows.length}건 (원본 ${wlNames.length}건, 중복 제거 후)`);

// ── 블랙리스트 ──
const BL_PATH = "C:\\Users\\임휘영\\Downloads\\1_메인시트 - 블랙리스트.csv";
const blRaw = readFileSync(BL_PATH);
const blRecords = parse(blRaw, { skip_empty_lines: true });
const blDataRows = blRecords.slice(1); // 헤더: 블랙리스트,아이디,계좌,전화번호,주소,이유,통합목록
const blSeen = new Set();
const blRows = [];
for (const r of blDataRows) {
  const name = toStr(r[6]) || toStr(r[0]); // 통합목록 우선, 없으면 1열
  if (!name) continue;
  if (blSeen.has(name)) continue;
  blSeen.add(name);
  const reason = toStr(r[5]);
  blRows.push({ type: "name", value: name, reason });
}
console.log(`블랙리스트 ${blRows.length}건 (원본 ${blDataRows.length}건, 중복 제거 후)`);

await insertRows("whitelist", wlRows);
await insertRows("blacklist", blRows);

console.log("완료");
