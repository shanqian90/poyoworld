import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { OWNER_COOKIE, isValidOwnerToken } from "@/lib/ownerAuth";
import StaffManager from "@/components/StaffManager";

export default async function AdminStaffPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }
  const ownerToken = cookieStore.get(OWNER_COOKIE)?.value;
  if (!isValidOwnerToken(ownerToken)) {
    redirect("/admin/owner-login?next=/admin/staff");
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3">
      <StaffManager />
    </div>
  );
}
