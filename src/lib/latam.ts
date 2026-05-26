/**
 * TuLector LATAM - Utilidades de calculo de notas y validaciones
 * Soporta: Chile (1-7), Argentina (1-10), Mexico (0-100), Colombia (0-100), etc.
 */

export interface CountryConfig {
  code: string;
  name: string;
  gradeScale: { min: number; max: number };
  passingGrade: number;
  exigencia: number;
  idType: string;
  idFormat?: RegExp;
}

export const LATAM_COUNTRIES: Record<string, CountryConfig> = {
  CL: {
    code: "CL", name: "Chile",
    gradeScale: { min: 1.0, max: 7.0 },
    passingGrade: 4.0,
    exigencia: 0.60,
    idType: "rut",
    idFormat: /^[0-9]{7,8}-[0-9kK]$/,
  },
  AR: {
    code: "AR", name: "Argentina",
    gradeScale: { min: 1, max: 10 },
    passingGrade: 6,
    exigencia: 0.60,
    idType: "dni",
    idFormat: /^[0-9]{7,8}$/,
  },
  MX: {
    code: "MX", name: "Mexico",
    gradeScale: { min: 0, max: 100 },
    passingGrade: 60,
    exigencia: 0.60,
    idType: "curp",
    idFormat: /^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9]{2}$/,
  },
  CO: {
    code: "CO", name: "Colombia",
    gradeScale: { min: 0, max: 100 },
    passingGrade: 60,
    exigencia: 0.60,
    idType: "documento",
  },
  PE: {
    code: "PE", name: "Peru",
    gradeScale: { min: 0, max: 20 },
    passingGrade: 11,
    exigencia: 0.55,
    idType: "dni",
    idFormat: /^[0-9]{8}$/,
  },
  EC: {
    code: "EC", name: "Ecuador",
    gradeScale: { min: 0, max: 10 },
    passingGrade: 7,
    exigencia: 0.70,
    idType: "cedula",
  },
};

/** Calcula la nota segun la escala del pais (formula chilena con exigencia) */
export function calculateGrade(
  rawScore: number,
  totalQuestions: number,
  countryCode: string = "CL",
  customConfig?: Partial<CountryConfig>
): { grade: number; passing: boolean; percentage: number; label: string } {
  const config = LATAM_COUNTRIES[countryCode] || LATAM_COUNTRIES.CL;
  const gradeMin = customConfig?.gradeScale?.min ?? config.gradeScale.min;
  const gradeMax = customConfig?.gradeScale?.max ?? config.gradeScale.max;
  const passingGrade = customConfig?.passingGrade ?? config.passingGrade;
  const exigencia = customConfig?.exigencia ?? config.exigencia;

  if (totalQuestions <= 0) return { grade: gradeMin, passing: false, percentage: 0, label: "Sin preguntas" };

  const pct = rawScore / totalQuestions;
  let grade: number;

  if (pct >= exigencia) {
    grade = ((pct - exigencia) / (1.0 - exigencia)) * (gradeMax - passingGrade) + passingGrade;
  } else {
    grade = (pct / exigencia) * (passingGrade - gradeMin) + gradeMin;
  }

  grade = Math.max(gradeMin, Math.min(gradeMax, grade));
  const rounded = Math.round(grade * 10) / 10;
  const passing = pct >= exigencia;

  let label: string;
  if (countryCode === "CL") {
    if (rounded >= 6.5) label = "Muy Bueno";
    else if (rounded >= 5.5) label = "Bueno";
    else if (rounded >= 4.0) label = "Suficiente";
    else if (rounded >= 3.0) label = "Insuficiente";
    else label = "Deficiente";
  } else {
    label = passing ? "Aprobado" : "Reprobado";
  }

  return { grade: rounded, passing, percentage: Math.round(pct * 1000) / 10, label };
}

/** Valida formato de ID segun pais */
export function validateStudentId(id: string, countryCode: string): boolean {
  const config = LATAM_COUNTRIES[countryCode];
  if (!config) return true;

  if (config.idFormat) return config.idFormat.test(id);

  switch (countryCode) {
    case "CL":
      return validateRUT(id);
    default:
      return id.length >= 4;
  }
}

/** Validacion de RUT chileno con digito verificador */
function validateRUT(rut: string): boolean {
  const cleaned = rut.replace(/[^0-9kK]/g, "");
  if (cleaned.length < 2) return false;

  const dv = cleaned.slice(-1).toLowerCase();
  const numbers = cleaned.slice(0, -1).split("").map(Number);

  let sum = 0;
  let multiplier = 2;
  for (let i = numbers.length - 1; i >= 0; i--) {
    sum += numbers[i] * multiplier;
    multiplier = multiplier < 7 ? multiplier + 1 : 2;
  }

  const expected = 11 - (sum % 11);
  const expectedDV = expected === 11 ? "0" : expected === 10 ? "k" : String(expected);
  return dv === expectedDV;
}

