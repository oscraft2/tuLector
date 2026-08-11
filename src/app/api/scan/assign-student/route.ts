import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { assignPaperToStudent, resolveTargetStudent, undoPaperAssignment } from "@/lib/paper_assign";

export const dynamic = "force-dynamic";

/**
 * Asignar / reasignar / deshacer un escaneo desde la CAMARA, sin salir de
 * /scan. Misma logica que la cola de revision del dashboard (src/lib/
 * paper_assign.ts) -- aca solo viven el auth y la forma del payload.
 *
 * POST { paperId, studentId }            -> asigna
 * POST { paperId, studentId, overwrite } -> asigna aunque el alumno ya tuviera
 *                                           otro escaneo de este ensayo (lo anula)
 * POST { paperId, undo: true }           -> revierte la ultima asignacion
 */
export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | { paperId?: string; studentId?: string; studentCode?: string; overwrite?: boolean; undo?: boolean }
    | null;
  if (!payload?.paperId) return NextResponse.json({ error: "Falta paperId" }, { status: 400 });

  let ctx;
  try {
    ctx = await getDashboardContext();
  } catch {
    return NextResponse.json({ error: "No autenticado o sin colegio" }, { status: 401 });
  }
  const { supabase, school } = ctx;

  try {
    if (payload.undo) {
      const result = await undoPaperAssignment(supabase, school, payload.paperId);
      return NextResponse.json({ ok: true, undone: true, ...result });
    }

    if (!payload.studentId && !payload.studentCode) {
      return NextResponse.json({ error: "Falta el alumno" }, { status: 400 });
    }

    const student = await resolveTargetStudent(supabase, school, {
      ...(payload.studentId ? { studentUuid: payload.studentId } : {}),
      ...(payload.studentCode ? { studentCode: payload.studentCode } : {}),
    });
    if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

    const result = await assignPaperToStudent(supabase, school, payload.paperId, student, {
      overwrite: payload.overwrite === true,
    });
    // Colision: el alumno ya tenia otro escaneo de este ensayo. 409 para que la
    // UI pregunte antes de sobrescribir, en vez de decidir por el profesor.
    if (!result.ok) return NextResponse.json({ ok: false, conflict: result.conflict }, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[scan/assign-student]", error);
    const message = error instanceof Error ? error.message : "No se pudo asignar el alumno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
