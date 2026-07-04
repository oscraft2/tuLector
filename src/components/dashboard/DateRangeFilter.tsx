"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export function DateRangeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");

  useEffect(() => {
    setFrom(searchParams.get("from") ?? "");
    setTo(searchParams.get("to") ?? "");
  }, [searchParams]);

  const apply = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set("from", from); else params.delete("from");
    if (to) params.set("to", to); else params.delete("to");
    router.replace(`?${params.toString()}`);
  };

  const clear = () => {
    setFrom("");
    setTo("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    router.replace(`?${params.toString()}`);
  };

  const hasFilter = !!(searchParams.get("from") || searchParams.get("to"));

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-semibold text-[#5b6472]">
        Desde
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="mt-1 block rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-xs font-normal"
        />
      </label>
      <label className="text-xs font-semibold text-[#5b6472]">
        Hasta
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="mt-1 block rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-xs font-normal"
        />
      </label>
      <button
        onClick={apply}
        className="rounded-md bg-[#07305f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#062447]"
      >
        Aplicar
      </button>
      {hasFilter && (
        <button
          onClick={clear}
          className="rounded-md border border-[#cfd6df] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b6472] hover:bg-[#f4f6f8]"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
