import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { computeQuizScore } from "@/lib/grading";
import { resolveNationalId } from "@/lib/national_id";
import { isMissingColumnError, isMissingTableError } from "@/lib/supabase_errors";
import { sendPushToSchool } from "@/lib/push_server";
import { QUIZ_MAX_QUESTIONS } from "@/lib/quiz_constraints";
import { assembleMultipageResult, type PageScanResult } from "@/lib/multipage";
import { resolveQuizForStudent } from "@/lib/quiz_batch";

type ScanAnswer = {
  q: number;
  a: string;
  s?: number[];
};

type ScanResultPayload = {
  quizId?: string;
  rut?: string;
  answers?: ScanAnswer[];
  photo?: string | null;
  warp?: string | null;
  source?: "camera" | "upload" | string;
  dvOk?: boolean;
  code?: unknown;
  nameImg?: string | null;
};

type StudentMatch = {
  id: string;
  student_id: string | null;
  rut: string | null;
  rut_normalized: string | null;
  name: string | null;
  // Curso del alumno: la hoja NO manda sobre el curso. Un curso puede rendir
  // con la hoja de otro (la del 2E para todo el nivel) y el resultado igual
  // tiene que quedar bajo el curso real del alumno.
  course_id?: string | null;
  course?: string | null;
};

/** Columnas del alumno que se leen al emparejar. `course_id,course` existen
 *  desde 20260704120000_course_id_links.sql; si la BD no las tiene todavia se
 *  reintenta sin ellas (misma degradacion silenciosa del resto del archivo). */
const STUDENT_SELECT = "id,student_id,rut,rut_normalized,name,course_id,course";
const STUDENT_SELECT_LEGACY = "id,student_id,rut,rut_normalized,name";

type DashboardCtx = Awaited<ReturnType<typeof getDashboardContext>>;
type SupabaseClient = DashboardCtx["supabase"];
type DashboardSchoolLite = { id: string; scans_used: number | null };

type QuizRow = {
  id: string;
  answer_key: string | null;
  num_questions: number | null;
  open_questions?: string | null;
  multi_select_questions?: string | null;
  evaluation_type: string | null;
  exigencia: number | null;
  sheet_code: number | null;
  batch_id?: string | null;
  /** Curso al que pertenece ESTE ensayo (cada fila de un lote tiene el suyo). */
  course_id?: string | null;
};

/** Columnas de un ensayo hermano: las mismas que necesita el resto del flujo. */
const SIBLING_SELECT = "id,batch_id,course_id,sheet_code,answer_key,num_questions,open_questions,multi_select_questions,evaluation_type,exigencia";

function normalizeAnswers(value: unknown): ScanAnswer[] {
  if (!Array.isArray(value)) return [];
  const answers: ScanAnswer[] = [];
  for (const item of value) {
    const row = item as Partial<ScanAnswer>;
    const q = Number(row.q);
    const a = String(row.a ?? "-").trim().toUpperCase() || "-";
    if (!Number.isInteger(q) || q < 1) continue;
    const answer: ScanAnswer = { q, a };
    if (Array.isArray(row.s)) answer.s = row.s.map(Number).filter(Number.isFinite);
    answers.push(answer);
  }
  return answers.sort((a, b) => a.q - b.q);
}

function trimDataUrl(value: string | null | undefined) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("data:image/")) return null;
  return value.length <= 750_000 ? value : null;
}

/** Decodifica el codigo de hoja leido por el cliente: sheetId + page/pagesTotal
 * (ya presentes en v1 y v2 del codec, ver src/tulector/sheet_code.ts). */
function readSheetPage(value: unknown): { sheetId: number; page: number; pagesTotal: number } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { sheetId?: unknown; page?: unknown; pagesTotal?: unknown };
  const sheetId = typeof v.sheetId === "number" ? v.sheetId : typeof v.sheetId === "string" ? Number(v.sheetId) : NaN;
  const page = typeof v.page === "number" ? v.page : typeof v.page === "string" ? Number(v.page) : NaN;
  const pagesTotal = typeof v.pagesTotal === "number" ? v.pagesTotal : typeof v.pagesTotal === "string" ? Number(v.pagesTotal) : NaN;
  if (!Number.isInteger(sheetId) || sheetId < 0) return null;
  if (!Number.isInteger(page) || page < 1) return null;
  if (!Number.isInteger(pagesTotal) || pagesTotal < 1) return null;
  return { sheetId, page, pagesTotal };
}

