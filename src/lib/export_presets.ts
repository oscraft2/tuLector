/**
 * Presets institucionales de exportacion (Agencia de Calidad CL, ICFES CO,
 * PLANEA MX...).
 *
 * La tabla `export_formats` existe y esta sembrada con estos mapeos desde la
 * migracion 20260525000001_latam.sql, pero NINGUN codigo la consultaba: el
 * unico consumidor era `generateExportCSV` en latam.ts, que tenia los formatos
 * hardcodeados aparte y nadie llamaba. Este modulo la pone en uso y traduce su
 * `column_mapping` a los ids del catalogo (src/lib/export_columns.ts).
 */
import type { ExportSpec } from "@/lib/export_columns";

export type ExportPreset = {
  id: string;
  name: string;
  description: string | null;
  spec: ExportSpec;
};

/**
 * `export_formats.column_mapping` esta escrito en las columnas conceptuales de
 * aquella migracion ("student_id", "student_name", "score"...). Esto las lleva
 * a los ids reales del catalogo. Lo que no tenga equivalente se ignora: es
 * preferible un preset con una columna menos que uno que revienta.
 */
const MAPPING_TO_COLUMN: Record<string, string> = {
  student_id: "rut",
  student_name: "student_name",
  score: "points",
  grade: "grade",
  date: "scanned_at",
  subject: "course",
};

type ExportFormatRow = {
  name: string;
  description: string | null;
  delimiter: string | null;
  column_mapping: unknown;
};

/**
 * Presets disponibles para un pais. Devuelve [] si la tabla no existe todavia,
 * si el pais no tiene ninguno, o ante cualquier error: un preset ausente solo
 * quita opciones del selector, nunca puede impedir exportar.
 */
export async function fetchExportPresets(
  supabase: { from: (table: string) => unknown },
  countryCode: string,
): Promise<ExportPreset[]> {
  type Q = {
    select: (columns: string) => { eq: (column: string, value: unknown) => PromiseLike<{ data: unknown; error: unknown }> };
  };
  try {
    const { data, error } = await (supabase.from("export_formats") as Q)
      .select("name,description,delimiter,column_mapping")
      .eq("country_code", countryCode);
    if (error || !Array.isArray(data)) return [];

    const presets: ExportPreset[] = [];
    for (const row of data as ExportFormatRow[]) {
      const mapping = row.column_mapping;
      if (!mapping || typeof mapping !== "object") continue;

      const columns: string[] = [];
      const headerLabels: Record<string, string> = {};
      for (const [conceptual, label] of Object.entries(mapping as Record<string, unknown>)) {
        const columnId = MAPPING_TO_COLUMN[conceptual];
        // Sin equivalente en el catalogo (ej "eje"/"habilidad", que son metadata
        // curricular por pregunta y no una columna por alumno) se salta.
        if (!columnId || columns.includes(columnId)) continue;
        columns.push(columnId);
        if (typeof label === "string" && label.trim()) headerLabels[columnId] = label.trim();
      }
      if (columns.length === 0) continue;

      presets.push({
        id: row.name,
        name: row.name,
        description: row.description,
        spec: { columns, headerLabels, },
      });
    }
    return presets;
  } catch {
    return [];
  }
}

/** Separador declarado por el preset (`export_formats.delimiter`), acotado a lo
 *  que la exportacion soporta. */
export function presetSeparator(delimiter: string | null | undefined): "," | ";" {
  return delimiter === ";" ? ";" : ",";
}
