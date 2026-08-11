/**
 * Asignar (y reasignar) un escaneo a un alumno.
 *
 * Un escaneo cae en `manual_review` cuando el ID no se leyo o no calza con
 * ningun alumno. Identificarlo a mano no es solo escribir un nombre en el
 * paper: hay que mover tambien la nota (`grade_records`), no dejar la del
 * alumno equivocado, y poder deshacer si se asigno mal. Todo eso vive aca, y no
 * en el server action del dashboard, porque el mismo flujo corre desde la
 * camara (/api/scan/assign-student) y desde la cola de revision.
 *
 * Reglas:
 *  - Reasignar BORRA la nota del alumno anterior para ese ensayo (si no, queda
 *    una nota fantasma de alguien que nunca rindio esa hoja).
 *  - Si el alumno destino ya tiene OTRO paper del mismo ensayo, no se escribe
 *    nada: se devuelve `conflict` para que la UI pregunte. Con `overwrite` el
 *    paper viejo queda anulado (`status: "void"`, el mismo estado que los
 *    listados ya excluyen).
 *  - Antes de escribir se guarda el estado previo en `papers.prev_assignment`,
 *    que es lo que hace posible `undoPaperAssignment`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardSchool } from "@/lib/supabase_server";
import { calculateGrade } from "@/lib/latam";
import { normalizeRut } from "@/lib/rut";
import { resolveNationalId } from "@/lib/national_id";
import { isMissingColumnError } from "@/lib/supabase_errors";

type MinimalClient = Pick<SupabaseClient, "from">;

/** Estado del paper antes de una asignacion manual (para deshacer). */
export type PrevAssignment = {
  student_id: string | null;
  student_rut_norm: string | null;
  student_name: string | null;
  status: string | null;
  course_id: string | null;
};

export type AssignResult =
  | { ok: true; paperId: string; quizId: string; studentName: string; courseId: string | null; voidedPaperId?: string }
  | { ok: false; conflict: { paperId: string; score: number | null; total: number | null; scannedAt: string | null } };

export type AssignTarget = {
  /** uuid de la fila de `students` (lo que entrega el buscador). */
  studentUuid?: string;
  /** ID nacional o codigo interno, para el camino "escribi el RUT a mano". */
  studentCode?: string;
};

type StudentRow = {
  id: string;
  student_id: string | null;
  rut: string | null;
  rut_normalized: string | null;
  name: string | null;
  course_id?: string | null;
};

const STUDENT_COLUMNS = "id,student_id,rut,rut_normalized,name,course_id";
const STUDENT_COLUMNS_LEGACY = "id,student_id,rut,rut_normalized,name";

/** Busca al alumno destino por uuid o por codigo (ID normalizado / student_id / rut crudo). */
export async function resolveTargetStudent(
  supabase: MinimalClient,
  school: Pick<DashboardSchool, "id" | "country_code">,
  target: AssignTarget,
): Promise<StudentRow | null> {
  const run = async (column: string, value: string) => {
    const query = (select: string) =>
      supabase.from("students").select(select).eq("school_id", school.id).eq(column, value).maybeSingle();
    let result = await query(STUDENT_COLUMNS);
    if (result.error && isMissingColumnError(result.error, "course_id")) result = await query(STUDENT_COLUMNS_LEGACY);
    if (result.error) throw result.error;
    return (result.data as StudentRow | null) ?? null;
  };

  if (target.studentUuid) return run("id", target.studentUuid);

  const code = (target.studentCode ?? "").trim();
  if (!code) return null;
  const canonical = resolveNationalId(code, school.country_code ?? "CL").canonical;
  return (
    (canonical ? await run("rut_normalized", canonical) : null) ??
    (await run("student_id", code)) ??
    (await run("rut", code))
  );
}

/**
 * Asigna el paper al alumno. `overwrite` solo hace falta cuando una llamada
 * previa devolvio `conflict`.
 */
