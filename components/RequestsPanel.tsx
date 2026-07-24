"use client";

import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";

export type WorkRequestRow = {
  id: number;
  start_date: string;
  receipt_no: string;
  company_code: string | null;
  company_name: string;
  biz_no: string | null;
  owner_name: string | null;
  phone: string | null;
  login_id: string | null;
  issue_date: string | null;
  deposit_amount: number | null;
  deposit_date: string | null;
  image_url: string | null;
  weekend_work: boolean;
  unit_price: number;
  product_url: string | null;
  product_option: string | null;
  product_price: number | null;
  keyword: string;
  total_count: number;
  daily_plan: string | null;
  review_type: string | null;
  real_shipping: boolean;
  payment_agency: boolean;
  delivery_agency: boolean;
  tax_bill: boolean;
  biz_file_url: string | null;
  status: string;
  main_created: boolean;
  memo: string | null;
};

type Field = keyof WorkRequestRow;
type Kind = "text" | "bool";

const LINK_FIELDS = new Set<Field>(["image_url", "biz_file_url"]);
const BOOL_FIELDS = new Set<Field>(["weekend_work", "real_shipping", "payment_agency", "delivery_agency", "tax_bill", "main_created"]);

const COLUMNS: { key: Field; label: string; align?: "right"; kind?: Kind; defaultWidth: number }[] = [
  { key: "start_date", label: "시작일", defaultWidth: 90 },
  { key: "receipt_no", label: "접수번호", defaultWidth: 130 },
  { key: "company_code", label: "업체코드", defaultWidth: 80 },
  { key: "company_name", label: "업체명", defaultWidth: 110 },
  { key: "biz_no", label: "사업자번호", defaultWidth: 100 },
  { key: "owner_name", label: "대표자명", defaultWidth: 80 },
  { key: "phone", label: "전화번호", defaultWidth: 110 },
  { key: "login_id", label: "이메일", defaultWidth: 130 },
  { key: "issue_date", label: "발행일", defaultWidth: 90 },
  { key: "deposit_amount", label: "입금금액", align: "right", defaultWidth: 90 },
  { key: "deposit_date", label: "입금일", defaultWidth: 90 },
  { key: "image_url", label: "이미지", defaultWidth: 70 },
  { key: "weekend_work", label: "주말진행", kind: "bool", defaultWidth: 80 },
  { key: "unit_price", label: "계약단가", align: "right", defaultWidth: 80 },
  { key: "product_url", label: "진행제품URL", defaultWidth: 90 },
  { key: "product_option", label: "제품옵션", defaultWidth: 100 },
  { key: "product_price", label: "제품판매가", align: "right", defaultWidth: 90 },
  { key: "keyword", label: "검색키워드", defaultWidth: 120 },
  { key: "total_count", label: "총진행건수", align: "right", defaultWidth: 80 },
  { key: "daily_plan", label: "일진행건수", defaultWidth: 90 },
  { key: "review_type", label: "리뷰종류", defaultWidth: 110 },
  { key: "real_shipping", label: "제품실제배송여부", kind: "bool", defaultWidth: 90 },
  { key: "payment_agency", label: "입금대행", kind: "bool", defaultWidth: 80 },
  { key: "delivery_agency", label: "택배대행", kind: "bool", defaultWidth: 80 },
  { key: "tax_bill", label: "세금계산서", kind: "bool", defaultWidth: 80 },
  { key: "biz_file_url", label: "사업자등록증", defaultWidth: 90 },
  { key: "status", label: "진행상태", defaultWidth: 90 },
  { key: "main_created", label: "생성", kind: "bool", defaultWidth: 70 },
  { key: "memo", label: "업체요구사항", defaultWidth: 140 },
];

