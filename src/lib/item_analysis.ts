// Análisis por ítem (OMR real): recorre papers.answers contra la clave del ensayo.
// papers.answers tiene forma [{ q: number (1-based), a: "A".."E" | "-" }].
// answer_key es un string de letras (se limpia con replace(/[^A-Za-z]/g, "")).

export type ItemStat = {
  q: number; // 1-based
  correct: string; // letra correcta ("" si la clave no la define)
  pctCorrect: number; // 0-100
  counts: Record<string, number>; // letra -> nº de alumnos, incluye "-" (en blanco)
  n: number; // alumnos que respondieron esta pregunta
  topDistractor: string | null; // distractor más marcado (distinto de la correcta)
  topDistractorPct: number; // % que marcó ese distractor
  axis: string | null;
  skill: string | null;
  level: "good" | "warn" | "bad";
};

export type AxisStat = { axis: string; pct: number; count: number; level: "good" | "warn" | "bad" };

export type ItemAnalysis = {
  items: ItemStat[];
  axes: AxisStat[];
  totalPapers: number;
  hasMetadata: boolean;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function levelOf(pct: number): "good" | "warn" | "bad" {
  if (pct >= 80) return "good";
  if (pct >= 50) return "warn";
  return "bad";
}

type MetaRow = { question_number: number; axis_name: string | null; skill_name: string | null };

export function computeItemAnalysis(
  papers: { answers: unknown }[],
  answerKey: string | null | undefined,
  numQuestions: number,
  numOptions: number | null | undefined,
  metadata: MetaRow[] = [],
): ItemAnalysis {
  const key = String(answerKey ?? "").replace(/[^A-Za-z]/g, "").toUpperCase();
  const nOpts = Math.max(2, Math.min(6, Number(numOptions) || 5));
  const options = LETTERS.slice(0, nOpts);
  const nQ = Math.max(0, Number(numQuestions) || key.length || 0);

  const metaByQ = new Map<number, { axis: string | null; skill: string | null }>();
  for (const m of metadata ?? []) {
    metaByQ.set(Number(m.question_number), { axis: m.axis_name ?? null, skill: m.skill_name ?? null });
  }

  const counts: Record<number, Record<string, number>> = {};
  const answered: Record<number, number> = {};
  for (let q = 1; q <= nQ; q++) {
    counts[q] = { "-": 0 };
    for (const o of options) counts[q][o] = 0;
    answered[q] = 0;
  }

  let totalPapers = 0;
  for (const p of papers) {
    const arr = Array.isArray(p.answers) ? (p.answers as Array<{ q?: unknown; a?: unknown }>) : [];
    if (arr.length === 0) continue;
    totalPapers++;
    for (const item of arr) {
      const q = Number(item?.q);
      if (!Number.isInteger(q) || q < 1 || q > nQ) continue;
      let a = String(item?.a ?? "-").trim().toUpperCase();
      if (!options.includes(a)) a = "-";
      counts[q][a] = (counts[q][a] ?? 0) + 1;
      if (a !== "-") answered[q]++;
    }
  }

  const items: ItemStat[] = [];
  for (let q = 1; q <= nQ; q++) {
    const correct = key[q - 1] ?? "";
    // Denominador: alumnos que entregaron la hoja (respondieran o no), para no premiar los blancos.
    const n = totalPapers;
    const nCorrect = correct ? counts[q][correct] ?? 0 : 0;
    const pctCorrect = n > 0 ? Math.round((nCorrect / n) * 100) : 0;

    let topDistractor: string | null = null;
    let topDistractorCount = -1;
    for (const o of options) {
      if (o === correct) continue;
      const c = counts[q][o] ?? 0;
      if (c > topDistractorCount) { topDistractorCount = c; topDistractor = o; }
    }
    const topDistractorPct = n > 0 && topDistractorCount > 0 ? Math.round((topDistractorCount / n) * 100) : 0;
    if (topDistractorCount <= 0) topDistractor = null;

    const meta = metaByQ.get(q);
    items.push({
      q, correct, pctCorrect, counts: counts[q], n,
      topDistractor, topDistractorPct,
      axis: meta?.axis ?? null, skill: meta?.skill ?? null,
      level: levelOf(pctCorrect),
    });
  }

  const axisMap: Record<string, { sum: number; count: number }> = {};
  for (const it of items) {
    if (!it.axis) continue;
    if (!axisMap[it.axis]) axisMap[it.axis] = { sum: 0, count: 0 };
    axisMap[it.axis].sum += it.pctCorrect;
    axisMap[it.axis].count += 1;
  }
  const axes: AxisStat[] = Object.entries(axisMap)
    .map(([axis, s]) => {
      const pct = Math.round(s.sum / s.count);
      return { axis, pct, count: s.count, level: levelOf(pct) };
    })
    .sort((a, b) => a.pct - b.pct);

  return { items, axes, totalPapers, hasMetadata: metaByQ.size > 0 };
}
