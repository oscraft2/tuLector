"use client";

import { useRef, useState } from "react";
import { QUIZ_MAX_QUESTIONS } from "@/lib/quiz_constraints";

/**
 * Muestra una clave de respuestas ("ABCABBBA...") como una grilla de chips
 * legible, en vez del string crudo. Reusa el mismo criterio de "pagina fisica"
 * que ya define el tamano de hoja (QUIZ_MAX_QUESTIONS) para segmentar claves
 * largas (multipagina, hasta 400 preguntas) en bloques de 100 con encabezado.
 *
 * Modo editable (cuando se pasan `optionLabels` + `onAnswerChange`): cada
 * chip es un boton enfocable. Click o Tab selecciona una pregunta; click en
 * los botones grandes de letra debajo, o presionar la tecla de esa letra,
 * la aplica y avanza el foco a la siguiente (flujo tipo "corregir al reves").
 * Flechas izquierda/derecha mueven la seleccion; Backspace/Delete borra.
 * Sin `onAnswerChange`, se comporta igual que antes: puramente de solo
 * lectura (usado en el detalle de un ensayo ya creado).
 */
export function AnswerKeyGrid({
  answerKey,
  numQuestions,
  pageSize = QUIZ_MAX_QUESTIONS,
  optionLabels,
  onAnswerChange,
}: {
  answerKey: string;
  numQuestions: number;
  pageSize?: number;
  optionLabels?: string;
  onAnswerChange?: (index: number, letter: string) => void;
}) {
  const editable = Boolean(onAnswerChange && optionLabels);
  const [selected, setSelected] = useState<number | null>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const letters = Array.from({ length: numQuestions }, (_, i) => answerKey[i] ?? "-");
  const pages = Array.from({ length: Math.max(1, Math.ceil(numQuestions / pageSize)) }, (_, p) => {
    const from = p * pageSize;
    const to = Math.min(numQuestions, from + pageSize);
    return { page: p + 1, from, to };
  });
  const isMultipage = pages.length > 1;

  function focusIndex(index: number) {
    const clamped = Math.max(0, Math.min(numQuestions - 1, index));
    setSelected(clamped);
    const el = cellRefs.current[clamped];
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
  }

  function applyLetter(index: number, letter: string) {
    onAnswerChange?.(index, letter);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!editable) return;
    const key = event.key.toUpperCase();
    if (optionLabels && optionLabels.includes(key)) {
      event.preventDefault();
      applyLetter(index, key);
      focusIndex(index + 1);
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      applyLetter(index, "");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusIndex(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusIndex(index - 1);
    }
  }

  return (
    <div className="space-y-3">
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
                const q = from + i;
                const empty = answer === "-";
                const isSelected = selected === q;
                const chip = (
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition ${
                      empty
                        ? "border border-dashed border-[#d8dde3] text-[#9ca3af]"
                        : "bg-[#eef4ff] text-[#07305f]"
                    } ${isSelected ? "ring-2 ring-[#111827] ring-offset-1" : ""}`}
                  >
                    {answer}
                  </span>
                );
                return (
                  <div key={q} className="flex flex-col items-center gap-0.5" title={`Pregunta ${q + 1}`}>
                    <span className="text-[9px] font-medium leading-none text-[#9ca3af]">{q + 1}</span>
                    {editable ? (
                      <button
                        type="button"
                        ref={(el) => { cellRefs.current[q] = el; }}
                        onClick={() => focusIndex(q)}
                        onFocus={() => setSelected(q)}
                        onKeyDown={(event) => handleKeyDown(event, q)}
                        aria-label={`Pregunta ${q + 1}, respuesta ${empty ? "sin definir" : answer}`}
                        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#111827]"
                      >
                        {chip}
                      </button>
                    ) : (
                      chip
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {editable && optionLabels && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#eef0f3] bg-[#f8fafc] p-2.5">
          <span className="text-xs font-semibold text-[#6b7280]">
            {selected === null ? "Elige una pregunta arriba" : `Pregunta ${selected + 1}:`}
          </span>
          {optionLabels.split("").map((letter) => (
            <button
              key={letter}
              type="button"
              disabled={selected === null}
              onClick={() => {
                if (selected === null) return;
                applyLetter(selected, letter);
                focusIndex(selected + 1);
              }}
              className="grid h-9 w-9 place-items-center rounded-md border border-[#cfd6df] bg-white text-sm font-bold text-[#111827] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {letter}
            </button>
          ))}
          <button
            type="button"
            disabled={selected === null}
            onClick={() => {
              if (selected === null) return;
              applyLetter(selected, "");
            }}
            className="rounded-md border border-[#cfd6df] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#6b7280] transition hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Borrar
          </button>
        </div>
      )}
    </div>
  );
}
