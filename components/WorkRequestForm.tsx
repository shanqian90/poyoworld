"use client";

import { useEffect, useMemo, useState } from "react";
import { Vendor } from "@/lib/types";
import { discountUnit } from "@/lib/workRequestExpand";
import { WorkRequestReuse } from "@/components/RecentRequests";

type ProductRow = {
  id: number;
  url: string;
  start: string;
  opt: string;
  keyword: string;
  price: string;
  total: string;
  daily: string;
  review: string;
};

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let seq = 0;
function newProduct(): ProductRow {
  return { id: ++seq, url: "", start: today(), opt: "", keyword: "", price: "", total: "", daily: "", review: "" };
}

export default function WorkRequestForm({
  vendor,
  loginId,
  reuseSignal,
}: {
  vendor: Vendor;
  loginId: string;
  reuseSignal?: { data: WorkRequestReuse; key: number } | null;
}) {
  const [options, setOptions] = useState({
    realShip: "N",
    taxBill: "N",
    weekend: "N",
    payAgent: "N",
    shipAgent: "N",
  });
  const [products, setProducts] = useState<ProductRow[]>([newProduct()]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "" | "ok" | "err"; text: string }>({ type: "", text: "" });
  const [submittedEstimate, setSubmittedEstimate] = useState<{ receiptNo: string; count: number; total: number } | null>(null);

  useEffect(() => {
    if (!reuseSignal) return;
    const r = reuseSignal.data;
    setOptions(r.options);
    setProducts((prev) => {
      const filled = prev.filter((p) => p.keyword.trim() || p.url.trim());
      const reused: ProductRow = {
        id: ++seq,
        url: r.productUrl,
        start: today(),
        opt: r.option,
        keyword: r.keyword,
        price: r.price,
        total: r.total,
        daily: r.daily,
        review: r.review,
      };
      return [...filled, reused];
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reuseSignal]);

  const baseUnit = options.realShip === "Y" ? vendor.real_ship_price : vendor.empty_box_price;

  const estimate = useMemo(() => {
    const items = products.map((p) => {
      const qty = Number(p.total) || 0;
      const unit = discountUnit(baseUnit, qty);
      return { keyword: p.keyword, qty, unit, subtotal: unit * qty };
    });
    const workTotal = items.reduce((s, it) => s + it.subtotal, 0);
    const qtySum = items.reduce((s, it) => s + it.qty, 0);
    const deliveryTotal = options.shipAgent === "Y" ? 2500 * qtySum : 0;
    const subtotal = workTotal + deliveryTotal;
    const vat = options.taxBill === "Y" ? Math.round(subtotal * 0.1) : 0;
    const taxFee = options.taxBill === "Y" ? Math.round((subtotal + vat) * 0.1) : 0;
    const total = subtotal + vat + taxFee;
    return { items, workTotal, deliveryTotal, subtotal, vat, taxFee, total, qtySum };
  }, [products, baseUnit, options.shipAgent, options.taxBill]);

  function updateProduct(id: number, patch: Partial<ProductRow>) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function addProduct() {
    setProducts((prev) => [...prev, newProduct()]);
  }
  function removeProduct(id: number) {
    setProducts((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  }

  async function submit() {
    setStatus({ type: "", text: "" });
    const valid = products.filter((p) => (p.url || p.keyword) && Number(p.total) > 0);
    if (!valid.length) {
      setStatus({ type: "err", text: "제품을 1개 이상 입력해주세요 (검색키워드, 총진행건수는 필수)" });
      return;
    }
    for (const p of valid) {
      if (!p.keyword.trim()) {
        setStatus({ type: "err", text: "모든 제품의 검색키워드를 입력해주세요" });
        return;
      }
      if (!p.start) {
        setStatus({ type: "err", text: "모든 제품의 시작일을 입력해주세요" });
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/vendor/request/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId,
          vendorId: vendor.id,
          options,
          products: valid.map((p) => ({
            productUrl: p.url,
            startDate: p.start,
            option: p.opt,
            keyword: p.keyword,
            price: p.price === "" ? null : Number(p.price),
            totalCount: Number(p.total),
            dailyPlan: p.daily,
            reviewType: p.review,
          })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setStatus({ type: "err", text: data.message || "제출 실패" });
        return;
      }
      setStatus({ type: "ok", text: `✅ 접수 완료! 접수번호: ${data.receiptNo}\n제품 ${data.count}개 등록되었습니다` });
      setSubmittedEstimate({ receiptNo: data.receiptNo, count: data.count, total: data.estimatedTotal || 0 });
      setProducts([newProduct()]);
    } catch {
      setStatus({ type: "err", text: "제출 중 오류가 발생했습니다" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-t border-emerald-800/10 pt-3">
      <div className="text-sm font-extrabold text-emerald-950 mb-2">진행 제품</div>
      <div className="flex flex-col gap-3 mb-3">
        {products.map((p, idx) => (
          <div key={p.id} className="border border-emerald-800 rounded-xl p-3 relative bg-emerald-800/5">
            <div className="text-xs font-bold text-emerald-900 mb-2">제품 {idx + 1}</div>
            {products.length > 1 && (
              <button
                className="absolute top-2 right-2 text-[11px] bg-rose-50 text-rose-600 font-bold rounded px-2 py-0.5"
                onClick={() => removeProduct(p.id)}
              >
                삭제
              </button>
            )}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Field label="제품 URL">
                <input className="input" value={p.url} onChange={(e) => updateProduct(p.id, { url: e.target.value })} />
              </Field>
              <Field label="시작일">
                <input type="date" className="input" value={p.start} onChange={(e) => updateProduct(p.id, { start: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Field label="검색키워드 (제품명)" required>
                <input className="input" value={p.keyword} onChange={(e) => updateProduct(p.id, { keyword: e.target.value })} />
              </Field>
              <Field label="옵션">
                <input className="input" value={p.opt} onChange={(e) => updateProduct(p.id, { opt: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Field label="제품금액(원)" required>
                <input type="number" className="input" value={p.price} onChange={(e) => updateProduct(p.id, { price: e.target.value })} />
              </Field>
              <Field label="리뷰종류">
                <input
                  className="input"
                  placeholder="예: 포토8 텍3 별3"
                  value={p.review}
                  onChange={(e) => updateProduct(p.id, { review: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="총 진행할 체험단 수량" required>
                <input type="number" className="input" value={p.total} onChange={(e) => updateProduct(p.id, { total: e.target.value })} />
              </Field>
              <Field label="일진행건수 (예: 3 또는 1/2/1)">
                <input className="input" value={p.daily} onChange={(e) => updateProduct(p.id, { daily: e.target.value })} />
              </Field>
            </div>
          </div>
        ))}
      </div>

      <button className="text-xs text-emerald-900 underline mb-4" onClick={addProduct}>
        + 제품 추가
      </button>

      <div className="text-sm font-extrabold text-emerald-950 mb-2">진행 옵션</div>
      <div className="flex flex-col gap-2 mb-4">
        <OptionToggle label="제품 실제배송" value={options.realShip} onChange={(v) => setOptions({ ...options, realShip: v })} />
        <OptionToggle label="입금대행 (무료서비스)" value={options.payAgent} onChange={(v) => setOptions({ ...options, payAgent: v })} />
        <OptionToggle label="택배대행 (2,500원/건)" value={options.shipAgent} onChange={(v) => setOptions({ ...options, shipAgent: v })} />
        <OptionToggle label="주말 진행" value={options.weekend} onChange={(v) => setOptions({ ...options, weekend: v })} />
        <OptionToggle label="세금계산서 발행" value={options.taxBill} onChange={(v) => setOptions({ ...options, taxBill: v })} />
      </div>
      <div className="text-[11px] text-neutral-400 -mt-3 mb-4 leading-relaxed">
        * 주말 진행은 월 100건 미만인 경우 건당 +1,000원이 추가됩니다
        <br />
        * 100건 이상 진행 시 실배송단가 2,500원, 빈박스단가 3,000원으로 자동 할인 계산됩니다
      </div>

      <div className="bg-emerald-800/5 border border-emerald-300 rounded-xl px-3 py-3 mb-4">
        <div className="text-xs font-bold text-neutral-500 mb-2">💰 예상 금액 상세내역</div>
        <div className="flex flex-col gap-1 text-xs text-neutral-600">
          {estimate.items.map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-neutral-500 truncate">
                {it.keyword || `제품 ${i + 1}`} ({it.qty}건 × {it.unit.toLocaleString("ko-KR")}원)
              </span>
              <span className="font-bold text-neutral-700 shrink-0">{it.subtotal.toLocaleString("ko-KR")}원</span>
            </div>
          ))}
          {options.shipAgent === "Y" && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-500">택배대행 ({estimate.qtySum}건 × 2,500원)</span>
              <span className="font-bold text-neutral-700 shrink-0">{estimate.deliveryTotal.toLocaleString("ko-KR")}원</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-1.5 mt-0.5 border-t border-emerald-800/10">
            <span className="text-neutral-500">소계</span>
            <span className="font-bold text-neutral-700">{estimate.subtotal.toLocaleString("ko-KR")}원</span>
          </div>
          {options.taxBill === "Y" && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">부가세 (10%)</span>
                <span className="font-bold text-neutral-700">+{estimate.vat.toLocaleString("ko-KR")}원</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">세무처리비용 (10%)</span>
                <span className="font-bold text-neutral-700">+{estimate.taxFee.toLocaleString("ko-KR")}원</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-emerald-800/20">
          <span className="text-xs font-bold text-neutral-500">최종 합계</span>
          <span className="text-xl font-extrabold text-emerald-900">{estimate.total.toLocaleString("ko-KR")}원</span>
        </div>
        <div className="text-[11px] text-neutral-400 mt-1">
          입금대행 관련 정확한 금액은 관리자 확인 후 별도 안내됩니다
        </div>
      </div>

      <button
        className="w-full bg-emerald-900 text-white font-extrabold rounded-xl py-3 disabled:opacity-60"
        onClick={submit}
        disabled={submitting}
      >
        {submitting ? "제출 중..." : "작업 요청서 제출"}
      </button>

      {status.text && (
        <div
          className={`mt-3 rounded-xl px-3 py-2 text-sm whitespace-pre-line ${
            status.type === "ok" ? "bg-green-50 border border-green-300 text-green-800" : "bg-rose-100 border border-rose-300 text-rose-700"
          }`}
        >
          {status.text}
        </div>
      )}

      {status.type === "ok" && submittedEstimate && (
        <div className="bg-emerald-800/5 border border-emerald-300 rounded-xl px-3 py-3 mt-3">
          <div className="text-xs font-bold text-neutral-500">청구 금액</div>
          <div className="text-xl font-extrabold text-emerald-900">{submittedEstimate.total.toLocaleString("ko-KR")}원</div>
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid #a7f3d0;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label
        className={
          required
            ? "block text-sm font-extrabold text-neutral-900 mb-1"
            : "block text-[11px] font-bold text-neutral-500 mb-0.5"
        }
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function OptionToggle({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="border border-emerald-800 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2 bg-white">
      <span className="text-sm font-bold text-neutral-700">{label}</span>
      <div className="flex gap-1.5 shrink-0">
        <button
          className={`text-xs font-bold rounded px-3 py-1 ${value === "Y" ? "bg-emerald-900 text-white" : "bg-neutral-100 text-neutral-500"}`}
          onClick={() => onChange("Y")}
        >
          예
        </button>
        <button
          className={`text-xs font-bold rounded px-3 py-1 ${value === "N" ? "bg-neutral-600 text-white" : "bg-neutral-100 text-neutral-500"}`}
          onClick={() => onChange("N")}
        >
          아니오
        </button>
      </div>
    </div>
  );
}
