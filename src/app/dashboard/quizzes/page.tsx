import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages, formatDate } from "@/locales";
import { archiveQuiz, duplicateQuiz, startScanForQuiz } from "@/app/dashboard/actions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { QuizCreateForm } from "@/components/dashboard/QuizCreateForm";
import { QuizCreateDrawer } from "@/components/dashboard/QuizCreateDrawer";
import { QuizzesTableClient, type QuizListItem } from "@/components/dashboard/QuizzesTableClient";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { isMissingColumnError } from "@/lib/supabase_errors";
import { resolveCountryProfile } from "@/lib/country_profiles";
import { parseSheetMode } from "@/lib/sheet_mode";
import { isAnswerKeyIncomplete } from "@/lib/quiz_constraints";
import { applyTeacherScope, fetchTeacherOptions, parseTeacherScope, resolveScope } from "@/lib/teacher_scope";
import { TeacherScopeFilter } from "@/components/dashboard/TeacherScopeFilter";
import { countPendingShares, fetchSharesForUser, fetchUserEmails, userLabel } from "@/lib/quiz_shares";
import { planHasFeature } from "@/lib/plan_gates";

export const dynamic = "force-dynamic";

type QuizRow = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  course_id?: string | null;
  created_by?: string | null;
  num_questions: number | null;
  options_per_question: number | null;
  answer_key: string | null;
  open_questions?: string | null;
  multi_select_questions?: string | null;
  question_points?: string | null;
  default_question_points?: number | string | null;
  created_at: string;
  sheet_mode?: string | null;
};

type CourseRow = { id: string; name: string; grade: string | null };

function isCompactQuiz(quiz: Pick<QuizRow, "sheet_mode">) {
  return parseSheetMode(quiz.sheet_mode) === "compact";
}
const sheetHref = (quiz: QuizRow) => (isCompactQuiz(quiz) ? `/bloque?quiz=${quiz.id}` : `/sheet?quiz=${quiz.id}`);
const sheetLabel = (quiz: QuizRow) => (isCompactQuiz(quiz) ? "Bloque" : "Hoja");

