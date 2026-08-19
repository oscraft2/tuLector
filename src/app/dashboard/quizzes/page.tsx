import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages, formatDate } from "@/locales";
import { DataTable } from "@/components/dashboard/DataTable";
import { archiveQuiz, duplicateQuiz, startScanForQuiz } from "@/app/dashboard/actions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { QuizCreateForm } from "@/components/dashboard/QuizCreateForm";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { isMissingColumnError } from "@/lib/supabase_errors";
import { resolveCountryProfile } from "@/lib/country_profiles";
import { parseSheetMode } from "@/lib/sheet_mode";
import { isAnswerKeyIncomplete } from "@/lib/quiz_constraints";
import { applyTeacherScope, fetchTeacherOptions, parseTeacherScope, resolveScope } from "@/lib/teacher_scope";
import { TeacherScopeFilter } from "@/components/dashboard/TeacherScopeFilter";
import { countPendingShares, fetchSharesForUser, fetchUserEmails, userLabel } from "@/lib/quiz_shares";
import { planHasFeature } from "@/lib/plan_gates";

export const dynamic = "force-dynamic";

const DUP_CLS = "rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold hover:bg-gray-50";
const ARCH_CLS = "rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50";
const DUP_CLS_M = "rounded-md border border-[#cfd6df] px-3 py-2 text-xs font-semibold hover:bg-gray-50";
const ARCH_CLS_M = "rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50";
const EXPORT_CLS = "rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50";
const EXPORT_CLS_M = "rounded-md border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50";
const EXPORT_CLS_DISABLED = "pointer-events-none rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold text-[#9aa3af] opacity-60";
const EXPORT_CLS_DISABLED_M = "pointer-events-none rounded-md border border-[#cfd6df] px-3 py-2 text-xs font-semibold text-[#9aa3af] opacity-60";

function ExportDiaLink({ quizId, hasPapers, mobile = false }: { quizId: string; hasPapers: boolean; mobile?: boolean }) {
  const cls = hasPapers ? (mobile ? EXPORT_CLS_M : EXPORT_CLS) : (mobile ? EXPORT_CLS_DISABLED_M : EXPORT_CLS_DISABLED);
  return (
    <a href={hasPapers ? `/api/quiz/${quizId}/export-dia` : undefined} aria-disabled={!hasPapers} className={cls}>
      Exportar DIA
    </a>
  );
}

/** Descarga rapida de RUT + Alumno + Correctas en Excel, sin entrar al detalle
 *  del ensayo a tildar columnas -- reusa tal cual /api/export/results/[quizId]
 *  (mismo catalogo de columnas que el panel "Exportar resultados" del
 *  detalle, ExportPanel.tsx). Requiere admin porque la ruta ya lo exige. */
function ExportExcelLink({ quizId, hasPapers, mobile = false }: { quizId: string; hasPapers: boolean; mobile?: boolean }) {
  const cls = hasPapers ? (mobile ? EXPORT_CLS_M : EXPORT_CLS) : (mobile ? EXPORT_CLS_DISABLED_M : EXPORT_CLS_DISABLED);
  const href = `/api/export/results/${quizId}?cols=rut,student_name,correct&fmt=xlsx`;
  return (
    <a href={hasPapers ? href : undefined} aria-disabled={!hasPapers} className={cls}>
      RUT/Nombre/Correctas (Excel)
    </a>
  );
}

type QuizRow = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  course_id?: string | null;
  /** Autor del ensayo. Distingue "mio" de "me lo compartieron" (quiz_shares). */
  created_by?: string | null;
  num_questions: number | null;
  options_per_question: number | null;
  answer_key: string | null;
  /** CSV de preguntas de desarrollo ("27,29,33"); su "-" en la clave NO es un
   *  hueco (ver isAnswerKeyIncomplete). Ausente en una BD sin esa migracion. */
  open_questions?: string | null;
  created_at: string;
  /** 'full' | 'compact'; ausente en una BD sin la migracion sheet_mode. */
  sheet_mode?: string | null;
};

// El criterio vive en quiz_constraints (unico para listado y detalle): una
// pregunta de desarrollo lleva "-" en la clave por definicion, asi que buscar
// "-" a secas marcaba "Clave incompleta" en todo ensayo con abiertas.
const isKeyIncomplete = isAnswerKeyIncomplete;

