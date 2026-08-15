"use client";

import type { ReactNode } from "react";
import type { AnswerState, CheckedAnswer } from "@/lib/compact_scan";

/**
 * Resultado de UNA lectura de bloque compacto, pensado para leerse de lejos y de
 * pie frente al curso: el profesor corrige con el telefono en una mano y la pila
 * de pruebas en la otra, asi que el puntaje va enorme, cada pregunta dice en un
 * golpe de vista si esta buena o mala (y cual era la correcta), y el boton para
 * seguir con la siguiente hoja esta SIEMPRE visible, no al final del scroll.
 *
 * Lo usan /scan/rapido (correccion sin alumnos) y /scan/compacto (con ensayo).
 */

const STATE_STYLE: Record<AnswerState, { box: string; label: string }> = {
  correct: { box: "border-emerald-500/70 bg-emerald-500/15", label: "text-emerald-300" },
  wrong:   { box: "border-red-500/70 bg-red-500/15",         label: "text-red-300" },
  blank:   { box: "border-zinc-700 bg-zinc-800/40",          label: "text-zinc-500" },
  doubt:   { box: "border-amber-500/70 bg-amber-500/15",     label: "text-amber-300" },
  unknown: { box: "border-zinc-600 bg-zinc-800/60",          label: "text-zinc-300" },
};

export interface CompactResultViewProps {
  /** Lectura ya cruzada con la pauta (checkAgainstKey). */
  checked: CheckedAnswer[];
  correct: number;
  /** Preguntas puntuables. 0 = se leyo sin pauta. */
  total: number;
  /** Titulo chico de la barra superior (nombre de la pauta o del ensayo). */
  title?: string;
  /** Linea bajo el puntaje: nota, alumno, estado del guardado… */
  subtitle?: ReactNode;
  /** Avisos (formato no verificado, hoja de otro ensayo, etc.). */
  warnings?: string[];
  /** Texto del boton principal. */
  nextLabel?: string;
  onNext: () => void;
  /** Accion secundaria opcional (salir, cambiar pauta…). */
  secondary?: { label: string; onClick: () => void };
}

export function CompactResultView({
  checked, correct, total, title, subtitle, warnings = [],
  nextLabel = "Escanear siguiente", onNext, secondary,
}: CompactResultViewProps) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : null;
  const blanks = checked.filter((c) => c.state === "blank").length;
  const doubts = checked.filter((c) => c.state === "doubt").length;
  const notes = checked.filter((c) => c.note).length;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {title && (
        <div className="px-4 py-2 bg-zinc-900 text-xs text-zinc-400 truncate shrink-0">{title}</div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-4">
        {warnings.map((w, i) => (
          <p key={i} className="rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">⚠ {w}</p>
        ))}

        {/* Puntaje: lo unico que el profesor mira si va apurado. */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-6 text-center">
          {total > 0 ? (
            <>
              <p className="text-6xl font-black tabular-nums leading-none">
                {correct}<span className="text-zinc-600">/{total}</span>
              </p>
              {pct !== null && <p className="mt-2 text-2xl font-bold text-zinc-300">{pct}% correcto</p>}
            </>
          ) : (
            <>
              <p className="text-5xl font-black tabular-nums leading-none">
                {checked.filter((c) => c.state !== "blank" && c.state !== "doubt").length}
              </p>
              <p className="mt-2 text-sm text-zinc-400">respuestas leídas (sin pauta no hay buenas ni malas)</p>
            </>
          )}
          {subtitle && <div className="mt-3 text-sm text-zinc-300">{subtitle}</div>}
          {(blanks > 0 || doubts > 0) && (
            <p className="mt-3 text-xs text-zinc-400">
              {blanks > 0 && <>{blanks} en blanco</>}
              {blanks > 0 && doubts > 0 && " · "}
              {doubts > 0 && <span className="text-amber-300">{doubts} dudosa{doubts > 1 ? "s" : ""}</span>}
            </p>
          )}
        </div>

        {/* Detalle pregunta a pregunta. */}
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {checked.map((c) => {
            const st = STATE_STYLE[c.state];
            return (
              <div key={c.q} className={`rounded-xl border px-1 py-2 text-center ${st.box}`} title={c.note}>
                <span className="block text-[11px] text-zinc-400">{c.q}</span>
                <span className={`block text-2xl font-black leading-tight ${st.label}`}>
                  {c.marked === "-" ? "·" : c.marked}
                </span>
                {/* La letra correcta se imprime SOLO cuando no coincide: en las
                    buenas seria ruido y esta pantalla se lee de un vistazo. */}
                {c.expected && c.state !== "correct" && c.state !== "unknown" && (
                  <span className="block text-[11px] text-zinc-400">era {c.expected}</span>
                )}
                {c.note && <span className="block text-[10px] text-amber-400/90 truncate">{c.note}</span>}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
          <span><span className="text-emerald-400">■</span> correcta</span>
          <span><span className="text-red-400">■</span> incorrecta</span>
          <span><span className="text-zinc-500">■</span> en blanco</span>
          <span><span className="text-amber-400">■</span> dudosa</span>
          {notes > 0 && <span className="text-amber-400/80">{notes} con aviso del lector</span>}
        </div>
      </div>

      {/* Barra fija: seguir con la siguiente hoja nunca queda fuera de pantalla. */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        <button
          onClick={onNext}
          className="w-full rounded-xl bg-white text-black text-lg font-bold py-4 active:scale-[0.99] transition-transform"
        >
          {nextLabel}
        </button>
        {secondary && (
          <button onClick={secondary.onClick} className="w-full text-center text-xs text-zinc-400 underline py-1">
            {secondary.label}
          </button>
        )}
      </div>
    </div>
  );
}
