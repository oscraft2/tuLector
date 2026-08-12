/**
 * CSV minimo. El separador es configurable porque Excel en configuracion
 * regional castellana interpreta la coma como separador DECIMAL y mete todas
 * las columnas en una sola celda: varios colegios necesitan punto y coma.
 * Por defecto sigue siendo la coma (comportamiento historico).
 */
export function toCsv(headers: string[], rows: Array<Array<unknown>>, separator: "," | ";" = ",") {
  return [headers, ...rows]
    .map((row) => row.map((cell) => csvCell(cell, separator)).join(separator))
    .join("\r\n");
}

function csvCell(value: unknown, separator: "," | ";" = ",") {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Se entrecomilla tambien si contiene el separador EN USO: con ";" una celda
  // con coma no necesita comillas, pero una con ";" si.
  const needsQuotes = text.includes(separator) || /["\r\n]/.test(text);
  if (!needsQuotes) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
