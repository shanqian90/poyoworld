import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { OWNER_COOKIE, isValidOwnerToken } from "@/lib/ownerAuth";
import AttendanceOverview from "@/components/AttendanceOverview";

export default async function AdminAttendancePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }
  const ownerToken = cookieStore.get(OWNER_COOKIE)?.value;
  if (!isValidOwnerToken(ownerToken)) {
    redirect("/admin/owner-login?next=/admin/attendance");
  }

  return (
    <div className="flex-1 flex flex-col p-3">
      <AttendanceOverview />
    </div>
  );
}