export async function assignPaperToStudent(
  supabase: MinimalClient,
  school: DashboardSchool,
  paperId: string,
  student: StudentRow,
  options: { overwrite?: boolean } = {},
): Promise<AssignResult> {
  const { data: paper, error: paperError } = await supabase
    .from("papers")
    .select("id,quiz_id,score,total,status,student_id,student_rut_norm,student_name,course_id")
    .eq("id", paperId)
    .eq("school_id", school.id)
    .maybeSingle();
  if (paperError || !paper) throw new Error("No se encontro el escaneo.");

  const studentCode = student.rut ?? student.student_id ?? "";
  const studentRutNorm =
    student.rut_normalized ?? resolveNationalId(studentCode, school.country_code ?? "CL").canonical;
  const studentName = student.name ?? "Sin nombre";

  // El alumno destino puede tener ya otro escaneo de este mismo ensayo.
  // `limit(1)` y no `maybeSingle()`: si hubiera mas de uno, maybeSingle tira
  // error y bloquearia la asignacion en vez de avisar de la colision.
  const { data: duplicates } = await supabase
    .from("papers")
    .select("id,score,total,scanned_at")
    .eq("school_id", school.id)
    .eq("quiz_id", paper.quiz_id)
    .eq("student_rut_norm", studentRutNorm ?? " ") // nunca matchea si no hay ID canonico
    .neq("id", paperId)
    .neq("status", "void")
    .order("scanned_at", { ascending: false })
    .limit(1);
  const duplicate = ((duplicates ?? []) as { id: string; score: number | null; total: number | null; scanned_at: string | null }[])[0] ?? null;

  if (duplicate && !options.overwrite) {
    return {
      ok: false,
      conflict: {
        paperId: duplicate.id,
        score: duplicate.score ?? null,
        total: duplicate.total ?? null,
        scannedAt: duplicate.scanned_at ?? null,
      },
    };
  }
  if (duplicate && options.overwrite) {
    await supabase.from("papers").update({ status: "void" }).eq("id", duplicate.id).eq("school_id", school.id);
    await deleteGradeRecord(supabase, school.id, paper.quiz_id as string, studentRutNorm);
  }

  const prev: PrevAssignment = {
    student_id: (paper.student_id as string | null) ?? null,
    student_rut_norm: (paper.student_rut_norm as string | null) ?? null,
    student_name: (paper.student_name as string | null) ?? null,
    status: (paper.status as string | null) ?? null,
    course_id: (paper.course_id as string | null) ?? null,
  };

  // La nota del alumno ANTERIOR no puede sobrevivir a la reasignacion.
  const previousCode = prev.student_rut_norm ?? (prev.student_id ? normalizeRut(prev.student_id) : null);
  if (previousCode && previousCode !== studentRutNorm) {
    await deleteGradeRecord(supabase, school.id, paper.quiz_id as string, previousCode);
  }

  await updatePaperTolerant(supabase, school.id, paperId, {
    student_id: studentCode || null,
    student_rut_norm: studentRutNorm,
    student_name: studentName,
    status: "corrected",
    course_id: student.course_id ?? null,
    prev_assignment: prev,
  });

  await upsertGradeRecord(supabase, school, {
    quizId: paper.quiz_id as string,
    paperId,
    studentCode: studentRutNorm ?? normalizeRut(studentCode),
    score: (paper.score as number | null) ?? 0,
    total: (paper.total as number | null) ?? 0,
  });

  return {
    ok: true,
    paperId,
    quizId: paper.quiz_id as string,
    studentName,
    courseId: student.course_id ?? null,
    ...(duplicate && options.overwrite ? { voidedPaperId: duplicate.id } : {}),
  };
}

