/**
 * Corrección IA de UNA pregunta de desarrollo (Fase 3,
 * docs/plan-correccion-ia-abiertas.md). Server-side SOLO (lee
 * GOOGLE_API_KEY de env var, nunca se llama desde el cliente). La IA
 * SUGIERE -- el profesor confirma/ajusta antes de que el puntaje cuente
 * para algo (ver open_answers.confirmed_points, nunca `puntaje` crudo).
 */
import "server-only";
import type { OpenQuestionSubtype } from "@/lib/quiz_constraints";

export interface AiGradeResult {
  transcripcion: string;
  puntaje: number;
  justificacion: string;
  confianza: "alta" | "media" | "baja";
  legible: boolean;
}

export interface AiGradeParams {
  imageBase64: string;
  mimeType: string;
  enunciado: string;
  rubric: string;
  maxPoints: number;
  subtipo: OpenQuestionSubtype;
}

// Instrucción de transcripción según el subtipo del ítem (confirmado contra
// la API real de DIA -- ver dia-bot/docs/FINDINGS.md §11.4 y
// docs/dia-instrumentos-monitoreo-2026.md): un par ordenado y un número
// necesitan formato de dato, no prosa; una respuesta simple es texto libre.
const SUBTYPE_GUIDANCE: Record<OpenQuestionSubtype, string> = {
  simple: "Es una respuesta de desarrollo (texto/procedimiento). Transcribe literalmente lo que escribió el alumno, tal cual, con sus errores si los tiene.",
  par_ordenado: "Es un PAR ORDENADO (x; y). Transcribe los dos números exactamente como los escribió el alumno, en formato \"(x; y)\".",
  entero_decimal: "Es un número (entero o decimal). Transcribe el número tal como lo escribió el alumno, sin agregar ni corregir nada.",
};

function buildPrompt(p: AiGradeParams): string {
  return `Eres un asistente de corrección para un profesor de un colegio en Chile.
Vas a evaluar la respuesta MANUSCRITA de un alumno a una pregunta de desarrollo, usando la
rúbrica dada. El profesor va a REVISAR tu sugerencia antes de que cuente para la nota -- tu
trabajo es sugerir con criterio y honestidad, no maximizar el puntaje.

ENUNCIADO: ${p.enunciado || "(no se cargó el enunciado — evalúa solo con la rúbrica)"}

TIPO DE RESPUESTA: ${SUBTYPE_GUIDANCE[p.subtipo]}

RÚBRICA (puntaje máximo ${p.maxPoints}):
${p.rubric || "(sin rúbrica cargada — usa criterio general de corrección matemática/lenguaje escolar)"}

Responde SOLO un JSON con esta forma exacta, sin texto fuera del JSON:
{
  "transcripcion": "<transcripción literal, ver TIPO DE RESPUESTA arriba>",
  "puntaje": <número entre 0 y ${p.maxPoints}>,
  "justificacion": "<1-2 frases explicando por qué ese puntaje según la rúbrica>",
  "confianza": "<alta | media | baja>",
  "legible": <true | false>
}
Si la letra es realmente ilegible, pon "legible": false, "puntaje": 0 (indicativo, no publicable)
y explica en "justificacion" qué no se pudo leer.`;
}

/** Llama a Gemini (REST directo, sin SDK) y devuelve la sugerencia parseada.
 *  Lanza si falta la API key, si la llamada falla, o si la respuesta no es
 *  JSON válido -- el llamador decide qué hacer con el error (ej. guardar
 *  legible=false, confianza=baja en open_answers en vez de perder el registro). */
export async function gradeOpenAnswer(params: AiGradeParams): Promise<AiGradeResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Falta GOOGLE_API_KEY en las variables de entorno del servidor.");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          { text: buildPrompt(params) },
          { inline_data: { mime_type: params.mimeType, data: params.imageBase64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Respuesta de Gemini sin contenido: ${JSON.stringify(data).slice(0, 500)}`);

  const parsed = JSON.parse(text) as Partial<AiGradeResult>;
  const confianza = parsed.confianza === "alta" || parsed.confianza === "media" || parsed.confianza === "baja" ? parsed.confianza : "baja";
  return {
    transcripcion: String(parsed.transcripcion ?? ""),
    puntaje: Math.max(0, Math.min(params.maxPoints, Number(parsed.puntaje) || 0)),
    justificacion: String(parsed.justificacion ?? ""),
    confianza,
    legible: parsed.legible !== false,
  };
}
