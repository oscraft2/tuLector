import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { calculateGrade } from "@/lib/latam";
import { canonicalRut } from "@/lib/rut";
import { computeAxisMastery, type AxisStat } from "@/lib/item_analysis";
import { equivalencesForCourse } from "@/lib/course_level";
import { paesEquivalence, paesTableForQuiz } from "@/lib/paes_scale";
import { StudentDetailHeader } from "@/components/native/StudentDetailHeader";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  /** `?asignatura=Matemática` filtra el historial. Sirve para dos cosas a la
   *  vez: comparar ensayos comparables, y poder mostrar la equivalencia PAES,
   *  que depende de la asignatura (cada una usa otra tabla del DEMRE). */
  searchParams: Promise<{ asignatura?: string }>;
};

type StudentQuiz = {
  id: string | null;
  title: string | null;
  subject: string | null;
  num_questions: number | null;
  answer_key: string | null;
  evaluation_variant: string | null;
};

type StudentPaper = {
  id: string;
  quiz_id: string | null;
  student_rut_norm: string | null;
  score: number | null;
  total: number | null;
  grade: string | number | null;
  scanned_at: string | null;
  answers: unknown;
  quizzes: StudentQuiz | null;
};

type StudentMetadata = { quiz_id: string; question_number: number; axis_name: string | null; skill_name: string | null };

const NOTA = (score: number, total: number) => (total > 0 ? calculateGrade(score, total).grade : 0);

/**
 * Perfil nativo de alumno (tocar una tarjeta en /app/students llega aca, en
 * vez de abrir directo el sheet de editar). Version simplificada del perfil
 * web (/dashboard/students/[id]): KPIs + fortalezas/debilidades por eje +
 * historial, sin el grafico SVG de evolucion. Editar/eliminar vive en el
 * boton del header (StudentDetailHeader), no al tocar la tarjeta.
 */
