"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type CourseOption = { id: string; name: string };

const FILTER_KEYS = ["q", "course", "grade", "papers", "page"] as const;

type StudentFiltersProps = {
  courses: readonly CourseOption[];
  grades: readonly string[];
  /** Total de coincidencias del filtro activo (lo entrega el servidor). */
  total: number;
  /** true si la BD aun no tiene la migracion: el filtro de ensayos no aplica. */
  degraded?: boolean;
};

/**
 * Filtros del listado de alumnos. Escriben en la URL (searchParams) y el
 * servidor resuelve la consulta: nunca se filtra en el cliente, que es lo que
 * obligaba a traerse la tabla completa.
 *
 * El texto se aplica con debounce y `startTransition` para que escribir no
 * dispare una navegacion por tecla; los desplegables aplican al instante.
 */
export function StudentFilters({ courses, grades, total, degraded = false }: StudentFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const course = searchParams.get("course") ?? "";
  const grade = searchParams.get("grade") ?? "";
  const papers = searchParams.get("papers") ?? "";

  // Refleja cambios de URL que no vengan de este input (ej. boton "Limpiar",
  // volver atras en el navegador) sin pisar lo que el usuario esta tecleando.
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
    // Cualquier cambio de filtro vuelve a la pagina 1: quedarse en la pagina 7
    // de un resultado que ahora tiene 2 paginas mostraria una tabla vacia.
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
            placeholder="Nombre, RUT o ID del alumno"
            className="mt-1 block w-full rounded-md border border-[#cfd6df] bg-white px-3 py-1.5 text-sm font-normal outline-none focus:border-[#07305f]"
          />
        </label>

        <label className="text-xs font-semibold text-[#5b6472]">
          Curso
          <select value={course} onChange={(e) => push({ course: e.target.value })} className={`${selectClass} max-w-[200px]`}>
            <option value="">Todos</option>
            <option value="none">— Sin curso asignado —</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className="text-xs font-semibold text-[#5b6472]">
          Nivel
          <select value={grade} onChange={(e) => push({ grade: e.target.value })} className={selectClass}>
            <option value="">Todos</option>
            {grades.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>

        <label className="text-xs font-semibold text-[#5b6472]">
          Ensayos rendidos
          <select
            value={papers}
            onChange={(e) => push({ papers: e.target.value })}
            disabled={degraded}
            title={degraded ? "Requiere aplicar la migracion 20260810000000_student_directory.sql" : undefined}
            className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <option value="">Todos</option>
            <option value="yes">Con ensayos</option>
            <option value="no">Sin ensayos</option>
          </select>
        </label>

        {hasFilter && (
          <button onClick={clear} className="rounded-md border border-[#cfd6df] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b6472] hover:bg-[#f4f6f8]">
            Limpiar
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-[#8b93a1]" aria-live="polite">
        {isPending ? "Buscando…" : `${total} alumno${total === 1 ? "" : "s"}${hasFilter ? " con los filtros aplicados" : " en el establecimiento"}.`}
      </p>
    </div>
  );
}
