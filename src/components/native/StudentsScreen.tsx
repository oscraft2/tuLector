"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StudentEditSheet } from "./StudentEditSheet";
import { StudentsFab } from "./StudentsFab";
import { PullToRefresh } from "./PullToRefresh";

type StudentRow = { id: string; rut: string | null; student_id: string | null; name: string; course: string | null };
type CourseOption = { id: string; name: string; grade: string | null };

/**
 * Pantalla completa de Alumnos: header + buscador quedan pegados arriba
 * (sticky) mientras solo la lista hace scroll debajo — antes se iban con el
 * contenido al bajar la lista. Tocar una tarjeta abre el sheet de edicion.
 */
export function StudentsScreen({ students, courses }: { students: StudentRow[]; courses: CourseOption[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StudentRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q) || (s.rut ?? "").toLowerCase().includes(q));
  }, [students, query]);

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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o RUT"
              className="w-full rounded-xl border border-[#cfd6df] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#111827]"
            />
          </div>
        </div>
      </div>

      <PullToRefresh>
        <section className="space-y-5 px-5 pb-24 pt-1">
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-5 text-center text-sm text-[#5b6472]">
              {students.length === 0 ? "Todavia no hay alumnos registrados." : "Sin resultados para esa busqueda."}
            </p>
          ) : (
            <div className="grid gap-2">
              {filtered.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setEditing(student)}
                  className="flex items-center gap-3 rounded-2xl border border-[#e6e8eb] bg-white p-4 text-left shadow-sm active:scale-[0.98]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#111827]">{student.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-[#5b6472]">{student.rut ?? student.student_id ?? "-"}</p>
                  </div>
                  {student.course ? (
                    <span className="shrink-0 rounded bg-[#f4f6f8] px-2 py-1 text-xs font-semibold text-[#1e293b]">{student.course}</span>
                  ) : null}
                  <svg className="h-4 w-4 shrink-0 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              ))}
            </div>
          )}
        </section>
      </PullToRefresh>

      {editing ? (
        <StudentEditSheet student={editing} courses={courses} onClose={() => setEditing(null)} />
      ) : null}

      <StudentsFab courses={courses} />
    </main>
  );
}
