"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { StudentPicker, type PickedStudent } from "@/components/StudentPicker";
import type { AssignActionState } from "@/app/dashboard/papers/actions";

/**
 * Panel de identificacion de un escaneo en la cola de revision. Reemplaza al
 * <select> con todos los alumnos del colegio por el buscador con filtro por
 * curso, y agrega los dos casos que faltaban:
 *
 *  - REASIGNAR un escaneo ya identificado (te equivocaste de alumno): pide
 *    confirmacion explicita, porque borra la nota del alumno anterior.
 *  - SOBRESCRIBIR cuando el alumno destino ya tenia otra hoja de este ensayo:
 *    la accion devuelve `conflict` y aqui se pregunta antes de anularla.
 *
 * Las server actions se invocan a mano (no via <form action>) para que las dos
 * confirmaciones vivan en el mismo handler que hace la llamada: el flujo se lee
 * de arriba a abajo y no necesita efectos que reaccionen al resultado.
 */
type Props = {
  paperId: string;
  currentStudentName: string | null;
  /** true si el escaneo ya esta asignado (status distinto de manual_review). */
  assigned: boolean;
  canUndo: boolean;
  assignAction: (state: AssignActionState, formData: FormData) => Promise<AssignActionState>;
  undoAction: (state: AssignActionState, formData: FormData) => Promise<AssignActionState>;
  /** Descarta el escaneo (hoja que no corresponde a nadie). */
  voidAction: (state: AssignActionState, formData: FormData) => Promise<AssignActionState>;
  /** Ensayo del que vino la hoja, para poder volver a él al terminar. */
  quizId: string;
};

export function PaperAssignPanel({ paperId, currentStudentName, assigned, canUndo, assignAction, undoAction, voidAction, quizId }: Props) {
  const [state, setState] = useState<AssignActionState>({});
  const [pending, startTransition] = useTransition();

  const callAssign = (student: PickedStudent, overwrite: boolean) => {
    const fd = new FormData();
    fd.set("paper_id", paperId);
    fd.set("student_id", student.id);
    fd.set("student_name", student.name);
    if (overwrite) fd.set("overwrite", "1");

    startTransition(async () => {
      const result = await assignAction({}, fd);
      if (result.conflict) {
        const c = result.conflict;
        const fecha = c.scannedAt ? new Date(c.scannedAt).toLocaleString("es-CL") : "otra fecha";
        const ok = window.confirm(
          `${c.studentName} ya tiene una hoja corregida de este ensayo (${c.score ?? "-"}/${c.total ?? "-"}, ${fecha}).\n\n` +
            "Si continúas, esa hoja queda ANULADA y vale esta.",
        );
        if (ok) {
          callAssign(student, true);
          return;
        }
        setState({});
        return;
      }
      setState(result);
    });
  };

  const submitPick = (student: PickedStudent) => {
    if (assigned) {
      const ok = window.confirm(
        `Este escaneo está asignado a ${currentStudentName ?? "otro alumno"}.\n\n` +
          `Al reasignarlo a ${student.name} se borra la nota de ${currentStudentName ?? "ese alumno"} en este ensayo.`,
      );
      if (!ok) return;
    }
    callAssign(student, false);
  };

  const undo = () => {
    const fd = new FormData();
    fd.set("paper_id", paperId);
    startTransition(async () => setState(await undoAction({}, fd)));
  };

  const discard = () => {
    const ok = window.confirm(
      "¿Descartar esta hoja?\n\nQueda anulada y deja de contar en el ensayo. Si tenía nota, se elimina.",
    );
    if (!ok) return;
    const fd = new FormData();
    fd.set("paper_id", paperId);
    startTransition(async () => setState(await voidAction({}, fd)));
  };

  return (
    <div className="space-y-4">
      {state.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
      {/* Al terminar, la salida natural es volver al ensayo y seguir con la
          siguiente hoja pendiente — no quedarse en la pantalla de una hoja ya
          resuelta. */}
      {state.success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-800">{state.success}</p>
          <Link
            href={`/dashboard/quizzes/${quizId}`}
            className="mt-2 inline-block rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#062447]"
          >
            ← Volver al ensayo
          </Link>
        </div>
      )}

      <StudentPicker onPick={submitPick} disabled={pending} />
      {pending && <p className="text-xs text-[#5b6472]">Guardando…</p>}

      {canUndo && (
        <button
          type="button"
          onClick={undo}
          disabled={pending}
          className="w-full rounded-md border border-[#cfd6df] py-2 text-sm font-semibold text-[#5b6472] hover:border-[#07305f] hover:text-[#07305f] disabled:opacity-50"
        >
          Deshacer la última asignación
        </button>
      )}

      {/* La hoja no es de nadie (foto repetida, hoja en blanco ajena, prueba que
          no corresponde): se descarta en vez de quedar ocupando la revisión. */}
      <button
        type="button"
        onClick={discard}
        disabled={pending}
        className="w-full rounded-md border border-red-200 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Descartar esta hoja
      </button>
    </div>
  );
}
