"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/auth");
  };

  return (
    <button onClick={signOut} className={className ?? "text-xs font-semibold text-white/60 active:text-white"}>
      Salir
    </button>
  );
}