export default async function QuizzesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user, locale, school, isAdmin } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const sp = (await searchParams) ?? {};
  const openDrawer = sp.new === "1";

  const requested = parseTeacherScope(sp, { userId: user.id, isAdmin, plan: school.plan });
  const sharingOn = planHasFeature(school.plan, "quiz_sharing");

  const [teachers, sharePair, { data: courses }] = await Promise.all([
    requested.canSwitch ? fetchTeacherOptions(supabase, school.id, user.id) : Promise.resolve([]),
    sharingOn
      ? Promise.all([
          fetchSharesForUser(supabase, school.id, user.id, ["accepted"]),
          countPendingShares(supabase, school.id, user.id),
        ])
      : Promise.resolve([[], 0] as const),
    supabase.from("courses").select("id,name,grade").is("archived_at", null).order("name"),
  ]);

  const scope = resolveScope(requested, teachers.length);
  const [incomingShares, pendingShares] = sharePair;
  const sharedQuizIds = incomingShares.map((s) => s.quiz_id);
  const sharedById = new Map(incomingShares.map((s) => [s.quiz_id, s.shared_by]));

  const quizzesQuery = (columns: string) =>
    applyTeacherScope(
      supabase.from("quizzes").select(columns).is("archived_at", null).order("created_at", { ascending: false }),
      scope,
      sharedQuizIds,
    );

  const BASE_COLUMNS = "id,title,subject,grade,num_questions,options_per_question,answer_key,created_at,archived_at,created_by";
  const OPTIONAL_COLUMNS = ["sheet_mode", "course_id", "open_questions", "multi_select_questions", "question_points", "default_question_points"];

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

  const quizzesData = await loadQuizzes();

  const courseList = (courses ?? []) as CourseRow[];
  const quizzes = (quizzesData ?? []) as unknown as QuizRow[];
  const courseNameById = new Map(courseList.map((course) => [course.id, course.name]));

  const quizIds = quizzes.map((q) => q.id);
  const [paperRowsRes, ownerEmails] = await Promise.all([
    quizIds.length > 0 ? supabase.from("papers").select("quiz_id").in("quiz_id", quizIds) : Promise.resolve({ data: [] }),
    fetchUserEmails([...sharedById.values()].filter((v): v is string => Boolean(v))),
  ]);

  const papersCountByQuiz = new Map<string, number>();
  for (const row of paperRowsRes.data ?? []) {
    papersCountByQuiz.set(row.quiz_id, (papersCountByQuiz.get(row.quiz_id) ?? 0) + 1);
  }

  const isSharedWithMe = (quiz: QuizRow) => sharedById.has(quiz.id) && quiz.created_by !== user.id;

  const items: QuizListItem[] = quizzes.map((quiz) => {
    const papersCount = papersCountByQuiz.get(quiz.id) ?? 0;
    const shared = isSharedWithMe(quiz);
    return {
      id: quiz.id,
      title: quiz.title,
      subject: quiz.subject,
      courseLabel: quiz.course_id ? courseNameById.get(quiz.course_id) ?? quiz.grade ?? "-" : quiz.grade ?? "-",
      formatLabel: `${quiz.num_questions}×${quiz.options_per_question ?? 5}`,
      createdLabel: formatDate(quiz.created_at, locale),
      sheetHref: sheetHref(quiz),
      sheetLabel: sheetLabel(quiz),
      keyIncomplete: isAnswerKeyIncomplete(quiz),
      sharedByLabel: shared ? userLabel(sharedById.get(quiz.id) ?? null, ownerEmails) : null,
      isOwner: !shared,
      hasPapers: papersCount > 0,
      papersCount,
    };
  });

  const countryProfile = resolveCountryProfile(school.country_code ?? "CL");
  const evaluationHint =
    countryProfile.code === "CL"
      ? "personalizada, PAES, SIMCE o DIA"
      : `personalizada o ${countryProfile.evaluationSystems.map((s) => s.replace(/_/g, " ")).join("/")}`;

  const createDrawer = (
    <QuizCreateDrawer defaultOpen={openDrawer}>
      <QuizCreateForm courses={courseList} countryCode={school.country_code ?? "CL"} isAdmin={isAdmin} />
    </QuizCreateDrawer>
  );

  return (
    <>
      <PageHeader
        title={t.quizzes}
        description="Crea ensayos, define claves, duplica instrumentos y genera hojas imprimibles para leer desde la app móvil."
        actions={createDrawer}
      />

      <TeacherScopeFilter scope={scope} teachers={teachers} basePath="/dashboard/quizzes" searchParams={sp} />

      {sharingOn && pendingShares > 0 && (
        <p className="mb-4 rounded-xl border border-[#c7d7ee] bg-[#eef4ff] px-4 py-3 text-sm text-[#07305f]">
          🤝 Tienes <strong>{pendingShares}</strong> ensayo{pendingShares === 1 ? "" : "s"} compartido
          {pendingShares === 1 ? "" : "s"} esperando tu respuesta.{" "}
          <Link href="/dashboard/quizzes/compartidos" className="font-semibold underline">
            Ver y aceptar
          </Link>
        </p>
      )}

      {items.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon="📝"
            title="Todavía no hay ensayos creados"
            description={`Un ensayo define las preguntas, la clave de respuestas y el tipo de evaluación (${evaluationHint}). Pulsa "+ Nuevo ensayo" arriba para crear el primero.`}
          />
        </div>
      ) : (
        <QuizzesTableClient
          quizzes={items}
          isAdmin={isAdmin}
          startScanAction={startScanForQuiz}
          duplicateAction={duplicateQuiz}
          archiveAction={archiveQuiz}
        />
      )}

      <p className="mt-5 rounded-xl border border-[#e7e5df] bg-white px-4 py-2.5 text-xs text-[#57534e]">
        ¿Solo quieres corregir una prueba rápida sin crear ensayo?{" "}
        <Link href="/bloque" className="font-semibold text-[#07305f] hover:underline">
          Genera un bloque compacto
        </Link>{" "}
        y usa la{" "}
        <Link href="/scan/rapido" className="font-semibold text-[#07305f] hover:underline">
          corrección rápida
        </Link>
        .
      </p>
    </>
  );
}
