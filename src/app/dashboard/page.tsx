import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages, formatNumber } from "@/locales";
import { DataTable } from "@/components/dashboard/DataTable";
import { QuotaBar } from "@/components/dashboard/QuotaBar";
import { checkAndTriggerQuotaAlerts } from "@/lib/quota_alerts";
import { computeItemAnalysis, levelOf, type ItemStat, type ItemAnalysis } from "@/lib/item_analysis";
import { calculateGrade } from "@/lib/latam";

export const dynamic = "force-dynamic";

const LVL = {
  good: { text: "text-[#1a8f52]", bar: "bg-[#1a8f52]", soft: "bg-[#e7f6ec]", chip: "text-[#1a8f52]" },
  warn: { text: "text-[#c77700]", bar: "bg-[#c77700]", soft: "bg-[#fdf3e2]", chip: "text-[#c77700]" },
  bad: { text: "text-[#c2410c]", bar: "bg-[#c2410c]", soft: "bg-[#fbeae1]", chip: "text-[#c2410c]" },
} as const;

const NOTA_LABELS = ["1–2", "2–3", "3–4", "4–5", "5–6", "6–7"];

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
  const simceData = simceResult?.data ?? [];
  const allSchoolPapers = (allSchoolPapersResult?.data ?? []) as any[];
  const schoolAvg = allSchoolPapers.length
    ? Math.round(allSchoolPapers.reduce((sum, p) => sum + (Number(p.score ?? 0) / Math.max(1, Number(p.total ?? 1))) * 100, 0) / allSchoolPapers.length)
    : 0;

  // ---- Análisis por ítem del último ensayo con lecturas (datos reales) ----
  const latestQuizId = papers?.[0]?.quiz_id ?? null;
  let itemQuiz: any = null;
  let analysis: ItemAnalysis | null = null;
  const notaBuckets = [0, 0, 0, 0, 0, 0];
  let notaSum = 0;
  let notaTotal = 0;

  if (latestQuizId) {
    const [quizRes, papersRes, metaRes] = await Promise.all([
      supabase.from("quizzes").select("id, title, subject, grade, num_questions, options_per_question, answer_key, evaluation_type").eq("id", latestQuizId).single(),
      supabase.from("papers").select("answers, score, total, grade").eq("quiz_id", latestQuizId),
      supabase.from("question_metadata").select("question_number, axis_name, skill_name").eq("quiz_id", latestQuizId).order("question_number"),
    ]);
    itemQuiz = quizRes.data;
    const ip = (papersRes.data ?? []) as any[];
    if (itemQuiz && ip.length > 0) {
      analysis = computeItemAnalysis(ip, itemQuiz.answer_key, itemQuiz.num_questions ?? 0, itemQuiz.options_per_question ?? 5, metaRes.data ?? []);
      for (const p of ip) {
        let nota = Number(p.grade);
        if (!Number.isFinite(nota) || nota <= 0) {
          nota = calculateGrade(Number(p.score ?? 0), Number(p.total ?? itemQuiz.num_questions ?? 1)).grade;
        }
        let idx = Math.floor(nota) - 1;
        if (idx < 0) idx = 0;
        if (idx > 5) idx = 5;
        notaBuckets[idx] += 1;
        notaSum += nota;
        notaTotal += 1;
      }
    }
  }

  const reteach = analysis ? analysis.items.filter((i) => i.correct).sort((a, b) => a.pctCorrect - b.pctCorrect).slice(0, 4) : [];
  const approved = notaBuckets[3] + notaBuckets[4] + notaBuckets[5];
  const reproved = notaTotal - approved;
  const approvalPct = notaTotal ? Math.round((approved / notaTotal) * 100) : 0;
  const meanNota = notaTotal ? (notaSum / notaTotal) : 0;
  const maxBucket = Math.max(1, ...notaBuckets);
  const worstAxis = analysis && analysis.axes.length ? analysis.axes[0] : null;

  // ---- Resultados del colegio (agregaciones reales) ----
  const papersGroupedByGrade: Record<string, { sum: number; count: number }> = {};
  const papersGroupedByEvalType: Record<string, { sum: number; count: number }> = {};
  const papersGroupedByGradeSubject: Record<string, { sum: number; count: number }> = {};

  allSchoolPapers.forEach((paper: any) => {
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
    const matchedSimce = simceData.find((row: any) =>
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
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">TuLector School</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{t.dashboard}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b6472]">Consola web para administrar cursos, ensayos, resultados y análisis. La lectura OMR ocurre desde la app móvil sincronizada.</p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-md border border-[#e6e8eb] bg-white p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">{school.name}</p>
            <p className="mt-1 text-sm text-[#4b5563]">Plan {school.plan} · {countryProfile.profileName} {school.rbd ? `· RBD: ${school.rbd}` : ""}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/quizzes" className="rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50">Ensayos</Link>
            <Link href="/scan" className="rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white">Escanear</Link>
          </div>
        </div>

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

        {analysis && itemQuiz && analysis.totalPapers > 0 ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#111827]">Análisis por pregunta</h2>
                    <p className="mt-1 text-xs text-[#5b6472]">Qué dominó y qué falló el curso — con distribución de alternativas.</p>
                  </div>
                  <Link href={`/dashboard/quizzes/${itemQuiz.id}`} className="shrink-0 text-sm font-semibold text-[#07305f] hover:underline">Ver ensayo →</Link>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-bold text-[#07305f]">{itemQuiz.title}</span>
                  {itemQuiz.grade ? <span className="rounded-full bg-[#eef0f3] px-2.5 py-1 text-[11px] font-bold text-[#4b5563]">{itemQuiz.grade}</span> : null}
                  <span className="rounded-full bg-[#eef0f3] px-2.5 py-1 text-[11px] font-bold text-[#4b5563]">{analysis.totalPapers} alumnos</span>
                  <span className="rounded-full bg-[#eef0f3] px-2.5 py-1 text-[11px] font-bold text-[#4b5563]">{itemQuiz.num_questions} preguntas</span>
                </div>
                <div className="mt-3 max-h-[520px] overflow-y-auto pr-1">
                  {analysis.items.map((it) => (<ItemRow key={it.q} it={it} />))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3.5 text-[11.5px] text-[#6b7280]">
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#1a8f52]" /> Alternativa correcta</span>
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#e6e8eb]" /> Distractores</span>
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#c77700]" /> 50–79%</span>
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#c2410c]" /> &lt;50% revisar</span>
                </div>
              </div>

              <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-[#111827]">Preguntas para reforzar</h2>
                <p className="mt-1 text-xs text-[#5b6472]">Las {reteach.length} preguntas con menor logro del curso.</p>
                <div className="mt-4 flex flex-col gap-2.5">
                  {reteach.map((it) => (
                    <div key={it.q} className="flex items-center gap-3 rounded-lg border border-[#e6e8eb] bg-[#fbfcfd] px-3 py-2.5">
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#fbeae1] text-xs font-extrabold text-[#c2410c]">{it.q}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-[#111827]">{it.skill || it.axis || `Pregunta ${it.q}`}</div>
                        <div className="truncate text-[11.5px] text-[#6b7280]">
                          {it.axis ? `${it.axis} · ` : ""}
                          {it.topDistractor ? `${it.topDistractorPct}% marcó ${it.topDistractor}` : "sin distractor dominante"}
                        </div>
                      </div>
                      <div className={`text-[15px] font-extrabold ${LVL[it.level].text}`}>{it.pctCorrect}%</div>
                    </div>
                  ))}
                  {reteach.length === 0 ? <p className="text-xs italic text-[#9aa3af]">Carga la clave del ensayo para ver las preguntas más falladas.</p> : null}
                </div>
                {worstAxis && analysis.hasMetadata ? (
                  <div className="mt-4 rounded-lg bg-[#eef4ff] px-3.5 py-3 text-[12.5px] font-semibold text-[#07305f]">
                    💡 El eje <b>{worstAxis.axis}</b> es el más débil ({worstAxis.pct}%). Buen candidato a una clase de refuerzo.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-[#111827]">Distribución de notas</h2>
                <p className="mt-1 text-xs text-[#5b6472]">{itemQuiz.title}{itemQuiz.grade ? ` · ${itemQuiz.grade}` : ""}.</p>
                <div className="mt-4 grid grid-cols-6 items-end gap-2" style={{ height: "150px" }}>
                  {notaBuckets.map((n, i) => {
                    const hot = i >= 3;
                    return (
                      <div key={i} className="flex h-full flex-col items-center justify-end gap-1.5">
                        <span className="text-[11px] font-bold text-[#4b5563]">{n}</span>
                        <div className={`w-full rounded-t-md ${hot ? "bg-[#1a8f52]" : "bg-[#07305f]"}`} style={{ height: `${Math.max(4, Math.round((n / maxBucket) * 100))}%`, opacity: n === 0 ? 0.25 : 1 }} />
                        <span className="text-[10.5px] text-[#6b7280]">{NOTA_LABELS[i]}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-dashed border-[#e6e8eb] pt-2.5 text-xs text-[#4b5563]">
                  <span>Reprobados: <b className="text-[#c2410c]">{reproved}</b></span>
                  <span>Nota media: <b className="text-[#07305f]">{meanNota.toFixed(1)}</b></span>
                  <span>Aprobación: <b className="text-[#1a8f52]">{approvalPct}%</b></span>
                </div>
              </div>

              <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-[#111827]">Dominio por eje</h2>
                <p className="mt-1 text-xs text-[#5b6472]">% de logro por eje curricular (metadatos por pregunta).</p>
                {analysis.hasMetadata && analysis.axes.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-3">
                    {analysis.axes.map((ax) => (
                      <div key={ax.axis} className="grid grid-cols-[minmax(90px,140px)_minmax(0,1fr)_42px] items-center gap-3">
                        <div className="truncate text-[12.5px] font-semibold text-[#111827]" title={ax.axis}>{ax.axis}</div>
                        <div className="h-4 overflow-hidden rounded-full bg-[#eef0f3]"><div className={`h-full rounded-full ${LVL[ax.level].bar}`} style={{ width: `${ax.pct}%` }} /></div>
                        <div className={`text-right text-[13px] font-bold ${LVL[ax.level].text}`}>{ax.pct}%</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg bg-[#f8fafc] px-4 py-6 text-center text-xs text-[#6b7280]">
                    Este ensayo no tiene ejes/habilidades cargados por pregunta.
                    <Link href={`/dashboard/quizzes/${itemQuiz.id}`} className="ml-1 font-semibold text-[#07305f] underline">Configurar metadatos</Link>
                  </div>
                )}
              </div>
            </div>
          </>
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
            <div className="rounded-md border border-[#e6e8eb] bg-white p-4 md:p-5">
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

function StatCard({ label, value, detail, accent }: { label: string; value: string | number; detail?: string; accent?: boolean }) {
  return (
    <article className={`rounded-md border p-4 shadow-sm md:p-5 ${accent ? "border-[#07305f]/25 bg-[#f5f8fd]" : "border-[#e6e8eb] bg-white"}`} aria-label={label}>
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

function ItemRow({ it }: { it: ItemStat }) {
  const opts = Object.keys(it.counts).filter((k) => k !== "-").sort();
  const mx = Math.max(1, ...Object.values(it.counts));
  const lvl = LVL[it.level];
  return (
    <div className="grid grid-cols-[26px_minmax(0,1fr)_88px] items-center gap-3 border-b border-[#eef0f3] py-2.5 last:border-0">
      <div className="text-xs font-bold text-[#6b7280]">P{it.q}</div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-[#111827]">
          {it.axis ? (<span>{it.axis}{it.skill ? <span className="font-normal text-[#6b7280]"> · {it.skill}</span> : null}</span>) : `Pregunta ${it.q}`}
        </div>
        <div className="mt-1.5 flex h-5 items-end gap-[3px]">
          {opts.map((o) => {
            const h = Math.round(((it.counts[o] ?? 0) / mx) * 100);
            const isCorrect = o === it.correct;
            return <div key={o} className={`flex-1 rounded-t-[3px] ${isCorrect ? "bg-[#1a8f52]" : "bg-[#e6e8eb]"}`} style={{ height: `${Math.max(6, h)}%` }} title={`${o}: ${it.counts[o] ?? 0}`} />;
          })}
        </div>
      </div>
      <div className="text-right">
        <span className={`text-[15px] font-bold ${lvl.text}`}>{it.pctCorrect}%</span>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#eef0f3]"><div className={`h-full rounded-full ${lvl.bar}`} style={{ width: `${it.pctCorrect}%` }} /></div>
      </div>
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
