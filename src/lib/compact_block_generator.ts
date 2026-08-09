/**
 * GENERADOR del bloque compacto (fuera del sub-motor).
 *
 * Mismo reparto de responsabilidades que sheet_generator.ts con la hoja
 * completa: el motor dibuja lo funcional (drawCompactBlock) y esto agrega texto
 * SOLO en las zonas libres declaradas por el layout (CAPTION_BAND, LABEL_ZONE).
 * Nada de aca puede mover una marca ni una burbuja.
 *
 * El problema que resuelve la exportacion: el flujo real es
 *   generar → pegar en Word → imprimir → fotografiar
 * y Word reescala la imagen segun los DPI que declare el archivo. Un PNG de
 * canvas no declara ninguno, asi que Word asume 96 DPI y la imprime ~3x mas
 * grande de lo diseñado. Por eso el PNG sale con un chunk pHYs de 300 DPI: es
 * lo que hace que Word la inserte al tamaño fisico correcto sin que el profesor
 * tenga que ajustar nada.
 */
import { drawCompactBlock, type CompactMarks } from "@/tulector/compact_render";
import * as C from "@/tulector/compact_layout";
import { type Ctx2D } from "@/tulector/sheet_render";
import { type SheetCodeData } from "@/tulector/sheet_code";

export const BLOCK_DPI = C.BLOCK_DPI;

/** Ancho/alto impresos del bloque, en mm (lo que debe medir en la hoja). */
export const BLOCK_MM = { w: C.BLOCK_W_MM, h: C.BLOCK_H_MM };

const GUIDE_GRAY = "#8a8a8a";

export interface CompactBlockOptions {
  cfg: C.CompactConfig;
  code?: SheetCodeData;
  /** Etiqueta humana corta (ej. "8°A - Mate"). Va en el hueco superior derecho. */
  label?: string;
  /** Guia impresa anti-reescalado en la banda inferior. Default: true. */
  caption?: boolean;
  /** Marcas rellenas (vista previa / fixtures). */
  marks?: Pick<CompactMarks, "answers" | "filled">;
}

/** Texto de la guia. El modo de falla mas frecuente del flujo es reescalar. */
export const CAPTION_TEXT = "TuLector - pegar al 100%, no recortar ni cambiar el tamano";

/**
 * Dibuja el bloque + los textos del generador. Funcion pura sobre Ctx2D, asi
 * sirve igual en el navegador y en Node (fixtures de test).
 */
export function drawCompactBlockSheet(ctx: Ctx2D, opts: CompactBlockOptions): void {
  drawCompactBlock(ctx, { ...opts.marks, code: opts.code }, opts.cfg);

  if (opts.label) {
    const zone = C.LABEL_ZONE;
    ctx.fillStyle = GUIDE_GRAY;
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    // Recorte duro por nº de caracteres: pasarse invadiria el aislamiento del
    // finder TR, que es justo lo que no puede pasar.
    const maxChars = Math.floor((zone.xTo - zone.xFrom) / 10);
    ctx.fillText(opts.label.slice(0, maxChars), zone.xFrom, zone.baseline);
  }

  if (opts.caption !== false) {
    const band = C.CAPTION_BAND;
    ctx.fillStyle = GUIDE_GRAY;
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    // Tope por nº de caracteres (Ctx2D no expone measureText): a 16px sans son
    // ~7.5 px por caracter, y la banda mide xTo-xFrom. Pasarse invadiria el
    // aislamiento de las marcas inferiores.
    const maxChars = Math.floor((band.xTo - band.xFrom) / 7.5);
    ctx.fillText(CAPTION_TEXT.slice(0, maxChars), (band.xFrom + band.xTo) / 2, band.baseline);
    ctx.textAlign = "left";
  }
}

// ─── PNG con DPI declarado (chunk pHYs) ────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

/**
 * Inserta (o reemplaza) el chunk pHYs de un PNG para declarar `dpi`.
 *
 * Formato PNG: firma de 8 bytes y luego chunks [largo(4) | tipo(4) | datos | crc(4)].
 * pHYs lleva 9 bytes: pixeles-por-unidad X e Y (4+4, big-endian) y la unidad
 * (1 byte; 1 = metro). Va despues de IHDR y antes de IDAT.
 */
