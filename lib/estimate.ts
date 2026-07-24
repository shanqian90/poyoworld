export type EstimateSourceRow = {
  productName: string;
  productAmount: number;
  productQty: number;
  workUnit: number;
  workQty: number;
  deliveryUnit: number;
};

export type ExtraItemInput = {
  name: string;
  amount: number;
  vatEnabled: boolean;
  feeEnabled: boolean;
};

export type EstimateItem = {
  productName: string;
  productAmount: number;
  productQty: number;
  workUnit: number;
  workQty: number;
  deliveryUnit: number;
  depositSupply: number;
  depositTax: number;
  depositFee: number;
  depositTotal: number;
  workSupply: number;
  workTax: number;
  workFee: number;
  workTotal: number;
  deliveryTotal: number;
  productAmountCny: number | "";
  workUnitCny: number | "";
  deliveryUnitCny: number | "";
  depositSupplyCny: number | "";
  depositTaxCny: number | "";
  depositFeeCny: number | "";
  depositTotalCny: number | "";
  workSupplyCny: number | "";
  workTaxCny: number | "";
  workFeeCny: number | "";
  workTotalCny: number | "";
  deliveryTotalCny: number | "";
};

export type ExtraItem = {
  name: string;
  supply: number;
  tax: number;
  fee: number;
  total: number;
  vatEnabled: boolean;
  feeEnabled: boolean;
  supplyCny: number | "";
  taxCny: number | "";
  feeCny: number | "";
  totalCny: number | "";
};

export type EstimateSummary = Record<string, number | "">;

export type EstimateData = {
  writeDate: string;
  companyCode: string;
  companyName: string;
  vatEnabled: boolean;
  taxRateText: string;
  note: string;
  depositEnabled: boolean;
  exchangeRate: number | "";
  lang: "ko" | "zh";
  items: EstimateItem[];
  extraItems: ExtraItem[];
  summary: EstimateSummary;
};

