"use client";

import { useState } from "react";
import { GuideProduct } from "@/lib/types";

export default function GuideTab({
  products,
  onSelect,
}: {
  products: GuideProduct[];
  onSelect: (product: string, option: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!products.length) {
    return (
      <div className="text-center text-sm text-neutral-500 py-10">
        😴 진행 중인 제품이 없습니다
      </div>
    );
  }

  return (
    <div>
      <div className="bg-rose-50 border-2 border-rose-500 rounded-xl px-3 py-2 text-xs font-bold text-rose-500 text-center leading-relaxed mb-3">
        ⚠️ 안내 외 제품 구매 금지 ⚠️
        <br />
        ⚠️ 링크구매 제품 잘못구매하시면 보상불가 ⚠️
      </div>
      <div className="flex flex-col gap-2">
        {products.map((p, idx) => {
          const isOpen = openId === p.id;
          return (
            <div
              key={p.id}
              className={`border-2 rounded-2xl p-3 cursor-pointer ${
                isOpen ? "border-rose-400" : "border-rose-200"
              }`}
              onClick={() => setOpenId(isOpen ? null : p.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-lg font-extrabold flex items-center gap-1 flex-wrap">
                    <span className="text-rose-500">{p.number_text || idx + 1}번</span>
                    <span>{p.short_name}</span>
                    <span className={`text-xs text-rose-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                  </div>
                  {p.full_name && (
                    <div className="text-xs text-neutral-500 mt-0.5">{p.full_name}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {p.price != null && (
                    <div className="text-lg font-extrabold">{p.price.toLocaleString("ko-KR")}원</div>
                  )}
                  {p.review_fee && (
                    <div className="inline-block bg-yellow-100 text-neutral-700 text-[11px] font-extrabold px-2 py-0.5 rounded-full mt-1">
                      {p.review_fee}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-1 flex-wrap mt-2">
                {p.platform && <Badge color="bg-orange-50 text-orange-700">{p.platform}</Badge>}
                {p.delivery && <Badge color="bg-green-50 text-green-700">{p.delivery}</Badge>}
                {p.buy_type && (
                  <Badge color={p.buy_type.includes("링크") ? "bg-rose-50 text-rose-600 border border-rose-500" : "bg-violet-50 text-violet-700"}>
                    {p.buy_type}
                  </Badge>
                )}
              </div>

              {isOpen && (
                <div className="mt-3 pt-3 border-t border-dashed border-rose-200" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-rose-100 to-rose-200 flex items-center justify-center overflow-hidden">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">📷</span>
                      )}
                    </div>
                    <div className="grid grid-rows-4 gap-1.5">
                      <InfoBox label="🛒 구매가이드" value={p.buy_type} hot={p.buy_type?.includes("링크")} />
                      <InfoBox label="🎀 옵션" value={p.option_text} />
                      <InfoBox label="⭐ 리뷰가이드" value={p.review_type} />
                      <InfoBox label="📦 배송형태" value={p.delivery} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-3 py-2">
                      <div className="text-xs font-bold text-amber-700 mb-0.5">💳 페이백명</div>
                      <div className="text-sm font-extrabold">{p.payback_name || "-"}</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-3 py-2">
                      <div className="text-xs font-bold text-amber-700 mb-0.5">📢 전달사항</div>
                      <div className="text-sm">{p.note || "-"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {p.product_url && (
                      <a
                        href={p.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-center bg-gradient-to-r from-rose-400 to-rose-500 text-white font-extrabold rounded-xl py-3"
                      >
                        🔗 제품링크
                      </a>
                    )}
                    <button
                      className={`bg-gradient-to-r from-violet-300 to-violet-400 text-white font-extrabold rounded-xl py-3 ${
                        !p.product_url ? "col-span-2" : ""
                      }`}
                      onClick={() => onSelect(p.short_name, p.option_text || "")}
                    >
                      📝 구매폼 작성
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${color}`}>{children}</span>;
}

function InfoBox({ label, value, hot }: { label: string; value?: string | null; hot?: boolean }) {
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 flex flex-col justify-center min-w-0">
      <div className="text-[11px] font-bold text-neutral-500">{label}</div>
      <div className={`text-sm font-extrabold truncate ${hot ? "text-rose-600" : ""}`}>{value || "-"}</div>
    </div>
  );
}
