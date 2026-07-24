/**
 * Prueba suelta de la llamada real a la IA (Fase 3, docs/plan-correccion-ia-
 * abiertas.md). NO es parte de la suite de test:omr ni corre en CI -- solo
 * verifica que la conexión con Gemini funciona (auth, formato de request,
 * parseo de la respuesta) usando una imagen SINTÉTICA (texto dibujado, no
 * manuscrito real de un alumno) para no depender de tener fotos a mano.
 *
 * Requiere GOOGLE_API_KEY en .env.local (nunca pegar la clave en el chat).
 * Correr: npx tsx scripts/test_ai_grade_open.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { createCanvas } from "canvas";

function loadEnvLocal() {
  const path = ".env.local";
  if (!existsSync(path)) {
    console.error("Falta tulector/.env.local");
    process.exit(1);
  }
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

if (!process.env.GOOGLE_API_KEY) {
  console.error("Falta GOOGLE_API_KEY en .env.local (agrégala y vuelve a correr).");
  process.exit(1);
}

async function main() {
  const { gradeOpenAnswer } = await import("../src/lib/ai_grade_open");

  // Imagen sintética: simula un recuadro de reverso con una respuesta corta
  // escrita a mano (fuente cursiva como aproximacion -- NO es manuscrito real,
  // solo prueba el pipeline tecnico: request -> Gemini -> parseo).
  const canvas = createCanvas(500, 200);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 500, 200);
  ctx.fillStyle = "#1a1a6e";
  ctx.font = "italic 48px cursive, sans-serif";
  ctx.fillText("(3 ; 5)", 60, 110);
  const base64 = canvas.toDataURL("image/png").split(",")[1];

  console.log("Enviando a Gemini...");
  const result = await gradeOpenAnswer({
    imageBase64: base64,
    mimeType: "image/png",
    enunciado: "Escribe el par ordenado que representa el punto graficado.",
    rubric: "2 pts: par ordenado correcto (3; 5). 1 pt: invierte el orden (5; 3) o se equivoca en un numero. 0 pts: otra cosa o en blanco.",
    maxPoints: 2,
    subtipo: "par_ordenado",
  });

  console.log("\n=== Resultado ===");
  console.log(JSON.stringify(result, null, 2));

  if (!result.transcripcion) throw new Error("La IA no devolvio transcripcion -- revisar respuesta cruda.");
  console.log("\nOK: la llamada a la API de Gemini funciona (auth + request + parseo de respuesta).");
}

main().catch((err) => {
  console.error("\nFALLO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
