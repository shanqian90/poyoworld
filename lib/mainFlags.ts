export type FlagRow = {
  id: number;
  date_mmdd: string;
  company_code: string | null;
  company_name: string | null;
  product_name: string;
  option_text: string;
  manager: string | null;
  real_manager: string | null;
  address: string | null;
};

export type KFlag = "blank" | "blacklist" | "already_done" | "safe" | "whitelist" | "company_dup" | "product_dup";

export const K_FLAG_INFO: Record<KFlag, { label: string; color: string }> = {
  blank: { label: "예정 미배정", color: "#FFB74D" },
  blacklist: { label: "블랙리스트", color: "#E53935" },
  already_done: { label: "이미 실진행됨", color: "#FFFFFF" },
  safe: { label: "안전(최초 배정)", color: "#B3E5FC" },
  whitelist: { label: "화이트리스트", color: "#CE93D8" },
  company_dup: { label: "업체 중복(21일내)", color: "#F48FB1" },
  product_dup: { label: "상품 중복", color: "#00E5FF" },
};

export const ADDRESS_DUP_COLOR = "#F48FB1";
export const BATCH_COMPLETE_COLOR = "#A5D6A7";

function mmddToDayNum(mmdd: string): number | null {
  const m = String(mmdd || "").match(/^(\d{2})(\d{2})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // 연도 없이 월/일만 저장되므로, 임의 기준연도로 환산해 ±21일 비교에만 사용
  return Date.UTC(2000, month - 1, day) / 86400000;
}

/** K열(예정) 배경색 — 순서대로 첫 매칭이 우선 (구글시트 조건부서식 규칙 순서와 동일) */
export function computeKFlags(
  rows: FlagRow[],
  blacklistNames: Set<string>,
  whitelistNames: Set<string>
): Map<number, KFlag> {
  const result = new Map<number, KFlag>();

  for (const r of rows) {
    const k = (r.manager || "").trim();

    if (!k) {
      result.set(r.id, "blank");
      continue;
    }
    if (blacklistNames.has(k)) {
      result.set(r.id, "blacklist");
      continue;
    }

    const alreadyDone = rows.some(
      (o) =>
        o.date_mmdd === r.date_mmdd &&
        o.company_code === r.company_code &&
        o.product_name === r.product_name &&
        o.option_text === r.option_text &&
        (o.real_manager || "").trim() === k
    );
    if (alreadyDone) {
      result.set(r.id, "already_done");
      continue;
    }

    // 상품 중복: 날짜 제한 없이 업체코드+업체명+제품명+예정(K) 기준
    const productDupCount = rows.filter(
      (o) => o.company_code === r.company_code && o.company_name === r.company_name && o.product_name === r.product_name && (o.manager || "").trim() === k
    ).length;
    if (productDupCount > 1) {
      result.set(r.id, "product_dup");
      continue;
    }

    const day = mmddToDayNum(r.date_mmdd);
    const within21 = (o: FlagRow) => {
      if (day == null) return false;
      const od = mmddToDayNum(o.date_mmdd);
      if (od == null) return false;
      return Math.abs(od - day) <= 21;
    };

    const companyDupCount = rows.filter(
      (o) => o.company_code === r.company_code && o.company_name === r.company_name && (o.manager || "").trim() === k && within21(o)
    ).length;
    if (companyDupCount > 1) {
      result.set(r.id, "company_dup");
      continue;
    }

    if (whitelistNames.has(k)) {
      result.set(r.id, "whitelist");
      continue;
    }

    const safeKMatch = rows.filter(
      (o) => o.company_code === r.company_code && o.product_name === r.product_name && (o.manager || "").trim() === k && within21(o)
    ).length;
    const safeLMatch = rows.filter(
      (o) => o.company_code === r.company_code && o.product_name === r.product_name && (o.real_manager || "").trim() === k && within21(o)
    ).length;
    if (safeKMatch === 1 && safeLMatch === 0) {
      result.set(r.id, "safe");
    }
  }

  return result;
}

/** S열(주소) — 같은 업체+주소 조합이 ±21일 내 2건 이상이면 주소 중복 표시 (K열과 독립) */
export function computeAddressDupFlags(rows: FlagRow[]): Set<number> {
  const flagged = new Set<number>();
  for (const r of rows) {
    const addr = (r.address || "").trim();
    if (!addr) continue;
    const day = mmddToDayNum(r.date_mmdd);
    const within21 = (o: FlagRow) => {
      if (day == null) return false;
      const od = mmddToDayNum(o.date_mmdd);
      if (od == null) return false;
      return Math.abs(od - day) <= 21;
    };
    const count = rows.filter(
      (o) => o.company_code === r.company_code && o.company_name === r.company_name && (o.address || "").trim() === addr && within21(o)
    ).length;
    if (count > 1) flagged.add(r.id);
  }
  return flagged;
}

/** L열(실진행) — 같은 날짜+업체+제품 그룹 전체가 실진행 완료되면 완료 표시 (K열과 독립) */
export function computeBatchCompleteFlags(rows: FlagRow[]): Set<number> {
  const flagged = new Set<number>();
  const groups = new Map<string, FlagRow[]>();
  for (const r of rows) {
    const key = `${r.date_mmdd}||${r.company_code}||${r.company_name}||${r.product_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  for (const group of groups.values()) {
    if (group.length > 0 && group.every((o) => (o.real_manager || "").trim() !== "")) {
      group.forEach((o) => flagged.add(o.id));
    }
  }
  return flagged;
}
