import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import EmbeddedSitePanel from "@/components/EmbeddedSitePanel";

export default async function AdminSubmitSitePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  return (
    <div className="flex-1 flex flex-col p-3">
      <EmbeddedSitePanel emoji="📝" title="제출사이트" path="/login" iframeTitle="구매제출/리뷰제출 웹앱" />
    </div>
  );
}
