/**
 * TuLector LATAM - Motor de evaluaciones estandarizadas
 * Soporta: SIMCE/DIA (CL), Aprender (AR), PLANEA (MX), Saber/ICFES (CO)
 */

import { calculateGrade, LATAM_COUNTRIES, CountryConfig } from "./latam";

// ─── Tipos ────────────────────────────────────────────────────
export interface EvaluationSystem {
  code: string;
  countryCode: string;
  name: string;
  description: string;
  gradeLevels: string[];
  subjects: string[];
  scoreMin: number;
  scoreMax: number;
}

export interface CurriculumAxis {
  axisCode: string;
  axisName: string;
  skills: string[];
}

export interface PerformanceLevel {
  levelNumber: number;
  levelName: string;
  minScore: number;
  maxScore: number;
  description: string;
  colorHex: string;
}

export interface SubjectTaxonomy {
  subject: string;
  axes: CurriculumAxis[];
}

export interface CountryEvaluationData {
  country: CountryConfig;
  systems: EvaluationSystem[];
  taxonomies: Record<string, SubjectTaxonomy[]>;
  performanceLevels: Record<string, PerformanceLevel[]>;
}

// ─── Sistemas de evaluacion oficiales ─────────────────────────
export const EVALUATION_SYSTEMS: EvaluationSystem[] = [
  {
    code: "SIMCE", countryCode: "CL", name: "SIMCE",
    description: "Sistema de Medicion de la Calidad de la Educacion",
    gradeLevels: ["4° Basico", "8° Basico", "II Medio"],
    subjects: ["Lenguaje", "Matematicas", "Ciencias Naturales", "Historia"],
    scoreMin: 100, scoreMax: 400,
  },
  {
    code: "DIA", countryCode: "CL", name: "DIA",
    description: "Diagnostico Integral de Aprendizajes - Agencia de Calidad",
    gradeLevels: ["1° Basico","2° Basico","3° Basico","4° Basico","5° Basico","6° Basico","7° Basico","8° Basico","I Medio","II Medio"],
    subjects: ["Lectura", "Matematicas"],
    scoreMin: 0, scoreMax: 100,
  },
  {
    code: "Aprender", countryCode: "AR", name: "Aprender",
    description: "Evaluacion Nacional Aprender - Argentina",
    gradeLevels: ["6° Grado Primaria", "5°/6° Año Secundaria"],
    subjects: ["Lengua", "Matematica", "Ciencias Naturales", "Ciencias Sociales"],
    scoreMin: 0, scoreMax: 100,
  },
  {
    code: "PLANEA", countryCode: "MX", name: "PLANEA",
    description: "Plan Nacional para la Evaluacion de los Aprendizajes - Mexico",
    gradeLevels: ["3° Primaria", "6° Primaria", "3° Secundaria", "Media Superior"],
    subjects: ["Lenguaje y Comunicacion", "Matematicas"],
    scoreMin: 200, scoreMax: 800,
  },
  {
    code: "Saber", countryCode: "CO", name: "Saber",
    description: "Pruebas Saber ICFES - Colombia",
    gradeLevels: ["3°", "5°", "9°", "11°"],
    subjects: ["Lectura Critica", "Matematicas", "Ciencias Naturales", "Sociales y Ciudadanas", "Ingles"],
    scoreMin: 100, scoreMax: 500,
  },
];

