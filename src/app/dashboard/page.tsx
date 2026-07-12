import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages, formatNumber } from "@/locales";
import { DataTable } from "@/components/dashboard/DataTable";
import { QuotaBar } from "@/components/dashboard/QuotaBar";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { checkAndTriggerQuotaAlerts } from "@/lib/quota_alerts";
import { levelOf } from "@/lib/item_analysis";
import { QuizStats } from "@/components/dashboard/QuizStats";

export const dynamic = "force-dynamic";

const LVL = {
  good: { text: "text-[#1a8f52]", bar: "bg-[#1a8f52]", soft: "bg-[#e7f6ec]", chip: "text-[#1a8f52]" },
  warn: { text: "text-[#c77700]", bar: "bg-[#c77700]", soft: "bg-[#fdf3e2]", chip: "text-[#c77700]" },
  bad: { text: "text-[#c2410c]", bar: "bg-[#c2410c]", soft: "bg-[#fbeae1]", chip: "text-[#c2410c]" },
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
  quizzes: { subject: string | null; grade: string | null; evaluation_type: string | null } | null;
};
type SimceRow = {
  agno: number | string;
  grado: string;
  asignatura: string;
  puntaje_promedio: number | null;
  nivel_insuficiente_pct: number | null;
  nivel_elemental_pct: number | null;
  nivel_adecuado_pct: number | null;
};

type PageProps = { searchParams?: Promise<{ from?: string; to?: string }> };

