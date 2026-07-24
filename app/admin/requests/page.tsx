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

  const { data, error } = await supabase
    .from("work_requests")
    .select("*")
    .order("id", { ascending: false })
    .limit(500);

  return (
    <div className="flex-1 flex flex-col p-3">
      <RequestsPanel rows={(data || []) as WorkRequestRow[]} loadError={error?.message || null} />
    </div>
  );
}
