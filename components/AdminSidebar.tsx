"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type DataKey = "orders" | "work_requests" | "vendors" | "notices" | "accounts" | "blacklist" | "whitelist";
type NavItem = { href: string; label: string; dataKey?: DataKey };
type NavGroup = { label: string; items: NavItem[] };

const TOP_LINK: NavItem = { href: "/admin/dashboard", label: "📊 진행상황대시보드" };

const GROUPS: NavGroup[] = [
  {
    label: "🏢 업체관리",
    items: [
      { href: "/admin/vendors", label: "업체목록", dataKey: "vendors" },
      { href: "/admin/requests", label: "전체보기", dataKey: "work_requests" },
      { href: "/admin/requests-recent", label: "진행요청서 (최근20일)" },
      { href: "/admin/estimate", label: "견적서 발행" },
      { href: "/admin/vendor-settlement", label: "업체정산" },
    ],
  },
  {
    label: "📋 진행관리",
    items: [
      { href: "/admin", label: "전체보기", dataKey: "orders" },
      { href: "/admin/active", label: "💗 체험단진행" },
      { href: "/admin/guides", label: "구매가이드" },
      { href: "/admin/notices", label: "중요사항", dataKey: "notices" },
      { href: "/admin/settlement", label: "정산관리" },
      { href: "/admin/delivery", label: "배송관리" },
      { href: "/admin/review-missing", label: "리뷰미제출" },
      { href: "/admin/expelled", label: "퇴출명단" },
    ],
  },
  {
    label: "👤 계정관리",
    items: [
      { href: "/admin/accounts", label: "계정목록", dataKey: "accounts" },
      { href: "/admin/blacklist", label: "블랙리스트", dataKey: "blacklist" },
      { href: "/admin/whitelist", label: "화이트리스트", dataKey: "whitelist" },
    ],
  },
  {
    label: "🌐 사이트",
    items: [
      { href: "/admin/vendor-site", label: "업체사이트" },
      { href: "/admin/submit-site", label: "제출사이트" },
    ],
  },
  {
    label: "👔 직원전용",
    items: [{ href: "/admin/staff-site", label: "직원사이트" }],
  },
  {
    label: "🔐 관리자",
    items: [
      { href: "/admin/revenue", label: "현황관리" },
      { href: "/admin/attendance", label: "관리자조회" },
      { href: "/admin/staff", label: "직원관리" },
    ],
  },
];

const COLLAPSE_KEY = "poyo_admin_sidebar_collapsed";
const SEEN_KEY = "poyo_admin_sidebar_seen";
const GROUPS_KEY = "poyo_admin_sidebar_groups";
const CUSTOM_KEY = "poyo_admin_sidebar_custom";
const POLL_MS = 30000;

type Customization = {
  groupLabels: Record<string, string>;
  itemLabels: Record<string, string>;
  groupOrder: string[];
  itemOrder: Record<string, string[]>;
};

function emptyCustomization(): Customization {
  return { groupLabels: {}, itemLabels: {}, groupOrder: GROUPS.map((g) => g.label), itemOrder: {} };
}

