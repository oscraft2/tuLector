"use client";

import { useMemo, useState } from "react";
import { serializeQuestionPoints, type OpenQuestionRubric } from "@/lib/quiz_constraints";
import { ChevronIcon } from "@/components/header/icons";

/**
 * Panel "Puntaje por pregunta" del editor de ensayos. Plegado por defecto: si
 * el profesor no lo abre, todas las preguntas valen 1 punto y el ensayo se
 * corrige exactamente como siempre.
 *
 * Emite tres hidden inputs que lee readQuizScoringFields (src/lib/
 * quiz_scoring_fields.ts): `default_question_points`, `question_points` (solo
 * las que difieren del default) y `score_open_questions`.
 */
export function QuestionPointsPanel({
  questionCount,
  openQuestions,
  multiSelectQuestions,
  rubrics,
  defaultDefaultPoints = "",
  defaultQuestionPoints = {},
  defaultScoreOpen = false,
}: {
  questionCount: number;
  /** Preguntas de desarrollo, 1-indexadas. */
  openQuestions: number[];
  /** Preguntas de seleccion multiple, 1-indexadas. */
  multiSelectQuestions: number[];
  /** Rubricas por pregunta abierta: de aca sale el maximo de cada una. */
  rubrics: Record<number, OpenQuestionRubric>;
  /** quizzes.default_question_points tal como viene de BD ("" o null = 1). */
  defaultDefaultPoints?: string;
  /** quizzes.question_points ya parseado. */
  defaultQuestionPoints?: Record<number, number>;
  defaultScoreOpen?: boolean;
}) {
  const [open, setOpen] = useState(
    () => Object.keys(defaultQuestionPoints).length > 0 || (defaultDefaultPoints !== "" && Number(defaultDefaultPoints) !== 1) || defaultScoreOpen,
  );
  const [defaultPoints, setDefaultPoints] = useState<number>(() => {
    const parsed = Number(String(defaultDefaultPoints).replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });
  // Mismo criterio que el campo "Preguntas" y el "Max. pts" de las rubricas: el
  // texto en edicion vive aparte del numero normalizado, si no el campo no se
  // puede vaciar para reescribirlo (`Number("") || 1` lo repinta al instante).
  const [defaultText, setDefaultText] = useState<string | null>(null);
  const [points, setPoints] = useState<Record<number, number>>(defaultQuestionPoints);
  const [pointsText, setPointsText] = useState<Record<number, string>>({});
  const [scoreOpen, setScoreOpen] = useState(defaultScoreOpen);

  const openSet = useMemo(() => new Set(openQuestions), [openQuestions]);
  const multiSet = useMemo(() => new Set(multiSelectQuestions), [multiSelectQuestions]);
  const closedQuestions = useMemo(
    () => Array.from({ length: questionCount }, (_, i) => i + 1).filter((q) => !openSet.has(q) && !multiSet.has(q)),
    [questionCount, openSet, multiSet],
  );

  const pointsFor = (q: number) => points[q] ?? defaultPoints;

  const closedTotal = useMemo(
    () => closedQuestions.reduce((sum, q) => sum + pointsFor(q), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [closedQuestions, points, defaultPoints],
  );
  const openTotal = useMemo(
    () => (scoreOpen ? openQuestions.reduce((sum, q) => sum + (Number(rubrics[q]?.max_points) || 0), 0) : 0),
    [scoreOpen, openQuestions, rubrics],
  );
  const grandTotal = round2(closedTotal + openTotal);
  const weighted = closedQuestions.some((q) => pointsFor(q) !== 1) || scoreOpen;

  /** Solo se serializan las que DIFIEREN del default (el server hace lo mismo). */
  const serializedOverrides = useMemo(() => {
    const differing: Record<number, number> = {};
    for (const q of closedQuestions) {
      const value = points[q];
      if (value !== undefined && value !== defaultPoints) differing[q] = value;
    }
    return serializeQuestionPoints(differing) ?? "";
  }, [closedQuestions, points, defaultPoints]);

  function updatePoints(q: number, raw: string) {
    if (raw !== "" && !/^\d*[.,]?\d*$/.test(raw)) return;
    setPointsText((prev) => ({ ...prev, [q]: raw }));
    const parsed = Number(raw.replace(",", "."));
    if (raw !== "" && Number.isFinite(parsed) && parsed >= 0) {
      setPoints((prev) => ({ ...prev, [q]: parsed }));
    }
  }

  function commitPoints(q: number) {
    const raw = pointsText[q];
    if (raw !== undefined && raw !== "") {
      const parsed = Number(raw.replace(",", "."));
      if (Number.isFinite(parsed)) setPoints((prev) => ({ ...prev, [q]: Math.max(0, parsed) }));
    }
    setPointsText((prev) => {
      const next = { ...prev };
      delete next[q];
      return next;
    });
  }

  /** "Aplicar a todas": borra los overrides para que no queden pisando el nuevo
   *  valor en silencio -- si no, cambiar el default no cambiaba nada visible. */
  function applyToAll(value: number) {
    setDefaultPoints(value);
    setPoints({});
    setPointsText({});
  }

  return (
    <div className="rounded-md border border-[#e1e5ea] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-[#111827]">Puntaje por pregunta</p>
          <p className="mt-0.5 text-xs text-[#6b7280]">
            {weighted
              ? `Total del ensayo: ${grandTotal} pts${openTotal > 0 ? ` (${round2(closedTotal)} de alternativas + ${round2(openTotal)} de desarrollo)` : ""}`
              : `Todas valen 1 pt · total ${closedQuestions.length} pts`}
          </p>
        </div>
        <ChevronIcon className={`h-4 w-4 shrink-0 text-[#6b7280] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-[#eef0f3] px-4 py-4">
          <p className="text-xs text-[#6b7280]">
            Opcional — por defecto cada pregunta vale 1 punto y la nota se calcula sobre el total de
            preguntas. Si una pregunta vale más, cámbiala aquí: la nota pasa a calcularse sobre el
            <strong> puntaje</strong>, no sobre el número de respuestas correctas.
          </p>

          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#374151]">
            Aplicar el mismo puntaje a todas
            <input
              type="number" min={0} step={0.5} inputMode="decimal"
              value={defaultText ?? String(defaultPoints)}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw !== "" && !/^\d*[.,]?\d*$/.test(raw)) return;
                setDefaultText(raw);
                const parsed = Number(raw.replace(",", "."));
                if (raw !== "" && Number.isFinite(parsed) && parsed >= 0) applyToAll(parsed);
              }}
              onBlur={() => {
                const raw = defaultText;
                if (raw !== null && raw !== "") {
                  const parsed = Number(raw.replace(",", "."));
                  if (Number.isFinite(parsed)) applyToAll(Math.max(0, parsed));
                }
                setDefaultText(null);
              }}
              className="w-16 rounded-md border border-[#cfd6df] bg-white px-2 py-1 text-sm text-[#111827]"
            />
            <span className="text-xs font-normal text-[#9ca3af]">pts (reinicia los puntajes de abajo)</span>
          </label>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
              Preguntas de alternativas ({closedQuestions.length})
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
              {closedQuestions.map((q) => {
                const differs = pointsFor(q) !== defaultPoints;
                return (
                  <label
                    key={q}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1.5 ${differs ? "border-[#f0b429] bg-[#fffbeb]" : "border-[#eef0f3] bg-[#fafbfc]"}`}
                  >
                    <span className="text-[11px] font-bold text-[#6b7280]">P{q}</span>
                    <input
                      type="number" min={0} step={0.5} inputMode="decimal"
                      aria-label={`Puntaje de la pregunta ${q}`}
                      value={pointsText[q] ?? String(pointsFor(q))}
                      onChange={(e) => updatePoints(q, e.target.value)}
                      onBlur={() => commitPoints(q)}
                      className="w-full min-w-0 rounded border border-[#cfd6df] bg-white px-1.5 py-0.5 text-xs text-[#111827]"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {openQuestions.length > 0 && (
            <div className="rounded-md border border-[#eef0f3] bg-[#fafbfc] p-3">
              <label className="flex items-start gap-2 text-sm font-semibold text-[#374151]">
                <input
                  type="checkbox"
                  checked={scoreOpen}
                  onChange={(e) => setScoreOpen(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Sumar las {openQuestions.length} pregunta(s) de desarrollo al puntaje
                  <span className="mt-1 block text-xs font-normal text-[#6b7280]">
                    Cada una aporta el <strong>Máx. pts</strong> de su rúbrica
                    {openTotal > 0 ? ` (${round2(openTotal)} pts en total)` : " (todavía sin puntaje cargado)"}.
                    Ojo: mientras no confirmes el puntaje de una respuesta de desarrollo, esa pregunta
                    <strong> suma 0</strong> y la nota queda más baja de lo real.
                  </span>
                </span>
              </label>
            </div>
          )}

          <p className="text-xs font-semibold text-[#374151]">
            Total del ensayo: {grandTotal} pts
            {openTotal > 0 && ` (${round2(closedTotal)} de alternativas + ${round2(openTotal)} de desarrollo)`}
          </p>
        </div>
      )}

      <input type="hidden" name="default_question_points" value={String(defaultPoints)} />
      <input type="hidden" name="question_points" value={serializedOverrides} />
      {scoreOpen && <input type="hidden" name="score_open_questions" value="on" />}
    </div>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
