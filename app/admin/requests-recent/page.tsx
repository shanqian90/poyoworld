import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import RequestsPanel, { WorkRequestRow } from "@/components/RequestsPanel";

export default async function AdminRequestsRecentPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 20);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("work_requests")
    .select("*")
    .gte("start_date", cutoffStr)
    .order("id", { ascending: true })
    .limit(500);

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3">
      <RequestsPanel rows={(data || []) as WorkRequestRow[]} loadError={error?.message || null} title="진행요청서 (최근 20일)" />
    </div>
  );
}