function applyCustomization(custom: Customization) {
  const orderedGroups = custom.groupOrder
    .map((label) => GROUPS.find((g) => g.label === label))
    .filter((g): g is NavGroup => !!g);
  GROUPS.forEach((g) => {
    if (!orderedGroups.includes(g)) orderedGroups.push(g);
  });
  return orderedGroups.map((g) => {
    const order = custom.itemOrder[g.label];
    let items = g.items;
    if (order) {
      const ordered = order.map((href) => g.items.find((it) => it.href === href)).filter((it): it is NavItem => !!it);
      g.items.forEach((it) => {
        if (!ordered.includes(it)) ordered.push(it);
      });
      items = ordered;
    }
    return {
      label: custom.groupLabels[g.label] || g.label,
      originalLabel: g.label,
      items: items.map((it) => ({ ...it, label: custom.itemLabels[it.href] || it.label })),
    };
  });
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [latest, setLatest] = useState<Partial<Record<DataKey, string>>>({});
  const [seen, setSeen] = useState<Partial<Record<DataKey, string>>>({});
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [custom, setCustom] = useState<Customization>(emptyCustomization());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ group: string; href: string } | null>(null);
  const seenRef = useRef(seen);
  seenRef.current = seen;
  const latestRef = useRef(latest);
  latestRef.current = latest;

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
      setSeen(JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"));
      const savedGroups = JSON.parse(localStorage.getItem(GROUPS_KEY) || "{}");
      const initial: Record<string, boolean> = {};
      GROUPS.forEach((g) => {
        initial[g.label] = g.label in savedGroups ? savedGroups[g.label] : true;
      });
      setGroupOpen(initial);
      const savedCustom = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "null");
      if (savedCustom) {
        setCustom({
          groupLabels: savedCustom.groupLabels || {},
          itemLabels: savedCustom.itemLabels || {},
          groupOrder: savedCustom.groupOrder || GROUPS.map((g) => g.label),
          itemOrder: savedCustom.itemOrder || {},
        });
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  function toggleGroup(label: string) {
    setGroupOpen((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function saveCustom(next: Customization) {
    setCustom(next);
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function renameGroup(originalLabel: string, newLabel: string) {
    saveCustom({ ...custom, groupLabels: { ...custom.groupLabels, [originalLabel]: newLabel } });
  }
  function renameItem(href: string, newLabel: string) {
    saveCustom({ ...custom, itemLabels: { ...custom.itemLabels, [href]: newLabel } });
  }
  function moveGroupTo(sourceLabel: string, targetLabel: string) {
    if (sourceLabel === targetLabel) return;
    const order = custom.groupOrder.length ? [...custom.groupOrder] : GROUPS.map((g) => g.label);
    const from = order.indexOf(sourceLabel);
    if (from === -1) return;
    order.splice(from, 1);
    const to = order.indexOf(targetLabel);
    if (to === -1) return;
    order.splice(to, 0, sourceLabel);
    saveCustom({ ...custom, groupOrder: order });
  }
  function moveItemTo(groupLabel: string, sourceHref: string, targetHref: string) {
    if (sourceHref === targetHref) return;
    const group = GROUPS.find((g) => g.label === groupLabel);
    if (!group) return;
    const order = custom.itemOrder[groupLabel] ? [...custom.itemOrder[groupLabel]] : group.items.map((it) => it.href);
    const from = order.indexOf(sourceHref);
    if (from === -1) return;
    order.splice(from, 1);
    const to = order.indexOf(targetHref);
    if (to === -1) return;
    order.splice(to, 0, sourceHref);
    saveCustom({ ...custom, itemOrder: { ...custom.itemOrder, [groupLabel]: order } });
  }
  function clickGroupHandle(originalLabel: string) {
    if (selectedGroup === null) {
      setSelectedGroup(originalLabel);
    } else if (selectedGroup === originalLabel) {
      setSelectedGroup(null);
    } else {
      moveGroupTo(selectedGroup, originalLabel);
      setSelectedGroup(null);
    }
  }
  function clickItemHandle(groupLabel: string, href: string) {
    if (!selectedItem) {
      setSelectedItem({ group: groupLabel, href });
    } else if (selectedItem.group !== groupLabel) {
      setSelectedItem({ group: groupLabel, href });
    } else if (selectedItem.href === href) {
      setSelectedItem(null);
    } else {
      moveItemTo(groupLabel, selectedItem.href, href);
      setSelectedItem(null);
    }
  }
  function resetCustom() {
    if (!confirm("사이드바 제목/순서를 기본값으로 초기화할까요?")) return;
    saveCustom(emptyCustomization());
  }

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/admin/sidebar-status");
        const data = await res.json();
        if (cancelled || !data.ok) return;
        const nextLatest: Partial<Record<DataKey, string>> = data.latest || {};
        setLatest(nextLatest);

        // 처음 보는 항목은 지금 시점까지를 "이미 확인함"으로 간주해서 과거 데이터로 점이 뜨지 않게 함
        setSeen((prev) => {
          let changed = false;
          const next = { ...prev };
          (Object.keys(nextLatest) as DataKey[]).forEach((key) => {
            if (!(key in next) && nextLatest[key]) {
              next[key] = nextLatest[key];
              changed = true;
            }
          });
          if (changed) {
            try {
              localStorage.setItem(SEEN_KEY, JSON.stringify(next));
            } catch {
              /* ignore */
            }
          }
          return changed ? next : prev;
        });
      } catch {
        /* ignore */
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hydrated]);

  // 현재 페이지에 해당하는 항목은 "방문 시점"에만 확인 처리한다.
  // (페이지에 머무는 동안 poll()로 latest가 갱신될 때마다 다시 실행되면,
  //  이 페이지를 보고 있는 사이에 새 데이터가 들어와도 즉시 seen 처리되어 점이 뜰 기회가 없어진다)
  useEffect(() => {
    if (!hydrated) return;
    const allItems = [TOP_LINK, ...GROUPS.flatMap((g) => g.items)];
    const current = allItems.find((item) => isActive(item.href));
    if (!current?.dataKey) return;
    const key = current.dataKey;
    const latestValue = latestRef.current[key];
    if (!latestValue) return;
    if (seenRef.current[key] === latestValue) return;
    const next = { ...seenRef.current, [key]: latestValue };
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hydrated]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function hasNew(item: NavItem) {
    if (!item.dataKey) return false;
    const latestValue = latest[item.dataKey];
    if (!latestValue) return false;
    const seenValue = seen[item.dataKey];
    if (!seenValue) return false;
    return new Date(latestValue).getTime() > new Date(seenValue).getTime();
  }

  const displayGroups = applyCustomization(custom);

  if (!hydrated) {
    return <div className="w-56 shrink-0 border-r border-neutral-200 bg-white" />;
  }

  return (
    <div
      className={`shrink-0 border-r border-neutral-200 bg-white flex flex-col h-screen sticky top-0 transition-all ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-neutral-100">
        {!collapsed && <div className="text-sm font-extrabold text-neutral-700 truncate">🌸 포요월드 관리자</div>}
        <div className="flex items-center gap-1 shrink-0">
          {!collapsed && (
            <button
              className="text-neutral-400 hover:text-neutral-700 text-sm"
              onClick={() => setSettingsOpen(true)}
              title="사이드바 설정 (제목/순서 변경)"
            >
              ⚙️
            </button>
          )}
          <button
            className="text-neutral-400 hover:text-neutral-700 text-lg"
            onClick={toggle}
            title={collapsed ? "펼치기" : "접기"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <Link
          href={TOP_LINK.href}
          className={`block mx-2 mb-2 px-3 py-2 rounded-lg text-sm font-bold ${
            isActive(TOP_LINK.href) ? "bg-emerald-600 text-white" : "text-neutral-700 hover:bg-neutral-100"
          }`}
        >
          {collapsed ? "📊" : TOP_LINK.label}
        </Link>

        {displayGroups.map((group) => {
          const open = collapsed || groupOpen[group.originalLabel] !== false;
          return (
            <div key={group.originalLabel} className="mb-3">
              {!collapsed && (
                <button
                  className="w-full flex items-center gap-1 px-3 py-1 text-[11px] font-extrabold text-neutral-400 uppercase tracking-wide hover:text-neutral-600"
                  onClick={() => toggleGroup(group.originalLabel)}
                >
                  <span className="flex-1 text-left">{group.label}</span>
                  <span className="text-[10px] shrink-0">{open ? "▾" : "▸"}</span>
                </button>
              )}
              {collapsed && <div className="mx-2 my-1 border-t border-neutral-100" />}
              {open && (
                <div className="flex flex-col gap-0.5 px-2">
                  {group.items.map((item) => {
                    const dot = hasNew(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold truncate ${
                          isActive(item.href)
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "text-neutral-600 hover:bg-neutral-100"
                        }`}
                      >
                        {dot && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                        <span className="truncate">{collapsed ? item.label.slice(0, 2) : item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {settingsOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setSettingsOpen(false);
            setSelectedGroup(null);
            setSelectedItem(null);
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 sticky top-0 bg-white">
              <div className="text-sm font-extrabold text-neutral-700">⚙️ 사이드바 설정</div>
              <button
                className="text-neutral-400 hover:text-neutral-700 text-lg"
                onClick={() => {
                  setSettingsOpen(false);
                  setSelectedGroup(null);
                  setSelectedItem(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className="px-4 pt-3 text-[11px] text-neutral-400 leading-relaxed">
              ⇅ 버튼을 눌러 옮길 항목을 선택한 뒤, 옮기고 싶은 위치의 ⇅ 버튼을 누르면 그 자리로 이동합니다.
            </div>
            <div className="p-4 flex flex-col gap-4">
              {displayGroups.map((group) => (
                <div
                  key={group.originalLabel}
                  className={`border rounded-xl p-3 ${
                    selectedGroup === group.originalLabel ? "border-emerald-400 ring-2 ring-emerald-200" : "border-neutral-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <input
                      className="flex-1 border border-neutral-300 rounded-lg px-2 py-1 text-xs font-bold"
                      value={group.label}
                      onChange={(e) => renameGroup(group.originalLabel, e.target.value)}
                    />
                    <button
                      className={`text-xs rounded px-1.5 py-1 border ${
                        selectedGroup === group.originalLabel
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "text-neutral-500 border-neutral-300"
                      }`}
                      onClick={() => clickGroupHandle(group.originalLabel)}
                      title={selectedGroup === group.originalLabel ? "선택 취소" : "이 위치로 이동/선택"}
                    >
                      ⇅
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 pl-2">
                    {group.items.map((item) => (
                      <div
                        key={item.href}
                        className={`flex items-center gap-1.5 rounded-lg ${
                          selectedItem?.group === group.originalLabel && selectedItem.href === item.href
                            ? "ring-2 ring-emerald-200"
                            : ""
                        }`}
                      >
                        <input
                          className="flex-1 border border-neutral-200 rounded-lg px-2 py-1 text-xs"
                          value={item.label}
                          onChange={(e) => renameItem(item.href, e.target.value)}
                        />
                        <button
                          className={`text-xs rounded px-1.5 py-0.5 border ${
                            selectedItem?.group === group.originalLabel && selectedItem.href === item.href
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "text-neutral-400 border-neutral-200"
                          }`}
                          onClick={() => clickItemHandle(group.originalLabel, item.href)}
                          title={
                            selectedItem?.group === group.originalLabel && selectedItem.href === item.href
                              ? "선택 취소"
                              : "이 위치로 이동/선택"
                          }
                        >
                          ⇅
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button
                className="text-xs font-bold text-rose-600 border border-rose-300 rounded-lg px-3 py-2 self-start"
                onClick={resetCustom}
              >
                기본값으로 초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
