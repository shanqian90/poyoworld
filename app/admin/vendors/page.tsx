import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import AdminVendorsTable from "@/components/AdminVendorsTable";
import { Vendor } from "@/lib/types";

export default async function AdminVendorsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  const PAGE_SIZE = 1000;
  let all: Vendor[] = [];
  let loadError: string | null = null;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("company_name", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      loadError = error.message;
      break;
    }
    all = all.concat((data || []) as Vendor[]);
    if (!data || data.length < PAGE_SIZE) break;
  }

  return (
    <div className="flex-1 flex flex-col p-3">
      <AdminVendorsTable rows={all} loadError={loadError} />
    </div>
  );
}
