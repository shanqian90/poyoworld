import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import RequestsPanel, { WorkRequestRow } from "@/components/RequestsPanel";

export default async function AdminRequestsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  const rows: WorkRequestRow[] = [];
  let loadError: string | null = null;
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("work_requests")
      .select("*")
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      loadError = error.message;
      break;
    }
    rows.push(...((data || []) as WorkRequestRow[]));
    if (!data || data.length < pageSize) break;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3">
      <RequestsPanel rows={rows} loadError={loadError} />
    </div>
  );
}
