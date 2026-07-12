import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase_server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { resolveDisplayName, type PrivacyLevel } from "@/lib/display_name";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: "/r" },
};

type PageProps = { params: Promise<{ token: string }> };

type PaperRow = {
  student_name: string | null;
  student_id: string | null;
  score: number;
  total: number;
  answers: Array<{ q: number; a: string; s?: number[] }> | null;
  scanned_at: string;
  equivalent_score: number | null;
  grade: number | null;
};

type QuizRow = {
  title: string;
  num_questions: number;
  answer_key: string | null;
  evaluation_type: string | null;
  evaluation_variant: string | null;
  subject: string | null;
  grade: string | null;
};

type SchoolRow = { name: string };

export default async function PublicResultPage({ params }: PageProps) {
  const { token } = await params;
  const adminClient = createSupabaseAdminClient();
  const anonClient = await createSupabaseServerClient();

  const { data: link, error: linkError } = await adminClient
    .from("result_links")
    .select("*")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();

  if (linkError || !link) notFound();

  await adminClient.rpc("increment_result_link_view", { link_id: link.id });

  const [{ data: paper }, { data: quiz }, { data: schoolRow }] = await Promise.all([
    anonClient.from("papers").select("student_name,student_id,score,total,answers,scanned_at,equivalent_score,grade").eq("id", link.paper_id).single(),
    anonClient.from("quizzes").select("title,num_questions,answer_key,evaluation_type,evaluation_variant,subject,grade").eq("id", link.quiz_id).single(),
    anonClient.from("schools").select("name").eq("id", link.school_id).single(),
  ]);

  if (!paper || !quiz) notFound();

  const displayName = resolveDisplayName(
    (paper as PaperRow).student_name ?? null,
    (paper as PaperRow).student_id ?? null,
    link.privacy_level as PrivacyLevel,
  );

  const paperData = paper as PaperRow;
  const quizData = quiz as QuizRow;
  const score = paperData.score ?? 0;
  const total = paperData.total ?? quizData.num_questions ?? 0;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const isPAES = quizData.evaluation_type === "paes";
  const isSIMCE = quizData.evaluation_type === "simce";

  const answerKey = String(quizData.answer_key ?? "").replace(/[^A-Za-z]/g, "").toUpperCase();
  const answers = Array.isArray(paperData.answers) ? paperData.answers : [];

  const questions = Array.from({ length: quizData.num_questions ?? 0 }, (_, i) => {
    const ans = answers.find((a: { q: number; a: string; s?: number[] }) => a.q === i + 1);
    const studentAnswer = ans ? String(ans.a ?? "-").trim().toUpperCase() : "-";
    const expected = answerKey[i] ?? "";
    return {
      q: i + 1,
      answer: studentAnswer,
      expected,
      correct: studentAnswer !== "-" && studentAnswer === expected,
    };
  });

  const correctCount = questions.filter((q) => q.correct).length;

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#111827] font-sans">
      <Header schoolName={(schoolRow as SchoolRow | null)?.name ?? ""} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <QuizInfo quiz={quizData} />
        <StudentInfo name={displayName} />
        <ScoreCards
          pct={pct}
          score={score}
          total={total}
          grade={paperData.grade}
          equivalentScore={paperData.equivalent_score}
          isPAES={isPAES}
          isSIMCE={isSIMCE}
          correctCount={correctCount}
        />
        <QuestionGrid questions={questions} />
      </main>
      <Footer scannedAt={paperData.scanned_at} />
    </div>
  );
}

