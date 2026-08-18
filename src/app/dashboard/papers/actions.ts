"use server";

import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/supabase_server";
import { assignPaperToStudent, resolveTargetStudent, undoPaperAssignment, regradeSinglePaper } from "@/lib/paper_assign";
import { findMisplacedPapers, reroutePapers } from "@/lib/paper_reroute";
import { deleteGradeRecord } from "@/lib/paper_assign";
import { normalizeRut } from "@/lib/rut";
import { parseOpenQuestions, parseMultiSelectQuestions, parseOptionOverrides, optionLabelsFor } from "@/lib/quiz_constraints";

/**
 * Acciones de la cola de revision. Viven aparte de dashboard/actions.ts a
 * proposito: la logica real (mover la nota, anular el duplicado, guardar el
 * estado previo para deshacer) es la MISMA que usa la camara, y esta en
 * src/lib/paper_assign.ts. Aca solo quedan auth, forma del formulario y
 * revalidacion de rutas.
 */

function revalidatePaper(paperId: string, quizId: string) {
  revalidatePath("/dashboard/papers");
  revalidatePath(`/dashboard/papers/${paperId}`);
  revalidatePath(`/dashboard/results/${quizId}`);
  revalidatePath(`/dashboard/quizzes/${quizId}`);
  revalidatePath("/app/results");
}

export type AssignActionState = {
  error?: string;
  /** El alumno destino ya tenia otra hoja de este ensayo: la UI pide confirmacion. */
  conflict?: { studentId: string; studentName: string; score: number | null; total: number | null; scannedAt: string | null };
  success?: string;
};

