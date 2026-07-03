"use client";

import { useEffect, useState } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";

export function ActionFeedbackDialog({ state }: { state: DashboardActionState }) {
  const [dismissedKey, setDismissedKey] = useState<number | undefined>();

  useEffect(() => {
    if (state.status === "idle") return;
    const timer = window.setTimeout(() => setDismissedKey(state.key), state.status === "success" ? 3600 : 5200);
    return () => window.clearTimeout(timer);
  }, [state.key, state.status]);

  if (state.status === "idle" || dismissedKey === state.key) return null;

  const success = state.status === "success";

  return (
    <div className="fixed inset-x-4 bottom-5 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end">
      <div className={success ? "w-full max-w-sm overflow-hidden rounded-md border border-[#cfe6d8] bg-white shadow-[0_20px_55px_rgba(15,23,42,0.18)]" : "w-full max-w-sm overflow-hidden rounded-md border border-[#fecaca] bg-white shadow-[0_20px_55px_rgba(15,23,42,0.18)]"}>
        <div className={success ? "h-1.5 bg-[#21764b]" : "h-1.5 bg-[#b42318]"} />
        <div className="flex gap-4 p-4">
          <div className={success ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e4f6ec] text-xl font-black text-[#14532d]" : "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fee2e2] text-xl font-black text-[#991b1b]"}>
            {state.emoji ?? (success ? "✓" : "!")}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-bold text-[#111827]">{state.title}</p>
            {state.message ? <p className="mt-1 text-sm leading-5 text-[#4b5563]">{state.message}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setDismissedKey(state.key)}
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg leading-none text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827]"
            aria-label="Cerrar mensaje"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}