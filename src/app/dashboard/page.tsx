import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages, formatNumber } from "@/locales";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { QuotaBar } from "@/components/dashboard/QuotaBar";
import { checkAndTriggerQuotaAlerts } from "@/lib/quota_alerts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, school, countryProfile, locale } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  
  const [{ count: quizzesCount }, { count: studentsCount }, { data: papers }, { data: quizzes }, simceResult, allSchoolPapersResult] = await Promise.all([
    supabase.from("quizzes").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("papers").select("id, score, total, status, scanned_at, quiz_id").order("scanned_at", { ascending: false }).limit(5),
    supabase.from("quizzes").select("id, title, subject, grade, created_at").is("archived_at", null).order("created_at", { ascending: false }).limit(5),
    school.rbd
      ? supabase.from("simce_resultados").select("agno, grado, asignatura, puntaje_promedio, nivel_insuficiente_pct, nivel_elemental_pct, nivel_adecuado_pct, alumnos_evaluados").eq("rbd", school.rbd).order("agno", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("papers")
      .select("id, score, total, status, quizzes!inner(id, subject, grade, evaluation_type, school_id)")
      .eq("quizzes.school_id", school.id)
      .in("status", ["corrected", "active"]),
    checkAndTriggerQuotaAlerts(school.id),
  ]);

  const scansUsed = school.scans_used ?? 0;
  const scansLimit = school.scans_limit ?? 0;
  const validPapers = papers?.filter((p) => typeof p.score === "number" && typeof p.total === "number") ?? [];
  const avg = validPapers.length ? Math.round(validPapers.reduce((sum, p) => sum + ((p.score ?? 0) / Math.max(1, p.total ?? 1)) * 100, 0) / validPapers.length) : 0;
  const simceData = simceResult?.data ?? [];
  const allSchoolPapers = allSchoolPapersResult?.data ?? [];

  // Group and process OMR stats by course, type, and compare with SIMCE
  const papersGroupedByGrade: Record<string, { sum: number; count: number }> = {};
  const papersGroupedByEvalType: Record<string, { sum: number; count: number }> = {};
  const papersGroupedByGradeSubject: Record<string, { sum: number; count: number }> = {};

  (allSchoolPapers ?? []).forEach((paper: any) => {
    const score = Number(paper.score ?? 0);
    const total = Number(paper.total ?? 1);
    const pct = total > 0 ? (score / total) * 100 : 0;
    const quiz = paper.quizzes;
    if (!quiz) return;

    // Grade (Curso)
    const grade = quiz.grade || "Sin curso";
    if (!papersGroupedByGrade[grade]) papersGroupedByGrade[grade] = { sum: 0, count: 0 };
    papersGroupedByGrade[grade].sum += pct;
    papersGroupedByGrade[grade].count += 1;

    // Eval Type (Tipo de Prueba)
    const evalType = quiz.evaluation_type || "Otro";
    const labelEval = evalType === "simce" ? "Ensayo SIMCE" : evalType === "paes" ? "Ensayo PAES" : "Pruebas Propias";
    if (!papersGroupedByEvalType[labelEval]) papersGroupedByEvalType[labelEval] = { sum: 0, count: 0 };
    papersGroupedByEvalType[labelEval].sum += pct;
    papersGroupedByEvalType[labelEval].count += 1;

    // Grade + Subject (for SIMCE comparison!)
    const key = `${grade}|${quiz.subject || ""}`;
    if (!papersGroupedByGradeSubject[key]) papersGroupedByGradeSubject[key] = { sum: 0, count: 0 };
    papersGroupedByGradeSubject[key].sum += pct;
    papersGroupedByGradeSubject[key].count += 1;
  });

  const gradeStats = Object.entries(papersGroupedByGrade).map(([name, stat]) => ({
    name,
    avg: Math.round(stat.sum / stat.count),
    count: stat.count,
  }));

  const evalStats = Object.entries(papersGroupedByEvalType).map(([name, stat]) => ({
    name,
    avg: Math.round(stat.sum / stat.count),
    count: stat.count,
  }));

  // Match OMR results (Grade + Subject) with SIMCE historical scores
  const normalizeGrade = (g: string) => g.toLowerCase().replace(/º/g, "o").trim();
  const normalizeSubject = (s: string) => s.toLowerCase().trim();

  const simceComparison = Object.entries(papersGroupedByGradeSubject).map(([key, stat]) => {
    const [grade, subject] = key.split("|");
    const omrAvg = Math.round(stat.sum / stat.count);

    // Find the latest SIMCE score for this grade and subject
    const matchedSimce = simceData.find((row: any) => {
      return normalizeGrade(row.grado) === normalizeGrade(grade) &&
             (normalizeSubject(row.asignatura).includes(normalizeSubject(subject)) || 
              normalizeSubject(subject).includes(normalizeSubject(row.asignatura)));
    });

    return {
      grade,
      subject,
      omrAvg,
      omrCount: stat.count,
      simceScore: matchedSimce ? `${matchedSimce.puntaje_promedio} pts` : "N/A",
      simceYear: matchedSimce ? matchedSimce.agno : null,
    };
  });

  return (
    <>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">TuLector School</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{t.dashboard}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b6472]">Consola web para administrar cursos, alumnos, ensayos, claves, resultados y exportaciones. La lectura OMR ocurre desde la app movil sincronizada.</p>
      </div>
      
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-md border border-[#e6e8eb] bg-white p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">{school.name}</p>
            <p className="mt-1 text-sm text-[#4b5563]">Plan {school.plan} · {countryProfile.profileName} {school.rbd ? `· RBD: ${school.rbd}` : ""}</p>
          </div>
        </div>

        {/* SIMCE oficial — siempre visible en el tope del panel */}
        <SimceHistorical simceData={simceData} rbd={school.rbd ?? null} />

        {/* OMR Results and SIMCE Comparison Section */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          
          {/* Card 1: Resultados por Curso */}
          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#111827]">Resultados OMR por Curso</h2>
            <p className="mt-1 text-xs text-[#5b6472]">Promedio de respuestas correctas en ensayos sincronizados.</p>
            <div className="mt-4 space-y-3">
              {gradeStats.length > 0 ? (
                gradeStats.map((stat, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-[#eef0f3] pb-2 last:border-0 last:pb-0">
                    <span className="text-sm font-medium text-[#4b5563]">{stat.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9aa3af]">({stat.count} lecturas)</span>
                      <span className="text-sm font-bold text-[#07305f]">{stat.avg}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#9aa3af] italic">No hay lecturas registradas aún.</p>
              )}
            </div>
          </div>

          {/* Card 2: Resultados por Tipo de Prueba */}
          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#111827]">Resultados por Tipo de Prueba</h2>
            <p className="mt-1 text-xs text-[#5b6472]">Promedio por estándar de evaluación.</p>
            <div className="mt-4 space-y-3">
              {evalStats.length > 0 ? (
                evalStats.map((stat, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-[#eef0f3] pb-2 last:border-0 last:pb-0">
                    <span className="text-sm font-medium text-[#4b5563]">{stat.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9aa3af]">({stat.count} lecturas)</span>
                      <span className="text-sm font-bold text-[#07305f]">{stat.avg}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#9aa3af] italic">No hay lecturas registradas aún.</p>
              )}
            </div>
          </div>

          {/* Card 3: Comparativo OMR vs SIMCE Oficial */}
          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm md:col-span-2 lg:col-span-1">
            <h2 className="text-base font-semibold text-[#111827]">Comparativa OMR vs SIMCE Real</h2>
            <p className="mt-1 text-xs text-[#5b6472]">Contraste de ensayos propios vs último resultado del establecimiento.</p>
            <div className="mt-4 space-y-3">
              {simceComparison.length > 0 ? (
                simceComparison.map((comp, i) => (
                  <div key={i} className="flex flex-col border-b border-[#eef0f3] pb-2 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-bold text-[#4b5563]">{comp.grade}</span>
                      <span className="text-xs text-[#9aa3af]">{comp.subject}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1 text-xs">
                      <span className="text-[#5b6472]">Promedio OMR: <strong className="text-[#07305f]">{comp.omrAvg}%</strong></span>
                      <span className="text-[#5b6472]">SIMCE ({comp.simceYear ?? 'hist'}): <strong className="text-[#22a05a]">{comp.simceScore}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#9aa3af] italic">Registra ensayos para iniciar la comparación.</p>
              )}
            </div>
          </div>

        </div>

        <section className="rounded-md border border-[#d8dde3] bg-white p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#07305f]">{countryProfile.flag} {countryProfile.profileName} activo</p>
              <h2 className="mt-2 text-xl font-semibold">Estandarizacion del lector</h2>
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

        <KPIGrid>
          <KPI label="Ensayos activos" value={formatNumber(quizzesCount ?? 0, locale)} detail="sin archivar" />
          <KPI label="Alumnos" value={formatNumber(studentsCount ?? 0, locale)} detail="por colegio" />
          <KPI label="Lecturas app" value={formatNumber(papers?.length ?? 0, locale)} detail="ultimas sincronizadas" />
          <KPI label="Promedio reciente" value={`${avg}%`} detail="ultimas lecturas" />
        </KPIGrid>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:gap-6">
          <div className="space-y-6">
            {/* Recent Quizzes */}
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
          </div>

          <div className="space-y-6">
            <div className="rounded-md border border-[#e6e8eb] bg-white p-4 md:p-5"><QuotaBar used={scansUsed} limit={scansLimit} /></div>
            <div className="rounded-md border border-[#e6e8eb] bg-white p-4 md:p-5">
              <h2 className="text-base font-semibold">Flujo correcto</h2>
              <div className="mt-4 grid gap-3 text-sm">
                <Link href="/dashboard/quizzes" className="rounded-md border border-[#e6e8eb] px-4 py-3 font-semibold hover:bg-gray-50 transition-colors">1. Crear ensayo y clave</Link>
                <Link href="/sheet" className="rounded-md border border-[#e6e8eb] px-4 py-3 font-semibold hover:bg-gray-50 transition-colors">2. Generar hoja v2</Link>
                <Link href="/scan" className="rounded-md border border-[#e6e8eb] px-4 py-3 font-semibold hover:bg-gray-50 transition-colors">3. Leer desde app movil</Link>
                <Link href="/dashboard/papers" className="rounded-md border border-[#e6e8eb] px-4 py-3 font-semibold hover:bg-gray-50 transition-colors">4. Revisar y exportar</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
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

function SimceHistorical({ simceData, rbd }: { simceData: any[]; rbd: string | null }) {
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
                  {simceData.map((row: any, idx: number) => (
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
              {simceData.map((row: any, idx: number) => (
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
