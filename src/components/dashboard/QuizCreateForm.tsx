"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { createQuiz } from "@/app/dashboard/actions";
import { AnswerKeyEditor } from "@/components/dashboard/AnswerKeyEditor";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { QUIZ_MAX_QUESTIONS } from "@/lib/quiz_constraints";

const CHILEAN_SUBJECTS = [
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

export function QuizCreateForm({ courses }: { courses: CourseOption[] }) {
  const [state, formAction] = useActionState(createQuiz, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const noCourses = courses.length === 0;

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.key, state.status]);

  return (
    <>
      <form ref={formRef} action={formAction} className="rounded-md border border-[#e1e5ea] bg-white p-5 space-y-4">
        <h2 className="text-xl font-semibold">Nuevo ensayo</h2>

        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            Título
            <input
              name="title"
              required
              className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal text-sm"
              placeholder="Matemática M1 - Ensayo 05"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Asignatura (Base Curricular)
              <select name="subject" required className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-2 py-2 font-normal text-sm">
                <option value="">Selecciona materia</option>
                {CHILEAN_SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold">
              Curso del establecimiento
              <select name="grade" required className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-2 py-2 font-normal text-sm">
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

          <AnswerKeyEditor questions={20} />

          <p className="text-xs text-[#5b6472]">
            Formatos compatibles con el lector móvil: hasta {QUIZ_MAX_QUESTIONS} preguntas y 3, 4 o 5 opciones.
          </p>

          <SubmitButton
            pendingLabel="Creando ensayo…"
            disabled={noCourses}
            className="w-full rounded-md bg-[#07305f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#062447] disabled:opacity-50"
          >
            {noCourses ? "Requiere crear curso primero" : "Crear ensayo"}
          </SubmitButton>
        </div>
      </form>
      <ActionFeedbackDialog state={state} />
    </>
  );
}
