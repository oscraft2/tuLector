"use client";

import { useMemo, useState, useRef } from "react";
import {
  QUIZ_ALLOWED_OPTIONS, QUIZ_MAX_QUESTIONS, QUIZ_MAX_QUESTIONS_MULTIPAGE, optionLabelsFor,
  normalizeAnswerKeySlots, parseAnswerKeyImport,
  parseOpenQuestions, serializeOpenQuestions, parseOptionOverrides, serializeOptionOverrides,
  parseMultiSelectQuestions, serializeMultiSelectQuestions, parseOpenQuestionRubrics, serializeOpenQuestionRubrics,
  parseQuestionPoints, serializeQuestionPoints, parseZeroPointQuestions,
  type OpenQuestionRubric, type OpenQuestionSubtype,
} from "@/lib/quiz_constraints";
import { resolveCountryProfile } from "@/lib/country_profiles";
import { DIA_PRESETS, DIA_CUSTOM_ID, findDiaPreset, mergePresetRubrics, type DiaPreset } from "@/lib/dia_presets";
import { AnswerKeyGrid } from "@/components/dashboard/AnswerKeyGrid";
import { AnswerKeyFromSheet } from "@/components/dashboard/AnswerKeyFromSheet";
import { QuestionPointsPanel } from "@/components/dashboard/QuestionPointsPanel";
import { ChevronIcon } from "@/components/header/icons";

export type EvaluationType = "custom" | "paes" | "simce" | "dia";

const PAES_PRESETS: Record<string, { questions: number; scored: number; pilots: number; options: 4 | 5; mixedOptions?: boolean }> = {
  paes_m1: { questions: 65, scored: 60, pilots: 5, options: 4 },
  paes_m2: { questions: 55, scored: 50, pilots: 5, options: 4, mixedOptions: true },
  paes_lectora: { questions: 65, scored: 60, pilots: 5, options: 4 },
  paes_ciencias: { questions: 80, scored: 75, pilots: 5, options: 4, mixedOptions: true },
  paes_historia: { questions: 65, scored: 60, pilots: 5, options: 4 },
};

