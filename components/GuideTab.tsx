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

  return (
    <div>
      <div className="bg-rose-50 border-2 border-rose-500 rounded-xl px-3 py-2 text-xs font-bold text-rose-500 text-center leading-relaxed mb-3">
        ⚠️ 안내 외 제품 구매 금지 ⚠️
        <br />
        ⚠️ 링크구매 제품 잘못구매하시면 보상불가 ⚠️
      </div>

      {!products.length && (
        <div className="text-center text-sm text-neutral-500 py-10">😴 진행 중인 제품이 없습니다</div>
      )}

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
                      <div className="text-sm whitespace-pre-wrap break-words">{p.note || "-"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {p.buy_type === "키워드구매" ? (
                      <div className="text-center bg-violet-50 border-2 border-violet-300 text-violet-700 font-extrabold rounded-xl py-3 px-2">
                        🔍 검색 키워드
                        <div className="text-sm mt-0.5">{p.product_url || p.short_name}</div>
                      </div>
                    ) : (
                      p.product_url && (
                        <a
                          href={p.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-center bg-gradient-to-r from-rose-400 to-rose-500 text-white font-extrabold rounded-xl py-3"
                        >
                          🔗 제품링크
                        </a>
                      )
                    )}
                    <button
                      className={`bg-gradient-to-r from-violet-300 to-violet-400 text-white font-extrabold rounded-xl py-3 ${
                        !p.product_url && p.buy_type !== "키워드구매" ? "col-span-2" : ""
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

      <div className="mt-4 flex flex-col items-center gap-3">
        <div className="w-full grid grid-cols-3 gap-2">
          <a
            className="flex flex-col items-center gap-1 rounded-xl py-3 px-1"
            style={{ background: "#fbeaf0", border: "1.5px solid #ED93B1" }}
            href="https://invite.kakao.com/tc/5g1Kwz4SXa"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-base"
              style={{ background: "#ED93B1" }}
            >
              📢
            </span>
            <span className="text-xs font-extrabold text-center" style={{ color: "#993556" }}>
              도도진행방
            </span>
          </a>
          <a
            className="flex flex-col items-center gap-1 rounded-xl py-3 px-1"
            style={{ background: "#EEEDFE", border: "1.5px solid #AFA9EC" }}
            href="https://invite.kakao.com/tc/WqvjoEIJxJ"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-base"
              style={{ background: "#AFA9EC" }}
            >
              👥
            </span>
            <span className="text-xs font-extrabold text-center" style={{ color: "#534AB7" }}>
              천명모집방
            </span>
          </a>
          <a
            className="flex flex-col items-center gap-1 rounded-xl py-3 px-1"
            style={{ background: "#FAECE7", border: "1.5px solid #F0997B" }}
            href="https://open.kakao.com/o/gvPnMTfi"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-base"
              style={{ background: "#F0997B" }}
            >
              🔥
            </span>
            <span className="text-xs font-extrabold text-center" style={{ color: "#993c1d" }}>
              핫딜방
            </span>
          </a>
        </div>
        <div className="w-full overflow-hidden">
          <iframe
            src="https://coupa.ng/cndPR3"
            width="100%"
            height="44"
            style={{ border: 0, display: "block" }}
            scrolling="no"
            referrerPolicy="unsafe-url"
          />
        </div>
        <div className="text-[7px] text-neutral-300 text-center leading-relaxed px-2">
          이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
        </div>
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
