import { Suspense } from "react";
import Link from "next/link";
import { after } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages, formatNumber, type DashboardLocale } from "@/locales";
import { QuotaBar } from "@/components/dashboard/QuotaBar";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { checkAndTriggerQuotaAlerts } from "@/lib/quota_alerts";
import { levelOf } from "@/lib/item_analysis";
import { QuizStats } from "@/components/dashboard/QuizStats";
import {
  applyTeacherScope,
  fetchTeacherOptions,
  parseTeacherScope,
  quizIdsInScope,
  resolveScope,
} from "@/lib/teacher_scope";
import { sharedQuizIdsFor } from "@/lib/quiz_shares";
import { TeacherScopeFilter } from "@/components/dashboard/TeacherScopeFilter";
import { getSubjectVisual } from "@/lib/subject_visuals";

export const dynamic = "force-dynamic";

const LVL = {
  good: { text: "text-[#1a8f52]", bar: "bg-[#1a8f52]" },
  warn: { text: "text-[#c77700]", bar: "bg-[#c77700]" },
  bad: { text: "text-[#c2410c]", bar: "bg-[#c2410c]" },
} as const;

type LatestQuiz = {
  id: string;
  title: string | null;
  grade: string | null;
  num_questions: number | null;
  options_per_question: number | null;
  answer_key: string | null;
};

type LatestPaper = { answers: unknown; score: number | null; total: number | null; grade: string | number | null };
type LatestMeta = { question_number: number; axis_name: string | null; skill_name: string | null };
type SchoolPaper = {
  score: number | null;
  total: number | null;
  equivalent_score: number | null;
  quizzes: { subject: string | null; grade: string | null; evaluation_type: string | null } | null;
};

function isNotaType(evType: string | null | undefined) {
  return evType !== "paes" && evType !== "simce";
}

type SimceRow = {
  agno: number | string;
  grado: string;
  asignatura: string;
  puntaje_promedio: number | null;
  nivel_insuficiente_pct: number | null;
  nivel_elemental_pct: number | null;
  nivel_adecuado_pct: number | null;
};

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
type SupabaseServer = Awaited<ReturnType<typeof getDashboardContext>>["supabase"];

