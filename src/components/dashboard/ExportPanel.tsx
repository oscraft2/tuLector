"use client";

import { useMemo, useState } from "react";
import { EXPORT_COLUMNS, LEGACY_RESULTS_COLUMNS } from "@/lib/export_columns";
import { ChevronIcon } from "@/components/header/icons";

export type ExportTemplateOption = {
  id: string;
  name: string;
  columns: string[];
  headerLabels: Record<string, string> | null;
  perQuestion: string[] | null;
  separator: string | null;
  format: string | null;
  isDefault: boolean;
};

export type ExportPresetOption = {
  id: string;
  name: string;
  description: string | null;
  columns: string[];
};

/**
 * Panel de exportacion del detalle de un ensayo. Reemplaza los botones sueltos
 * que habia (un CSV de 8 columnas fijas y el CSV de DIA).
 *
 * El boton de DIA se conserva tal cual como una entrada mas: es un formato
 * cerrado que consume la extension de dia-bot y no debe volverse configurable.
 */
export function ExportPanel({
  quizId,
  papersCount,
  diaHref,
  templates = [],
  presets = [],
  canSaveTemplate = false,
}: {
  quizId: string;
  papersCount: number;
  diaHref: string;
  templates?: ExportTemplateOption[];
  presets?: ExportPresetOption[];
  /** Solo un admin puede fijar la plantilla del establecimiento. */
  canSaveTemplate?: boolean;
}) {
  const defaultTemplate = templates.find((t) => t.isDefault) ?? null;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(
    () => defaultTemplate?.columns ?? [...LEGACY_RESULTS_COLUMNS],
  );
  const [perQuestion, setPerQuestion] = useState<string[]>(() => defaultTemplate?.perQuestion ?? []);
  const [separator, setSeparator] = useState<"," | ";">(
    () => (defaultTemplate?.separator === ";" ? ";" : ","),
  );
  const [format, setFormat] = useState<"csv" | "xlsx">(
    () => (defaultTemplate?.format === "xlsx" ? "xlsx" : "csv"),
  );
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const disabled = papersCount === 0;

  const href = useMemo(() => {
    const params = new URLSearchParams();
    if (selected.length > 0) params.set("cols", selected.join(","));
    if (perQuestion.length > 0) params.set("perq", perQuestion.join(","));
    if (separator === ";") params.set("sep", ";");
    if (format === "xlsx") params.set("fmt", "xlsx");
    const qs = params.toString();
    return `/api/export/results/${quizId}${qs ? `?${qs}` : ""}`;
  }, [quizId, selected, perQuestion, separator, format]);

  function toggleColumn(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function togglePerQuestion(block: string) {
    setPerQuestion((prev) => (prev.includes(block) ? prev.filter((b) => b !== block) : [...prev, block]));
  }

  function applyPreset(preset: ExportPresetOption) {
    setSelected(preset.columns);
    setPerQuestion([]);
  }

  async function saveTemplate() {
    const name = templateName.trim();
    if (!name) {
      setSaveMessage("Ponle un nombre a la plantilla.");
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/export/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          columns: selected,
          per_question: perQuestion,
          separator,
          format,
          is_default: true,
        }),
      });
      if (!response.ok) {
        setSaveMessage(await response.text());
      } else {
        setSaveMessage(`Plantilla "${name}" guardada como formato del establecimiento.`);
        setTemplateName("");
      }
    } catch {
      setSaveMessage("No se pudo guardar la plantilla.");
    } finally {
      setSaving(false);
    }
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
          <p className="text-sm font-semibold text-[#111827]">Exportar resultados</p>
          <p className="mt-0.5 text-xs text-[#6b7280]">
            {disabled
              ? "Todavía no hay hojas escaneadas para exportar."
              : `${selected.length} columna(s)${perQuestion.length > 0 ? " + detalle por pregunta" : ""} · ${format.toUpperCase()}`}
          </p>
        </div>
        <ChevronIcon className={`h-4 w-4 shrink-0 text-[#6b7280] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-[#eef0f3] px-4 py-4">
          {presets.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Formatos oficiales</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    title={preset.description ?? undefined}
                    className="rounded-md border border-[#cfd6df] bg-white px-2.5 py-1 text-xs font-semibold text-[#374151] hover:bg-[#f4f6f8]"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {templates.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Plantillas del establecimiento</p>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <a
                    key={template.id}
                    href={`/api/export/results/${quizId}?template=${template.id}`}
                    className="rounded-md border border-[#cfd6df] bg-white px-2.5 py-1 text-xs font-semibold text-[#374151] hover:bg-[#f4f6f8]"
                  >
                    {template.name}{template.isDefault ? " ★" : ""}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Columnas</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {EXPORT_COLUMNS.map((column) => (
                <label key={column.id} className="flex items-center gap-1.5 text-xs text-[#374151]">
                  <input
                    type="checkbox"
                    checked={selected.includes(column.id)}
                    onChange={() => toggleColumn(column.id)}
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Detalle por pregunta</p>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-xs text-[#374151]">
                <input
                  type="checkbox"
                  checked={perQuestion.includes("answers")}
                  onChange={() => togglePerQuestion("answers")}
                />
                Respuesta marcada (p1…pN)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[#374151]">
                <input
                  type="checkbox"
                  checked={perQuestion.includes("points")}
                  onChange={() => togglePerQuestion("points")}
                />
                Puntos obtenidos (p1_pts…pN_pts)
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#374151]">
              Separador
              <select
                value={separator}
                onChange={(e) => setSeparator(e.target.value as "," | ";")}
                className="rounded-md border border-[#cfd6df] bg-white px-2 py-1 text-xs font-normal"
              >
                <option value=",">Coma (,)</option>
                <option value=";">Punto y coma (;)</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#374151]">
              Formato
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")}
                className="rounded-md border border-[#cfd6df] bg-white px-2 py-1 text-xs font-normal"
              >
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (.xlsx)</option>
              </select>
            </label>
          </div>

          {canSaveTemplate && (
            <div className="rounded-md border border-[#eef0f3] bg-[#fafbfc] p-3">
              <p className="text-xs font-semibold text-[#374151]">Guardar como formato del establecimiento</p>
              <p className="mt-1 text-[11px] text-[#6b7280]">
                Queda preseleccionado para todos los docentes del colegio la próxima vez que exporten.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ej: Libro de clases"
                  className="min-w-0 flex-1 rounded-md border border-[#cfd6df] bg-white px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={saveTemplate}
                  disabled={saving}
                  className="rounded-md border border-[#07305f] px-2.5 py-1 text-xs font-semibold text-[#07305f] hover:bg-[#f4f6f8] disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
              {saveMessage && <p className="mt-2 text-[11px] font-semibold text-[#374151]">{saveMessage}</p>}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-[#eef0f3] px-4 py-3">
        <a
          href={disabled ? undefined : href}
          aria-disabled={disabled}
          className={
            disabled
              ? "pointer-events-none rounded-md border border-[#cfd6df] bg-white px-4 py-2 text-sm font-semibold text-[#111827] opacity-50"
              : "rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#062447]"
          }
        >
          Descargar {format === "xlsx" ? "Excel" : "CSV"}
        </a>
        <a
          href={disabled ? undefined : diaHref}
          aria-disabled={disabled}
          className={
            disabled
              ? "pointer-events-none rounded-md border border-[#cfd6df] bg-white px-4 py-2 text-sm font-semibold text-[#111827] opacity-50"
              : "rounded-md border border-[#cfd6df] bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50"
          }
        >
          Formato Pruebas DIA
        </a>
        <p className="text-xs text-[#8a93a1]">Listo para subir a la extensión de ingreso a la plataforma DIA.</p>
      </div>
    </div>
  );
}
