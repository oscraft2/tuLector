/**
 * Codec del codigo de hoja (OMR-nativo). Ver docs/codigo-hoja-spec.md.
 *
 * Franja de 46 celdas (lleno=1, vacio=0), MISMA geometria fisica desde v1
 * (46 celdas cabe justo antes de chocar con el ancla derecha — ver CODE_* en
 * sheet_layout.ts): START(3)=1,0,1 | VERSION(4) | <datos, 32 bits> | CRC8(8) | STOP(3)=1,0,1
 *
 *   v1 (hojas ya impresas, SIN pais): SHEET_ID(20) + PAGE(4) + PAGES_TOTAL(4)
 *   v2 (multi-pais, Fase 1):          COUNTRY(4) + SHEET_ID(16) + PAGE(4) + PAGES_TOTAL(4)
 *
 * v2 le resta 4 bits al SHEET_ID (20→16, sigue siendo 65.535 hojas — de sobra)
 * para financiar el campo COUNTRY sin agregar celdas ni tocar la geometria. El
 * CRC valida sobre los mismos 32 bits de datos en ambos layouts, asi que el
 * campo VERSION (los primeros 4 bits, leidos ANTES de interpretar el resto) es
 * lo que decide como parsear — hojas v1 existentes siguen decodificando exacto
 * igual que antes (compat total, sin re-imprimir nada).
 *
 * Fuente de verdad compartida: la usan el render (sheet_render) y el motor (omr).
 */

export const SHEET_CODE_VERSION = 2;
export const SHEET_CODE_CELLS = 46;

// Codigos de pais para el campo COUNTRY (4 bits = 16 valores posibles). Mismo
// set que la tabla `countries` de Supabase (supabase/migrations/20260525000001_latam.sql).
// Indice 0 = CL: es el default implicito de las hojas v1 (sin campo COUNTRY).
export const SHEET_COUNTRY_CODES = ["CL", "AR", "BR", "MX", "CO", "PE", "EC", "UY", "BO", "PY"] as const;
export type SheetCountryCode = (typeof SHEET_COUNTRY_CODES)[number];

const GUARD: number[] = [1, 0, 1];
// Offsets (en celdas) de cada campo dentro de la franja.
const OFF_DATA = 3;            // primer bit de datos (tras START)
const N_DATA = 32;             // VERSION(4) + 28 bits de payload (v1 o v2, mismo total)
const OFF_CRC = OFF_DATA + N_DATA; // 35
const OFF_STOP = OFF_CRC + 8;      // 43

export interface SheetCodeData {
  version: number;      // 0..15
  country?: number;     // 0..15, indice en SHEET_COUNTRY_CODES (solo v2+; ausente en v1 = CL implicito)
  sheetId: number;      // v1: 0..1.048.575 (20 bits) — v2: 0..65.535 (16 bits)
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
  if (page0 < 0 || page0 > 15) throw new Error("page fuera de rango (1..16)");
  if (total0 < 0 || total0 > 15) throw new Error("pagesTotal fuera de rango (1..16)");

  const dataBits: number[] = [];
  pushBits(dataBits, data.version, 4);
  if (data.version <= 1) {
    // Layout v1 (hojas ya impresas): sin COUNTRY, SHEET_ID de 20 bits.
    if (data.sheetId < 0 || data.sheetId > 0xfffff) throw new Error("sheetId fuera de rango (0..1048575)");
    pushBits(dataBits, data.sheetId, 20);
  } else {
    // Layout v2+: COUNTRY(4) + SHEET_ID de 16 bits.
    const country = data.country ?? 0;
    if (country < 0 || country > 15) throw new Error("country fuera de rango (0..15)");
    if (data.sheetId < 0 || data.sheetId > 0xffff) throw new Error("sheetId fuera de rango (0..65535)");
    pushBits(dataBits, country, 4);
    pushBits(dataBits, data.sheetId, 16);
  }
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

  const version = readBits(bits, OFF_DATA, 4);
  if (version <= 1) {
    // Layout v1: VERSION(4)+SHEET_ID(20)+PAGE(4)+PAGES_TOTAL(4). Sin COUNTRY:
    // quien consuma el dato asume CL (compat con hojas impresas antes de Fase 1).
    return {
      version,
      sheetId: readBits(bits, OFF_DATA + 4, 20),
      page: readBits(bits, OFF_DATA + 24, 4) + 1,
      pagesTotal: readBits(bits, OFF_DATA + 28, 4) + 1,
    };
  }
  // Layout v2+: VERSION(4)+COUNTRY(4)+SHEET_ID(16)+PAGE(4)+PAGES_TOTAL(4).
  return {
    version,
    country: readBits(bits, OFF_DATA + 4, 4),
    sheetId: readBits(bits, OFF_DATA + 8, 16),
    page: readBits(bits, OFF_DATA + 24, 4) + 1,
    pagesTotal: readBits(bits, OFF_DATA + 28, 4) + 1,
  };
}
