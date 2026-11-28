"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { DataTable } from "@/components/dashboard/DataTable";
import { QuizRowActions } from "@/components/dashboard/QuizRowActions";
import { getSubjectVisual } from "@/lib/subject_visuals";

export type QuizListItem = {
  id: string;
  title: string;
  subject: string | null;
  courseLabel: string;
  formatLabel: string;
  createdLabel: string;
  sheetHref: string;
  sheetLabel: string;
  keyIncomplete: boolean;
  sharedByLabel: string | null;
  isOwner: boolean;
  hasPapers: boolean;
  papersCount: number;
};

type ActionFn = (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;

export function QuizzesTableClient({
  quizzes,
  isAdmin,
  startScanAction,
  duplicateAction,
  archiveAction,
}: {
  quizzes: QuizListItem[];
  isAdmin: boolean;
  startScanAction: (formData: FormData) => Promise<void>;
  duplicateAction: ActionFn;
  archiveAction: ActionFn;
}) {
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  const subjects = useMemo(
    () =>
      [...new Set(quizzes.map((q) => q.subject).filter((s): s is string => Boolean(s)))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [quizzes],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return quizzes.filter((quiz) => {
      if (subjectFilter && quiz.subject !== subjectFilter) return false;
      if (!term) return true;
      return (
        quiz.title.toLowerCase().includes(term) ||
        (quiz.subject ?? "").toLowerCase().includes(term) ||
        quiz.courseLabel.toLowerCase().includes(term)
      );
    });
  }, [quizzes, query, subjectFilter]);

  const hasFilters = Boolean(query.trim() || subjectFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e7e5df] bg-white px-4 py-3 shadow-xs">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#78716c]" aria-hidden="true">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, asignatura o curso…"
            aria-label="Filtrar ensayos"
            className="w-full rounded-lg border border-[#d6d3cb] bg-[#faf9f6] py-1.5 pl-9 pr-3 text-sm text-[#1c1917] placeholder:text-[#78716c] outline-none focus:border-[#07305f] focus:bg-white"
          />
        </div>

        {subjects.length > 0 && (
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            aria-label="Filtrar por asignatura"
            className="rounded-lg border border-[#d6d3cb] bg-white px-3 py-1.5 text-sm text-[#1c1917] outline-none focus:border-[#07305f]"
          >
            <option value="">Todas las asignaturas</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSubjectFilter("");
            }}
            className="rounded-lg border border-[#d6d3cb] px-3 py-1.5 text-xs font-semibold text-[#57534e] hover:bg-[#faf9f6]"
          >
            Limpiar
          </button>
        )}

        <span className="tnum ml-auto text-xs font-medium text-[#78716c]">
          {filtered.length} ensayo{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <DataTable
        columns={["Ensayo", "Curso", "Formato", "Lecturas", "Creado", "Acciones"]}
        rows={filtered}
        empty={hasFilters ? "Ningún ensayo coincide con la búsqueda." : "Todavía no hay ensayos creados en el establecimiento."}
        renderRow={(quiz) => {
          const visual = getSubjectVisual(quiz.subject);
          return (
            <tr key={quiz.id} className="border-b border-[#efede8] last:border-0">
              <td className="px-5 py-3.5">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm ${visual.badgeClass}`}
                  >
                    {visual.emoji}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/quizzes/${quiz.id}`}
                      className="font-semibold text-[#1c1917] hover:text-[#07305f] hover:underline"
                    >
                      {quiz.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#78716c]">
                      <span>{quiz.subject ?? "Sin asignatura"}</span>
                      {quiz.keyIncomplete && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Clave incompleta
                        </span>
                      )}
                      {quiz.sharedByLabel && (
                        <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-semibold text-[#07305f]">
                          Compartido por {quiz.sharedByLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5">
                <span className="rounded-md bg-[#f4f2ec] px-2.5 py-1 text-xs font-semibold text-[#44403c]">
                  {quiz.courseLabel}
                </span>
              </td>
              <td className="tnum px-5 py-3.5 text-[#57534e]">{quiz.formatLabel}</td>
              <td className="tnum px-5 py-3.5 text-[#57534e]">{quiz.papersCount}</td>
              <td className="tnum px-5 py-3.5 text-xs text-[#78716c]">{quiz.createdLabel}</td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Link
                    href={quiz.sheetHref}
                    className="rounded-lg border border-[#d6d3cb] bg-white px-3 py-1.5 text-xs font-semibold text-[#1c1917] hover:bg-[#faf9f6]"
                  >
                    {quiz.sheetLabel}
                  </Link>
                  <form action={startScanAction}>
                    <input type="hidden" name="quiz_id" value={quiz.id} />
                    <button className="rounded-lg bg-[#07305f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#062447]">
                      Escanear
                    </button>
                  </form>
                  <QuizRowActions
                    quizId={quiz.id}
                    quizTitle={quiz.title}
                    hasPapers={quiz.hasPapers}
                    isAdmin={isAdmin}
                    isOwner={quiz.isOwner}
                    duplicateAction={duplicateAction}
                    archiveAction={archiveAction}
                  />
                </div>
              </td>
            </tr>
          );
        }}
        renderMobileRow={(quiz) => {
          const visual = getSubjectVisual(quiz.subject);
          return (
            <article key={quiz.id} className="rounded-xl border border-[#e7e5df] bg-white p-4 shadow-xs">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base ${visual.badgeClass}`}
                >
                  {visual.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/quizzes/${quiz.id}`} className="block truncate text-base font-semibold text-[#07305f] hover:underline">
                    {quiz.title}
                  </Link>
                  <p className="text-xs text-[#78716c]">{quiz.subject ?? "Sin asignatura"}</p>
                </div>
              </div>

              {(quiz.keyIncomplete || quiz.sharedByLabel) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {quiz.keyIncomplete && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      Clave incompleta
                    </span>
                  )}
                  {quiz.sharedByLabel && (
                    <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-semibold text-[#07305f]">
                      Compartido por {quiz.sharedByLabel}
                    </span>
                  )}
                </div>
              )}

              <div className="tnum mt-3 grid grid-cols-2 gap-2 text-xs text-[#57534e]">
                <p>
                  <span className="font-semibold text-[#1c1917]">Curso:</span> {quiz.courseLabel}
                </p>
                <p>
                  <span className="font-semibold text-[#1c1917]">Formato:</span> {quiz.formatLabel}
                </p>
                <p>
                  <span className="font-semibold text-[#1c1917]">Lecturas:</span> {quiz.papersCount}
                </p>
                <p>
                  <span className="font-semibold text-[#1c1917]">Creado:</span> {quiz.createdLabel}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={quiz.sheetHref}
                  className="rounded-lg border border-[#d6d3cb] bg-white px-3 py-2 text-xs font-semibold text-[#1c1917] hover:bg-[#faf9f6]"
                >
                  {quiz.sheetLabel}
                </Link>
                <form action={startScanAction}>
                  <input type="hidden" name="quiz_id" value={quiz.id} />
                  <button className="rounded-lg bg-[#07305f] px-3 py-2 text-xs font-semibold text-white hover:bg-[#062447]">
                    Escanear
                  </button>
                </form>
                <div className="ml-auto">
                  <QuizRowActions
                    quizId={quiz.id}
                    quizTitle={quiz.title}
                    hasPapers={quiz.hasPapers}
                    isAdmin={isAdmin}
                    isOwner={quiz.isOwner}
                    duplicateAction={duplicateAction}
                    archiveAction={archiveAction}
                  />
                </div>
              </div>
            </article>
          );
        }}
      />
    </div>
  );
}
