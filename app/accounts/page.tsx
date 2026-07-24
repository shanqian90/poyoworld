"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getKakaoId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Account } from "@/lib/types";
import { formatPhoneLive, formatPhone } from "@/lib/phone";

const emptyForm = {
  store: "",
  buyer: "",
  receiver: "",
  user_id: "",
  phone: "",
  address: "",
  bank: "",
  account_no: "",
  holder: "",
};

export default function AccountsPage() {
  const router = useRouter();
  const [kakaoId, setKakaoIdState] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const id = getKakaoId();
    if (!id) {
      router.replace("/login");
      return;
    }
    setKakaoIdState(id);
    loadAccounts(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAccounts(id: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .ilike("kakao_id", id)
      .order("created_at", { ascending: true });
    if (!error) setAccounts(data || []);
    setLoading(false);
  }

  function requiredFilled(f: typeof emptyForm) {
    return Object.values(f).every((v) => String(v).trim() !== "");
  }

  async function addAccount() {
    setMsg("");
    if (!requiredFilled(form)) {
      setMsg("모든 항목을 입력해주세요");
      return;
    }
    if (!form.account_no.includes("-")) {
      setMsg("계좌번호에 하이픈(-)을 포함해주세요");
      return;
    }
    const { error } = await supabase.from("accounts").insert({
      kakao_id: kakaoId,
      ...form,
      phone: formatPhone(form.phone),
    });
    if (error) {
      setMsg("저장 실패: " + error.message);
      return;
    }
    setForm({ ...emptyForm });
    setShowAdd(false);
    setMsg("✅ 저장 완료!");
    loadAccounts(kakaoId);
  }

  function startEdit(acc: Account) {
    setEditingId(acc.id);
    setEditForm({
      store: acc.store,
      buyer: acc.buyer,
      receiver: acc.receiver,
      user_id: acc.user_id,
      phone: acc.phone,
      address: acc.address,
      bank: acc.bank,
      account_no: acc.account_no,
      holder: acc.holder,
    });
  }

  async function saveEdit(id: string) {
    if (!requiredFilled(editForm)) {
      setMsg("모든 항목을 입력해주세요");
      return;
    }
    const { error } = await supabase
      .from("accounts")
      .update({ ...editForm, phone: formatPhone(editForm.phone) })
      .eq("id", id);
    if (error) {
      setMsg("수정 실패: " + error.message);
      return;
    }
    setEditingId(null);
    setMsg("✅ 수정 완료!");
    loadAccounts(kakaoId);
  }

  async function deleteAccount(id: string, store: string) {
    if (!confirm(`${store} 계정을 삭제할까요?`)) return;
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) {
      setMsg("삭제 실패: " + error.message);
      return;
    }
    loadAccounts(kakaoId);
  }

  return (
    <div className="flex-1 flex flex-col items-center px-3 py-4">
      <div className="w-full max-w-lg">
        <div className="bg-white border-2 border-rose-200 rounded-3xl p-4 shadow-lg shadow-rose-200/30">
          <Link href="/home" className="inline-flex items-center gap-2 text-sm font-extrabold mb-3">
            <span className="w-8 h-8 rounded-lg border border-rose-200 flex items-center justify-center">←</span>
            계정 관리
          </Link>

          {msg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl px-3 py-2 mb-3">
              {msg}
            </div>
          )}

          {loading && <div className="text-center text-sm text-neutral-500 py-8">불러오는 중...</div>}

          {!loading && (
            <div className="flex flex-col gap-2 mb-3">
              {accounts.length === 0 && (
                <div className="text-center text-sm text-neutral-500 py-6">
                  저장된 계정이 없습니다
                  <br />
                  아래 버튼으로 추가해주세요 😊
                </div>
              )}
              {accounts.map((acc) =>
                editingId === acc.id ? (
                  <div key={acc.id} className="border-2 border-rose-300 rounded-xl p-3 bg-rose-50/50">
                    <div className="text-xs font-extrabold text-rose-500 mb-2">✏️ 계정 수정</div>
                    <EditFields form={editForm} setForm={setEditForm} />
                    <div className="flex gap-2 mt-2">
                      <button
                        className="flex-1 bg-gradient-to-r from-rose-400 to-rose-500 text-white font-extrabold rounded-lg py-2 text-sm"
                        onClick={() => saveEdit(acc.id)}
                      >
                        💾 저장
                      </button>
                      <button
                        className="px-4 border border-rose-200 text-rose-500 font-extrabold rounded-lg text-sm"
                        onClick={() => setEditingId(null)}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={acc.id} className="flex items-center justify-between border border-rose-200 rounded-xl px-3 py-3">
                    <div className="min-w-0">
                      <div className="font-extrabold">{acc.store}</div>
                      <div className="text-xs text-neutral-500 truncate">
                        {acc.buyer} · {acc.user_id} · {acc.phone}
                      </div>
                      <div className="text-xs text-neutral-500 truncate">
                        {acc.bank} {acc.account_no} {acc.holder}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        className="text-xs bg-blue-50 text-blue-600 font-extrabold rounded-lg px-2 py-1"
                        onClick={() => startEdit(acc)}
                      >
                        수정
                      </button>
                      <button
                        className="text-xs bg-rose-50 text-rose-600 font-extrabold rounded-lg px-2 py-1"
                        onClick={() => deleteAccount(acc.id, acc.store)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {!showAdd && (
            <button
              className="w-full border-2 border-dashed border-rose-300 text-rose-500 font-extrabold rounded-xl py-3"
              onClick={() => setShowAdd(true)}
            >
              + 새 계정 추가
            </button>
          )}

          {showAdd && (
            <div className="border-2 border-rose-300 rounded-xl p-3 bg-rose-50/50">
              <div className="text-xs font-extrabold text-rose-500 mb-2">✨ 새 계정 추가</div>
              <EditFields form={form} setForm={setForm} />
              <div className="flex gap-2 mt-2">
                <button
                  className="flex-1 bg-gradient-to-r from-rose-400 to-rose-500 text-white font-extrabold rounded-lg py-2 text-sm"
                  onClick={addAccount}
                >
                  💾 저장
                </button>
                <button
                  className="px-4 border border-rose-200 text-rose-500 font-extrabold rounded-lg text-sm"
                  onClick={() => {
                    setShowAdd(false);
                    setForm({ ...emptyForm });
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditFields({
  form,
  setForm,
}: {
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
}) {
  const fields: { key: keyof typeof emptyForm; label: string; placeholder: string }[] = [
    { key: "store", label: "스토어", placeholder: "예: 쿠팡" },
    { key: "buyer", label: "구매자", placeholder: "구매자 이름" },
    { key: "receiver", label: "수취인", placeholder: "받는 사람 이름" },
    { key: "user_id", label: "아이디", placeholder: "플랫폼 아이디" },
    { key: "phone", label: "전화번호", placeholder: "010-1234-5678" },
    { key: "address", label: "주소", placeholder: "배송지 주소" },
    { key: "bank", label: "은행", placeholder: "예: 국민은행" },
    { key: "account_no", label: "계좌번호 (하이픈 포함)", placeholder: "예: 123-456-789012" },
    { key: "holder", label: "계좌주", placeholder: "예: 홍길동" },
  ];
  return (
    <div className="flex flex-col gap-2">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-[11px] font-bold text-neutral-500 mb-0.5">{f.label}</label>
          <input
            className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm"
            placeholder={f.placeholder}
            value={form[f.key]}
            onChange={(e) => {
              const v = f.key === "phone" ? formatPhoneLive(e.target.value) : e.target.value;
              setForm({ ...form, [f.key]: v });
            }}
          />
        </div>
      ))}
    </div>
  );
}
