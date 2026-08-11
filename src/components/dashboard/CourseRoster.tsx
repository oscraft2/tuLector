"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";

const initialState: DashboardActionState = { status: "idle" };

type Found = { id: string; name: string; rut: string | null; student_id: string | null; course: string | null };

type CourseRosterProps = {
  courseName: string;
  studentCount: number;
  isAdmin: boolean;
  action: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
};

function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * Agregar un alumno existente al curso.
 *
 * Antes recibia por props TODOS los alumnos del colegio que no estaban en el
 * curso y los pintaba como <option> de un <select>. Eso obligaba a la pagina a
 * traerse la tabla completa (una de las tres cargas masivas que tenia el
 * modulo) y ademas producia un desplegable inmanejable. Ahora busca contra
 * /api/search, que ya devuelve alumnos acotados al colegio y con limite.
 */
export function CourseRoster({ courseName, studentCount, isAdmin, action }: CourseRosterProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (picked) return;
    const q = term.trim();
    // Con menos de 2 caracteres no se busca. No hace falta limpiar `results`
    // aca: el bloque de resultados solo se renderiza con q.length >= 2, y la
    // proxima busqueda los reemplaza.
    if (q.length < 2) return;

    const id = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(Array.isArray(data.students) ? data.students : []);
      } catch {
        // abortada o red caida: se deja la lista como estaba
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [term, picked]);

  // Tras agregar con exito limpia la seleccion, para encadenar varios alumnos.
  useEffect(() => {
    if (state.status !== "success") return;
    // Sincroniza con el resultado de la server action (mismo patron que
    // CourseEditRow); es un sistema externo, no estado derivado.
    /* eslint-disable react-hooks/set-state-in-effect */
    setPicked(null);
    setTerm("");
    setResults([]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [state.key, state.status]);

  return (
    <section className="rounded-md border border-[#d8dde3] bg-white p-4 md:p-5">
      <div className="flex flex-col gap-2 border-b border-[#eef0f3] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">Roster del curso</p>
          <h2 className="mt-1 text-xl font-semibold text-[#111827]">{courseName}</h2>
        </div>
        <p className="text-sm font-semibold text-[#07305f]">{studentCount} alumno{studentCount === 1 ? "" : "s"}</p>
      </div>

      {isAdmin ? (
        <div className="mt-4">
          <label className="block text-xs font-semibold text-[#111827]">
            Agregar alumno existente
            <input
              type="search"
              value={picked ? picked.name : term}
              onChange={(e) => { setPicked(null); setTerm(e.target.value); }}
              placeholder="Busca por nombre, RUT o ID"
              className="mt-1 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#07305f]"
            />
          </label>

          {!picked && term.trim().length >= 2 && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-[#eef0f3]">
              {searching && results.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[#8b93a1]">Buscando…</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[#8b93a1]">Ningun alumno coincide.</p>
              ) : (
                results.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPicked(s)}
                    className="block w-full border-b border-[#f4f6f8] px-3 py-2 text-left text-sm last:border-0 hover:bg-[#f4f6f8]"
                  >
                    <span className="font-semibold text-[#111827]">{s.name}</span>
                    <span className="ml-2 font-mono text-xs text-[#5b6472]">{s.rut ?? s.student_id}</span>
                    <span className="ml-2 text-xs text-[#8b93a1]">{s.course ? `actual: ${s.course}` : "sin curso"}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {picked && (
            <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="course" value={courseName} />
              <input type="hidden" name="student_id" value={picked.id} />
              <p className="text-sm text-[#5b6472]">
                Agregar a <strong className="text-[#111827]">{picked.name}</strong>
                {picked.course ? <> (hoy en {picked.course})</> : null}
              </p>
              <SubmitButton label="Agregar" pendingLabel="Agregando..." className="rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#062447]" />
              <button
                type="button"
                onClick={() => { setPicked(null); setTerm(""); }}
                className="rounded-md border border-[#cfd6df] px-3 py-2 text-sm font-semibold text-[#5b6472] hover:bg-[#f4f6f8]"
              >
                Cancelar
              </button>
            </form>
          )}
        </div>
      ) : null}

      <ActionFeedbackDialog state={state} />
    </section>
  );
}
