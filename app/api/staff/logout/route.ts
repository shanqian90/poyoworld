import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STAFF_COOKIE } from "@/lib/staffAuth";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_COOKIE);
  return NextResponse.json({ ok: true });
}
