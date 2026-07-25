"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type StaffRow = {
  id: string;
  name: string;
  login_id: string;
  has_password: boolean;
  account_text: string | null;
  hourly_wage: number;
  withhold_tax: boolean;
  is_fixed_salary: boolean;
  active: boolean;
  created_at: string;
};

const emptyForm = {
  id: "",
  name: "",
  loginId: "",
  accountText: "",
  hourlyWage: "",
  withholdTax: false,
  active: true,
  isFixedSalary: false,
};

export default function StaffManager() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/admin/staff");
      const data = await res.json();
      if (!data.ok) {
        setLoadError(data.message || "불러오기 실패");
        return;
      }
      setRows(data.rows || []);
    } catch {
      setLoadError("불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(r?: StaffRow) {
    setForm(
      r
        ? {
            id: r.id,
            name: r.name,
            loginId: r.login_id,
            accountText: r.account_text || "",
            hourlyWage: String(r.hourly_wage || ""),
            withholdTax: r.withhold_tax,
            active: r.active,
            isFixedSalary: r.is_fixed_salary,
          }
        : { ...emptyForm }
    );
    setShowForm(true);
    setMsg("");
  }

  async function save() {
    if (!form.name.trim() || !form.loginId.trim()) {
      setMsg("이름과 아이디를 입력해주세요");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id || null,
          name: form.name.trim(),
          loginId: form.loginId.trim(),
          accountText: form.accountText.trim(),
          hourlyWage: Number(form.hourlyWage) || 0,
          withholdTax: form.withholdTax,
          active: form.active,
          isFixedSalary: form.isFixedSalary,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.message || "저장 실패");
        return;
      }
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(id: string, name: string) {
    if (!confirm(`${name}님의 비밀번호를 초기화할까요? (다음 로그인 시 새로 등록됩니다)`)) return;
    const res = await fetch("/api/admin/staff/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "초기화 실패");
      return;
    }
    load();
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm font-bold text-neutral-500 underline">
          ← 메인 전체보기
        </Link>
        <div className="text-lg font-extrabold text-neutral-700 ml-2">🧑‍💼 직원관리</div>
        <span className="text-xs text-neutral-500">{rows.length.toLocaleString("ko-KR")}명</span>
        <div className="flex-1" />
        <button className="text-sm bg-neutral-800 text-white font-bold rounded-lg px-4 py-2" onClick={() => startEdit()}>
          {showForm && !form.id ? "닫기" : "+ 직원 추가"}
        </button>
      </div>

      {showForm && (
        <div className="border-2 border-neutral-300 rounded-xl p-3 bg-white flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <input
              className="border border-neutral-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[120px]"
              placeholder="이름"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="border border-neutral-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[120px]"
              placeholder="로그인 아이디"
              value={form.loginId}
              onChange={(e) => setForm({ ...form, loginId: e.target.value })}
            />
            <input
              className="border border-neutral-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
              placeholder="계좌번호"
              value={form.accountText}
              onChange={(e) => setForm({ ...form, accountText: e.target.value })}
            />
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex bg-neutral-100 rounded-lg p-0.5">
              <button
                type="button"
                className={`text-xs font-bold rounded-md px-3 py-1.5 ${
                  !form.isFixedSalary ? "bg-white text-neutral-800 shadow" : "text-neutral-500"
                }`}
                onClick={() => setForm({ ...form, isFixedSalary: false })}
              >
                시급제
              </button>
              <button
                type="button"
                className={`text-xs font-bold rounded-md px-3 py-1.5 ${
                  form.isFixedSalary ? "bg-white text-neutral-800 shadow" : "text-neutral-500"
                }`}
                onClick={() => setForm({ ...form, isFixedSalary: true })}
              >
                고정월급제
              </button>
            </div>
            <input
              type="number"
              className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-36"
              placeholder={form.isFixedSalary ? "월급(원)" : "시급(원)"}
              value={form.hourlyWage}
              onChange={(e) => setForm({ ...form, hourlyWage: e.target.value })}
            />
            <label className="text-xs font-bold text-neutral-500 flex items-center gap-1">
              <input
                type="checkbox"
                checked={form.withholdTax}
                onChange={(e) => setForm({ ...form, withholdTax: e.target.checked })}
              />
              3.3% 공제
            </label>
            <label className="text-xs font-bold text-neutral-500 flex items-center gap-1">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              재직중
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="bg-emerald-600 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-60"
              onClick={save}
              disabled={saving}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button className="text-xs font-bold text-neutral-500 underline" onClick={() => setShowForm(false)}>
              취소
            </button>
            {msg && <span className="text-xs text-rose-600">{msg}</span>}
          </div>
        </div>
      )}

      {loading && <div className="text-center text-sm text-neutral-400 py-10">불러오는 중...</div>}
      {loadError && (
        <div className="bg-rose-100 border border-rose-300 text-rose-700 text-sm rounded-xl px-3 py-2">{loadError}</div>
      )}

      {!loading && !loadError && (
        <div className="border border-neutral-300 rounded-xl overflow-auto flex-1">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-neutral-800 text-white sticky top-0">
              <tr>
                <th className="px-2 py-2 text-center">이름</th>
                <th className="px-2 py-2 text-center">아이디</th>
                <th className="px-2 py-2 text-center">비밀번호</th>
                <th className="px-2 py-2 text-center">계좌</th>
                <th className="px-2 py-2 text-center">급여방식</th>
                <th className="px-2 py-2 text-center">금액</th>
                <th className="px-2 py-2 text-center">3.3%공제</th>
                <th className="px-2 py-2 text-center">재직상태</th>
                <th className="px-2 py-2 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-neutral-200">
                  <td className="px-2 py-1.5 text-center font-bold">{r.name}</td>
                  <td className="px-2 py-1.5 text-center">{r.login_id}</td>
                  <td className="px-2 py-1.5 text-center">{r.has_password ? "설정됨" : "미설정"}</td>
                  <td className="px-2 py-1.5 text-center">{r.account_text || "-"}</td>
                  <td className="px-2 py-1.5 text-center">{r.is_fixed_salary ? "고정월급제" : "시급제"}</td>
                  <td className="px-2 py-1.5 text-center">
                    {r.hourly_wage.toLocaleString("ko-KR")}원{r.is_fixed_salary ? "/월" : "/시간"}
                  </td>
                  <td className="px-2 py-1.5 text-center">{r.withhold_tax ? "Y" : "N"}</td>
                  <td className="px-2 py-1.5 text-center">{r.active ? "재직중" : "퇴사"}</td>
                  <td className="px-2 py-1.5 text-center">
                    <button className="text-xs font-bold text-neutral-500 underline mr-2" onClick={() => startEdit(r)}>
                      수정
                    </button>
                    <button className="text-xs font-bold text-rose-500 underline" onClick={() => resetPassword(r.id, r.name)}>
                      비번초기화
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={9} className="text-center text-neutral-400 py-8">
                    등록된 직원이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
