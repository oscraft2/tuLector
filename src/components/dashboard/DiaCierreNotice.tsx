"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DIA_PRESETS, type DiaPreset } from "@/lib/dia_presets";

const STORAGE_KEY_DISMISS = "tl_dia_cierre_2026_banner_v3";
const STORAGE_KEY_SEEN = "tl_dia_cierre_2026_popup_v3";

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

  const cierrePresets = DIA_PRESETS.filter((p) => p.stage === "cierre");

  useEffect(() => {
    setMounted(true);
    const dismissed = localStorage.getItem(STORAGE_KEY_DISMISS) === "1";
    const seen = localStorage.getItem(STORAGE_KEY_SEEN) === "1";

    setBannerDismissed(dismissed);

    // Abre el popup una sola vez por usuario
    if (!seen && (variant === "modal" || variant === "both")) {
      setModalOpen(true);
    }
  }, [variant]);

  if (!mounted) return null;

  function dismissBanner() {
    setBannerDismissed(true);
    localStorage.setItem(STORAGE_KEY_DISMISS, "1");
  }

  function closeModal() {
    setModalOpen(false);
    localStorage.setItem(STORAGE_KEY_SEEN, "1");
  }

  return (
    <>
      {/* ==========================================
          AVISO COMPACTO (1 sola línea limpia)
         ========================================== */}
      {(variant === "banner" || variant === "both") && !bannerDismissed && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#cfd6df] bg-white px-4 py-3 text-sm text-[#111827] shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 rounded bg-[#07305f] px-2 py-0.5 text-xs font-semibold text-white">
              DIA Cierre 2026
            </span>
            <span className="truncate text-[#374151]">
              Pautas oficiales y claves cargadas para 7°B, 8°B, I°M y II°M (Lectura y Matemática).
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-gray-50"
            >
              Ver pruebas
            </button>
            <Link
              href="/dashboard/quizzes"
              className="rounded-md bg-[#07305f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0a3f7a]"
            >
              Crear ensayo
            </Link>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Cerrar aviso"
              className="p-1 text-gray-400 hover:text-gray-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL SIMPLE Y DIRECTO (Sin textos de relleno)
         ========================================== */}
      {(variant === "modal" || variant === "both") && modalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#0b1220]/40 backdrop-blur-[2px]"
            onClick={closeModal}
          />

          {/* Tarjeta compacta */}
          <div className="relative w-full max-w-lg rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-block rounded bg-[#eef4ff] px-2 py-0.5 text-xs font-bold text-[#07305f]">
                  Evaluación de Cierre DIA 2026
                </span>
                <h3 className="mt-1.5 text-lg font-bold text-[#111827]">
                  Pruebas y pautas oficiales disponibles
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Cerrar"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mt-2 text-sm text-[#4b5563]">
              Las claves de respuestas y rúbricas del Mineduc ya vienen precargadas al crear un ensayo en tuLector.
            </p>

            {/* Listado de las 7 pruebas con descarga */}
            <div className="mt-4 divide-y divide-[#f1f3f5] rounded-lg border border-[#e5e7eb] text-xs">
              {cierrePresets.map((preset) => (
                <div key={preset.id} className="flex items-center justify-between px-3 py-2 hover:bg-[#fafafa]">
                  <div>
                    <span className="font-semibold text-[#111827]">{preset.label.replace(" (Cierre)", "")}</span>
                    <span className="ml-2 text-gray-500">{preset.numQuestions} preg.</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {preset.pdfUrl && (
                      <a
                        href={preset.pdfUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-[#cfd6df] bg-white px-2 py-0.5 font-medium text-[#07305f] hover:bg-gray-50"
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
                        className="rounded border border-[#e5e7eb] bg-white px-2 py-0.5 font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Pauta
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Acciones */}
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-[#cfd6df] px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </button>
              <Link
                href="/dashboard/quizzes"
                onClick={closeModal}
                className="rounded-md bg-[#07305f] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0a3f7a]"
              >
                Crear ensayo con plantilla
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
