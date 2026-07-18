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
  // Indice de discriminacion (tecnica de Kelley, estandar en analisis de
  // items): %acierto del tercio superior de puntaje menos %acierto del
  // tercio inferior. null si no hay suficientes papers con score (<6) para
  // que el tercio superior/inferior tenga sentido estadistico.
  discrimination: number | null;
  // Se prende si el item probablemente tiene la clave mal cargada: un
  // distractor fue mas marcado que la "correcta", o el item discrimina al
  // reves (los de mejor desempeño general la fallan mas que los de peor).
  possibleKeyError: boolean;
};

export type AxisStat = { axis: string; pct: number; count: number; level: "good" | "warn" | "bad" };

export type AxisMasteryPaper = {
  answers: unknown;
  answerKey: string | null | undefined;
  numQuestions: number | null | undefined;
  metadata: MetaRow[];
};

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

// Bajo esta cantidad de papers con score valido, el tercio superior/inferior
// queda con muy pocos alumnos y el indice de discriminacion es puro ruido
// estadistico -- se omite (discrimination: null) en vez de mostrar un
// numero enganoso.
const MIN_PAPERS_FOR_DISCRIMINATION = 6;

export function computeItemAnalysis(
  papers: { answers: unknown; score?: number | null; total?: number | null }[],
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
  for (let q = 1; q <= nQ; q++) {
    counts[q] = { "-": 0 };
    for (const o of options) counts[q][o] = 0;
  }

  // Tecnica de Kelley: ordenar por ratio de acierto (score/total, no score
  // crudo, para no sesgar si algun paper tuviera un total distinto) y tomar
  // el tercio superior/inferior para medir que tan bien cada pregunta
  // separa a quienes dominan el contenido de quienes no.
  const withScore = papers
    .map((p, idx) => ({ idx, score: Number(p.score ?? NaN), total: Number(p.total ?? NaN) }))
    .filter((p) => Number.isFinite(p.score) && Number.isFinite(p.total) && p.total > 0)
    .sort((a, b) => b.score / b.total - a.score / a.total);
  const groupSize = Math.floor(withScore.length / 3);
  const canDiscriminate = withScore.length >= MIN_PAPERS_FOR_DISCRIMINATION && groupSize >= 2;
  const topGroup = new Set(canDiscriminate ? withScore.slice(0, groupSize).map((p) => p.idx) : []);
  const bottomGroup = new Set(canDiscriminate ? withScore.slice(-groupSize).map((p) => p.idx) : []);
  const topCorrect: Record<number, number> = {};
  const bottomCorrect: Record<number, number> = {};
  for (let q = 1; q <= nQ; q++) { topCorrect[q] = 0; bottomCorrect[q] = 0; }

  let totalPapers = 0;
  papers.forEach((p, pIdx) => {
    const arr = Array.isArray(p.answers) ? (p.answers as Array<{ q?: unknown; a?: unknown }>) : [];
    if (arr.length === 0) return;
    totalPapers++;
    const inTop = topGroup.has(pIdx);
    const inBottom = bottomGroup.has(pIdx);
    for (const item of arr) {
      const q = Number(item?.q);
      if (!Number.isInteger(q) || q < 1 || q > nQ) continue;
      let a = String(item?.a ?? "-").trim().toUpperCase();
      if (!options.includes(a)) a = "-";
      counts[q][a] = (counts[q][a] ?? 0) + 1;
      const correctLetter = key[q - 1];
      if (correctLetter && a === correctLetter) {
        if (inTop) topCorrect[q]++;
        if (inBottom) bottomCorrect[q]++;
      }
    }
  });

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

    const discrimination = canDiscriminate && correct
      ? Math.round(((topCorrect[q] / groupSize) - (bottomCorrect[q] / groupSize)) * 100) / 100
      : null;
    // Si hay suficientes papers para discriminacion, esa es la senal fuerte
    // -- un item con discriminacion negativa (los mejores alumnos la fallan
    // mas que los peores) es un red flag real, incluso si el % de acierto es
    // alto. "Distractor le gana a la correcta" por si solo NO alcanza (un
    // item dificil pero VALIDO, bien discriminado, puede tener esto sin
    // problema -- ver test sintetico) y solo se usa como respaldo cuando
    // todavia no hay papers suficientes para calcular discriminacion.
    const distractorBeatsCorrect = topDistractor !== null && topDistractorPct > pctCorrect;
    const possibleKeyError = Boolean(correct) && (discrimination !== null ? discrimination < 0 : distractorBeatsCorrect);

    const meta = metaByQ.get(q);
    items.push({
      q, correct, pctCorrect, counts: counts[q], n,
      topDistractor, topDistractorPct,
      axis: meta?.axis ?? null, skill: meta?.skill ?? null,
      level: levelOf(pctCorrect),
      discrimination, possibleKeyError,
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

export function computeAxisMastery(papers: AxisMasteryPaper[]): AxisStat[] {
  const axisMap: Record<string, { correct: number; total: number }> = {};

  for (const paper of papers) {
    const key = String(paper.answerKey ?? "").replace(/[^A-Za-z]/g, "").toUpperCase();
    const nQ = Math.max(0, Number(paper.numQuestions) || key.length || 0);
    if (!key || nQ <= 0) continue;

    const answerByQ = new Map<number, string>();
    const answers = Array.isArray(paper.answers) ? (paper.answers as Array<{ q?: unknown; a?: unknown }>) : [];
    for (const answer of answers) {
      const q = Number(answer?.q);
      if (!Number.isInteger(q) || q < 1 || q > nQ) continue;
      answerByQ.set(q, String(answer?.a ?? "-").trim().toUpperCase());
    }

    const metaByQ = new Map<number, string>();
    for (const meta of paper.metadata ?? []) {
      const axis = meta.axis_name?.trim();
      if (!axis) continue;
      metaByQ.set(Number(meta.question_number), axis);
    }

    for (let q = 1; q <= nQ; q++) {
      const axis = metaByQ.get(q);
      const correct = key[q - 1];
      if (!axis || !correct) continue;
      if (!axisMap[axis]) axisMap[axis] = { correct: 0, total: 0 };
      axisMap[axis].total += 1;
      if (answerByQ.get(q) === correct) axisMap[axis].correct += 1;
    }
  }

  return Object.entries(axisMap)
    .map(([axis, stat]) => {
      const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
      return { axis, pct, count: stat.total, level: levelOf(pct) };
    })
    .sort((a, b) => a.pct - b.pct || a.axis.localeCompare(b.axis));
}
