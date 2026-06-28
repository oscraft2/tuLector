import { parse } from "csv-parse";
import { createReadStream, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "path";

try {
  const content = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
  content.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = match[2] || "";
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
      process.env[key] = process.env[key] || val;
    }
  });
} catch (e) {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERROR: Define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const CSV_PATH = process.argv[2] || resolve(__dirname, "../../Downloads/20250926_Directorio_Oficial_EE_2025_20250430_WEB.csv");
const BATCH_SIZE = 500;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ColegioRow {
  rbd: string;
  nombre: string;
  comuna: string;
  region: string;
  dependencia: string | null;
  rural: boolean;
  lat: number | null;
  lng: number | null;
  matricula_total: number | null;
  estado: string | null;
  convenio_pie: boolean;
  pace: boolean;
  pago_matricula: string | null;
  pago_mensual: string | null;
  orientacion_religiosa: string | null;
}

function parseRow(row: any): ColegioRow | null {
  const rbd = row.RBD?.toString().trim();
  const nombre = row.NOM_RBD?.toString().trim();
  if (!rbd || !nombre) return null;

  const lat = parseFloat(row.LATITUD?.toString()?.replace(",", ".") || "");
  const lng = parseFloat(row.LONGITUD?.toString()?.replace(",", ".") || "");

  return {
    rbd,
    nombre,
    comuna: row.NOM_COM_RBD?.toString().trim() || "",
    region: row.NOM_REG_RBD_A?.toString().trim() || "",
    dependencia: row.COD_DEPE?.toString() || null,
    rural: row.RURAL_RBD === "1",
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    matricula_total: parseInt(row.MAT_TOTAL || "0", 10) || null,
    estado: row.ESTADO_ESTAB?.toString() || null,
    convenio_pie: row.CONVENIO_PIE === "1",
    pace: row.PACE === "1",
    pago_matricula: row.PAGO_MATRICULA?.toString() || null,
    pago_mensual: row.PAGO_MENSUAL?.toString() || null,
    orientacion_religiosa: row.ORI_RELIGIOSA === "1" ? row.ORI_OTRO_GLOSA?.toString() : null,
  };
}

async function main() {
  console.log(`\nLeyendo CSV: ${CSV_PATH}`);

  const colegios: ColegioRow[] = [];
  const parser = createReadStream(CSV_PATH).pipe(
    parse({
      delimiter: ";",
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    })
  );

  for await (const row of parser) {
    const parsed = parseRow(row);
    if (parsed) colegios.push(parsed);
  }

  console.log(`  ${colegios.length} colegios validos encontrados\n`);

  // Limpiar tabla
  console.log("Limpiando tabla chile_schools...");
  const { error: deleteErr } = await supabaseAdmin
    .from("chile_schools")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteErr) console.error("  ADVERTENCIA:", deleteErr.message);
  else console.log("  OK");

  // Insertar por lotes
  console.log(`\nInsertando ${colegios.length} colegios en lotes de ${BATCH_SIZE}...`);
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < colegios.length; i += BATCH_SIZE) {
    const batch = colegios.slice(i, i + BATCH_SIZE);
    const { error } = await supabaseAdmin.from("chile_schools").insert(batch);

    if (error) {
      console.error(`  LOTE ${Math.floor(i / BATCH_SIZE) + 1}: ERROR - ${error.message}`);
      errors++;
    } else {
      inserted += batch.length;
      const pct = Math.round((inserted / colegios.length) * 100);
      process.stdout.write(`\r  Progreso: ${inserted}/${colegios.length} (${pct}%)`);
    }
  }

  console.log(`\n\n--- RESULTADO ---`);
  console.log(`  Insertados: ${inserted}`);
  console.log(`  Errores:    ${errors}`);
  console.log(`  Total:      ${colegios.length}`);
  if (errors === 0) console.log("\n✓ Importacion completada.");
  else console.log("\n⚠ Revisa los errores arriba.");
}

main().catch(console.error);
