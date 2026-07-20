"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { guessColumnMapping, parseDelimitedText, detectDelimiter, type ColumnMapping } from "@/lib/student_import";

const initialState: DashboardActionState = { status: "idle" };

type CSVImportProps = {
  action: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
  mappedAction: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
  studentIdLabel?: string;
};

export function CSVImport({ action, mappedAction, studentIdLabel = "RUT" }: CSVImportProps) {
  const [mode, setMode] = useState<"simple" | "smart">("simple");

  return (
    <div className="rounded-md border border-[#e6e8eb] bg-white p-5">
      <div className="mb-4 flex gap-2 border-b border-[#eef0f3]">
        <button
          type="button"
          onClick={() => setMode("simple")}
          className={`px-3 py-2 text-sm font-semibold ${mode === "simple" ? "border-b-2 border-[#07305f] text-[#07305f]" : "text-[#6b7280]"}`}
        >
          Pegar CSV
        </button>
        <button
          type="button"
          onClick={() => setMode("smart")}
          className={`px-3 py-2 text-sm font-semibold ${mode === "smart" ? "border-b-2 border-[#07305f] text-[#07305f]" : "text-[#6b7280]"}`}
        >
          Subir archivo (cualquier formato)
        </button>
      </div>
      {mode === "simple" ? <SimpleImport action={action} /> : <SmartImport action={mappedAction} studentIdLabel={studentIdLabel} />}
    </div>
  );
}

function SimpleImport({ action }: { action: CSVImportProps["action"] }) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.key, state.status]);

  return (
    <>
      <form ref={formRef} action={formAction}>
        <label className="block text-sm font-semibold text-[#111827]" htmlFor="csv">Importar CSV de alumnos</label>
        <p className="mt-1 text-sm text-[#4b5563]">Columnas soportadas: rut, nombre, curso, nivel (opcional). Se valida el identificador segun el pais del colegio y se evita duplicar por colegio.</p>
        <textarea id="csv" name="csv" rows={8} className="mt-4 w-full rounded-md border border-[#d8dde3] px-3 py-2 text-sm outline-none focus:border-[#111827]" placeholder={"rut,nombre,curso\n12345678-5,Ana Perez,IV Medio A"} />
        <SubmitButton pendingLabel="Importando…" className="mt-4 rounded-md bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60">Importar</SubmitButton>
      </form>
      <ActionFeedbackDialog state={state} />
    </>
  );
}

