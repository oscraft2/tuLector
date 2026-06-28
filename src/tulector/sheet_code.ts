/**
 * Codec del codigo de hoja (OMR-nativo). Ver docs/codigo-hoja-spec.md.
 *
 * Franja de 46 celdas (lleno=1, vacio=0):
 *   START(3)=1,0,1 | VERSION(4) | SHEET_ID(20) | PAGE(4) | PAGES_TOTAL(4) | CRC8(8) | STOP(3)=1,0,1
 *
 * Fuente de verdad compartida: la usan el render (sheet_render) y el motor (omr).
 */

export const SHEET_CODE_VERSION = 1;
export const SHEET_CODE_CELLS = 46;

const GUARD: number[] = [1, 0, 1];
// Offsets (en celdas) de cada campo dentro de la franja.
const OFF_DATA = 3;            // primer bit de datos (tras START)
const N_DATA = 32;             // VERSION(4)+SHEET_ID(20)+PAGE(4)+PAGES_TOTAL(4)
const OFF_CRC = OFF_DATA + N_DATA; // 35
const OFF_STOP = OFF_CRC + 8;      // 43

export interface SheetCodeData {
  version: number;      // 0..15
  sheetId: number;      // 0..1.048.575 (20 bits)
  page: number;         // 1..16 (se guarda 0..15)
  pagesTotal: number;   // 1..16 (se guarda 0..15)
}

/** CRC-8 (poly 0x07, init 0x00, MSB-first) sobre un arreglo de bits. */
export function crc8(bits: number[]): number {
  let crc = 0;
  for (const bit of bits) {
    const inbit = (bit & 1) ^ ((crc >> 7) & 1);
    crc = (crc << 1) & 0xff;
    if (inbit) crc ^= 0x07;
  }
  return crc;
}

function pushBits(arr: number[], value: number, n: number): void {
  for (let i = n - 1; i >= 0; i--) arr.push((value >> i) & 1);
}

function readBits(bits: number[], start: number, n: number): number {
  let v = 0;
  for (let i = 0; i < n; i++) v = (v << 1) | (bits[start + i] & 1);
  return v;
}

/** Codifica los datos a las 46 celdas (incluye guias y CRC). Lanza si fuera de rango. */
export function encodeSheetCode(data: SheetCodeData): number[] {
  const page0 = data.page - 1;
  const total0 = data.pagesTotal - 1;
  if (data.version < 0 || data.version > 15) throw new Error("version fuera de rango (0..15)");
  if (data.sheetId < 0 || data.sheetId > 0xfffff) throw new Error("sheetId fuera de rango (0..1048575)");
  if (page0 < 0 || page0 > 15) throw new Error("page fuera de rango (1..16)");
  if (total0 < 0 || total0 > 15) throw new Error("pagesTotal fuera de rango (1..16)");

  const dataBits: number[] = [];
  pushBits(dataBits, data.version, 4);
  pushBits(dataBits, data.sheetId, 20);
  pushBits(dataBits, page0, 4);
  pushBits(dataBits, total0, 4);

  const crcBits: number[] = [];
  pushBits(crcBits, crc8(dataBits), 8);

  return [...GUARD, ...dataBits, ...crcBits, ...GUARD];
}

/** Decodifica 46 bits → datos, o null si guias/CRC no validan (hoja vieja o ilegible). */
export function decodeSheetCode(bits: number[]): SheetCodeData | null {
  if (bits.length !== SHEET_CODE_CELLS) return null;
  // Guias
  for (let i = 0; i < 3; i++) {
    if ((bits[i] & 1) !== GUARD[i]) return null;
    if ((bits[OFF_STOP + i] & 1) !== GUARD[i]) return null;
  }
  const dataBits = bits.slice(OFF_DATA, OFF_DATA + N_DATA);
  const readCrc = readBits(bits, OFF_CRC, 8);
  if (crc8(dataBits) !== readCrc) return null;

  return {
    version: readBits(bits, OFF_DATA, 4),
    sheetId: readBits(bits, OFF_DATA + 4, 20),
    page: readBits(bits, OFF_DATA + 24, 4) + 1,
    pagesTotal: readBits(bits, OFF_DATA + 28, 4) + 1,
  };
}