export function pngWithDpi(png: Uint8Array, dpi: number = BLOCK_DPI): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const SIG = 8;
  if (png.length < SIG + 12) throw new Error("PNG invalido: demasiado corto");
  const ihdrLen = u32(view, SIG);
  const ihdrType = String.fromCharCode(png[SIG + 4], png[SIG + 5], png[SIG + 6], png[SIG + 7]);
  if (ihdrType !== "IHDR") throw new Error(`PNG invalido: primer chunk es ${ihdrType}`);
  const insertAt = SIG + 4 + 4 + ihdrLen + 4;

  // Si ya hubiera un pHYs (algunos codificadores lo ponen), se descarta el viejo.
  let rest = png.subarray(insertAt);
  if (rest.length >= 12) {
    const rv = new DataView(rest.buffer, rest.byteOffset, rest.byteLength);
    const len = u32(rv, 0);
    const type = String.fromCharCode(rest[4], rest[5], rest[6], rest[7]);
    if (type === "pHYs") rest = rest.subarray(4 + 4 + len + 4);
  }

  const ppu = Math.round(dpi / 0.0254); // pixeles por metro
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const cv = new DataView(chunk.buffer);
  cv.setUint32(0, 9, false);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  cv.setUint32(8, ppu, false);
  cv.setUint32(12, ppu, false);
  chunk[16] = 1;                          // unidad = metro
  cv.setUint32(17, crc32(chunk.subarray(4, 17)), false);

  const out = new Uint8Array(insertAt + chunk.length + rest.length);
  out.set(png.subarray(0, insertAt), 0);
  out.set(chunk, insertAt);
  out.set(rest, insertAt + chunk.length);
  return out;
}

/** Lee el DPI declarado de un PNG (o null si no trae pHYs). Para tests/diagnostico. */
export function readPngDpi(png: Uint8Array): number | null {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let off = 8;
  while (off + 12 <= png.length) {
    const len = u32(view, off);
    const type = String.fromCharCode(png[off + 4], png[off + 5], png[off + 6], png[off + 7]);
    if (type === "pHYs") {
      const ppu = u32(view, off + 8);
      const unit = png[off + 16];
      if (unit !== 1) return null;
      return Math.round(ppu * 0.0254);
    }
    if (type === "IDAT" || type === "IEND") return null;
    off += 4 + 4 + len + 4;
  }
  return null;
}

// ─── Exportacion (navegador) ───────────────────────────────────

/** Canvas del bloque a tamaño canonico, listo para exportar. */
export function renderCompactBlockCanvas(opts: CompactBlockOptions): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = C.BLOCK_W;
  canvas.height = C.BLOCK_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el contexto 2D");
  drawCompactBlockSheet(ctx as unknown as Ctx2D, opts);
  return canvas;
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("toBlob devolvio null"));
      blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
    }, "image/png");
  });
}

/** PNG del bloque con 300 DPI declarados — el archivo que se pega en Word. */
export async function compactBlockPngBlob(opts: CompactBlockOptions): Promise<Blob> {
  const bytes = await canvasToPngBytes(renderCompactBlockCanvas(opts));
  const withDpi = pngWithDpi(bytes, BLOCK_DPI);
  return new Blob([withDpi as unknown as BlobPart], { type: "image/png" });
}

/**
 * PDF Carta de 1 pagina con el bloque a tamaño fisico exacto — alternativa al
 * PNG para imprimir directo sin pasar por Word. Se usa Carta (no una pagina a
 * medida) porque es lo que toda impresora maneja sin reescalar.
 */
export async function compactBlockPdfBlob(opts: CompactBlockOptions): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const dataUrl = renderCompactBlockCanvas(opts).toDataURL("image/png");
  const margin = 20;
  doc.addImage(dataUrl, "PNG", margin, margin, BLOCK_MM.w, BLOCK_MM.h);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Imprimir al 100% (sin "ajustar a pagina"). El bloque debe medir ${BLOCK_MM.w.toFixed(0)} x ${BLOCK_MM.h.toFixed(0)} mm.`,
    margin,
    margin + BLOCK_MM.h + 8,
  );
  return doc.output("blob");
}

/** Dispara la descarga de un Blob con el nombre dado. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
