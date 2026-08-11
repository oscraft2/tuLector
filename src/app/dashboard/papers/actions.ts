"use server";

import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/supabase_server";
import { assignPaperToStudent, resolveTargetStudent, undoPaperAssignment } from "@/lib/paper_assign";

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