async function findStudentByCode(
  supabase: SupabaseClient,
  schoolId: string,
  studentRutNorm: string | null,
  candidateCodes: string[],
) {
  /** Un match por columna exacta, con reintento sin las columnas de curso. */
  const matchBy = async (column: string, value: string) => {
    const query = (select: string) =>
      supabase.from("students").select(select).eq("school_id", schoolId).eq(column, value).maybeSingle();

    let result = await query(STUDENT_SELECT);
    if (result.error && (isMissingColumnError(result.error, "course_id") || isMissingColumnError(result.error, "course"))) {
      result = await query(STUDENT_SELECT_LEGACY);
    }
    if (result.error) throw result.error;
    return (result.data as StudentMatch | null) ?? null;
  };

  if (studentRutNorm) {
    const byRutNorm = await matchBy("rut_normalized", studentRutNorm);
    if (byRutNorm) return byRutNorm;
  }

  for (const code of candidateCodes) {
    const byStudentId = await matchBy("student_id", code);
    if (byStudentId) return byStudentId;

    const byRut = await matchBy("rut", code);
    if (byRut) return byRut;
  }

  return null;
}

/**
 * Aviso de curso cruzado: el alumno pertenece a un curso distinto del que tiene
 * asignado el ensayo (un curso rindiendo con la hoja de otro). Devuelve `null`
 * cuando no hay nada que avisar.
 *
 * Va en consultas aparte, y no como una columna mas en la cascada de selects de
 * `quizzes`: solo corre cuando el alumno emparejado tiene curso propio, y si la
 * columna no existe se degrada a "sin aviso" en vez de romper el guardado.
 */
