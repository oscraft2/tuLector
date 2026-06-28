import { parse } from "csv-parse";
import { createReadStream, readdirSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { join, resolve } from "path";

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

const BATCH_SIZE = 500;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const GRADO_MAP: Record<string, string> = {
  "4b": "4° Basico",
  "8b": "8° Basico",
  "2m": "II Medio",
};

const ASIGNATURA_MAP: Record<string, string> = {
  lect: "Lenguaje",
  mate: "Matematica",
};

interface SimceRow {
  rbd: string;
  agno: number;
  grado: string;
  asignatura: string;
  puntaje_promedio: number;
  nivel_insuficiente_pct: number | null;
  nivel_elemental_pct: number | null;
  nivel_adecuado_pct: number | null;
  alumnos_evaluados: number | null;
  cod_reg_rbd: number | null;
  nom_reg_rbd: string | null;
  cod_com_rbd: number | null;
  nom_com_rbd: string | null;
  cod_depe: number | null;
  grupo_socioeconomico: string | null;
}

function parseCsvRow(row: any, grado: string): SimceRow[] {
  const rbd = row.rbd?.toString().trim();
  if (!rbd || rbd === "" || isNaN(Number(rbd))) return [];

  const agno = parseInt(row.agno?.toString() || "2025", 10);
  const gradoName = GRADO_MAP[grado] || grado;
  const results: SimceRow[] = [];

  const base = {
    rbd,
    agno,
    grado: gradoName,
    cod_reg_rbd: parseInt(row.cod_reg_rbd || "0", 10) || null,
    nom_reg_rbd: row.nom_reg_rbd?.toString().trim() || null,
    cod_com_rbd: parseInt(row.cod_com_rbd || "0", 10) || null,
    nom_com_rbd: row.nom_com_rbd?.toString().trim() || null,
    cod_depe: parseInt(row.cod_depe1 || "0", 10) || null,
    grupo_socioeconomico: row.cod_grupo?.toString() || null,
  };

  for (const [abrev, asignatura] of Object.entries(ASIGNATURA_MAP)) {
    const prom = parseFloat(row[`prom_${abrev}${grado}_rbd`]?.toString()?.replace(",", ".") || "0");
    if (isNaN(prom) || prom <= 0) continue;

    results.push({
      ...base,
      asignatura,
      puntaje_promedio: prom,
      alumnos_evaluados: parseInt(row[`nalu_${abrev}${grado}_rbd`]?.toString() || "0", 10) || null,
      nivel_insuficiente_pct: parseFloat(row[`palu_eda_ins_${abrev}${grado}_rbd`]?.toString()?.replace(",", ".") || "0") || null,
      nivel_elemental_pct: parseFloat(row[`palu_eda_ele_${abrev}${grado}_rbd`]?.toString()?.replace(",", ".") || "0") || null,
      nivel_adecuado_pct: parseFloat(row[`palu_eda_ade_${abrev}${grado}_rbd`]?.toString()?.replace(",", ".") || "0") || null,
    });
  }

  return results;
}

async function procesarArchivo(csvPath: string, grado: string): Promise<SimceRow[]> {
  console.log(`  Procesando: ${csvPath}`);

  const parser = createReadStream(csvPath).pipe(
    parse({ delimiter: ";", columns: true, skip_empty_lines: true, trim: true, relax_column_count: true })
  );

  const rows: SimceRow[] = [];
  let count = 0;

  for await (const row of parser) {
    const parsed = parseCsvRow(row, grado);
    rows.push(...parsed);
    count++;
  }

  console.log(`    ${count} filas → ${rows.length} registros`);
  return rows;
}

async function main() {
  const baseDir = process.argv[2] || resolve(__dirname, "../../Downloads/simce_temp");
  console.log(`\n=== IMPORTACION SIMCE 2025 ===`);
  console.log(`  Directorio base: ${baseDir}\n`);

  const archivos: { path: string; grado: string }[] = [];

  for (const gradoDir of ["4B", "8B", "2M"]) {
    const csvDir = join(baseDir, gradoDir, "Archivos CSV (Planos)");
    try {
      const files = readdirSync(csvDir);
      const rbdFile = files.find((f) => f.includes("rbd") && f.endsWith(".csv"));
      if (rbdFile) {
        archivos.push({ path: join(csvDir, rbdFile), grado: gradoDir.toLowerCase() });
      }
    } catch {
      console.log(`  ⚠ Directorio no encontrado: ${csvDir}`);
    }
  }

  if (archivos.length === 0) {
    console.error("No se encontraron archivos CSV. Pasalo manualmente:");
    console.error("  npx tsx scripts/importar-simce.ts ruta/a/simce4b2025_rbd_preliminar.csv 4b");
    process.exit(1);
  }

  console.log(`  Archivos a procesar: ${archivos.length}\n`);

  let todos: SimceRow[] = [];
  for (const { path, grado } of archivos) {
    const rows = await procesarArchivo(path, grado);
    todos.push(...rows);
  }

  console.log(`\n  Total a importar: ${todos.length} registros\n`);

  if (todos.length === 0) {
    console.error("No se encontraron datos validos.");
    process.exit(1);
  }

  console.log("Limpiando datos SIMCE 2025 anteriores...");
  const { error: delErr } = await supabaseAdmin
    .from("simce_resultados")
    .delete()
    .eq("agno", 2025);

  if (delErr) console.error(`  ADVERTENCIA: ${delErr.message}`);
  else console.log("  OK\n");

  console.log(`Insertando ${todos.length} registros en lotes de ${BATCH_SIZE}...`);

  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < todos.length; i += BATCH_SIZE) {
    const batch = todos.slice(i, i + BATCH_SIZE);
    const { error } = await supabaseAdmin.from("simce_resultados").upsert(batch, {
      onConflict: "rbd, agno, grado, asignatura",
      ignoreDuplicates: true,
    });

    if (error) {
      console.error(`  LOTE ${Math.floor(i / BATCH_SIZE) + 1}: ERROR - ${error.message}`);
      errors++;
    } else {
      inserted += batch.length;
      const pct = Math.round((inserted / todos.length) * 100);
      process.stdout.write(`\r  Progreso: ${inserted}/${todos.length} (${pct}%)`);
    }
  }

  console.log(`\n\n=== RESULTADO ===`);
  console.log(`  Insertados: ${inserted}`);
  console.log(`  Errores:    ${errors}`);
  console.log(`  Total:      ${todos.length}`);
  if (errors === 0) console.log("\n✓ SIMCE 2025 importado correctamente.");
  else console.log("\n⚠ Algunos lotes fallaron.");
}

main().catch(console.error);
