import { EstimateSourceRow } from "@/lib/estimate";

export type EstimateGroupRow = {
  productName: string;
  productAmount: number;
  productQty: number;
  workUnit: number;
  workQty: number;
  deliveryUnit: number;
  productSupply: number;
  workSupply: number;
  deliveryTotal: number;
  productAmountCny: number | "";
  productSupplyCny: number | "";
  workUnitCny: number | "";
  workSupplyCny: number | "";
  deliveryUnitCny: number | "";
  deliveryTotalCny: number | "";
};

function toCny(krw: number, rate: number): number | "" {
  return rate ? krw / rate : "";
}

export function buildGroupRows(rows: EstimateSourceRow[], exchangeRate: number): EstimateGroupRow[] {
  const rate = Number(exchangeRate) || 0;
  return rows.map((r) => {
    const productSupply = r.productAmount * r.workQty;
    const workSupply = r.workUnit * r.workQty;
    const deliveryTotal = r.deliveryUnit * r.workQty;
    return {
      productName: r.productName,
      productAmount: r.productAmount,
      productQty: r.productQty,
      workUnit: r.workUnit,
      workQty: r.workQty,
      deliveryUnit: r.deliveryUnit,
      productSupply,
      workSupply,
      deliveryTotal,
      productAmountCny: rate ? toCny(r.productAmount, rate) : "",
      productSupplyCny: rate ? toCny(productSupply, rate) : "",
      workUnitCny: rate ? toCny(r.workUnit, rate) : "",
      workSupplyCny: rate ? toCny(workSupply, rate) : "",
      deliveryUnitCny: rate ? toCny(r.deliveryUnit, rate) : "",
      deliveryTotalCny: rate ? toCny(deliveryTotal, rate) : "",
    };
  });
}
