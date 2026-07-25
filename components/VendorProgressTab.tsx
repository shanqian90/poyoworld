"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProgressRow = {
  id: number;
  date_mmdd: string;
  product_name: string;
  option_text: string | null;
  review_type: string | null;
  platform: string | null;
  order_no: string | null;
  buyer: string | null;
  receiver: string | null;
  tracking: string | null;
  delivery: string | null;
  amount: number | null;
  review_url: string | null;
  product_url: string | null;
};

const THEME = {
  iv: "#F6F2E7",
  iv2: "#FCFAF2",
  card: "#FFFFFF",
  bd: "#E6DFCC",
  bd2: "#D8CFB6",
  gd: "#2C4A3B",
  gd2: "#21392D",
  gtx: "#274033",
  mut: "#7C7460",
  naver: "#2DB400",
  coupang: "#B0683A",
  wbd: "#D8C3A8",
  wbg: "#FBF1E5",
  wtx: "#8A5A36",
};

function fmtDay(mmdd: string) {
  if (!mmdd || mmdd.length !== 4) return mmdd;
  return `${Number(mmdd.slice(0, 2))}/${mmdd.slice(2)}`;
}
function won(n: number | null) {
  return `₩${Number(n || 0).toLocaleString("ko-KR")}`;
}
function detectPlatform(platform: string | null, url: string | null): string {
  if (platform) return platform;
  const u = url || "";
  if (/smartstore|naver/i.test(u)) return "네이버";
  if (/coupang/i.test(u)) return "쿠팡";
  return "";
}
function platformColor(p: string) {
  if (/네이버/.test(p)) return THEME.naver;
  if (/쿠팡/.test(p)) return THEME.coupang;
  return THEME.gd;
}

