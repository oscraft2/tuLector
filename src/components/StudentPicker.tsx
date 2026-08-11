"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Buscador de alumnos para asignar un escaneo. Reemplaza al <select> con TODOS
 * los alumnos del colegio: escribe, filtra por curso, elige.
 *
 * Se usa en dos contextos muy distintos -- encima de la camara (fondo oscuro) y
 * en la cola de revision del dashboard (fondo claro) -- asi que la paleta viene
 * por prop `tone` en vez de duplicar el componente.
 */
export type PickedStudent = { id: string; name: string; rut: string | null; course: string | null };

type Props = {
  onPick: (student: PickedStudent) => void;
  tone?: "dark" | "light";
  autoFocus?: boolean;
  /** Texto inicial (ej. el ID leido a medias de la hoja). */
  initialQuery?: string;
  disabled?: boolean;
};

type LookupResponse = {
  students?: PickedStudent[];
  courses?: { id: string; name: string }[];
  error?: string;
};

export function StudentPicker({ onPick, tone = "light", autoFocus = false, initialQuery = "", disabled = false }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [students, setStudents] = useState<PickedStudent[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Descarta respuestas de busquedas que ya quedaron obsoletas (el usuario
  // sigue escribiendo y la lenta llega despues de la nueva).
  const requestId = useRef(0);

  const search = useCallback(async (q: string, course: string | null) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q });
      if (course) params.set("course", course);
      const res = await fetch(`/api/students/lookup?${params.toString()}`, { credentials: "include" });
      const payload = (await res.json().catch(() => ({}))) as LookupResponse;
      if (id !== requestId.current) return;
      if (!res.ok) throw new Error(payload.error || "No se pudo buscar alumnos.");
      setStudents(payload.students ?? []);
      if (payload.courses) setCourses(payload.courses);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : "No se pudo buscar alumnos.");
      setStudents([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // Debounce: una busqueda ~250ms despues de la ultima tecla. La primera corre
  // sola (lista inicial de alumnos, sin escribir nada).
  useEffect(() => {
    const t = setTimeout(() => void search(query.trim(), courseId), 250);
    return () => clearTimeout(t);
  }, [query, courseId, search]);

  const dark = tone === "dark";
  const inputClass = dark
    ? "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500"
    : "w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#9aa2af]";
  const rowClass = dark
    ? "w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2.5 text-left active:bg-zinc-800 disabled:opacity-50"
    : "w-full rounded-md border border-[#e6e8eb] bg-white px-3 py-2.5 text-left hover:border-[#07305f] disabled:opacity-50";

  return (
    <div className="space-y-3">
      <input
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre o RUT…"
        className={inputClass}
        disabled={disabled}
      />

      {courses.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCourseId(null)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              courseId === null
                ? dark ? "bg-white text-black" : "bg-[#07305f] text-white"
                : dark ? "bg-zinc-800 text-zinc-300" : "bg-[#eef1f5] text-[#5b6472]"
            }`}
          >
            Todos
          </button>
          {courses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCourseId(courseId === c.id ? null : c.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                courseId === c.id
                  ? dark ? "bg-white text-black" : "bg-[#07305f] text-white"
                  : dark ? "bg-zinc-800 text-zinc-300" : "bg-[#eef1f5] text-[#5b6472]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {error && <p className={`text-xs font-semibold ${dark ? "text-red-400" : "text-red-600"}`}>{error}</p>}

      <div className="max-h-64 space-y-1.5 overflow-y-auto">
        {loading && students.length === 0 && (
          <p className={`text-xs ${dark ? "text-zinc-500" : "text-[#5b6472]"}`}>Buscando…</p>
        )}
        {!loading && students.length === 0 && !error && (
          <p className={`text-xs ${dark ? "text-zinc-500" : "text-[#5b6472]"}`}>
            {query ? "Ningún alumno coincide." : "No hay alumnos cargados en este colegio."}
          </p>
        )}
        {students.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className={rowClass}
          >
            <span className={`block truncate text-sm font-bold ${dark ? "text-white" : "text-[#111827]"}`}>{s.name}</span>
            <span className={`block truncate text-[11px] ${dark ? "text-zinc-400" : "text-[#5b6472]"}`}>
              {[s.rut, s.course].filter(Boolean).join(" · ") || "Sin curso"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
