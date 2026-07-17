import { QUIZ_MAX_QUESTIONS } from "@/lib/quiz_constraints";

/**
 * Muestra una clave de respuestas ("ABCABBBA...") como una grilla de chips
 * legible, en vez del string crudo. Reusa el mismo criterio de "pagina fisica"
 * que ya define el tamano de hoja (QUIZ_MAX_QUESTIONS) para segmentar claves
 * largas (multipagina, hasta 400 preguntas) en bloques de 100 con encabezado.
 * Usado tanto en el preview de creacion (AnswerKeyEditor) como en el detalle
 * de solo-lectura de un ensayo ya creado (dashboard/quizzes/[id]).
 */
export function AnswerKeyGrid({
  answerKey,
  numQuestions,
  pageSize = QUIZ_MAX_QUESTIONS,
}: {
  answerKey: string;
  numQuestions: number;
  pageSize?: number;
}) {
  const letters = Array.from({ length: numQuestions }, (_, i) => answerKey[i] ?? "-");
  const pages = Array.from({ length: Math.max(1, Math.ceil(numQuestions / pageSize)) }, (_, p) => {
    const from = p * pageSize;
    const to = Math.min(numQuestions, from + pageSize);
    return { page: p + 1, from, to };
  });
  const isMultipage = pages.length > 1;

  return (
    <div className={isMultipage ? "max-h-[420px] overflow-y-auto pr-1 space-y-4" : "space-y-4"} aria-label="Clave de respuestas">
      {pages.map(({ page, from, to }) => (
        <div key={page}>
          {isMultipage && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
              Página {page} · Preguntas {from + 1}–{to}
            </p>
          )}
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
            {letters.slice(from, to).map((answer, i) => {
              const q = from + i + 1;
              const empty = answer === "-";
              return (
                <div key={q} className="flex flex-col items-center gap-0.5" title={`Pregunta ${q}`}>
                  <span className="text-[9px] font-medium leading-none text-[#9ca3af]">{q}</span>
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                      empty
                        ? "border border-dashed border-[#d8dde3] text-[#9ca3af]"
                        : "bg-[#eef4ff] text-[#07305f]"
                    }`}
                  >
                    {answer}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
