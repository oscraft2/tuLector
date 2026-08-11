"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StudentPicker, type PickedStudent } from "@/components/StudentPicker";

/**
 * Identificar (o corregir) el alumno de un escaneo DESDE LA APP, sin mandar al
 * profesor al dashboard web: la app movil tiene que bastarse sola.
 *
 * Misma API que usa la camara (/api/scan/assign-student), asi que reasignar y
 * deshacer se comportan igual en los dos lugares.
 */
type Props = {
  paperId: string;
  currentStudentName: string | null;
  /** true si el escaneo ya tiene alumno (reasignacion, no primera asignacion). */
  assigned: boolean;
  label?: string;
  /** Recorte de la caja del NOMBRE de la hoja: es lo que permite reconocer al
   *  alumno cuando el ID no se leyo, sin ir a buscar la hoja de papel. */
  nameImgUrl?: string | null;
  /** Foto completa de la hoja, por si el recorte no basta. */
  photoUrl?: string | null;
};

export function PaperAssignSheet({ paperId, currentStudentName, assigned, label, nameImgUrl, photoUrl }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);

  const assign = async (student: PickedStudent, overwrite = false) => {
    if (assigned && !overwrite) {
      const ok = window.confirm(
        `Este escaneo está asignado a ${currentStudentName ?? "otro alumno"}.\n\n` +
          `Al reasignarlo a ${student.name} se borra la nota de ${currentStudentName ?? "ese alumno"} en este ensayo.`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/scan/assign-student", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, studentId: student.id, overwrite }),
      });
      const payload = await res.json().catch(() => ({}));

      if (res.status === 409 && payload?.conflict) {
        const c = payload.conflict as { score: number | null; total: number | null; scannedAt: string | null };
        const fecha = c.scannedAt ? new Date(c.scannedAt).toLocaleString("es-CL") : "otra fecha";
        const ok = window.confirm(
          `${student.name} ya tiene una hoja corregida de este ensayo (${c.score ?? "-"}/${c.total ?? "-"}, ${fecha}).\n\n` +
            "Si continúas, esa hoja queda ANULADA y vale esta.",
        );
        setBusy(false);
        if (ok) await assign(student, true);
        return;
      }
      if (!res.ok) throw new Error(payload?.error || "No se pudo asignar el alumno.");

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo asignar el alumno.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-xl border border-[#e6e8eb] bg-[#f5f6f8] py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#07305f] active:scale-[0.98]"
      >
        {label ?? (assigned ? "Cambiar alumno" : "Asignar alumno")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="max-h-[85vh] overflow-y-auto rounded-t-[1.5rem] bg-[#f5f6f8] p-5 pb-10 shadow-[0_-10px_50px_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-black text-[#111827]">{assigned ? "Cambiar alumno" : "Asignar alumno"}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#111827] shadow-sm active:scale-[0.95]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mb-3 text-xs text-[#5b6472]">
              {assigned
                ? `Asignado a ${currentStudentName ?? "-"}. Elige el alumno correcto.`
                : "La hoja ya está guardada con su puntaje. Elige de quién es."}
            </p>
            {/* El nombre escrito a mano: con esto se identifica al alumno sin
                tener que ir a buscar la hoja física. */}
            {nameImgUrl && (
              <div className="mb-3">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">Nombre escrito en la hoja</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={nameImgUrl} alt="Nombre escrito en la hoja" className="w-full rounded-xl border border-[#e6e8eb] bg-white" />
              </div>
            )}
            {!nameImgUrl && photoUrl && (
              <div className="mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Hoja escaneada" className="max-h-52 w-full rounded-xl border border-[#e6e8eb] object-contain" />
              </div>
            )}
            {showPhoto && photoUrl && nameImgUrl && (
              <div className="mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Hoja completa" className="max-h-72 w-full rounded-xl border border-[#e6e8eb] object-contain" />
              </div>
            )}
            {photoUrl && nameImgUrl && (
              <button type="button" onClick={() => setShowPhoto((v) => !v)} className="mb-3 text-xs font-semibold text-[#07305f] underline">
                {showPhoto ? "Ocultar hoja completa" : "Ver hoja completa"}
              </button>
            )}
            {error && <p className="mb-2 text-sm font-semibold text-red-600">{error}</p>}
            <StudentPicker onPick={(s) => void assign(s)} disabled={busy} autoFocus />
          </div>
        </div>
      )}
    </>
  );
}
