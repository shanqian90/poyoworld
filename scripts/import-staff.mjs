import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

function readEnv() {
  const env = {};
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    });
  return env;
}

const env = readEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const ROSTER_PATH = "C:\\Users\\임휘영\\Downloads\\월급명세서 - 명단.csv";
const ATTENDANCE_FILES = {
  duwjd1203: "C:\\Users\\임휘영\\Downloads\\월급명세서 - 서여정.csv",
  hyun3201: "C:\\Users\\임휘영\\Downloads\\월급명세서 - 김현지.csv",
  surica: "C:\\Users\\임휘영\\Downloads\\월급명세서 - 김나윤.csv",
};

function toStr(v) {
  return String(v == null ? "" : v).trim();
}
function toNum(v) {
  const s = toStr(v).replace(/[,원]/g, "");
  return s ? Number(s) : null;
}

async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${fn} 실패: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function insertAttendance(rows) {
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/staff_attendance?on_conflict=staff_id,work_date`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      console.error(`출퇴근 기록 삽입 실패 (chunk ${i}):`, res.status, await res.text());
    } else {
      console.log(`출퇴근 기록 ${chunk.length}건 저장 완료 (chunk ${i})`);
    }
  }
}

function parseAttendanceCsv(path) {
  const raw = readFileSync(path);
  const records = parse(raw, { skip_empty_lines: true });
  const dataRows = records.slice(1); // 헤더: 일자,출근시간,퇴근시간,근무시간(h),시급,일급,실수령액,월급지급일,비고,비고
  const out = [];
  for (const r of dataRows) {
    const dateStr = toStr(r[0]);
    const m = dateStr.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (!m) continue; // "OO월 합계" 등 소계행은 건너뜀
    const workDate = `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
    const clockIn = toStr(r[1]) || null;
    const clockOut = toStr(r[2]) || null;
    const hours = toNum(r[3]);
    const hourlyWage = toNum(r[4]);
    const dailyPay = toNum(r[5]);
    const netPay = toNum(r[6]) ?? dailyPay;
    out.push({ work_date: workDate, clock_in: clockIn, clock_out: clockOut, hours, hourly_wage: hourlyWage, daily_pay: dailyPay, net_pay: netPay });
  }
  return out;
}

async function main() {
  const raw = readFileSync(ROSTER_PATH);
  const records = parse(raw, { skip_empty_lines: true });
  const dataRows = records.slice(1); // 헤더: 이름,아이디,계좌번호,시급,3.3%공제

  const staffIdByLogin = {};

  for (const r of dataRows) {
    const name = toStr(r[0]);
    const loginId = toStr(r[1]);
    const accountText = toStr(r[2]);
    const hourlyWage = toNum(r[3]) || 0;
    const withholdTax = toStr(r[4]).toUpperCase() === "Y";
    if (!loginId) {
      console.log(`아이디 없음 → 직원 계정 생성 건너뜀: ${name}`);
      continue;
    }
    const result = await rpc("admin_upsert_staff", {
      p_id: null,
      p_name: name,
      p_login_id: loginId,
      p_account_text: accountText,
      p_hourly_wage: hourlyWage,
      p_withhold_tax: withholdTax,
      p_active: true,
    });
    staffIdByLogin[loginId] = result.id;
    console.log(`직원 등록 완료: ${name} (${loginId}) → ${result.id}`);
  }

  for (const [loginId, path] of Object.entries(ATTENDANCE_FILES)) {
    const staffId = staffIdByLogin[loginId];
    if (!staffId) {
      console.log(`${loginId} 의 staff_id 를 찾을 수 없어 출퇴근 기록을 건너뜁니다`);
      continue;
    }
    const rows = parseAttendanceCsv(path).map((r) => ({ ...r, staff_id: staffId }));
    console.log(`${loginId}: 출퇴근 기록 ${rows.length}건 가져올 준비 완료`);
    await insertAttendance(rows);
  }

  console.log("완료");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
