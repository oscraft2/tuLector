/**
 * Exporta el dataset etiquetado (FASE 3) desde scan_logs → dataset.json para
 * entrenar el clasificador. Toma los registros type="label" (las "Confirmar
 * lectura") y aplana a ejemplos POR BURBUJA: { f:[4 features], y:0|1 (rellena) }.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/export_dataset.ts
 *   # o:  vercel env pull .env.local  y luego correrlo
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}

const LABELS = "ABCDE";
type Ans = { q: number; a: string; s: number[]; f?: number[][] };
type LabelLog = { type: string; answers?: Ans[]; corrected?: { q: number; a: string }[] };

async function main() {
  const sb = createClient(url!, key!, { auth: { persistSession: false } });
  const { data, error } = await sb.from("scan_logs").select("log").eq("log->>type", "label").limit(5000);
  if (error) { console.error(error.message); process.exit(1); }

  const out: { f: number[]; y: number }[] = [];
  let scans = 0;
  for (const row of (data ?? []) as { log: LabelLog }[]) {
    const log = row.log;
    scans++;
    const truth = new Map((log.corrected ?? []).map((c) => [c.q, c.a]));
    for (const ans of log.answers ?? []) {
      if (!ans.f) continue;
      const t = truth.get(ans.q) ?? ans.a;
      for (let o = 0; o < ans.f.length; o++) {
        out.push({ f: ans.f[o], y: t.includes(LABELS[o]) ? 1 : 0 });
      }
    }
  }
  writeFileSync("dataset.json", JSON.stringify(out));
  const filled = out.filter((s) => s.y === 1).length;
  console.log(`${scans} scans etiquetados → ${out.length} burbujas (${filled} rellenas, ${out.length - filled} vacías) → dataset.json`);
  if (out.length < 200) console.log("⚠️ Pocos datos aún: junta más 'Confirmar lectura' antes de entrenar.");
}
main();