export default async function DashboardPage({ searchParams }: PageProps) {
  const { supabase, user, school, locale, isAdmin } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const sp = (await searchParams) ?? {};
  const from = (typeof sp.from === "string" ? sp.from : null) || null;
  const to = (typeof sp.to === "string" ? sp.to : null) || null;

  const requested = parseTeacherScope(sp, { userId: user.id, isAdmin, plan: school.plan });
  const [teachers, sharedQuizIds] = await Promise.all([
    requested.canSwitch ? fetchTeacherOptions(supabase, school.id, user.id) : Promise.resolve([]),
    sharedQuizIdsFor(supabase, school.id, user.id),
  ]);
  const scope = resolveScope(requested, teachers.length);
  const scopedQuizIds = await quizIdsInScope(supabase, school.id, scope, sharedQuizIds);
  const quizIdFilter =
    scopedQuizIds === null ? null : scopedQuizIds.length > 0 ? scopedQuizIds : ["00000000-0000-0000-0000-000000000000"];
  const scopePapers = <T extends { in: (c: string, v: string[]) => T }>(q: T): T =>
    quizIdFilter ? q.in("quiz_id", quizIdFilter) : q;

  const scansUsed = school.scans_used ?? 0;
  const scansLimit = school.scans_limit ?? 0;
  if (scansLimit > 0 && scansUsed / scansLimit >= 0.9) {
    after(() => checkAndTriggerQuotaAlerts(school.id));
  }

  let allSchoolPapersQuery = supabase
    .from("papers")
    .select("id, score, total, equivalent_score, status, quizzes!inner(id, subject, grade, evaluation_type, school_id)")
    .eq("quizzes.school_id", school.id)
    .in("status", ["corrected", "active"]);
  if (from) allSchoolPapersQuery = allSchoolPapersQuery.gte("scanned_at", from);
  if (to) allSchoolPapersQuery = allSchoolPapersQuery.lte("scanned_at", `${to}T23:59:59`);
  allSchoolPapersQuery = scopePapers(allSchoolPapersQuery);

  const [{ count: quizzesCount }, { count: studentsCount }, { data: papers }, { data: quizzes }, allSchoolPapersResult] =
    await Promise.all([
      applyTeacherScope(
        supabase.from("quizzes").select("id", { count: "exact", head: true }).is("archived_at", null),
        scope,
        sharedQuizIds,
      ),
      supabase.from("students").select("id", { count: "exact", head: true }),
      scopePapers(
        supabase
          .from("papers")
          .select("id, score, total, status, scanned_at, quiz_id")
          .order("scanned_at", { ascending: false })
          .limit(5),
      ),
      applyTeacherScope(
        supabase
          .from("quizzes")
          .select("id, title, subject, grade, created_at")
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(5),
        scope,
        sharedQuizIds,
      ),
      allSchoolPapersQuery,
    ]);

  const allSchoolPapers = (allSchoolPapersResult?.data ?? []) as unknown as SchoolPaper[];
  const notaSchoolPapers = allSchoolPapers.filter((p) => isNotaType(p.quizzes?.evaluation_type));
  const schoolAvg = notaSchoolPapers.length
    ? Math.round(
        notaSchoolPapers.reduce((sum, p) => sum + (Number(p.score ?? 0) / Math.max(1, Number(p.total ?? 1))) * 100, 0) /
          notaSchoolPapers.length,
      )
    : 0;

  const scopeDetail = scope.mode === "all" ? "hojas sincronizadas" : "hojas de estos ensayos";
  const latestQuizId = papers?.[0]?.quiz_id ?? null;
  const showTeamCard = isAdmin && school.plan === "school";

  return (
    <>
      <PageHeader
        title={t.dashboard}
        description="Resumen de ensayos, lecturas recientes y desempeño por curso."
        actions={
          <div className="hidden gap-2 md:flex">
            <Link
              href="/dashboard/quizzes?new=1"
              className="rounded-lg border border-[#d6d3cb] bg-white px-4 py-2 text-sm font-semibold text-[#1c1917] transition hover:bg-[#faf9f6]"
            >
              + Nuevo ensayo
            </Link>
            <Link
              href="/scan"
              className="rounded-lg bg-[#07305f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#062447]"
            >
              Escanear
            </Link>
          </div>
        }
      />

      {/* Móvil: cabecera compacta con acciones directas */}
      <section className="mb-5 rounded-2xl border border-[#e7e5df] bg-white p-4 shadow-xs md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#78716c]">Acceso rápido</p>
            <p className="truncate text-sm font-bold text-[#1c1917]">{school.name}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/dashboard/quizzes?new=1"
              className="rounded-lg border border-[#d6d3cb] bg-[#faf9f6] px-3 py-2 text-xs font-semibold text-[#1c1917]"
            >
              Ensayos
            </Link>
            <Link
              href="/scan"
              className="rounded-lg bg-[#07305f] px-3.5 py-2 text-xs font-semibold text-white"
            >
              Escanear
            </Link>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        {quizzesCount === 0 && allSchoolPapers.length === 0 && (
          <EmptyState
            icon="📋"
            title="Bienvenido a TuLector"
            description="Crea tu primer ensayo, importa tus alumnos y comienza a escanear hojas de respuesta desde la app móvil."
            action={{ label: "Crear primer ensayo", href: "/dashboard/quizzes?new=1" }}
            secondary={{ label: "Importar alumnos", href: "/dashboard/students" }}
          />
        )}

        {/* Barra unificada de filtros */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#e7e5df] bg-white px-4 py-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <TeacherScopeFilter scope={scope} teachers={teachers} basePath="/dashboard" searchParams={sp} />
            {scope.mode !== "all" && (
              <p className="text-xs text-[#78716c]">
                Mostrando {scope.mode === "mine" ? "tus ensayos" : "los ensayos de un docente"}. Cambia a &quot;Todo el colegio&quot; para ver totales del establecimiento.
              </p>
            )}
          </div>
          <DateRangeFilter />
        </div>

        {/* KPIs principales arriba + cuota */}
        <KPIGrid>
          <KPI label="Ensayos activos" value={formatNumber(quizzesCount ?? 0, locale)} detail="sin archivar" />
          <KPI label="Alumnos" value={formatNumber(studentsCount ?? 0, locale)} detail="registrados" />
          <KPI
            label={scope.mode === "all" ? "Lecturas del colegio" : "Lecturas"}
            value={formatNumber(allSchoolPapers.length, locale)}
            detail={scopeDetail}
          />
          <KPI
            label={scope.mode === "all" ? "Promedio del colegio" : "Promedio"}
            value={`${schoolAvg}%`}
            detail={scope.mode === "all" ? "logro sobre todos los ensayos" : "logro sobre los ensayos mostrados"}
            tone="accent"
          />
        </KPIGrid>

        <div className="rounded-xl border border-[#e7e5df] bg-white px-4 py-3.5 shadow-xs md:px-5">
          <QuotaBar used={scansUsed} limit={scansLimit} />
        </div>

        {showTeamCard ? (
          <Suspense fallback={<SectionSkeleton height="h-24" />}>
            <TeamSummaryStrip supabase={supabase} schoolId={school.id} locale={locale} />
          </Suspense>
        ) : null}

        {/* ===================== ÚLTIMO ENSAYO + ENSAYOS RECIENTES ===================== */}
        <SectionTitle>Último ensayo y actividad reciente</SectionTitle>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="space-y-4">
            {latestQuizId ? (
              <Suspense fallback={<SectionSkeleton height="h-72" />}>
                <LatestQuizAnalysisSection supabase={supabase} quizId={latestQuizId} />
              </Suspense>
            ) : (
              <div className="rounded-xl border border-[#e7e5df] bg-white p-8 text-center shadow-xs">
                <p className="text-sm font-semibold text-[#1c1917]">Aún no hay lecturas para analizar</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-[#57534e]">
                  Cuando escanees hojas de un ensayo, aquí verás el análisis por pregunta, los distractores, la distribución de notas y el dominio por eje.
                </p>
                <Link
                  href="/scan"
                  className="mt-4 inline-block rounded-lg bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#062447]"
                >
                  Ir al lector
                </Link>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[#e7e5df] bg-white p-4 shadow-xs md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#1c1917]">Ensayos recientes</h2>
                <Link href="/dashboard/quizzes" className="text-sm font-semibold text-[#07305f] hover:underline">
                  Ver todos
                </Link>
              </div>
              {quizzes && quizzes.length > 0 ? (
                <ul className="divide-y divide-[#efede8]">
                  {quizzes.map((quiz) => {
                    const visual = getSubjectVisual(quiz.subject);
                    return (
                      <li key={quiz.id} className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base ${visual.badgeClass}`}
                          >
                            {visual.emoji}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/quizzes/${quiz.id}`}
                              className="block truncate text-sm font-semibold text-[#1c1917] hover:text-[#07305f] hover:underline"
                            >
                              {quiz.title}
                            </Link>
                            <p className="truncate text-xs text-[#78716c]">
                              {quiz.subject ?? "Sin asignatura"} · {quiz.grade ?? "Sin curso"}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/dashboard/quizzes/${quiz.id}`}
                          className="shrink-0 rounded-lg border border-[#d6d3cb] px-2.5 py-1 text-xs font-semibold text-[#44403c] hover:bg-[#faf9f6]"
                        >
                          Abrir
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-4 text-center text-sm text-[#78716c]">
                  Crea tu primer ensayo para generar hojas y sincronizar la app.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ===================== RESULTADOS DEL COLEGIO Y SIMCE ===================== */}
        <SectionTitle>Resultados del establecimiento</SectionTitle>

        <Suspense fallback={<SectionSkeleton height="h-56" />}>
          <SchoolResultsAndSimceSection
            supabase={supabase}
            rbd={school.rbd ?? null}
            allSchoolPapers={allSchoolPapers}
            notaSchoolPapers={notaSchoolPapers}
          />
        </Suspense>
      </div>
    </>
  );
}

async function LatestQuizAnalysisSection({
  supabase,
  quizId,
}: {
  supabase: SupabaseServer;
  quizId: string;
}) {
  const [quizRes, papersRes, metaRes] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, subject, grade, num_questions, options_per_question, answer_key, evaluation_type")
      .eq("id", quizId)
      .single(),
    supabase.from("papers").select("answers, score, total, grade").eq("quiz_id", quizId),
    supabase
      .from("question_metadata")
      .select("question_number, axis_name, skill_name")
      .eq("quiz_id", quizId)
      .order("question_number"),
  ]);

  const itemQuiz = quizRes.data as LatestQuiz | null;
  const itemPapers = (papersRes.data ?? []) as LatestPaper[];
  const itemMetadata = (metaRes.data ?? []) as LatestMeta[];

  if (!itemQuiz || itemPapers.length === 0) return null;
  return <QuizStats quiz={itemQuiz} papers={itemPapers} metadata={itemMetadata} variant="dashboard" />;
}

async function TeamSummaryStrip({
  supabase,
  schoolId,
  locale,
}: {
  supabase: SupabaseServer;
  schoolId: string;
  locale: DashboardLocale;
}) {
  const [{ count: teachersCount }, { count: pendingInvitesCount }, { data: teamQuizRows }] = await Promise.all([
    supabase.from("school_members").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabase.from("invitations").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "pending"),
    supabase.from("quizzes").select("id").eq("school_id", schoolId),
  ]);
  const teamQuizIds = (teamQuizRows ?? []).map((q) => q.id);
  const { count: teamPapersCount } =
    teamQuizIds.length > 0
      ? await supabase.from("papers").select("id", { count: "exact", head: true }).in("quiz_id", teamQuizIds)
      : { count: 0 };

  const pendingInvites = pendingInvitesCount ?? 0;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[#e7e5df] bg-white px-4 py-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between md:px-5">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eef4ff] text-base">
          👥
        </span>
        <div>
          <p className="text-sm font-semibold text-[#1c1917]">
            Equipo docente{" "}
            <span className="tnum font-normal text-[#57534e]">
              · {formatNumber(teachersCount ?? 0, locale)} docentes · {formatNumber(teamQuizIds.length, locale)} ensayos ·{" "}
              {formatNumber(teamPapersCount ?? 0, locale)} hojas
            </span>
          </p>
          {pendingInvites > 0 && (
            <p className="text-xs font-medium text-[#b45309]">
              {formatNumber(pendingInvites, locale)} invitación{pendingInvites === 1 ? "" : "es"} pendiente
              {pendingInvites === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>
      <Link
        href="/dashboard/settings"
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[#d6d3cb] bg-[#faf9f6] px-3.5 py-1.5 text-xs font-semibold text-[#07305f] hover:bg-[#eef4ff]"
      >
        Gestionar equipo
      </Link>
    </section>
  );
}

async function SchoolResultsAndSimceSection({
  supabase,
  rbd,
  allSchoolPapers,
  notaSchoolPapers,
}: {
  supabase: SupabaseServer;
  rbd: string | null;
  allSchoolPapers: SchoolPaper[];
  notaSchoolPapers: SchoolPaper[];
}) {
  const simceResult = rbd
    ? await supabase
        .from("simce_resultados")
        .select("agno, grado, asignatura, puntaje_promedio, nivel_insuficiente_pct, nivel_elemental_pct, nivel_adecuado_pct, alumnos_evaluados")
        .eq("rbd", rbd)
        .order("agno", { ascending: false })
    : { data: [] };

  const simceData = (simceResult?.data ?? []) as SimceRow[];

  const papersGroupedByGrade: Record<string, { sum: number; count: number }> = {};
  const papersGroupedByEvalType: Record<string, { sum: number; count: number; isEquivalent: boolean }> = {};
  const papersGroupedByGradeSubjectSimce: Record<string, { sum: number; count: number }> = {};

  notaSchoolPapers.forEach((paper) => {
    const score = Number(paper.score ?? 0);
    const total = Number(paper.total ?? 1);
    const pct = total > 0 ? (score / total) * 100 : 0;
    const quiz = paper.quizzes;
    if (!quiz) return;
    const grade = quiz.grade || "Sin curso";
    if (!papersGroupedByGrade[grade]) papersGroupedByGrade[grade] = { sum: 0, count: 0 };
    papersGroupedByGrade[grade].sum += pct;
    papersGroupedByGrade[grade].count += 1;
  });

  allSchoolPapers.forEach((paper) => {
    const score = Number(paper.score ?? 0);
    const total = Number(paper.total ?? 1);
    const pct = total > 0 ? (score / total) * 100 : 0;
    const quiz = paper.quizzes;
    if (!quiz) return;

    const evalType = quiz.evaluation_type || "Otro";
    const labelEval = evalType === "simce" ? "Ensayo SIMCE" : evalType === "paes" ? "Ensayo PAES" : "Pruebas Propias";
    const isEquivalent = evalType === "simce" || evalType === "paes";
    if (!papersGroupedByEvalType[labelEval]) papersGroupedByEvalType[labelEval] = { sum: 0, count: 0, isEquivalent };
    papersGroupedByEvalType[labelEval].sum += isEquivalent ? Number(paper.equivalent_score ?? 0) : pct;
    papersGroupedByEvalType[labelEval].count += 1;

    if (evalType === "simce") {
      const grade = quiz.grade || "Sin curso";
      const key = `${grade}|${quiz.subject || ""}`;
      if (!papersGroupedByGradeSubjectSimce[key]) papersGroupedByGradeSubjectSimce[key] = { sum: 0, count: 0 };
      papersGroupedByGradeSubjectSimce[key].sum += Number(paper.equivalent_score ?? 0);
      papersGroupedByGradeSubjectSimce[key].count += 1;
    }
  });

  const gradeStats = Object.entries(papersGroupedByGrade)
    .map(([name, stat]) => ({ name, avg: Math.round(stat.sum / stat.count), count: stat.count }))
    .sort((a, b) => b.avg - a.avg);
  const evalStats = Object.entries(papersGroupedByEvalType).map(([name, stat]) => ({
    name,
    avg: Math.round(stat.sum / stat.count),
    count: stat.count,
    isEquivalent: stat.isEquivalent,
  }));

  const normalizeGrade = (g: string) => g.toLowerCase().replace(/º/g, "o").trim();
  const normalizeSubject = (s: string) => s.toLowerCase().trim();
  const simceComparison = Object.entries(papersGroupedByGradeSubjectSimce).map(([key, stat]) => {
    const [grade, subject] = key.split("|");
    const omrPts = Math.round(stat.sum / stat.count);
    const matchedSimce = simceData.find(
      (row) =>
        normalizeGrade(row.grado) === normalizeGrade(grade) &&
        (normalizeSubject(row.asignatura).includes(normalizeSubject(subject)) ||
          normalizeSubject(subject).includes(normalizeSubject(row.asignatura))),
    );
    return {
      grade,
      subject,
      omrPts,
      omrCount: stat.count,
      simcePts: matchedSimce ? Number(matchedSimce.puntaje_promedio) : null,
      simceYear: matchedSimce ? matchedSimce.agno : null,
    };
  });

  const maxGradeStat = Math.max(1, ...gradeStats.map((g) => g.avg));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#e7e5df] bg-white p-5 shadow-xs">
          <h2 className="text-base font-semibold text-[#1c1917]">Rendimiento por curso</h2>
          <p className="mt-1 text-xs text-[#57534e]">Logro promedio en ensayos sincronizados.</p>
          <div className="mt-4 flex flex-col gap-3">
            {gradeStats.length > 0 ? (
              gradeStats.map((stat) => {
                const lvl = LVL[levelOf(stat.avg)];
                return (
                  <div key={stat.name} className="grid grid-cols-[minmax(64px,92px)_minmax(0,1fr)_40px] items-center gap-3">
                    <div className="truncate text-[12.5px] font-semibold text-[#1c1917]" title={stat.name}>
                      {stat.name}
                      <span className="tnum block text-[10.5px] font-normal text-[#78716c]">{stat.count} lecturas</span>
                    </div>
                    <div className="h-3.5 overflow-hidden rounded-full bg-[#efede8]">
                      <div
                        className={`h-full rounded-full ${lvl.bar}`}
                        style={{ width: `${Math.round((stat.avg / maxGradeStat) * 100)}%` }}
                      />
                    </div>
                    <div className={`tnum text-right text-[13px] font-bold ${lvl.text}`}>{stat.avg}%</div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs italic text-[#78716c]">No hay lecturas registradas aún.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#e7e5df] bg-white p-5 shadow-xs">
          <h2 className="text-base font-semibold text-[#1c1917]">Por tipo de prueba</h2>
          <p className="mt-1 text-xs text-[#57534e]">Promedio por estándar de evaluación.</p>
          <div className="mt-4 space-y-3">
            {evalStats.length > 0 ? (
              evalStats.map((stat) => (
                <div key={stat.name} className="flex items-center justify-between border-b border-[#efede8] pb-2 last:border-0 last:pb-0">
                  <span className="text-sm font-medium text-[#44403c]">{stat.name}</span>
                  <div className="tnum flex items-center gap-2">
                    <span className="text-xs text-[#78716c]">({stat.count})</span>
                    <span className={`text-sm font-bold ${stat.isEquivalent ? "text-[#07305f]" : LVL[levelOf(stat.avg)].text}`}>
                      {stat.avg}
                      {stat.isEquivalent ? " pts" : "%"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs italic text-[#78716c]">No hay lecturas registradas aún.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#e7e5df] bg-white p-5 shadow-xs">
          <h2 className="text-base font-semibold text-[#1c1917]">Ensayos vs SIMCE real</h2>
          <p className="mt-1 text-xs text-[#57534e]">Contraste de tus ensayos tipo SIMCE vs último resultado oficial.</p>
          <div className="mt-4 space-y-3.5">
            {simceComparison.length > 0 ? (
              simceComparison.map((comp, i) => {
                const omrPts = comp.omrPts;
                const max = Math.max(omrPts, comp.simcePts ?? 0, 320);
                return (
                  <div key={i} className="border-b border-[#efede8] pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] font-semibold text-[#1c1917]">{comp.grade}</span>
                      <span className="text-[11px] text-[#78716c]">{comp.subject}</span>
                    </div>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-[10.5px] font-bold text-[#57534e]">TuLector</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#efede8]">
                          <div className="h-full rounded-full bg-[#07305f]" style={{ width: `${Math.round((omrPts / max) * 100)}%` }} />
                        </div>
                        <span className="tnum w-10 text-right text-[11px] font-bold text-[#07305f]">{omrPts}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-[10.5px] font-bold text-[#57534e]">SIMCE {comp.simceYear ?? ""}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#efede8]">
                          <div
                            className="h-full rounded-full bg-[#22a05a]"
                            style={{ width: comp.simcePts ? `${Math.round((comp.simcePts / max) * 100)}%` : "0%" }}
                          />
                        </div>
                        <span className="tnum w-10 text-right text-[11px] font-bold text-[#22a05a]">{comp.simcePts ?? "N/A"}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs italic text-[#78716c]">Registra ensayos tipo SIMCE para iniciar la comparación.</p>
            )}
          </div>
        </div>
      </div>

      <SimceHistorical simceData={simceData} rbd={rbd} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <h3 className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.09em] text-[#78716c]">{children}</h3>
      <span className="h-px flex-1 bg-[#e7e5df]" />
    </div>
  );
}

function SectionSkeleton({ height }: { height: string }) {
  return <div className={`${height} animate-pulse rounded-xl border border-[#e7e5df] bg-white/70`} />;
}

function SimceHistorical({ simceData, rbd }: { simceData: SimceRow[]; rbd: string | null }) {
  return (
    <details open={simceData.length > 0} className="rounded-xl border border-[#e7e5df] bg-white p-4 shadow-xs md:p-5">
      <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#1c1917]">Resultados Históricos SIMCE Oficiales</h2>
          <p className="mt-0.5 text-xs text-[#57534e]">
            Historial oficial del establecimiento · RBD:{" "}
            <span className="font-mono font-bold text-[#07305f]">{rbd ?? "Sin configurar"}</span>
          </p>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#07305f]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22a05a]" /> SIMCE oficial
        </span>
      </summary>
      {rbd ? (
        simceData.length > 0 ? (
          <>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#efede8] text-xs font-semibold uppercase tracking-wider text-[#57534e]">
                    <th className="py-2 pr-2">Año</th>
                    <th className="py-2 pr-2">Grado</th>
                    <th className="py-2 pr-2">Asignatura</th>
                    <th className="py-2 pr-2">Puntaje</th>
                    <th className="py-2 pr-2 text-right">Niveles (Insuf. / Elem. / Adec.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efede8]">
                  {simceData.map((row, idx) => (
                    <tr key={idx} className="text-xs hover:bg-[#faf9f6]">
                      <td className="tnum py-3 pr-2 font-semibold">{row.agno}</td>
                      <td className="py-3 pr-2">{row.grado}</td>
                      <td className="py-3 pr-2">{row.asignatura}</td>
                      <td className="tnum py-3 pr-2 font-bold text-[#07305f]">{row.puntaje_promedio} pts</td>
                      <td className="tnum py-3 pr-2 text-right font-mono text-[#44403c]">
                        {row.nivel_insuficiente_pct !== null ? `${Math.round(row.nivel_insuficiente_pct)}%` : "-"} /{" "}
                        {row.nivel_elemental_pct !== null ? `${Math.round(row.nivel_elemental_pct)}%` : "-"} /{" "}
                        {row.nivel_adecuado_pct !== null ? `${Math.round(row.nivel_adecuado_pct)}%` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 md:hidden">
              {simceData.map((row, idx) => (
                <article key={idx} className="rounded-xl border border-[#e7e5df] bg-[#faf9f6] p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#1c1917]">{row.grado}</p>
                      <p className="mt-1 text-xs text-[#57534e]">
                        {row.asignatura} · {row.agno}
                      </p>
                    </div>
                    <p className="tnum shrink-0 font-bold text-[#07305f]">{row.puntaje_promedio} pts</p>
                  </div>
                  <p className="tnum mt-2 text-xs text-[#57534e]">
                    Niveles: {row.nivel_insuficiente_pct !== null ? `${Math.round(row.nivel_insuficiente_pct)}%` : "-"} /{" "}
                    {row.nivel_elemental_pct !== null ? `${Math.round(row.nivel_elemental_pct)}%` : "-"} /{" "}
                    {row.nivel_adecuado_pct !== null ? `${Math.round(row.nivel_adecuado_pct)}%` : "-"}
                  </p>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 text-xs italic text-[#57534e]">No se encontraron registros del SIMCE históricos para este RBD en la base de datos.</p>
        )
      ) : (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 text-xs text-amber-800">
          <p className="font-semibold">RBD no configurado</p>
          <p className="mt-1">
            Para ver las estadísticas oficiales del SIMCE asociadas a tu colegio, registra el RBD en{" "}
            <Link href="/dashboard/settings" className="font-bold underline">
              Configuración
            </Link>
            .
          </p>
        </div>
      )}
    </details>
  );
}
