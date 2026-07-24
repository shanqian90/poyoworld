import { SupabaseClient } from "@supabase/supabase-js";
import { EstimateSourceRow, extractMmddFromReceipt, toNumber } from "@/lib/estimate";

export async function getEstimateSourceRows(
  supabase: SupabaseClient,
  writeDate: string,
  companyCode: string,
  companyName: string
): Promise<{ rows: EstimateSourceRow[]; ids: number[] }> {
  const { data, error } = await supabase
    .from("work_requests")
    .select("id, receipt_no, company_code, company_name, status, issue_date, keyword, product_price, total_count, unit_price, delivery_agency")
    .ilike("status", "%접수%")
    .is("issue_date", null)
    .eq("company_name", companyName);

  if (error) throw new Error(error.message);

  const rows: EstimateSourceRow[] = [];
  const ids: number[] = [];
  (data || []).forEach((r) => {
    if (String(r.company_code || "").trim() !== (companyCode || "").trim()) return;
    if (extractMmddFromReceipt(r.receipt_no) !== writeDate) return;
    const qty = toNumber(r.total_count);
    rows.push({
      productName: String(r.keyword || ""),
      productAmount: toNumber(r.product_price),
      productQty: qty,
      workUnit: toNumber(r.unit_price),
      workQty: qty,
      deliveryUnit: r.delivery_agency ? 2500 : 0,
    });
    ids.push(r.id);
  });
  return { rows, ids };
}