export async function assignPaperAction(_prev: AssignActionState, formData: FormData): Promise<AssignActionState> {
  const paperId = String(formData.get("paper_id") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "").trim();
  const studentName = String(formData.get("student_name") ?? "").trim();
  const overwrite = String(formData.get("overwrite") ?? "") === "1";
  if (!paperId || !studentId) return { error: "Falta el escaneo o el alumno." };

  try {
    const { supabase, school } = await getDashboardContext();
    const student = await resolveTargetStudent(supabase, school, { studentUuid: studentId });
    if (!student) return { error: "Alumno no encontrado." };

    const result = await assignPaperToStudent(supabase, school, paperId, student, { overwrite });
    if (!result.ok) {
      return {
        conflict: {
          studentId,
          studentName: studentName || student.name || "ese alumno",
          score: result.conflict.score,
          total: result.conflict.total,
          scannedAt: result.conflict.scannedAt,
        },
      };
    }

    revalidatePaper(paperId, result.quizId);
    return { success: `Asignado a ${result.studentName}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo asignar el alumno." };
  }
}

/**
 * Mueve al ensayo de su curso las hojas que quedaron en el ensayo equivocado de
 * un lote multi-curso (la hoja del 2E usada para corregir todo el nivel). Nada
 * se mueve sin que el profesor lo pida: esto solo corre desde el boton del
 * detalle del ensayo.
 */
export async function reroutePapersAction(_prev: AssignActionState, formData: FormData): Promise<AssignActionState> {
  const quizId = String(formData.get("quiz_id") ?? "").trim();
  if (!quizId) return { error: "Falta el ensayo." };
  try {
    const { supabase, school } = await getDashboardContext();
    const misplaced = await findMisplacedPapers(supabase, school.id, quizId);
    if (misplaced.length === 0) return { success: "No hay hojas que reubicar." };

    const { moved, voided } = await reroutePapers(supabase, school, quizId, misplaced);
    // Se revalidan los ensayos de origen y destino: las dos listas cambian.
    revalidatePath(`/dashboard/quizzes/${quizId}`);
    revalidatePath(`/dashboard/results/${quizId}`);
    for (const target of new Set(misplaced.map((p) => p.targetQuizId))) {
      revalidatePath(`/dashboard/quizzes/${target}`);
      revalidatePath(`/dashboard/results/${target}`);
    }
    revalidatePath("/dashboard/quizzes");
    revalidatePath("/app/results");
    return {
      success: `${moved} ${moved === 1 ? "hoja movida" : "hojas movidas"} al ensayo de su curso.` +
        (voided > 0 ? ` ${voided} ${voided === 1 ? "hoja duplicada quedó anulada" : "hojas duplicadas quedaron anuladas"}.` : ""),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudieron reubicar las hojas." };
  }
}

/**
 * Descarta una hoja: queda anulada (`status: "void"`, el estado que todos los
 * listados ya excluyen) y se borra su nota. Para el escaneo de una hoja que no
 * corresponde -- una prueba en blanco de nadie, una foto repetida, una hoja de
 * otro ensayo -- que hoy solo se podia dejar ahi ocupando la cola de revision.
 */
export async function voidPaperAction(_prev: AssignActionState, formData: FormData): Promise<AssignActionState> {
  const paperId = String(formData.get("paper_id") ?? "").trim();
  if (!paperId) return { error: "Falta el escaneo." };
  try {
    const { supabase, school } = await getDashboardContext();
    const { data: paper } = await supabase
      .from("papers")
      .select("id,quiz_id,student_rut_norm,student_id")
      .eq("id", paperId)
      .eq("school_id", school.id)
      .maybeSingle();
    if (!paper) return { error: "No se encontró el escaneo." };

    await supabase.from("papers").update({ status: "void" }).eq("id", paperId).eq("school_id", school.id);
    // La nota se va con la hoja: si no, queda una nota sin escaneo detrás.
    const code = (paper.student_rut_norm as string | null) ?? (paper.student_id ? normalizeRut(paper.student_id as string) : null);
    if (code) await deleteGradeRecord(supabase, school.id, paper.quiz_id as string, code);

    revalidatePaper(paperId, paper.quiz_id as string);
    return { success: "Hoja descartada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo descartar la hoja." };
  }
}

export async function undoAssignAction(_prev: AssignActionState, formData: FormData): Promise<AssignActionState> {
  const paperId = String(formData.get("paper_id") ?? "").trim();
  if (!paperId) return { error: "Falta el escaneo." };
  try {
    const { supabase, school } = await getDashboardContext();
    const { quizId, restoredTo } = await undoPaperAssignment(supabase, school, paperId);
    revalidatePaper(paperId, quizId);
    return { success: restoredTo ? `Se restauró la asignación anterior (${restoredTo}).` : "Asignación deshecha." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo deshacer." };
  }
}

export type AnswerCorrectionState = { error?: string; success?: string };

/**
 * Corrige una o mas respuestas mal leidas por el motor en UNA hoja ya
 * escaneada, y recalcula nota/puntaje. Mismo patron que el resto de este
 * archivo: el fetch de la hoja con `.eq("school_id", school.id)` ES el chequeo
 * de dueño (la RLS `school_papers` ya exige admin del colegio o profesor
 * creador del ensayo -- si la fila no vuelve, no hay nada que corregir aca).
 * El recalculo real (score/points/grade + grade_records) vive en
 * regradeSinglePaper (src/lib/paper_assign.ts), compartido con la
 * re-correccion al confirmar una pregunta de desarrollo.
 */
export async function updatePaperAnswerAction(_prev: AnswerCorrectionState, formData: FormData): Promise<AnswerCorrectionState> {
  const paperId = String(formData.get("paper_id") ?? "").trim();
  const quizId = String(formData.get("quiz_id") ?? "").trim();
  if (!paperId || !quizId) return { error: "Falta la hoja o el ensayo." };

  try {
    const { supabase, school, user } = await getDashboardContext();

    const { data: paper } = await supabase
      .from("papers")
      .select("id,status,answers,student_rut_norm,corrected_answers")
      .eq("id", paperId)
      .eq("school_id", school.id)
      .maybeSingle();
    if (!paper) return { error: "No se encontró la hoja, o no tienes permiso para corregirla." };
    if (paper.status === "void") return { error: "Esta hoja está anulada; no se puede corregir." };

    const { data: quiz } = await supabase
      .from("quizzes")
      .select("id,num_questions,options_per_question,option_overrides,open_questions,multi_select_questions")
      .eq("id", quizId)
      .eq("school_id", school.id)
      .maybeSingle();
    if (!quiz) return { error: "No se encontró el ensayo." };

    const numQ = Number(quiz.num_questions ?? 0);
    const openSet = new Set(parseOpenQuestions(quiz.open_questions ?? "", numQ));
    const multiSet = new Set(parseMultiSelectQuestions(quiz.multi_select_questions ?? "", numQ));
    const overridesByQ = parseOptionOverrides(quiz.option_overrides ?? "", numQ);

    const answerByQ = new Map<number, string>();
    for (const item of Array.isArray(paper.answers) ? (paper.answers as { q?: unknown; a?: unknown }[]) : []) {
      const q = Number(item?.q);
      if (Number.isInteger(q) && q >= 1 && q <= numQ) answerByQ.set(q, String(item?.a ?? "-").trim().toUpperCase());
    }

    type CorrectionEntry = { question: number; previous_answer: string; new_answer: string; corrected_at: string };
    const correctionLog: CorrectionEntry[] = Array.isArray(paper.corrected_answers)
      ? [...(paper.corrected_answers as CorrectionEntry[])]
      : [];
    const now = new Date().toISOString();
    let changed = false;

    // Diff contra lo actual: solo las preguntas que de verdad cambiaron generan
    // entrada de auditoria y entran al recalculo -- no una llamada por pregunta.
    for (const [key, value] of formData.entries()) {
      const match = /^ans_(\d+)$/.exec(key);
      if (!match) continue;
      const q = Number(match[1]);
      if (!Number.isInteger(q) || q < 1 || q > numQ) continue;
      // Preguntas abiertas/multi-select son solo lectura aca (ver
      // buildPaperQuestionBreakdown): el <select> del cliente no las ofrece,
      // pero se ignoran igual si llegaran por un form manipulado a mano.
      if (openSet.has(q) || multiSet.has(q)) continue;

      const nOpts = overridesByQ[q] ?? (Number(quiz.options_per_question) || 5);
      const allowed = new Set(optionLabelsFor(nOpts).split(""));
      allowed.add("-");
      const newAnswer = String(value ?? "").trim().toUpperCase();
      if (!allowed.has(newAnswer)) continue; // opcion invalida para esta pregunta: se ignora (defensa)

      const prevAnswer = answerByQ.get(q) ?? "-";
      if (prevAnswer === newAnswer) continue;

      answerByQ.set(q, newAnswer);
      correctionLog.push({ question: q, previous_answer: prevAnswer, new_answer: newAnswer, corrected_at: now });
      changed = true;
    }

    if (!changed) return { success: "Sin cambios que guardar." };

    const mergedAnswers = Array.from(answerByQ.entries())
      .map(([q, a]) => ({ q, a }))
      .sort((a, b) => a.q - b.q);

    const { error: updateError } = await supabase
      .from("papers")
      .update({ answers: mergedAnswers, corrected_by: user.id, corrected_at: now, corrected_answers: correctionLog })
      .eq("id", paperId)
      .eq("school_id", school.id);
    if (updateError) throw updateError;

    const result = await regradeSinglePaper(supabase, school, { quizId, paperId });
    if (!result) return { error: "La corrección se guardó, pero no se pudo recalcular la nota." };

    revalidatePaper(paperId, quizId);
    if (paper.student_rut_norm) {
      const { data: studentRow } = await supabase
        .from("students")
        .select("id")
        .eq("school_id", school.id)
        .eq("rut_normalized", paper.student_rut_norm)
        .maybeSingle();
      if (studentRow) revalidatePath(`/dashboard/students/${studentRow.id}`);
    }
    return { success: "Corrección guardada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar la corrección." };
  }
}
