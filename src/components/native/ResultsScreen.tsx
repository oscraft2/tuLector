"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PullToRefresh } from "./PullToRefresh";

type QuizWithCounts = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  num_questions: number | null;
  total: number;
  pending: number;
};

/**
 * Pantalla completa de Resultados: header + buscador + chips de materia
 * quedan pegados arriba (sticky) mientras solo la lista de ensayos hace
 * scroll debajo — antes el header y los filtros se iban con el contenido al
 * bajar la lista, obligando a volver a subir para tocar "Volver" o cambiar
 * el filtro.
 */
export function ResultsScreen({ quizzes, totalPending }: { quizzes: QuizWithCounts[]; totalPending: number }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string | null>(null);

  const subjects = useMemo(
    () => Array.from(new Set(quizzes.map((q) => q.subject).filter((s): s is string => !!s))).sort(),
    [quizzes]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quizzes.filter((quiz) => {
      if (subject && quiz.subject !== subject) return false;
      if (!q) return true;
      return quiz.title.toLowerCase().includes(q) || (quiz.subject ?? "").toLowerCase().includes(q);
    });
  }, [quizzes, query, subject]);

  return (
    <main className="min-h-dvh bg-[#f5f6f8] text-[#0b1220]">
      <div className="sticky top-0 z-30 bg-[#f5f6f8]">
        <header className="safe-pt flex items-center gap-3 bg-[#111827] px-5 pb-5 pt-5 text-white">
          <Link href="/app" aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
          <h1 className="text-lg font-black tracking-tight">Resultados</h1>
        </header>

        <div className="px-5 pb-3 pt-4">
          <div className="relative mb-3">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ensayo por titulo o materia"
              className="w-full rounded-xl border border-[#cfd6df] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#111827]"
            />
          </div>

          {subjects.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSubject(null)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${subject === null ? "bg-[#07305f] text-white" : "bg-white text-[#5b6472] border border-[#e6e8eb]"}`}
              >
                Todas
              </button>
              {subjects.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubject(s)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${subject === s ? "bg-[#07305f] text-white" : "bg-white text-[#5b6472] border border-[#e6e8eb]"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <PullToRefresh>
        <section className="space-y-5 px-5 pb-24 pt-1">
          {totalPending > 0 ? (
            <div className="rounded-2xl border border-[#fbceb1] bg-[#fdf3ec] p-4 text-sm text-[#9a3412]">
              <span className="font-bold">{totalPending} hoja{totalPending === 1 ? "" : "s"}</span> quedaron para revision manual (respuestas dudosas). Revisalas desde el navegador en tulector.vercel.app.
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-5 text-center text-sm text-[#5b6472]">
              {quizzes.length === 0 ? "Todavia no hay ensayos con resultados." : "Sin resultados para ese filtro."}
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((quiz) => (
                <Link
                  key={quiz.id}
                  href={`/app/results/${quiz.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-[#e6e8eb] bg-white p-4 shadow-sm active:scale-[0.98]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#111827]">{quiz.title}</p>
                    <p className="mt-0.5 text-xs text-[#5b6472]">
                      {quiz.total} escaneo{quiz.total === 1 ? "" : "s"}
                      {quiz.pending > 0 ? ` · ${quiz.pending} por revisar` : ""}
                    </p>
                  </div>
                  <svg className="h-5 w-5 shrink-0 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </Link>
              ))}
            </div>
          )}
        </section>
      </PullToRefresh>
    </main>
  );
}
