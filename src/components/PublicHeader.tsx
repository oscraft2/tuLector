"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type PublicLocale, localeHref } from "@/lib/public_i18n";
import { locales, defaultLocale, localeToCountry, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { TuLectorLogo } from "@/components/TuLectorLogo";
import { RegionSelector } from "@/components/header/RegionSelector";
import { GeoBanner } from "@/components/header/GeoBanner";
import { HeaderWhatsApp, type WhatsappHeaderConfig } from "@/components/header/HeaderWhatsApp";
import { MobileDrawer } from "@/components/header/MobileDrawer";
import {
  ChevronIcon, GradCapIcon, MenuIcon, PricingIcon, ScanIcon, SchoolIcon, SheetIcon, SparklesIcon, TeacherIcon,
} from "@/components/header/icons";

type PublicHeaderProps = {
  locale?: PublicLocale;
  currentLocale?: string;
  whatsapp?: WhatsappHeaderConfig;
};

const PRODUCT_IMAGES = {
  scan: "/workflow/scan-phone.png",
  sheet: "/workflow/print-sheet.png",
  features: "/workflow/results-dashboard.png",
  pricing: "/workflow/create-evaluation.png",
} as const;

const NAV_UNDERLINE =
  "relative after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-left after:bg-[#123b5d] after:transition-transform after:duration-200";

function navItemClass(active: boolean) {
  return active
    ? `${NAV_UNDERLINE} text-[#111827] after:scale-x-100`
    : `${NAV_UNDERLINE} text-[#4b5563] hover:text-[#111827] after:scale-x-0 hover:after:scale-x-100`;
}

/**
 * Header publico multi-pais (TL-HEADER-2026-07-17).
 * Estructura: GeoBanner (condicional) -> topbar (claim localizado + WhatsApp +
 * Soporte) -> barra principal (logo, Producto/Soluciones/Precios/Recursos,
 * RegionSelector, Entrar/Crear cuenta, hamburguesa) -> drawer movil.
 * El mega-menu usa screenshots REALES del producto (/public/workflow).
 */
export function PublicHeader({ currentLocale, whatsapp = { enabled: false, phone: "" } }: PublicHeaderProps) {
  const activeNewLocale = locales.includes(currentLocale as Locale) ? (currentLocale as Locale) : defaultLocale;
  // Copy del nav sacado DIRECTO del locale real por pais (nunca del puente
  // viejo de 3 idiomas, que colapsaba todo el espanol a texto de Chile).
  const copy = messages[activeNewLocale].nav;
  const pathname = usePathname();

  const [openMenu, setOpenMenu] = useState<"producto" | "soluciones" | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }
    function onPointerDown(event: PointerEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openMenu]);

  const isProductoActive = pathname === "/scan" || pathname === "/sheet" || Boolean(pathname?.includes("/features"));
  const isSolucionesActive = Boolean(pathname?.includes("/para-"));
  const isPreciosActive = Boolean(pathname?.includes("/precios"));
  const isRecursosActive = Boolean(pathname?.includes("/recursos"));

  const productItems = [
    { key: "scan", href: "/scan", icon: <ScanIcon className="h-4 w-4" />, ...copy.productMenu.scan },
    { key: "sheet", href: "/sheet", icon: <SheetIcon className="h-4 w-4" />, ...copy.productMenu.sheet },
    { key: "features", href: localeHref("/features", activeNewLocale), icon: <SparklesIcon className="h-4 w-4" />, ...copy.productMenu.features },
    { key: "pricing", href: localeHref("/precios", activeNewLocale), icon: <PricingIcon className="h-4 w-4" />, ...copy.productMenu.pricing },
  ] as const;

  const solutionItems = [
    { href: localeHref("/para-colegios", activeNewLocale), icon: <SchoolIcon className="h-4 w-4" />, ...copy.solutionsMenu.schools },
    { href: localeHref("/para-docentes", activeNewLocale), icon: <TeacherIcon className="h-4 w-4" />, ...copy.solutionsMenu.teachers },
    { href: localeHref("/para-preuniversitarios", activeNewLocale), icon: <GradCapIcon className="h-4 w-4" />, ...copy.solutionsMenu.prep },
  ] as const;

  return (
    <header
      className={`sticky top-0 z-30 border-b border-[#dfe5e2] bg-white/95 backdrop-blur transition-shadow ${
        scrolled ? "shadow-[0_8px_24px_-12px_rgba(18,59,93,0.25)]" : ""
      }`}
    >
      <GeoBanner currentLocale={activeNewLocale} />

      <div className="border-b border-[#e8eee9] bg-[#f8faf9]">
        <div className="mx-auto flex min-h-9 max-w-7xl items-center justify-between gap-3 px-5 py-2 text-xs md:px-8">
          <p className="min-w-0 truncate font-semibold text-[#4b5563]">
            <span className="font-bold text-[#123b5d]">{localeToCountry[activeNewLocale]}</span>
            <span className="mx-1 text-[#8a958f]">|</span>
            <span className="hidden sm:inline">{copy.topbar.claim}</span>
            <span className="sm:hidden">{copy.topbar.compactClaim}</span>
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <HeaderWhatsApp config={whatsapp} message={copy.whatsappMessage} label={copy.whatsapp} />
            <Link href={localeHref("/support", activeNewLocale)} className="hidden font-bold text-[#123b5d] hover:text-[#0f2f49] md:inline-flex">
              {copy.support}
            </Link>
          </div>
        </div>
      </div>

      <div ref={navRef} className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:h-[68px] md:px-8">
        <TuLectorLogo href={localeHref("/", activeNewLocale)} />

        <nav className="hidden items-center gap-7 text-sm font-bold lg:flex" aria-label="Navegacion principal">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === "producto" ? null : "producto"))}
            aria-haspopup="true"
            aria-expanded={openMenu === "producto"}
            className={`${navItemClass(isProductoActive)} inline-flex items-center gap-1`}
          >
            {copy.productMenu.title}
            <ChevronIcon className={openMenu === "producto" ? "h-4 w-4 transition-transform rotate-180" : "h-4 w-4 transition-transform"} />
          </button>
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === "soluciones" ? null : "soluciones"))}
            aria-haspopup="true"
            aria-expanded={openMenu === "soluciones"}
            className={`${navItemClass(isSolucionesActive)} inline-flex items-center gap-1`}
          >
            {copy.solutionsMenu.title}
            <ChevronIcon className={openMenu === "soluciones" ? "h-4 w-4 transition-transform rotate-180" : "h-4 w-4 transition-transform"} />
          </button>
          <Link href={localeHref("/precios", activeNewLocale)} aria-current={isPreciosActive ? "page" : undefined} className={`${navItemClass(isPreciosActive)} transition hover:text-[#111827]`}>
            {copy.pricing}
          </Link>
          <Link href={localeHref("/recursos", activeNewLocale)} aria-current={isRecursosActive ? "page" : undefined} className={`${navItemClass(isRecursosActive)} transition hover:text-[#111827]`}>
            {copy.resources}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <RegionSelector currentLocale={activeNewLocale} />
          </div>
          <Link href="/auth" className="rounded-md px-3 py-2 text-sm font-bold text-[#111827] hover:bg-[#f4f6f5] md:px-4">
            {copy.login}
          </Link>
          <Link href="/auth?mode=register" className="hidden rounded-md bg-[#123b5d] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0f2f49] active:scale-[0.99] sm:inline-flex">
            {copy.register}
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#d8e0dc] bg-white text-[#111827] transition hover:bg-[#f7f8f6] lg:hidden"
            aria-expanded={drawerOpen}
            aria-label={copy.menu}
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>

        {openMenu === "producto" && (
          <div className="absolute left-1/2 top-full z-40 hidden w-[min(920px,92vw)] -translate-x-1/2 rounded-xl border border-[#e8eee9] bg-white p-5 shadow-xl shadow-black/10 tl-anim-menu lg:block">
            <div className="grid gap-3 md:grid-cols-2">
              {productItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setOpenMenu(null)}
                  className="group rounded-lg border border-[#eef0f3] p-3 transition hover:border-[#cfd8d4] hover:shadow-md"
                >
                  <span className="relative block aspect-[16/9] overflow-hidden rounded-md bg-[#f6f7f9]">
                    <Image
                      src={PRODUCT_IMAGES[item.key]}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 90vw, 420px"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </span>
                  <span className="mt-3 flex items-center gap-1.5 text-sm font-bold text-[#111827]">
                    {item.icon}
                    {item.label}
                    <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">-&gt;</span>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[#6b7280]">{item.desc}</span>
                </Link>
              ))}
            </div>

            <Link
              href={localeHref("/para-preuniversitarios", activeNewLocale)}
              onClick={() => setOpenMenu(null)}
              className="group mt-3 flex items-center gap-4 rounded-lg border border-[#e8eee9] bg-[#f8faf9] p-3 transition hover:border-[#cfd8d4] hover:shadow-md"
            >
              <Image
                src="/tulector-hero.webp"
                alt=""
                width={112}
                height={80}
                className="rounded-md object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#2f6f5e]">{copy.productMenu.featured.badge}</span>
                <span className="mt-1 block text-sm font-bold text-[#111827]">{copy.productMenu.featured.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-[#6b7280]">{copy.productMenu.featured.body}</span>
              </span>
              <span className="shrink-0 rounded-md bg-[#123b5d] px-3 py-2 text-xs font-bold text-white transition group-hover:bg-[#0f2f49]">
                {copy.productMenu.featured.cta}
              </span>
            </Link>
          </div>
        )}

        {openMenu === "soluciones" && (
          <div className="absolute left-1/2 top-full z-40 hidden w-[min(420px,90vw)] -translate-x-1/2 rounded-xl border border-[#e8eee9] bg-white p-2 shadow-xl shadow-black/10 tl-anim-menu lg:block">
            {solutionItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpenMenu(null)} className="flex gap-3 rounded-lg px-3 py-2.5 transition hover:bg-[#f7f8f6]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#eef4ff] text-[#123b5d]">{item.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[#111827]">{item.label}</span>
                  <span className="block text-xs leading-5 text-[#6b7280]">{item.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} currentLocale={activeNewLocale} whatsapp={whatsapp} />
    </header>
  );
}
