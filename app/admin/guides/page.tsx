import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import AdminGuideTable from "@/components/AdminGuideTable";

export default async function AdminGuidesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3">
      <AdminGuideTable rows={[]} loadError={null} fetchUrl="/api/admin/guides" />
    </div>
  );
}
