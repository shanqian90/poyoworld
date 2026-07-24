import { SupabaseClient } from "@supabase/supabase-js";
import { SlotMap, SlotOption } from "./types";

/**
 * 특정 날짜(MMDD)의 제품/옵션별 "빈 슬롯" 맵을 만든다.
 * 옵션 번호는 (필터 없이) 전체 행에서 먼저 등장한 순서로 매기고,
 * 실제로 빈 슬롯이 1개 이상 남아있는 옵션만 결과에 포함한다.
 * (원본 Apps Script 로직과 동일한 규칙)
 */
export async function getSlotMap(
  supabase: SupabaseClient,
  dateMmdd: string
): Promise<SlotMap> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, product_name, option_text, order_no, amount")
    .eq("date_mmdd", dateMmdd)
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);

  const order: Record<string, string[]> = {};
  const emptyInfo: Record<string, Record<string, { count: number; amount: number | null }>> = {};

  for (const row of data || []) {
    const product = row.product_name;
    const option = row.option_text;
    if (!product || !option) continue;

    if (!order[product]) order[product] = [];
    if (!order[product].includes(option)) order[product].push(option);

    if (row.order_no) continue; // 빈 슬롯만 카운트

    if (!emptyInfo[product]) emptyInfo[product] = {};
    if (!emptyInfo[product][option]) emptyInfo[product][option] = { count: 0, amount: null };
    emptyInfo[product][option].count++;
    if (emptyInfo[product][option].amount === null && row.amount != null) {
      emptyInfo[product][option].amount = row.amount;
    }
  }

  const result: SlotMap = {};
  for (const product of Object.keys(emptyInfo)) {
    const options = order[product] || [];
    const list: SlotOption[] = [];
    options.forEach((optionText, idx) => {
      const info = emptyInfo[product][optionText];
      if (!info || info.count <= 0) return;
      list.push({
        value: String(idx + 1),
        label: optionText,
        amount: info.amount,
        remaining: info.count,
      });
    });
    if (list.length) result[product] = list;
  }

  return result;
}

export function resolveOptionText(
  order: string[],
  optionNo: string
): string | null {
  const idx = Number(optionNo) - 1;
  if (idx < 0 || idx >= order.length) return null;
  return order[idx];
}