// ─── Taxonomias curriculares oficiales ─────────────────────────
export const CURRICULUM_TAXONOMIES: Record<string, Record<string, SubjectTaxonomy[]>> = {
  CL: {
    SIMCE: [
      {
        subject: "Lenguaje",
        axes: [
          { axisCode: "LEC", axisName: "Lectura", skills: ["Localizar", "Interpretar y Relacionar", "Reflexionar"] },
        ],
      },
      {
        subject: "Matematicas",
        axes: [
          { axisCode: "NUM", axisName: "Numeros y Operaciones", skills: ["Conocer", "Aplicar", "Razonar"] },
          { axisCode: "GEO", axisName: "Geometria", skills: ["Conocer", "Aplicar", "Razonar"] },
          { axisCode: "DAT", axisName: "Datos y Probabilidades", skills: ["Conocer", "Aplicar", "Razonar"] },
        ],
      },
      {
        subject: "Ciencias Naturales",
        axes: [
          { axisCode: "BIO", axisName: "Biologia", skills: ["Conocimiento Cientifico", "Pensamiento Cientifico"] },
          { axisCode: "FIS", axisName: "Fisica", skills: ["Conocimiento Cientifico", "Pensamiento Cientifico"] },
        ],
      },
    ],
    DIA: [
      {
        subject: "Lectura",
        axes: [
          { axisCode: "LEC", axisName: "Comprension Lectora", skills: ["Localizar", "Interpretar", "Reflexionar"] },
        ],
      },
      {
        subject: "Matematicas",
        axes: [
          { axisCode: "NUM", axisName: "Numeros", skills: ["Conocer", "Aplicar", "Razonar"] },
          { axisCode: "GEO", axisName: "Geometria", skills: ["Conocer", "Aplicar", "Razonar"] },
          { axisCode: "PAT", axisName: "Patrones y Algebra", skills: ["Conocer", "Aplicar", "Razonar"] },
        ],
      },
    ],
  },

  MX: {
    PLANEA: [
      {
        subject: "Lenguaje y Comunicacion",
        axes: [
          { axisCode: "COMP", axisName: "Comprension Lectora", skills: ["Extraccion de Informacion", "Interpretacion", "Reflexion Semantica", "Reflexion Sintactica"] },
        ],
      },
      {
        subject: "Matematicas",
        axes: [
          { axisCode: "NUM", axisName: "Sentido Numerico", skills: ["Comprension Conceptual", "Aplicacion de Algoritmos"] },
          { axisCode: "GEO", axisName: "Forma, Espacio y Medida", skills: ["Comprension Conceptual", "Aplicacion de Algoritmos"] },
        ],
      },
    ],
  },

  CO: {
    Saber: [
      {
        subject: "Lectura Critica",
        axes: [
          { axisCode: "TXT", axisName: "Textos", skills: ["Identificar", "Comprender", "Analizar"] },
        ],
      },
      {
        subject: "Matematicas",
        axes: [
          { axisCode: "NUM", axisName: "Numerico-Variacional", skills: ["Interpretacion", "Formulacion"] },
          { axisCode: "GEO", axisName: "Geometrico-Metrico", skills: ["Interpretacion", "Formulacion"] },
          { axisCode: "ALE", axisName: "Aleatorio", skills: ["Interpretacion", "Formulacion"] },
        ],
      },
    ],
  },
};

// ─── Niveles de desempeño oficiales ────────────────────────────
export const PERFORMANCE_LEVELS: Record<string, PerformanceLevel[]> = {
  "CL_SIMCE": [
    { levelNumber: 1, levelName: "Insuficiente", minScore: 100, maxScore: 240, description: "No alcanza los aprendizajes esperados", colorHex: "#EF4444" },
    { levelNumber: 2, levelName: "Elemental", minScore: 241, maxScore: 280, description: "Parcialmente alcanza los aprendizajes", colorHex: "#F59E0B" },
    { levelNumber: 3, levelName: "Adecuado", minScore: 281, maxScore: 400, description: "Alcanza los aprendizajes esperados", colorHex: "#22C55E" },
  ],
  "CL_DIA": [
    { levelNumber: 1, levelName: "Emergente", minScore: 0, maxScore: 49, description: "Requiere apoyo intensivo", colorHex: "#EF4444" },
    { levelNumber: 2, levelName: "En Desarrollo", minScore: 50, maxScore: 74, description: "Requiere apoyo especifico", colorHex: "#F59E0B" },
    { levelNumber: 3, levelName: "Consolidado", minScore: 75, maxScore: 100, description: "Alcanza los aprendizajes", colorHex: "#22C55E" },
  ],
  "MX_PLANEA": [
    { levelNumber: 1, levelName: "Nivel I", minScore: 200, maxScore: 415, description: "Dominio insuficiente", colorHex: "#EF4444" },
    { levelNumber: 2, levelName: "Nivel II", minScore: 416, maxScore: 500, description: "Dominio basico", colorHex: "#F59E0B" },
    { levelNumber: 3, levelName: "Nivel III", minScore: 501, maxScore: 620, description: "Dominio satisfactorio", colorHex: "#3B82F6" },
    { levelNumber: 4, levelName: "Nivel IV", minScore: 621, maxScore: 800, description: "Dominio sobresaliente", colorHex: "#22C55E" },
  ],
  "CO_Saber": [
    { levelNumber: 1, levelName: "Insuficiente", minScore: 100, maxScore: 240, description: "No supera preguntas de menor complejidad", colorHex: "#EF4444" },
    { levelNumber: 2, levelName: "Minimo", minScore: 241, maxScore: 315, description: "Supera preguntas de menor complejidad", colorHex: "#F59E0B" },
    { levelNumber: 3, levelName: "Satisfactorio", minScore: 316, maxScore: 395, description: "Muestra desempeño adecuado", colorHex: "#3B82F6" },
    { levelNumber: 4, levelName: "Avanzado", minScore: 396, maxScore: 500, description: "Muestra desempeño sobresaliente", colorHex: "#22C55E" },
  ],
};

