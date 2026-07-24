"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Group = { writeDate: string; companyCode: string; companyName: string; display: string; itemCount: number; totalQty: number };
type ExtraItem = { name: string; amount: string; vatEnabled: boolean; feeEnabled: boolean };
type GroupRow = {
  productName: string;
  productAmount: number;
  workQty: number;
  productSupply: number;
  workUnit: number;
  workSupply: number;
  deliveryUnit: number;
};

function fmt(v: number) {
  return Number(v || 0).toLocaleString("ko-KR");
}

export default function EstimatePanel() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [selectedKey, setSelectedKey] = useState("");
  const [groupRows, setGroupRows] = useState<GroupRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  const [lang, setLang] = useState<"ko" | "zh">("ko");
  const [vatEnabled, setVatEnabled] = useState(false);
  const [taxRateText, setTaxRateText] = useState("0%");
  const [depositEnabled, setDepositEnabled] = useState(true);
  const [exchangeRate, setExchangeRate] = useState("");
  const [note, setNote] = useState("");
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);

  const [previewHtml, setPreviewHtml] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [summary, setSummary] = useState<{ invoiceAmount?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("준비됨");
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    setLoadingGroups(true);
    setStatus("불러오는 중...");
    try {
      const res = await fetch("/api/admin/estimate/groups");
      const data = await res.json();
      if (data.ok) setGroups(data.options || []);
      setStatus(data.ok ? "불러오기 완료" : data.message || "불러오기 실패");
    } finally {
      setLoadingGroups(false);
    }
  }

  const selected = groups.find((g) => `${g.writeDate}||${g.companyCode}||${g.companyName}` === selectedKey) || null;

  async function selectGroup(g: Group) {
    setSelectedKey(`${g.writeDate}||${g.companyCode}||${g.companyName}`);
    setPreviewHtml("");
    setImageUrl("");
    setSummary(null);
    setRowsLoading(true);
    setStatus("업체 데이터 불러오는 중...");
    try {
      const params = new URLSearchParams({
        writeDate: g.writeDate, companyCode: g.companyCode, companyName: g.companyName,
        exchangeRate: lang === "zh" ? exchangeRate : "",
      });
      const res = await fetch(`/api/admin/estimate/rows?${params.toString()}`);
      const data = await res.json();
      setGroupRows(data.ok ? data.rows || [] : []);
      setStatus(data.ok ? "선택 완료" : data.message || "불러오기 실패");
    } finally {
      setRowsLoading(false);
    }
  }

  function addExtraItem() {
    setExtraItems((prev) => [...prev, { name: "", amount: "", vatEnabled: true, feeEnabled: true }]);
  }
  function updateExtraItem(idx: number, patch: Partial<ExtraItem>) {
    setExtraItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removeExtraItem(idx: number) {
    setExtraItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function extraTotal(it: ExtraItem) {
    const vatRate = vatEnabled ? 0.1 : 0;
    const taxRate = (Number(String(taxRateText).replace(/[^0-9.-]/g, "")) || 0) / 100;
    const supply = Number(it.amount) || 0;
    const tax = it.vatEnabled ? Math.round(supply * vatRate) : 0;
    const fee = it.feeEnabled ? Math.round((supply + tax) * taxRate) : 0;
    return supply + tax + fee;
  }

  function buildPayload() {
    if (!selected) return null;
    return {
      writeDate: selected.writeDate,
      companyCode: selected.companyCode,
      companyName: selected.companyName,
      vatEnabled, taxRateText, note, depositEnabled,
      exchangeRate: Number(exchangeRate) || 0,
      lang,
      extraItems: extraItems.map((x) => ({ name: x.name, amount: Number(x.amount) || 0, vatEnabled: x.vatEnabled, feeEnabled: x.feeEnabled })),
    };
  }

  async function doPreview() {
    const payload = buildPayload();
    if (!payload) {
      setStatus("업체를 먼저 선택해주세요");
      return;
    }
    setBusy(true);
    setStatus("미리보기 생성 중...");
    try {
      const res = await fetch("/api/admin/estimate/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        setStatus("❌ " + (data.message || "미리보기 실패"));
        setPreviewHtml("");
        return;
      }
      setPreviewHtml(data.previewHtml);
      setSummary(data.summary);
      setStatus("미리보기 완료");
    } catch {
      setStatus("❌ 미리보기 중 오류가 발생했습니다");
    } finally {
      setBusy(false);
    }
  }

  async function doSaveAndDownload() {
    const payload = buildPayload();
    if (!payload) {
      setStatus("업체를 먼저 선택해주세요");
      return;
    }
    setBusy(true);
    try {
      setStatus("미리보기 생성 중...");
      const previewRes = await fetch("/api/admin/estimate/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const previewData = await previewRes.json();
      if (!previewData.ok) {
        setStatus("❌ " + (previewData.message || "미리보기 실패"));
        return;
      }
      setPreviewHtml(previewData.previewHtml);
      setSummary(previewData.summary);
      await new Promise((r) => setTimeout(r, 250));

      setStatus("이미지 저장 중...");
      const html2canvas = (await import("html2canvas")).default;
      const node = previewRef.current;
      if (!node) throw new Error("미리보기를 먼저 확인해주세요");
      const canvas = await html2canvas(node, { backgroundColor: "#ffffff", scale: 2 });
      const imageDataUrl = canvas.toDataURL("image/png");

      const a = document.createElement("a");
      a.href = imageDataUrl;
      a.download = `${selected!.writeDate} ${selected!.companyName}.png`;
      a.click();

      const res = await fetch("/api/admin/estimate/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, imageDataUrl }),
      });
      const data = await res.json();
      if (!data.ok) {
        setStatus("❌ " + (data.message || "저장 실패"));
        return;
      }
      setImageUrl(data.imageUrl);
      setStatus(`✅ 발행 완료 · 계산서금액 ${fmt(data.invoiceAmount)}원`);
      loadGroups();
    } catch (err) {
      setStatus("❌ " + (err instanceof Error ? err.message : "저장 중 오류가 발생했습니다"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[1320px] mx-auto w-full">
      <div className="bg-white border border-[#e7ded3] rounded-3xl shadow-[0_10px_28px_rgba(70,55,40,0.06)] p-6 mb-4">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h1 className="text-2xl font-extrabold text-[#2f2a24] m-0">🧾 견적서 발행 시스템</h1>
            <p className="text-[#6b6055] mt-1 leading-relaxed">
              업체견적서 기준으로 미발행(접수+발행일 공란) 업체를 불러오고 미리보기를 확인한 뒤 발행할 수 있어요
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className={`text-sm font-extrabold ${lang === "ko" ? "text-[#0d5c63]" : "text-[#7b6a58]"}`}
              onClick={() => setLang("ko")}
            >
              한국어
            </button>
            <span className="text-[#9f9388]">|</span>
            <button
              className={`text-sm font-extrabold ${lang === "zh" ? "text-[#0d5c63]" : "text-[#7b6a58]"}`}
              onClick={() => setLang("zh")}
            >
              中文
            </button>
          </div>
          <Link href="/admin" className="text-xs font-bold text-emerald-700 underline whitespace-nowrap self-start mt-1">
            ← 메인 전체보기
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* 좌측: 미발행 업체 목록 */}
        <div className="bg-white border border-[#e7ded3] rounded-3xl p-5 h-fit">
          <h2 className="text-lg font-extrabold text-[#2f2a24] mb-3">미발행 업체 목록</h2>
          <button
            className="w-full bg-[#eadfce] text-[#2a2116] font-extrabold rounded-xl px-4 py-2.5 disabled:opacity-60"
            onClick={loadGroups}
            disabled={loadingGroups}
          >
            {loadingGroups ? "불러오는 중..." : "미발행 목록 새로고침"}
          </button>
          <div className="mt-3 bg-[#f2ece4] rounded-xl px-3 py-2.5 text-sm text-[#2f2a24]">{status}</div>
          <div className="mt-3 flex flex-col gap-2.5 max-h-[600px] overflow-auto">
            {!groups.length && !loadingGroups && (
              <div className="text-sm text-[#6b6055] px-1">미발행 대상이 없어요</div>
            )}
            {groups.map((g) => {
              const key = `${g.writeDate}||${g.companyCode}||${g.companyName}`;
              const active = key === selectedKey;
              return (
                <div
                  key={key}
                  onClick={() => selectGroup(g)}
                  className={`cursor-pointer rounded-2xl border p-3.5 ${
                    active ? "border-2 border-[#b69063] bg-[#fff4e2]" : "border-[#e7ded3] bg-[#fff8ef]"
                  }`}
                >
                  <div className="font-extrabold text-[#2f2a24] mb-1.5">{g.companyName}</div>
                  <div className="text-xs text-[#6b6055]">{g.display}</div>
                  <div className="text-xs text-[#6b6055] mt-1">
                    제품 {g.itemCount}건 · 수량합 {g.totalQty}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 우측: 설정 + 미리보기 */}
        <div className="bg-white border border-[#e7ded3] rounded-3xl p-5">
          <h2 className="text-lg font-extrabold text-[#2f2a24] mb-3">견적서 설정 및 미리보기</h2>

          <div className="mb-3">
            <div className="text-xs font-extrabold text-[#6b6055] mb-1.5">선택 업체</div>
            <input
              readOnly
              className="w-full border border-[#d6cab9] rounded-xl px-3.5 py-3 text-sm bg-[#fbf7f0]"
              value={selected ? selected.display : ""}
              placeholder="업체를 선택해줘"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <div className="text-xs font-extrabold text-[#6b6055] mb-1.5">세금계산서 (VAT 10%)</div>
              <label className="flex items-center gap-2 border border-[#d6cab9] rounded-xl px-3.5 py-3 text-sm bg-white cursor-pointer">
                <input type="checkbox" checked={vatEnabled} onChange={(e) => setVatEnabled(e.target.checked)} />
                {vatEnabled ? "포함" : "미포함"}
              </label>
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#6b6055] mb-1.5">세무처리비용율</div>
              <select
                className="w-full border border-[#d6cab9] rounded-xl px-3.5 py-3 text-sm bg-white"
                value={taxRateText}
                onChange={(e) => setTaxRateText(e.target.value)}
              >
                {["0%", "5%", "10%", "15%", "20%"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#6b6055] mb-1.5">입금대행 진행여부</div>
              <label className="flex items-center gap-2 border border-[#d6cab9] rounded-xl px-3.5 py-3 text-sm bg-white cursor-pointer">
                <input type="checkbox" checked={depositEnabled} onChange={(e) => setDepositEnabled(e.target.checked)} />
                {depositEnabled ? "진행" : "미진행"}
              </label>
            </div>
            {lang === "zh" && (
              <div>
                <div className="text-xs font-extrabold text-[#6b6055] mb-1.5">환율 입력 (1元=?원)</div>
                <input
                  type="number"
                  className="w-full border border-[#d6cab9] rounded-xl px-3.5 py-3 text-sm bg-white"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  placeholder="예: 190"
                />
              </div>
            )}
          </div>

          <div className="mb-3">
            <div className="text-xs font-extrabold text-[#6b6055] mb-1.5">비고</div>
            <textarea
              className="w-full border border-[#d6cab9] rounded-xl px-3.5 py-3 text-sm bg-white"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="비고 내용을 직접 입력해줘"
            />
          </div>

          <div className="overflow-auto rounded-xl border border-[#e7ded3]">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#eadfce]">
                  {["제품명", "제품금액", "진행수량", "제품비 공급가액", "진행단가", "진행비 공급가액", "택배비"].map((h) => (
                    <th key={h} className="border border-[#e7ded3] px-2 py-2 font-extrabold text-[#2a2116]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center text-[#6b6055] py-4">
                      불러오는 중...
                    </td>
                  </tr>
                ) : groupRows.length ? (
                  groupRows.map((r, i) => (
                    <tr key={i}>
                      <td className="border border-[#e7ded3] px-2 py-1.5 text-center">{r.productName}</td>
                      <td className="border border-[#e7ded3] px-2 py-1.5 text-center">{fmt(r.productAmount)}</td>
                      <td className="border border-[#e7ded3] px-2 py-1.5 text-center">{fmt(r.workQty)}</td>
                      <td className="border border-[#e7ded3] px-2 py-1.5 text-center">{fmt(r.productSupply)}</td>
                      <td className="border border-[#e7ded3] px-2 py-1.5 text-center">{fmt(r.workUnit)}</td>
                      <td className="border border-[#e7ded3] px-2 py-1.5 text-center">{fmt(r.workSupply)}</td>
                      <td className="border border-[#e7ded3] px-2 py-1.5 text-center">{fmt(r.deliveryUnit)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center text-[#6b6055] py-4">
                      업체를 선택해줘
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-[#fbf6ec] border border-[#e7ded3] rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <strong className="text-sm text-[#2a2116]">기타금액 항목</strong>
              <button className="bg-[#eadfce] text-[#2a2116] text-xs font-extrabold rounded-lg px-2.5 py-1.5" onClick={addExtraItem}>
                + 항목 추가
              </button>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#eadfce]">
                    <th className="border border-[#e7ded3] px-2 py-1.5">항목명</th>
                    <th className="border border-[#e7ded3] px-2 py-1.5">금액</th>
                    <th className="border border-[#e7ded3] px-2 py-1.5">부가세</th>
                    <th className="border border-[#e7ded3] px-2 py-1.5">세무처리비</th>
                    <th className="border border-[#e7ded3] px-2 py-1.5">합계</th>
                    <th className="border border-[#e7ded3] px-2 py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {!extraItems.length ? (
                    <tr>
                      <td colSpan={6} className="text-center text-[#999] py-3.5">
                        —
                      </td>
                    </tr>
                  ) : (
                    extraItems.map((it, idx) => {
                      const total = extraTotal(it);
                      return (
                        <tr key={idx}>
                          <td className="border border-[#e7ded3] px-1.5 py-1">
                            <input
                              className="w-full border border-[#d6cab9] rounded-lg px-2 py-1 text-xs"
                              placeholder="예: 디자인비"
                              value={it.name}
                              onChange={(e) => updateExtraItem(idx, { name: e.target.value })}
                            />
                          </td>
                          <td className="border border-[#e7ded3] px-1.5 py-1">
                            <input
                              className="w-full border border-[#d6cab9] rounded-lg px-2 py-1 text-xs text-right"
                              value={it.amount}
                              onChange={(e) => updateExtraItem(idx, { amount: e.target.value.replace(/[^0-9-]/g, "") })}
                            />
                          </td>
                          <td className="border border-[#e7ded3] px-1.5 py-1">
                            <select
                              className="w-full border border-[#d6cab9] rounded-lg px-1 py-1 text-xs"
                              value={it.vatEnabled ? "Y" : "N"}
                              onChange={(e) => updateExtraItem(idx, { vatEnabled: e.target.value === "Y" })}
                            >
                              <option value="Y">적용</option>
                              <option value="N">미적용</option>
                            </select>
                          </td>
                          <td className="border border-[#e7ded3] px-1.5 py-1">
                            <select
                              className="w-full border border-[#d6cab9] rounded-lg px-1 py-1 text-xs"
                              value={it.feeEnabled ? "Y" : "N"}
                              onChange={(e) => updateExtraItem(idx, { feeEnabled: e.target.value === "Y" })}
                            >
                              <option value="Y">적용</option>
                              <option value="N">미적용</option>
                            </select>
                          </td>
                          <td
                            className={`border border-[#e7ded3] px-2 py-1 text-center font-extrabold bg-[#f7f0e2] ${
                              total < 0 ? "text-rose-600" : "text-[#2a2116]"
                            }`}
                          >
                            {fmt(total)}
                          </td>
                          <td className="border border-[#e7ded3] px-1 py-1 text-center">
                            <button className="text-rose-500 font-bold" onClick={() => removeExtraItem(idx)}>
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2.5 flex-wrap mt-4">
            <button
              className="bg-[#eadfce] text-[#2a2116] font-extrabold rounded-xl px-4 py-3 disabled:opacity-60"
              onClick={doPreview}
              disabled={busy || !selected}
            >
              미리보기
            </button>
            <button
              className="bg-[#26211c] text-white font-extrabold rounded-xl px-4 py-3 disabled:opacity-60"
              onClick={doSaveAndDownload}
              disabled={busy || !selected}
            >
              견적서 발행하기
            </button>
          </div>
          {summary?.invoiceAmount != null && (
            <div className="text-xs text-[#6b6055] mt-2">계산서금액(예상): {fmt(summary.invoiceAmount)}원</div>
          )}

          <div className="mt-4 border border-[#e7ded3] rounded-2xl bg-white p-3 overflow-auto min-h-[200px]">
            {previewHtml ? (
              <div ref={previewRef} dangerouslySetInnerHTML={{ __html: previewHtml }} style={{ width: 900 }} />
            ) : (
              <div className="text-[#777] text-center py-24">견적서 발행 후 여기에 깔끔한 미리보기가 보여요</div>
            )}
          </div>

          {imageUrl && (
            <div className="mt-3">
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-[#26211c] text-white rounded-xl px-3.5 py-2.5 text-sm font-extrabold"
              >
                이미지 열기
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