function Header({ schoolName }: { schoolName: string }) {
  return (
    <header className="border-b border-[#e6eaf0] bg-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#07305f]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M10 9H8" /><path d="M16 13H8" /><path d="M14 17H8" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#07305f]">TuLector</p>
            {schoolName ? <p className="text-[11px] leading-tight text-[#6b7280]">{schoolName}</p> : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function QuizInfo({ quiz }: { quiz: QuizRow }) {
  return (
    <div className="mb-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">Resultado de evaluacion</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{quiz.title}</h1>
      <p className="mt-0.5 text-sm text-[#5b6472]">
        {quiz.subject && `${quiz.subject}${quiz.grade ? ` · ${quiz.grade}` : ""}`}
      </p>
    </div>
  );
}

function StudentInfo({ name }: { name: string }) {
  return (
    <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#e1e5ea] bg-white px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef4ff] text-sm font-bold text-[#07305f]">
        {name.charAt(0)}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Estudiante</p>
        <p className="text-sm font-semibold text-[#111827]">{name}</p>
      </div>
    </div>
  );
}

function ScoreCards({ pct, score, total, grade, equivalentScore, isPAES, isSIMCE, correctCount }: {
  pct: number; score: number; total: number; grade: number | null;
  equivalentScore: number | null; isPAES: boolean; isSIMCE: boolean; correctCount: number;
}) {
  const getScoreLabel = () => {
    if (isPAES) return `${equivalentScore ?? Math.round(100 + (score / Math.max(1, total)) * 900)} pts PAES`;
    if (isSIMCE) return `${equivalentScore ?? Math.round(100 + (score / Math.max(1, total)) * 300)} pts SIMCE`;
    if (grade !== null && grade !== undefined) return `Nota ${formatGrade(grade)}`;
    return `${score}/${total}`;
  };

  const getLevelLabel = () => {
    if (isPAES || isSIMCE) return "";
    if (grade === null || grade === undefined) return "";
    if (grade >= 6.5) return "Muy Bueno";
    if (grade >= 5.5) return "Bueno";
    if (grade >= 4.0) return "Suficiente";
    if (grade >= 3.0) return "Insuficiente";
    return "Deficiente";
  };

  const levelLabel = getLevelLabel();
  const passColor = grade !== null && grade !== undefined && grade >= 4.0 ? "text-[#16a34a]" : "text-[#dc2626]";

  const cards: Array<{ label: string; value: string; subtitle: string; valueClass?: string }> = [
    { label: "Logro", value: `${pct}%`, subtitle: `${correctCount} de ${total} correctas` },
    { label: "Puntaje", value: `${score}/${total}`, subtitle: getScoreLabel() },
  ];

  if (grade !== null && grade !== undefined) {
    cards.push({ label: "Nota", value: formatGrade(grade), subtitle: levelLabel, valueClass: passColor });
  }

  if (equivalentScore !== null && (isPAES || isSIMCE)) {
    cards.push({ label: isPAES ? "PAES" : "SIMCE", value: String(equivalentScore), subtitle: `${pct}% de logro` });
  }

  return (
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-[#e6e8eb] bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7280]">{c.label}</p>
          <p className={`mt-1.5 text-2xl font-bold tracking-tight ${c.valueClass ?? "text-[#111827]"}`}>{c.value}</p>
          {c.subtitle ? <p className="mt-1 text-[11px] text-[#8b95a1]">{c.subtitle}</p> : null}
        </div>
      ))}
    </div>
  );
}

function QuestionGrid({ questions }: { questions: Array<{ q: number; answer: string; expected: string; correct: boolean }> }) {
  const groups = [];
  for (let i = 0; i < questions.length; i += 5) {
    groups.push(questions.slice(i, i + 5));
  }

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">Preguntas</h2>
      <div className="rounded-xl border border-[#e6e8eb] bg-white p-4 sm:p-5">
        <div className="space-y-3">
          {groups.map((group, gi) => (
            <div key={gi} className="flex flex-wrap gap-x-2 gap-y-3 sm:gap-x-3">
              {group.map((q) => (
                <div key={q.q} className="flex flex-1 flex-col items-center">
                  <span className="mb-1 text-[10px] font-semibold text-[#8b95a1]">{q.q}</span>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    q.answer === "-"
                      ? "bg-[#f3f4f6] text-[#9ca3af]"
                      : q.correct
                        ? "bg-[#dcfce7] text-[#16a34a] ring-2 ring-[#16a34a]/20"
                        : "bg-[#fef2f2] text-[#dc2626] ring-2 ring-[#dc2626]/20"
                  }`}>
                    {q.answer === "-" ? "\u2014" : q.answer}
                  </span>
                  {!q.correct && q.answer !== "-" && (
                    <span className="mt-0.5 text-[9px] text-[#8b95a1]">{q.expected}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-5 border-t border-[#f0f2f5] pt-3">
          <Legend color="bg-[#dcfce7] text-[#16a34a] ring-2 ring-[#16a34a]/20" label="Correcta" />
          <Legend color="bg-[#fef2f2] text-[#dc2626] ring-2 ring-[#dc2626]/20" label="Incorrecta" showExpected />
          <Legend color="bg-[#f3f4f6] text-[#9ca3af]" label="Sin respuesta" />
        </div>
      </div>
    </section>
  );
}

function Legend({ color, label, showExpected }: { color: string; label: string; showExpected?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${color}`}>Aa</span>
      <span className="text-[10px] text-[#6b7280]">{label}</span>
      {showExpected ? <span className="text-[9px] text-[#8b95a1]">\u2014esperada abajo</span> : null}
    </div>
  );
}

function Footer({ scannedAt }: { scannedAt: string | null }) {
  return (
    <footer className="mt-10 border-t border-[#e6eaf0] bg-white py-5">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <p className="text-[11px] text-[#9ca3af]">
          Generado por TuLector
          {scannedAt ? ` · ${new Date(scannedAt).toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" })}` : ""}
        </p>
      </div>
    </footer>
  );
}

function formatGrade(value: number): string {
  return value % 1 === 0 ? value.toFixed(1) : String(value);
}
