"use client";

import { useMemo, useState } from "react";
import { QUIZ_ALLOWED_OPTIONS, QUIZ_MAX_QUESTIONS, optionLabelsFor } from "@/lib/quiz_constraints";

export function AnswerKeyEditor({
  name = "answer_key",
  questions = 20,
  defaultOptions = 5,
  defaultValue = "",
}: {
  name?: string;
  questions?: number;
  defaultOptions?: number;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue.toUpperCase());
  const [questionCount, setQuestionCount] = useState(questions);
  const [optionCount, setOptionCount] = useState(defaultOptions);
  const labels = optionLabelsFor(optionCount);
  const allowed = useMemo(() => new Set(labels.split("")), [labels]);
  const clean = value
    .toUpperCase()
    .split("")
    .filter((char) => allowed.has(char))
    .join("");
  const valid = clean.length === questionCount;
  const preview = useMemo(() => Array.from({ length: questionCount }, (_, i) => clean[i] ?? "-"), [clean, questionCount]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold">
          Preguntas
          <input
            name="num_questions"
            type="number"
            min="1"
            max={QUIZ_MAX_QUESTIONS}
            value={questionCount}
            onChange={(event) => setQuestionCount(Math.max(1, Math.min(QUIZ_MAX_QUESTIONS, Number(event.target.value) || 1)))}
            className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Opciones
          <select
            name="options_per_question"
            value={optionCount}
            onChange={(event) => setOptionCount(Number(event.target.value))}
            className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal"
          >
            {QUIZ_ALLOWED_OPTIONS.map((count) => (
              <option key={count} value={count}>{count} opciones ({optionLabelsFor(count)})</option>
            ))}
          </select>
        </label>
      </div>
      <input type="hidden" name="option_labels" value={labels.split("").join(",")} />
      <label className="block text-sm font-semibold text-[#111827]" htmlFor={name}>Clave de respuestas</label>
      <input
        id={name}
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value.toUpperCase())}
        className="mt-2 w-full rounded-md border border-[#d8dde3] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#111827]"
        placeholder="ABCDEABCDEABCDEABCDE"
        aria-invalid={!valid}
      />
      <input type="hidden" name={`${name}_clean`} value={clean} />
      <p className={valid ? "mt-2 text-xs text-[#4b5563]" : "mt-2 text-xs font-semibold text-[#b45309]"}>
        {clean.length}/{questionCount} respuestas validas {labels}.
      </p>
      <div className="mt-3 grid grid-cols-10 gap-1" aria-label="Vista de clave">
        {preview.map((answer, index) => (
          <span key={index} className="rounded border border-[#e6e8eb] bg-[#f8f9fb] px-2 py-1 text-center text-xs font-semibold">{index + 1}:{answer}</span>
        ))}
      </div>
    </div>
  );
}
