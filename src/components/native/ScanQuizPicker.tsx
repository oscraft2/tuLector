"use client";

import { useState } from "react";
import Link from "next/link";
import { startScanForQuiz } from "@/app/dashboard/actions";
import { parseSheetMode } from "@/lib/sheet_mode";

type Quiz = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  num_questions: number | null;
  sheet_mode?: string | null;
};

export function ScanQuizPicker({ quizzes, hasActive }: { quizzes: Quiz[]; hasActive: boolean }) {
  const [open, setOpen] = useState(!hasActive);
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase();
  const visible = quizzes.filter((quiz) =>
    `${quiz.title} ${quiz.subject ?? ""} ${quiz.grade ?? ""}`.toLocaleLowerCase().includes(search)
  );

  if (quizzes.length === 0) {
    return hasActive ? null : (
      <p className="rounded-xl bg-white p-4 text-sm text-[#5b6472]">
        Todavía no tienes pruebas. Usa el botón + para crear una.
      </p>
    );
  }

  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="scan-quiz-list"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-[#d6dce4] bg-white px-4 py-3 text-left text-sm font-semibold text-[#07305f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07305f]"
      >
        {hasActive ? `Cambiar prueba (${quizzes.length})` : `Elegir prueba (${quizzes.length})`}
        <svg className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div id="scan-quiz-list" className="mt-3 overflow-hidden rounded-xl border border-[#e6e8eb] bg-white">
          {quizzes.length > 5 && (
            <div className="border-b border-[#e6e8eb] p-3">
              <input
                type="search"
                aria-label="Buscar prueba"
                placeholder="Buscar por nombre, materia o curso"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-lg border border-[#d6dce4] px-3 py-2 text-sm outline-none focus:border-[#07305f]"
              />
            </div>
          )}
          <div className="max-h-[48dvh] divide-y divide-[#e6e8eb] overflow-y-auto">
            {visible.map((quiz) => (
              <div key={quiz.id} className="flex items-stretch">
                <form action={startScanForQuiz} className="min-w-0 flex-1">
                  <input type="hidden" name="quiz_id" value={quiz.id} />
                  <button className="w-full px-4 py-3 text-left active:bg-[#f4f6f8]">
                    <span className="block truncate text-sm font-semibold text-[#111827]">{quiz.title}</span>
                    <span className="block truncate text-xs text-[#5b6472]">{quiz.subject ?? quiz.grade ?? "Prueba"} · {quiz.num_questions} preguntas</span>
                  </button>
                </form>
                <Link
                  href={parseSheetMode(quiz.sheet_mode) === "compact" ? `/bloque?quiz=${quiz.id}` : `/sheet?quiz=${quiz.id}`}
                  aria-label={`Ver la hoja de respuestas de ${quiz.title}`}
                  className="flex min-w-12 items-center justify-center border-l border-[#e6e8eb] text-[#07305f] active:bg-[#eef4ff]"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" />
                  </svg>
                </Link>
              </div>
            ))}
            {visible.length === 0 && <p className="p-4 text-sm text-[#5b6472]">No hay pruebas con ese nombre.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
