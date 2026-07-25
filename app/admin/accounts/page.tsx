import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import AdminAccountsTable from "@/components/AdminAccountsTable";

export default async function AdminAccountsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3">
      <AdminAccountsTable rows={[]} loadError={null} fetchUrl="/api/admin/accounts" />
    </div>
  );
}