export default function VendorProgressTab({ companyCode, companyName }: { companyCode: string | null; companyName: string }) {
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState("전체보기");
  const [keyword, setKeyword] = useState("");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [exportBusy, setExportBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode, companyName]);

  async function load() {
    setLoading(true);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    let query = supabase
      .from("orders")
      .select(
        "id, date_mmdd, product_name, option_text, review_type, platform, order_no, buyer, receiver, tracking, delivery, amount, review_url, product_url"
      )
      .eq("hidden_from_active", false)
      .gte("created_at", cutoff.toISOString())
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

  const meta = useMemo(() => {
    const first = allInProduct[0];
    if (!first) return { option: "", guide: "", platform: "" };
    return {
      option: first.option_text || "",
      guide: first.review_type || "",
      platform: detectPlatform(first.platform, first.product_url),
    };
  }, [allInProduct]);

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
  const totalCount = allInProduct.length;
  const doneCount = totalCount - pendingCount;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const isRecruitComplete = totalCount > 0 && doneCount === totalCount;
  const couriers = useMemo(() => {
    const set = new Set<string>();
    allInProduct.forEach((r) => {
      if (r.delivery) set.add(r.delivery);
    });
    return Array.from(set);
  }, [allInProduct]);

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(""), 1400);
  }

  async function copyText(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      showToast("운송장번호 복사됨");
    } catch {
      showToast("복사 실패");
    }
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
    return <div className="text-center text-sm py-10" style={{ color: THEME.mut }}>불러오는 중...</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 헤더 카드 */}
      <div className="rounded-2xl p-4" style={{ background: THEME.iv, border: `0.5px solid ${THEME.bd2}` }}>
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px]" style={{ color: THEME.mut }}>
              진행상황 · 실시간
            </div>
            <div className="text-lg leading-snug mt-1" style={{ color: THEME.gd2 }}>
              {meta.platform && (
                <span
                  className="text-[11px] font-medium text-white px-2 py-0.5 rounded-lg mr-1.5 align-middle"
                  style={{ background: platformColor(meta.platform) }}
                >
                  {meta.platform}
                </span>
              )}
              <span className="font-medium align-middle">{product}</span>
            </div>
            <select
              className="w-full max-w-[280px] h-[38px] mt-2.5 px-3 rounded-lg text-sm bg-white"
              style={{ border: `0.5px solid ${THEME.bd2}`, color: THEME.gtx }}
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
          </div>
          <span
            className="text-[11px] px-2.5 py-1 rounded-lg shrink-0"
            style={{ color: THEME.gd, background: THEME.iv2, border: `0.5px solid ${THEME.bd}` }}
          >
            읽기 전용
          </span>
        </div>
        <div
          className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-2.5 text-[13px] items-center"
          style={{ borderTop: `0.5px solid ${THEME.bd}` }}
        >
          <span>
            <span style={{ color: THEME.mut }}>플랫폼 </span>
            <span className="font-medium" style={{ color: THEME.gd2 }}>{meta.platform || "-"}</span>
          </span>
          <span>
            <span style={{ color: THEME.mut }}>옵션 </span>
            <span className="font-medium" style={{ color: THEME.gd2 }}>{meta.option || "-"}</span>
          </span>
          <span>
            <span style={{ color: THEME.mut }}>리뷰가이드 </span>
            <span className="font-medium" style={{ color: THEME.gd2 }}>{meta.guide || "-"}</span>
          </span>
        </div>
      </div>

      <input
        className="rounded-lg px-3 h-10 text-sm bg-white"
        style={{ border: `0.5px solid ${THEME.bd2}`, color: THEME.gtx }}
        placeholder="주문번호 · 구매자 · 수취인 검색"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />

      {/* 날짜 칩 */}
      <div className="flex gap-1.5 items-center overflow-x-auto pb-0.5">
        <span className="text-xs shrink-0" style={{ color: THEME.mut }}>진행일자</span>
        {goDates.length > 0 && (
          <button
            className="text-[11px] px-2.5 py-1 rounded-lg shrink-0 font-medium"
            style={{ border: `0.5px solid ${THEME.bd2}`, background: THEME.iv2, color: THEME.gtx }}
            onClick={() => toggleAll("진행")}
          >
            {goDates.every((d) => selectedDates.has(d)) ? "전체해제" : "전체선택"}
          </button>
        )}
        {goDates.length === 0 && <span className="text-xs" style={{ color: "#BFB7A2" }}>없음</span>}
        {goDates.map((d) => {
          const on = selectedDates.has(d);
          return (
            <button
              key={d}
              className="text-[13px] px-2.5 py-1 rounded-lg shrink-0"
              style={
                on
                  ? { background: THEME.gd, color: "#fff", border: `0.5px solid ${THEME.gd}` }
                  : { background: THEME.iv2, color: THEME.gtx, border: `0.5px solid ${THEME.bd2}` }
              }
              onClick={() => toggleDate(d)}
            >
              {fmtDay(d)}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5 items-center overflow-x-auto pb-0.5">
        <span className="text-xs shrink-0" style={{ color: THEME.coupang }}>진행예정일자</span>
        {wtDates.length > 0 && (
          <button
            className="text-[11px] px-2.5 py-1 rounded-lg shrink-0 font-medium"
            style={{ border: `0.5px dashed ${THEME.wbd}`, background: THEME.wbg, color: THEME.wtx }}
            onClick={() => toggleAll("예정")}
          >
            {wtDates.every((d) => selectedDates.has(d)) ? "전체해제" : "전체선택"}
          </button>
        )}
        {wtDates.length === 0 && <span className="text-xs" style={{ color: "#BFB7A2" }}>없음</span>}
        {wtDates.map((d) => {
          const on = selectedDates.has(d);
          return (
            <button
              key={d}
              className="text-[13px] px-2.5 py-1 rounded-lg shrink-0"
              style={
                on
                  ? { background: THEME.wtx, color: "#fff", border: `1.5px solid ${THEME.wtx}` }
                  : { background: THEME.wbg, color: THEME.wtx, border: `0.5px dashed ${THEME.wbd}` }
              }
              onClick={() => toggleDate(d)}
            >
              {fmtDay(d)}
            </button>
          );
        })}
      </div>

      {/* 메트릭 카드 */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-lg px-3 py-2.5" style={{ background: THEME.iv2, border: `0.5px solid ${THEME.bd}` }}>
          <div className="text-[11px]" style={{ color: THEME.mut }}>전체 건수</div>
          <div className="text-xl font-medium" style={{ color: THEME.gd2 }}>{totalCount}</div>
        </div>
        <div className="rounded-lg px-3 py-2.5" style={{ background: THEME.iv2, border: `0.5px solid ${THEME.bd}` }}>
          <div className="text-[11px]" style={{ color: THEME.mut }}>예정 건수</div>
          <div className="text-xl font-medium" style={{ color: THEME.gd2 }}>{pendingCount}</div>
        </div>
        <div className="rounded-lg px-3 py-2.5" style={{ background: THEME.iv2, border: `0.5px solid ${THEME.bd}` }}>
          <div className="text-[11px]" style={{ color: THEME.mut }}>운송사</div>
          <div className="text-sm font-medium mt-1.5 truncate" style={{ color: THEME.gd2 }}>{couriers.length ? couriers.join(" / ") : "—"}</div>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="rounded-lg px-3 py-2.5" style={{ background: THEME.card, border: `0.5px solid ${THEME.bd}` }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs" style={{ color: THEME.mut }}>진행률</span>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-lg text-white"
              style={{ background: isRecruitComplete ? THEME.gd : THEME.gd2 }}
            >
              {isRecruitComplete ? "🎉 모집완료" : `${progressPercent}% 진행중`}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: THEME.bd }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, background: THEME.gd }} />
          </div>
        </div>
      )}

      <div
        className="flex justify-between items-center gap-3 flex-wrap rounded-xl px-4 py-2.5"
        style={{ background: THEME.card, border: `0.5px solid ${THEME.bd}` }}
      >
        <div className="text-[13px]" style={{ color: THEME.mut }}>
          현재 보이는 데이터를 엑셀로 내보냅니다 ({curRows.length}건)
        </div>
        <button
          className="text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-60"
          style={{ background: THEME.gd }}
          onClick={doExport}
          disabled={exportBusy}
        >
          {exportBusy ? "생성 중..." : "엑셀 다운로드"}
        </button>
      </div>

      {curRows.length === 0 ? (
        <div className="text-center text-sm py-8" style={{ color: THEME.mut }}>표시할 데이터가 없습니다</div>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <div className="hidden sm:block rounded-xl overflow-x-auto" style={{ background: THEME.card, border: `0.5px solid ${THEME.bd}` }}>
            <table className="text-[13px] border-collapse w-full min-w-[760px]">
              <thead>
                <tr style={{ background: THEME.gd }}>
                  {["번호", "진행일자", "제품명", "리뷰가이드", "주문번호", "구매자", "수취인", "운송장번호", "결제금액", "리뷰"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-white">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {curRows.map((r, i) => (
                  <tr key={r.id} style={{ borderTop: `0.5px solid ${THEME.bd}` }}>
                    <td className="px-3 py-2 text-center" style={{ color: THEME.mut }}>{curRows.length - i}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-lg"
                        style={
                          statusOf(r) === "예정"
                            ? { background: THEME.wbg, color: THEME.wtx }
                            : { background: THEME.gd, color: "#fff" }
                        }
                      >
                        {fmtDay(r.date_mmdd)}
                      </span>
                    </td>
                    <td className="px-3 py-2">{r.product_name || <span style={{ color: "#BFB7A2" }}>—</span>}</td>
                    <td className="px-3 py-2">{r.review_type || <span style={{ color: "#BFB7A2" }}>—</span>}</td>
                    <td className="px-3 py-2 font-mono">{r.order_no || <span style={{ color: "#BFB7A2" }}>—</span>}</td>
                    <td className="px-3 py-2 text-center">{r.buyer || <span style={{ color: "#BFB7A2" }}>—</span>}</td>
                    <td className="px-3 py-2 text-center">{r.receiver || <span style={{ color: "#BFB7A2" }}>—</span>}</td>
                    <td className="px-3 py-2">
                      {r.tracking ? (
                        <span className="font-mono">{r.tracking}</span>
                      ) : (
                        <span style={{ color: "#BFB7A2" }}>—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium" style={{ color: THEME.gd2 }}>{won(r.amount)}</td>
                    <td className="px-3 py-2 text-center">
                      {r.review_url ? (
                        <a
                          href={r.review_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] px-2.5 py-1 rounded-lg inline-block"
                          style={{ border: `0.5px solid ${THEME.bd2}`, color: THEME.gd }}
                        >
                          리뷰확인
                        </a>
                      ) : (
                        <span style={{ color: "#BFB7A2" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 리스트 */}
          <div className="sm:hidden flex flex-col gap-2">
            {curRows.map((r) => {
              const wait = statusOf(r) === "예정";
              return (
                <div key={r.id} className="rounded-xl p-3" style={{ background: THEME.card, border: `0.5px solid ${THEME.bd}` }}>
                  <div className="flex justify-between items-center gap-2">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-lg"
                      style={wait ? { background: THEME.wbg, color: THEME.wtx } : { background: THEME.gd, color: "#fff" }}
                    >
                      {fmtDay(r.date_mmdd)}
                    </span>
                    <span className="font-mono text-xs">{r.order_no || <span style={{ color: "#BFB7A2" }}>—</span>}</span>
                  </div>
                  <div className="mt-1.5 text-sm font-medium" style={{ color: THEME.gd2 }}>
                    {r.product_name || <span style={{ color: "#BFB7A2" }}>—</span>}
                  </div>
                  {r.review_type && (
                    <div className="mt-1 text-xs" style={{ color: THEME.mut }}>
                      리뷰가이드 <span style={{ color: THEME.gd2 }}>{r.review_type}</span>
                    </div>
                  )}
                  <div className="flex gap-4 mt-2 text-[13px]">
                    <span>
                      <span className="text-[11px]" style={{ color: THEME.mut }}>구매자</span>{" "}
                      {r.buyer || <span style={{ color: "#BFB7A2" }}>—</span>}
                    </span>
                    <span>
                      <span className="text-[11px]" style={{ color: THEME.mut }}>수취인</span>{" "}
                      {r.receiver || <span style={{ color: "#BFB7A2" }}>—</span>}
                    </span>
                  </div>
                  <div
                    className="flex justify-between items-center gap-2 mt-2 pt-2"
                    style={{ borderTop: "0.5px solid #F0EBDC" }}
                  >
                    <span className="text-xs flex items-center gap-1.5 flex-wrap" style={{ color: THEME.mut }}>
                      {r.tracking ? (
                        <>
                          <span className="font-mono">{r.tracking}</span>
                          <button
                            className="text-[11px] px-2 py-0.5 rounded-lg"
                            style={{ border: `0.5px solid ${THEME.bd2}`, background: THEME.iv2, color: THEME.gd }}
                            onClick={() => copyText(r.tracking!)}
                          >
                            복사
                          </button>
                        </>
                      ) : (
                        <span style={{ color: "#BFB7A2" }}>—</span>
                      )}
                    </span>
                    <span className="text-sm font-medium" style={{ color: THEME.gd2 }}>{won(r.amount)}</span>
                  </div>
                  <div className="mt-2 text-right">
                    {r.review_url ? (
                      <a
                        href={r.review_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] px-2.5 py-1 rounded-lg inline-block"
                        style={{ border: `0.5px solid ${THEME.bd2}`, color: THEME.gd }}
                      >
                        리뷰확인
                      </a>
                    ) : (
                      <span style={{ color: "#BFB7A2" }}>—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {toast && (
        <div
          className="fixed left-1/2 bottom-7 -translate-x-1/2 text-white text-[13px] px-4 py-2 rounded-full z-50"
          style={{ background: THEME.gd2, opacity: 0.95 }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
