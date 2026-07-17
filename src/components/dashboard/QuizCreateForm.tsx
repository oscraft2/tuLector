"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { createQuiz, updateQuiz } from "@/app/dashboard/actions";
import { AnswerKeyEditor } from "@/components/dashboard/AnswerKeyEditor";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { QUIZ_MAX_QUESTIONS, QUIZ_MAX_QUESTIONS_MULTIPAGE } from "@/lib/quiz_constraints";
import { resolveCountryProfile } from "@/lib/country_profiles";

// Lista de materias de secundaria comunes a la region (no exclusiva de un
// pais); el termino "Base Curricular" del label SI es especifico de Chile,
// por eso el titulo del campo se ajusta segun el pais (ver mas abajo).
const SUBJECTS = [
  "Lengua y Literatura",
  "Matemática",
  "Historia, Geografía y Ciencias Sociales",
  "Ciencias Naturales (Biología)",
  "Ciencias Naturales (Física)",
  "Ciencias Naturales (Química)",
  "Inglés",
  "Educación Física y Salud",
  "Artes Visuales",
  "Música",
  "Tecnología",
  "Orientación",
  "Otro",
];

const initialState: DashboardActionState = { status: "idle" };

type CourseOption = { id: string; name: string; grade: string | null };

type ExistingQuiz = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  num_questions: number;
  options_per_question: number;
  answer_key: string;
  exigencia: number | null;
};

export function QuizCreateForm({
  courses,
  countryCode = "CL",
  mode = "create",
  quiz,
  papersCount = 0,
}: {
  courses: CourseOption[];
  countryCode?: string;
  mode?: "create" | "edit";
  quiz?: ExistingQuiz;
  papersCount?: number;
}) {
  const isEdit = mode === "edit" && Boolean(quiz);
  const [state, formAction] = useActionState(isEdit ? updateQuiz : createQuiz, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const noCourses = courses.length === 0;
  const countryProfile = resolveCountryProfile(countryCode);
  const isChile = countryProfile.code === "CL";
  const exigenciaOptions = [0.5, 0.55, 0.6, 0.65, 0.7];
  const defaultExigencia = quiz?.exigencia ?? countryProfile.grading.exigencia;

  useEffect(() => {
    if (state.status === "success" && !isEdit) formRef.current?.reset();
  }, [state.key, state.status, isEdit]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (isEdit && papersCount > 0 && !confirmed) {
      event.preventDefault();
      setConfirmOpen(true);
    }
  }

  return (
    <>
      <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="rounded-md border border-[#e1e5ea] bg-white p-5 space-y-4">
        <h2 className="text-xl font-semibold">{isEdit ? "Editar ensayo" : "Nuevo ensayo"}</h2>
        {isEdit && quiz && <input type="hidden" name="id" value={quiz.id} />}

        {isEdit && papersCount > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            Este ensayo ya tiene <strong>{papersCount}</strong> hoja(s) escaneada(s). Si cambias la clave, el número de
            preguntas o las opciones, sus puntajes se recalcularán automáticamente al guardar.
          </div>
        )}

        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            Título
            <input
              name="title"
              required
              defaultValue={quiz?.title ?? ""}
              className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal text-sm"
              placeholder="Matemática M1 - Ensayo 05"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              {isChile ? "Asignatura (Base Curricular)" : "Asignatura"}
              <select name="subject" required defaultValue={quiz?.subject ?? ""} className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-2 py-2 font-normal text-sm">
                <option value="">Selecciona materia</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold">
              Curso del establecimiento
              <select name="grade" required defaultValue={quiz?.grade ?? ""} className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-2 py-2 font-normal text-sm">
                <option value="">Selecciona curso</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              {noCourses && (
                <span className="mt-1 block text-[10px] text-amber-700">
                  * Primero crea un curso en{" "}
                  <Link href="/dashboard/students" className="underline font-bold">Alumnos</Link>
                </span>
              )}
            </label>
          </div>

          <AnswerKeyEditor
            questions={quiz?.num_questions ?? 20}
            defaultOptions={quiz?.options_per_question ?? 5}
            defaultValue={quiz?.answer_key ?? ""}
            countryCode={countryCode}
          />

          <label className="block text-sm font-semibold">
            Exigencia
            <select name="exigencia" defaultValue={String(defaultExigencia)} className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-2 py-2 font-normal text-sm">
              {exigenciaOptions.map((pct) => (
                <option key={pct} value={pct}>
                  {Math.round(pct * 100)}%{pct === countryProfile.grading.exigencia ? ` — Estandar ${countryProfile.countryName}` : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-[#5b6472]">
              Porcentaje de acierto minimo para obtener nota {countryProfile.grading.passing} (escala {countryProfile.grading.min}-{countryProfile.grading.max}).
              {isChile && " No afecta puntajes PAES/SIMCE."}
            </span>
          </label>

          <p className="text-xs text-[#5b6472]">
            Formatos compatibles con el lector móvil: hasta {QUIZ_MAX_QUESTIONS} preguntas por hoja (hasta {QUIZ_MAX_QUESTIONS_MULTIPAGE} repartidas en varias hojas) y 3, 4 o 5 opciones.
          </p>

          <SubmitButton
            pendingLabel={isEdit ? "Guardando…" : "Creando ensayo…"}
            disabled={noCourses}
            className="w-full rounded-md bg-[#07305f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#062447] disabled:opacity-50"
          >
            {noCourses ? "Requiere crear curso primero" : isEdit ? "Guardar cambios" : "Crear ensayo"}
          </SubmitButton>
        </div>
      </form>
      <ActionFeedbackDialog state={state} />
      <ConfirmDialog
        open={confirmOpen}
        title="Este ensayo ya tiene hojas escaneadas"
        message={`Al guardar, se recalcularán los puntajes de ${papersCount} hoja(s) ya escaneada(s) con los datos nuevos.`}
        confirmLabel="Guardar y recalcular"
        danger={false}
        onConfirm={() => {
          setConfirmOpen(false);
          setConfirmed(true);
          requestAnimationFrame(() => formRef.current?.requestSubmit());
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