async function detectCourseMismatch(
  supabase: SupabaseClient,
  quizId: string,
  studentCourseId: string,
): Promise<{ studentCourse: string | null; quizCourse: string | null } | null> {
  const { data, error } = await supabase.from("quizzes").select("course_id").eq("id", quizId).maybeSingle();
  const quizCourseId = error ? null : ((data?.course_id as string | null) ?? null);
  if (!quizCourseId || quizCourseId === studentCourseId) return null;

  const { data: rows } = await supabase.from("courses").select("id,name").in("id", [quizCourseId, studentCourseId]);
  const nameById = new Map(((rows ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  return { studentCourse: nameById.get(studentCourseId) ?? null, quizCourse: nameById.get(quizCourseId) ?? null };
}

async function findExistingPaper(
  supabase: SupabaseClient,
  schoolId: string,
  quizId: string,
  studentRutNorm: string | null,
  candidateCodes: string[],
) {
  if (studentRutNorm) {
    const { data, error } = await supabase
      .from("papers")
      .select("id")
      .eq("school_id", schoolId)
      .eq("quiz_id", quizId)
      .eq("student_rut_norm", studentRutNorm)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  for (const code of candidateCodes) {
    const { data, error } = await supabase
      .from("papers")
      .select("id")
      .eq("school_id", schoolId)
      .eq("quiz_id", quizId)
      .eq("student_id", code)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  return null;
}

/** Columnas de `papers` que llegaron en migraciones posteriores y pueden faltar
 *  en una BD sin migrar. Se escriben si existen; si no, se van cayendo una a una. */
const OPTIONAL_PAPER_COLUMNS = ["sheet_code_read", "course_id"] as const;

/**
 * Inserta (o actualiza) el paper, reintentando SIN las columnas opcionales que
 * la BD todavia no tenga. Reemplaza los pares de payload "con y sin columna X"
 * que habia antes: agregar una columna nueva ya no duplica el bloque de escritura.
 */
async function writePaper(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  target?: { update: string },
): Promise<string> {
  const body = { ...payload };
  // Un reintento por columna opcional, mas el intento inicial.
  for (let attempt = 0; attempt <= OPTIONAL_PAPER_COLUMNS.length; attempt++) {
    const result = target
      ? await supabase.from("papers").update(body).eq("id", target.update).select("id").single()
      : await supabase.from("papers").insert(body).select("id").single();
    if (!result.error) return result.data.id as string;

    const missing = OPTIONAL_PAPER_COLUMNS.find((col) => col in body && isMissingColumnError(result.error, col));
    if (!missing) throw result.error;
    console.warn(`[scan/result] papers.${missing} no existe todavia (migracion pendiente); se guarda sin esa columna`);
    delete body[missing];
  }
  throw new Error("No se pudo guardar el paper");
}

/** Suma 1 a scans_used de forma best-effort (no atomico -- mismo criterio
 * pragmatico que el resto del archivo; el uso real es un profesor escaneando
 * paginas de a una desde un solo telefono, la carrera es improbable). Solo se
 * llama para una pagina NUEVA que NO complete el ensayo (si completa, el
 * INSERT en `papers` ya dispara on_paper_insert_increment_scan_usage). */
async function incrementScansUsed(supabase: SupabaseClient, school: DashboardSchoolLite): Promise<void> {
  try {
    const { data } = await supabase.from("schools").select("scans_used").eq("id", school.id).single();
    const current = data?.scans_used ?? school.scans_used ?? 0;
    await supabase.from("schools").update({ scans_used: current + 1 }).eq("id", school.id);
  } catch (e) {
    console.warn("[scan/result] no se pudo incrementar scans_used (pagina parcial):", e);
  }
}

/**
 * Calcula nota/puntaje, empareja alumno, y persiste el resultado FINAL en
 * `papers`+`grade_records`. Compartida entre el camino de 1 pagina (answers =
 * lo escaneado, numeracion local=global) y el cierre de un ensayo multipagina
 * (answers = assembleMultipageResult(...).answers, ya en numeracion global) --
 * ver docs/plan-multipagina-fase1.md, evita duplicar esta logica dos veces.
 */
async function finalizeGrading(
  ctx: { supabase: SupabaseClient; user: DashboardCtx["user"]; school: DashboardCtx["school"] },
  quiz: QuizRow,
  identity: { studentCode: string; studentRutNorm: string | null; legacyStudentCode: string; candidateCodes: string[] },
  answers: ScanAnswer[],
  extras: { sheetIdRead: number | null; photo: string | null | undefined; nameImg: string | null | undefined; countryCode: string },
) {
  const { supabase, user, school } = ctx;
  let expectedSheetCode = typeof quiz.sheet_code === "number" ? quiz.sheet_code : null;
  let sheetMismatch = extras.sheetIdRead !== null && expectedSheetCode !== null && extras.sheetIdRead !== expectedSheetCode;

  // Hoja "hermana" del mismo lote multi-curso (ver batch_id, createQuiz en
  // dashboard/actions.ts): mismo contenido/clave, otro curso, su propio
  // sheet_code -- si la hoja escaneada no calza con el ensayo activo pero SI
  // pertenece a un hermano de su mismo batch_id, se re-resuelve `quiz` hacia
  // ese hermano y se procesa normal (nota valida), en vez de mandarla siempre
  // a manual_review. Una hoja de un ensayo genuinamente distinto (batch_id
  // distinto o sin batch_id) sigue cayendo en manual_review como siempre --
  // la proteccion "hoja correcta" (indice unico school_id+sheet_code) no se
  // debilita, solo se hace la busqueda un paso mas amplia.
  if (sheetMismatch && quiz.batch_id) {
    const { data: sibling } = await supabase
      .from("quizzes")
      .select(SIBLING_SELECT)
      .eq("school_id", school.id)
      .eq("batch_id", quiz.batch_id)
      .eq("sheet_code", extras.sheetIdRead)
      .is("archived_at", null)
      .maybeSingle();
    if (sibling) {
      quiz = sibling as QuizRow;
      expectedSheetCode = typeof quiz.sheet_code === "number" ? quiz.sheet_code : null;
      sheetMismatch = extras.sheetIdRead !== null && expectedSheetCode !== null && extras.sheetIdRead !== expectedSheetCode;
    }
  }

  const { studentCode, studentRutNorm, legacyStudentCode, candidateCodes } = identity;
  let studentName: string | null = null;
  let matchedStudent = false;
  // Curso del ALUMNO (no el de la hoja): se congela en el paper al escanear, asi
  // el historico no se reescribe si despues se traslada de curso.
  let courseId: string | null = null;
  let courseMismatch: { studentCourse: string | null; quizCourse: string | null } | undefined;

  if (studentCode) {
    const student = await findStudentByCode(supabase, school.id, studentRutNorm, candidateCodes);
    if (student) {
      matchedStudent = true;
      studentName = student.name ?? null;
      courseId = student.course_id ?? null;

      // ── El resultado sigue al ALUMNO, no a la hoja ──────────────────────
      // Con un lote multi-curso (misma prueba impresa por curso), la hoja del
      // 2E usada para corregir a un alumno del 2C debe quedar en el ensayo del
      // 2C. Antes se quedaba donde apuntaba la HOJA y el 2E terminaba con
      // alumnos de todo el nivel. Ver src/lib/quiz_batch.ts.
      let rerouted = false;
      if (quiz.batch_id && courseId && quiz.course_id !== courseId) {
        const { data: siblings } = await supabase
          .from("quizzes")
          .select(SIBLING_SELECT)
          .eq("school_id", school.id)
          .eq("batch_id", quiz.batch_id)
          .is("archived_at", null);
        const decision = resolveQuizForStudent(quiz, courseId, (siblings ?? []) as QuizRow[]);
        if (decision.kind === "rerouted") {
          quiz = decision.quiz;
          rerouted = true;
          // La hoja es de otro ensayo DEL MISMO LOTE: contenido identico, no es
          // "hoja equivocada". El aviso de hoja incorrecta se apaga aqui a
          // proposito -- si no, todo el nivel corregido con una sola hoja
          // caeria en revision manual.
          expectedSheetCode = typeof quiz.sheet_code === "number" ? quiz.sheet_code : null;
          sheetMismatch = false;
        }
      }

      // Aviso SUAVE de curso cruzado: solo si NO se pudo re-enrutar (ensayo
      // independiente, alumno de un curso sin ensayo en el lote). Si la hoja ya
      // quedo en el ensayo de su curso no hay nada que avisar.
      if (courseId && !rerouted) {
        const mismatch = await detectCourseMismatch(supabase, quiz.id, courseId);
        // `students.course` (texto libre) como respaldo del nombre del curso del
        // alumno: filas viejas pueden tener el texto y no el curso normalizado.
        if (mismatch) courseMismatch = { ...mismatch, studentCourse: mismatch.studentCourse ?? student.course ?? null };
      }
    }
  }

  // El puntaje se calcula con el ensayo FINAL (tras el re-enrutado): los
  // hermanos comparten clave y formato, pero la nota debe salir del ensayo en el
  // que la hoja realmente queda guardada.
  const { score, total, grade, passing, equivalentScore: eqScore } = computeQuizScore(quiz, answers, school, extras.countryCode);

  const status = sheetMismatch || !studentCode || !matchedStudent ? "manual_review" : "corrected";
  const scannedAt = new Date().toISOString();
  const paperPayload: Record<string, unknown> = {
    school_id: school.id,
    quiz_id: quiz.id,
    user_id: user.id,
    student_id: studentCode || null,
    student_rut_norm: studentRutNorm,
    student_name: studentName ?? (studentCode ? "Sin identificar" : "Sin RUT"),
    score,
    total,
    answers: answers.map((answer) => ({ q: answer.q, a: answer.a })),
    raw_scores: answers.map((answer) => ({ q: answer.q, a: answer.a, s: answer.s ?? [] })),
    image_url: trimDataUrl(extras.photo),
    name_img_url: trimDataUrl(extras.nameImg),
    status,
    grade,
    equivalent_score: eqScore,
    scanned_at: scannedAt,
    corrected_answers: [],
    // Columnas de migraciones posteriores: si la BD todavia no las tiene, se
    // reintenta sin ellas (ver writePaper). Nunca deben tumbar un escaneo.
    sheet_code_read: extras.sheetIdRead,
    course_id: courseId,
  };

  let paperId: string | null = null;
  let action: "inserted" | "updated" = "inserted";

  if (studentCode) {
    const existing = await findExistingPaper(supabase, school.id, quiz.id, studentRutNorm, candidateCodes);
    if (existing?.id) {
      paperId = await writePaper(supabase, paperPayload, { update: existing.id });
      action = "updated";
    }
  }

  if (!paperId) paperId = await writePaper(supabase, paperPayload);

  const studentRecordCode = studentRutNorm ?? legacyStudentCode;
  // Una hoja de otro ensayo queda en revision y no debe convertirse en nota valida.
  if (studentRecordCode && !sheetMismatch) {
    await supabase.from("grade_records").upsert({
      school_id: school.id,
      student_code: studentRecordCode,
      quiz_id: quiz.id,
      paper_id: paperId,
      raw_score: score,
      total_questions: total,
      calculated_grade: grade,
      passing,
      graded_at: scannedAt,
    }, { onConflict: "school_id,student_code,quiz_id" });
  }

  return {
    action, paperId, status, matchedStudent, studentName,
    studentCode: studentCode || null, studentRutNorm,
    score, total, grade, equivalentScore: eqScore,
    sheetMismatch: sheetMismatch ? { read: extras.sheetIdRead, expected: expectedSheetCode } : undefined,
    courseMismatch,
  };
}

/** Lee el valor actual de scans_used para armar la alerta de cuota (el
 * trigger on_paper_insert, o incrementScansUsed en la rama multipagina, ya
 * hicieron el incremento -- esto solo lee para avisar). */
async function readQuotaStatus(supabase: SupabaseClient, school: DashboardCtx["school"]) {
  try {
    const { data: schoolRow, error: quotaError } = await supabase
      .from("schools")
      .select("scans_used")
      .eq("id", school.id)
      .single();
    if (quotaError) return null;
    const used = schoolRow?.scans_used ?? (school.scans_used ?? 0) + 1;
    const limit = school.scans_limit ?? 0;
    let warning: string | null = null;
    if (limit > 0 && used >= limit) warning = `Cuota de escaneos agotada (${used}/${limit}). Amplia tu plan en Facturacion.`;
    else if (limit > 0 && used >= limit * 0.9) warning = `Cuota casi agotada (${used}/${limit}).`;

    if (limit > 0 && used >= limit * 0.9) {
      void sendPushToSchool(school.id, {
        title: used >= limit ? "Cuota de escaneos agotada" : "Cuota de escaneos casi agotada",
        body: used >= limit
          ? `Alcanzaste el limite de ${limit} escaneos. Sube de plan para seguir escaneando.`
          : `Has usado ${used} de ${limit} escaneos. Queda poco para llegar al limite.`,
        data: { type: "quota", used: String(used), limit: String(limit) },
      });
    }
    return { used, limit, warning };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 2 * 1024 * 1024) { // 2MB maximo para evitar DoS
      return NextResponse.json({ error: "El payload es demasiado grande (max 2MB)." }, { status: 413 });
    }

    const payload = (await request.json().catch(() => null)) as ScanResultPayload | null;
    if (!payload) return NextResponse.json({ error: "Payload invalido" }, { status: 400 });

    const quizId = String(payload.quizId ?? "").trim();
    const answers = normalizeAnswers(payload.answers);
    if (!quizId) return NextResponse.json({ error: "Falta quizId" }, { status: 400 });
    if (answers.length === 0) return NextResponse.json({ error: "No hay respuestas para guardar" }, { status: 400 });

    const { supabase, user, school } = await getDashboardContext();

    let quizResult = await supabase
      .from("quizzes")
      .select("id,school_id,title,answer_key,num_questions,open_questions,multi_select_questions,evaluation_type,evaluation_variant,sheet_code,exigencia,batch_id,course_id")
      .eq("id", quizId)
      .eq("school_id", school.id)
      .is("archived_at", null)
      .single();

    if (quizResult.error && (isMissingColumnError(quizResult.error, "batch_id") || isMissingColumnError(quizResult.error, "course_id"))) {
      // BD sin migrar (batch_id/course_id): degradacion silenciosa -- sin estas
      // columnas no hay lote que reconocer, asi que ni se re-enruta por curso ni
      // se auto-resuelve una hoja hermana (comportamiento previo).
      quizResult = await supabase
        .from("quizzes")
        .select("id,school_id,title,answer_key,num_questions,open_questions,multi_select_questions,evaluation_type,evaluation_variant,sheet_code,exigencia")
        .eq("id", quizId)
        .eq("school_id", school.id)
        .is("archived_at", null)
        .single();
    }

    if (quizResult.error && isMissingColumnError(quizResult.error, "multi_select_questions")) {
      quizResult = await supabase
        .from("quizzes")
        .select("id,school_id,title,answer_key,num_questions,open_questions,evaluation_type,evaluation_variant,sheet_code,exigencia")
        .eq("id", quizId)
        .eq("school_id", school.id)
        .is("archived_at", null)
        .single();
    }

    if (quizResult.error && isMissingColumnError(quizResult.error, "open_questions")) {
      quizResult = await supabase
        .from("quizzes")
        .select("id,school_id,title,answer_key,num_questions,evaluation_type,evaluation_variant,sheet_code,exigencia")
        .eq("id", quizId)
        .eq("school_id", school.id)
        .is("archived_at", null)
        .single();
    }

    if (quizResult.error && isMissingColumnError(quizResult.error, "sheet_code")) {
      quizResult = await supabase
        .from("quizzes")
        .select("id,school_id,title,answer_key,num_questions,evaluation_type,evaluation_variant,exigencia")
        .eq("id", quizId)
        .eq("school_id", school.id)
        .is("archived_at", null)
        .single();
    }

    const { data: quiz, error: quizError } = quizResult;

    if (quizError || !quiz) return NextResponse.json({ error: "Ensayo no disponible" }, { status: 404 });

    const rawRut = String(payload.rut ?? "").trim();
    const countryCode = school.country_code ?? "CL";
    const resolvedId = resolveNationalId(rawRut, countryCode);
    const studentCode = rawRut;
    const legacyStudentCode = rawRut ? resolvedId.normalized : "";
    const studentRutNorm = resolvedId.canonical;
    const candidateCodes = Array.from(new Set([studentCode, legacyStudentCode].filter(Boolean)));

    const codeR = readSheetPage(payload.code);
    const total = Number(quiz.num_questions ?? answers.length);
    // Multipagina (Fase 1): pagesTotal se DERIVA de num_questions, nunca de lo
    // impreso en la hoja -- una sola fuente de verdad, ver
    // docs/plan-multipagina-fase1.md. pagesTotal<=1 (el 100% del trafico real
    // de hoy) corre exactamente el camino de siempre, sin ninguna rama nueva.
    const pagesTotal = Math.max(1, Math.ceil(total / QUIZ_MAX_QUESTIONS));

    if (pagesTotal > 1) {
      if (!studentCode || !codeR) {
        // Sin ID legible o sin codigo de hoja no hay forma segura de saber a
        // que pagina del ensayo corresponde este escaneo -- a revision manual,
        // sin tocar paper_pages/papers/grade_records.
        return NextResponse.json({
          ok: true,
          status: "manual_review",
          matchedStudent: false,
          studentName: null,
          studentCode: studentCode || null,
          multipage: { complete: false, reason: !studentCode ? "sin_id" : "sin_codigo_hoja" },
        });
      }

      const globalAnswers = answers
        .map((a) => ({ ...a, q: (codeR.page - 1) * QUIZ_MAX_QUESTIONS + a.q }))
        .filter((a) => a.q <= total);

      // Nota: las paginas parciales se acumulan bajo el ensayo ESCANEADO. El
      // re-enrutado por curso ocurre dentro de finalizeGrading, al cerrar el
      // ensayo, asi que el paper final si queda en el ensayo del curso del
      // alumno. Solo aplica a ensayos multipagina (>100 preguntas) dentro de un
      // lote multi-curso, combinacion que hoy no existe en produccion.

      const { data: existingPage, error: existingPageError } = await supabase
        .from("paper_pages")
        .select("id")
        .eq("quiz_id", quiz.id)
        .eq("student_code_norm", legacyStudentCode)
        .eq("page", codeR.page)
        .maybeSingle();

      // Degradacion elegante: si la migracion de paper_pages todavia no se
      // aplico en produccion (ver docs/plan-multipagina-fase1.md), no tirar
      // 500 -- a revision manual sin tocar nada, igual que "sin_id".
      if (existingPageError && isMissingTableError(existingPageError, "paper_pages")) {
        console.warn("[scan/result] paper_pages no existe todavia (migracion pendiente)");
        return NextResponse.json({
          ok: true,
          status: "manual_review",
          matchedStudent: false,
          studentName: null,
          studentCode,
          multipage: { complete: false, reason: "tabla_pendiente" },
        });
      }
      const isNewPage = !existingPage;

      const { error: pageUpsertError } = await supabase.from("paper_pages").upsert({
        school_id: school.id,
        quiz_id: quiz.id,
        student_code_norm: legacyStudentCode,
        student_code_raw: studentCode,
        sheet_id: codeR.sheetId,
        page: codeR.page,
        pages_total: pagesTotal,
        answers: globalAnswers.map((a) => ({ q: a.q, a: a.a })),
        scanned_at: new Date().toISOString(),
      }, { onConflict: "quiz_id,student_code_norm,page" });
      if (pageUpsertError) throw pageUpsertError;

      const { data: pageRows } = await supabase
        .from("paper_pages")
        .select("page,pages_total,sheet_id,answers,scanned_at")
        .eq("quiz_id", quiz.id)
        .eq("student_code_norm", legacyStudentCode);

      const assembled = assembleMultipageResult((pageRows ?? []).map((row): PageScanResult => ({
        page: row.page,
        pagesTotal: row.pages_total,
        sheetId: row.sheet_id,
        studentCode: legacyStudentCode,
        answers: (row.answers ?? []) as { q: number; a: string }[],
        scannedAt: row.scanned_at,
      })));

      if (!assembled.complete) {
        if (isNewPage) await incrementScansUsed(supabase, school);
        return NextResponse.json({
          ok: true,
          matchedStudent: false,
          studentName: null,
          studentCode,
          multipage: {
            complete: false,
            page: codeR.page,
            pagesTotal,
            pagesPresent: assembled.pagesPresent,
            missingPages: assembled.missingPages,
          },
        });
      }

      const result = await finalizeGrading(
        { supabase, user, school },
        quiz as QuizRow,
        { studentCode, studentRutNorm, legacyStudentCode, candidateCodes },
        assembled.answers,
        { sheetIdRead: codeR.sheetId, photo: payload.photo, nameImg: payload.nameImg, countryCode },
      );
      // El INSERT en `papers` (si action==="inserted") ya dispara
      // on_paper_insert_increment_scan_usage -- no sumar cupo de nuevo aca
      // aunque esta pagina fuera nueva (evitar cobrar 2 veces la ultima pagina).
      const quota = await readQuotaStatus(supabase, school);

      return NextResponse.json({
        ok: true,
        ...result,
        multipage: { complete: true, page: codeR.page, pagesTotal, pagesPresent: assembled.pagesPresent, missingPages: [] },
        quota,
      });
    }

    // ── Camino de 1 pagina (hoy, sin cambios de comportamiento) ──
    const result = await finalizeGrading(
      { supabase, user, school },
      quiz as QuizRow,
      { studentCode, studentRutNorm, legacyStudentCode, candidateCodes },
      answers,
      { sheetIdRead: codeR?.sheetId ?? null, photo: payload.photo, nameImg: payload.nameImg, countryCode },
    );
    const quota = await readQuotaStatus(supabase, school);

    return NextResponse.json({ ok: true, ...result, quota });
  } catch (error) {
    console.error("[scan/result]", error);
    return NextResponse.json({ error: "No se pudo guardar el resultado" }, { status: 500 });
  }
}
