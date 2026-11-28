"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPresetRange(preset: "7d" | "30d" | "year"): { from: string; to: string } {
  const today = new Date();
  const to = formatLocalDate(today);
  if (preset === "year") {
    return { from: `${today.getFullYear()}-01-01`, to };
  }
  const start = new Date(today);
  start.setDate(start.getDate() - (preset === "7d" ? 6 : 29));
  return { from: formatLocalDate(start), to };
}

export function DateRangeFilter() {
  const searchParams = useSearchParams();
  const urlFrom = searchParams.get("from") ?? "";
  const urlTo = searchParams.get("to") ?? "";

  return <DateRangeFilterInner key={`${urlFrom}|${urlTo}`} urlFrom={urlFrom} urlTo={urlTo} />;
}

function DateRangeFilterInner({ urlFrom, urlTo }: { urlFrom: string; urlTo: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(urlFrom);
  const [to, setTo] = useState(urlTo);
  const [showCustom, setShowCustom] = useState(Boolean(urlFrom || urlTo));

  const navigateWith = (nextFrom: string, nextTo: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFrom) params.set("from", nextFrom);
    else params.delete("from");
    if (nextTo) params.set("to", nextTo);
    else params.delete("to");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `?${qs}` : "?");
    });
  };

  const applyPreset = (preset: "7d" | "30d" | "year") => {
    const range = getPresetRange(preset);
    setFrom(range.from);
    setTo(range.to);
    navigateWith(range.from, range.to);
  };

  const isPresetActive = (preset: "7d" | "30d" | "year") => {
    if (!urlFrom || !urlTo) return false;
    const range = getPresetRange(preset);
    return urlFrom === range.from && urlTo === range.to;
  };

  const hasFilter = Boolean(urlFrom || urlTo);

  const chipClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold transition ${
      active ? "bg-[#07305f] text-white" : "bg-[#efede8] text-[#57534e] hover:bg-[#e7e5df]"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#78716c]">Período</span>
      <button type="button" onClick={() => navigateWith("", "")} className={chipClass(!hasFilter)}>
        Todo
      </button>
      <button type="button" onClick={() => applyPreset("7d")} className={chipClass(isPresetActive("7d"))}>
        7 días
      </button>
      <button type="button" onClick={() => applyPreset("30d")} className={chipClass(isPresetActive("30d"))}>
        30 días
      </button>
      <button type="button" onClick={() => applyPreset("year")} className={chipClass(isPresetActive("year"))}>
        Este año
      </button>
      <button
        type="button"
        onClick={() => setShowCustom((v) => !v)}
        aria-expanded={showCustom}
        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
          showCustom || hasFilter
            ? "border-[#07305f]/40 bg-white text-[#07305f]"
            : "border-[#d6d3cb] bg-white text-[#57534e] hover:bg-[#faf9f6]"
        }`}
      >
        Fechas
      </button>

      {isPending && <span className="text-xs font-medium text-[#78716c]">Actualizando…</span>}

      {showCustom && (
        <div className="flex w-full flex-wrap items-end gap-2 pt-1 sm:w-auto sm:pt-0">
          <label className="text-xs font-semibold text-[#57534e]">
            <span className="sr-only">Desde</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="block rounded-lg border border-[#d6d3cb] bg-white px-2.5 py-1 text-xs font-normal text-[#1c1917]"
              aria-label="Fecha desde"
            />
          </label>
          <span className="text-xs text-[#78716c]" aria-hidden="true">→</span>
          <label className="text-xs font-semibold text-[#57534e]">
            <span className="sr-only">Hasta</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="block rounded-lg border border-[#d6d3cb] bg-white px-2.5 py-1 text-xs font-normal text-[#1c1917]"
              aria-label="Fecha hasta"
            />
          </label>
          <button
            type="button"
            onClick={() => navigateWith(from, to)}
            disabled={isPending}
            className="rounded-lg bg-[#07305f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#062447] disabled:opacity-60"
          >
            Aplicar
          </button>
          {hasFilter && (
            <button
              type="button"
              onClick={() => navigateWith("", "")}
              disabled={isPending}
              className="rounded-lg border border-[#d6d3cb] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#57534e] hover:bg-[#f7f6f2]"
            >
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
