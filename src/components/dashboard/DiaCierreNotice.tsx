"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";

export type DiaNoticePreset = {
  id: string;
  label: string;
  numQuestions: number;
  pdfUrl?: string;
  fichaUrl?: string;
};

const STORAGE_KEY_DISMISS = "tl_dia_cierre_2026_banner_v3";
const STORAGE_KEY_SEEN = "tl_dia_cierre_2026_popup_v3";
const STORAGE_EVENT = "tl-dia-notice-change";

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

export function DiaCierreNotice({
  presets,
  variant = "both",
}: {
  presets: DiaNoticePreset[];
  variant?: "banner" | "modal" | "both";
}) {
  // En SSR se asumen ya descartados para no provocar pop-in ni layout shift.
  const bannerDismissed = useSyncExternalStore(
    subscribeStorage,
    () => readFlag(STORAGE_KEY_DISMISS),
    () => true,
  );
  const popupSeen = useSyncExternalStore(
    subscribeStorage,
    () => readFlag(STORAGE_KEY_SEEN),
    () => true,
  );
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const modalOpen = manualModalOpen || ((variant === "modal" || variant === "both") && !popupSeen);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  function dismissBanner() {
    try {
      localStorage.setItem(STORAGE_KEY_DISMISS, "1");
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch {
      /* sin storage */
    }
  }

  function closeModal() {
    setManualModalOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY_SEEN, "1");
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch {
      /* sin storage */
    }
  }

  return (
    <>
      {(variant === "banner" || variant === "both") && !bannerDismissed && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7e5df] bg-white px-4 py-3 text-sm text-[#1c1917] shadow-xs">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 rounded-md bg-[#07305f] px-2 py-0.5 text-xs font-semibold text-white">
              DIA Cierre 2026
            </span>
            <span className="truncate text-[#57534e]">
              Pautas oficiales y claves cargadas para 7°B, 8°B, I°M y II°M (Lectura y Matemática).
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setManualModalOpen(true)}
              className="rounded-lg border border-[#d6d3cb] px-3 py-1.5 text-xs font-semibold text-[#1c1917] hover:bg-[#f7f6f2]"
            >
              Ver pruebas
            </button>
            <Link
              href="/dashboard/quizzes"
              className="rounded-lg bg-[#07305f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#062447]"
            >
              Crear ensayo
            </Link>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Cerrar aviso"
              className="p-1 text-[#78716c] hover:text-[#1c1917]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {(variant === "modal" || variant === "both") && modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-[#1c1917]/40 backdrop-blur-[2px]" onClick={closeModal} />

          <div className="relative w-full max-w-lg rounded-2xl border border-[#e7e5df] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-block rounded-md bg-[#eef4ff] px-2 py-0.5 text-xs font-bold text-[#07305f]">
                  Evaluación de Cierre DIA 2026
                </span>
                <h3 className="mt-1.5 text-lg font-bold text-[#1c1917]">Pruebas y pautas oficiales disponibles</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Cerrar"
                className="rounded-md p-1 text-[#78716c] hover:bg-[#f7f6f2] hover:text-[#1c1917]"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mt-2 text-sm text-[#57534e]">
              Las claves de respuestas y rúbricas del Mineduc ya vienen precargadas al crear un ensayo en tuLector.
            </p>

            <div className="mt-4 divide-y divide-[#efede8] rounded-xl border border-[#e7e5df] text-xs">
              {presets.map((preset) => (
                <div key={preset.id} className="flex items-center justify-between px-3 py-2 hover:bg-[#faf9f6]">
                  <div>
                    <span className="font-semibold text-[#1c1917]">{preset.label.replace(" (Cierre)", "")}</span>
                    <span className="ml-2 text-[#78716c]">{preset.numQuestions} preg.</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {preset.pdfUrl && (
                      <a
                        href={preset.pdfUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-[#d6d3cb] bg-white px-2 py-0.5 font-medium text-[#07305f] hover:bg-[#f7f6f2]"
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
                        className="rounded border border-[#e7e5df] bg-white px-2 py-0.5 font-medium text-[#57534e] hover:bg-[#f7f6f2]"
                      >
                        Pauta
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-[#d6d3cb] px-3.5 py-2 text-xs font-semibold text-[#44403c] hover:bg-[#f7f6f2]"
              >
                Cerrar
              </button>
              <Link
                href="/dashboard/quizzes"
                onClick={closeModal}
                className="rounded-lg bg-[#07305f] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#062447]"
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
