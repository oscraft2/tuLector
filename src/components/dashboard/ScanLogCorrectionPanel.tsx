import { correctScanLog } from "@/app/admin/actions";

type SavedAnswer = { q: number; a: string; s: number[] };
type CorrectedAnswer = { q: number; a: string };

interface Props {
  scanLogId: string;
  answers: SavedAnswer[];
  rut: string | null;
  corrected: CorrectedAnswer[] | null;
  verified: boolean;
  rutTrue: string | null;
}

/**
 * Correccion manual (ground truth): el staff marca lo que la hoja REALMENTE
 * dice. Server component + form action (sin JS del lado del cliente) --
 * mismo patron que el resto de /admin (ver src/app/admin/actions.ts).
 */
export function ScanLogCorrectionPanel({ scanLogId, answers, rut, corrected, verified, rutTrue }: Props) {
  const correctedByQ = new Map((corrected ?? []).map((c) => [c.q, c.a]));
  const mismatches = corrected ? answers.filter((a) => (correctedByQ.get(a.q) ?? a.a) !== a.a).length : 0;

  return (
    <div className="rounded-md border border-[#e5e7eb] bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#111827]">Corrección manual (ground truth)</h2>
        {verified && (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 border border-green-200">
            Verificado{mismatches > 0 ? ` · ${mismatches} error(es) del motor` : ""}
          </span>
        )}
      </div>
      <p className="text-sm text-[#5b6472]">
        Marca lo que la hoja REALMENTE dice por pregunta. Se guarda en los mismos campos que usa &quot;Confirmar lectura&quot;
        en /scan (alimenta el mismo dataset etiquetado), y queda visible el contraste contra lo que leyó el motor.
      </p>

      <form action={correctScanLog} className="space-y-4">
        <input type="hidden" name="scan_log_id" value={scanLogId} />

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">RUT real</label>
          <input
            name="rut_true"
            defaultValue={rutTrue ?? rut ?? ""}
            placeholder="RUT tal como aparece en la hoja"
            className="w-full max-w-xs rounded border border-[#cfd6df] px-3 py-1.5 text-sm font-mono outline-none focus:border-[#07305f]"
          />
        </div>

        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
          {answers.map((a) => {
            const truth = correctedByQ.get(a.q) ?? a.a;
            const mismatch = corrected && truth !== a.a;
            return (
              <div key={a.q} className={`rounded border p-1.5 ${mismatch ? "border-red-300 bg-red-50" : "border-[#e5e7eb]"}`}>
                <label className="block text-center text-[10px] text-[#9ca3af]">Q{a.q}</label>
                <input
                  name={`ans_${a.q}`}
                  defaultValue={truth}
                  maxLength={5}
                  className="w-full rounded border border-[#cfd6df] px-1 py-1 text-center font-mono text-xs uppercase outline-none focus:border-[#07305f]"
                />
                {mismatch && <p className="mt-0.5 text-center text-[9px] font-semibold text-red-600">motor: {a.a}</p>}
              </div>
            );
          })}
        </div>

        <button className="rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b3f78]">
          Guardar corrección
        </button>
      </form>
    </div>
  );
}
