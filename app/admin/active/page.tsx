import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import AdminOrdersTable, { AdminOrderRow } from "@/components/AdminOrdersTable";

function isGroupStart(seq: string | null): boolean {
  if (!seq) return false;
  const m = String(seq).trim().match(/-\s*(\d+)\s*$/);
  return !!(m && Number(m[1]) === 1);
}

export default async function AdminActivePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const PAGE_SIZE = 1000;
  let all: AdminOrderRow[] = [];
  let loadError: string | null = null;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("hidden_from_active", false)
      .gte("created_at", cutoff.toISOString())
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      loadError = error.message;
      break;
    }
    all = all.concat((data || []) as AdminOrderRow[]);
    if (!data || data.length < PAGE_SIZE) break;
  }

  const rows = all;

  let groupIdx = -1;
  const colored = rows.map((r) => {
    if (isGroupStart(r.seq)) groupIdx++;
    const color: "a" | "b" | null = groupIdx < 0 ? null : groupIdx % 2 === 0 ? "a" : "b";
    return { ...r, _group: color };
  });

  return (
    <div className="flex-1 flex flex-col p-3">
      <AdminOrdersTable rows={colored} loadError={loadError} mode="active" title="🧪 체험단진행 (최근 30일)" />
    </div>
  );
}
