import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import AdminGuideTable from "@/components/AdminGuideTable";
import { GuideProduct } from "@/lib/types";

export default async function AdminGuidesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  const { data, error } = await supabase
    .from("guide_products")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3">
      <AdminGuideTable rows={(data || []) as GuideProduct[]} loadError={error?.message || null} />
    </div>
  );
}
