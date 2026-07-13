/**
 * Validacion/normalizacion de ID nacional para el login de apoderados (Fase 3,
 * ver docs/plan-multipais-motor.md). Los regex espejan countries.id_format_regex
 * (supabase/migrations/20260525000001_latam.sql) mas Brasil (CPF, agregado por
 * el motor OMR en Fase 0 pero AUN NO existe como fila en `countries` — pendiente
 * de otra migracion, no bloquea este login). Se mantienen aca en vez de
 * consultar la BD para no depender de un round-trip extra ni de RLS publico
 * sobre `countries` (que hoy no tiene ninguna policy de lectura).
 */
export interface CountryIdFormat {
  code: string;
  name: string;
  idLabel: string;
  regex: RegExp | null; // null = sin formato estricto conocido en countries.id_format_regex
  example: string;
}

export const COUNTRY_ID_FORMATS: readonly CountryIdFormat[] = [
  { code: "CL", name: "Chile", idLabel: "RUT", regex: /^[0-9]{7,8}-[0-9kK]$/, example: "12345678-5" },
  { code: "AR", name: "Argentina", idLabel: "DNI", regex: /^[0-9]{7,8}$/, example: "20345678" },
  { code: "BR", name: "Brasil", idLabel: "CPF", regex: /^[0-9]{9}-[0-9]{2}$/, example: "123456789-09" },
  { code: "MX", name: "Mexico", idLabel: "CURP", regex: /^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9]{2}$/, example: "ABCD123456HDFXYZ01" },
  { code: "CO", name: "Colombia", idLabel: "Cedula", regex: /^[0-9]{6,10}$/, example: "12345678" },
  { code: "PE", name: "Peru", idLabel: "DNI", regex: /^[0-9]{8}$/, example: "12345678" },
  { code: "EC", name: "Ecuador", idLabel: "Cedula", regex: /^[0-9]{10}$/, example: "1234567890" },
  { code: "UY", name: "Uruguay", idLabel: "CI", regex: /^[0-9]{7,8}-[0-9]$/, example: "1234567-8" },
  { code: "BO", name: "Bolivia", idLabel: "CI", regex: null, example: "" },
  { code: "PY", name: "Paraguay", idLabel: "CI", regex: null, example: "" },
] as const;

export function resolveCountryIdFormat(code: string): CountryIdFormat | undefined {
  return COUNTRY_ID_FORMATS.find((c) => c.code === code.toUpperCase());
}

/**
 * Limpia un ID a su forma comparable: mayuscula, sin puntos/guiones/espacios.
 * Espejo EXACTO de la columna generada `students.national_id_normalized`
 * (migracion 20260712000000_guardian_login.sql) — cualquier cambio aca debe
 * reflejarse alla tambien, o la busqueda deja de matchear.
 */
export function normalizeNationalId(raw: string): string {
  return raw.toUpperCase().replace(/[.\s-]/g, "");
}

/** Valida el formato del ID tal como lo escribe el usuario (CON separadores) contra el pais elegido. */
export function validateNationalIdFormat(raw: string, countryCode: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const format = resolveCountryIdFormat(countryCode);
  if (!format) return false;
  if (!format.regex) return trimmed.length >= 4; // sin regex conocido: solo exige un largo minimo razonable
  return format.regex.test(trimmed);
}
