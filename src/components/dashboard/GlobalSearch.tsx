"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentAvatar } from "@/components/dashboard/StudentAvatar";
import { getSubjectVisual } from "@/lib/subject_visuals";

type Student = { id: string; name: string; rut: string | null; student_id: string | null; course: string | null; courseId: string | null };
type Quiz = { id: string; title: string; subject: string | null; grade: string | null };
type Result = { type: "student"; item: Student } | { type: "quiz"; item: Quiz };

export function GlobalSearch({
  autoFocus = false,
  onNavigate,
}: {
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const listboxId = useId();
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

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Fetch con debounce (250ms) + cancelación de la petición anterior.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
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
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  // Ctrl+K / Cmd+K para enfocar, Esc para cerrar.
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

  function handleChange(value: string) {
    setQ(value);
    setOpen(true);
    if (value.trim().length < 2) {
      setStudents([]);
      setQuizzes([]);
      setLoading(false);
    }
  }

  function go(r: Result) {
    setOpen(false);
    setQ("");
    onNavigate?.();
    if (r.type === "quiz") {
      router.push(`/dashboard/quizzes/${r.item.id}`);
    } else {
      router.push(`/dashboard/students/${r.item.id}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) go(results[active]);
    }
  }

  const showPanel = open && q.trim().length >= 2;
  const activeOptionId = showPanel && results[active] ? `${listboxId}-opt-${active}` : undefined;

  return (
    <div ref={boxRef} className="relative w-full md:max-w-[365px]">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#78716c]" aria-hidden="true">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        value={q}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-[#d6d3cb] bg-[#faf9f6] py-2 pl-10 pr-20 text-sm text-[#1c1917] placeholder:text-[#78716c] outline-none transition focus:border-[#07305f] focus:bg-white"
        placeholder="Buscar alumno o ensayo..."
        aria-label="Buscar alumno o ensayo"
        autoComplete="off"
      />
      {loading ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[#78716c]">
          Buscando…
        </span>
      ) : (
        <span
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[#d6d3cb] bg-white px-1.5 py-0.5 text-[11px] text-[#78716c] sm:inline-block"
          aria-hidden="true"
        >
          Ctrl K
        </span>
      )}

      {showPanel && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[420px] overflow-y-auto rounded-xl border border-[#e7e5df] bg-white shadow-lg"
        >
          {loading && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#78716c]">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#78716c]">Sin resultados para «{q.trim()}»</p>
          ) : (
            <>
              {students.length > 0 && (
                <div>
                  <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-[#78716c]">Alumnos</p>
                  {students.map((s) => {
                    const idx = results.findIndex((r) => r.type === "student" && r.item.id === s.id);
                    return (
                      <button
                        key={s.id}
                        id={`${listboxId}-opt-${idx}`}
                        role="option"
                        aria-selected={active === idx}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go({ type: "student", item: s })}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                          active === idx ? "bg-[#eef4ff]" : "hover:bg-[#faf9f6]"
                        }`}
                      >
                        <StudentAvatar seed={s.id} name={s.name} size="xs" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[#1c1917]">{s.name}</span>
                          <span className="block truncate text-[11px] text-[#78716c]">
                            {[s.course ?? "Sin curso", s.rut ?? s.student_id].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {quizzes.length > 0 && (
                <div className="border-t border-[#efede8]">
                  <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-[#78716c]">Ensayos</p>
                  {quizzes.map((z) => {
                    const idx = results.findIndex((r) => r.type === "quiz" && r.item.id === z.id);
                    const subj = getSubjectVisual(z.subject);
                    return (
                      <button
                        key={z.id}
                        id={`${listboxId}-opt-${idx}`}
                        role="option"
                        aria-selected={active === idx}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go({ type: "quiz", item: z })}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                          active === idx ? "bg-[#eef4ff]" : "hover:bg-[#faf9f6]"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs ${subj.badgeClass}`}
                        >
                          {subj.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[#1c1917]">{z.title}</span>
                          <span className="block truncate text-[11px] text-[#78716c]">
                            {[z.subject, z.grade].filter(Boolean).join(" · ") || "Ensayo"}
                          </span>
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
