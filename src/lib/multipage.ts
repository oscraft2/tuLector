/**
 * Ensamblado de resultados multipagina (Fase 1, ver docs/plan-multipais-motor.md).
 *
 * Algoritmo PURO: junta las paginas escaneadas de un mismo alumno+prueba (misma
 * sheetId, mismo studentCode) en un solo resultado, sin importar el orden en que
 * se escanearon. NO toca la base de datos todavia — hoy `/sheet` siempre genera
 * pagesTotal=1, asi que esta pieza queda lista pero DORMIDA hasta que el
 * generador aprenda a partir una prueba larga en N hojas fisicas (el otro
 * pendiente de Fase 1, con su propio diseño: como repartir el rango de
 * preguntas por pagina).
 */

export interface PageScanResult {
  page: number;        // 1..pagesTotal
  pagesTotal: number;
  sheetId: number;
  studentCode: string;  // RUT/ID normalizado — clave de agrupacion junto a sheetId
  answers: { q: number; a: string }[]; // preguntas de ESA pagina, numeracion GLOBAL (no reinicia por pagina)
  scannedAt: string;    // ISO
}

export interface AssembledResult {
  complete: boolean;                    // true si estan las pagesTotal paginas
  pagesPresent: number[];               // paginas recibidas, ordenadas
  missingPages: number[];               // pagesTotal - pagesPresent
  answers: { q: number; a: string }[];  // union ordenada por q
  conflicts: { page: number; q: number }[]; // misma q leida en 2+ paginas (señal de hoja duplicada/reimpresa)
}

/**
 * Junta N paginas de un mismo alumno+prueba. El orden de entrada NO importa
 * (se reordena por `page`); si una pagina se escaneo dos veces, la ULTIMA
 * (por `scannedAt`) gana. Es responsabilidad del llamador filtrar las paginas
 * por sheetId/studentCode antes de invocar esta funcion — aqui solo se ensambla.
 */
export function assembleMultipageResult(pages: PageScanResult[]): AssembledResult {
  if (pages.length === 0) return { complete: false, pagesPresent: [], missingPages: [], answers: [], conflicts: [] };

  const pagesTotal = pages[0].pagesTotal;
  const byPage = new Map<number, PageScanResult>();
  for (const p of pages) {
    const prev = byPage.get(p.page);
    if (!prev || p.scannedAt >= prev.scannedAt) byPage.set(p.page, p);
  }

  const pagesPresent = [...byPage.keys()].sort((a, b) => a - b);
  const missingPages = Array.from({ length: pagesTotal }, (_, i) => i + 1).filter((p) => !byPage.has(p));

  const answersByQ = new Map<number, { a: string; page: number }>();
  const conflicts: { page: number; q: number }[] = [];
  for (const page of pagesPresent) {
    const p = byPage.get(page)!;
    for (const ans of p.answers) {
      const prev = answersByQ.get(ans.q);
      if (prev && prev.page !== page) conflicts.push({ page, q: ans.q });
      answersByQ.set(ans.q, { a: ans.a, page });
    }
  }
  const answers = [...answersByQ.entries()].sort((a, b) => a[0] - b[0]).map(([q, v]) => ({ q, a: v.a }));

  return { complete: missingPages.length === 0, pagesPresent, missingPages, answers, conflicts };
}
