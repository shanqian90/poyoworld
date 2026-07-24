"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getKakaoId } from "@/lib/session";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const id = getKakaoId();
    router.replace(id ? "/home" : "/login");
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center text-sm text-neutral-500">
      불러오는 중...
    </div>
  );
}
