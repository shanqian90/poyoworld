import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { OWNER_COOKIE, isValidOwnerToken } from "@/lib/ownerAuth";
import RevenueOverview from "@/components/RevenueOverview";

export default async function AdminRevenuePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }
  const ownerToken = cookieStore.get(OWNER_COOKIE)?.value;
  if (!isValidOwnerToken(ownerToken)) {
    redirect("/admin/owner-login?next=/admin/revenue");
  }

  return <RevenueOverview />;
}
