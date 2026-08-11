"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { StudentsFab } from "./StudentsFab";
import { PullToRefresh } from "./PullToRefresh";

type StudentRow = { id: string; rut: string | null; student_id: string | null; name: string; course: string | null };
type CourseOption = { id: string; name: string; grade: string | null };

type StudentsScreenProps = {
  students: StudentRow[];
  courses: CourseOption[];
  /** Total de coincidencias en el servidor (no solo las de esta pagina). */
  total: number;
  /** true si hay mas resultados que los mostrados. */
  hasMore: boolean;
  /** Termino ya aplicado, para rehidratar el input tras navegar. */
  query: string;
};

/**
 * Pantalla completa de Alumnos: header + buscador quedan pegados arriba
 * (sticky) mientras solo la lista hace scroll debajo. Tocar una tarjeta lleva
 * al perfil del alumno (/app/students/[id]: resultados, KPIs, historial) —
 * editar/eliminar vive ahi, en el boton del header de esa pantalla.
 *
 * La busqueda es DEL SERVIDOR. Antes esta pantalla recibia todos los alumnos
 * del colegio y filtraba con useMemo: en un celular con datos moviles eso era
 * la peor version del problema.
 */
export function StudentsScreen({ students, courses, total, hasMore, query }: StudentsScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [term, setTerm] = useState(query);
  const typing = useRef(false);

  useEffect(() => {
    if (!typing.current) setTerm(query);
  }, [query]);

  useEffect(() => {
    if (!typing.current) return;
    const id = setTimeout(() => {
      typing.current = false;
      const params = new URLSearchParams(searchParams.toString());
      if (term.trim()) params.set("q", term.trim());
      else params.delete("q");
      startTransition(() => router.replace(`/app/students${params.toString() ? `?${params}` : ""}`));
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <main className="min-h-dvh bg-[#f5f6f8] text-[#0b1220]">
      <div className="sticky top-0 z-30 bg-[#f5f6f8]">
        <header className="safe-pt flex items-center gap-3 bg-[#111827] px-5 pb-5 pt-5 text-white">
          <Link href="/app" aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
          <h1 className="text-lg font-black tracking-tight">Alumnos</h1>
        </header>

        <div className="px-5 pb-3 pt-4">
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              value={term}
              onChange={(e) => { typing.current = true; setTerm(e.target.value); }}
              placeholder="Buscar por nombre, RUT o ID"
              className="w-full rounded-xl border border-[#cfd6df] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#111827]"
            />
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-[#8b93a1]" aria-live="polite">
            {isPending ? "Buscando…" : `${total} alumno${total === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <PullToRefresh>
        <section className="space-y-5 px-5 pb-24 pt-1">
          {students.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-5 text-center text-sm text-[#5b6472]">
              {query ? "Sin resultados para esa busqueda." : "Todavia no hay alumnos registrados."}
            </p>
          ) : (
            <div className="divide-y divide-[#e6e8eb] overflow-hidden rounded-2xl border border-[#e6e8eb] bg-white">
              {students.map((student) => (
                <Link
                  key={student.id}
                  href={`/app/students/${student.id}`}
                  transitionTypes={["nav-forward"]}
                  className="flex items-center gap-3 px-4 py-3.5 text-left active:bg-[#f4f6f8]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#111827]">{student.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-[#5b6472]">{student.rut ?? student.student_id ?? "-"}</p>
                  </div>
                  {student.course ? (
                    <span className="shrink-0 rounded bg-[#f4f6f8] px-2 py-1 text-xs font-semibold text-[#1e293b]">{student.course}</span>
                  ) : null}
                  <svg className="h-4 w-4 shrink-0 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </Link>
              ))}
            </div>
          )}

          {hasMore && (
            <p className="rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-4 text-center text-xs text-[#5b6472]">
              Mostrando los primeros {students.length} de {total}. Afina la busqueda para encontrar un alumno puntual.
            </p>
          )}
        </section>
      </PullToRefresh>

      <StudentsFab courses={courses} />
    </main>
  );
}
