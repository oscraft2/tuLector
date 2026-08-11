"use client";

import Link from "next/link";

/**
 * Selector de FORMATO dentro del generador: hoja completa (/sheet) o bloque
 * compacto (/bloque).
 *
 * El formato se elige aca, imprimiendo, y no al crear el ensayo: es una
 * decision de "como voy a repartir esta prueba", no del contenido del ensayo.
 * Las dos pantallas son generadores distintos (una hoja de pagina completa y
 * una imagen pegable de 98x76 mm), asi que el switch NAVEGA entre ellas en vez
 * de intentar que una sola pantalla haga las dos cosas.
 *
 * `compactDisabledReason` no oculta la opcion: la muestra apagada CON el
 * motivo, que es lo que le sirve al profesor ("son 40 preguntas y el bloque
 * llega a 30") en vez de una opcion que simplemente no esta.
 */
export function SheetFormatSwitch({
  mode,
  quizId = null,
  compactDisabledReason = null,
}: {
  mode: "full" | "compact";
  quizId?: string | null;
  compactDisabledReason?: string | null;
}) {
  const qs = quizId ? `?quiz=${quizId}` : "";
  const base = "flex-1 rounded-lg px-3 py-2 text-center text-xs font-bold transition";
  const on = "bg-white text-zinc-900";
  const off = "text-zinc-300 hover:bg-zinc-800";

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        {mode === "full" ? (
          <span className={`${base} ${on}`}>Hoja completa</span>
        ) : (
          <Link href={`/sheet${qs}`} className={`${base} ${off}`}>Hoja completa</Link>
        )}

        {mode === "compact" ? (
          <span className={`${base} ${on}`}>Bloque compacto</span>
        ) : compactDisabledReason ? (
          <span className={`${base} cursor-not-allowed text-zinc-600`} title={compactDisabledReason}>Bloque compacto</span>
        ) : (
          <Link href={`/bloque${qs}`} className={`${base} ${off}`}>Bloque compacto</Link>
        )}
      </div>
      <p className="text-[11px] text-zinc-500">
        {compactDisabledReason
          ? compactDisabledReason
          : mode === "compact"
            ? "Imagen de 98 × 76 mm para pegar dentro de tu propia prueba de Word o Canva."
            : "La hoja de respuestas completa de TuLector, con identificación del alumno."}
      </p>
    </div>
  );
}