/** Un ensayo de bloque compacto se genera en /bloque, no en /sheet. */
function isCompactQuiz(quiz: Pick<QuizRow, "sheet_mode">) {
  return parseSheetMode(quiz.sheet_mode) === "compact";
}
const sheetHref = (quiz: QuizRow) => (isCompactQuiz(quiz) ? `/bloque?quiz=${quiz.id}` : `/sheet?quiz=${quiz.id}`);
const sheetLabel = (quiz: QuizRow) => (isCompactQuiz(quiz) ? "Bloque" : "Hoja");

type CourseRow = { id: string; name: string; grade: string | null };

export default async function QuizzesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, user, locale, school, isAdmin } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const sp = (await searchParams) ?? {};

  // De quien son los ensayos que se listan. Un admin de plan school ve SOLO los
  // suyos por defecto (antes veia mezclados los de todos los docentes) y cambia
  // el foco con el selector; un docente no-admin ya esta aislado por RLS.
  const requested = parseTeacherScope(sp, { userId: user.id, isAdmin, plan: school.plan });
  const teachers = requested.canSwitch ? await fetchTeacherOptions(supabase, school.id, user.id) : [];
  const scope = resolveScope(requested, teachers.length);

  // Ensayos de otros docentes que acepte (quiz_shares). La RLS ya me los deja
  // ver; esto sirve para que el filtro por autor del admin no los esconda y
  // para marcarlos en la tabla como ajenos.
  const sharingOn = planHasFeature(school.plan, "quiz_sharing");
  const [incomingShares, pendingShares] = sharingOn
    ? await Promise.all([
        fetchSharesForUser(supabase, school.id, user.id, ["accepted"]),
        countPendingShares(supabase, school.id, user.id),
      ])
    : [[], 0];
  const sharedQuizIds = incomingShares.map((s) => s.quiz_id);
  const sharedById = new Map(incomingShares.map((s) => [s.quiz_id, s.shared_by]));

  const quizzesQuery = (columns: string) =>
    applyTeacherScope(
      supabase.from("quizzes").select(columns).is("archived_at", null).order("created_at", { ascending: false }),
      scope,
      sharedQuizIds,
    );

  // Columnas que llegaron en migraciones posteriores: se piden todas y, si la BD
  // no tiene alguna, se suelta esa y se reintenta. Antes era una cascada de
  // fallbacks escrita a mano, que habia que ampliar con cada columna nueva.
  const BASE_COLUMNS = "id,title,subject,grade,num_questions,options_per_question,answer_key,created_at,archived_at,created_by";
  const OPTIONAL_COLUMNS = ["sheet_mode", "course_id", "open_questions"];

  const loadQuizzes = async () => {
    const optional = [...OPTIONAL_COLUMNS];
    for (let attempt = 0; attempt <= OPTIONAL_COLUMNS.length; attempt++) {
      const result = await quizzesQuery([BASE_COLUMNS, ...optional].join(","));
      if (!result.error) return result.data;
      const missing = optional.find((col) => isMissingColumnError(result.error, col));
      if (!missing) return null;
      optional.splice(optional.indexOf(missing), 1);
    }
    return null;
  };

  const [quizzesData, { data: courses }] = await Promise.all([
    loadQuizzes(),
    supabase.from("courses").select("id,name,grade").is("archived_at", null).order("name"),
  ]);

  const courseList = (courses ?? []) as CourseRow[];
  const quizzes = (quizzesData ?? []) as unknown as QuizRow[];
  const courseNameById = new Map(courseList.map((course) => [course.id, course.name]));

  // Conteo liviano (solo quiz_id, sin `answers`) para saber que ensayos ya
  // tienen algo que exportar -- evita cargar answers de TODOS los ensayos
  // del colegio solo para pintar la lista.
  const quizIds = quizzes.map((q) => q.id);
  const papersCountByQuiz = new Map<string, number>();
  if (quizIds.length > 0) {
    const { data: paperRows } = await supabase.from("papers").select("quiz_id").in("quiz_id", quizIds);
    for (const row of paperRows ?? []) {
      papersCountByQuiz.set(row.quiz_id, (papersCountByQuiz.get(row.quiz_id) ?? 0) + 1);
    }
  }
  // Correos de los dueños de los ensayos ajenos, para el pill "Compartido por".
  const ownerEmails = await fetchUserEmails([...sharedById.values()].filter((v): v is string => Boolean(v)));
  /** Un ensayo ajeno aceptado: se muestra pero sin las acciones de dueño. */
  const isSharedWithMe = (quiz: QuizRow) => sharedById.has(quiz.id) && quiz.created_by !== user.id;
  const sharedByLabel = (quiz: QuizRow) => userLabel(sharedById.get(quiz.id) ?? null, ownerEmails);

  const countryProfile = resolveCountryProfile(school.country_code ?? "CL");
  // El texto de ayuda no puede nombrar PAES/SIMCE (Chile) para un colegio de
  // otro pais -- usa los sistemas de evaluacion reales de su perfil.
  const evaluationHint = countryProfile.code === "CL"
    ? "personalizada, PAES, SIMCE o DIA"
    : `personalizada o ${countryProfile.evaluationSystems.map((s) => s.replace(/_/g, " ")).join("/")}`;

  return (
    <>
      <PageHeader title={t.quizzes} description="Crea ensayos, define claves, duplica instrumentos y genera hojas v2 imprimibles para leerlas luego desde la app movil." />

      <TeacherScopeFilter scope={scope} teachers={teachers} basePath="/dashboard/quizzes" searchParams={sp} />

      {/* Ensayos que un colega me compartio y todavia no acepto: hasta que
          acepte, la RLS no me los muestra en ninguna parte. */}
      {sharingOn && pendingShares > 0 && (
        <p className="mb-5 rounded-md border border-[#c7d7ee] bg-[#eef4ff] px-4 py-3 text-sm text-[#07305f]">
          🤝 Tienes <strong>{pendingShares}</strong> ensayo{pendingShares === 1 ? "" : "s"} compartido{pendingShares === 1 ? "" : "s"} esperando tu respuesta.{" "}
          <Link href="/dashboard/quizzes/compartidos" className="font-semibold underline">Ver y aceptar</Link>
        </p>
      )}

      {/* Camino corto para quien corrige una prueba propia (con un bloque
          compacto pegado) y no necesita ensayo, alumnos ni notas guardadas. */}
      <p className="mb-5 rounded-md border border-[#e6e8eb] bg-white px-4 py-3 text-sm text-[#5b6472]">
        ¿Solo quieres corregir una prueba tuya sin crear el ensayo?{" "}
        <Link href="/bloque" className="font-semibold text-[#07305f] hover:underline">Genera un bloque compacto</Link>,
        pégalo en tu documento y usa la{" "}
        <Link href="/scan/rapido" className="font-semibold text-[#07305f] hover:underline">corrección rápida</Link>:
        ingresas la pauta una vez y escaneas hoja tras hoja, sin identificar alumnos.
      </p>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,450px)_minmax(0,1fr)] xl:gap-6">

        {/* Left Column: Create Quiz Form (cliente: toast + estado "Creando…") */}
        {quizzes.length === 0 && (
          <p className="rounded-md border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-blue-800">
            Un ensayo define las preguntas, la clave de respuestas y el tipo de evaluacion ({evaluationHint}). Al crearlo podras generar su hoja imprimible y escanearla desde la app movil.
          </p>
        )}
        <QuizCreateForm courses={courseList} countryCode={school.country_code ?? "CL"} isAdmin={isAdmin} />

        {/* Right Column: Quiz Datatable */}
        <DataTable
          columns={["Ensayo", "Asignatura", "Curso", "Formato", "Creado", "Acciones"]}
          rows={quizzes}
          empty="Todavía no hay ensayos creados en el establecimiento."
          renderRow={(quiz) => (
            <tr key={quiz.id} className="border-b border-[#eef0f3] last:border-0">
              <td className="px-5 py-4 font-semibold">
                <Link href={`/dashboard/quizzes/${quiz.id}`} className="hover:underline text-[#07305f]">
                  {quiz.title}
                </Link>
                {isKeyIncomplete(quiz) && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Clave incompleta</span>
                )}
                {isSharedWithMe(quiz) && (
                  <span className="ml-2 rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-semibold text-[#07305f]">
                    Compartido por {sharedByLabel(quiz)}
                  </span>
                )}
              </td>
              <td className="px-5 py-4 text-[#5b6472]">{quiz.subject ?? "-"}</td>
              <td className="px-5 py-4">
                <span className="rounded bg-[#f4f6f8] px-2 py-0.5 text-xs font-semibold text-[#1e293b]">
                  {courseLabel(quiz, courseNameById)}
                </span>
              </td>
              <td className="px-5 py-4 text-[#5b6472]">{quiz.num_questions}x{quiz.options_per_question ?? 5}</td>
              <td className="px-5 py-4 text-xs text-[#5b6472]">{formatDate(quiz.created_at, locale)}</td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <Link href={sheetHref(quiz)} className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
                    {sheetLabel(quiz)}
                  </Link>
                  <form action={startScanForQuiz}>
                    <input type="hidden" name="quiz_id" value={quiz.id} />
                    <button className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
                      Escanear
                    </button>
                  </form>
                  <ExportDiaLink quizId={quiz.id} hasPapers={(papersCountByQuiz.get(quiz.id) ?? 0) > 0} />
                  {isAdmin && <ExportExcelLink quizId={quiz.id} hasPapers={(papersCountByQuiz.get(quiz.id) ?? 0) > 0} />}
                  {/* Duplicar y archivar son del dueño: sobre un ensayo ajeno
                      la RLS los rechazaria (archivar) o crearia una copia que
                      parte la base en dos (duplicar), que es justo lo que esta
                      feature viene a evitar. */}
                  {!isSharedWithMe(quiz) && (
                    <>
                      <ActionButton
                        action={duplicateQuiz}
                        fields={{ id: quiz.id }}
                        label="Duplicar"
                        pendingLabel="Duplicando…"
                        className={DUP_CLS}
                      />
                      <ActionButton
                        action={archiveQuiz}
                        fields={{ id: quiz.id }}
                        label="Archivar"
                        pendingLabel="Archivando…"
                        className={ARCH_CLS}
                        confirm={`¿Archivar "${quiz.title}"? Podrás recuperarlo desde archivados.`}
                        confirmTitle="¿Archivar ensayo?"
                        confirmLabel="Archivar"
                      />
                    </>
                  )}
                </div>
              </td>
            </tr>
          )}
          renderMobileRow={(quiz) => (
            <article key={quiz.id} className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
              <Link href={`/dashboard/quizzes/${quiz.id}`} className="block text-base font-semibold text-[#07305f] hover:underline">{quiz.title}</Link>
              {isKeyIncomplete(quiz) && (
                <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Clave incompleta</span>
              )}
              {isSharedWithMe(quiz) && (
                <span className="mt-1 ml-1 inline-block rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-semibold text-[#07305f]">
                  Compartido por {sharedByLabel(quiz)}
                </span>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#5b6472]">
                <p><span className="font-semibold text-[#111827]">Asignatura:</span> {quiz.subject ?? "-"}</p>
                <p><span className="font-semibold text-[#111827]">Curso:</span> {courseLabel(quiz, courseNameById)}</p>
                <p><span className="font-semibold text-[#111827]">Formato:</span> {quiz.num_questions}x{quiz.options_per_question ?? 5}</p>
                <p><span className="font-semibold text-[#111827]">Creado:</span> {formatDate(quiz.created_at, locale)}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={sheetHref(quiz)} className="rounded-md border border-[#cfd6df] px-3 py-2 text-xs font-semibold hover:bg-gray-50">{sheetLabel(quiz)}</Link>
                <form action={startScanForQuiz}><input type="hidden" name="quiz_id" value={quiz.id} /><button className="rounded-md border border-[#cfd6df] px-3 py-2 text-xs font-semibold hover:bg-gray-50">Escanear</button></form>
                <ExportDiaLink quizId={quiz.id} hasPapers={(papersCountByQuiz.get(quiz.id) ?? 0) > 0} mobile />
                {isAdmin && <ExportExcelLink quizId={quiz.id} hasPapers={(papersCountByQuiz.get(quiz.id) ?? 0) > 0} mobile />}
                {!isSharedWithMe(quiz) && (
                  <>
                    <ActionButton action={duplicateQuiz} fields={{ id: quiz.id }} label="Duplicar" pendingLabel="Duplicando…" className={DUP_CLS_M} />
                    <ActionButton action={archiveQuiz} fields={{ id: quiz.id }} label="Archivar" pendingLabel="Archivando…" className={ARCH_CLS_M} confirm={`¿Archivar "${quiz.title}"?`} confirmTitle="¿Archivar ensayo?" confirmLabel="Archivar" />
                  </>
                )}
              </div>
            </article>
          )}
        />
      </div>
    </>
  );
}

function courseLabel(quiz: QuizRow, courseNameById: Map<string, string>) {
  return quiz.course_id ? courseNameById.get(quiz.course_id) ?? quiz.grade ?? "-" : quiz.grade ?? "-";
}
