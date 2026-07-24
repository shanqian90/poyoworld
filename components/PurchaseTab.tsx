"use client";

import { useEffect, useMemo, useState } from "react";
import { Account, SlotMap, SlotOption } from "@/lib/types";
import { todayMMDD } from "@/lib/phone";
import { compressImage } from "@/lib/image";

type AccountState = {
  checked: boolean;
  orderNo: string;
  files: File[];
};

export default function PurchaseTab({
  kakaoId,
  accounts,
  todayMap,
  prefill,
  onAfterSubmit,
}: {
  kakaoId: string;
  accounts: Account[];
  todayMap: SlotMap;
  prefill: { product: string; option: string } | null;
  onAfterSubmit: () => void;
}) {
  const [dateText, setDateText] = useState(todayMMDD());
  const [slotMap, setSlotMap] = useState<SlotMap>(todayMap);
  const [productName, setProductName] = useState("");
  const [optionNo, setOptionNo] = useState("");
  const [accState, setAccState] = useState<Record<string, AccountState>>({});
  const [status, setStatus] = useState<{ type: "" | "ok" | "err" | "loading"; text: string }>({
    type: "",
    text: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submittedList, setSubmittedList] = useState<
    { store: string; orderNo: string; images: string[] }[]
  >([]);

  useEffect(() => {
    if (dateText === todayMMDD()) setSlotMap(todayMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayMap]);

  async function loadSlots(date: string) {
    if (!/^\d{4}$/.test(date)) {
      setSlotMap({});
      return;
    }
    if (date === todayMMDD()) {
      setSlotMap(todayMap);
      return;
    }
    const res = await fetch(`/api/slots?date=${date}`);
    const data = await res.json();
    setSlotMap(data.ok ? data.map : {});
  }

  useEffect(() => {
    if (!prefill) return;
    const d = todayMMDD();
    setDateText(d);
    loadSlots(d).then(() => {
      const names = Object.keys(d === todayMMDD() ? todayMap : slotMap);
      const target = names.find(
        (n) => n.replace(/\s+/g, "").toLowerCase() === prefill.product.replace(/\s+/g, "").toLowerCase()
      );
      if (target) {
        setProductName(target);
        const opts = (d === todayMMDD() ? todayMap : slotMap)[target] || [];
        const matchedOpt = opts.find(
          (o) => o.label.replace(/\s+/g, "").toLowerCase() === prefill.option.replace(/\s+/g, "").toLowerCase()
        );
        if (matchedOpt) setOptionNo(matchedOpt.value);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const productOptions = Object.keys(slotMap);
  const options: SlotOption[] = productName ? slotMap[productName] || [] : [];
  const selectedOption = options.find((o) => o.value === optionNo);

  const checkedAccounts = useMemo(
    () => accounts.filter((a) => accState[a.id]?.checked),
    [accounts, accState]
  );

  function toggleAccount(id: string) {
    setAccState((prev) => {
      const cur = prev[id] || { checked: false, orderNo: "", files: [] };
      return { ...prev, [id]: { ...cur, checked: !cur.checked } };
    });
  }

  function setOrderNo(id: string, value: string) {
    setAccState((prev) => {
      const cur = prev[id] || { checked: true, orderNo: "", files: [] };
      return { ...prev, [id]: { ...cur, orderNo: value } };
    });
  }

  function setFiles(id: string, files: File[]) {
    setAccState((prev) => {
      const cur = prev[id] || { checked: true, orderNo: "", files: [] };
      return { ...prev, [id]: { ...cur, files: files.slice(0, 2) } };
    });
  }

  const [extracting, setExtracting] = useState<Record<string, boolean>>({});

  async function onFileInput(id: string, fileList: FileList | null) {
    const existing = accState[id]?.files || [];
    const added = Array.from(fileList || []);
    const next = existing.concat(added);
    setFiles(id, next);

    const currentOrderNo = (accState[id]?.orderNo || "").trim();
    if (!currentOrderNo && added.length) {
      setExtracting((prev) => ({ ...prev, [id]: true }));
      try {
        const dataUrl = await compressImage(added[0], 1000, 0.85);
        const res = await fetch("/api/purchase/extract-order-no", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });
        const data = await res.json();
        if (data.ok && data.orderNo) setOrderNo(id, data.orderNo);
      } catch {
        /* 자동추출 실패는 조용히 무시 — 직접 입력하면 됨 */
      } finally {
        setExtracting((prev) => ({ ...prev, [id]: false }));
      }
    }
  }

  function removeFile(id: string, idx: number) {
    const existing = accState[id]?.files || [];
    setFiles(id, existing.filter((_, i) => i !== idx));
  }

  async function submitAll() {
    if (!dateText) return setStatus({ type: "err", text: "구매일을 입력해주세요" });
    if (!productName) return setStatus({ type: "err", text: "제품명을 선택해주세요" });
    if (!optionNo) return setStatus({ type: "err", text: "옵션번호를 선택해주세요" });
    if (!checkedAccounts.length) return setStatus({ type: "err", text: "제출할 계정을 선택해주세요" });

    for (const acc of checkedAccounts) {
      const st = accState[acc.id];
      if (!st.orderNo.trim()) return setStatus({ type: "err", text: `${acc.store} 계정의 주문번호를 입력해주세요` });
      if (!st.files.length) return setStatus({ type: "err", text: `${acc.store} 계정의 이미지를 올려주세요` });
    }
    const orderNos = checkedAccounts.map((a) => accState[a.id].orderNo.trim());
    if (new Set(orderNos).size !== orderNos.length) {
      return setStatus({ type: "err", text: "주문번호가 중복되었습니다" });
    }

    setSubmitting(true);
    setStatus({ type: "loading", text: "🌸 이미지 처리중..." });
    try {
      const submissions = [];
      for (const acc of checkedAccounts) {
        const st = accState[acc.id];
        const images: string[] = [];
        for (const f of st.files) images.push(await compressImage(f));
        submissions.push({
          orderNo: st.orderNo.trim(),
          buyer: acc.buyer,
          receiver: acc.receiver,
          userId: acc.user_id,
          phone: acc.phone,
          address: acc.address,
          accountText: `${acc.bank} ${acc.account_no} ${acc.holder}`,
          images,
        });
      }

      setStatus({ type: "loading", text: "서버에 전송중입니다..." });
      const res = await fetch("/api/purchase/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateText, productName, optionNo, kakaoId, submissions }),
      });
      const data = await res.json();
      if (!data.ok) {
        setStatus({ type: "err", text: data.message || "제출 실패" });
        return;
      }
      setStatus({
        type: "ok",
        text: `🌸 제출완료 🌸\n총 ${data.count}건이 정상 저장되었습니다\n주문번호\n${orderNos.join("\n")}`,
      });
      type SubmitResult = { orderNo: string; ok: boolean; images?: string[] };
      const resultByOrderNo = new Map<string, SubmitResult>(
        (data.results || []).map((r: SubmitResult) => [r.orderNo, r])
      );
      setSubmittedList(
        checkedAccounts.map((acc) => ({
          store: acc.store,
          orderNo: accState[acc.id].orderNo.trim(),
          images: resultByOrderNo.get(accState[acc.id].orderNo.trim())?.images || [],
        }))
      );
      setDone(true);
      onAfterSubmit();
    } catch {
      setStatus({ type: "err", text: "제출 중 오류가 발생했습니다" });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setAccState({});
    setStatus({ type: "", text: "" });
    setDone(false);
    setSubmittedList([]);
    setDateText(todayMMDD());
    loadSlots(todayMMDD());
  }

  return (
    <div>
      {!done && (
        <>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">📅 구매일</label>
            <input
              className="w-full border border-rose-200 rounded-xl px-3 py-2 text-sm"
              placeholder="예: 0724"
              maxLength={4}
              value={dateText}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setDateText(v);
                loadSlots(v);
                setProductName("");
                setOptionNo("");
              }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">🛍️ 제품명</label>
            <select
              className="w-full border border-rose-200 rounded-xl px-3 py-2 text-sm bg-white"
              value={productName}
              disabled={!productOptions.length}
              onChange={(e) => {
                setProductName(e.target.value);
                setOptionNo("");
              }}
            >
              <option value="">제품 선택</option>
              {productOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">🎀 옵션번호</label>
            <select
              className="w-full border border-rose-200 rounded-xl px-3 py-2 text-sm bg-white"
              value={optionNo}
              disabled={!options.length}
              onChange={(e) => setOptionNo(e.target.value)}
            >
              <option value="">옵션 선택</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} (남은 {o.remaining}건)
                </option>
              ))}
            </select>
          </div>
          {selectedOption?.amount != null && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl px-3 py-2 text-center mb-3">
              <div className="text-[11px] font-bold text-neutral-500">💰 구매금액</div>
              <div className="text-lg font-extrabold text-rose-600">
                {selectedOption.amount.toLocaleString("ko-KR")}원
              </div>
            </div>
          )}

          <div className="bg-rose-600 rounded-xl px-3 py-2 text-center mb-2">
            <div className="text-xs font-bold text-white leading-relaxed">
              ⚠️ 찜 사진 절대 금지! 주문번호+옵션이 보이는 주문상세 캡처만 올려주세요
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold">👤 계정 선택</div>
            <span className="text-xs bg-rose-100 text-rose-500 font-bold px-2 py-0.5 rounded-full">
              {accounts.length}개 저장됨
            </span>
          </div>

          {!accounts.length && (
            <div className="text-center text-sm text-neutral-500 py-6">
              저장된 계정이 없습니다
              <br />
              계정 등록하기에서 먼저 추가해주세요 😊
            </div>
          )}

          <div className="flex flex-col gap-2 mb-3">
            {accounts.map((acc) => {
              const st = accState[acc.id] || { checked: false, orderNo: "", files: [] };
              return (
                <div key={acc.id} className={`border rounded-xl overflow-hidden ${st.checked ? "border-rose-400" : "border-rose-100"}`}>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${st.checked ? "bg-rose-50" : ""}`}
                    onClick={() => toggleAccount(acc.id)}
                  >
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center text-xs shrink-0 ${
                        st.checked ? "bg-rose-500 text-white" : "border-2 border-neutral-200"
                      }`}
                    >
                      {st.checked ? "✓" : ""}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold">{acc.store}</div>
                      <div className="text-[11px] text-neutral-500 truncate">
                        {acc.buyer} · {acc.user_id} · {acc.phone}
                      </div>
                    </div>
                  </div>
                  {st.checked && (
                    <div className="px-3 pb-3 pt-1 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <input
                          className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
                          placeholder="주문번호"
                          value={st.orderNo}
                          disabled={!!extracting[acc.id]}
                          onChange={(e) => setOrderNo(acc.id, e.target.value)}
                        />
                        {extracting[acc.id] && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-rose-400">
                            🔎 주문번호 추출 중...
                          </div>
                        )}
                      </div>
                      <label className="border-2 border-dashed border-rose-300 rounded-lg px-3 py-3 text-center text-xs font-bold text-rose-500 cursor-pointer bg-rose-50">
                        📎 주문상세 이미지 첨부 (최대 2장)
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => onFileInput(acc.id, e.target.files)}
                        />
                      </label>
                      {st.files.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {st.files.map((f, i) => (
                            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-rose-200">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs"
                                onClick={() => removeFile(acc.id, i)}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            className="w-full bg-gradient-to-r from-green-400 to-green-600 text-white font-extrabold rounded-xl py-3 disabled:opacity-60"
            onClick={submitAll}
            disabled={submitting}
          >
            {submitting ? "⏳ 제출 중..." : "✅ 선택 계정 구매폼 일괄 제출"}
          </button>
        </>
      )}

      {status.text && (
        <div
          className={`mt-3 rounded-xl px-3 py-3 text-sm whitespace-pre-line font-bold ${
            status.type === "ok"
              ? "bg-green-50 border border-green-300 text-green-800"
              : status.type === "err"
              ? "bg-rose-100 border border-rose-300 text-rose-700"
              : "bg-rose-50 border border-rose-200 text-rose-700"
          }`}
        >
          {status.text}
        </div>
      )}

      {done && submittedList.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="text-sm font-bold text-neutral-600">📋 방금 제출한 내역</div>
          {submittedList.map((s) => (
            <div key={s.orderNo} className="border border-rose-200 rounded-xl px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold">{s.store}</div>
                <div className="text-xs text-neutral-500">{s.orderNo}</div>
              </div>
              {s.images.length > 0 ? (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {s.images.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-rose-200" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-neutral-400 mt-1">이미지 없음</div>
              )}
            </div>
          ))}
        </div>
      )}

      {done && (
        <button
          className="w-full mt-3 bg-gradient-to-r from-rose-400 to-rose-500 text-white font-extrabold rounded-xl py-3"
          onClick={resetForm}
        >
          🌸 이어서 제출하기
        </button>
      )}
    </div>
  );
}