export default function RequestsPanel({
  rows,
  loadError,
}: {
  rows: WorkRequestRow[];
  loadError: string | null;
}) {
  const [items, setItems] = useState(rows);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [resetId, setResetId] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetting, setResetting] = useState(false);
  const [q, setQ] = useState("");
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]))
  );
  const [editing, setEditing] = useState<{ id: number; field: Field } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  async function saveField(id: number, field: Field, value: string | number | boolean | null) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "저장 실패");
        return;
      }
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    } catch {
      alert("저장 중 오류가 발생했습니다");
    } finally {
      setSavingId(null);
    }
  }

  function startEdit(row: WorkRequestRow, field: Field) {
    setEditing({ id: row.id, field });
    const v = row[field];
    setEditValue(v == null ? "" : String(v));
  }

  function commitEdit() {
    if (!editing) return;
    const field = editing.field;
    const raw = editValue.trim();
    const isNumberField = field === "unit_price" || field === "product_price" || field === "total_count" || field === "deposit_amount";
    const value = raw === "" ? null : isNumberField ? Number(raw) : raw;
    saveField(editing.id, field, value);
    setEditing(null);
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function toggleBool(row: WorkRequestRow, field: Field) {
    await saveField(row.id, field, !row[field]);
  }

  function moveEdit(delta: number) {
    if (!editing) return;
    commitEdit();
    const idx = filtered.findIndex((r) => r.id === editing.id);
    const next = filtered[idx + delta];
    if (next) startEdit(next, editing.field);
  }

  function startResize(e: ReactMouseEvent, key: Field) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widths[key] ?? 100;
    function onMove(ev: MouseEvent) {
      const next = Math.max(36, startWidth + (ev.clientX - startX));
      setWidths((prev) => ({ ...prev, [key]: next }));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((r) =>
      [r.company_name, r.company_code, r.receipt_no, r.keyword].join(" ").toLowerCase().includes(query)
    );
  }, [items, q]);

  async function resetPassword() {
    const id = resetId.trim();
    if (!id) {
      setResetMsg("아이디를 입력해주세요");
      return;
    }
    if (!confirm(`${id} 계정의 비밀번호를 초기화할까요?\n다음 로그인 시 입력하는 비밀번호가 새로 등록됩니다.`)) return;
    setResetting(true);
    setResetMsg("");
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: id }),
      });
      const data = await res.json();
      setResetMsg(data.ok ? `✅ ${id} 비밀번호가 초기화되었습니다` : `❌ ${data.message || "초기화 실패"}`);
      if (data.ok) setResetId("");
    } catch {
      setResetMsg("❌ 초기화 중 오류가 발생했습니다");
    } finally {
      setResetting(false);
    }
  }

  const pendingCount = items.filter((r) => r.status === "접수" && !r.main_created).length;

  async function generate() {
    setGenerating(true);
    setResult("");
    try {
      const res = await fetch("/api/admin/generate-main", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setResult("❌ " + (data.message || "생성 실패"));
        return;
      }
      setResult(
        `✅ 요청 ${data.requestCount}건 처리 → 메인시트 슬롯 ${data.orderRows}건 생성, 구매가이드 ${data.guideRows}건 생성`
      );
      setItems((prev) =>
        prev.map((r) => (r.status === "접수" && !r.main_created ? { ...r, status: "진행중", main_created: true } : r))
      );
    } catch {
      setResult("❌ 생성 중 오류가 발생했습니다");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">📝 작업요청서 목록</div>
        <span className="text-xs text-neutral-500">{filtered.length.toLocaleString("ko-KR")}건</span>
        <div className="flex-1" />
        <input
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm w-56"
          placeholder="업체명·업체코드·접수번호·키워드 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="bg-emerald-600 text-white text-sm font-extrabold rounded-lg px-4 py-2 disabled:opacity-60"
          onClick={generate}
          disabled={generating || pendingCount === 0}
        >
          {generating ? "생성 중..." : `메인시트 생성 (대기 ${pendingCount}건)`}
        </button>
      </div>

      <div className="border border-neutral-300 rounded-xl px-3 py-2 flex items-center gap-2 bg-neutral-50">
        <span className="text-xs font-bold text-neutral-500 shrink-0">🔗 업체 웹앱 링크</span>
        <span className="text-xs text-neutral-400 flex-1 truncate">
          {typeof window !== "undefined" ? `${window.location.origin}/vendor/login` : "/vendor/login"}
        </span>
        <button
          className="text-xs bg-neutral-700 text-white font-bold rounded-lg px-3 py-1.5 shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/vendor/login`);
            setResetMsg("✅ 링크가 복사되었습니다");
          }}
        >
          복사
        </button>
      </div>

      <div className="border border-neutral-300 rounded-xl px-3 py-2 flex items-center gap-2 bg-neutral-50">
        <span className="text-xs font-bold text-neutral-500 shrink-0">🔑 비밀번호 초기화</span>
        <input
          className="border border-neutral-300 rounded-lg px-2 py-1 text-sm flex-1"
          placeholder="아이디 (전화번호/카카오톡아이디)"
          value={resetId}
          onChange={(e) => setResetId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && resetPassword()}
        />
        <button
          className="text-xs bg-neutral-700 text-white font-bold rounded-lg px-3 py-1.5 disabled:opacity-60 shrink-0"
          onClick={resetPassword}
          disabled={resetting}
        >
          {resetting ? "처리 중..." : "초기화"}
        </button>
        {resetMsg && <span className="text-xs shrink-0">{resetMsg}</span>}
      </div>

      {loadError && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">{loadError}</div>
      )}
      {result && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm rounded-xl px-3 py-2 whitespace-pre-line">
          {result}
        </div>
      )}

      <div className="border border-neutral-300 rounded-xl overflow-auto flex-1">
        <table className="text-xs border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 bg-neutral-800 text-white z-10">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="relative px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700 overflow-hidden"
                >
                  {c.label}
                  <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-rose-400/70"
                    onMouseDown={(e) => startResize(e, c.key)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-neutral-200">
                {COLUMNS.map((c) => {
                  const val = r[c.key];
                  if (c.kind === "bool" || BOOL_FIELDS.has(c.key)) {
                    const on = !!val;
                    return (
                      <td key={c.key} className="px-2 py-1.5 border-r border-neutral-200 text-center overflow-hidden">
                        <button
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            on ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                          }`}
                          onClick={() => toggleBool(r, c.key)}
                          disabled={savingId === r.id}
                        >
                          {c.key === "main_created" ? (on ? "생성완료" : "아니오") : on ? "예" : "아니오"}
                        </button>
                      </td>
                    );
                  }
                  const isLink = LINK_FIELDS.has(c.key);
                  const isEditing = editing?.id === r.id && editing.field === c.key;
                  return (
                    <td
                      key={c.key}
                      className="px-2 py-1.5 border-r border-neutral-200 whitespace-nowrap text-center overflow-hidden text-ellipsis cursor-text hover:bg-black/5"
                      title={typeof val === "string" ? val : undefined}
                      onClick={() => !isEditing && !isLink && startEdit(r, c.key)}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          className="w-full min-w-[36px] border border-rose-400 rounded px-1 py-0.5 text-xs outline-none text-center"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            else if (e.key === "Escape") cancelEdit();
                            else if (e.key === "ArrowDown") {
                              e.preventDefault();
                              moveEdit(1);
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              moveEdit(-1);
                            }
                          }}
                        />
                      ) : c.key === "status" ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            r.main_created ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {String(val ?? "")}
                        </span>
                      ) : isLink && val ? (
                        <a href={String(val)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                          보기
                        </a>
                      ) : c.align === "right" ? (
                        val != null ? Number(val).toLocaleString("ko-KR") : ""
                      ) : (
                        (val as string) ?? ""
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center text-neutral-400 py-8">
                  제출된 작업요청서가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
