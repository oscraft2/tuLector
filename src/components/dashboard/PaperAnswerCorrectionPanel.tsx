"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import type { AnswerCorrectionState } from "@/app/dashboard/papers/actions";

export type BreakdownRow = {
  q: number;
  axis: string | null;
  skill: string | null;
  isOpen: boolean;
  isMultiSelect: boolean;
  studentAnswer: string;
  correctAnswer: string;
  hasKey: boolean;
  correct: boolean;
  /** Letras validas para esta pregunta ("ABCDE"), ya resueltas contra option_overrides. */
  options: string[];
};

type Props = {
  paperId: string;
  quizId: string;
  rows: BreakdownRow[];
  action: (state: AnswerCorrectionState, formData: FormData) => Promise<AnswerCorrectionState>;
};

const initialState: AnswerCorrectionState = {};

/**
 * Detalle por pregunta de UNA hoja: lo que el alumno marco vs. la clave, con
 * un <select> por pregunta cerrada para corregir una lectura equivocada del
 * motor. Adapta el patron visual de ScanLogCorrectionPanel (grid Q{n},
 * resaltado en rojo) pero con <select> en vez de texto libre -- una respuesta
 * invalida queda estructuralmente imposible en vez de validarse recien en el
 * servidor. Preguntas abiertas/multi-select se muestran de solo lectura: cada
 * una tiene su propio flujo de correccion.
 */
export function PaperAnswerCorrectionPanel({ paperId, quizId, rows, action }: Props) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <div className="rounded-md border border-[#e6e8eb] bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#111827]">Detalle por pregunta</h2>
        {state.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm font-semibold text-green-700">{state.success}</p>}
      </div>
      <p className="text-sm text-[#5b6472]">
        Respuesta del alumno vs. la clave del ensayo. Si el motor leyó mal una pregunta, corrígela abajo — la nota y el
        puntaje se recalculan solos al guardar.
      </p>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="paper_id" value={paperId} />
        <input type="hidden" name="quiz_id" value={quizId} />

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {rows.map((row) => {
            const readOnly = row.isOpen || row.isMultiSelect;
            const mismatch = !readOnly && row.hasKey && !row.correct;
            return (
              <div
                key={row.q}
                className={`rounded border p-1.5 ${mismatch ? "border-red-300 bg-red-50" : "border-[#e5e7eb]"}`}
                title={row.axis ?? undefined}
              >
                <label className="block text-center text-[10px] text-[#9ca3af]">Q{row.q}</label>
                {readOnly ? (
                  <div className="rounded border border-[#e5e7eb] bg-[#f7f8fa] px-1 py-1 text-center text-[10px] font-semibold uppercase text-[#6b7280]">
                    {row.isOpen ? "Desarrollo" : "Múltiple"}
                  </div>
                ) : (
                  <select
                    name={`ans_${row.q}`}
                    defaultValue={row.studentAnswer}
                    className="w-full rounded border border-[#cfd6df] px-1 py-1 text-center font-mono text-xs uppercase outline-none focus:border-[#07305f]"
                  >
                    <option value="-">-</option>
                    {row.options.map((letter) => (
                      <option key={letter} value={letter}>{letter}</option>
                    ))}
                  </select>
                )}
                {mismatch && (
                  <p className="mt-0.5 text-center text-[9px] font-semibold text-red-600">correcta: {row.correctAnswer}</p>
                )}
              </div>
            );
          })}
        </div>

        <SubmitButton pendingLabel="Guardando…" className="rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b3f78] disabled:cursor-not-allowed disabled:opacity-60">
          Guardar correcciones
        </SubmitButton>
      </form>
    </div>
  );
}
