"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearVendorLoginId, getVendorLoginId } from "@/lib/vendorSession";
import { supabase } from "@/lib/supabase";
import WorkRequestForm from "@/components/WorkRequestForm";
import RecentRequests, { WorkRequestReuse } from "@/components/RecentRequests";
import { Vendor } from "@/lib/types";

const emptyForm = { company_name: "", biz_no: "", owner_name: "", email: "" };

export default function VendorPage() {
  const router = useRouter();
  const [loginId, setLoginIdState] = useState("");
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [msg, setMsg] = useState("");
  const [reuseSignal, setReuseSignal] = useState<{ data: WorkRequestReuse; key: number } | null>(null);
  const [reuseKey, setReuseKey] = useState(0);

  useEffect(() => {
    const id = getVendorLoginId();
    if (!id) {
      router.replace("/vendor/login");
      return;
    }
    setLoginIdState(id);
    load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(id: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .ilike("login_id", id)
      .order("created_at", { ascending: true });
    if (!error) {
      setVendors(data || []);
      if (data && data.length && !selectedId) setSelectedId(data[0].id);
      if (!data || !data.length) setShowAdd(true);
    }
    setLoading(false);
  }

  async function addVendor() {
    setMsg("");
    if (!form.company_name.trim()) {
      setMsg("업체명을 입력해주세요");
      return;
    }
    const { data, error } = await supabase
      .from("vendors")
      .insert({
        login_id: loginId,
        company_name: form.company_name.trim(),
        biz_no: form.biz_no.trim() || null,
        owner_name: form.owner_name.trim() || null,
        email: form.email.trim() || null,
      })
      .select()
      .single();
    if (error) {
      setMsg("등록 실패: " + error.message);
      return;
    }
    setForm({ ...emptyForm });
    setShowAdd(false);
    setVendors((prev) => [...prev, data]);
    setSelectedId(data.id);
    setMsg("✅ 업체 등록 완료!");
  }

  function doLogout() {
    clearVendorLoginId();
    router.replace("/vendor/login");
  }

  const selected = vendors.find((v) => v.id === selectedId) || null;

  return (
    <div className="flex-1 flex flex-col items-center px-3 py-4">
      <div className="w-full max-w-lg">
        <div className="bg-white border-2 border-emerald-200 rounded-3xl p-4 shadow-lg shadow-emerald-100">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-extrabold text-emerald-700">🏢 작업요청서</div>
            <div className="text-xs text-neutral-500">
              {loginId}{" "}
              <button className="underline text-emerald-700 ml-1" onClick={doLogout}>
                로그아웃
              </button>
            </div>
          </div>

          {loading && <div className="text-center text-sm text-neutral-500 py-10">불러오는 중...</div>}

          {!loading && (
            <>
              {vendors.length > 1 && (
                <div className="mb-3">
                  <label className="block text-xs font-bold text-neutral-500 mb-1">업체 선택</label>
                  <select
                    className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm bg-white"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.company_name} {v.company_code ? `(${v.company_code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selected && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-3 mb-3">
                  <div className="font-extrabold text-emerald-800">{selected.company_name}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {selected.company_code ? `업체코드 ${selected.company_code} · ` : "업체코드 미지정 · "}
                    실배송단가 {selected.real_ship_price.toLocaleString("ko-KR")}원 · 빈박스단가{" "}
                    {selected.empty_box_price.toLocaleString("ko-KR")}원
                  </div>
                </div>
              )}

              <button
                className="text-xs text-emerald-700 underline mb-3"
                onClick={() => setShowAdd((v) => !v)}
              >
                {showAdd ? "닫기" : "+ 새 업체 등록"}
              </button>

              {showAdd && (
                <div className="border-2 border-emerald-200 rounded-xl p-3 mb-4 bg-emerald-50/40">
                  <div className="flex flex-col gap-2">
                    <input
                      className="border border-emerald-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="업체명 *"
                      value={form.company_name}
                      onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    />
                    <input
                      className="border border-emerald-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="사업자번호"
                      value={form.biz_no}
                      onChange={(e) => setForm({ ...form, biz_no: e.target.value })}
                    />
                    <input
                      className="border border-emerald-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="대표자명"
                      value={form.owner_name}
                      onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    />
                    <input
                      className="border border-emerald-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="이메일"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <button
                    className="w-full mt-2 bg-emerald-600 text-white font-extrabold rounded-lg py-2 text-sm"
                    onClick={addVendor}
                  >
                    등록
                  </button>
                </div>
              )}

              {msg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-3 py-2 mb-3">
                  {msg}
                </div>
              )}

              {selected && (
                <RecentRequests
                  vendorId={selected.id}
                  onReuse={(data) => {
                    const next = reuseKey + 1;
                    setReuseKey(next);
                    setReuseSignal({ data, key: next });
                  }}
                />
              )}

              {selected && <WorkRequestForm vendor={selected} loginId={loginId} reuseSignal={reuseSignal} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
