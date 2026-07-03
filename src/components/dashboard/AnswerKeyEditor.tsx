"use client";

import { useMemo, useState, useEffect } from "react";
import { QUIZ_ALLOWED_OPTIONS, QUIZ_MAX_QUESTIONS, optionLabelsFor } from "@/lib/quiz_constraints";

export type EvaluationType = "custom" | "paes" | "simce";

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
  const [evalType, setEvalType] = useState<EvaluationType>("custom");
  const [evalVariant, setEvalVariant] = useState<string>("");

  const [value, setValue] = useState(defaultValue.toUpperCase());
  const [questionCount, setQuestionCount] = useState(questions);
  const [optionCount, setOptionCount] = useState(defaultOptions);

  // Auto-configure questions and options when evalType or evalVariant changes
  useEffect(() => {
    if (evalType === "paes") {
      if (evalVariant === "paes_lectora" || evalVariant === "paes_historia" || evalVariant === "paes_ciencias") {
        setQuestionCount(40);
        setOptionCount(5);
      } else if (evalVariant === "paes_m1" || evalVariant === "paes_m2") {
        setQuestionCount(40);
        setOptionCount(4);
      } else {
        // default paes
        setQuestionCount(40);
        setOptionCount(5);
      }
    } else if (evalType === "simce") {
      if (evalVariant === "simce_4b_lectura" || evalVariant === "simce_4b_mate") {
        setQuestionCount(30);
        setOptionCount(4);
      } else {
        // 8° Básico or II Medio
        setQuestionCount(40);
        setOptionCount(4);
      }
    }
  }, [evalType, evalVariant]);

  // Set default variant when type changes
  const handleEvalTypeChange = (type: EvaluationType) => {
    setEvalType(type);
    if (type === "paes") {
      setEvalVariant("paes_m1");
    } else if (type === "simce") {
      setEvalVariant("simce_4b_mate");
    } else {
      setEvalVariant("");
    }
  };

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
      {/* Tipo de Evaluacion */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Tipo de prueba
          <select
            name="evaluation_type"
            value={evalType}
            onChange={(e) => handleEvalTypeChange(e.target.value as EvaluationType)}
            className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal"
          >
            <option value="custom">Personalizado (Manual)</option>
            <option value="paes">PAES (Admisión Superior)</option>
            <option value="simce">SIMCE (Agencia Calidad)</option>
          </select>
        </label>

        {evalType === "paes" && (
          <label className="text-sm font-semibold">
            Variante PAES
            <select
              name="evaluation_variant"
              value={evalVariant}
              onChange={(e) => setEvalVariant(e.target.value)}
              className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal"
            >
              <option value="paes_m1">Competencia Matemática 1 (M1)</option>
              <option value="paes_m2">Competencia Matemática 2 (M2)</option>
              <option value="paes_lectora">Competencia Lectora</option>
              <option value="paes_ciencias">Ciencias</option>
              <option value="paes_historia">Historia y Ciencias Sociales</option>
            </select>
          </label>
        )}

        {evalType === "simce" && (
          <label className="text-sm font-semibold">
            Variante SIMCE
            <select
              name="evaluation_variant"
              value={evalVariant}
              onChange={(e) => setEvalVariant(e.target.value)}
              className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal"
            >
              <option value="simce_4b_mate">4° Básico - Matemática</option>
              <option value="simce_4b_lectura">4° Básico - Lectura</option>
              <option value="simce_8b_mate">8° Básico - Matemática</option>
              <option value="simce_8b_lectura">8° Básico - Lectura</option>
              <option value="simce_2m_mate">II Medio - Matemática</option>
              <option value="simce_2m_lectura">II Medio - Lectura</option>
            </select>
          </label>
        )}
      </div>

      {evalType === "custom" ? (
        <div className="grid gap-3 sm:grid-cols-2">
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
      ) : (
        <div className="rounded-md bg-blue-50/50 border border-blue-100 p-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Configuración de formato automática:</p>
          <p>• Preguntas: <span className="font-bold">{questionCount}</span> (La hoja real tiene más preguntas, pero se reduce a 40 para el lector móvil)</p>
          <p>• Opciones de respuesta: <span className="font-bold">{optionCount} ({labels})</span></p>
          {/* Hidden inputs to send form values when fields are disabled/locked */}
          <input type="hidden" name="num_questions" value={questionCount} />
          <input type="hidden" name="options_per_question" value={optionCount} />
        </div>
      )}

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
      <div className="mt-3 grid grid-cols-5 gap-1 sm:grid-cols-10" aria-label="Vista de clave">
        {preview.map((answer, index) => (
          <span key={index} className="rounded border border-[#e6e8eb] bg-[#f8f9fb] px-2 py-1 text-center text-xs font-semibold">{index + 1}:{answer}</span>
        ))}
      </div>
    </div>
  );
}
