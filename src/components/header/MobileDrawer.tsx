"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { localeHref } from "@/lib/public_i18n";
import { type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { TuLectorLogo } from "@/components/TuLectorLogo";
import { RegionSelector } from "@/components/header/RegionSelector";
import { HeaderWhatsApp, type WhatsappHeaderConfig } from "@/components/header/HeaderWhatsApp";
import {
  ChevronIcon, CloseIcon, GradCapIcon, PricingIcon, ScanIcon, SchoolIcon, SheetIcon, SparklesIcon, TeacherIcon,
} from "@/components/header/icons";

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  currentLocale: Locale;
  whatsapp: WhatsappHeaderConfig;
};

const PRODUCT_IMAGES = {
  scan: "/workflow/scan-phone.png",
  sheet: "/workflow/print-sheet.png",
  features: "/workflow/results-dashboard.png",
  pricing: "/workflow/create-evaluation.png",
} as const;

/**
 * Drawer movil del header publico (TL-HEADER-2026-07-17). Orden estricto:
 * logo/cerrar -> RegionSelector -> acordeon Producto (con thumbs reales) ->
 * acordeon Soluciones -> links planos -> CTAs sticky. Scroll-lock del body
 * con cleanup; ESC cierra; cualquier navegacion cierra.
 */
export function MobileDrawer({ open, onClose, currentLocale, whatsapp }: MobileDrawerProps) {
  const [section, setSection] = useState<"producto" | "soluciones" | null>("producto");
  const copy = messages[currentLocale].nav;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const productItems = [
    { key: "scan", href: "/scan", icon: <ScanIcon className="h-4 w-4" />, ...copy.productMenu.scan },
    { key: "sheet", href: "/sheet", icon: <SheetIcon className="h-4 w-4" />, ...copy.productMenu.sheet },
    { key: "features", href: localeHref("/features", currentLocale), icon: <SparklesIcon className="h-4 w-4" />, ...copy.productMenu.features },
    { key: "pricing", href: localeHref("/precios", currentLocale), icon: <PricingIcon className="h-4 w-4" />, ...copy.productMenu.pricing },
  ] as const;

  const solutionItems = [
    { href: localeHref("/para-colegios", currentLocale), icon: <SchoolIcon className="h-4 w-4" />, ...copy.solutionsMenu.schools },
    { href: localeHref("/para-docentes", currentLocale), icon: <TeacherIcon className="h-4 w-4" />, ...copy.solutionsMenu.teachers },
    { href: localeHref("/para-preuniversitarios", currentLocale), icon: <GradCapIcon className="h-4 w-4" />, ...copy.solutionsMenu.prep },
  ] as const;

  const flatLinks = [
    { href: localeHref("/precios", currentLocale), label: copy.pricing },
    { href: localeHref("/recursos", currentLocale), label: copy.resources },
    { href: localeHref("/support", currentLocale), label: copy.support },
    { href: localeHref("/security", currentLocale), label: copy.security },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm tl-anim-fade lg:hidden" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={copy.menu}
        className="fixed inset-y-0 right-0 z-50 flex w-[min(340px,88vw)] flex-col bg-white shadow-2xl tl-anim-drawer lg:hidden"
      >
        <div className="flex items-center justify-between border-b border-[#eef0f3] px-4 py-3">
          <TuLectorLogo href={localeHref("/", currentLocale)} size="sm" />
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#d8e0dc] bg-white text-[#111827] hover:bg-[#f7f8f6]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-[#eef0f3] p-4">
            <RegionSelector currentLocale={currentLocale} variant="menu" />
          </div>

          <nav className="p-4 tl-stagger" aria-label="Navegacion movil">
            <div>
              <button
                type="button"
                onClick={() => setSection((s) => (s === "producto" ? null : "producto"))}
                aria-expanded={section === "producto"}
                className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-bold text-[#111827] hover:bg-[#f7f8f6]"
              >
                {copy.productMenu.title}
                <ChevronIcon className={section === "producto" ? "h-4 w-4 text-[#6b7280] transition-transform rotate-180" : "h-4 w-4 text-[#6b7280] transition-transform"} />
              </button>
              {section === "producto" && (
                <div className="grid gap-1 pb-2">
                  {productItems.map((item) => (
                    <Link key={item.key} href={item.href} onClick={onClose} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#f7f8f6]">
                      <span className="relative h-[42px] w-14 shrink-0 overflow-hidden rounded-md border border-[#eef0f3] bg-[#f6f7f9]">
                        <Image src={PRODUCT_IMAGES[item.key]} alt="" fill sizes="56px" className="object-cover" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-bold text-[#111827]">{item.icon}{item.label}</span>
                        <span className="block truncate text-xs text-[#6b7280]">{item.desc}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={() => setSection((s) => (s === "soluciones" ? null : "soluciones"))}
                aria-expanded={section === "soluciones"}
                className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-bold text-[#111827] hover:bg-[#f7f8f6]"
              >
                {copy.solutionsMenu.title}
                <ChevronIcon className={section === "soluciones" ? "h-4 w-4 text-[#6b7280] transition-transform rotate-180" : "h-4 w-4 text-[#6b7280] transition-transform"} />
              </button>
              {section === "soluciones" && (
                <div className="grid gap-1 pb-2">
                  {solutionItems.map((item) => (
                    <Link key={item.href} href={item.href} onClick={onClose} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#f7f8f6]">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#eef4ff] text-[#123b5d]">{item.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-[#111827]">{item.label}</span>
                        <span className="block truncate text-xs text-[#6b7280]">{item.desc}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-1 border-t border-[#eef0f3] pt-2">
              {flatLinks.map((item) => (
                <Link key={item.href} href={item.href} onClick={onClose} className="block rounded-lg px-3 py-3 text-sm font-bold text-[#374151] hover:bg-[#f7f8f6] hover:text-[#111827]">
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <div className="mt-auto grid gap-2 border-t border-[#eef0f3] p-4">
          <Link
            href="/auth?mode=register"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#123b5d] px-4 text-sm font-bold text-white transition hover:bg-[#0f2f49]"
          >
            {copy.register}
          </Link>
          <Link
            href="/auth"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#d8e0dc] bg-white px-4 text-sm font-bold text-[#111827] transition hover:bg-[#f7f8f6]"
          >
            {copy.login}
          </Link>
          <div className="flex justify-center pt-1 text-sm">
            <HeaderWhatsApp config={whatsapp} message={copy.whatsappMessage} label={copy.whatsapp} />
          </div>
        </div>
      </aside>
    </>
  );
}
