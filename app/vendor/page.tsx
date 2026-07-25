"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearVendorLoginId, getVendorLoginId } from "@/lib/vendorSession";
import { supabase } from "@/lib/supabaseClient";
import WorkRequestForm from "@/components/WorkRequestForm";
import RecentRequests, { WorkRequestReuse } from "@/components/RecentRequests";
import VendorProgressTab from "@/components/VendorProgressTab";
import VendorSettlementTab from "@/components/VendorSettlementTab";
import ChangePasswordBox from "@/components/ChangePasswordBox";
import { Vendor } from "@/lib/types";
import { codeNameSegment } from "@/lib/textSafe";

const emptyForm = { company_name: "", biz_no: "", owner_name: "", email: "" };

type TabKey = "request" | "progress" | "settlement";
const NAV_ITEMS: { key: TabKey; label: string; icon: string }[] = [
  { key: "request", label: "작업요청서", icon: "📝" },
  { key: "progress", label: "진행상황", icon: "📊" },
  { key: "settlement", label: "정산관리", icon: "💰" },
];

export default function VendorPage() {
  const router = useRouter();
  const [loginId, setLoginIdState] = useState("");
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [bizFile, setBizFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [reuseSignal, setReuseSignal] = useState<{ data: WorkRequestReuse; key: number } | null>(null);
  const [reuseKey, setReuseKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("request");

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
    const bizNo = form.biz_no.trim();
    let row: Vendor | null = null;

    // 사업자번호가 같은, 아직 로그인 연결이 안 된 관리자 등록 업체가 있으면 그 업체로 연결(claim)
    if (bizNo) {
      const { data: existing } = await supabase
        .from("vendors")
        .select("*")
        .eq("biz_no", bizNo)
        .or("login_id.is.null,login_id.eq.")
        .limit(1)
        .maybeSingle();
      if (existing) {
        const { data: updated, error: claimErr } = await supabase
          .from("vendors")
          .update({
            login_id: loginId,
            owner_name: existing.owner_name || form.owner_name.trim() || null,
            email: existing.email || form.email.trim() || null,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (claimErr) {
          setMsg("등록 실패: " + claimErr.message);
          return;
        }
        row = updated;
      }
    }

    if (!row) {
      const { data, error } = await supabase
        .from("vendors")
        .insert({
          login_id: loginId,
          company_name: form.company_name.trim(),
          biz_no: bizNo || null,
          owner_name: form.owner_name.trim() || null,
          email: form.email.trim() || null,
        })
        .select()
        .single();
      if (error) {
        setMsg("등록 실패: " + error.message);
        return;
      }
      row = data;
    }

    if (bizFile && row) {
      const ext = bizFile.name.split(".").pop() || "jpg";
      const companySegment = codeNameSegment(row.company_code, row.company_name);
      const path = `${companySegment}_bizreg_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("vendor-files")
        .upload(path, bizFile, { contentType: bizFile.type, upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("vendor-files").getPublicUrl(path);
        const { data: updated } = await supabase
          .from("vendors")
          .update({ biz_file_url: urlData.publicUrl })
          .eq("id", row.id)
          .select()
          .single();
        if (updated) row = updated;
      }
    }

    if (!row) return;
    const finalRow = row;
    setForm({ ...emptyForm });
    setBizFile(null);
    setShowAdd(false);
    setVendors((prev) => {
      const exists = prev.some((v) => v.id === finalRow.id);
      return exists ? prev.map((v) => (v.id === finalRow.id ? finalRow : v)) : [...prev, finalRow];
    });
    setSelectedId(finalRow.id);
    setMsg("✅ 업체 등록 완료!");
  }

  function doLogout() {
    clearVendorLoginId();
    router.replace("/vendor/login");
  }

  const selected = vendors.find((v) => v.id === selectedId) || null;

  const vendorPicker = vendors.length > 1 && (
    <select
      className="w-full border border-emerald-800 rounded-xl px-3 py-2 text-sm bg-white"
      value={selectedId}
      onChange={(e) => setSelectedId(e.target.value)}
    >
      {vendors.map((v) => (
        <option key={v.id} value={v.id}>
          {v.company_name} {v.company_code ? `(${v.company_code})` : ""}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex-1 flex justify-center px-3 py-4">
      <div className="w-full max-w-5xl flex flex-col md:flex-row gap-4">
        {/* 데스크탑 사이드바 */}
        <aside className="hidden md:flex md:flex-col w-60 shrink-0 gap-3">
          <div className="bg-white border-2 border-emerald-800 rounded-2xl p-4">
            {selected ? (
              <>
                <div className="text-[11px] text-neutral-400 font-bold">
                  {selected.company_code ? `업체코드 ${selected.company_code}` : "업체코드 미지정"}
                </div>
                <div className="text-base font-extrabold text-emerald-950 mt-0.5 break-words">{selected.company_name}</div>
              </>
            ) : (
              <div className="text-sm text-neutral-400">업체 미등록</div>
            )}
            {vendors.length > 1 && <div className="mt-2">{vendorPicker}</div>}
            <div className="text-[11px] text-neutral-400 mt-3 pt-3 border-t border-neutral-100">
              {loginId}
              <button className="underline text-emerald-900 ml-1.5" onClick={doLogout}>
                로그아웃
              </button>
            </div>
          </div>

          <nav className="bg-white border-2 border-emerald-800 rounded-2xl p-2 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                className={`text-left text-sm font-bold rounded-xl px-3 py-2.5 ${
                  activeTab === item.key ? "bg-emerald-900 text-white" : "text-emerald-900 hover:bg-emerald-800/5"
                }`}
                onClick={() => setActiveTab(item.key)}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* 본문 */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border-2 border-emerald-800 rounded-3xl p-4 shadow-lg shadow-emerald-800/10">
            {/* 모바일 헤더 (사이드바 대체) */}
            <div className="md:hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="text-lg font-extrabold text-emerald-900">🏢 업체 사이트</div>
                <div className="text-xs text-neutral-500">
                  {loginId}{" "}
                  <button className="underline text-emerald-900 ml-1" onClick={doLogout}>
                    로그아웃
                  </button>
                </div>
              </div>

              {!loading && (
                <>
                  {vendors.length > 1 && (
                    <div className="mb-3">
                      <label className="block text-xs font-bold text-neutral-500 mb-1">업체 선택</label>
                      {vendorPicker}
                    </div>
                  )}

                  {selected && (
                    <div className="bg-emerald-800/5 border border-emerald-800 rounded-xl px-3 py-3 mb-3">
                      <div className="font-extrabold text-emerald-950">{selected.company_name}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {selected.company_code ? `업체코드 ${selected.company_code} · ` : "업체코드 미지정 · "}
                        실배송단가 {selected.real_ship_price.toLocaleString("ko-KR")}원 · 빈박스단가{" "}
                        {selected.empty_box_price.toLocaleString("ko-KR")}원
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {NAV_ITEMS.map((item) => (
                      <button
                        key={item.key}
                        className={`text-xs font-bold rounded-xl py-2.5 border ${
                          activeTab === item.key
                            ? "bg-emerald-900 text-white border-emerald-900"
                            : "bg-white border-emerald-800 text-emerald-900"
                        }`}
                        onClick={() => setActiveTab(item.key)}
                      >
                        {item.icon} {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 데스크탑 전용 타이틀 + 업체 요약 */}
            <div className="hidden md:block">
              <div className="text-lg font-extrabold text-emerald-900 mb-3">
                {NAV_ITEMS.find((n) => n.key === activeTab)?.icon} {NAV_ITEMS.find((n) => n.key === activeTab)?.label}
              </div>
              {selected && activeTab === "request" && (
                <div className="bg-emerald-800/5 border border-emerald-800 rounded-xl px-3 py-3 mb-3">
                  <div className="text-xs text-neutral-500">
                    실배송단가 {selected.real_ship_price.toLocaleString("ko-KR")}원 · 빈박스단가{" "}
                    {selected.empty_box_price.toLocaleString("ko-KR")}원
                  </div>
                </div>
              )}
            </div>

            {loading && <div className="text-center text-sm text-neutral-500 py-10">불러오는 중...</div>}

            {!loading && (
              <>
                <div className="mb-3">
                  <ChangePasswordBox kakaoId={loginId} />
                </div>

                {activeTab === "request" && (
                  <>
                    <button className="text-xs text-emerald-900 underline mb-3" onClick={() => setShowAdd((v) => !v)}>
                      {showAdd ? "닫기" : "+ 새 업체 등록"}
                    </button>

                    {showAdd && (
                      <div className="border-2 border-emerald-800 rounded-xl p-3 mb-4 bg-emerald-800/5">
                        <div className="flex flex-col gap-2">
                          <input
                            className="border border-emerald-800 rounded-lg px-3 py-2 text-sm"
                            placeholder="업체명 *"
                            value={form.company_name}
                            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                          />
                          <input
                            className="border border-emerald-800 rounded-lg px-3 py-2 text-sm"
                            placeholder="사업자번호"
                            value={form.biz_no}
                            onChange={(e) => setForm({ ...form, biz_no: e.target.value })}
                          />
                          <input
                            className="border border-emerald-800 rounded-lg px-3 py-2 text-sm"
                            placeholder="대표자명"
                            value={form.owner_name}
                            onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                          />
                          <input
                            className="border border-emerald-800 rounded-lg px-3 py-2 text-sm"
                            placeholder="이메일"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                          />
                          <label className="text-xs text-neutral-500">
                            사업자등록증 (선택)
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="block w-full text-xs mt-1"
                              onChange={(e) => setBizFile(e.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                        <button
                          className="w-full mt-2 bg-emerald-900 text-white font-extrabold rounded-lg py-2 text-sm"
                          onClick={addVendor}
                        >
                          등록
                        </button>
                      </div>
                    )}

                    {msg && (
                      <div className="bg-emerald-800/5 border border-emerald-800 text-emerald-950 text-sm rounded-xl px-3 py-2 mb-3">
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

                {activeTab === "progress" && selected && (
                  <VendorProgressTab companyCode={selected.company_code} companyName={selected.company_name} />
                )}

                {activeTab === "settlement" && <VendorSettlementTab loginId={loginId} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
