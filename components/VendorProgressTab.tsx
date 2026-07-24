"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProgressRow = {
  id: number;
  date_mmdd: string;
  product_name: string;
  option_text: string | null;
  review_type: string | null;
  order_no: string | null;
  buyer: string | null;
  receiver: string | null;
  tracking: string | null;
  delivery: string | null;
  amount: number | null;
  review_url: string | null;
  product_url: string | null;
};

function fmtDay(mmdd: string) {
  if (!mmdd || mmdd.length !== 4) return mmdd;
  return `${Number(mmdd.slice(0, 2))}/${mmdd.slice(2)}`;
}
function won(n: number | null) {
  return `₩${Number(n || 0).toLocaleString("ko-KR")}`;
}

export default function VendorProgressTab({ companyCode, companyName }: { companyCode: string | null; companyName: string }) {
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState("전체보기");
  const [keyword, setKeyword] = useState("");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [exportBusy, setExportBusy] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode, companyName]);

  async function load() {
    setLoading(true);
    let query = supabase
      .from("orders")
      .select("id, date_mmdd, product_name, option_text, review_type, order_no, buyer, receiver, tracking, delivery, amount, review_url, product_url")
      .order("date_mmdd", { ascending: false });
    query = companyCode ? query.eq("company_code", companyCode) : query.eq("company_name", companyName);
    const { data, error } = await query;
    if (!error) setRows((data || []) as ProgressRow[]);
    setLoading(false);
  }

  const products = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.product_name));
    return Array.from(set);
  }, [rows]);

  function inProduct(r: ProgressRow) {
    return product === "전체보기" || r.product_name === product;
  }
  function statusOf(r: ProgressRow) {
    return r.order_no ? "진행" : "예정";
  }

  const allInProduct = useMemo(() => rows.filter(inProduct), [rows, product]);

  function datesBy(status: "진행" | "예정") {
    const set = new Set<string>();
    allInProduct.forEach((r) => {
      if (statusOf(r) === status) set.add(r.date_mmdd);
    });
    return Array.from(set).sort().reverse();
  }
  const goDates = datesBy("진행");
  const wtDates = datesBy("예정");

  const curRows = useMemo(() => {
    let list = allInProduct;
    if (selectedDates.size) list = list.filter((r) => selectedDates.has(r.date_mmdd));
    if (keyword.trim()) {
      const kw = keyword.replace(/\s/g, "").toLowerCase();
      list = list.filter((r) =>
        [r.order_no, r.buyer, r.receiver].join("|").toLowerCase().replace(/\s/g, "").includes(kw)
      );
    }
    return [...list].sort((a, b) => b.date_mmdd.localeCompare(a.date_mmdd));
  }, [allInProduct, selectedDates, keyword]);

  function toggleDate(d: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }
  function toggleAll(status: "진행" | "예정") {
    const dates = status === "진행" ? goDates : wtDates;
    const allOn = dates.length && dates.every((d) => selectedDates.has(d));
    setSelectedDates((prev) => {
      const next = new Set(prev);
      dates.forEach((d) => (allOn ? next.delete(d) : next.add(d)));
      return next;
    });
  }

  const pendingCount = allInProduct.filter((r) => statusOf(r) === "예정").length;
  const couriers = useMemo(() => {
    const set = new Set<string>();
    allInProduct.forEach((r) => {
      if (r.delivery) set.add(r.delivery);
    });
    return Array.from(set);
  }, [allInProduct]);

  async function copyText(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      setCopiedMsg("운송장번호 복사됨");
    } catch {
      setCopiedMsg("복사 실패");
    }
    setTimeout(() => setCopiedMsg(""), 1500);
  }

  async function doExport() {
    if (!curRows.length) {
      alert("내보낼 데이터가 없습니다");
      return;
    }
    setExportBusy(true);
    try {
      const XLSX = await import("xlsx");
      const head = ["진행일자", "상태", "제품명", "옵션", "리뷰가이드", "주문번호", "구매자", "수취인", "운송사", "운송장번호", "결제금액"];
      const aoa = [head];
      curRows.forEach((r) => {
        aoa.push([
          fmtDay(r.date_mmdd),
          statusOf(r),
          r.product_name,
          r.option_text || "",
          r.review_type || "",
          r.order_no || "",
          r.buyer || "",
          r.receiver || "",
          r.delivery || "",
          r.tracking || "",
          String(r.amount || 0),
        ] as string[]);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "진행상황");
      const pname = product === "전체보기" ? "전체" : product;
      XLSX.writeFile(wb, `${companyCode || companyName}_${pname}.xlsx`);
    } finally {
      setExportBusy(false);
    }
  }

  if (loading) {
    return <div className="text-center text-sm text-neutral-500 py-10">불러오는 중...</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm bg-white"
        value={product}
        onChange={(e) => {
          setProduct(e.target.value);
          setSelectedDates(new Set());
        }}
      >
        <option value="전체보기">전체보기</option>
        {products.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <input
        className="border border-emerald-200 rounded-xl px-3 py-2 text-sm"
        placeholder="주문번호 · 구매자 · 수취인 검색"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-2 py-2 text-center">
          <div className="text-[11px] text-neutral-500">전체 건수</div>
          <div className="text-lg font-extrabold text-emerald-700">{allInProduct.length}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-2 py-2 text-center">
          <div className="text-[11px] text-neutral-500">예정 건수</div>
          <div className="text-lg font-extrabold text-emerald-700">{pendingCount}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-2 py-2 text-center">
          <div className="text-[11px] text-neutral-500">운송사</div>
          <div className="text-sm font-bold text-emerald-700 truncate">{couriers.length ? couriers.join("/") : "—"}</div>
        </div>
      </div>

      {goDates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-neutral-500">진행일자</span>
            <button className="text-[11px] text-emerald-700 underline" onClick={() => toggleAll("진행")}>
              {goDates.every((d) => selectedDates.has(d)) ? "전체해제" : "전체선택"}
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {goDates.map((d) => (
              <button
                key={d}
                className={`text-xs px-2.5 py-1 rounded-lg border ${
                  selectedDates.has(d) ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-emerald-200 text-emerald-700"
                }`}
                onClick={() => toggleDate(d)}
              >
                {fmtDay(d)}
              </button>
            ))}
          </div>
        </div>
      )}
      {wtDates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-amber-600">진행예정일자</span>
            <button className="text-[11px] text-amber-700 underline" onClick={() => toggleAll("예정")}>
              {wtDates.every((d) => selectedDates.has(d)) ? "전체해제" : "전체선택"}
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {wtDates.map((d) => (
              <button
                key={d}
                className={`text-xs px-2.5 py-1 rounded-lg border border-dashed ${
                  selectedDates.has(d) ? "bg-amber-500 text-white border-amber-500" : "bg-amber-50 border-amber-300 text-amber-700"
                }`}
                onClick={() => toggleDate(d)}
              >
                {fmtDay(d)}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        className="bg-emerald-600 text-white text-sm font-extrabold rounded-xl py-2.5 disabled:opacity-60"
        onClick={doExport}
        disabled={exportBusy}
      >
        {exportBusy ? "생성 중..." : `📥 엑셀 다운로드 (${curRows.length}건)`}
      </button>
      {copiedMsg && <div className="text-xs text-center text-emerald-700">{copiedMsg}</div>}

      <div className="flex flex-col gap-2">
        {curRows.length === 0 && (
          <div className="text-center text-sm text-neutral-400 py-8">표시할 데이터가 없습니다</div>
        )}
        {curRows.map((r) => {
          const wait = statusOf(r) === "예정";
          return (
            <div key={r.id} className="border border-emerald-100 rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    wait ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {fmtDay(r.date_mmdd)}
                </span>
                <span className="text-xs font-mono text-neutral-500">{r.order_no || "—"}</span>
              </div>
              <div className="text-sm font-extrabold text-neutral-800 mt-1.5">{r.product_name}</div>
              {r.review_type && <div className="text-xs text-neutral-500 mt-0.5">리뷰가이드 {r.review_type}</div>}
              <div className="flex gap-4 mt-1.5 text-xs text-neutral-600">
                <span>구매자 {r.buyer || "—"}</span>
                <span>수취인 {r.receiver || "—"}</span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-neutral-200">
                <span className="text-xs text-neutral-500 flex items-center gap-1.5">
                  {r.tracking ? (
                    <>
                      <span className="font-mono">{r.tracking}</span>
                      <button className="text-emerald-700 underline" onClick={() => copyText(r.tracking!)}>
                        복사
                      </button>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="text-sm font-extrabold text-emerald-700">{won(r.amount)}</span>
              </div>
              {r.review_url && (
                <a
                  href={r.review_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs font-bold text-emerald-700 border border-emerald-200 rounded-lg py-1.5 mt-2"
                >
                  리뷰확인
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
