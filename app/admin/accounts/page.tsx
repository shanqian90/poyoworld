import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import AdminAccountsTable from "@/components/AdminAccountsTable";
import { Account } from "@/lib/types";

export default async function AdminAccountsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    redirect("/admin/login");
  }

  const PAGE_SIZE = 1000;
  let all: Account[] = [];
  let loadError: string | null = null;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("kakao_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      loadError = error.message;
      break;
    }
    all = all.concat((data || []) as Account[]);
    if (!data || data.length < PAGE_SIZE) break;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3">
      <AdminAccountsTable rows={all} loadError={loadError} />
    </div>
  );
}
