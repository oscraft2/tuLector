"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { DIA_PRESETS, type DiaPreset } from "@/lib/dia_presets";

const STORAGE_KEY_DISMISS = "tl_dia_cierre_2026_banner_dismissed_v2";
const STORAGE_KEY_SEEN = "tl_dia_cierre_2026_popup_seen_v2";

export function DiaCierreNotice({
  countryCode = "CL",
  variant = "both",
}: {
  countryCode?: string;
  variant?: "banner" | "modal" | "both";
}) {
  if (countryCode !== "CL") return null;

  const [bannerDismissed, setBannerDismissed] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);

  const cierrePresets = DIA_PRESETS.filter((p) => p.stage === "cierre");

  useEffect(() => {
    setMounted(true);
    const isBannerDismissed = localStorage.getItem(STORAGE_KEY_DISMISS) === "1";
    const hasSeenPopup = localStorage.getItem(STORAGE_KEY_SEEN) === "1";

    setBannerDismissed(isBannerDismissed);

    if (!hasSeenPopup && (variant === "modal" || variant === "both")) {
      setModalOpen(true);
    }
  }, [variant]);

  if (!mounted) return null;

  function handleDismissBanner() {
    setBannerDismissed(true);
    localStorage.setItem(STORAGE_KEY_DISMISS, "1");
  }

  function handleCloseModal() {
    setModalOpen(false);
    localStorage.setItem(STORAGE_KEY_SEEN, "1");
  }

  function handleOpenModal() {
    setModalOpen(true);
  }

  return (
    <>
      {/* =========================================================================
          1. BANNER INSTITUCIONAL DESTACADO (Estilo gráfico nativo TuLector)
         ========================================================================= */}
      {(variant === "banner" || variant === "both") && !bannerDismissed && (
        <section
          aria-label="Aviso Oficial Evaluación de Cierre DIA 2026"
          className="relative mb-6 overflow-hidden rounded-xl border border-[#dfe5e2] bg-white p-5 shadow-xs transition-all md:p-6"
        >
          {/* Acento superior sutil */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#07305f] via-[#123b5d] to-[#2f6f5e]" />

          {/* Botón cerrar banner */}
          <button
            type="button"
            onClick={handleDismissBanner}
            title="Descartar aviso"
            aria-label="Descartar aviso"
            className="absolute right-3 top-3 rounded-md p-1.5 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#111827] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Lado Izquierdo: Copy, Badges y Acciones */}
            <div className="flex-1 pr-6">
              <div className="flex flex-wrap items-center gap-2.5 mb-2.5">
                <span className="rounded bg-[#2f6f5e] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Oficial DIA 2026
                </span>
                <span className="rounded bg-[#eef4ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#07305f]">
                  Evaluación de Cierre
                </span>
                <span className="text-[11px] font-semibold text-[#6b7280]">
                  🇨🇱 7 Instrumentos Listos
                </span>
              </div>

              <h2 className="text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
                Pruebas DIA de Cierre disponibles para generar y escanear
              </h2>

              <p className="mt-1.5 text-sm leading-relaxed text-[#4b5563]">
                Ya están integradas las pautas oficiales de la Agencia de Calidad para <strong>7° Básico, 8° Básico, I Medio y II Medio</strong> en Lectura y Matemática: claves de alternativas, preguntas de desarrollo (con rúbricas Código 0, 1 y 2) y completación precargadas.
              </p>

              {/* Badges de niveles disponibles */}
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-2 py-1 font-medium text-[#374151]">
                  📖 7° Básico Lectura (30 preg)
                </span>
                <span className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-2 py-1 font-medium text-[#374151]">
                  📖 8° Básico Lectura (31 preg)
                </span>
                <span className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-2 py-1 font-medium text-[#374151]">
                  📐 8° Básico Matemática (37 preg)
                </span>
                <span className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-2 py-1 font-medium text-[#374151]">
                  📖 I Medio Lectura (35 preg)
                </span>
                <span className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-2 py-1 font-medium text-[#374151]">
                  📐 I Medio Matemática (38 preg)
                </span>
                <span className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-2 py-1 font-medium text-[#374151]">
                  📖 II Medio Lectura (38 preg)
                </span>
                <span className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-2 py-1 font-medium text-[#374151]">
                  📐 II Medio Matemática (39 preg)
                </span>
              </div>

              {/* Botones de acción */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard/quizzes"
                  className="inline-flex items-center gap-2 rounded-md border border-[#111827] bg-[#111827] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#0a0a0a] transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Crear Ensayo DIA
                </Link>

                <button
                  type="button"
                  onClick={handleOpenModal}
                  className="inline-flex items-center gap-2 rounded-md border border-[#cfd6df] bg-white px-4 py-2 text-sm font-semibold text-[#1f2937] shadow-xs hover:bg-gray-50 transition-colors"
                >
                  <svg className="h-4 w-4 text-[#6b7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Ver Instrumentos y PDFs
                </button>
              </div>
            </div>

            {/* Lado Derecho: Tarjeta Visual de Alianza y Logos */}
            <div className="flex shrink-0 flex-col items-center border-t border-[#dfe5e2] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="flex items-center gap-4 rounded-lg border border-[#dfe5e2] bg-[#f8faf9] p-4">
                <div className="flex flex-col items-center">
                  <Image
                    src="/dia-bot-icon.png"
                    alt="Logo DIA Bot"
                    width={40}
                    height={40}
                    className="rounded shadow-xs"
                  />
                  <span className="mt-1 text-[10px] font-bold text-[#07305f]">tuLector</span>
                </div>
                <div className="text-xl text-[#a0aab8]">➔</div>
                <div className="flex flex-col items-center">
                  <Image
                    src="/agencia-calidad-educacion.png"
                    alt="Agencia de Calidad de la Educación"
                    width={84}
                    height={40}
                    className="object-contain"
                  />
                  <span className="mt-1 text-[10px] font-semibold text-[#6b7280]">DIA Cierre</span>
                </div>
              </div>
              <p className="mt-2.5 max-w-[210px] text-center text-[10px] text-[#6b7280]">
                Instrumentos y pautas oficiales del Mineduc listos para escaneo y exportación directa.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Chip persistente si el banner fue cerrado */}
      {(variant === "banner" || variant === "both") && bannerDismissed && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-white px-3.5 py-2 text-xs shadow-xs">
          <div className="flex items-center gap-2 text-[#334155]">
            <span className="h-2 w-2 rounded-full bg-[#2f6f5e]" />
            <span className="font-semibold text-[#07305f]">Evaluación DIA de Cierre 2026:</span>
            <span>7 instrumentos oficiales cargados (7°B a II°M).</span>
          </div>
          <button
            type="button"
            onClick={handleOpenModal}
            className="font-semibold text-[#07305f] hover:underline"
          >
            Ver pautas y PDFs
          </button>
        </div>
      )}

      {/* =========================================================================
          2. POP-UP / MODAL DETALLADO (Alta fidelidad gráfica)
         ========================================================================= */}
      {(variant === "modal" || variant === "both") && modalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dia-modal-title"
        >
          <div
            className="fixed inset-0 bg-[#0b1220]/60 backdrop-blur-xs transition-opacity"
            onClick={handleCloseModal}
          />

          <div className="relative my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-[#cfd6df] bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header gráfico TuLector */}
            <div className="border-b border-[#e5e9f0] bg-[#07305f] px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                    Diagnóstico Integral de Aprendizajes (DIA)
                  </span>
                  <span className="rounded bg-[#2f6f5e] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                    Cierre 2026
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  aria-label="Cerrar ventana"
                  className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <h2 id="dia-modal-title" className="mt-3 text-xl font-bold tracking-tight text-white md:text-2xl">
                Instrumentos DIA de Cierre Cargados y Auditados
              </h2>
              <p className="mt-1 text-sm text-blue-100">
                TuLector ya incluye las pautas oficiales, claves de alternativas y rúbricas de desarrollo de la Agencia de Calidad.
              </p>
            </div>

            {/* Contenido */}
            <div className="max-h-[68vh] overflow-y-auto px-6 py-5 text-[#1f2937]">
              {/* Tarjetas informativas de 3 pilares */}
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-100 bg-[#f8faf9] p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#07305f]">1. Claves Oficiales</div>
                  <div className="mt-1 text-xs text-gray-600">Alternativas A-D 100% auditadas contra la pauta ministerial.</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-[#f8faf9] p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#07305f]">2. Rúbricas Abiertas</div>
                  <div className="mt-1 text-xs text-gray-600">Códigos oficiales 0, 1 y 2 con asistencia de transcripción Gemini.</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-[#f8faf9] p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#07305f]">3. Sube a DIA Bot</div>
                  <div className="mt-1 text-xs text-gray-600">Exporta en un clic a la plataforma DIA sin digitar alumno por alumno.</div>
                </div>
              </div>

              {/* Tabla de Instrumentos Disponibles */}
              <div className="mb-4">
                <div className="flex items-center justify-between pb-2">
                  <h3 className="text-sm font-bold text-[#111827]">
                    Instrumentos Disponibles ({cierrePresets.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowDownloads(!showDownloads)}
                    className="text-xs font-semibold text-[#07305f] hover:underline"
                  >
                    {showDownloads ? "Ocultar descargas PDF" : "Descargar Cuadernillos / Fichas"}
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#e5e7eb] bg-[#f8fafc] text-gray-700 font-semibold">
                      <tr>
                        <th className="px-3 py-2.5">Nivel y Asignatura</th>
                        <th className="px-3 py-2.5 text-center">Preguntas</th>
                        <th className="px-3 py-2.5">Estructura</th>
                        {showDownloads && <th className="px-3 py-2.5 text-center">PDFs Oficiales</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f3f5]">
                      {cierrePresets.map((preset) => (
                        <tr key={preset.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-[#07305f]">
                            {preset.label}
                          </td>
                          <td className="px-3 py-2.5 text-center text-gray-600 font-semibold">
                            {preset.numQuestions}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">
                            {getStructureDescription(preset)}
                          </td>
                          {showDownloads && (
                            <td className="px-3 py-2.5 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                {preset.pdfUrl && (
                                  <a
                                    href={preset.pdfUrl}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 hover:bg-blue-100"
                                    title="Descargar Cuadernillo de Prueba"
                                  >
                                    Prueba PDF
                                  </a>
                                )}
                                {preset.fichaUrl && (
                                  <a
                                    href={preset.fichaUrl}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 font-semibold text-gray-600 hover:bg-gray-100"
                                    title="Descargar Ficha Técnica Oficial"
                                  >
                                    Ficha PDF
                                  </a>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Guía breve de aplicación */}
              <div className="rounded-xl border border-[#dfe5e2] bg-[#f8faf9] p-3.5 text-xs text-[#1e3a5f]">
                <p className="font-semibold text-[#07305f]">¿Cómo aplicar la prueba en tu curso?</p>
                <ol className="mt-1 list-decimal space-y-1 pl-4 text-gray-700">
                  <li>En <strong>Ensayos</strong>, selecciona <strong>Evaluación de Cierre 2026</strong> en el menú DIA: la clave, alternativas y rúbricas se cargan al instante.</li>
                  <li>Imprime la hoja de respuestas generada por TuLector para tus alumnos.</li>
                  <li>Escanea las hojas con tu celular y exporta directamente a la plataforma DIA ministerial con DIA Bot.</li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-[#e5e7eb] bg-[#f8faf9] px-6 py-4">
              <span className="text-[11px] text-gray-500">
                Agencia de Calidad de la Educación · Chile
              </span>
              <div className="flex w-full sm:w-auto items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full sm:w-auto rounded-md border border-[#cfd6df] bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-colors"
                >
                  Entendido
                </button>
                <Link
                  href="/dashboard/quizzes"
                  onClick={handleCloseModal}
                  className="w-full sm:w-auto text-center rounded-md bg-[#07305f] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0b4282] transition-colors"
                >
                  Crear Ensayo DIA
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getStructureDescription(preset: DiaPreset): string {
  const parts: string[] = [];
  if (preset.openQuestions) {
    const count = preset.openQuestions.split(",").length;
    parts.push(`${count} abierta${count > 1 ? "s" : ""} (P${preset.openQuestions})`);
  }
  if (preset.multiSelectQuestions) {
    parts.push(`Selec. Múltiple (P${preset.multiSelectQuestions})`);
  }
  if (parts.length === 0) {
    return "Alternativas A-D";
  }
  return parts.join(" • ");
}
