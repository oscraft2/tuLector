import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { calculateGrade } from "@/lib/latam";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { canonicalRut } from "@/lib/rut";
import { computeAxisMastery, type AxisStat } from "@/lib/item_analysis";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type StudentQuiz = {
  id: string | null;
  title: string | null;
  subject: string | null;
  grade: string | null;
  num_questions: number | null;
  options_per_question: number | null;
  answer_key: string | null;
  evaluation_type: string | null;
};

type StudentPaper = {
  id: string;
  quiz_id: string | null;
  student_rut_norm: string | null;
  score: number | null;
  total: number | null;
  grade: string | number | null;
  equivalent_score: number | null;
  scanned_at: string | null;
  status: string | null;
  answers: unknown;
  quizzes: StudentQuiz | null;
};

type StudentMetadata = { quiz_id: string; question_number: number; axis_name: string | null; skill_name: string | null };

type StudentGradeRecord = {
  id: string;
  quiz_id: string;
  raw_score: number | null;
  total_questions: number | null;
  calculated_grade: number | string | null;
  passing: boolean | null;
  graded_at: string | null;
  quizzes: { title: string | null } | Array<{ title: string | null }> | null;
};

const NOTA = (score: number, total: number) => (total > 0 ? calculateGrade(score, total).grade : 0);

function notaColor(n: number) {
  if (n >= 6) return "text-[#1a8f52]";
  if (n >= 4) return "text-[#07305f]";
  return "text-[#c2410c]";
}