/** Revierte la ultima asignacion manual usando `papers.prev_assignment`. */
export async function undoPaperAssignment(
  supabase: MinimalClient,
  school: DashboardSchool,
  paperId: string,
): Promise<{ quizId: string; restoredTo: string | null }> {
  const { data: paper, error } = await supabase
    .from("papers")
    .select("id,quiz_id,score,total,student_rut_norm,student_id,prev_assignment")
    .eq("id", paperId)
    .eq("school_id", school.id)
    .maybeSingle();
  if (error || !paper) throw new Error("No se encontro el escaneo.");
  const prev = paper.prev_assignment as PrevAssignment | null;
  if (!prev) throw new Error("Este escaneo no tiene una asignacion anterior que deshacer.");

  // La nota creada por la asignacion que estamos deshaciendo se va con ella.
  const currentCode =
    (paper.student_rut_norm as string | null) ?? (paper.student_id ? normalizeRut(paper.student_id as string) : null);
  if (currentCode) await deleteGradeRecord(supabase, school.id, paper.quiz_id as string, currentCode);

  await updatePaperTolerant(supabase, school.id, paperId, {
    student_id: prev.student_id,
    student_rut_norm: prev.student_rut_norm,
    student_name: prev.student_name,
    status: prev.status ?? "manual_review",
    course_id: prev.course_id,
    prev_assignment: null,
  });

  // Si el escaneo YA venia identificado antes (reasignacion), se le devuelve su nota.
  const previousCode = prev.student_rut_norm ?? (prev.student_id ? normalizeRut(prev.student_id) : null);
  if (previousCode && prev.status === "corrected") {
    await upsertGradeRecord(supabase, school, {
      quizId: paper.quiz_id as string,
      paperId,
      studentCode: previousCode,
      score: (paper.score as number | null) ?? 0,
      total: (paper.total as number | null) ?? 0,
    });
  }

  return { quizId: paper.quiz_id as string, restoredTo: prev.student_name };
}

// --- Helpers internos ---------------------------------------------

/** UPDATE que se degrada si la BD todavia no tiene las columnas nuevas. */
async function updatePaperTolerant(
  supabase: MinimalClient,
  schoolId: string,
  paperId: string,
  values: Record<string, unknown>,
) {
  const optional = ["course_id", "prev_assignment"] as const;
  const body = { ...values };
  for (let attempt = 0; attempt <= optional.length; attempt++) {
    const { error } = await supabase.from("papers").update(body).eq("id", paperId).eq("school_id", schoolId);
    if (!error) return;
    const missing = optional.find((col) => col in body && isMissingColumnError(error, col));
    if (!missing) throw error;
    console.warn(`[paper_assign] papers.${missing} no existe todavia (migracion pendiente)`);
    delete body[missing];
  }
  throw new Error("No se pudo actualizar el escaneo.");
}

export async function deleteGradeRecord(supabase: MinimalClient, schoolId: string, quizId: string, studentCode: string | null) {
  if (!studentCode) return;
  await supabase
    .from("grade_records")
    .delete()
    .eq("school_id", schoolId)
    .eq("quiz_id", quizId)
    .eq("student_code", studentCode);
}

export async function upsertGradeRecord(
  supabase: MinimalClient,
  school: DashboardSchool,
  args: { quizId: string; paperId: string; studentCode: string | null; score: number; total: number },
) {
  if (!args.studentCode) return;
  const gradeResult = calculateGrade(args.score, args.total, school.country_code ?? "CL", {
    gradeScale: { min: school.grading_scale_min ?? 1.0, max: school.grading_scale_max ?? 7.0 },
    passingGrade: school.passing_grade ?? 4.0,
    exigencia: school.exigencia ?? 0.6,
  });
  await supabase.from("grade_records").upsert(
    {
      school_id: school.id,
      student_code: args.studentCode,
      quiz_id: args.quizId,
      paper_id: args.paperId,
      raw_score: args.score,
      total_questions: args.total,
      calculated_grade: gradeResult.grade,
      passing: gradeResult.passing,
      graded_at: new Date().toISOString(),
    },
    { onConflict: "school_id,student_code,quiz_id" },
  );
}