export default async function DashboardPage({ searchParams }: PageProps) {
  const { supabase, school, countryProfile, locale } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const sp = ((await searchParams) ?? {}) as { from?: string; to?: string };
  const from = sp.from ?? null;
  const to = sp.to ?? null;

  let allSchoolPapersQuery = supabase
    .from("papers")
    .select("id, score, total, status, quizzes!inner(id, subject, grade, evaluation_type, school_id)")
    .eq("quizzes.school_id", school.id)
    .in("status", ["corrected", "active"]);
  if (from) allSchoolPapersQuery = allSchoolPapersQuery.gte("scanned_at", from);
  if (to) allSchoolPapersQuery = allSchoolPapersQuery.lte("scanned_at", `${to}T23:59:59`);

  const [{ count: quizzesCount }, { count: studentsCount }, { data: papers }, { data: quizzes }, simceResult, allSchoolPapersResult] = await Promise.all([
    supabase.from("quizzes").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("papers").select("id, score, total, status, scanned_at, quiz_id").order("scanned_at", { ascending: false }).limit(5),
    supabase.from("quizzes").select("id, title, subject, grade, created_at").is("archived_at", null).order("created_at", { ascending: false }).limit(5),
    school.rbd
      ? supabase.from("simce_resultados").select("agno, grado, asignatura, puntaje_promedio, nivel_insuficiente_pct, nivel_elemental_pct, nivel_adecuado_pct, alumnos_evaluados").eq("rbd", school.rbd).order("agno", { ascending: false })
      : Promise.resolve({ data: [] }),
    allSchoolPapersQuery,
    checkAndTriggerQuotaAlerts(school.id),
  ]);

  const scansUsed = school.scans_used ?? 0;
  const scansLimit = school.scans_limit ?? 0;
  const simceData = (simceResult?.data ?? []) as SimceRow[];
  const allSchoolPapers = (allSchoolPapersResult?.data ?? []) as unknown as SchoolPaper[];
  const schoolAvg = allSchoolPapers.length
    ? Math.round(allSchoolPapers.reduce((sum, p) => sum + (Number(p.score ?? 0) / Math.max(1, Number(p.total ?? 1))) * 100, 0) / allSchoolPapers.length)
    : 0;

  // ---- Análisis por ítem del último ensayo con lecturas (datos reales) ----
  const latestQuizId = papers?.[0]?.quiz_id ?? null;
  let itemQuiz: LatestQuiz | null = null;
  let itemPapers: LatestPaper[] = [];
  let itemMetadata: LatestMeta[] = [];

  if (latestQuizId) {
    const [quizRes, papersRes, metaRes] = await Promise.all([
      supabase.from("quizzes").select("id, title, subject, grade, num_questions, options_per_question, answer_key, evaluation_type").eq("id", latestQuizId).single(),
      supabase.from("papers").select("answers, score, total, grade").eq("quiz_id", latestQuizId),
      supabase.from("question_metadata").select("question_number, axis_name, skill_name").eq("quiz_id", latestQuizId).order("question_number"),
    ]);
    itemQuiz = quizRes.data as LatestQuiz | null;
    itemPapers = (papersRes.data ?? []) as LatestPaper[];
    itemMetadata = (metaRes.data ?? []) as LatestMeta[];
  }

  // ---- Resultados del colegio (agregaciones reales) ----
  const papersGroupedByGrade: Record<string, { sum: number; count: number }> = {};
  const papersGroupedByEvalType: Record<string, { sum: number; count: number }> = {};
  const papersGroupedByGradeSubject: Record<string, { sum: number; count: number }> = {};

  allSchoolPapers.forEach((paper) => {
    const score = Number(paper.score ?? 0);
    const total = Number(paper.total ?? 1);
    const pct = total > 0 ? (score / total) * 100 : 0;
    const quiz = paper.quizzes;
    if (!quiz) return;

    const grade = quiz.grade || "Sin curso";
    if (!papersGroupedByGrade[grade]) papersGroupedByGrade[grade] = { sum: 0, count: 0 };
    papersGroupedByGrade[grade].sum += pct;
    papersGroupedByGrade[grade].count += 1;

    const evalType = quiz.evaluation_type || "Otro";
    const labelEval = evalType === "simce" ? "Ensayo SIMCE" : evalType === "paes" ? "Ensayo PAES" : "Pruebas Propias";
    if (!papersGroupedByEvalType[labelEval]) papersGroupedByEvalType[labelEval] = { sum: 0, count: 0 };
    papersGroupedByEvalType[labelEval].sum += pct;
    papersGroupedByEvalType[labelEval].count += 1;

    const key = `${grade}|${quiz.subject || ""}`;
    if (!papersGroupedByGradeSubject[key]) papersGroupedByGradeSubject[key] = { sum: 0, count: 0 };
    papersGroupedByGradeSubject[key].sum += pct;
    papersGroupedByGradeSubject[key].count += 1;
  });

  const gradeStats = Object.entries(papersGroupedByGrade)
    .map(([name, stat]) => ({ name, avg: Math.round(stat.sum / stat.count), count: stat.count }))
    .sort((a, b) => b.avg - a.avg);
  const evalStats = Object.entries(papersGroupedByEvalType).map(([name, stat]) => ({ name, avg: Math.round(stat.sum / stat.count), count: stat.count }));

  const normalizeGrade = (g: string) => g.toLowerCase().replace(/º/g, "o").trim();
  const normalizeSubject = (s: string) => s.toLowerCase().trim();
  const simceComparison = Object.entries(papersGroupedByGradeSubject).map(([key, stat]) => {
    const [grade, subject] = key.split("|");
    const omrAvg = Math.round(stat.sum / stat.count);
    const matchedSimce = simceData.find((row) =>
      normalizeGrade(row.grado) === normalizeGrade(grade) &&
      (normalizeSubject(row.asignatura).includes(normalizeSubject(subject)) || normalizeSubject(subject).includes(normalizeSubject(row.asignatura))),
    );
    return {
      grade, subject, omrAvg, omrCount: stat.count,
      simcePts: matchedSimce ? Number(matchedSimce.puntaje_promedio) : null,
      simceYear: matchedSimce ? matchedSimce.agno : null,
    };
  });

  const maxGradeStat = Math.max(1, ...gradeStats.map((g) => g.avg));

  return (
    <>
      <section className="mb-5 overflow-hidden rounded-[1.75rem] bg-[#07305f] p-5 text-white shadow-xl shadow-[#07305f]/15 md:hidden">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">TuLector School</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Panel movil</h1>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/75">{school.name}</p>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <MobileHeroMetric label="Ensayos" value={formatNumber(quizzesCount ?? 0, locale)} />
          <MobileHeroMetric label="Alumnos" value={formatNumber(studentsCount ?? 0, locale)} />
          <MobileHeroMetric label="Lecturas" value={formatNumber(allSchoolPapers.length, locale)} />
        </div>
        <div className="mt-5 grid gap-2">
          <Link href="/scan" className="flex min-h-12 items-center justify-center rounded-2xl bg-white px-4 text-sm font-bold text-[#07305f] shadow-sm active:scale-[0.99]">
            Escanear hoja
          </Link>
          <Link href="/dashboard/quizzes" className="flex min-h-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white backdrop-blur active:scale-[0.99]">
            Crear o abrir ensayo
          </Link>
        </div>
      </section>

      <div className="mb-6 hidden md:block">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">TuLector School</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{t.dashboard}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b6472]">Consola web para administrar cursos, ensayos, resultados y análisis. La lectura OMR ocurre desde la app móvil sincronizada.</p>
      </div>

      <div className="space-y-6">
        {quizzesCount === 0 && allSchoolPapers.length === 0 && (
          <EmptyState
            icon="📋"
            title="Bienvenido a TuLector"
            description="Crea tu primer ensayo, importa tus alumnos y comienza a escanear hojas de respuesta desde la app movil."
            action={{ label: "Crear primer ensayo", href: "/dashboard/quizzes" }}
            secondary={{ label: "Importar alumnos", href: "/dashboard/students" }}
          />
        )}
        <div className="hidden flex-col gap-4 rounded-md border border-[#e6e8eb] bg-white p-5 md:flex md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">{school.name}</p>
            <p className="mt-1 text-sm text-[#4b5563]">Plan {school.plan} · {countryProfile.profileName} {school.rbd ? `· RBD: ${school.rbd}` : ""}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/quizzes" className="rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50">Ensayos</Link>
            <Link href="/scan" className="rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white">Escanear</Link>
          </div>
        </div>

        <MobileWorkflowCard />

        <DateRangeFilter />

        {/* SIMCE oficial — siempre visible en el tope del panel */}
        <SimceHistorical simceData={simceData} rbd={school.rbd ?? null} />

        {/* KPIs (datos reales) */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Ensayos activos" value={formatNumber(quizzesCount ?? 0, locale)} detail="sin archivar" />
          <StatCard label="Alumnos" value={formatNumber(studentsCount ?? 0, locale)} detail="registrados" />
          <StatCard label="Lecturas del colegio" value={formatNumber(allSchoolPapers.length, locale)} detail="hojas sincronizadas" />
          <StatCard label="Promedio del colegio" value={`${schoolAvg}%`} detail="logro sobre todos los ensayos" accent />
        </section>

        {/* ===================== ANÁLISIS DEL ÚLTIMO ENSAYO ===================== */}
        <SectionTitle>Análisis del último ensayo</SectionTitle>

        {itemQuiz && itemPapers.length > 0 ? (
          <QuizStats quiz={itemQuiz} papers={itemPapers} metadata={itemMetadata} variant="dashboard" />
        ) : (
          <div className="rounded-md border border-dashed border-[#cfd6df] bg-white p-8 text-center">
            <p className="text-sm font-semibold text-[#111827]">Aún no hay lecturas para analizar</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#5b6472]">Cuando escanees hojas de un ensayo, aquí verás el análisis por pregunta, los distractores, la distribución de notas y el dominio por eje.</p>
            <Link href="/scan" className="mt-4 inline-block rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white">Ir al lector</Link>
          </div>
        )}

        {/* ===================== RESULTADOS DEL COLEGIO ===================== */}
        <SectionTitle>Resultados del colegio</SectionTitle>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#111827]">Rendimiento por curso</h2>
            <p className="mt-1 text-xs text-[#5b6472]">Logro promedio en ensayos sincronizados.</p>
            <div className="mt-4 flex flex-col gap-3">
              {gradeStats.length > 0 ? gradeStats.map((stat) => {
                const lvl = LVL[levelOf(stat.avg)];
                return (
                  <div key={stat.name} className="grid grid-cols-[minmax(64px,92px)_minmax(0,1fr)_40px] items-center gap-3">
                    <div className="truncate text-[12.5px] font-semibold text-[#111827]" title={stat.name}>{stat.name}<span className="block text-[10.5px] font-normal text-[#9aa3af]">{stat.count} lecturas</span></div>
                    <div className="h-4 overflow-hidden rounded-full bg-[#eef0f3]"><div className={`h-full rounded-full ${lvl.bar}`} style={{ width: `${Math.round((stat.avg / maxGradeStat) * 100)}%` }} /></div>
                    <div className={`text-right text-[13px] font-bold ${lvl.text}`}>{stat.avg}%</div>
                  </div>
                );
              }) : <p className="text-xs italic text-[#9aa3af]">No hay lecturas registradas aún.</p>}
            </div>
          </div>

          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#111827]">Por tipo de prueba</h2>
            <p className="mt-1 text-xs text-[#5b6472]">Promedio por estándar de evaluación.</p>
            <div className="mt-4 space-y-3">
              {evalStats.length > 0 ? evalStats.map((stat) => (
                <div key={stat.name} className="flex items-center justify-between border-b border-[#eef0f3] pb-2 last:border-0 last:pb-0">
                  <span className="text-sm font-medium text-[#4b5563]">{stat.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9aa3af]">({stat.count})</span>
                    <span className={`text-sm font-bold ${LVL[levelOf(stat.avg)].text}`}>{stat.avg}%</span>
                  </div>
                </div>
              )) : <p className="text-xs italic text-[#9aa3af]">No hay lecturas registradas aún.</p>}
            </div>
          </div>

          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#111827]">Ensayos vs SIMCE real</h2>
            <p className="mt-1 text-xs text-[#5b6472]">Contraste de ensayos propios vs último resultado oficial.</p>
            <div className="mt-4 space-y-3.5">
              {simceComparison.length > 0 ? simceComparison.map((comp, i) => {
                const omrPts = Math.round(100 + (comp.omrAvg / 100) * 300);
                const max = Math.max(omrPts, comp.simcePts ?? 0, 320);
                return (
                  <div key={i} className="border-b border-[#eef0f3] pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] font-semibold text-[#111827]">{comp.grade}</span>
                      <span className="text-[11px] text-[#9aa3af]">{comp.subject}</span>
                    </div>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-[10.5px] font-bold text-[#6b7280]">TuLector</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#eef0f3]"><div className="h-full rounded-full bg-[#07305f]" style={{ width: `${Math.round((omrPts / max) * 100)}%` }} /></div>
                        <span className="w-10 text-right text-[11px] font-bold text-[#07305f]">{omrPts}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-[10.5px] font-bold text-[#6b7280]">SIMCE {comp.simceYear ?? ""}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#eef0f3]"><div className="h-full rounded-full bg-[#22a05a]" style={{ width: comp.simcePts ? `${Math.round((comp.simcePts / max) * 100)}%` : "0%" }} /></div>
                        <span className="w-10 text-right text-[11px] font-bold text-[#22a05a]">{comp.simcePts ?? "N/A"}</span>
                      </div>
                    </div>
                  </div>
                );
              }) : <p className="text-xs italic text-[#9aa3af]">Registra ensayos para iniciar la comparación.</p>}
            </div>
          </div>
        </div>

        {/* Estandarización del lector (perfil país) */}
        <section className="rounded-md border border-[#d8dde3] bg-white p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#07305f]">{countryProfile.flag} {countryProfile.profileName} activo</p>
              <h2 className="mt-2 text-xl font-semibold">Estandarización del lector</h2>
              <p className="mt-2 text-sm leading-6 text-[#5b6472]">{countryProfile.dashboardSummary}</p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[420px]">
              <ProfileFact label="Identificador" value={`${countryProfile.studentIdLabel} (${countryProfile.studentIdExample})`} />
              <ProfileFact label="Notas" value={countryProfile.grading.display} />
              <ProfileFact label="Evaluaciones" value={countryProfile.evaluationSystems.join(" / ")} />
              <ProfileFact label="Formato" value={countryProfile.ministryFormat} />
            </div>
          </div>
        </section>

        {/* Ensayos recientes + cuota/flujo */}
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:gap-6">
          <div className="rounded-md border border-[#e6e8eb] bg-white p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Ensayos recientes</h2>
              <Link href="/dashboard/quizzes" className="text-sm font-semibold text-[#4b5563] hover:text-[#111827]">Ver todos</Link>
            </div>
            <DataTable
              columns={["Ensayo", "Asignatura", "Curso", "Accion"]}
              rows={quizzes ?? []}
              empty="Crea tu primer ensayo para generar hojas y sincronizar la app."
              renderRow={(quiz) => (
                <tr key={quiz.id} className="border-b border-[#eef0f3] last:border-0">
                  <td className="px-5 py-4 font-semibold">{quiz.title}</td>
                  <td className="px-5 py-4 text-[#4b5563]">{quiz.subject ?? "-"}</td>
                  <td className="px-5 py-4 text-[#4b5563]">{quiz.grade ?? "-"}</td>
                  <td className="px-5 py-4"><Link href={`/dashboard/quizzes/${quiz.id}`} className="font-semibold underline">Abrir</Link></td>
                </tr>
              )}
              renderMobileRow={(quiz) => (
                <article key={quiz.id} className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
                  <p className="text-base font-semibold text-[#111827]">{quiz.title}</p>
                  <p className="mt-2 text-sm text-[#5b6472]">{quiz.subject ?? "-"} · {quiz.grade ?? "-"}</p>
                  <Link href={`/dashboard/quizzes/${quiz.id}`} className="mt-3 inline-block text-sm font-semibold text-[#07305f] underline">Abrir</Link>
                </article>
              )}
            />
          </div>

          <div className="space-y-6">
            <div className="rounded-md border border-[#e6e8eb] bg-white p-4 md:p-5"><QuotaBar used={scansUsed} limit={scansLimit} /></div>
            <div className="hidden rounded-md border border-[#e6e8eb] bg-white p-4 md:block md:p-5">
              <h2 className="text-base font-semibold">Flujo correcto</h2>
              <div className="mt-4 grid gap-3 text-sm">
                <Link href="/dashboard/quizzes" className="rounded-md border border-[#e6e8eb] px-4 py-3 font-semibold transition-colors hover:bg-gray-50">1. Crear ensayo y clave</Link>
                <Link href="/sheet" className="rounded-md border border-[#e6e8eb] px-4 py-3 font-semibold transition-colors hover:bg-gray-50">2. Generar hoja v2</Link>
                <Link href="/scan" className="rounded-md border border-[#e6e8eb] px-4 py-3 font-semibold transition-colors hover:bg-gray-50">3. Leer desde app movil</Link>
                <Link href="/dashboard/papers" className="rounded-md border border-[#e6e8eb] px-4 py-3 font-semibold transition-colors hover:bg-gray-50">4. Revisar y exportar</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function MobileHeroMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white/10 px-2 py-3 ring-1 ring-white/10">
      <p className="text-xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{label}</p>
    </div>
  );
}

function MobileWorkflowCard() {
  const steps = [
    { label: "Cursos y alumnos", href: "/dashboard/students" },
    { label: "Ensayos", href: "/dashboard/quizzes" },
    { label: "Hojas", href: "/sheet" },
    { label: "Resultados", href: "/dashboard/papers" },
  ];

  return (
    <section className="rounded-[1.5rem] border border-[#e6e8eb] bg-white p-4 shadow-sm md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#64748b]">Flujo recomendado</p>
          <h2 className="mt-1 text-lg font-bold text-[#111827]">Siguiente paso claro</h2>
        </div>
        <span className="rounded-full bg-[#e9fbf7] px-3 py-1 text-xs font-bold text-[#0f766e]">Movil</span>
      </div>
      <div className="mt-4 grid gap-2">
        {steps.map((step, index) => (
          <Link key={step.href} href={step.href} className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#eef0f3] bg-[#f8fafc] px-3 text-sm font-bold text-[#1f2937] hover:border-[#d8dde3] hover:bg-white">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#07305f] text-xs text-white">{index + 1}</span>
            <span>{step.label}</span>
            <span className="ml-auto text-[#94a3b8]" aria-hidden="true">-&gt;</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatCard({ label, value, detail, accent }: { label: string; value: string | number; detail?: string; accent?: boolean }) {
  return (
    <article className={`rounded-[1.25rem] border p-4 shadow-sm md:rounded-md md:p-5 ${accent ? "border-[#07305f]/25 bg-[#f5f8fd]" : "border-[#e6e8eb] bg-white"}`} aria-label={label}>
      <p className="text-xs font-semibold text-[#6b7280]">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${accent ? "text-[#07305f]" : "text-[#111827]"}`}>{value}</p>
      {detail ? <p className="mt-1.5 text-[11px] text-[#9aa3af]">{detail}</p> : null}
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <h3 className="whitespace-nowrap text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">{children}</h3>
      <span className="h-px flex-1 bg-[#e6e8eb]" />
    </div>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e6e8eb] bg-[#f8fafc] px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">{label}</p>
      <p className="mt-1 font-semibold text-[#111827]">{value}</p>
    </div>
  );
}

function SimceHistorical({ simceData, rbd }: { simceData: SimceRow[]; rbd: string | null }) {
  return (
    <section className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Resultados Históricos SIMCE Oficiales (Establecimiento)</h2>
          <p className="mt-1 text-xs text-[#5b6472]">
            Historial de puntajes y niveles de logro para el RBD: <span className="font-mono font-bold text-[#07305f]">{rbd ?? "Sin configurar"}</span>
          </p>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#07305f]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22a05a]" /> SIMCE oficial
        </span>
      </div>
      {rbd ? (
        simceData.length > 0 ? (
          <>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#eef0f3] text-xs font-semibold uppercase tracking-wider text-[#5b6472]">
                    <th className="py-2 pr-2">Año</th>
                    <th className="py-2 pr-2">Grado</th>
                    <th className="py-2 pr-2">Asignatura</th>
                    <th className="py-2 pr-2">Puntaje</th>
                    <th className="py-2 pr-2 text-right">Niveles (Insuf. / Elem. / Adec.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f3]">
                  {simceData.map((row, idx) => (
                    <tr key={idx} className="text-xs hover:bg-gray-50">
                      <td className="py-3 pr-2 font-semibold">{row.agno}</td>
                      <td className="py-3 pr-2">{row.grado}</td>
                      <td className="py-3 pr-2">{row.asignatura}</td>
                      <td className="py-3 pr-2 font-bold text-[#07305f]">{row.puntaje_promedio} pts</td>
                      <td className="py-3 pr-2 text-right font-mono text-[#4b5563]">
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
                <article key={idx} className="rounded-md border border-[#e6e8eb] bg-white p-3 text-sm shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#111827]">{row.grado}</p>
                      <p className="mt-1 text-xs text-[#5b6472]">{row.asignatura} · {row.agno}</p>
                    </div>
                    <p className="shrink-0 font-bold text-[#07305f]">{row.puntaje_promedio} pts</p>
                  </div>
                  <p className="mt-3 text-xs text-[#5b6472]">
                    Niveles: {row.nivel_insuficiente_pct !== null ? `${Math.round(row.nivel_insuficiente_pct)}%` : "-"} / {row.nivel_elemental_pct !== null ? `${Math.round(row.nivel_elemental_pct)}%` : "-"} / {row.nivel_adecuado_pct !== null ? `${Math.round(row.nivel_adecuado_pct)}%` : "-"}
                  </p>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 text-xs italic text-[#5b6472]">No se encontraron registros del SIMCE históricos para este RBD en la base de datos.</p>
        )
      ) : (
        <div className="mt-4 rounded-md bg-amber-50 p-4 text-xs text-amber-800">
          <p className="font-semibold">⚠️ RBD no configurado</p>
          <p className="mt-1">
            Para visualizar las estadísticas oficiales e históricas del SIMCE asociadas a tu colegio, por favor registra el RBD en la sección de{" "}
            <Link href="/dashboard/settings" className="font-bold underline">
              Configuración
            </Link>.
          </p>
        </div>
      )}
    </section>
  );
}
