"use client";

import { useMemo, useState } from "react";
import { serializeGradeTable, type GradeTableMode, type GradeTableRow } from "@/lib/grade_table";
import { ChevronIcon } from "@/components/header/icons";

/**
 * Panel "Nota y equivalencia" del editor de ensayos. Plegado por defecto: sin
 * abrirlo, el ensayo usa la escala del colegio y la formula de exigencia de
 * siempre (todos los campos quedan NULL en BD).
 *
 * Emite los hidden inputs que lee readQuizScoringFields: `passing_grade`,
 * `grade_scale_min`, `grade_scale_max`, `grade_table` y `equivalent_scale`.
 */
export function GradeScalePanel({
  schoolGrading,
  defaultPassingGrade = "",
  defaultScaleMin = "",
  defaultScaleMax = "",
  defaultGradeTable = "",
  defaultEquivalentScale = "",
}: {
  /** Valores del colegio/pais: se muestran como placeholder para que quede claro
   *  que dejar el campo vacio NO es "sin nota", es "la del colegio". */
  schoolGrading: { min: number; max: number; passing: number };
  defaultPassingGrade?: string;
  defaultScaleMin?: string;
  defaultScaleMax?: string;
  /** quizzes.grade_table tal como viene de BD (JSON-string). */
  defaultGradeTable?: string;
  /** quizzes.equivalent_scale tal como viene de BD (JSON-string). */
  defaultEquivalentScale?: string;
}) {
  const parsedTable = useMemo(() => safeParseTable(defaultGradeTable), [defaultGradeTable]);
  const parsedScale = useMemo(() => safeParseScale(defaultEquivalentScale), [defaultEquivalentScale]);

  const [open, setOpen] = useState(
    () => Boolean(defaultPassingGrade || defaultScaleMin || defaultScaleMax || parsedTable || parsedScale),
  );
  const [passingGrade, setPassingGrade] = useState(defaultPassingGrade);
  const [scaleMin, setScaleMin] = useState(defaultScaleMin);
  const [scaleMax, setScaleMax] = useState(defaultScaleMax);

  const [useTable, setUseTable] = useState(Boolean(parsedTable));
  const [tableMode, setTableMode] = useState<GradeTableMode>(parsedTable?.mode ?? "points");
  const [rows, setRows] = useState<GradeTableRow[]>(
    () => parsedTable?.rows ?? [
      { from: 0, grade: schoolGrading.min },
      { from: 0, grade: schoolGrading.passing },
      { from: 0, grade: schoolGrading.max },
    ],
  );

  const [useScale, setUseScale] = useState(Boolean(parsedScale));
  const [scaleFrom, setScaleFrom] = useState(parsedScale ? String(parsedScale.min) : "0");
  const [scaleTo, setScaleTo] = useState(parsedScale ? String(parsedScale.max) : "100");

  const serializedTable = useMemo(() => {
    if (!useTable) return "";
    const clean = rows.filter((r) => Number.isFinite(r.from) && Number.isFinite(r.grade));
    return serializeGradeTable({ mode: tableMode, rows: clean }) ?? "";
  }, [useTable, tableMode, rows]);

  const serializedScale = useMemo(() => {
    if (!useScale) return "";
    const min = Number(String(scaleFrom).replace(",", "."));
    const max = Number(String(scaleTo).replace(",", "."));
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return "";
    return JSON.stringify({ min, max });
  }, [useScale, scaleFrom, scaleTo]);

  const scaleInvalid = useScale && serializedScale === "";

  function updateRow(index: number, patch: Partial<GradeTableRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="rounded-md border border-[#e1e5ea] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-[#111827]">Nota y equivalencia</p>
          <p className="mt-0.5 text-xs text-[#6b7280]">
            {useTable
              ? `Tabla del colegio (${rows.length} tramos)`
              : passingGrade || scaleMin || scaleMax
                ? `Escala propia de este ensayo (${scaleMin || schoolGrading.min} – ${scaleMax || schoolGrading.max}, aprueba con ${passingGrade || schoolGrading.passing})`
                : `Escala del colegio (${schoolGrading.min} – ${schoolGrading.max}, aprueba con ${schoolGrading.passing})`}
          </p>
        </div>
        <ChevronIcon className={`h-4 w-4 shrink-0 text-[#6b7280] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-[#eef0f3] px-4 py-4">
          <p className="text-xs text-[#6b7280]">
            Opcional — todo lo que dejes vacío usa la configuración del colegio. Estos valores
            aplican <strong>solo a este ensayo</strong>.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold text-[#374151]">
              Nota mínima
              <input
                type="number" step={0.1} inputMode="decimal"
                value={scaleMin}
                onChange={(e) => setScaleMin(e.target.value)}
                placeholder={String(schoolGrading.min)}
                className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-sm font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[#374151]">
              Nota de aprobación
              <input
                type="number" step={0.1} inputMode="decimal"
                value={passingGrade}
                onChange={(e) => setPassingGrade(e.target.value)}
                placeholder={String(schoolGrading.passing)}
                className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-sm font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[#374151]">
              Nota máxima
              <input
                type="number" step={0.1} inputMode="decimal"
                value={scaleMax}
                onChange={(e) => setScaleMax(e.target.value)}
                placeholder={String(schoolGrading.max)}
                className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-sm font-normal"
              />
            </label>
          </div>

          <div className="rounded-md border border-[#eef0f3] bg-[#fafbfc] p-3">
            <label className="flex items-start gap-2 text-sm font-semibold text-[#374151]">
              <input type="checkbox" checked={useTable} onChange={(e) => setUseTable(e.target.checked)} className="mt-0.5" />
              <span>
                Usar la tabla de equivalencia del colegio
                <span className="mt-1 block text-xs font-normal text-[#6b7280]">
                  Reemplaza el cálculo por exigencia: la nota sale de los tramos que definas aquí,
                  interpolando los valores intermedios.
                </span>
              </span>
            </label>

            {useTable && (
              <div className="mt-3 space-y-2">
                <label className="block text-xs font-semibold text-[#4b5563]">
                  Los tramos se miden en
                  <select
                    value={tableMode}
                    onChange={(e) => setTableMode(e.target.value as GradeTableMode)}
                    className="ml-2 rounded-md border border-[#cfd6df] bg-white px-2 py-1 text-xs font-normal"
                  >
                    <option value="points">Puntaje</option>
                    <option value="percent">Porcentaje de logro</option>
                  </select>
                </label>

                {rows.map((row, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[#6b7280]">Desde</span>
                    <input
                      type="number" step={0.5} inputMode="decimal"
                      value={String(row.from)}
                      onChange={(e) => updateRow(index, { from: Number(e.target.value.replace(",", ".")) })}
                      className="w-20 rounded border border-[#cfd6df] bg-white px-1.5 py-1"
                    />
                    <span className="text-[#6b7280]">{tableMode === "percent" ? "%" : "pts"} → nota</span>
                    <input
                      type="number" step={0.1} inputMode="decimal"
                      value={String(row.grade)}
                      onChange={(e) => updateRow(index, { grade: Number(e.target.value.replace(",", ".")) })}
                      className="w-20 rounded border border-[#cfd6df] bg-white px-1.5 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                      className="rounded border border-[#cfd6df] px-2 py-1 text-[11px] font-semibold text-[#6b7280] hover:bg-white"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setRows((prev) => [...prev, { from: 0, grade: schoolGrading.passing }])}
                  className="rounded border border-[#cfd6df] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#374151] hover:bg-[#f4f6f8]"
                >
                  + Agregar tramo
                </button>
              </div>
            )}
          </div>

          <div className="rounded-md border border-[#eef0f3] bg-[#fafbfc] p-3">
            <label className="flex items-start gap-2 text-sm font-semibold text-[#374151]">
              <input type="checkbox" checked={useScale} onChange={(e) => setUseScale(e.target.checked)} className="mt-0.5" />
              <span>
                Puntaje equivalente propio
                <span className="mt-1 block text-xs font-normal text-[#6b7280]">
                  Además de la nota, mostrar un puntaje en tu propio rango (por defecto es el
                  porcentaje de logro, 0-100). No aplica a ensayos PAES o SIMCE, que usan su
                  fórmula oficial.
                </span>
              </span>
            </label>
            {useScale && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#6b7280]">Desde</span>
                <input
                  type="number" inputMode="decimal" value={scaleFrom}
                  onChange={(e) => setScaleFrom(e.target.value)}
                  className="w-24 rounded border border-[#cfd6df] bg-white px-1.5 py-1"
                />
                <span className="text-[#6b7280]">hasta</span>
                <input
                  type="number" inputMode="decimal" value={scaleTo}
                  onChange={(e) => setScaleTo(e.target.value)}
                  className="w-24 rounded border border-[#cfd6df] bg-white px-1.5 py-1"
                />
                {scaleInvalid && (
                  <span className="text-[11px] font-semibold text-[#b45309]">
                    El valor final debe ser mayor que el inicial.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <input type="hidden" name="passing_grade" value={passingGrade} />
      <input type="hidden" name="grade_scale_min" value={scaleMin} />
      <input type="hidden" name="grade_scale_max" value={scaleMax} />
      <input type="hidden" name="grade_table" value={serializedTable} />
      <input type="hidden" name="equivalent_scale" value={serializedScale} />
    </div>
  );
}

function safeParseTable(value: string): { mode: GradeTableMode; rows: GradeTableRow[] } | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as { mode?: string; rows?: unknown };
    if (!Array.isArray(raw.rows) || raw.rows.length === 0) return null;
    const rows = raw.rows
      .map((r) => ({ from: Number((r as GradeTableRow)?.from), grade: Number((r as GradeTableRow)?.grade) }))
      .filter((r) => Number.isFinite(r.from) && Number.isFinite(r.grade));
    if (rows.length === 0) return null;
    return { mode: raw.mode === "percent" ? "percent" : "points", rows };
  } catch {
    return null;
  }
}

function safeParseScale(value: string): { min: number; max: number } | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as { min?: unknown; max?: unknown };
    const min = Number(raw?.min);
    const max = Number(raw?.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
    return { min, max };
  } catch {
    return null;
  }
}
