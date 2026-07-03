/**
 * Análisis HEADLESS "ideal vs real" — sin imprimir ni escanear (Fase A del plan).
 * Re-renderiza cada hoja de la verdad-terreno y la pasa por el MISMO motor que
 * usa /scan (findCorners → warpSheet → gradeBubbles + readRut), produciendo filas
 * con la forma de scan_logs para reutilizar buildReport sin cambios.
 *
 * Mide el "piso del sistema": el error de geometría render↔lectura, aislado de la
 * cámara y del marcado humano. Es el mismo camino que valida test_omr_real.ts
 * (guardias "Config sweep"/"Parametric"), pero corrido en el navegador y contra
 * la verdad-terreno del generador. El motor (src/tulector/**) no se toca: solo se mide.
 * Ver docs/plan-pruebas-lector.md.
 */
import { findCorners, warpSheet, gradeBubbles, readRut, DEFAULT_CONFIG } from "@/lib/omr";
import { renderSheet, type Branding, type GroundTruthEntry } from "@/lib/sheet_generator";
import { SHEET_W, SHEET_H, type SheetConfig } from "@/lib/sheet_layout";
import { type ScanLogRow } from "@/lib/scan_log";

const LABELS = "ABCDE";

/** Convierte letras ("A".."E") a índices de opción (0-based) para renderSheet. */
function lettersToIdx(answers: string[]): number[] {
  return answers.map((a) => {
    const i = LABELS.indexOf((a ?? "").toUpperCase());
    return i < 0 ? 0 : i;
  });
}

/**
 * Corre el motor sobre cada hoja re-renderizada y devuelve filas tipo scan_logs
 * (solo lo que buildReport necesita: type="scan", rut, answers). Una hoja que no
 * detecta esquinas o sale inválida NO emite fila → buildReport la cuenta como
 * "no emparejada" (fallo del sistema).
 * `onProgress(done, total)` permite pintar el avance.
 */
export async function analyzeTruthHeadless(
  truth: GroundTruthEntry[],
  cfg: SheetConfig,
  branding: Branding = {},
  onProgress?: (done: number, total: number) => void,
): Promise<ScanLogRow[]> {
  const config = {
    ...DEFAULT_CONFIG,
    numQuestions: cfg.numQuestions,
    numOptions: cfg.numOptions,
    optionLabels: LABELS.slice(0, cfg.numOptions),
    numColumns: cfg.numColumns,
  };

  const canvas = document.createElement("canvas");
  canvas.width = SHEET_W;
  canvas.height = SHEET_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo crear el canvas de análisis.");

  const rows: ScanLogRow[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < truth.length; i++) {
    const t = truth[i];
    // Re-render determinista con la MISMA geometría que se imprimió.
    ctx.clearRect(0, 0, SHEET_W, SHEET_H);
    renderSheet(ctx, { rut: t.rut, answers: lettersToIdx(t.answers), filled: true }, cfg, branding);
    const frame = ctx.getImageData(0, 0, SHEET_W, SHEET_H);

    const corners = findCorners(frame, config);
    if (corners) {
      const warped = warpSheet(frame, corners, config);
      const report = gradeBubbles(warped, config, corners);
      const rutR = readRut(warped, config);
      if (report.valid) {
        rows.push({
          id: `headless-${t.index}`,
          user_agent: "headless",
          created_at: now,
          log: {
            v: 1,
            type: "scan",
            source: "upload",
            sheet: "v2",
            ts: now,
            rut: rutR.rut || "",
            dvOk: rutR.dvOk,
            answers: (report.results ?? []).map((r) => ({ q: r.question, a: r.answer, s: r.scores })),
          },
        });
      }
    }

    onProgress?.(i + 1, truth.length);
    // Cede el hilo periódicamente para no congelar la UI en lotes grandes.
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }

  return rows;
}
