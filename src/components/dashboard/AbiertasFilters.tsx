"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type CourseOption = { id: string; label: string };

const FILTER_KEYS = ["q", "course", "page"] as const;

type AbiertasFiltersProps = {
  /** Solo los cursos que de verdad tienen hojas en ESTE ensayo (no todo el
   *  colegio) -- ver groupByCourse en src/lib/paper_course.ts. */
  courses: readonly CourseOption[];
  total: number;
};

/**
 * Filtro de curso + buscador por RUT/nombre para la pantalla de calificacion
 * rapida de abiertas (src/app/dashboard/quizzes/[id]/abiertas/page.tsx).
 * Mismo patron que StudentFilters.tsx (URL como fuente de verdad, el server
 * component filtra) pero acotado a los alumnos de ESTE ensayo.
 */
export function AbiertasFilters({ courses, total }: AbiertasFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const course = searchParams.get("course") ?? "";

  const typing = useRef(false);
  useEffect(() => {
    if (!typing.current) setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  const push = (changes: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    startTransition(() => router.replace(`?${params.toString()}`));
  };

  useEffect(() => {
    if (!typing.current) return;
    const id = setTimeout(() => {
      typing.current = false;
      push({ q });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const clear = () => {
    typing.current = false;
    setQ("");
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) params.delete(key);
    startTransition(() => router.replace(`?${params.toString()}`));
  };

  const hasFilter = FILTER_KEYS.some((key) => key !== "page" && searchParams.get(key));
  const selectClass = "mt-1 block rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-xs font-normal outline-none focus:border-[#07305f]";

  return (
    <div className="rounded-md border border-[#e1e5ea] bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 text-xs font-semibold text-[#5b6472]">
          Buscar
          <input
            type="search"
            value={q}
            onChange={(e) => { typing.current = true; setQ(e.target.value); }}
            placeholder="Nombre o RUT del alumno"
            className="mt-1 block w-full rounded-md border border-[#cfd6df] bg-white px-3 py-1.5 text-sm font-normal outline-none focus:border-[#07305f]"
          />
        </label>

        <label className="text-xs font-semibold text-[#5b6472]">
          Curso
          <select value={course} onChange={(e) => push({ course: e.target.value })} className={`${selectClass} max-w-[220px]`}>
            <option value="">Todos</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>

        {hasFilter && (
          <button onClick={clear} className="rounded-md border border-[#cfd6df] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b6472] hover:bg-[#f4f6f8]">
            Limpiar
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-[#8b93a1]" aria-live="polite">
        {isPending ? "Buscando…" : `${total} alumno${total === 1 ? "" : "s"}${hasFilter ? " con los filtros aplicados" : " en este ensayo"}.`}
      </p>
    </div>
  );
}