export default async function NativeStudentProfilePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { asignatura } = await searchParams;
  const { supabase, school } = await getDashboardContext();

  const { data: student } = await supabase
    .from("students")
    .select("id, name, rut, rut_normalized, student_id, course")
    .eq("id", id)
    .eq("school_id", school.id)
    .single();
  if (!student) notFound();

  const { data: courses } = await supabase.from("courses").select("id,name,grade").eq("school_id", school.id).is("archived_at", null).order("name");

  const paperSelect = "id, quiz_id, student_rut_norm, score, total, grade, scanned_at, answers, quizzes(id, title, subject, num_questions, answer_key, evaluation_variant)";
  const studentRutNorm = student.rut_normalized ?? canonicalRut(student.rut) ?? canonicalRut(student.student_id);
  const codes = [student.rut, student.student_id].filter(Boolean) as string[];
  const paperQueries = [];
  if (studentRutNorm) {
    paperQueries.push(
      supabase.from("papers").select(paperSelect).eq("school_id", school.id).eq("student_rut_norm", studentRutNorm).order("scanned_at", { ascending: true })
    );
  }
  if (codes.length) {
    paperQueries.push(
      supabase.from("papers").select(paperSelect).eq("school_id", school.id).in("student_id", codes).order("scanned_at", { ascending: true })
    );
  }
  const paperResults = paperQueries.length ? await Promise.all(paperQueries) : [];
  const papersById = new Map<string, StudentPaper>();
  for (const result of paperResults) {
    for (const paper of (result.data ?? []) as unknown as StudentPaper[]) papersById.set(String(paper.id), paper);
  }
  const papersRaw = [...papersById.values()].sort((a, b) => new Date(a.scanned_at ?? 0).getTime() - new Date(b.scanned_at ?? 0).getTime());
  const papers = papersRaw.filter((p) => Number(p.total ?? p.quizzes?.num_questions ?? 0) > 0);

  const quizIds = [...new Set(papers.map((p) => p.quizzes?.id ?? p.quiz_id).filter((quizId): quizId is string => Boolean(quizId)))];
  const { data: metadataRaw } = quizIds.length
    ? await supabase.from("question_metadata").select("quiz_id, question_number, axis_name, skill_name").in("quiz_id", quizIds)
    : { data: [] as StudentMetadata[] };
  const metadataByQuiz = new Map<string, Array<{ question_number: number; axis_name: string | null; skill_name: string | null }>>();
  for (const meta of (metadataRaw ?? []) as StudentMetadata[]) {
    const quizId = String(meta.quiz_id);
    const rows = metadataByQuiz.get(quizId) ?? [];
    rows.push({ question_number: Number(meta.question_number), axis_name: meta.axis_name ?? null, skill_name: meta.skill_name ?? null });
    metadataByQuiz.set(quizId, rows);
  }
  const axisMastery: AxisStat[] = computeAxisMastery(
    papers.map((p) => {
      const quiz = p.quizzes;
      const quizId = quiz?.id ?? p.quiz_id ?? "";
      return {
        answers: p.answers,
        answerKey: quiz?.answer_key ?? null,
        numQuestions: quiz?.num_questions ?? p.total ?? 0,
        metadata: metadataByQuiz.get(quizId) ?? [],
      };
    })
  );

  const allRows = papers.map((p) => {
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
      variant: p.quizzes?.evaluation_variant ?? null,
      score, total, pct, nota,
      date: p.scanned_at ?? new Date(0).toISOString(),
    };
  });

  // Asignaturas con historial, para el filtro. Solo aparece si hay mas de una:
  // con una sola, un filtro de un elemento es ruido.
  const subjects = [...new Set(allRows.map((r) => r.subject).filter((s): s is string => Boolean(s)))].sort();
  const activeSubject = asignatura && subjects.includes(asignatura) ? asignatura : null;
  const rows = activeSubject ? allRows.filter((r) => r.subject === activeSubject) : allRows;

  // La equivalencia PAES solo se muestra con una asignatura filtrada: cada una
  // usa otra tabla del DEMRE, asi que mezclarlas en una misma lista invitaria a
  // comparar numeros que no son comparables.
  const paesTable = activeSubject ? paesTableForQuiz({ subject: activeSubject, evaluation_variant: rows[0]?.variant }) : null;
  const showPaes = paesTable !== null && equivalencesForCourse(student.course).paes;

  const count = rows.length;
  const avgNota = count ? rows.reduce((s, r) => s + r.nota, 0) / count : 0;
  const best = count ? rows.reduce((b, r) => (r.nota > b.nota ? r : b), rows[0]) : null;
  const trend = count >= 2 ? rows[rows.length - 1].nota - rows[0].nota : 0;
  const approved = rows.filter((r) => r.nota >= 4).length;
  const idLabel = student.rut ?? student.student_id ?? "Sin identificar";

  return (
    <main className="min-h-dvh bg-[#f5f6f8] text-[#0b1220]">
      <StudentDetailHeader student={student} courses={courses ?? []} />

      <section className="space-y-5 px-5 py-6 pb-24">
        <div className="rounded-2xl border border-[#e6e8eb] bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#07305f] text-lg font-bold text-white">
              {student.name?.charAt(0)?.toUpperCase() ?? "A"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-[#111827]">{student.name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#5b6472]">
                <span className="font-mono">{idLabel}</span>
                {student.course ? <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[11px] font-semibold text-[#07305f]">{student.course}</span> : null}
              </p>
            </div>
          </div>
        </div>

        {count === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-5 text-center text-sm text-[#5b6472]">
            Aun no hay ensayos rendidos. Cuando escanees sus hojas, aca aparece su historial.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Ensayos rendidos" value={String(count)} sub={`${approved} aprobados`} />
              <Kpi label="Nota promedio" value={avgNota.toFixed(1)} sub={`${best ? Math.round((best.pct)) : 0}% mejor logro`} tone={avgNota >= 4 ? "good" : "bad"} />
              <Kpi label="Mejor resultado" value={best ? best.nota.toFixed(1) : "-"} sub={best?.title ?? ""} tone="good" />
              <Kpi label="Tendencia" value={`${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend).toFixed(1)}`} sub="primer → ultimo" tone={trend >= 0 ? "good" : "bad"} />
            </div>

            {axisMastery.length > 0 ? (
              <div className="rounded-2xl border border-[#e6e8eb] bg-white p-4">
                <h2 className="text-sm font-bold text-[#111827]">Fortalezas y debilidades por eje</h2>
                <div className="mt-3 flex flex-col gap-3">
                  {axisMastery.map((axis) => (
                    <div key={axis.axis} className="grid grid-cols-[minmax(90px,140px)_minmax(0,1fr)_40px] items-center gap-2">
                      <p className="truncate text-xs font-semibold text-[#111827]" title={axis.axis}>{axis.axis}</p>
                      <div className="h-3 overflow-hidden rounded-full bg-[#eef0f3]">
                        <div className={`h-full rounded-full ${AXIS_BAR[axis.level]}`} style={{ width: `${axis.pct}%` }} />
                      </div>
                      <p className={`text-right text-xs font-bold ${AXIS_TEXT[axis.level]}`}>{axis.pct}%</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Historial de ensayos</p>

              {/* Filtro por asignatura. Enlaces, no estado de cliente: la APK
                  navega igual y la pagina sigue siendo de servidor (las tablas
                  del DEMRE pesan y no tienen por que viajar al telefono).
                  Scroll horizontal para que nunca corte ni apile en pantalla
                  angosta. */}
              {subjects.length > 1 && (
                <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <FilterChip href={`/app/students/${id}`} active={!activeSubject}>Todas</FilterChip>
                  {subjects.map((subject) => (
                    <FilterChip
                      key={subject}
                      href={`/app/students/${id}?asignatura=${encodeURIComponent(subject)}`}
                      active={activeSubject === subject}
                    >
                      {subject}
                    </FilterChip>
                  ))}
                </div>
              )}

              <div className="grid gap-2">
                {[...rows].reverse().map((r) => {
                  const pct = r.total > 0 ? r.score / r.total : null;
                  const paes = showPaes && pct !== null && paesTable ? paesEquivalence(pct, paesTable).score : null;
                  return (
                    <Link
                      key={r.id}
                      href={r.quizId ? `/app/results/${r.quizId}` : "#"}
                      className="flex items-center gap-3 rounded-2xl border border-[#e6e8eb] bg-white p-4 shadow-sm active:scale-[0.98]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#111827]">{r.title}</p>
                        <p className="mt-0.5 text-xs text-[#5b6472]">
                          {r.score}/{r.total} correctas · {new Date(r.date).toLocaleDateString("es-CL")}
                        </p>
                        {paes !== null && (
                          <p className="mt-1 text-[11px] font-semibold tabular-nums text-[#8a93a1]">
                            PAES <span className="text-[#5b6472]">{paes}</span>
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 text-lg font-black tabular-nums ${r.nota >= 4 ? "text-[#1a8f52]" : "text-[#c2410c]"}`}>{r.nota.toFixed(1)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

const AXIS_BAR = { good: "bg-[#1a8f52]", warn: "bg-[#c77700]", bad: "bg-[#c2410c]" } as const;
const AXIS_TEXT = { good: "text-[#1a8f52]", warn: "text-[#c77700]", bad: "text-[#c2410c]" } as const;

/** Pildora del filtro de asignatura. Alto de toque comodo (36px) y sin
 *  encogerse, para que el scroll horizontal funcione en vez de apilarse. */
function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors active:scale-[0.97] ${
        active
          ? "bg-[#07305f] text-white"
          : "border border-[#e6e8eb] bg-white text-[#5b6472]"
      }`}
    >
      {children}
    </Link>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-[#1a8f52]" : tone === "bad" ? "text-[#c2410c]" : "text-[#111827]";
  return (
    <div className="rounded-2xl border border-[#e6e8eb] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">{label}</p>
      <p className={`mt-1 text-xl font-black tracking-tight ${color}`}>{value}</p>
      {sub ? <p className="mt-0.5 truncate text-[11px] text-[#9aa3af]">{sub}</p> : null}
    </div>
  );
}
