"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export function PortalHeader({ email }: { email: string }) {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/portal/auth");
  }

  return (
    <header className="border-b border-[#e5e7eb] bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111827] text-xs font-black text-white">TL</div>
          <span className="text-sm font-bold text-[#111827]">Portal de apoderados</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-[#6b7280] sm:inline">{email}</span>
          <button onClick={signOut} className="text-xs font-semibold text-[#6b7280] hover:text-[#111827]">Salir</button>
        </div>
      </div>
    </header>
  );
}