// ─── Motor de evaluacion ──────────────────────────────────────
export function getEvaluationSystem(countryCode: string, systemCode?: string): EvaluationSystem | undefined {
  const systems = EVALUATION_SYSTEMS.filter((s) => s.countryCode === countryCode);
  if (!systemCode) return systems[0];
  return systems.find((s) => s.code === systemCode);
}

export function getTaxonomy(countryCode: string, systemCode: string, subject: string): SubjectTaxonomy | undefined {
  const country = CURRICULUM_TAXONOMIES[countryCode];
  if (!country) return undefined;
  const system = country[systemCode];
  if (!system) return undefined;
  return system.find((t) => t.subject === subject);
}

export function getPerformanceLevel(score: number, countryCode: string, systemCode: string): PerformanceLevel | undefined {
  const key = `${countryCode}_${systemCode}`;
  const levels = PERFORMANCE_LEVELS[key] || PERFORMANCE_LEVELS[`${countryCode}_SIMCE`];
  if (!levels) return undefined;
  return levels.find((l) => score >= l.minScore && score <= l.maxScore);
}

/** Escalar puntaje entre sistemas de evaluacion */
export function scaleScore(rawScore: number, total: number, targetSystem: EvaluationSystem): number {
  if (total <= 0) return targetSystem.scoreMin;
  const pct = rawScore / total;
  return Math.round(targetSystem.scoreMin + pct * (targetSystem.scoreMax - targetSystem.scoreMin));
}

/** Item analysis agrupado por eje curricular */
export function axisAnalysis(
  papers: { answers: string[] }[],
  answerKey: string[],
  questionTags: { axisCode: string; axisName: string; skill: string }[],
) {
  const axisMap: Record<string, { name: string; correct: number; total: number; skills: Record<string, { correct: number; total: number }> }> = {};

  questionTags.forEach((tag, qIdx) => {
    if (!axisMap[tag.axisCode]) {
      axisMap[tag.axisCode] = { name: tag.axisName, correct: 0, total: 0, skills: {} };
    }
    if (!axisMap[tag.axisCode].skills[tag.skill]) {
      axisMap[tag.axisCode].skills[tag.skill] = { correct: 0, total: 0 };
    }

    const key = answerKey[qIdx];
    papers.forEach((paper) => {
      axisMap[tag.axisCode].total++;
      axisMap[tag.axisCode].skills[tag.skill].total++;
      if (paper.answers[qIdx] === key) {
        axisMap[tag.axisCode].correct++;
        axisMap[tag.axisCode].skills[tag.skill].correct++;
      }
    });
  });

  return Object.entries(axisMap).map(([code, data]) => ({
    axisCode: code,
    axisName: data.name,
    percentage: Math.round((data.correct / data.total) * 100),
    correct: data.correct,
    total: data.total,
    skills: Object.entries(data.skills).map(([skill, sdata]) => ({
      name: skill,
      percentage: Math.round((sdata.correct / sdata.total) * 100),
      correct: sdata.correct,
      total: sdata.total,
    })),
  }));
}

