"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearKakaoId, getKakaoId } from "@/lib/session";
import { Account, GuideProduct, SlotMap } from "@/lib/types";
import GuideTab from "@/components/GuideTab";
import PurchaseTab from "@/components/PurchaseTab";
import ReviewTab from "@/components/ReviewTab";
import ChangePasswordBox from "@/components/ChangePasswordBox";

type Tab = "guide" | "purchase" | "review";

export default function HomePage() {
  const router = useRouter();
  const [kakaoId, setKakaoIdState] = useState("");
  const [tab, setTab] = useState<Tab>("guide");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [guideProducts, setGuideProducts] = useState<GuideProduct[]>([]);
  const [todayMap, setTodayMap] = useState<SlotMap>({});
  const [prefill, setPrefill] = useState<{ product: string; option: string } | null>(null);

  useEffect(() => {
    const id = getKakaoId();
    if (!id) {
      router.replace("/login");
      return;
    }
    setKakaoIdState(id);
    load(id);

    function onFocus() {
      refresh(id);
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(id: string) {
    setLoading(true);
    await refresh(id);
    setLoading(false);
  }

  // 탭 내용을 언마운트하지 않는 조용한 새로고침 (제출 후 등 화면 상태를 유지해야 할 때 사용)
  async function refresh(id: string) {
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kakaoId: id }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || "불러오기 실패");
        return;
      }
      setAccounts(data.accounts || []);
      setGuideProducts(data.guideProducts || []);
      setTodayMap(data.todayMap || {});
    } catch {
      setError("불러오는 중 오류가 발생했습니다");
    }
  }

  function doLogout() {
    clearKakaoId();
    router.replace("/login");
  }

  function goToSubmitWithPrefill(product: string, option: string) {
    setPrefill({ product, option });
    setTab("purchase");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex-1 flex flex-col items-center px-3 py-4">
      <div className="w-full max-w-lg">
        <div className="bg-white border-2 border-rose-200 rounded-3xl p-4 shadow-lg shadow-rose-200/30">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-extrabold text-rose-500">🌸 포요월드</div>
            <div className="text-xs text-neutral-500">
              {kakaoId}{" "}
              <button className="underline text-rose-500 ml-1" onClick={doLogout}>
                로그아웃
              </button>
            </div>
          </div>

          <div className="mb-3">
            <ChangePasswordBox kakaoId={kakaoId} />
          </div>

          <div className="flex gap-2 mb-3">
            <div className="flex-1 bg-yellow-50 border border-yellow-400 rounded-xl px-3 py-2 text-xs font-bold text-neutral-700 flex items-center justify-center text-center">
              💡 처음이라면
              <br />
              계정등록하기 클릭
            </div>
            <Link
              href="/accounts"
              className="flex-1 rounded-xl bg-gradient-to-br from-violet-300 to-violet-400 text-white font-extrabold text-sm flex flex-col items-center justify-center gap-1 shadow"
            >
              <span className="text-xl">👤</span>계정등록
            </Link>
          </div>

          <div className="flex gap-1 mb-3 p-1 bg-rose-100 rounded-xl">
            <TabButton active={tab === "guide"} onClick={() => setTab("guide")} emoji="🌼" label="구매가이드" />
            <TabButton active={tab === "purchase"} onClick={() => setTab("purchase")} emoji="🌸" label="구매폼제출" />
            <TabButton active={tab === "review"} onClick={() => setTab("review")} emoji="⭐" label="리뷰제출" />
          </div>

          {loading && <div className="text-center text-sm text-neutral-500 py-10">불러오는 중...</div>}
          {error && (
            <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2 mb-3">
              {error}
            </div>
          )}

          {!loading && (
            <>
              <div style={{ display: tab === "guide" ? "block" : "none" }}>
                <GuideTab products={guideProducts} onSelect={goToSubmitWithPrefill} />
              </div>
              <div style={{ display: tab === "purchase" ? "block" : "none" }}>
                <PurchaseTab
                  kakaoId={kakaoId}
                  accounts={accounts}
                  todayMap={todayMap}
                  prefill={prefill}
                  onAfterSubmit={() => refresh(kakaoId)}
                />
              </div>
              <div style={{ display: tab === "review" ? "block" : "none" }}>
                <ReviewTab kakaoId={kakaoId} accounts={accounts} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  emoji,
  label,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-xs font-extrabold flex flex-col items-center gap-1 ${
        active ? "bg-gradient-to-r from-rose-400 to-rose-500 text-white shadow" : "text-rose-300"
      }`}
    >
      <span className="text-base leading-none">{emoji}</span>
      <span>{label}</span>
    </button>
  );
}
