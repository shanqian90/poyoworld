"use client";

import { useEffect, useRef, useState } from "react";

type Kind = "blacklist" | "whitelist";
type Entry = { id: string; value: string; reason?: string | null; note?: string | null };

export default function NameListManager({
  onChange,
  only,
}: {
  onChange?: () => void;
  only?: Kind;
}) {
  const [blacklist, setBlacklist] = useState<Entry[]>([]);
  const [whitelist, setWhitelist] = useState<Entry[]>([]);
  const [bulkKind, setBulkKind] = useState<Kind>(only || "blacklist");
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [editing, setEditing] = useState<{ kind: Kind; id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/admin/name-list");
      const data = await res.json();
      if (data.ok) {
        setBlacklist(data.blacklist || []);
        setWhitelist(data.whitelist || []);
      }
    } catch {
      /* 무시 */
    }
  }

  async function submitEntries(text: string, kind: Kind) {
    const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) {
      setBulkMsg("추가할 이름을 입력해주세요");
      return;
    }
    const noteField = kind === "whitelist" ? "note" : "reason";
    const entries = lines.map((line) => {
      const [value, extra] = line.split("\t");
      return { value: value.trim(), [noteField]: extra ? extra.trim() : undefined };
    });
    setBulkBusy(true);
    setBulkMsg("");
    try {
      const res = await fetch("/api/admin/name-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, entries }),
      });
      const data = await res.json();
      if (!data.ok) {
        setBulkMsg(data.message || "추가 실패");
        return;
      }
      setBulkText("");
      setBulkMsg(`✅ ${lines.length}건 처리 완료 (중복은 자동으로 건너뜀)`);
      load();
      onChange?.();
    } catch {
      setBulkMsg("추가 중 오류가 발생했습니다");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkAdd() {
    await submitEntries(bulkText, bulkKind);
  }

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.key === "v" || e.key === "V") || !(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      if (!target || !containerRef.current?.contains(target)) return;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return; // 네이티브 붙여넣기 그대로 사용
      e.preventDefault();
      navigator.clipboard.readText().then((text) => submitEntries(text, only || bulkKind));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkKind, only]);

  async function saveField(kind: Kind, id: string, field: string, value: string) {
    const res = await fetch("/api/admin/name-list", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, field, value }),
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "저장 실패");
      return;
    }
    const setter = kind === "blacklist" ? setBlacklist : setWhitelist;
    setter((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    onChange?.();
  }

  async function removeEntry(kind: Kind, id: string) {
    const res = await fetch(`/api/admin/name-list?kind=${kind}&id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) {
      alert(data.message || "삭제 실패");
      return;
    }
    const setter = kind === "blacklist" ? setBlacklist : setWhitelist;
    setter((prev) => prev.filter((e) => e.id !== id));
    onChange?.();
  }

  function commitEdit() {
    if (!editing) return;
    saveField(editing.kind, editing.id, editing.field, editValue.trim());
    setEditing(null);
  }

  function renderTable(kind: Kind, allEntries: Entry[], noteField: "reason" | "note", noteLabel: string, color: string) {
    const query = q.trim().toLowerCase();
    const entries = query ? allEntries.filter((e) => e.value.toLowerCase().includes(query)) : allEntries;
    return (
      <div>
        <div className={`text-xs font-bold mb-1 ${color}`}>
          {kind === "blacklist" ? "블랙리스트" : "화이트리스트"} ({entries.length}건{query ? ` / 전체 ${allEntries.length}건` : ""})
        </div>
        <div className="border border-neutral-200 rounded-lg overflow-auto max-h-80">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-neutral-100 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-center border-r border-neutral-200">이름</th>
                <th className="px-2 py-1.5 text-center border-r border-neutral-200">{noteLabel}</th>
                <th className="px-2 py-1.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const editingValue = editing?.kind === kind && editing.id === e.id && editing.field === "value";
                const editingNote = editing?.kind === kind && editing.id === e.id && editing.field === noteField;
                return (
                  <tr key={e.id} className="border-b border-neutral-100">
                    <td
                      className="px-2 py-1 border-r border-neutral-100 cursor-text hover:bg-black/5 text-center"
                      onClick={() => {
                        if (editingValue) return;
                        setEditing({ kind, id: e.id, field: "value" });
                        setEditValue(e.value);
                      }}
                    >
                      {editingValue ? (
                        <input
                          autoFocus
                          className="w-full border border-rose-400 rounded px-1 py-0.5 text-xs outline-none text-center"
                          value={editValue}
                          onChange={(ev) => setEditValue(ev.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") commitEdit();
                            else if (ev.key === "Escape") setEditing(null);
                          }}
                        />
                      ) : (
                        e.value
                      )}
                    </td>
                    <td
                      className="px-2 py-1 border-r border-neutral-100 cursor-text hover:bg-black/5 text-neutral-500 text-center"
                      onClick={() => {
                        if (editingNote) return;
                        setEditing({ kind, id: e.id, field: noteField });
                        setEditValue(e[noteField] || "");
                      }}
                    >
                      {editingNote ? (
                        <input
                          autoFocus
                          className="w-full border border-rose-400 rounded px-1 py-0.5 text-xs outline-none text-center"
                          value={editValue}
                          onChange={(ev) => setEditValue(ev.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") commitEdit();
                            else if (ev.key === "Escape") setEditing(null);
                          }}
                        />
                      ) : (
                        e[noteField] || ""
                      )}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button className="text-neutral-400 hover:text-rose-600 font-bold" onClick={() => removeEntry(kind, e.id)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!entries.length && (
                <tr>
                  <td colSpan={3} className="text-center text-neutral-400 py-4">
                    {query ? "검색 결과가 없습니다" : "없음"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" ref={containerRef}>
      <div className="border border-neutral-300 rounded-lg p-3 bg-white">
        <div className="text-xs font-bold text-neutral-600 mb-1.5">
          📋 대량 추가 (메인 전체보기 등에서 셀을 드래그로 선택해 Ctrl+C 한 뒤, 여기 아무 곳에나 Ctrl+V 해도 됩니다)
        </div>
        <div className="flex gap-2 mb-2 items-center">
          {only ? (
            <span className="text-xs font-bold px-2 py-1.5">{only === "whitelist" ? "화이트리스트" : "블랙리스트"}</span>
          ) : (
            <select
              className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm"
              value={bulkKind}
              onChange={(e) => setBulkKind(e.target.value as Kind)}
            >
              <option value="blacklist">블랙리스트</option>
              <option value="whitelist">화이트리스트</option>
            </select>
          )}
          <span className="text-[11px] text-neutral-400">한 줄에 이름 하나씩 (탭으로 구분하면 두번째 칸은 사유/메모로 저장)</span>
        </div>
        <textarea
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[90px]"
          placeholder={"이름1\n이름2\t사유\n이름3"}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            className="text-xs bg-neutral-800 text-white rounded-lg px-3 py-1.5 font-bold disabled:opacity-60"
            onClick={bulkAdd}
            disabled={bulkBusy}
          >
            {bulkBusy ? "추가 중..." : "일괄 추가"}
          </button>
          {bulkMsg && <span className="text-xs text-neutral-600">{bulkMsg}</span>}
        </div>
      </div>

      <input
        className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm w-56"
        placeholder="이름 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className={only ? "" : "grid grid-cols-2 gap-3"}>
        {only !== "whitelist" && renderTable("blacklist", blacklist, "reason", "사유", "text-rose-600")}
        {only !== "blacklist" && renderTable("whitelist", whitelist, "note", "메모", "text-blue-600")}
      </div>
    </div>
  );
}