/** Reporte de nivel de logro para grupo */
export function groupLevelReport(
  scores: number[],
  countryCode: string,
  systemCode: string,
): { distribution: Record<string, number>; predominant: string } {
  const levels = PERFORMANCE_LEVELS[`${countryCode}_${systemCode}`] || PERFORMANCE_LEVELS["CL_SIMCE"];
  const dist: Record<string, number> = {};

  levels.forEach((l) => (dist[l.levelName] = 0));

  scores.forEach((score) => {
    const level = levels.find((l) => score >= l.minScore && score <= l.maxScore);
    if (level) dist[level.levelName]++;
    else dist["Desconocido"] = (dist["Desconocido"] || 0) + 1;
  });

  const predominant = Object.entries(dist).sort(([, a], [, b]) => (b as number) - (a as number))[0][0];

  return { distribution: dist, predominant };
}

/** Generar reporte CSV formato gobierno */
export function generateGovernmentCSV(
  students: { id: string; name: string; score: number; total: number; grade: number; level: PerformanceLevel; axisScores?: Record<string, number> }[],
  countryCode: string,
  systemCode: string,
  metadata: { subject?: string; grade?: string; date?: string } = {},
): string {
  const system = getEvaluationSystem(countryCode, systemCode);
  if (!system) throw new Error(`Sistema no encontrado: ${countryCode}_${systemCode}`);

  let csv = "";
  const delim = countryCode === "CL" ? ";" : ",";
  const date = metadata.date || new Date().toISOString().slice(0, 10);

  switch (countryCode) {
    case "CL":
      csv = `RUN${delim}Nombre${delim}Curso${delim}Puntaje${delim}Nivel_Logro${delim}Eje${delim}Habilidad${delim}Fecha\n`;
      students.forEach((s) => {
        csv += `${s.id}${delim}${s.name}${delim}${metadata.grade || ""}${delim}${s.score}${delim}${s.level.levelName}${delim}${metadata.subject || ""}${delim}${delim}${date}\n`;
      });
      break;

    case "MX":
      csv = `CURP${delim}Alumno${delim}Puntaje_Global${delim}Nivel${delim}Unidad${delim}Proceso${delim}Fecha\n`;
      students.forEach((s) => {
        csv += `${s.id}${delim}${s.name}${delim}${s.score}${delim}${s.level.levelName}${delim}${metadata.subject || ""}${delim}${delim}${date}\n`;
      });
      break;

    case "CO":
      csv = `ID${delim}Nombre${delim}Puntaje_Global${delim}Percentil${delim}Nivel${delim}Competencia${delim}Fecha\n`;
      students.forEach((s) => {
        csv += `${s.id}${delim}${s.name}${delim}${s.score}${delim}${delim}${s.level.levelName}${delim}${metadata.subject || ""}${delim}${date}\n`;
      });
      break;

    case "AR":
      csv = `DNI${delim}Nombre${delim}Curso${delim}Puntaje${delim}Porcentaje${delim}Nivel${delim}Area${delim}Fecha\n`;
      students.forEach((s) => {
        const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
        csv += `${s.id}${delim}${s.name}${delim}${metadata.grade || ""}${delim}${s.score}${delim}${pct}%${delim}${s.level.levelName}${delim}${metadata.subject || ""}${delim}${date}\n`;
      });
      break;
  }

  return csv;
}

/** Simular puntaje en escala del sistema estandarizado */
export function simulateStandardizedScore(rawScore: number, total: number, countryCode: string, systemCode: string): {
  scaledScore: number;
  level: PerformanceLevel;
  passing: boolean;
} {
  const system = getEvaluationSystem(countryCode, systemCode);
  if (!system) throw new Error(`Sistema no encontrado`);

  const scaled = scaleScore(rawScore, total, system);
  const level = getPerformanceLevel(scaled, countryCode, systemCode) || PERFORMANCE_LEVELS["CL_SIMCE"][0];
  const passing = level.levelNumber >= 3; // Adecuado o superior = aprobado

  return { scaledScore: scaled, level, passing };
}
