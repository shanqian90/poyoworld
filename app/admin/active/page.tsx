import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import AdminOrdersTable from "@/components/AdminOrdersTable";

export default async function AdminActivePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3">
      <AdminOrdersTable
        rows={[]}
        loadError={null}
        mode="active"
        title="🧪 체험단진행 (최근 30일)"
        fetchUrl="/api/admin/orders/active"
      />
    </div>
  );
}
