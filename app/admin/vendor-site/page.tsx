import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import EmbeddedSitePanel from "@/components/EmbeddedSitePanel";

export default async function AdminVendorSitePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3">
      <EmbeddedSitePanel emoji="🏢" title="업체사이트" path="/vendor/login" iframeTitle="업체 로그인/작업요청서 웹앱" />
    </div>
  );
}
