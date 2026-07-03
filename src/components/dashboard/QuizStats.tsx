import { computeItemAnalysis, type ItemStat } from "@/lib/item_analysis";
import { calculateGrade } from "@/lib/latam";

const LVL = {
  good: { text: "text-[#1a8f52]", bar: "bg-[#1a8f52]" },
  warn: { text: "text-[#c77700]", bar: "bg-[#c77700]" },
  bad: { text: "text-[#c2410c]", bar: "bg-[#c2410c]" },
} as const;

const NOTA_LABELS = ["1–2", "2–3", "3–4", "4–5", "5–6", "6–7"];

type PaperLite = { answers: unknown; score: number | null; total: number | null; grade: string | number | null };
type MetaLite = { question_number: number; axis_name: string | null; skill_name: string | null };
type QuizLite = { num_questions: number | null; options_per_question: number | null; answer_key: string | null };

export function QuizStats({ quiz, papers, metadata }: { quiz: QuizLite; papers: PaperLite[]; metadata: MetaLite[] }) {
  const analysis = computeItemAnalysis(papers, quiz.answer_key, quiz.num_questions ?? 0, quiz.options_per_question ?? 5, metadata);

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
      <div className="rounded-md border border-dashed border-[#cfd6df] bg-white p-8 text-center">
        <p className="text-sm font-semibold text-[#111827]">Sin lecturas para analizar</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#5b6472]">Cuando escanees hojas de este ensayo, aquí verás la distribución de notas, el análisis por pregunta y el dominio por eje.</p>
      </div>
    );
  }

  const approved = notaBuckets[3] + notaBuckets[4] + notaBuckets[5];
  const approvalPct = notaTotal ? Math.round((approved / notaTotal) * 100) : 0;
  const meanNota = notaTotal ? notaSum / notaTotal : 0;
  const maxBucket = Math.max(1, ...notaBuckets);
  const avgPct = analysis.items.length
    ? Math.round(analysis.items.filter((i) => i.correct).reduce((s, i) => s + i.pctCorrect, 0) / Math.max(1, analysis.items.filter((i) => i.correct).length))
    : 0;
  const reteach = analysis.items.filter((i) => i.correct).sort((a, b) => a.pctCorrect - b.pctCorrect).slice(0, 4);
  const worstAxis = analysis.axes.length ? analysis.axes[0] : null;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Alumnos" value={String(analysis.totalPapers)} />
        <MiniStat label="Logro promedio" value={`${avgPct}%`} />
        <MiniStat label="Aprobación" value={`${approvalPct}%`} tone={approvalPct >= 50 ? "good" : "bad"} />
        <MiniStat label="Nota media" value={meanNota.toFixed(1)} tone={meanNota >= 4 ? "good" : "bad"} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-[#111827]">Distribución de notas</h3>
          <p className="mt-1 text-xs text-[#5b6472]">Cuántos alumnos en cada rango.</p>
          <div className="mt-4 grid grid-cols-6 items-end gap-2" style={{ height: "150px" }}>
            {notaBuckets.map((n, i) => (
              <div key={i} className="flex h-full flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] font-bold text-[#4b5563]">{n}</span>
                <div className={`w-full rounded-t-md ${i >= 3 ? "bg-[#1a8f52]" : "bg-[#07305f]"}`} style={{ height: `${Math.max(4, Math.round((n / maxBucket) * 100))}%`, opacity: n === 0 ? 0.25 : 1 }} />
                <span className="text-[10.5px] text-[#6b7280]">{NOTA_LABELS[i]}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-dashed border-[#e6e8eb] pt-2.5 text-xs text-[#4b5563]">
            <span>Reprobados: <b className="text-[#c2410c]">{notaTotal - approved}</b></span>
            <span>Aprobados: <b className="text-[#1a8f52]">{approved}</b></span>
          </div>
        </div>

        <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-[#111827]">Dominio por eje</h3>
          <p className="mt-1 text-xs text-[#5b6472]">% de logro por eje curricular.</p>
          {analysis.hasMetadata && analysis.axes.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3">
              {analysis.axes.map((ax) => (
                <div key={ax.axis} className="grid grid-cols-[minmax(90px,150px)_minmax(0,1fr)_42px] items-center gap-3">
                  <div className="truncate text-[12.5px] font-semibold text-[#111827]" title={ax.axis}>{ax.axis}</div>
                  <div className="h-4 overflow-hidden rounded-full bg-[#eef0f3]"><div className={`h-full rounded-full ${LVL[ax.level].bar}`} style={{ width: `${ax.pct}%` }} /></div>
                  <div className={`text-right text-[13px] font-bold ${LVL[ax.level].text}`}>{ax.pct}%</div>
                </div>
              ))}
              {worstAxis ? <div className="mt-1 rounded-lg bg-[#eef4ff] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#07305f]">Eje más débil: <b>{worstAxis.axis}</b> ({worstAxis.pct}%).</div> : null}
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-[#f8fafc] px-4 py-6 text-center text-xs text-[#6b7280]">Este ensayo no tiene ejes/habilidades cargados por pregunta.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-[#111827]">Análisis por pregunta</h3>
          <p className="mt-1 text-xs text-[#5b6472]">% de acierto y distribución de alternativas (la correcta en verde).</p>
          <div className="mt-3 max-h-[480px] overflow-y-auto pr-1">
            {analysis.items.map((it) => (<ItemRow key={it.q} it={it} />))}
          </div>
        </div>

        <div className="rounded-md border border-[#e6e8eb] bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-[#111827]">Preguntas para reforzar</h3>
          <p className="mt-1 text-xs text-[#5b6472]">Las {reteach.length} de menor logro.</p>
          <div className="mt-4 flex flex-col gap-2.5">
            {reteach.map((it) => (
              <div key={it.q} className="flex items-center gap-3 rounded-lg border border-[#e6e8eb] bg-[#fbfcfd] px-3 py-2.5">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#fbeae1] text-xs font-extrabold text-[#c2410c]">{it.q}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[#111827]">{it.skill || it.axis || `Pregunta ${it.q}`}</div>
                  <div className="truncate text-[11.5px] text-[#6b7280]">{it.topDistractor ? `${it.topDistractorPct}% marcó ${it.topDistractor}` : "sin distractor dominante"}</div>
                </div>
                <div className={`text-[15px] font-extrabold ${LVL[it.level].text}`}>{it.pctCorrect}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-[#1a8f52]" : tone === "bad" ? "text-[#c2410c]" : "text-[#111827]";
  return (
    <div className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-[#6b7280]">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${color}`}>{value}</p>
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
            return <div key={o} className={`flex-1 rounded-t-[3px] ${o === it.correct ? "bg-[#1a8f52]" : "bg-[#e6e8eb]"}`} style={{ height: `${Math.max(6, h)}%` }} title={`${o}: ${it.counts[o] ?? 0}`} />;
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