export function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}
export function parsePercent(v: string): number {
  return toNumber(v) / 100;
}
export function normalizePercentText(v: string): string {
  return toNumber(v) + "%";
}
function sum(arr: number[]): number {
  return arr.reduce((acc, cur) => acc + Number(cur || 0), 0);
}
function toCny(krw: number, rate: number): number | "" {
  return rate ? krw / rate : "";
}
export function fmt(v: number | ""): string {
  return Number(v || 0).toLocaleString("ko-KR");
}
export function fmtCny(v: number | ""): string {
  if (v === "" || v === null || v === undefined) return "";
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function escapeHtml(str: string | null | undefined): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SUMMARY_KEYS = [
  "workSupplyAmount", "workTaxAmount", "workFeeAmount", "workTotal",
  "depositSupplyAmount", "depositFeeAmount", "depositTaxAmount", "depositTotal",
  "deliveryTotal",
  "extraSupplyAmount", "extraTaxAmount", "extraFeeAmount", "extraTotal",
  "supplyAmount", "invoiceAmount",
];

export function buildEstimateData(input: {
  writeDate: string;
  companyCode: string;
  companyName: string;
  rows: EstimateSourceRow[];
  vatEnabled: boolean;
  taxRateText: string;
  note: string;
  depositEnabled: boolean;
  exchangeRate: number;
  lang: "ko" | "zh";
  extraItemsInput: ExtraItemInput[];
}): EstimateData {
  const vatRate = input.vatEnabled ? 0.1 : 0;
  const taxRate = parsePercent(input.taxRateText);
  const useDeposit = input.depositEnabled !== false;
  const showCny = input.lang === "zh";
  const rate = showCny ? toNumber(input.exchangeRate) : 0;

  const items: EstimateItem[] = input.rows.map((r) => {
    const productAmount = toNumber(r.productAmount);
    const productQty = toNumber(r.productQty);
    const workUnit = toNumber(r.workUnit);
    const workQty = toNumber(r.workQty) || productQty;
    const deliveryUnit = toNumber(r.deliveryUnit);

    const depositSupply = useDeposit ? productAmount * workQty : 0;
    const depositTax = Math.round(depositSupply * vatRate);
    const depositFee = Math.round((depositSupply + depositTax) * taxRate);
    const depositTotal = depositSupply + depositTax + depositFee;

    const workSupply = workUnit * workQty;
    const workTax = Math.round(workSupply * vatRate);
    const workFee = Math.round((workSupply + workTax) * taxRate);
    const workTotal = workSupply + workTax + workFee;

    const deliveryTotal = deliveryUnit * workQty;

    return {
      productName: String(r.productName || ""),
      productAmount, productQty, workUnit, workQty, deliveryUnit,
      depositSupply, depositTax, depositFee, depositTotal,
      workSupply, workTax, workFee, workTotal, deliveryTotal,
      productAmountCny: rate ? toCny(productAmount, rate) : "",
      workUnitCny: rate ? toCny(workUnit, rate) : "",
      deliveryUnitCny: rate ? toCny(deliveryUnit, rate) : "",
      depositSupplyCny: rate ? toCny(depositSupply, rate) : "",
      depositTaxCny: rate ? toCny(depositTax, rate) : "",
      depositFeeCny: rate ? toCny(depositFee, rate) : "",
      depositTotalCny: rate ? toCny(depositTotal, rate) : "",
      workSupplyCny: rate ? toCny(workSupply, rate) : "",
      workTaxCny: rate ? toCny(workTax, rate) : "",
      workFeeCny: rate ? toCny(workFee, rate) : "",
      workTotalCny: rate ? toCny(workTotal, rate) : "",
      deliveryTotalCny: rate ? toCny(deliveryTotal, rate) : "",
    };
  });

  const extraItems: ExtraItem[] = (input.extraItemsInput || [])
    .filter((x) => x && (String(x.name || "").trim() !== "" || toNumber(x.amount) !== 0))
    .map((x) => {
      const name = String(x.name || "").trim();
      const amount = toNumber(x.amount);
      const vatOn = !!x.vatEnabled;
      const feeOn = !!x.feeEnabled;
      const supply = amount;
      const tax = vatOn ? Math.round(supply * vatRate) : 0;
      const fee = feeOn ? Math.round((supply + tax) * taxRate) : 0;
      const total = supply + tax + fee;
      return {
        name, supply, tax, fee, total, vatEnabled: vatOn, feeEnabled: feeOn,
        supplyCny: rate ? toCny(supply, rate) : "",
        taxCny: rate ? toCny(tax, rate) : "",
        feeCny: rate ? toCny(fee, rate) : "",
        totalCny: rate ? toCny(total, rate) : "",
      };
    });

  const summary: EstimateSummary = {
    exchangeRate: rate || "",
    workSupplyAmount: sum(items.map((x) => x.workSupply)),
    workTaxAmount: sum(items.map((x) => x.workTax)),
    workFeeAmount: sum(items.map((x) => x.workFee)),
    workTotal: sum(items.map((x) => x.workTotal)),
    depositSupplyAmount: sum(items.map((x) => x.depositSupply)),
    depositFeeAmount: sum(items.map((x) => x.depositFee)),
    depositTaxAmount: sum(items.map((x) => x.depositTax)),
    depositTotal: sum(items.map((x) => x.depositTotal)),
    deliveryTotal: sum(items.map((x) => x.deliveryTotal)),
    extraSupplyAmount: sum(extraItems.map((x) => x.supply)),
    extraTaxAmount: sum(extraItems.map((x) => x.tax)),
    extraFeeAmount: sum(extraItems.map((x) => x.fee)),
    extraTotal: sum(extraItems.map((x) => x.total)),
    supplyAmount: 0,
    invoiceAmount: 0,
  };
  summary.invoiceAmount =
    Number(summary.workTotal) + Number(summary.depositTotal) + Number(summary.deliveryTotal) + Number(summary.extraTotal);
  summary.supplyAmount = Math.round(Number(summary.invoiceAmount) / (1 + vatRate));
  SUMMARY_KEYS.forEach((k) => {
    summary[k + "Cny"] = rate ? toCny(Number(summary[k]), rate) : "";
  });

  return {
    writeDate: input.writeDate,
    companyCode: input.companyCode,
    companyName: input.companyName,
    vatEnabled: input.vatEnabled,
    taxRateText: normalizePercentText(input.taxRateText),
    note: input.note,
    depositEnabled: useDeposit,
    exchangeRate: rate || "",
    lang: input.lang || "ko",
    items,
    extraItems,
    summary,
  };
}

const ACCOUNT_TEXT = "국민은행 222001-04-244311 유한회사휘찬";

function getPreviewTextPack(lang: "ko" | "zh") {
  const zh = lang === "zh";
  return zh
    ? {
        brand: "有限会社 辉灿", previewTitle: "报价单预览", companyName: "公司名称", writeDate: "作成日期", vat: "附加税 (VAT） 10%", exchangeRate: "汇率", include: "包含", exclude: "不包含", deposit: "代付", proceed: "进行", notProceed: "未进行",
        productName: "产品名称", productAmount: "产品价格", workUnit: "佣金", workQty: "数量", workSupply: "总佣金", productPriceLabel: "产品价格", vatAmount: "附加税 (VAT）", feeAmount: "税务处理费", total: "合计",
        productTableTitle: "产品费用明细", workTableTitle: "执行费用明细", workTotalLabel: "总佣金", depositTotalLabel: "代付合计", extraTotalLabel: "其他金额合计", deliveryLabel: "快递代发", noteLabel: "备注", noNote: "无", supplyAmount: "供给金额", invoiceAmount: "发票金额",
        depositExcluded1: "未进行代付", depositExcluded2: "产品金额不计入报价单", depositExcluded3: "代付合计 0韩元", workFormula1: "A) 佣金x数量 = 供给金额 : ", workFormula2: "B) 附加税10% : ", workFormula3: "C) (A+B)x", workFormula4: "税务处理费 : ",
        depositFormula1: "A) 产品价格x数量 = 供给金额 : ", depositFormula2: "B) 附加税10% : ", depositFormula3: "C) (A+B)x", depositFormula4: "税务处理费 : ", extraNoVat: "附加税未应用", extraNoFee: "税务处理费未应用", extraNoItems: "无其他金额项目", totalLabel: "合计 : ", deliveryFormula1: "快递费x实际产品数量 = ", krw: "원", cny: "元",
      }
    : {
        brand: "유한회사 휘찬", previewTitle: "견적서 미리보기", companyName: "업체명", writeDate: "작성일", vat: "세금계산서 10%", exchangeRate: "환율", include: "포함", exclude: "미포함", deposit: "입금대행", proceed: "진행", notProceed: "미진행",
        productName: "제품명", productAmount: "제품금액", workUnit: "진행단가", workQty: "진행수량", workSupply: "진행 공급가액", productPriceLabel: "제품가격", vatAmount: "부가세", feeAmount: "세무처리비용", total: "합계",
        productTableTitle: "제품비 내역", workTableTitle: "진행비 내역", workTotalLabel: "진행비 합계", depositTotalLabel: "입금대행 합계", extraTotalLabel: "기타금액 합계", deliveryLabel: "샘플박스 택배대행", noteLabel: "비고", noNote: "없음", supplyAmount: "공급가액", invoiceAmount: "계산서금액",
        depositExcluded1: "입금대행 미진행 업체", depositExcluded2: "제품금액 견적서 계산 제외", depositExcluded3: "입금대행 합계 0원", workFormula1: "A) 진행단가x수량 = 공급가액 : ", workFormula2: "B) 부가세10% : ", workFormula3: "C) (A+B)x", workFormula4: "세무처리비용 : ",
        depositFormula1: "A) 제품금액x수량 = 공급가액 : ", depositFormula2: "B) 부가세10% : ", depositFormula3: "C) (A+B)x", depositFormula4: "세무처리비용 : ", extraNoVat: "부가세 미적용", extraNoFee: "세무처리비 미적용", extraNoItems: "기타금액 항목 없음", totalLabel: "합계 : ", deliveryFormula1: "택배비x실제품수량 = ", krw: "원", cny: "元",
      };
}

function dualMoneyHtml(krw: number, cny: number | "", txt: ReturnType<typeof getPreviewTextPack>, showCny: boolean): string {
  if (!showCny) return `<span class="money-krw">${fmt(krw)}${txt.krw}</span>`;
  return `<span class="money-krw">${fmt(krw)}${txt.krw}</span>` + (cny === "" ? "" : `<span class="money-cny">${fmtCny(cny)}${txt.cny}</span>`);
}
function moneyLineHtml(amount: number, cny: number | "", txt: ReturnType<typeof getPreviewTextPack>, showCny: boolean): string {
  if (!showCny) return fmt(amount) + txt.krw;
  return cny === "" ? fmt(amount) + txt.krw : fmt(amount) + txt.krw + "  " + fmtCny(cny) + txt.cny;
}

export function buildPreviewHtml(data: EstimateData): string {
  const lang = data.lang;
  const txt = getPreviewTextPack(lang);
  const s = data.summary;
  const depositStatusText = data.depositEnabled ? txt.proceed : txt.notProceed;
  const showCny = lang === "zh";

  const vc = (content: string, cls = "", colspan = 1) =>
    `<td class="${cls}"${colspan > 1 ? ` colspan="${colspan}"` : ""}><div class="vc">${content}</div></td>`;
  const vth = (content: string) => `<th><div class="vc">${content}</div></th>`;

  const depositRowsHtml = data.items
    .map(
      (item) =>
        `<tr>${vc(escapeHtml(item.productName))}${vc(dualMoneyHtml(item.productAmount, item.productAmountCny, txt, showCny), "num")}${vc(fmt(item.workQty), "num")}${vc(dualMoneyHtml(item.depositSupply, item.depositSupplyCny, txt, showCny), "num")}${vc(dualMoneyHtml(item.depositTax, item.depositTaxCny, txt, showCny), "num")}${vc(dualMoneyHtml(item.depositFee, item.depositFeeCny, txt, showCny), "num")}${vc(dualMoneyHtml(item.depositTotal, item.depositTotalCny, txt, showCny), "num")}</tr>`
    )
    .join("");
  const workRowsHtml = data.items
    .map(
      (item) =>
        `<tr>${vc(escapeHtml(item.productName))}${vc(dualMoneyHtml(item.workUnit, item.workUnitCny, txt, showCny), "num")}${vc(fmt(item.workQty), "num")}${vc(dualMoneyHtml(item.workSupply, item.workSupplyCny, txt, showCny), "num")}${vc(dualMoneyHtml(item.workTax, item.workTaxCny, txt, showCny), "num")}${vc(dualMoneyHtml(item.workFee, item.workFeeCny, txt, showCny), "num")}${vc(dualMoneyHtml(item.workTotal, item.workTotalCny, txt, showCny), "num")}</tr>`
    )
    .join("");

  const workCardLines =
    txt.workFormula1 + moneyLineHtml(Number(s.workSupplyAmount), s.workSupplyAmountCny, txt, showCny) +
    "<br>" + txt.workFormula2 + moneyLineHtml(Number(s.workTaxAmount), s.workTaxAmountCny, txt, showCny) +
    "<br>" + txt.workFormula3 + data.taxRateText + " " + txt.workFormula4 + moneyLineHtml(Number(s.workFeeAmount), s.workFeeAmountCny, txt, showCny) +
    `<br><span class="card-total">${txt.totalLabel}${moneyLineHtml(Number(s.workTotal), s.workTotalCny, txt, showCny)}</span>`;

  const depositCardLines = !data.depositEnabled
    ? txt.depositExcluded1 + "<br>" + txt.depositExcluded2 + "<br>" + txt.depositExcluded3
    : txt.depositFormula1 + moneyLineHtml(Number(s.depositSupplyAmount), s.depositSupplyAmountCny, txt, showCny) +
      "<br>" + txt.depositFormula2 + moneyLineHtml(Number(s.depositTaxAmount), s.depositTaxAmountCny, txt, showCny) +
      "<br>" + txt.depositFormula3 + data.taxRateText + " " + txt.depositFormula4 + moneyLineHtml(Number(s.depositFeeAmount), s.depositFeeAmountCny, txt, showCny) +
      `<br><span class="card-total">${txt.totalLabel}${moneyLineHtml(Number(s.depositTotal), s.depositTotalCny, txt, showCny)}</span>`;

  const extraCardLines =
    !data.extraItems || !data.extraItems.length
      ? txt.extraNoItems
      : data.extraItems
          .map((it) => {
            const negStyle = it.total < 0 ? ' style="color:#c62828"' : "";
            const flags: string[] = [];
            if (!it.vatEnabled) flags.push(txt.extraNoVat);
            if (!it.feeEnabled) flags.push(txt.extraNoFee);
            const flagText = flags.length ? ` <span style="color:#888">(${flags.join(", ")})</span>` : "";
            return `<span${negStyle}>${escapeHtml(it.name || "-")} : ${moneyLineHtml(it.total, it.totalCny, txt, showCny)}</span>${flagText}`;
          })
          .join("<br>") + `<br><span class="card-total">${txt.totalLabel}${moneyLineHtml(Number(s.extraTotal), s.extraTotalCny, txt, showCny)}</span>`;

  const deliveryCardLines = txt.deliveryFormula1 + moneyLineHtml(Number(s.deliveryTotal), s.deliveryTotalCny, txt, showCny);

  const exchangeRowHtml = showCny
    ? `<tr>${vth(txt.deposit)}${vc(depositStatusText)}${vth(txt.exchangeRate)}${vc(s.exchangeRate ? "1" + txt.cny + " = " + fmt(s.exchangeRate) + txt.krw : "-", "", 3)}</tr>`
    : `<tr>${vth(txt.deposit)}${vc(depositStatusText, "", 5)}</tr>`;

  return (
    "" +
    "<style>" +
    ".estimate-wrap{font-family:'Malgun Gothic',Arial,sans-serif;background:#fff;color:#222;padding:20px}" +
    ".estimate-wrap .brand{font-size:13px;text-align:center;margin-bottom:8px}" +
    ".estimate-wrap .title{font-size:26px;font-weight:800;text-align:center;margin-bottom:16px}" +
    ".estimate-wrap .meta-table{width:100%;border-collapse:collapse;font-size:12px}" +
    ".estimate-wrap .meta-table th,.estimate-wrap .meta-table td{border:1px solid #000;padding:0;text-align:center}" +
    ".estimate-wrap .meta-table th{background:#efefef;font-weight:700}" +
    ".estimate-wrap .section-title{margin-top:14px;margin-bottom:6px;font-size:14px;font-weight:800}" +
    ".estimate-wrap table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}" +
    ".estimate-wrap th,.estimate-wrap td{border:1px solid #000;padding:0;text-align:center}" +
    ".estimate-wrap th{background:#d8c6aa}.estimate-wrap .num{text-align:center}" +
    ".estimate-wrap .vc{display:flex;align-items:center;justify-content:center;min-height:38px;padding:8px 6px;text-align:center}" +
    ".estimate-wrap .money-krw{display:block;font-weight:700}" +
    ".estimate-wrap .money-cny{display:block;font-size:11px;color:#8a6d3b;margin-top:2px}" +
    ".estimate-wrap .cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}" +
    ".estimate-wrap .card{border:1px solid #cfcfcf;border-radius:14px;padding:16px;background:#faf7f1;min-height:128px}" +
    ".estimate-wrap .ct{font-size:13px;font-weight:700;margin-bottom:8px}" +
    ".estimate-wrap .cm{font-size:26px;font-weight:800;margin-bottom:10px}" +
    ".estimate-wrap .cm .cny{display:block;font-size:15px;color:#8a6d3b;margin-top:6px}" +
    ".estimate-wrap .cs{font-size:12px;line-height:1.8;color:#555}" +
    ".estimate-wrap .card-total{display:inline-block;margin-top:4px;padding-top:4px;border-top:1px solid #ddd;font-weight:700;color:#222}" +
    ".estimate-wrap .note-card{border:1px solid #cfcfcf;border-radius:14px;padding:16px;background:#faf7f1;margin-top:12px}" +
    ".estimate-wrap .bottom{display:grid;grid-template-columns:140px 1fr 140px 1fr;border:1px solid #000;margin-top:16px;font-size:14px}" +
    ".estimate-wrap .bottom div{padding:10px;border-right:1px solid #000;text-align:center}" +
    ".estimate-wrap .bottom .k{background:#efefef;font-weight:700}" +
    ".estimate-wrap .bottom div:last-child{border-right:none;color:#c62828;font-weight:800}" +
    ".estimate-wrap .bottom .money-wrap{display:flex;flex-direction:column;gap:3px}" +
    ".estimate-wrap .bottom .money-wrap .cny{font-size:12px;color:#8a6d3b;font-weight:700}" +
    ".estimate-wrap .account{margin-top:16px;padding:14px;text-align:center;background:#efe6bf;font-size:16px;font-weight:800}" +
    "</style>" +
    '<div class="estimate-wrap">' +
    `<div class="brand">${txt.brand}</div>` +
    `<div class="title">${escapeHtml(data.companyName)} ${txt.previewTitle}</div>` +
    '<table class="meta-table">' +
    `<tr>${vth(txt.companyName)}${vc(escapeHtml(data.companyName))}${vth(txt.writeDate)}${vc(escapeHtml(data.writeDate))}${vth(txt.vat)}${vc(data.vatEnabled ? txt.include : txt.exclude)}</tr>` +
    exchangeRowHtml +
    "</table>" +
    `<div class="section-title">${txt.productTableTitle}</div>` +
    `<table><thead><tr>${vth(txt.productName)}${vth(txt.productAmount)}${vth(txt.workQty)}${vth(txt.productPriceLabel)}${vth(txt.vatAmount)}${vth(txt.feeAmount)}${vth(txt.total)}</tr></thead><tbody>${depositRowsHtml}</tbody></table>` +
    `<div class="section-title">${txt.workTableTitle}</div>` +
    `<table><thead><tr>${vth(txt.productName)}${vth(txt.workUnit)}${vth(txt.workQty)}${vth(txt.workSupply)}${vth(txt.vatAmount)}${vth(txt.feeAmount)}${vth(txt.total)}</tr></thead><tbody>${workRowsHtml}</tbody></table>` +
    '<div class="cards">' +
    `<div class="card"><div class="ct">${txt.workTotalLabel}</div><div class="cm">${fmt(Number(s.workTotal))}${txt.krw}${showCny && s.workTotalCny !== "" ? `<span class="cny">${fmtCny(s.workTotalCny)}${txt.cny}</span>` : ""}</div><div class="cs">${workCardLines}</div></div>` +
    `<div class="card"><div class="ct">${txt.depositTotalLabel}</div><div class="cm">${fmt(Number(s.depositTotal))}${txt.krw}${showCny && s.depositTotalCny !== "" ? `<span class="cny">${fmtCny(s.depositTotalCny)}${txt.cny}</span>` : ""}</div><div class="cs">${depositCardLines}</div></div>` +
    `<div class="card"><div class="ct">${txt.extraTotalLabel}</div><div class="cm">${fmt(Number(s.extraTotal))}${txt.krw}${showCny && s.extraTotalCny !== "" ? `<span class="cny">${fmtCny(s.extraTotalCny)}${txt.cny}</span>` : ""}</div><div class="cs">${extraCardLines}</div></div>` +
    `<div class="card"><div class="ct">${txt.deliveryLabel}</div><div class="cm">${fmt(Number(s.deliveryTotal))}${txt.krw}${showCny && s.deliveryTotalCny !== "" ? `<span class="cny">${fmtCny(s.deliveryTotalCny)}${txt.cny}</span>` : ""}</div><div class="cs">${deliveryCardLines}</div></div>` +
    "</div>" +
    `<div class="note-card"><div class="ct">${txt.noteLabel}</div><div class="cs" style="margin-top:8px">${escapeHtml(data.note || txt.noNote)}</div></div>` +
    '<div class="bottom">' +
    `<div class="k">${txt.supplyAmount}</div><div class="money-wrap"><span>${fmt(Number(s.supplyAmount))}${txt.krw}</span>${showCny && s.supplyAmountCny !== "" ? `<span class="cny">${fmtCny(s.supplyAmountCny)}${txt.cny}</span>` : ""}</div>` +
    `<div class="k">${txt.invoiceAmount}</div><div class="money-wrap"><span>${fmt(Number(s.invoiceAmount))}${txt.krw}</span>${showCny && s.invoiceAmountCny !== "" ? `<span class="cny">${fmtCny(s.invoiceAmountCny)}${txt.cny}</span>` : ""}</div>` +
    "</div>" +
    `<div class="account">${escapeHtml(ACCOUNT_TEXT)}</div>` +
    "</div>"
  );
}

export function extractMmddFromReceipt(receiptNo: string): string {
  const digits = String(receiptNo || "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(4, 8) : "";
}