export function AnswerKeyEditor({
  name = "answer_key",
  questions = 20,
  defaultOptions = 5,
  defaultValue = "",
  defaultOpenQuestions = "",
  defaultOptionOverrides = "",
  defaultMultiSelectQuestions = "",
  defaultOpenQuestionRubrics = "",
  defaultDefaultQuestionPoints = "",
  defaultQuestionPoints = "",
  defaultScoreOpenQuestions = false,
  defaultEvaluationType = "",
  defaultEvaluationVariant = "",
  countryCode = "CL",
}: {
  name?: string;
  questions?: number;
  defaultOptions?: number;
  defaultValue?: string;
  /** CSV de preguntas de desarrollo ("18,27,33") tal como viene de BD. */
  defaultOpenQuestions?: string;
  /** CSV de overrides de opciones por pregunta ("20:3,29:6") tal como viene de BD. */
  defaultOptionOverrides?: string;
  /** CSV de preguntas de seleccion multiple ("29") tal como viene de BD. */
  defaultMultiSelectQuestions?: string;
  /** JSON-string de rubricas por pregunta abierta tal como viene de BD. */
  defaultOpenQuestionRubrics?: string;
  /** quizzes.default_question_points tal como viene de BD ("" = 1 pt). */
  defaultDefaultQuestionPoints?: string;
  /** quizzes.question_points ("3:2,7:0.5") tal como viene de BD. */
  defaultQuestionPoints?: string;
  /** quizzes.score_open_questions tal como viene de BD. */
  defaultScoreOpenQuestions?: boolean;
  /** quizzes.evaluation_type tal como viene de BD ('custom'|'paes'|'simce'). */
  defaultEvaluationType?: string;
  /** quizzes.evaluation_variant tal como viene de BD ('paes_m1', 'dia_5b_lectura'...). */
  defaultEvaluationVariant?: string;
  countryCode?: string;
}) {
  // El tipo arranca en el que el ensayo YA tiene. Antes era `useState("custom")`
  // fijo: al editar un ensayo PAES el formulario abria en "Personalizado" y al
  // guardar escribia evaluation_type='custom', degradandolo en silencio -- el
  // puntaje PAES/SIMCE desaparecia de la tabla de resultados y nadie entendia
  // por que. Un ensayo DIA guarda 'custom' en la BD (la columna tiene un CHECK
  // cerrado) y se reconoce por su variante, por eso el caso aparte.
  const [evalType, setEvalType] = useState<EvaluationType>(() => {
    if (defaultEvaluationVariant?.startsWith("dia")) return "dia";
    if (defaultEvaluationType === "paes" || defaultEvaluationType === "simce") return defaultEvaluationType;
    return "custom";
  });
  const [evalVariant, setEvalVariant] = useState<string>(defaultEvaluationVariant ?? "");
  // PAES/SIMCE (con formula propia de puntaje 100-1000/100-400) son especificos
  // de Chile. Otros paises usan los sistemas de evaluacion de su propio perfil
  // (country_profiles.ts) como ETIQUETA (evaluation_type sigue "custom", puntaje
  // por porcentaje simple — ver equivalentScore en api/scan/result/route.ts).
  const countryProfile = resolveCountryProfile(countryCode);
  const isChile = countryProfile.code === "CL";

  const [value, setValue] = useState(defaultValue.toUpperCase());
  const [questionCount, setQuestionCount] = useState(questions);
  // Texto EN EDICION del campo "Preguntas". null = mostrar el valor normalizado
  // (questionCount), que es lo habitual; un string = lo que el profesor esta
  // tecleando ahora mismo, incluido el vacio.
  //
  // Sin esta separacion el input era controlado directamente por el numero ya
  // normalizado: al borrar el digito, `Number("") || 1` devolvia 1 y el campo
  // repintaba "1" al instante, asi que era imposible vaciarlo para escribir
  // otro numero. Los presets (PAES/SIMCE/DIA) siguen llamando solo a
  // setQuestionCount y el campo los refleja solo, porque fuera de edicion este
  // estado vale null.
  const [questionsText, setQuestionsText] = useState<string | null>(null);
  // Mismo problema y misma solucion para el "Máx. pts" de cada rubrica, por
  // pregunta: la entrada existe solo mientras ese campo se esta editando.
  const [rubricPointsText, setRubricPointsText] = useState<Record<number, string>>({});
  const [optionCount, setOptionCount] = useState(defaultOptions);
  const [openText, setOpenText] = useState(defaultOpenQuestions);
  const [overridesText, setOverridesText] = useState(defaultOptionOverrides);
  const [multiText, setMultiText] = useState(defaultMultiSelectQuestions);
  const [rubrics, setRubrics] = useState<Record<number, OpenQuestionRubric>>(() => parseOpenQuestionRubrics(defaultOpenQuestionRubrics));
  const [rubricPanelOpen, setRubricPanelOpen] = useState(() => Object.values(parseOpenQuestionRubrics(defaultOpenQuestionRubrics)).some((r) => r.rubric.trim().length > 0));
  // Puntaje por pregunta ya guardado ("3:2,7:0.5"): se parsea una sola vez, el
  // panel lo toma como estado inicial y desde ahi maneja lo suyo.
  const initialQuestionPoints = useMemo(
    () => parseQuestionPoints(defaultQuestionPoints, QUIZ_MAX_QUESTIONS_MULTIPAGE),
    [defaultQuestionPoints],
  );
  const initialZeroPilots = useMemo(
    () => parseZeroPointQuestions(defaultQuestionPoints, questions, defaultDefaultQuestionPoints || 1),
    [defaultQuestionPoints, questions, defaultDefaultQuestionPoints],
  );
  const hasCustomNonZeroWeights = useMemo(() => {
    const parsedDefault = Number(String(defaultDefaultQuestionPoints || "1").replace(",", "."));
    const hasCustomDefault = Number.isFinite(parsedDefault) && parsedDefault !== 1;
    const hasNonZeroOverride = Object.values(initialQuestionPoints).some((pts) => pts !== 0);
    return hasCustomDefault || hasNonZeroOverride || defaultScoreOpenQuestions;
  }, [defaultDefaultQuestionPoints, initialQuestionPoints, defaultScoreOpenQuestions]);

  const initialIsPaes = defaultEvaluationType === "paes" && !defaultEvaluationVariant?.startsWith("dia");
  const initialPaesPreset = initialIsPaes
    ? (PAES_PRESETS[defaultEvaluationVariant ?? ""] ?? PAES_PRESETS.paes_m1)
    : PAES_PRESETS.paes_m1;
  const [includePilots, setIncludePilots] = useState<boolean>(() => {
    if (!initialIsPaes) return true;
    return initialZeroPilots.length > 0 || questions === initialPaesPreset.questions;
  });
  const [pilotMode, setPilotMode] = useState<"exclude" | "score_all">(() => {
    if (!initialIsPaes) return "exclude";
    if (initialZeroPilots.length > 0) return "exclude";
    if (questions === initialPaesPreset.questions && defaultValue.length > 0) return "score_all";
    return "exclude";
  });
  const [pilotsText, setPilotsText] = useState<string>(() =>
    initialZeroPilots.length > 0 ? initialZeroPilots.join(", ") : "",
  );
  const [importPanel, setImportPanel] = useState<"none" | "paste" | "scan">("none");
  const [pasteDraft, setPasteDraft] = useState("");
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [allowPartial, setAllowPartial] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lastPresetRef = useRef<DiaPreset | undefined>(defaultEvaluationVariant ? findDiaPreset(defaultEvaluationVariant) : undefined);

  const applyPaesPreset = (variant: string, withPilots = includePilots) => {
    const preset = PAES_PRESETS[variant] ?? PAES_PRESETS.paes_m1;
    setQuestionsText(null);
    setQuestionCount(withPilots ? preset.questions : preset.scored);
    setOptionCount(preset.options);
  };

  const applyDiaPreset = (variant: string) => {
    const preset = findDiaPreset(variant);
    if (!preset) return;
    setQuestionsText(null);
    setQuestionCount(preset.numQuestions);
    setOptionCount(preset.numOptions);
    setOpenText(preset.openQuestions);
    setOverridesText(preset.optionOverrides);
    setMultiText(preset.multiSelectQuestions);
    if (preset.answerKey) setValue(preset.answerKey.toUpperCase());
    const openQs = parseOpenQuestions(preset.openQuestions, preset.numQuestions);
    const previousPreset = lastPresetRef.current;
    lastPresetRef.current = preset;
    setRubrics((prev) => mergePresetRubrics(prev, openQs, preset, previousPreset));
  };

  const handleEvalTypeChange = (type: EvaluationType) => {
    setEvalType(type);
    if (type === "paes") {
      const variant = "paes_m1";
      setEvalVariant(variant);
      setOpenText("");
      setMultiText("");
      setOverridesText("");
      setRubrics({});
      setRubricPanelOpen(false);
      setIncludePilots(true);
      setPilotMode("exclude");
      setPilotsText("");
      applyPaesPreset(variant, true);
    } else if (type === "simce") {
      const variant = "simce_4b_mate";
      setEvalVariant(variant);
      setQuestionsText(null);
      setQuestionCount(30);
      setOptionCount(4);
    } else if (type === "dia") {
      const variant = DIA_PRESETS[0].id;
      setEvalVariant(variant);
      applyDiaPreset(variant);
    } else {
      setEvalVariant("");
    }
  };

  const handleEvalVariantChange = (variant: string) => {
    setEvalVariant(variant);
    if (evalType === "paes") {
      applyPaesPreset(variant, includePilots);
    } else if (evalType === "simce") {
      setQuestionsText(null);
      setQuestionCount(variant === "simce_4b_lectura" || variant === "simce_4b_mate" ? 30 : 40);
      setOptionCount(4);
    } else if (evalType === "dia") {
      applyDiaPreset(variant);
    }
  };

  const handleToggleIncludePilots = (next: boolean) => {
    setIncludePilots(next);
    const preset = PAES_PRESETS[evalVariant] ?? PAES_PRESETS.paes_m1;
    setQuestionsText(null);
    setQuestionCount(next ? preset.questions : preset.scored);
    if (!next) setPilotsText("");
  };

  const isPaes = evalType === "paes";
  const activePaesPreset = isPaes ? (PAES_PRESETS[evalVariant] ?? PAES_PRESETS.paes_m1) : null;

  // Valor real que se envia en el campo `evaluation_type` de la BD -- esa
  // columna tiene un CHECK ('custom'|'paes'|'simce'), asi que "dia" NUNCA se
  // manda ahi (rompería el insert/update). Mismo patron que ya usan los
  // paises no-Chile: el tipo real queda "custom" (puntaje = % simple, sin
  // formula PAES/SIMCE) y la etiqueta "DIA" vive en `evaluation_variant`
  // (texto libre, sin restriccion) -- ver getVariantLabel() en
  // dashboard/quizzes/[id]/page.tsx para donde se muestra esa etiqueta.
  const evaluationTypeToSubmit = evalType === "dia" ? "custom" : evalType;

  const labels = optionLabelsFor(optionCount);
  // "slots": representacion posicional de la clave, siempre exactamente
  // questionCount caracteres, cada uno una letra valida o "-" (pregunta
  // todavia sin responder). Se deriva del texto libre (value) tomando solo
  // caracteres validos en orden y rellenando con "-" -- typear sigue
  // funcionando igual que antes (llena secuencial desde la pregunta 1); la
  // grilla edita una posicion puntual reescribiendo value completo.
  // Preguntas de desarrollo (abiertas): 1-indexadas para el server action y la
  // hoja; 0-indexadas (openSet0) para la grilla y los slots. Su slot de clave
  // queda "-" bloqueado (una abierta nunca tiene letra correcta).
  /** Lo que se pinta en el campo: el texto en edicion, o el valor normalizado. */
  const questionsValue = questionsText ?? String(questionCount);

  /** Acepta vacio y digitos; solo propaga al numero cuando ya es valido. */
  const handleQuestionsChange = (raw: string, max: number) => {
    if (raw !== "" && !/^\d+$/.test(raw)) return; // ignora letras, signos y decimales
    setQuestionsText(raw);
    const parsed = Number(raw);
    if (raw !== "" && Number.isInteger(parsed) && parsed >= 1 && parsed <= max) {
      setQuestionCount(parsed);
    }
  };

  /** Al salir del campo se normaliza: vacio o fuera de rango vuelve a un valor valido. */
  const handleQuestionsBlur = (max: number) => {
    const parsed = Number(questionsText);
    if (questionsText !== null && questionsText !== "" && Number.isFinite(parsed)) {
      setQuestionCount(Math.max(1, Math.min(max, Math.round(parsed))));
    }
    setQuestionsText(null); // vuelve a mostrar el valor normalizado
  };

  const openQuestions = useMemo(() => (isPaes ? [] : parseOpenQuestions(openText, questionCount)), [isPaes, openText, questionCount]);
  const openSet0 = useMemo(() => new Set(openQuestions.map((q) => q - 1)), [openQuestions]);
  const optionOverrides = useMemo(() => parseOptionOverrides(overridesText, questionCount), [overridesText, questionCount]);
  const multiSelectQuestions = useMemo(() => (isPaes ? [] : parseMultiSelectQuestions(multiText, questionCount)), [isPaes, multiText, questionCount]);
  const multiSet0 = useMemo(() => new Set(multiSelectQuestions.map((q) => q - 1)), [multiSelectQuestions]);
  const multiOverlapsOpen = useMemo(() => multiSelectQuestions.some((q) => openSet0.has(q - 1)), [multiSelectQuestions, openSet0]);
  const rubricCount = useMemo(() => openQuestions.filter((q) => (rubrics[q]?.rubric ?? "").trim().length > 0).length, [openQuestions, rubrics]);
  // "No corregibles automaticamente" = abiertas + seleccion multiple (una letra
  // no representa "que subconjunto es correcto") -- mismo tratamiento que el
  // server (dashboard/actions.ts) y computeQuizScore (src/lib/grading.ts).
  const unscoredSet0 = useMemo(() => new Set([...openSet0, ...multiSet0]), [openSet0, multiSet0]);

  const pilotQuestions = useMemo(
    () => (isPaes && includePilots && pilotMode === "exclude" ? parseOpenQuestions(pilotsText, questionCount) : []),
    [isPaes, includePilots, pilotMode, pilotsText, questionCount],
  );
  const pilotSet0 = useMemo(() => new Set(pilotQuestions.map((q) => q - 1)), [pilotQuestions]);
  const serializedPilotPoints = useMemo(() => {
    if (pilotQuestions.length === 0) return "";
    const map: Record<number, number> = {};
    for (const q of pilotQuestions) map[q] = 0;
    return serializeQuestionPoints(map) ?? "";
  }, [pilotQuestions]);

  const slots = useMemo(() => {
    const normalized = normalizeAnswerKeySlots(value, optionCount, questionCount, optionOverrides);
    if (unscoredSet0.size === 0) return normalized;
    const chars = normalized.split("");
    for (const i of unscoredSet0) if (i < chars.length) chars[i] = "-";
    return chars.join("");
  }, [value, optionCount, questionCount, optionOverrides, unscoredSet0]);

  let requiredCount = 0;
  let filledRequiredCount = 0;
  for (let i = 0; i < questionCount; i++) {
    if (unscoredSet0.has(i) || pilotSet0.has(i)) continue;
    requiredCount++;
    if (slots[i] !== "-") filledRequiredCount++;
  }
  const closedCount = questionCount - unscoredSet0.size;
  const valid = filledRequiredCount === requiredCount;

  function handleTogglePilot(index: number) {
    const q = index + 1;
    const next = new Set(pilotQuestions);
    if (next.has(q)) next.delete(q);
    else next.add(q);
    setPilotsText([...next].sort((a, b) => a - b).join(", "));
  }

  function handleGridAnswerChange(index: number, letter: string) {
    if (unscoredSet0.has(index)) return; // desarrollo/seleccion multiple: slot bloqueado
    const chars = slots.split("");
    chars[index] = letter || "-";
    setValue(chars.join(""));
  }

  function applyImportedKey(rawText: string): boolean {
    const imported = parseAnswerKeyImport(rawText, {
      numQuestions: questionCount,
      numOptions: optionCount,
      optionOverrides,
      allowAutoOption5: isPaes,
    });
    if (imported.importedCount === 0) {
      setFileError("No se encontraron respuestas válidas en el texto o archivo.");
      setImportNotice(null);
      return false;
    }
    setFileError(null);
    setValue(imported.slots);
    const extraEntries = Object.entries(imported.extraOptionOverrides);
    if (extraEntries.length > 0) {
      const merged = { ...optionOverrides, ...imported.extraOptionOverrides };
      setOverridesText(
        Object.entries(merged)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([q, n]) => `${q}:${n}`)
          .join(", "),
      );
    }
    if (isPaes && imported.pilots.length > 0) {
      setIncludePilots(true);
      setPilotMode("exclude");
      setPilotsText(imported.pilots.join(", "));
    }
    const parts = [`✓ ${imported.importedCount} ítem(s) cargados`];
    if (isPaes && imported.pilots.length > 0) parts.push(`${imported.pilots.length} piloto (*)`);
    if (extraEntries.length > 0) parts.push(`${extraEntries.length} pregunta(s) con 5 opciones (E)`);
    setImportNotice(parts.join(" · "));
    return true;
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setImportNotice(null);
    try {
      let text = "";
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], { header: 1 });
        text = rows.map((row) => (Array.isArray(row) ? row.join("\t") : "")).join("\n");
      } else {
        text = await file.text();
      }
      applyImportedKey(text);
    } catch {
      setFileError("No se pudo leer el archivo. Prueba con CSV, TXT o XLSX.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {/* Tipo de Evaluacion */}
      <div className="grid gap-3 sm:grid-cols-2">
        {isChile ? (
          <label className="text-sm font-semibold">
            Tipo de prueba
            <select
              value={evalType}
              onChange={(e) => handleEvalTypeChange(e.target.value as EvaluationType)}
              className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal"
            >
              <option value="custom">Personalizado (Manual)</option>
              <option value="paes">PAES (Admisión Superior)</option>
              <option value="simce">SIMCE (Agencia Calidad)</option>
              <option value="dia">Generar prueba DIA (Diagnóstico Integral)</option>
            </select>
            <input type="hidden" name="evaluation_type" value={evaluationTypeToSubmit} />
          </label>
        ) : (
          <>
            <input type="hidden" name="evaluation_type" value="custom" />
            <label className="text-sm font-semibold">
              Sistema de evaluación (opcional)
              <select
                name="evaluation_variant"
                value={evalVariant}
                onChange={(e) => setEvalVariant(e.target.value)}
                className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal"
              >
                <option value="">Personalizado (sin sistema)</option>
                {countryProfile.evaluationSystems.map((sys) => (
                  <option key={sys} value={sys}>{sys.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>
          </>
        )}

        {isChile && evalType === "paes" && (
          <label className="text-sm font-semibold">
            Variante PAES
            <select
              name="evaluation_variant"
              value={evalVariant}
              onChange={(e) => handleEvalVariantChange(e.target.value)}
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

        {isChile && evalType === "simce" && (
          <label className="text-sm font-semibold">
            Variante SIMCE
            <select
              name="evaluation_variant"
              value={evalVariant}
              onChange={(e) => handleEvalVariantChange(e.target.value)}
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

        {isChile && evalType === "dia" && (
          <label className="text-sm font-semibold">
            Instrumento DIA
            <select
              name="evaluation_variant"
              value={evalVariant}
              onChange={(e) => handleEvalVariantChange(e.target.value)}
              className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal"
            >
              <optgroup label="Evaluación de Cierre 2026 (Finales)">
                {DIA_PRESETS.filter((p) => p.stage === "cierre").map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </optgroup>
              <optgroup label="Monitoreo Intermedio 2026">
                {DIA_PRESETS.filter((p) => p.stage !== "cierre").map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </optgroup>
              <option value={DIA_CUSTOM_ID}>Otro nivel/asignatura (config manual)</option>
            </select>
          </label>
        )}
      </div>

      {evalType === "dia" && (
        <div className="rounded-md bg-blue-50/50 border border-blue-100 p-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Ensayo para DIA (Diagnóstico Integral de Aprendizajes):</p>
          <p>• Puntaje = porcentaje de acierto simple (no aplica formula PAES/SIMCE).</p>
          {findDiaPreset(evalVariant) ? (
            <p>• Preguntas, opciones, desarrollo{multiSelectQuestions.length > 0 ? " y selección múltiple" : ""} ya vienen precargados para <strong>{findDiaPreset(evalVariant)?.label}</strong> ({findDiaPreset(evalVariant)?.stage === "cierre" ? "Evaluación de Cierre 2026" : "Monitoreo Intermedio 2026"}) — puedes ajustarlos igual si el instrumento real de tu curso difiere.</p>
          ) : (
            <p>• Ajusta preguntas/opciones según el instrumento real de DIA para ese nivel — puedes configurarlo a mano si tu instrumento difiere.</p>
          )}
          <p>• Si el instrumento tiene preguntas de <strong>respuesta construida (desarrollo)</strong>, indícalas abajo en &ldquo;Preguntas de desarrollo&rdquo;: la hoja las imprime como &ldquo;Resolver al reverso&rdquo; con su recuadro atrás, y no cuentan en el puntaje automático.</p>
          <p>• Al exportar, el <strong>curso</strong> de este ensayo debe coincidir con el curso real en la plataforma DIA (revisa el formato en &ldquo;Exportar Formato Pruebas DIA&rdquo;).</p>
        </div>
      )}
      {evalType === "custom" || evalType === "dia" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Preguntas
            <input
              name="num_questions"
              type="number"
              inputMode="numeric"
              min="1"
              max={QUIZ_MAX_QUESTIONS_MULTIPAGE}
              value={questionsValue}
              onChange={(event) => handleQuestionsChange(event.target.value, QUIZ_MAX_QUESTIONS_MULTIPAGE)}
              onBlur={() => handleQuestionsBlur(QUIZ_MAX_QUESTIONS_MULTIPAGE)}
              className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal"
            />
            {questionCount > QUIZ_MAX_QUESTIONS && (
              <span className="mt-1 block text-[10px] text-[#5b6472]">Se imprime en {Math.ceil(questionCount / QUIZ_MAX_QUESTIONS)} hojas (max {QUIZ_MAX_QUESTIONS} preguntas por hoja).</span>
            )}
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
        <div className="space-y-3">
          {evalType === "paes" && activePaesPreset ? (
            <div className="rounded-md border border-blue-200 bg-blue-50/60 p-3.5 text-xs text-blue-950 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">Configuración oficial DEMRE</p>
                  <p className="mt-0.5 text-[11px] text-blue-800">
                    {activePaesPreset.questions} preguntas en hoja ({activePaesPreset.scored} puntúan + {activePaesPreset.pilots} piloto) · {activePaesPreset.options} opciones por defecto{activePaesPreset.mixedOptions ? " (admite preguntas puntuales de 5)" : ""}. Escala 100–1000 sobre las preguntas que puntúan.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#07305f]">
                  <input
                    type="checkbox"
                    checked={includePilots}
                    onChange={(e) => handleToggleIncludePilots(e.target.checked)}
                    className="rounded border-[#cfd6df]"
                  />
                  Incluir {activePaesPreset.pilots} piloto en hoja ({activePaesPreset.questions})
                </label>
              </div>

              {includePilots ? (
                <div className="space-y-2.5 border-t border-blue-200/70 pt-2.5">
                  <p className="font-semibold text-[#07305f]">¿Cómo tratar las preguntas piloto en el puntaje?</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 transition ${
                        pilotMode === "exclude"
                          ? "border-[#07305f] bg-white shadow-2xs"
                          : "border-blue-200/80 bg-white/50 hover:bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paes_pilot_mode_ui"
                        checked={pilotMode === "exclude"}
                        onChange={() => setPilotMode("exclude")}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-semibold text-[#111827]">
                          Excluir piloto del puntaje (oficial DEMRE)
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[#4b5563]">
                          La hoja imprime {questionCount}, pero las marcadas con 0 pts no cuentan (escala sobre {pilotQuestions.length > 0 ? Math.max(1, questionCount - pilotQuestions.length) : activePaesPreset.scored}).
                        </span>
                      </span>
                    </label>
                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 transition ${
                        pilotMode === "score_all"
                          ? "border-[#07305f] bg-white shadow-2xs"
                          : "border-blue-200/80 bg-white/50 hover:bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paes_pilot_mode_ui"
                        checked={pilotMode === "score_all"}
                        onChange={() => {
                          setPilotMode("score_all");
                          setPilotsText("");
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-semibold text-[#111827]">
                          Omitir piloto (puntúan todas)
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[#4b5563]">
                          Evalúa las {questionCount} preguntas por igual (escala calculada sobre {questionCount}).
                        </span>
                      </span>
                    </label>
                  </div>

                  {pilotMode === "exclude" && (
                    <label className="block text-xs font-semibold text-[#07305f]">
                      Preguntas piloto (*, valen 0 pts y clave opcional)
                      <input
                        type="text"
                        value={pilotsText}
                        onChange={(e) => setPilotsText(e.target.value)}
                        placeholder="Ej: 4, 19, 31, 51, 63"
                        className="mt-1.5 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-1.5 text-sm font-normal text-[#111827]"
                      />
                      <span className="mt-1 block text-[11px] font-normal text-blue-800">
                        {pilotQuestions.length > 0
                          ? `${pilotQuestions.length} piloto(s) marcadas (${pilotQuestions.join(", ")}) · el puntaje PAES se calcula sobre ${Math.max(1, questionCount - pilotQuestions.length)} preguntas.`
                          : "Aún sin piloto marcadas: escríbelas arriba, marca “★ Piloto” en la grilla, o pega un clavijero DEMRE con asteriscos (*)."}
                      </span>
                    </label>
                  )}
                </div>
              ) : (
                <p className="border-t border-blue-200/70 pt-2 text-[11px] text-blue-800">
                  Modo sin piloto: la hoja imprime solo <strong>{questionCount} preguntas</strong> (todas puntúan). Puedes ajustar el largo abajo para mini-ensayos.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-md bg-blue-50/50 border border-blue-100 p-3 text-xs text-blue-800 space-y-1">
              <p className="font-semibold">Equivalencia SIMCE:</p>
              <p>• El puntaje se calcula según el porcentaje de acierto (escala 100–400), <strong>independiente del número de preguntas</strong>.</p>
              <p>• Puedes ajustar libremente el número de preguntas abajo.</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Preguntas
              <input
                name="num_questions"
                type="number"
                inputMode="numeric"
                min="1"
                max={QUIZ_MAX_QUESTIONS}
                value={questionsValue}
                onChange={(event) => handleQuestionsChange(event.target.value, QUIZ_MAX_QUESTIONS)}
                onBlur={() => handleQuestionsBlur(QUIZ_MAX_QUESTIONS)}
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

          {isPaes && (
            <details
              open={Boolean(activePaesPreset?.mixedOptions) || Object.keys(optionOverrides).length > 0}
              className="rounded-md border border-[#e1e5ea] bg-white"
            >
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-[#374151]">
                Preguntas con 5 alternativas (opcional{activePaesPreset?.mixedOptions ? " · M2 y Ciencias mezclan 4 y 5" : ""})
                {Object.keys(optionOverrides).length > 0 && ` · ${Object.keys(optionOverrides).length} configurada(s)`}
              </summary>
              <div className="border-t border-[#eef0f3] p-3">
                <label className="block text-xs font-semibold text-[#374151]">
                  Nº de opciones por pregunta puntual
                  <input
                    value={overridesText}
                    onChange={(event) => setOverridesText(event.target.value)}
                    placeholder="Ej: 12:5, 28:5"
                    className="mt-1.5 w-full rounded-md border border-[#cfd6df] px-3 py-1.5 text-sm font-normal text-[#111827]"
                  />
                  <span className="mt-1 block text-[11px] font-normal text-[#5b6472]">
                    Formato &ldquo;pregunta:opciones&rdquo; separado por comas (ej. 12:5, 28:5). Si pegas o subes una pauta con letra E, tuLector las agrega automáticamente.
                  </span>
                </label>
              </div>
            </details>
          )}
        </div>
      )}

      {!isPaes && (
        <>
          <label className="block text-sm font-semibold">
            Preguntas de desarrollo (opcional)
            <input
              value={openText}
              onChange={(event) => setOpenText(event.target.value)}
              placeholder="Ej: 18, 27, 33"
              className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal"
            />
            <span className="mt-1 block text-[11px] font-normal text-[#5b6472]">
              {openQuestions.length > 0
                ? `${openQuestions.length} pregunta(s) se resolverán al reverso de la hoja (${openQuestions.join(", ")}); la nota se calcula sobre las ${closedCount} de alternativas.`
                : "Preguntas abiertas/de desarrollo: se imprimen como “Resolver al reverso” (sin burbujas) y no cuentan en el puntaje automático."}
            </span>
          </label>

          {openQuestions.length > 0 && (
            <div className="rounded-md border border-[#e1e5ea] bg-white">
              <button
                type="button"
                onClick={() => setRubricPanelOpen((v) => !v)}
                aria-expanded={rubricPanelOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-[#111827]">Rúbrica de corrección (IA)</p>
                  <p className="mt-0.5 text-xs text-[#6b7280]">
                    {rubricCount > 0
                      ? `${rubricCount} de ${openQuestions.length} pregunta(s) de desarrollo con criterio cargado`
                      : `Opcional — precisa la corrección automática de las ${openQuestions.length} pregunta(s) de desarrollo`}
                  </p>
                </div>
                <ChevronIcon className={`h-4 w-4 shrink-0 text-[#6b7280] transition-transform ${rubricPanelOpen ? "rotate-180" : ""}`} />
              </button>

              {rubricPanelOpen && (
                <div className="space-y-3 border-t border-[#eef0f3] px-4 py-4">
                  <p className="text-xs text-[#6b7280]">
                    Sin rúbrica, la IA solo tiene el enunciado (si lo cargas) para sugerir un puntaje —
                    con rúbrica el criterio es mucho más preciso. Puedes completarlo después desde
                    &ldquo;Editar&rdquo;.
                  </p>
                  <div className="space-y-2.5">
                    {openQuestions.map((q) => {
                      const r = rubrics[q] ?? { rubric: "", max_points: 2, subtipo: "simple" as OpenQuestionSubtype };
                      const update = (patch: Partial<OpenQuestionRubric>) =>
                        setRubrics((prev) => ({ ...prev, [q]: { ...r, ...patch } }));
                      return (
                        <div key={q} className="rounded-md border border-[#eef0f3] bg-[#fafbfc] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex h-6 items-center justify-center rounded-full border border-dashed border-[#f0b429] bg-[#fffbeb] px-2 text-[11px] font-bold text-[#b45309]">
                              P{q}
                            </span>
                            <select
                              value={r.subtipo}
                              onChange={(e) => update({ subtipo: e.target.value as OpenQuestionSubtype })}
                              className="rounded-md border border-[#cfd6df] bg-white px-2 py-1 text-xs font-medium text-[#374151]"
                            >
                              <option value="simple">Desarrollo / texto</option>
                              <option value="par_ordenado">Par ordenado (x; y)</option>
                              <option value="entero_decimal">Número (entero o decimal)</option>
                            </select>
                            <label className="ml-auto flex items-center gap-1.5 text-xs font-medium text-[#6b7280]">
                              Máx.
                              <input
                                type="number" min={0} step={0.5} inputMode="decimal"
                                value={rubricPointsText[q] ?? String(r.max_points)}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw !== "" && !/^\d*[.,]?\d*$/.test(raw)) return;
                                  setRubricPointsText((prev) => ({ ...prev, [q]: raw }));
                                  const parsed = Number(raw.replace(",", "."));
                                  if (raw !== "" && Number.isFinite(parsed) && parsed >= 0) update({ max_points: parsed });
                                }}
                                onBlur={() => {
                                  const raw = rubricPointsText[q];
                                  if (raw !== undefined && raw !== "") {
                                    const parsed = Number(raw.replace(",", "."));
                                    if (Number.isFinite(parsed)) update({ max_points: Math.max(0, parsed) });
                                  }
                                  setRubricPointsText((prev) => {
                                    const next = { ...prev };
                                    delete next[q];
                                    return next;
                                  });
                                }}
                                className="w-14 rounded-md border border-[#cfd6df] bg-white px-2 py-1 text-xs text-[#111827]"
                              />
                              <span className="text-[#9ca3af]">pts</span>
                            </label>
                          </div>
                          <textarea
                            value={r.rubric}
                            onChange={(e) => update({ rubric: e.target.value })}
                            placeholder='Ej: "2 pts: plantea y resuelve correctamente. 1 pt: plantea pero se equivoca en el cálculo. 0 pts: en blanco o sin relación."'
                            rows={2}
                            className="mt-2.5 w-full rounded-md border border-[#cfd6df] bg-white px-2.5 py-2 text-xs text-[#111827] placeholder:text-[#9ca3af]"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <input type="hidden" name="open_questions" value={isPaes ? "" : (serializeOpenQuestions(openQuestions) ?? "")} />
      <input type="hidden" name="open_question_rubrics" value={isPaes ? "" : (serializeOpenQuestionRubrics(rubrics) ?? "")} />

      {isPaes && !hasCustomNonZeroWeights ? (
        <>
          <input type="hidden" name="default_question_points" value="1" />
          <input type="hidden" name="question_points" value={serializedPilotPoints} />
        </>
      ) : (
        <QuestionPointsPanel
          questionCount={questionCount}
          openQuestions={isPaes ? [] : openQuestions}
          multiSelectQuestions={isPaes ? [] : multiSelectQuestions}
          rubrics={isPaes ? {} : rubrics}
          defaultDefaultPoints={defaultDefaultQuestionPoints}
          defaultQuestionPoints={initialQuestionPoints}
          defaultScoreOpen={defaultScoreOpenQuestions}
        />
      )}

      {!isPaes && (
        <details className="rounded-md border border-[#eef0f3]">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-[#4b5563]">
            Opciones avanzadas (replicar un instrumento externo, ej. DIA)
          </summary>
          <div className="space-y-3 border-t border-[#eef0f3] p-3">
            <label className="block text-sm font-semibold">
              Preguntas de selección múltiple (opcional)
              <input
                value={multiText}
                onChange={(event) => setMultiText(event.target.value)}
                placeholder="Ej: 29"
                className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal"
              />
              <span className="mt-1 block text-[11px] font-normal text-[#5b6472]">
                {multiSelectQuestions.length > 0
                  ? `${multiSelectQuestions.length} pregunta(s) tipo "marca todas las correctas" (${multiSelectQuestions.join(", ")}); varias marcas son una respuesta válida y quedan fuera del puntaje automático.`
                  : "Pregunta tipo “marca todas las correctas”: se imprime como una fila numerada (no A-B-C-D) y el lector acepta cualquier combinación de marcas."}
                {multiOverlapsOpen && " ⚠ No puede repetirse una pregunta que ya está en “Preguntas de desarrollo”."}
              </span>
            </label>
            <label className="block text-sm font-semibold">
              Nº de opciones por pregunta puntual (opcional)
              <input
                value={overridesText}
                onChange={(event) => setOverridesText(event.target.value)}
                placeholder="Ej: 20:3, 29:6"
                className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal"
              />
              <span className="mt-1 block text-[11px] font-normal text-[#5b6472]">
                Formato &ldquo;pregunta:opciones&rdquo; separado por comas. Solo para preguntas que
                tengan un nº de opciones distinto al general de este ensayo (ej. una hoja DIA con una
                pregunta A-B-C en vez de A-B-C-D, o los 6 casilleros de una fila de selección
                múltiple).
              </span>
            </label>
          </div>
        </details>
      )}
      <input type="hidden" name="multi_select_questions" value={isPaes ? "" : (serializeMultiSelectQuestions(multiSelectQuestions) ?? "")} />
      <input type="hidden" name="option_overrides" value={serializeOptionOverrides(optionOverrides) ?? ""} />

      <input type="hidden" name="option_labels" value={labels.split("").join(",")} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="block text-sm font-semibold text-[#111827]" htmlFor={name}>Clave de respuestas</label>
          <p className="mt-0.5 text-xs text-[#6b7280]">Carga rápida por archivo, pegando el clavijero, escaneando una hoja o marcando abajo.</p>
        </div>
      </div>

      {/* Carga rapida de clave (visible sin expandir) */}
      <div className="rounded-md border border-[#e1e5ea] bg-[#fafbfc] p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-[#07305f] bg-white px-3 py-1.5 text-xs font-semibold text-[#07305f] hover:bg-[#eef4ff]"
          >
            Subir CSV / Excel / TXT
          </button>
          <button
            type="button"
            onClick={() => setImportPanel((p) => (p === "paste" ? "none" : "paste"))}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
              importPanel === "paste"
                ? "border-[#07305f] bg-[#07305f] text-white"
                : "border-[#cfd6df] bg-white text-[#374151] hover:bg-[#f4f6f8]"
            }`}
          >
            Pegar clavijero / texto
          </button>
          <button
            type="button"
            onClick={() => setImportPanel((p) => (p === "scan" ? "none" : "scan"))}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
              importPanel === "scan"
                ? "border-[#07305f] bg-[#07305f] text-white"
                : "border-[#cfd6df] bg-white text-[#374151] hover:bg-[#f4f6f8]"
            }`}
          >
            Escanear hoja pauta
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {importNotice && <p className="text-xs font-semibold text-[#0f766e]">{importNotice}</p>}
        {fileError && <p className="text-xs font-semibold text-[#b45309]">{fileError}</p>}

        {importPanel === "paste" && (
          <div className="space-y-2.5 border-t border-[#e6e8eb] pt-2.5">
            <label className="block text-xs font-semibold text-[#374151]">
              Pega el clavijero del DEMRE, una tabla de Excel o la cadena de letras
              <textarea
                value={pasteDraft}
                onChange={(e) => setPasteDraft(e.target.value)}
                rows={4}
                placeholder={"Ej. clavijero DEMRE:\n1 A  2 C  3 D  4* B  5 A ...\n\nO cadena directa:\nABCDABCD..."}
                className="mt-1.5 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-mono text-xs text-[#111827] outline-none focus:border-[#07305f]"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (applyImportedKey(pasteDraft)) setImportPanel("none");
                }}
                disabled={!pasteDraft.trim()}
                className="rounded-md bg-[#07305f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#062447] disabled:opacity-40"
              >
                Aplicar clavijero
              </button>
              <button
                type="button"
                onClick={() => { setPasteDraft(""); setImportPanel("none"); }}
                className="rounded-md border border-[#cfd6df] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b6472] hover:bg-[#f4f6f8]"
              >
                Cerrar
              </button>
            </div>
            <label className="block text-[11px] font-medium text-[#6b7280]">
              Secuencia directa en una línea (editable)
              <input
                id={name}
                name={name}
                value={value}
                onChange={(event) => setValue(event.target.value.toUpperCase())}
                className="mt-1 w-full rounded-md border border-[#d8dde3] bg-white px-3 py-1.5 font-mono text-xs text-[#111827] outline-none focus:border-[#111827]"
                placeholder="ABCDABCD..."
                aria-invalid={!valid}
              />
            </label>
          </div>
        )}

        {importPanel === "scan" && (
          <div className="border-t border-[#e6e8eb] pt-2.5">
            <AnswerKeyFromSheet
              numQuestions={questionCount}
              numOptions={optionCount}
              openQuestions={openQuestions}
              onAccept={(letters) => {
                setValue(letters);
                setFileError(null);
                setImportNotice("✓ Pauta escaneada desde hoja");
                setImportPanel("none");
              }}
            />
          </div>
        )}
      </div>

      {importPanel !== "paste" && <input id={name} type="hidden" name={name} value={value} />}

      <div className="mt-3">
        <AnswerKeyGrid
          answerKey={slots}
          numQuestions={questionCount}
          optionLabels={labels}
          optionOverrides={optionOverrides}
          onAnswerChange={handleGridAnswerChange}
          openQuestions={openSet0}
          multiSelectQuestions={multiSet0}
          pilotQuestions={pilotSet0}
          onTogglePilot={isPaes && includePilots && pilotMode === "exclude" ? handleTogglePilot : undefined}
        />
      </div>

      <input type="hidden" name={`${name}_clean`} value={slots} />
      <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#4b5563]">
        <input type="checkbox" name="allow_partial_key" checked={allowPartial} onChange={(event) => setAllowPartial(event.target.checked)} />
        Completar la clave más tarde
      </label>
      <p className={valid || allowPartial ? "mt-2 text-xs text-[#4b5563]" : "mt-2 text-xs font-semibold text-[#b45309]"}>
        {allowPartial
          ? `${filledRequiredCount}/${requiredCount} respuestas cargadas — podrás completar el resto despues desde "Editar".`
          : `${filledRequiredCount}/${requiredCount} respuestas válidas ${labels}${Object.keys(optionOverrides).length > 0 ? " (+ overrides)" : ""}.`}
        {pilotQuestions.length > 0 && ` (${pilotQuestions.length} piloto sin puntaje)`}
        {openQuestions.length > 0 && ` (${openQuestions.length} de desarrollo, sin clave)`}
        {multiSelectQuestions.length > 0 && ` (${multiSelectQuestions.length} de selección múltiple, sin clave)`}
      </p>
    </div>
  );
}