/** Genera nota conceptual desde nota numerica */
export function getGradeConcept(grade: number, countryCode: string): string {
  switch (countryCode) {
    case "CL":
      if (grade >= 6.5) return "Muy Bueno (MB)";
      if (grade >= 5.5) return "Bueno (B)";
      if (grade >= 4.0) return "Suficiente (S)";
      if (grade >= 3.0) return "Insuficiente (I)";
      return "Deficiente (D)";
    case "EC":
      if (grade >= 9) return "Domina los aprendizajes (DA)";
      if (grade >= 7) return "Alcanza los aprendizajes (AA)";
      if (grade >= 5) return "Proximo a alcanzar (PA)";
      return "No alcanza los aprendizajes (NA)";
    case "PE":
      if (grade >= 18) return "Logro destacado (AD)";
      if (grade >= 14) return "Logro esperado (A)";
      if (grade >= 11) return "En proceso (B)";
      return "En inicio (C)";
    default:
      return grade >= 60 ? "Aprobado" : "Reprobado";
  }
}

/** Estadisticas de item analysis por pregunta */
export function itemAnalysis(
  papers: { answers: string[]; scores: number[][] }[],
  answerKey: string[],
  options: string[] = ["A", "B", "C", "D", "E"]
) {
  return answerKey.map((correctAns, qIdx) => {
    const distribution: Record<string, number> = {};
    options.forEach((o) => (distribution[o] = 0));
    distribution["-"] = 0;

    let correct = 0;
    papers.forEach((paper) => {
      const ans = paper.answers[qIdx] || "-";
      distribution[ans] = (distribution[ans] || 0) + 1;
      if (ans === correctAns) correct++;
    });

    const total = papers.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const difficulty = pct >= 80 ? "easy" : pct >= 50 ? "medium" : "hard";

    return {
      question: qIdx + 1,
      correctAnswer: correctAns,
      correctCount: correct,
      totalPapers: total,
      percentage: pct,
      difficulty,
      distribution,
      mostCommonWrong:
        Object.entries(distribution)
          .filter(([k]) => k !== correctAns && k !== "-")
          .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || null,
    };
  });
}

/** Estadisticas de rendimiento por grupo/curso */
export function groupStats(papers: { score: number; total: number; passing: boolean }[]) {
  if (papers.length === 0) return null;

  const scores = papers.map((p) => p.score);
  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const passing = papers.filter((p) => p.passing).length;

  return {
    count: n,
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
    min: sorted[0],
    max: sorted[n - 1],
    passingCount: passing,
    passingRate: Math.round((passing / n) * 100),
    distribution: {
      high: scores.filter((s) => s >= mean + stdDev).length,
      medium: scores.filter((s) => s > mean - stdDev && s < mean + stdDev).length,
      low: scores.filter((s) => s <= mean - stdDev).length,
    },
  };
}

/** Genera CSV de exportacion compatible con sistemas de gobierno LATAM */
export function generateExportCSV(
  papers: { studentId: string; studentName: string; score: number; total: number }[],
  format: "agencia_calidad" | "icfes" | "planea" | "generic" = "generic",
  metadata: Record<string, string> = {}
): string {
  const configs = {
    agencia_calidad: {
      headers: ["RUN", "Nombre", "Puntaje", "Nota", "Asignatura", "Eje", "Habilidad", "Fecha"],
      delimiter: ";",
    },
    icfes: { headers: ["ID", "Estudiante", "Puntaje", "Calificacion", "Competencia", "DBA"], delimiter: "," },
    planea: { headers: ["CURP", "Alumno", "Aciertos", "Calificacion", "Eje", "Habilidad"], delimiter: "," },
    generic: { headers: ["ID", "Nombre", "Puntaje", "Nota", "Total", "Porcentaje"], delimiter: "," },
  };

  const config = configs[format];
  let csv = config.headers.join(config.delimiter) + "\n";

  papers.forEach((p) => {
    const pct = p.total > 0 ? Math.round((p.score / p.total) * 100) : 0;
    const values =
      format === "agencia_calidad"
        ? [p.studentId, p.studentName, p.score.toString(), pct.toString(), metadata.subject || "", metadata.axis || "", metadata.skill || "", new Date().toISOString().slice(0, 10)]
        : format === "generic"
        ? [p.studentId, p.studentName, p.score.toString(), pct.toString(), p.total.toString(), pct + "%"]
        : [p.studentId, p.studentName, p.score.toString(), pct.toString(), metadata.axis || "", metadata.skill || ""];

    csv += values.join(config.delimiter) + "\n";
  });

  return csv;
}