function SmartImport({ action, studentIdLabel }: { action: CSVImportProps["mappedAction"]; studentIdLabel: string }) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [table, setTable] = useState<string[][] | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping>({ rutCol: -1, nameCol: -1, courseCol: -1, gradeCol: -1 });
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    // Sincroniza el estado local con el resultado de la server action
    // (useActionState) -- "external system" segun la propia regla del lint,
    // no un derivado de props/estado local, por eso el setState aca es el
    // caso valido que la regla deja abierto.
    if (state.status === "success") {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTable(null);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [state.key, state.status]);

  const headerLabels = useMemo(() => {
    if (!table || table.length === 0) return [];
    const width = Math.max(...table.map((r) => r.length));
    return Array.from({ length: width }, (_, i) => (hasHeader && table[0][i]?.trim() ? table[0][i].trim() : `Columna ${i + 1}`));
  }, [table, hasHeader]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setFileName(file.name);
    try {
      let rows: string[][];
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], { header: 1 });
        rows = raw.map((r) => (Array.isArray(r) ? r.map((cell) => String(cell ?? "")) : []));
      } else {
        const text = await file.text();
        rows = parseDelimitedText(text, detectDelimiter(text));
      }
      rows = rows.filter((r) => r.some((c) => c.trim() !== ""));
      if (rows.length === 0) { setFileError("El archivo no tiene filas con datos."); return; }

      const guess = guessColumnMapping(rows[0]);
      const guessedHasHeader = guess.rutCol >= 0 && guess.nameCol >= 0;
      setTable(rows);
      setHasHeader(guessedHasHeader);
      setMapping(guessedHasHeader ? guess : { rutCol: 0, nameCol: 1, courseCol: rows[0].length >= 3 ? 2 : -1, gradeCol: -1 });
    } catch {
      setFileError("No se pudo leer el archivo. Prueba con CSV, TXT o XLSX.");
    }
  }

  const previewRows = table ? (hasHeader ? table.slice(1, 4) : table.slice(0, 3)) : [];
  const canSubmit = table !== null && mapping.rutCol >= 0 && mapping.nameCol >= 0;

  return (
    <>
      <form ref={formRef} action={formAction}>
        <label className="block text-sm font-semibold text-[#111827]">Subir planilla de alumnos (CSV, TXT o XLSX)</label>
        <p className="mt-1 text-sm text-[#4b5563]">
          Sirve cualquier planilla, aunque sus columnas no se llamen igual que las nuestras — a continuación eliges cuál es cuál.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.xlsx,.xls"
          onChange={handleFile}
          className="mt-3 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-[#cfd6df] file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold hover:file:bg-[#f4f6f8]"
        />
        {fileError && <p className="mt-2 text-xs font-semibold text-[#b45309]">{fileError}</p>}

        {table && (
          <div className="mt-4 space-y-3 rounded-md border border-[#eef0f3] p-3">
            <p className="text-xs text-[#4b5563]">
              {fileName ? `${fileName}: ` : ""}{table.length} fila{table.length === 1 ? "" : "s"} detectada{table.length === 1 ? "" : "s"}.
            </p>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#4b5563]">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              La primera fila es encabezado (nombres de columna), no un alumno
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <ColumnPicker label={`Columna con ${studentIdLabel}`} required options={headerLabels} value={mapping.rutCol} onChange={(v) => setMapping((m) => ({ ...m, rutCol: v }))} />
              <ColumnPicker label="Columna con Nombre" required options={headerLabels} value={mapping.nameCol} onChange={(v) => setMapping((m) => ({ ...m, nameCol: v }))} />
              <ColumnPicker label="Columna con Curso" options={headerLabels} value={mapping.courseCol} onChange={(v) => setMapping((m) => ({ ...m, courseCol: v }))} />
              <ColumnPicker label="Columna con Nivel (opcional)" options={headerLabels} value={mapping.gradeCol} onChange={(v) => setMapping((m) => ({ ...m, gradeCol: v }))} />
            </div>

            {previewRows.length > 0 && (
              <div className="overflow-x-auto rounded border border-[#eef0f3]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#f4f6f8]">
                      {headerLabels.map((h, i) => (
                        <th key={i} className="whitespace-nowrap px-2 py-1 text-left font-semibold text-[#4b5563]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, ri) => (
                      <tr key={ri} className="border-t border-[#eef0f3]">
                        {headerLabels.map((_, ci) => (
                          <td key={ci} className="whitespace-nowrap px-2 py-1 text-[#111827]">{row[ci] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <input type="hidden" name="rows" value={table ? JSON.stringify(table) : ""} />
        <input type="hidden" name="hasHeader" value={hasHeader ? "1" : "0"} />
        <input type="hidden" name="rutCol" value={mapping.rutCol} />
        <input type="hidden" name="nameCol" value={mapping.nameCol} />
        <input type="hidden" name="courseCol" value={mapping.courseCol} />
        <input type="hidden" name="gradeCol" value={mapping.gradeCol} />

        <SubmitButton
          pendingLabel="Importando…"
          disabled={!canSubmit}
          className="mt-4 rounded-md bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          Importar con este mapeo
        </SubmitButton>
      </form>
      <ActionFeedbackDialog state={state} />
    </>
  );
}

function ColumnPicker({
  label,
  options,
  value,
  onChange,
  required = false,
}: {
  label: string;
  options: string[];
  value: number;
  onChange: (v: number) => void;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-semibold text-[#4b5563]">
      {label}{required && <span className="text-red-600"> *</span>}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-sm font-normal"
      >
        {!required && <option value={-1}>(ninguna)</option>}
        {required && value === -1 && <option value={-1}>Selecciona una columna</option>}
        {options.map((opt, i) => (
          <option key={i} value={i}>{opt}</option>
        ))}
      </select>
    </label>
  );
}