export default async function StudentProfilePage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, school } = await getDashboardContext();

  const { data: student } = await supabase
    .from("students")
    .select("id, name, rut, rut_normalized, student_id, course, created_at")
    .eq("id", id)
    .eq("school_id", school.id)
    .single();
  if (!student) notFound();

  const paperSelect = "id, quiz_id, student_rut_norm, score, total, grade, equivalent_score, scanned_at, status, answers, quizzes(id, title, subject, grade, num_questions, options_per_question, answer_key, evaluation_type)";
  const studentRutNorm = student.rut_normalized ?? canonicalRut(student.rut) ?? canonicalRut(student.student_id);
  const codes = [student.rut, student.student_id].filter(Boolean) as string[];
  const paperQueries = [];
  if (studentRutNorm) {
    paperQueries.push(
      supabase
        .from("papers")
        .select(paperSelect)
        .eq("school_id", school.id)
        .eq("student_rut_norm", studentRutNorm)
        .order("scanned_at", { ascending: true }),
    );
  }
  if (codes.length) {
    paperQueries.push(
      supabase
        .from("papers")
        .select(paperSelect)
        .eq("school_id", school.id)
        .in("student_id", codes)
        .order("scanned_at", { ascending: true }),
    );
  }

  const paperResults = paperQueries.length ? await Promise.all(paperQueries) : [];
  const papersById = new Map<string, StudentPaper>();
  for (const result of paperResults) {
    for (const paper of (result.data ?? []) as unknown as StudentPaper[]) papersById.set(String(paper.id), paper);
  }
  const papersRaw = [...papersById.values()].sort((a, b) => new Date(a.scanned_at ?? 0).getTime() - new Date(b.scanned_at ?? 0).getTime());

  const { data: gradeRecordsRaw } = studentRutNorm
    ? await supabase
        .from("grade_records")
        .select("id, quiz_id, raw_score, total_questions, calculated_grade, passing, graded_at, quizzes(title)")
        .eq("school_id", school.id)
        .eq("student_code", studentRutNorm)
        .order("graded_at", { ascending: false })
    : { data: [] as StudentGradeRecord[] };
  const gradeHistory = ((gradeRecordsRaw ?? []) as unknown as StudentGradeRecord[]).map((record) => {
    const quiz = Array.isArray(record.quizzes) ? record.quizzes[0] : record.quizzes;
    const grade = Number(record.calculated_grade ?? 0);
    return {
      id: record.id,
      quizId: record.quiz_id,
      title: quiz?.title ?? "Ensayo",
      score: record.raw_score ?? 0,
      total: record.total_questions ?? 0,
      grade: Number.isFinite(grade) ? grade : 0,
      passing: record.passing,
      date: record.graded_at ?? new Date(0).toISOString(),
    };
  });

  const papers = (papersRaw ?? []).filter((p) => Number(p.total ?? p.quizzes?.num_questions ?? 0) > 0);
  const quizIds = [...new Set(papers.map((p) => p.quizzes?.id ?? p.quiz_id).filter((quizId): quizId is string => Boolean(quizId)))];
  const { data: metadataRaw } = quizIds.length
    ? await supabase
        .from("question_metadata")
        .select("quiz_id, question_number, axis_name, skill_name")
        .in("quiz_id", quizIds)
    : { data: [] as StudentMetadata[] };
  const metadataByQuiz = new Map<string, Array<{ question_number: number; axis_name: string | null; skill_name: string | null }>>();
  for (const meta of (metadataRaw ?? []) as StudentMetadata[]) {
    const quizId = String(meta.quiz_id);
    const rows = metadataByQuiz.get(quizId) ?? [];
    rows.push({ question_number: Number(meta.question_number), axis_name: meta.axis_name ?? null, skill_name: meta.skill_name ?? null });
    metadataByQuiz.set(quizId, rows);
  }
  const axisMastery = computeAxisMastery(papers.map((p) => {
    const quiz = p.quizzes;
    const quizId = quiz?.id ?? p.quiz_id ?? "";
    return {
      answers: p.answers,
      answerKey: quiz?.answer_key ?? null,
      numQuestions: quiz?.num_questions ?? p.total ?? 0,
      metadata: metadataByQuiz.get(quizId) ?? [],
    };
  }));

  const rows = papers.map((p) => {
    const total = Number(p.total ?? p.quizzes?.num_questions ?? 0);
    const score = Number(p.score ?? 0);
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    let nota = Number(p.grade);
    if (!Number.isFinite(nota) || nota <= 0) nota = NOTA(score, total);
    return {
      id: p.id,
      quizId: p.quizzes?.id ?? p.quiz_id,
      title: p.quizzes?.title ?? "Ensayo",
      subject: p.quizzes?.subject ?? null,
      grade: p.quizzes?.grade ?? null,
      evalType: p.quizzes?.evaluation_type ?? null,
      score, total, pct, nota,
      date: p.scanned_at ?? new Date(0).toISOString(),
    };
  });

  const count = rows.length;
  const avgNota = count ? rows.reduce((s, r) => s + r.nota, 0) / count : 0;
  const avgPct = count ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / count) : 0;
  const best = count ? rows.reduce((b, r) => (r.nota > b.nota ? r : b), rows[0]) : null;
  const trend = count >= 2 ? rows[rows.length - 1].nota - rows[0].nota : 0;
  const approved = rows.filter((r) => r.nota >= 4).length;

  // Sparkline de notas (orden cronológico)
  const notas = rows.map((r) => r.nota);
  const spMin = 1;
  const spMax = 7;
  const spW = 260;
  const spH = 56;
  const points = notas.map((n, i) => {
    const x = notas.length > 1 ? (i / (notas.length - 1)) * spW : spW / 2;
    const y = spH - ((n - spMin) / (spMax - spMin)) * spH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const idLabel = student.rut ?? student.student_id ?? "Sin identificar";

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href="/dashboard/students" className="text-sm font-semibold text-[#4b5563] hover:text-[#111827]">← Volver a alumnos</Link>
        <PrintButton />
      </div>

      {/* Encabezado del alumno */}
      <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#07305f] text-xl font-bold text-white">{student.name?.charAt(0)?.toUpperCase() ?? "A"}</span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-[#111827]">{student.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#5b6472]">
                <span className="font-mono">{idLabel}</span>
                {student.course ? <span className="rounded-full bg-[#eef4ff] px-2.5 py-0.5 text-xs font-semibold text-[#07305f]">{student.course}</span> : null}
              </p>
            </div>
          </div>
        </div>
      </div>

      {count === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-[#cfd6df] bg-white p-8 text-center">
          <p className="text-sm font-semibold text-[#111827]">Aún no hay ensayos rendidos</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#5b6472]">Cuando este alumno rinda y escanees sus hojas, aquí verás su historial académico y evolución.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Ensayos rendidos" value={String(count)} sub={`${approved} aprobados`} />
            <Kpi label="Nota promedio" value={avgNota.toFixed(1)} sub={`${avgPct}% de logro`} tone={avgNota >= 4 ? "good" : "bad"} />
            <Kpi label="Mejor resultado" value={best ? best.nota.toFixed(1) : "-"} sub={best?.title ?? ""} tone="good" />
            <Kpi label="Tendencia" value={`${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend).toFixed(1)}`} sub="primer → último" tone={trend >= 0 ? "good" : "bad"} />
          </section>

          {/* Evolución */}
          <section className="mt-4 rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#111827]">Evolución de notas</h2>
            <p className="mt-1 text-xs text-[#5b6472]">Cronológico, del primer al último ensayo.</p>
            <div className="mt-4 flex items-center gap-4">
              <svg viewBox={`0 0 ${spW} ${spH}`} className="h-16 w-full max-w-[420px]" preserveAspectRatio="none" aria-hidden="true">
                <line x1="0" y1={spH - ((4 - spMin) / (spMax - spMin)) * spH} x2={spW} y2={spH - ((4 - spMin) / (spMax - spMin)) * spH} stroke="#e6e8eb" strokeWidth="1" strokeDasharray="3 3" />
                {points.length > 1 ? <polyline points={points.join(" ")} fill="none" stroke="#07305f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
                {points.map((pt, i) => {
                  const [x, y] = pt.split(",");
                  return <circle key={i} cx={x} cy={y} r="2.6" fill={notas[i] >= 4 ? "#1a8f52" : "#c2410c"} />;
                })}
              </svg>
              <div className="shrink-0 text-right">
                <p className="text-xs text-[#6b7280]">Línea = nota 4,0</p>
              </div>
            </div>
          </section>

          <AxisMasterySection axes={axisMastery} />

          {/* Historial */}
          <section className="mt-4 rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#111827]">Historial de evaluaciones</h2>
            <p className="mt-1 text-xs text-[#5b6472]">Notas consolidadas desde grade_records. Pincha para ver la estadística global.</p>
            {gradeHistory.length === 0 ? (
              <p className="mt-4 rounded-lg bg-[#f8fafc] px-4 py-5 text-center text-sm text-[#6b7280]">Aún no rinde evaluaciones.</p>
            ) : (
              <>
                <div className="mt-4 hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#eef0f3] text-xs font-semibold uppercase tracking-wider text-[#5b6472]">
                        <th className="py-2 pr-2">Ensayo</th>
                        <th className="py-2 pr-2">Correctas</th>
                        <th className="py-2 pr-2 text-right">Nota</th>
                        <th className="py-2 pr-2">Aprobado</th>
                        <th className="py-2 pr-2">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef0f3]">
                      {gradeHistory.map((record) => (
                        <tr key={record.id} className="text-sm hover:bg-gray-50">
                          <td className="py-3 pr-2 font-semibold"><Link href={`/dashboard/quizzes/${record.quizId}`} className="text-[#07305f] hover:underline">{record.title}</Link></td>
                          <td className="py-3 pr-2 font-mono">{record.score}/{record.total}</td>
                          <td className={`py-3 pr-2 text-right text-base font-bold ${notaColor(record.grade)}`}>{record.grade.toFixed(1)}</td>
                          <td className="py-3 pr-2"><ApprovedPill passing={record.passing} /></td>
                          <td className="py-3 pr-2 text-xs text-[#5b6472]">{new Date(record.date).toLocaleDateString("es-CL")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 grid gap-3 md:hidden">
                  {gradeHistory.map((record) => (
                    <Link key={record.id} href={`/dashboard/quizzes/${record.quizId}`} className="block rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#111827]">{record.title}</p>
                          <p className="mt-1 text-xs text-[#5b6472]">{new Date(record.date).toLocaleDateString("es-CL")}</p>
                        </div>
                        <span className={`shrink-0 text-lg font-bold ${notaColor(record.grade)}`}>{record.grade.toFixed(1)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#5b6472]">
                        <span>Correctas: <b className="font-mono text-[#111827]">{record.score}/{record.total}</b></span>
                        <ApprovedPill passing={record.passing} />
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-[#1a8f52]" : tone === "bad" ? "text-[#c2410c]" : "text-[#111827]";
  return (
    <div className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-[#6b7280]">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${color}`}>{value}</p>
      {sub ? <p className="mt-1 truncate text-[11px] text-[#9aa3af]">{sub}</p> : null}
    </div>
  );
}

function ApprovedPill({ passing }: { passing: boolean | null }) {
  if (passing === null) return <span className="text-xs text-[#6b7280]">-</span>;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${passing ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>{passing ? "Si" : "No"}</span>;
}

const AXIS_LVL = {
  good: { text: "text-[#1a8f52]", bar: "bg-[#1a8f52]" },
  warn: { text: "text-[#c77700]", bar: "bg-[#c77700]" },
  bad: { text: "text-[#c2410c]", bar: "bg-[#c2410c]" },
} as const;

function AxisMasterySection({ axes }: { axes: AxisStat[] }) {
  return (
    <section className="mt-4 rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-[#111827]">Fortalezas y debilidades por eje</h2>
      <p className="mt-1 text-xs text-[#5b6472]">Consolidado entre todos los ensayos rendidos por el alumno.</p>
      {axes.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {axes.map((axis) => (
            <div key={axis.axis} className="grid grid-cols-[minmax(110px,180px)_minmax(0,1fr)_48px] items-center gap-3">
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-semibold text-[#111827]" title={axis.axis}>{axis.axis}</div>
                <div className="text-[10.5px] text-[#9aa3af]">{axis.count} respuesta{axis.count === 1 ? "" : "s"}</div>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-[#eef0f3]"><div className={`h-full rounded-full ${AXIS_LVL[axis.level].bar}`} style={{ width: `${axis.pct}%` }} /></div>
              <div className={`text-right text-[13px] font-bold ${AXIS_LVL[axis.level].text}`}>{axis.pct}%</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-[#f8fafc] px-4 py-5 text-center text-xs text-[#6b7280]">Aún no hay metadatos curriculares por pregunta para consolidar fortalezas y debilidades.</p>
      )}
    </section>
  );
}
