"use client";

import { useState } from "react";
import type { ItemStat } from "@/lib/item_analysis";

const LVL = {
  good: { text: "text-[#1a8f52]", bar: "bg-[#1a8f52]" },
  warn: { text: "text-[#c77700]", bar: "bg-[#c77700]" },
  bad: { text: "text-[#c2410c]", bar: "bg-[#c2410c]" },
} as const;

const DEFAULT_VISIBLE = 8;

export function ExpandableQuestionList({ items }: { items: ItemStat[] }) {
  const [expanded, setExpanded] = useState(false);
  const [onlyLow, setOnlyLow] = useState(false);

  const lowCount = items.filter((it) => it.pctCorrect < 50).length;
  const filtered = onlyLow ? items.filter((it) => it.pctCorrect < 50) : items;
  const visible = expanded || onlyLow ? filtered : filtered.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = Math.max(0, filtered.length - visible.length);

  return (
    <div>
      {lowCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOnlyLow((v) => !v)}
            aria-pressed={onlyLow}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              onlyLow
                ? "bg-[#fbeae1] text-[#c2410c] ring-1 ring-[#f3c6b2]"
                : "bg-[#f4f2ec] text-[#57534e] hover:bg-[#eae6dc]"
            }`}
          >
            {onlyLow ? `Mostrando solo < 50% (${lowCount})` : `Filtrar preguntas < 50% (${lowCount})`}
          </button>
          {onlyLow && (
            <button
              type="button"
              onClick={() => setOnlyLow(false)}
              className="text-xs font-semibold text-[#07305f] hover:underline"
            >
              Ver todas
            </button>
          )}
        </div>
      )}

      <div className="mt-3">
        {visible.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#78716c]">No hay preguntas bajo 50% en este ensayo.</p>
        ) : (
          visible.map((it) => <ItemRow key={it.q} it={it} />)
        )}
      </div>

      {!onlyLow && items.length > DEFAULT_VISIBLE && (
        <div className="mt-3 flex justify-center border-t border-[#efede8] pt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-[#d6d3cb] bg-[#faf9f6] px-4 py-1.5 text-xs font-semibold text-[#07305f] transition hover:bg-[#eef4ff]"
          >
            {expanded ? "Mostrar menos" : `Ver las ${hiddenCount} preguntas restantes (${items.length} en total)`}
          </button>
        </div>
      )}
    </div>
  );
}

function ItemRow({ it }: { it: ItemStat }) {
  const opts = Object.keys(it.counts).filter((k) => k !== "-").sort();
  const mx = Math.max(1, ...Object.values(it.counts));
  const lvl = LVL[it.level];
  const discriminationTitle =
    it.discrimination === null
      ? "Discriminación: sin datos suficientes (se necesitan 6+ lecturas)"
      : `Discriminación: ${it.discrimination.toFixed(2)} (tercio superior vs inferior)`;

  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)_88px] items-center gap-3 border-b border-[#efede8] py-2.5 last:border-0">
      <div className="tnum text-xs font-bold text-[#78716c]">P{it.q}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-[#1c1917]">
          {it.axis ? (
            <span className="truncate">
              {it.axis}
              {it.skill ? <span className="font-normal text-[#78716c]"> · {it.skill}</span> : null}
            </span>
          ) : (
            `Pregunta ${it.q}`
          )}
          {it.possibleKeyError && (
            <span
              className="shrink-0 rounded-full bg-[#fbeae1] px-1.5 py-0.5 text-[10px] font-bold text-[#c2410c]"
              title="Un distractor supera a la respuesta correcta, o el ítem discrimina al revés -- revisa si la clave de esta pregunta está bien cargada."
            >
              ⚠ revisar clave
            </span>
          )}
        </div>
        <div className="mt-1.5 flex h-5 items-end gap-[3px]">
          {opts.map((o) => {
            const h = Math.round(((it.counts[o] ?? 0) / mx) * 100);
            return (
              <div
                key={o}
                className={`flex-1 rounded-t-[3px] ${o === it.correct ? "bg-[#1a8f52]" : "bg-[#e7e5df]"}`}
                style={{ height: `${Math.max(6, h)}%` }}
                title={`${o}: ${it.counts[o] ?? 0}`}
              />
            );
          })}
        </div>
      </div>
      <div className="text-right" title={discriminationTitle}>
        <span className={`tnum text-[15px] font-bold ${lvl.text}`}>{it.pctCorrect}%</span>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#efede8]">
          <div className={`h-full rounded-full ${lvl.bar}`} style={{ width: `${it.pctCorrect}%` }} />
        </div>
        {it.discrimination !== null && (
          <div className={`tnum mt-0.5 text-[10px] font-semibold ${it.discrimination < 0.1 ? "text-[#c2410c]" : "text-[#78716c]"}`}>
            disc. {it.discrimination.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}
