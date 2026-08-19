"use client";

import { useState, useTransition } from "react";
import { confirmOpenAnswer } from "@/app/dashboard/actions";

type Props = {
  paperId: string;
  question: number;
  quizId: string;
  /** null/0 = rubrica de esta pregunta no configurada todavia -- se
   *  deshabilita la celda en vez de dejar guardar contra un maximo
   *  inexistente (ver docs/plan-dia-abiertas.md, seccion "Robustez"). */
  maxPoints: number | null;
  initialConfirmed: number | null;
  /** Transcripcion/sugerencia de la IA, solo como referencia -- nunca se usa
   *  como valor por defecto (el input siempre parte en 0). */
  aiHint?: string;
};

/**
 * Celda de calificacion de UNA pregunta abierta para UN alumno, en la
 * pantalla de calificacion rapida (quizzes/[id]/abiertas). A diferencia de la
 * tabla plana original (quizzes/[id]/page.tsx), sigue siendo editable despues
 * de confirmar -- llama a confirmOpenAnswer directamente (es un "use server"
 * export, se puede invocar como funcion normal, no solo desde <form action>)
 * para poder mostrar el error inline en la celda en vez de tirar abajo toda
 * la pantalla si algo sale mal.
 */
export function OpenAnswerCell({ paperId, question, quizId, maxPoints, initialConfirmed, aiHint }: Props) {
  const [value, setValue] = useState(initialConfirmed ?? 0);
  const [saved, setSaved] = useState(initialConfirmed != null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const disabled = !maxPoints || maxPoints <= 0;

  const save = () => {
    setError(null);
    const clamped = Math.max(0, Math.min(value, maxPoints ?? value));
    setValue(clamped);
    const fd = new FormData();
    fd.set("paper_id", paperId);
    fd.set("question", String(question));
    fd.set("quiz_id", quizId);
    fd.set("points", String(clamped));
    if (maxPoints != null) fd.set("max_points", String(maxPoints));
    startTransition(async () => {
      try {
        await confirmOpenAnswer(fd);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      {aiHint && (
        <p className="max-w-[11rem] truncate text-[11px] text-[#8a93a1]" title={aiHint}>{aiHint}</p>
      )}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          step={0.5}
          min={0}
          max={maxPoints ?? undefined}
          value={value}
          disabled={disabled}
          onChange={(e) => { setValue(Number(e.target.value)); setSaved(false); }}
          className="w-14 rounded border border-[#cfd6df] px-1.5 py-1 text-sm disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
        />
        <button
          type="button"
          onClick={save}
          disabled={disabled || isPending}
          className={`rounded border px-2 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
            saved ? "border-[#0f766e] bg-[#f0fdfa] text-[#0f766e]" : "border-[#07305f] text-[#07305f] hover:bg-[#eef2f7]"
          }`}
        >
          {isPending ? "Guardando…" : saved ? "✓ Guardado" : "Guardar"}
        </button>
      </div>
      {error && <p className="text-[11px] font-semibold text-[#b91c1c]">{error}</p>}
      {disabled && <p className="text-[11px] text-[#b45309]">Sin rúbrica configurada</p>}
    </div>
  );
}
