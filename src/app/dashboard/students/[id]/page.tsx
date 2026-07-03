import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { calculateGrade } from "@/lib/latam";
import { PrintButton } from "@/components/dashboard/PrintButton";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

const NOTA = (score: number, total: number) => (total > 0 ? calculateGrade(score, total).grade : 0);

function notaColor(n: number) {
  if (n >= 6) return "text-[#1a8f52]";
  if (n >= 4) return "text-[#07305f]";
  return "text-[#c2410c]";
}

export default async function StudentProfilePage({ params }: PageProps) {
  const { id } = await params;
  const { supabase } = await getDashboardContext();

  const { data: student } = await supabase
    .from("students")
    .select("id, name, rut, student_id, course, created_at")
    .eq("id", id)
    .single();
  if (!student) notFound();

  const codes = [student.rut, student.student_id].filter(Boolean) as string[];
  const { data: papersRaw } = codes.length
    ? await supabase
        .from("papers")
        .select("id, quiz_id, score, total, grade, equivalent_score, scanned_at, status, quizzes(id, title, subject, grade, num_questions, evaluation_type)")
        .in("student_id", codes)
        .order("scanned_at", { ascending: true })
    : { data: [] as any[] };

  const papers = (papersRaw ?? []).filter((p: any) => Number(p.total ?? p.quizzes?.num_questions ?? 0) > 0);

  const rows = papers.map((p: any) => {
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
      date: p.scanned_at,
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

          {/* Historial */}
          <section className="mt-4 rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#111827]">Historial académico</h2>
            <p className="mt-1 text-xs text-[#5b6472]">Cada ensayo rendido. Pincha para ver la estadística global.</p>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#eef0f3] text-xs font-semibold uppercase tracking-wider text-[#5b6472]">
                    <th className="py-2 pr-2">Fecha</th>
                    <th className="py-2 pr-2">Ensayo</th>
                    <th className="py-2 pr-2">Asignatura</th>
                    <th className="py-2 pr-2">Correctas</th>
                    <th className="py-2 pr-2">Logro</th>
                    <th className="py-2 pr-2 text-right">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f3]">
                  {[...rows].reverse().map((r) => (
                    <tr key={r.id} className="text-sm hover:bg-gray-50">
                      <td className="py-3 pr-2 text-xs text-[#5b6472]">{new Date(r.date).toLocaleDateString("es-CL")}</td>
                      <td className="py-3 pr-2 font-semibold"><Link href={`/dashboard/quizzes/${r.quizId}`} className="text-[#07305f] hover:underline">{r.title}</Link></td>
                      <td className="py-3 pr-2 text-[#5b6472]">{r.subject ?? "-"}</td>
                      <td className="py-3 pr-2 font-mono">{r.score}/{r.total}</td>
                      <td className="py-3 pr-2">{r.pct}%</td>
                      <td className={`py-3 pr-2 text-right text-base font-bold ${notaColor(r.nota)}`}>{r.nota.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 md:hidden">
              {[...rows].reverse().map((r) => (
                <Link key={r.id} href={`/dashboard/quizzes/${r.quizId}`} className="block rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">{r.title}</p>
                      <p className="mt-1 text-xs text-[#5b6472]">{r.subject ?? "-"} · {new Date(r.date).toLocaleDateString("es-CL")}</p>
                    </div>
                    <span className={`shrink-0 text-lg font-bold ${notaColor(r.nota)}`}>{r.nota.toFixed(1)}</span>
                  </div>
                  <p className="mt-2 text-xs text-[#5b6472]">Correctas: <b className="font-mono text-[#111827]">{r.score}/{r.total}</b> · {r.pct}%</p>
                </Link>
              ))}
            </div>
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
