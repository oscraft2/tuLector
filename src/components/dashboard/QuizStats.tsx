import Link from "next/link";
import { computeItemAnalysis } from "@/lib/item_analysis";
import { calculateGrade } from "@/lib/latam";
import { ExpandableQuestionList } from "@/components/dashboard/ExpandableQuestionList";

const LVL = {
  good: { text: "text-[#1a8f52]", bar: "bg-[#1a8f52]" },
  warn: { text: "text-[#c77700]", bar: "bg-[#c77700]" },
  bad: { text: "text-[#c2410c]", bar: "bg-[#c2410c]" },
} as const;

const NOTA_LABELS = ["1–2", "2–3", "3–4", "4–5", "5–6", "6–7"];

type PaperLite = { answers: unknown; score: number | null; total: number | null; grade: string | number | null };
type MetaLite = { question_number: number; axis_name: string | null; skill_name: string | null };
type QuizLite = {
  id?: string | null;
  title?: string | null;
  grade?: string | null;
  num_questions: number | null;
  options_per_question: number | null;
  answer_key: string | null;
};

export function QuizStats({
  quiz,
  papers,
  metadata,
  variant = "default",
}: {
  quiz: QuizLite;
  papers: PaperLite[];
  metadata: MetaLite[];
  variant?: "default" | "dashboard";
}) {
  const analysis = computeItemAnalysis(
    papers,
    quiz.answer_key,
    quiz.num_questions ?? 0,
    quiz.options_per_question ?? 5,
    metadata,
  );

  const notaBuckets = [0, 0, 0, 0, 0, 0];
  let notaSum = 0;
  let notaTotal = 0;
  for (const p of papers) {
    const total = Number(p.total ?? quiz.num_questions ?? 0);
    if (total <= 0) continue;
    let nota = Number(p.grade);
    if (!Number.isFinite(nota) || nota <= 0) nota = calculateGrade(Number(p.score ?? 0), total).grade;
    let idx = Math.floor(nota) - 1;
    if (idx < 0) idx = 0;
    if (idx > 5) idx = 5;
    notaBuckets[idx] += 1;
    notaSum += nota;
    notaTotal += 1;
  }

  if (analysis.totalPapers === 0) {
    return (
      <div className="rounded-xl border border-[#e7e5df] bg-white p-8 text-center shadow-xs">
        <p className="text-sm font-semibold text-[#1c1917]">Sin lecturas para analizar</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#57534e]">
          Cuando escanees hojas de este ensayo, aquí verás la distribución de notas, el análisis por pregunta y el dominio por eje.
        </p>
      </div>
    );
  }

  const approved = notaBuckets[3] + notaBuckets[4] + notaBuckets[5];
  const approvalPct = notaTotal ? Math.round((approved / notaTotal) * 100) : 0;
  const meanNota = notaTotal ? notaSum / notaTotal : 0;
  const maxBucket = Math.max(1, ...notaBuckets);
  const avgPct = analysis.items.length
    ? Math.round(
        analysis.items.filter((i) => i.correct).reduce((s, i) => s + i.pctCorrect, 0) /
          Math.max(1, analysis.items.filter((i) => i.correct).length),
      )
    : 0;
  const reteach = analysis.items
    .filter((i) => i.correct)
    .sort((a, b) => a.pctCorrect - b.pctCorrect)
    .slice(0, 4);
  const worstAxis = analysis.axes.length ? analysis.axes[0] : null;

  if (variant === "dashboard") {
    return (
      <>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-[#e7e5df] bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#1c1917]">Análisis por pregunta</h2>
                <p className="mt-1 text-xs text-[#57534e]">Qué dominó y qué falló el curso — con distribución de alternativas.</p>
              </div>
              {quiz.id ? (
                <Link href={`/dashboard/quizzes/${quiz.id}`} className="shrink-0 text-sm font-semibold text-[#07305f] hover:underline">
                  Ver ensayo →
                </Link>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {quiz.title ? (
                <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-bold text-[#07305f]">{quiz.title}</span>
              ) : null}
              {quiz.grade ? (
                <span className="rounded-full bg-[#efede8] px-2.5 py-1 text-[11px] font-bold text-[#44403c]">{quiz.grade}</span>
              ) : null}
              <span className="tnum rounded-full bg-[#efede8] px-2.5 py-1 text-[11px] font-bold text-[#44403c]">
                {analysis.totalPapers} alumnos
              </span>
              <span className="tnum rounded-full bg-[#efede8] px-2.5 py-1 text-[11px] font-bold text-[#44403c]">
                {quiz.num_questions} preguntas
              </span>
            </div>

            <ExpandableQuestionList items={analysis.items} />

            <div className="mt-4 flex flex-wrap gap-3.5 text-[11.5px] text-[#78716c]">
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#1a8f52]" /> Alternativa correcta
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#e7e5df]" /> Distractores
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#c77700]" /> 50–79%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#c2410c]" /> &lt;50% revisar
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[#e7e5df] bg-white p-5 shadow-xs">
            <h2 className="text-base font-semibold text-[#1c1917]">Preguntas para reforzar</h2>
            <p className="mt-1 text-xs text-[#57534e]">Las {reteach.length} preguntas con menor logro del curso.</p>
            <div className="mt-4 flex flex-col gap-2.5">
              {reteach.map((it) => (
                <div key={it.q} className="flex items-center gap-3 rounded-lg border border-[#efede8] bg-[#faf9f6] px-3 py-2.5">
                  <div className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#fbeae1] text-xs font-extrabold text-[#c2410c]">
                    {it.q}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-[#1c1917]">{it.skill || it.axis || `Pregunta ${it.q}`}</div>
                    <div className="truncate text-[11.5px] text-[#78716c]">
                      {it.axis ? `${it.axis} · ` : ""}
                      {it.topDistractor ? `${it.topDistractorPct}% marcó ${it.topDistractor}` : "sin distractor dominante"}
                    </div>
                  </div>
                  <div className={`tnum text-[15px] font-extrabold ${LVL[it.level].text}`}>{it.pctCorrect}%</div>
                </div>
              ))}
              {reteach.length === 0 ? (
                <p className="text-xs italic text-[#78716c]">Carga la clave del ensayo para ver las preguntas más falladas.</p>
              ) : null}
            </div>
            {worstAxis && analysis.hasMetadata ? (
              <div className="mt-4 rounded-lg bg-[#eef4ff] px-3.5 py-3 text-[12.5px] font-semibold text-[#07305f]">
                El eje <b>{worstAxis.axis}</b> es el más débil ({worstAxis.pct}%). Buen candidato a una clase de refuerzo.
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-xl border border-[#e7e5df] bg-white p-5 shadow-xs">
            <h2 className="text-base font-semibold text-[#1c1917]">Distribución de notas</h2>
            <p className="mt-1 text-xs text-[#57534e]">
              {quiz.title}
              {quiz.grade ? ` · ${quiz.grade}` : ""}.
            </p>
            <div className="mt-4 grid grid-cols-6 items-end gap-2" style={{ height: "150px" }}>
              {notaBuckets.map((n, i) => {
                const hot = i >= 3;
                return (
                  <div key={i} className="flex h-full flex-col items-center justify-end gap-1.5">
                    <span className="tnum text-[11px] font-bold text-[#44403c]">{n}</span>
                    <div
                      className={`w-full rounded-t-md ${hot ? "bg-[#1a8f52]" : "bg-[#07305f]"}`}
                      style={{ height: `${Math.max(4, Math.round((n / maxBucket) * 100))}%`, opacity: n === 0 ? 0.25 : 1 }}
                    />
                    <span className="tnum text-[10.5px] text-[#78716c]">{NOTA_LABELS[i]}</span>
                  </div>
                );
              })}
            </div>
            <div className="tnum mt-3 flex flex-wrap justify-between gap-2 border-t border-dashed border-[#e7e5df] pt-2.5 text-xs text-[#44403c]">
              <span>
                Reprobados: <b className="text-[#c2410c]">{notaTotal - approved}</b>
              </span>
              <span>
                Nota media: <b className="text-[#07305f]">{meanNota.toFixed(1)}</b>
              </span>
              <span>
                Aprobación: <b className="text-[#1a8f52]">{approvalPct}%</b>
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[#e7e5df] bg-white p-5 shadow-xs">
            <h2 className="text-base font-semibold text-[#1c1917]">Dominio por eje</h2>
            <p className="mt-1 text-xs text-[#57534e]">% de logro por eje curricular (metadatos por pregunta).</p>
            {analysis.hasMetadata && analysis.axes.length > 0 ? (
              <div className="mt-4 flex flex-col gap-3">
                {analysis.axes.map((ax) => (
                  <div key={ax.axis} className="grid grid-cols-[minmax(90px,140px)_minmax(0,1fr)_42px] items-center gap-3">
                    <div className="truncate text-[12.5px] font-semibold text-[#1c1917]" title={ax.axis}>
                      {ax.axis}
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-[#efede8]">
                      <div className={`h-full rounded-full ${LVL[ax.level].bar}`} style={{ width: `${ax.pct}%` }} />
                    </div>
                    <div className={`tnum text-right text-[13px] font-bold ${LVL[ax.level].text}`}>{ax.pct}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg bg-[#faf9f6] px-4 py-6 text-center text-xs text-[#78716c]">
                Este ensayo no tiene ejes/habilidades cargados por pregunta.
                {quiz.id ? (
                  <Link href={`/dashboard/quizzes/${quiz.id}`} className="ml-1 font-semibold text-[#07305f] underline">
                    Configurar metadatos
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Alumnos" value={String(analysis.totalPapers)} />
        <MiniStat label="Logro promedio" value={`${avgPct}%`} />
        <MiniStat label="Aprobación" value={`${approvalPct}%`} tone={approvalPct >= 50 ? "good" : "bad"} />
        <MiniStat label="Nota media" value={meanNota.toFixed(1)} tone={meanNota >= 4 ? "good" : "bad"} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-xl border border-[#e7e5df] bg-white p-5 shadow-xs">
          <h3 className="text-base font-semibold text-[#1c1917]">Distribución de notas</h3>
          <p className="mt-1 text-xs text-[#57534e]">Cuántos alumnos en cada rango.</p>
          <div className="mt-4 grid grid-cols-6 items-end gap-2" style={{ height: "150px" }}>
            {notaBuckets.map((n, i) => (
              <div key={i} className="flex h-full flex-col items-center justify-end gap-1.5">
                <span className="tnum text-[11px] font-bold text-[#44403c]">{n}</span>
                <div
                  className={`w-full rounded-t-md ${i >= 3 ? "bg-[#1a8f52]" : "bg-[#07305f]"}`}
                  style={{ height: `${Math.max(4, Math.round((n / maxBucket) * 100))}%`, opacity: n === 0 ? 0.25 : 1 }}
                />
                <span className="tnum text-[10.5px] text-[#78716c]">{NOTA_LABELS[i]}</span>
              </div>
            ))}
          </div>
          <div className="tnum mt-3 flex flex-wrap justify-between gap-2 border-t border-dashed border-[#e7e5df] pt-2.5 text-xs text-[#44403c]">
            <span>
              Reprobados: <b className="text-[#c2410c]">{notaTotal - approved}</b>
            </span>
            <span>
              Aprobados: <b className="text-[#1a8f52]">{approved}</b>
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[#e7e5df] bg-white p-5 shadow-xs">
          <h3 className="text-base font-semibold text-[#1c1917]">Dominio por eje</h3>
          <p className="mt-1 text-xs text-[#57534e]">% de logro por eje curricular.</p>
          {analysis.hasMetadata && analysis.axes.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3">
              {analysis.axes.map((ax) => (
                <div key={ax.axis} className="grid grid-cols-[minmax(90px,150px)_minmax(0,1fr)_42px] items-center gap-3">
                  <div className="truncate text-[12.5px] font-semibold text-[#1c1917]" title={ax.axis}>
                    {ax.axis}
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-[#efede8]">
                    <div className={`h-full rounded-full ${LVL[ax.level].bar}`} style={{ width: `${ax.pct}%` }} />
                  </div>
                  <div className={`tnum text-right text-[13px] font-bold ${LVL[ax.level].text}`}>{ax.pct}%</div>
                </div>
              ))}
              {worstAxis ? (
                <div className="mt-1 rounded-lg bg-[#eef4ff] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#07305f]">
                  Eje más débil: <b>{worstAxis.axis}</b> ({worstAxis.pct}%).
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-[#faf9f6] px-4 py-6 text-center text-xs text-[#78716c]">
              Este ensayo no tiene ejes/habilidades cargados por pregunta.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-[#e7e5df] bg-white p-5 shadow-xs">
          <h3 className="text-base font-semibold text-[#1c1917]">Análisis por pregunta</h3>
          <p className="mt-1 text-xs text-[#57534e]">% de acierto y distribución de alternativas (la correcta en verde).</p>
          <ExpandableQuestionList items={analysis.items} />
        </div>

        <div className="rounded-xl border border-[#e7e5df] bg-white p-5 shadow-xs">
          <h3 className="text-base font-semibold text-[#1c1917]">Preguntas para reforzar</h3>
          <p className="mt-1 text-xs text-[#57534e]">Las {reteach.length} de menor logro.</p>
          <div className="mt-4 flex flex-col gap-2.5">
            {reteach.map((it) => (
              <div key={it.q} className="flex items-center gap-3 rounded-lg border border-[#efede8] bg-[#faf9f6] px-3 py-2.5">
                <div className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#fbeae1] text-xs font-extrabold text-[#c2410c]">
                  {it.q}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[#1c1917]">{it.skill || it.axis || `Pregunta ${it.q}`}</div>
                  <div className="truncate text-[11.5px] text-[#78716c]">
                    {it.topDistractor ? `${it.topDistractorPct}% marcó ${it.topDistractor}` : "sin distractor dominante"}
                  </div>
                </div>
                <div className={`tnum text-[15px] font-extrabold ${LVL[it.level].text}`}>{it.pctCorrect}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-[#1a8f52]" : tone === "bad" ? "text-[#c2410c]" : "text-[#1c1917]";
  return (
    <div className="rounded-xl border border-[#e7e5df] bg-white p-4 shadow-xs">
      <p className="text-xs font-semibold text-[#78716c]">{label}</p>
      <p className={`tnum mt-1.5 text-2xl font-bold tracking-tight ${color}`}>{value}</p>
    </div>
  );
}
