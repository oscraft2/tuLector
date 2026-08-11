"use server";

import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/supabase_server";
import { assignPaperToStudent, resolveTargetStudent, undoPaperAssignment } from "@/lib/paper_assign";
import { findMisplacedPapers, reroutePapers } from "@/lib/paper_reroute";
import { deleteGradeRecord } from "@/lib/paper_assign";
import { normalizeRut } from "@/lib/rut";

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
