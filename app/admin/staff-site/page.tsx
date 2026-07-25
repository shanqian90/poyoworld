import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import EmbeddedSitePanel from "@/components/EmbeddedSitePanel";

export default async function AdminStaffSitePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3">
      <EmbeddedSitePanel emoji="👔" title="직원사이트" path="/staff/login" iframeTitle="직원 로그인/출퇴근인증 웹앱" />
    </div>
  );
}
