"use client";

import { useEffect, useState } from "react";
import { Account, OrderRow } from "@/lib/types";
import { compressImage } from "@/lib/image";

type RowState = { files: File[]; uploading: boolean; expanded: boolean };

export default function ReviewTab({ kakaoId, accounts }: { kakaoId: string; accounts: Account[] }) {
  const [subTab, setSubTab] = useState<"submit" | "pay">("submit");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [todoList, setTodoList] = useState<OrderRow[]>([]);
  const [paidList, setPaidList] = useState<OrderRow[]>([]);
  const [rowState, setRowState] = useState<Record<number, RowState>>({});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  async function load() {
    const phones = accounts.map((a) => a.phone).filter(Boolean);
    if (!phones.length) {
      setMsg("계정 정보가 없습니다. 계정등록에서 먼저 추가해주세요");
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/review/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "목록을 불러오지 못했습니다");
        return;
      }
      setTodoList(data.todoList || []);
      setPaidList(data.paidList || []);
      if (!data.todoList.length && !data.paidList.length) setMsg("현재 제출할 리뷰가 없습니다");
    } catch {
      setMsg("목록을 불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  function getState(id: number): RowState {
    return rowState[id] || { files: [], uploading: false, expanded: false };
  }
  function setState(id: number, patch: Partial<RowState>) {
    setRowState((prev) => ({ ...prev, [id]: { ...getState(id), ...patch } }));
  }

  async function uploadRow(row: OrderRow) {
    const st = getState(row.id);
    if (!st.files.length) return;
    setState(row.id, { uploading: true });
    try {
      const images: string[] = [];
      for (const f of st.files) images.push(await compressImage(f));
      const res = await fetch("/api/review/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowId: row.id, images }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "업로드 실패");
        setState(row.id, { uploading: false });
        return;
      }
      setTodoList((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, review_done: true } : r))
      );
      setState(row.id, { uploading: false, files: [], expanded: false });
      setMsg("업로드 완료");
    } catch {
      setMsg("업로드 중 오류가 발생했습니다");
      setState(row.id, { uploading: false });
    }
  }

  async function cancelRow(row: OrderRow) {
    try {
      const res = await fetch("/api/review/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowId: row.id }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "취소 실패");
        return;
      }
      setTodoList((prev) => prev.map((r) => (r.id === row.id ? { ...r, review_done: false } : r)));
      setMsg("제출이 취소되었습니다");
    } catch {
      setMsg("취소 중 오류가 발생했습니다");
    }
  }

  const notDone = todoList.filter((r) => !r.review_done);
  const reviewDone = todoList.filter((r) => r.review_done);
  const waitAmt = todoList.reduce((s, r) => s + (r.amount || 0) + (r.review_fee || 0), 0);
  const paidAmt = paidList.reduce((s, r) => s + (r.amount || 0) + (r.review_fee || 0), 0);

  return (
    <div>
      <div className="flex gap-1 mb-3 p-1 bg-rose-100 rounded-xl">
        <button
          className={`flex-1 rounded-lg py-2 text-xs font-extrabold ${
            subTab === "submit" ? "bg-gradient-to-r from-rose-400 to-rose-500 text-white" : "text-rose-400"
          }`}
          onClick={() => setSubTab("submit")}
        >
          📝 리뷰 제출
        </button>
        <button
          className={`flex-1 rounded-lg py-2 text-xs font-extrabold ${
            subTab === "pay" ? "bg-gradient-to-r from-rose-400 to-rose-500 text-white" : "text-rose-400"
          }`}
          onClick={() => setSubTab("pay")}
        >
          💰 입금 확인
        </button>
      </div>

      {loading && <div className="text-center text-sm text-neutral-500 py-8">불러오는 중...</div>}
      {!loading && msg && (
        <div className="text-center text-sm text-neutral-500 py-4 whitespace-pre-line">{msg}</div>
      )}

      {!loading && subTab === "submit" && (
        <div>
          {notDone.length > 0 && (
            <div className="flex justify-center gap-4 text-sm font-bold mb-3">
              <span className="text-rose-600">📝 미완료 {notDone.length}건</span>
              <span className="text-neutral-300">·</span>
              <span className="text-green-700">✅ 완료 {reviewDone.length}건</span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {notDone.map((row) => {
              const st = getState(row.id);
              return (
                <div key={row.id} className="border border-rose-200 rounded-xl p-3">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setState(row.id, { expanded: !st.expanded })}>
                    <div className="min-w-0">
                      <div className="text-xs text-neutral-500">{row.platform} · {row.date_mmdd}</div>
                      <div className="font-extrabold text-rose-600 truncate">{row.product_name}</div>
                      <div className="text-xs text-neutral-500">{row.receiver} · {row.option_text}</div>
                    </div>
                    <span className="text-[11px] font-bold bg-rose-100 text-rose-600 px-2 py-1 rounded-full shrink-0">미완료</span>
                  </div>
                  {st.expanded && (
                    <div className="mt-2 pt-2 border-t border-dashed border-rose-200" onClick={(e) => e.stopPropagation()}>
                      <div className="text-xs text-neutral-500 mb-2">
                        {(row.amount || 0).toLocaleString("ko-KR")} + {(row.review_fee || 0).toLocaleString("ko-KR")} ={" "}
                        <b>{((row.amount || 0) + (row.review_fee || 0)).toLocaleString("ko-KR")}원</b>
                      </div>
                      <label className="block border-2 border-dashed border-rose-300 rounded-lg px-3 py-3 text-center text-xs font-bold text-rose-500 cursor-pointer bg-rose-50 mb-2">
                        📎 리뷰 사진 첨부
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => setState(row.id, { files: Array.from(e.target.files || []) })}
                        />
                      </label>
                      {st.files.length > 0 && (
                        <div className="text-xs text-green-700 font-bold mb-2">선택한 이미지 {st.files.length}장 준비됨</div>
                      )}
                      <button
                        className="w-full bg-gradient-to-r from-violet-300 to-violet-400 text-white font-extrabold rounded-lg py-2.5 disabled:opacity-60"
                        onClick={() => uploadRow(row)}
                        disabled={st.uploading || !st.files.length}
                      >
                        {st.uploading ? "업로드중..." : "리뷰 제출하기"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {reviewDone.length > 0 && (
            <details className="mt-3 border border-green-200 bg-green-50 rounded-xl overflow-hidden">
              <summary className="px-3 py-2.5 text-sm font-extrabold text-green-800 cursor-pointer">
                ✅ 완료 {reviewDone.length}건 펼치기
              </summary>
              <div className="px-3 pb-3 flex flex-col gap-2">
                {reviewDone.map((row) => (
                  <div key={row.id} className="bg-white border border-green-200 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-xs text-neutral-500">{row.platform} · {row.date_mmdd}</div>
                        <div className="font-extrabold truncate">{row.product_name}</div>
                      </div>
                      <button
                        className="text-xs border border-rose-200 text-rose-500 font-bold rounded-lg px-2 py-1 shrink-0"
                        onClick={() => cancelRow(row)}
                      >
                        제출취소
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {!loading && subTab === "pay" && (
        <div>
          <div className="grid grid-cols-3 gap-2 mb-3 bg-white border border-rose-200 rounded-xl p-3 text-center">
            <div>
              <div className="text-xs text-neutral-500">입금대기</div>
              <div className="text-lg font-extrabold">{todoList.length}건</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">대기금액</div>
              <div className="text-lg font-extrabold">{waitAmt.toLocaleString("ko-KR")}원</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">입금완료</div>
              <div className="text-lg font-extrabold text-green-700">{paidList.length}건</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {todoList.map((row) => (
              <PayCard key={row.id} row={row} paid={false} />
            ))}
            {paidList.map((row) => (
              <PayCard key={row.id} row={row} paid={true} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PayCard({ row, paid }: { row: OrderRow; paid: boolean }) {
  return (
    <div className="border border-rose-200 rounded-xl p-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-bold bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">{row.platform}</span>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            paid ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-600"
          }`}
        >
          {paid ? "완료" : "대기중"}
        </span>
      </div>
      <div className="font-extrabold text-rose-600">{row.product_name}</div>
      <div className="flex justify-between items-baseline mt-1">
        <span className="text-sm font-bold">{((row.amount || 0) + (row.review_fee || 0)).toLocaleString("ko-KR")}원</span>
        <span className="text-xs text-neutral-500">
          {paid ? `✓ ${row.paid_date || ""} 입금` : "리뷰제출 후 3일 이내 입금예정"}
        </span>
      </div>
    </div>
  );
}
