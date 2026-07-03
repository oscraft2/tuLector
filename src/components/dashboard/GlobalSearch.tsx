"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Student = { id: string; name: string; rut: string | null; student_id: string | null; course: string | null; courseId: string | null };
type Quiz = { id: string; title: string; subject: string | null; grade: string | null };
type Result = { type: "student"; item: Student } | { type: "quiz"; item: Quiz };

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const results: Result[] = [
    ...students.map((s) => ({ type: "student" as const, item: s })),
    ...quizzes.map((z) => ({ type: "quiz" as const, item: z })),
  ];

  // Fetch con debounce (250ms) + cancelación de la petición anterior.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setStudents([]); setQuizzes([]); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = await res.json();
        setStudents(Array.isArray(data.students) ? data.students : []);
        setQuizzes(Array.isArray(data.quizzes) ? data.quizzes : []);
        setActive(0);
      } catch {
        /* petición cancelada o error de red: se ignora */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q]);

  // ⌘K / Ctrl+K para enfocar, Esc para cerrar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Cerrar al hacer click fuera.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(r: Result) {
    setOpen(false);
    setQ("");
    if (r.type === "quiz") {
      router.push(`/dashboard/quizzes/${r.item.id}`);
    } else {
      router.push(r.item.courseId ? `/dashboard/students?course=${r.item.courseId}` : "/dashboard/students");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[active]) go(results[active]); }
  }

  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative w-full md:max-w-[365px]">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280]" aria-hidden="true">⌕</span>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-[#cfd6df] bg-white py-3 pl-10 pr-16 text-sm outline-none focus:border-[#07305f]"
        placeholder="Buscar alumno o ensayo..."
        aria-label="Buscar alumno o ensayo"
        autoComplete="off"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[#d8dde3] px-2 py-0.5 text-xs text-[#6b7280]" aria-hidden="true">Ctrl K</span>

      {showPanel && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[420px] overflow-y-auto rounded-md border border-[#e1e5ea] bg-white shadow-lg">
          {loading && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#6b7280]">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#6b7280]">Sin resultados para «{q.trim()}»</p>
          ) : (
            <>
              {students.length > 0 && (
                <div>
                  <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-[#9aa3af]">Alumnos</p>
                  {students.map((s) => {
                    const idx = results.findIndex((r) => r.type === "student" && r.item.id === s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go({ type: "student", item: s })}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${active === idx ? "bg-[#eef4ff]" : "hover:bg-[#f4f6f8]"}`}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#eef4ff] text-xs font-bold text-[#07305f]">{s.name?.charAt(0)?.toUpperCase() ?? "A"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[#111827]">{s.name}</span>
                          <span className="block truncate text-[11px] text-[#6b7280]">{[s.course ?? "Sin curso", s.rut ?? s.student_id].filter(Boolean).join(" · ")}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {quizzes.length > 0 && (
                <div className="border-t border-[#eef0f3]">
                  <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-[#9aa3af]">Ensayos</p>
                  {quizzes.map((z) => {
                    const idx = results.findIndex((r) => r.type === "quiz" && r.item.id === z.id);
                    return (
                      <button
                        key={z.id}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go({ type: "quiz", item: z })}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${active === idx ? "bg-[#eef4ff]" : "hover:bg-[#f4f6f8]"}`}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#eef4ff] text-xs text-[#07305f]" aria-hidden="true">▤</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[#111827]">{z.title}</span>
                          <span className="block truncate text-[11px] text-[#6b7280]">{[z.subject, z.grade].filter(Boolean).join(" · ") || "Ensayo"}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
