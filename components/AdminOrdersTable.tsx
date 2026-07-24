"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type AdminOrderRow = {
  id: number;
  seq: string | null;
  date_mmdd: string;
  company_code: string | null;
  company_name: string | null;
  platform: string | null;
  product_name: string;
  option_text: string;
  review_type: string | null;
  order_no: string | null;
  buyer: string | null;
  receiver: string | null;
  user_id: string | null;
  phone: string | null;
  address: string | null;
  account_text: string | null;
  amount: number | null;
  review_fee: number;
  review_done: boolean;
  paid: boolean;
  paid_date: string | null;
  delivery: string | null;
  tracking: string | null;
  remark: string | null;
  order_image: string | null;
  review_url: string | null;
  _group: "a" | "b" | null;
};

type Field = keyof AdminOrderRow;

function fmt(n: number | null) {
  return (n || 0).toLocaleString("ko-KR");
}

const LINK_FIELDS = new Set<Field>(["order_image", "review_url"]);

const COLUMNS: { key: Field; label: string; align?: "right"; width?: string }[] = [
  { key: "seq", label: "순번" },
  { key: "date_mmdd", label: "날짜" },
  { key: "company_code", label: "업체코드" },
  { key: "company_name", label: "업체명" },
  { key: "platform", label: "플랫폼" },
  { key: "product_name", label: "제품명" },
  { key: "option_text", label: "옵션" },
  { key: "review_type", label: "리뷰종류" },
  { key: "order_no", label: "주문번호" },
  { key: "buyer", label: "구매자" },
  { key: "receiver", label: "수취인" },
  { key: "user_id", label: "아이디" },
  { key: "phone", label: "전화번호" },
  { key: "address", label: "주소", width: "max-w-[220px]" },
  { key: "account_text", label: "계좌", width: "max-w-[200px]" },
  { key: "amount", label: "금액", align: "right" },
  { key: "review_fee", label: "리뷰금액", align: "right" },
  { key: "order_image", label: "구매이미지" },
  { key: "paid_date", label: "입금일" },
  { key: "delivery", label: "택배대행" },
  { key: "tracking", label: "운송장번호" },
  { key: "review_url", label: "리뷰URL" },
  { key: "remark", label: "비고", width: "max-w-[160px]" },
];

export default function AdminOrdersTable({
  rows: initialRows,
  loadError,
}: {
  rows: AdminOrderRow[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: number; field: Field } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => {
      const hay = [r.company_name, r.product_name, r.order_no, r.buyer, r.receiver, r.phone, r.address, r.tracking]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [rows, q]);

  async function saveField(id: number, field: Field, value: string | number | boolean | null) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "저장 실패");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    } catch {
      alert("저장 중 오류가 발생했습니다");
    } finally {
      setSavingId(null);
    }
  }

  function startEdit(row: AdminOrderRow, field: Field) {
    setEditing({ id: row.id, field });
    const v = row[field];
    setEditValue(v == null ? "" : String(v));
  }

  function commitEdit() {
    if (!editing) return;
    const field = editing.field;
    const raw = editValue.trim();
    const value = raw === "" ? null : field === "amount" || field === "review_fee" ? Number(raw) : raw;
    saveField(editing.id, field, value);
    setEditing(null);
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function toggleBool(row: AdminOrderRow, field: "paid" | "review_done") {
    await saveField(row.id, field, !row[field]);
  }

  async function doLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const [adding, setAdding] = useState(false);

  async function addRow() {
    setAdding(true);
    try {
      const res = await fetch("/api/admin/orders", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "추가 실패");
        return;
      }
      setRows((prev) => [...prev, { ...data.row, _group: null }]);
    } catch {
      alert("추가 중 오류가 발생했습니다");
    } finally {
      setAdding(false);
    }
  }

  async function deleteRow(id: number) {
    if (!confirm("이 행을 삭제할까요?")) return;
    const res = await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "삭제 실패");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <div className="text-lg font-extrabold text-neutral-700">📋 메인 전체보기</div>
        <span className="text-xs text-neutral-500">{filtered.length.toLocaleString("ko-KR")}건</span>
        <span className="text-xs text-neutral-400">셀을 클릭하면 바로 수정할 수 있어요</span>
        <Link href="/admin/requests" className="text-xs font-bold text-emerald-700 underline">
          📝 작업요청서 →
        </Link>
        <Link href="/admin/tools" className="text-xs font-bold text-emerald-700 underline">
          🧰 관리도구 →
        </Link>
        <div className="flex-1" />
        <input
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm w-64"
          placeholder="업체명·제품명·주문번호·구매자·수취인·전화번호·운송장 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="text-xs bg-neutral-800 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-60"
          onClick={addRow}
          disabled={adding}
        >
          {adding ? "추가 중..." : "+ 새 행 추가"}
        </button>
        <button className="text-xs border border-neutral-300 rounded-lg px-3 py-1.5 font-bold text-neutral-600" onClick={doLogout}>
          로그아웃
        </button>
      </div>

      {loadError && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">
          {loadError}
        </div>
      )}

      <div className="border border-neutral-300 rounded-xl overflow-auto flex-1">
        <table className="w-full text-xs border-collapse min-w-[1700px]">
          <thead className="sticky top-0 bg-neutral-800 text-white z-10">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">리뷰작성</th>
              <th className="px-2 py-2 text-center whitespace-nowrap border-r border-neutral-700">입금</th>
              <th className="px-2 py-2 text-center whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-neutral-200">
                {COLUMNS.map((c) => {
                  const isEditing = editing?.id === r.id && editing.field === c.key;
                  const val = r[c.key];
                  const groupBg = c.key === "seq" ? (r._group === "a" ? "#FFF1A6" : r._group === "b" ? "#FAD2E1" : undefined) : undefined;
                  const isLink = LINK_FIELDS.has(c.key);
                  const urls = isLink
                    ? String(val || "")
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : [];
                  return (
                    <td
                      key={c.key}
                      className={`px-2 py-1.5 border-r border-neutral-200 whitespace-nowrap text-center cursor-text hover:bg-black/5 ${c.width || ""}`}
                      style={{ backgroundColor: groupBg }}
                      onClick={() => !isEditing && startEdit(r, c.key)}
                      title={typeof val === "string" ? val : undefined}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          className="w-full min-w-[80px] border border-rose-400 rounded px-1 py-0.5 text-xs outline-none text-center"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : isLink ? (
                        urls.length ? (
                          <span className="inline-flex gap-1">
                            {urls.map((u, i) => (
                              <a
                                key={i}
                                href={u}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                보기{urls.length > 1 ? i + 1 : ""}
                              </a>
                            ))}
                          </span>
                        ) : (
                          ""
                        )
                      ) : c.align === "right" ? (
                        fmt(val as number)
                      ) : (
                        (val as string) ?? ""
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 border-r border-neutral-200">
                  <button
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${r.review_done ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}
                    onClick={() => toggleBool(r, "review_done")}
                    disabled={savingId === r.id}
                  >
                    {r.review_done ? "완료" : "미완료"}
                  </button>
                </td>
                <td className="px-2 py-1.5 border-r border-neutral-200">
                  <button
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${r.paid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                    onClick={() => toggleBool(r, "paid")}
                    disabled={savingId === r.id}
                  >
                    {r.paid ? "완료" : "대기"}
                  </button>
                </td>
                <td className="px-2 py-1.5">
                  <button
                    className="text-neutral-400 hover:text-rose-600 font-bold px-1"
                    onClick={() => deleteRow(r.id)}
                    title="행 삭제"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
