import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import RequestsPanel from "@/components/RequestsPanel";

export default async function AdminRequestsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3">
      <RequestsPanel rows={[]} loadError={null} fetchUrl="/api/admin/requests" />
    </div>
  );
}
