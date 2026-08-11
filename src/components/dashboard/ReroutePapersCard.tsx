"use client";

import { useState, useTransition } from "react";
import type { AssignActionState } from "@/app/dashboard/papers/actions";

/**
 * Aviso de hojas que quedaron en el ensayo equivocado de un lote multi-curso
 * (la hoja de un curso usada para corregir todo el nivel) y botón para moverlas
 * al ensayo de su curso, con su nota.
 *
 * Se muestra el detalle de a dónde va cada una ANTES de mover nada: es una
 * operación sobre datos ya guardados y el profesor tiene que poder revisarla.
 */
type Row = { paperId: string; studentName: string | null; targetCourseName: string };

type Props = {
  quizId: string;
  rows: Row[];
  action: (state: AssignActionState, formData: FormData) => Promise<AssignActionState>;
};

export function ReroutePapersCard({ quizId, rows, action }: Props) {
  const [state, setState] = useState<AssignActionState>({});
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (rows.length === 0 || state.success) {
    return state.success ? (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        {state.success}
      </div>
    ) : null;
  }

  const byCourse = new Map<string, number>();
  for (const r of rows) byCourse.set(r.targetCourseName, (byCourse.get(r.targetCourseName) ?? 0) + 1);
  const resumen = [...byCourse.entries()].map(([curso, n]) => `${n} de ${curso}`).join(", ");

  const move = () => {
    const fd = new FormData();
    fd.set("quiz_id", quizId);
    startTransition(async () => setState(await action({}, fd)));
  };

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">
        {rows.length} {rows.length === 1 ? "hoja de este ensayo pertenece" : "hojas de este ensayo pertenecen"} a alumnos de otro curso
      </p>
      <p className="mt-1 text-sm text-amber-800">
        Se corrigieron con esta hoja, pero sus alumnos son de {resumen}. Al moverlas, cada una queda en el
        ensayo de su curso con su nota; este ensayo se queda solo con los suyos.
      </p>

      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 text-xs font-semibold text-amber-900 underline">
        {open ? "Ocultar detalle" : "Ver cuáles"}
      </button>
      {open && (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-amber-900">
          {rows.map((r) => (
            <li key={r.paperId}>• {r.studentName ?? "Sin identificar"} → {r.targetCourseName}</li>
          ))}
        </ul>
      )}

      {state.error && <p className="mt-2 text-sm font-semibold text-red-700">{state.error}</p>}

      <button
        type="button"
        onClick={move}
        disabled={pending}
        className="mt-3 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? "Moviendo…" : `Mover ${rows.length} ${rows.length === 1 ? "hoja" : "hojas"} al ensayo de su curso`}
      </button>
    </div>
  );
}
