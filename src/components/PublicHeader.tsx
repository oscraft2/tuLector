"use client";

import { useState } from "react";
import Link from "next/link";
import { AR, BR, CL, CO, GB, MX, PE } from "country-flag-icons/react/3x2";
import { localeLabels, localizedHref, publicCopy, publicLocales, type PublicLocale } from "@/lib/public_i18n";
import { TuLectorLogo } from "@/components/TuLectorLogo";

type PublicHeaderProps = {
  locale?: PublicLocale;
};

type FlagIcon = typeof CL;

const marketFlags: { label: string; Icon: FlagIcon }[] = [
  { label: "Chile", Icon: CL },
  { label: "Brasil", Icon: BR },
  { label: "Argentina", Icon: AR },
  { label: "Mexico", Icon: MX },
  { label: "Colombia", Icon: CO },
  { label: "Peru", Icon: PE },
];

const localeFlags: Record<PublicLocale, FlagIcon> = {
  es: CL,
  pt: BR,
  en: GB,
};

export function PublicHeader({ locale = "es" }: PublicHeaderProps) {
  const copy = publicCopy[locale].nav;
  const [open, setOpen] = useState(false);
  const navItems = [
    { href: "/", label: copy.product },
    { href: "/scan", label: copy.scan },
    { href: "/sheet", label: copy.sheet },
    { href: "/security", label: copy.security },
    { href: "/support", label: copy.support },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#dfe5e2] bg-white/95 backdrop-blur">
      <div className="border-b border-[#e8eee9] bg-[#f8faf9]">
        <div className="mx-auto flex min-h-9 max-w-7xl items-center justify-between gap-3 px-5 py-2 text-xs md:px-8">
          <div className="flex min-w-0 items-center gap-2 text-[#4b5563]">
            <span className="flex shrink-0 items-center gap-1.5" aria-label="Mercados potenciales en America Latina">
              {marketFlags.map(({ label, Icon }) => (
                <Icon key={label} title={label} className="h-3.5 w-5 rounded-[2px] shadow-sm ring-1 ring-black/5" />
              ))}
            </span>
            <span className="hidden h-4 w-px bg-[#cfd8d4] sm:block" />
            <p className="min-w-0 truncate font-semibold">
              <span className="font-bold text-[#123b5d]">{copy.topbar.region}</span>
              <span className="mx-1 text-[#8a958f]">|</span>
              <span className="hidden sm:inline">{copy.topbar.claim}</span>
              <span className="sm:hidden">{copy.topbar.compactClaim}</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-2.5 sm:flex">
              {publicLocales.map((item) => {
                const LocaleFlag = localeFlags[item];
                return (
                  <Link
                    key={item}
                    href={localizedHref("/", item)}
                    aria-current={item === locale ? "page" : undefined}
                    className={item === locale
                      ? "inline-flex items-center gap-1.5 font-bold text-[#111827]"
                      : "inline-flex items-center gap-1.5 font-semibold text-[#6b7280] hover:text-[#111827]"}
                  >
                    <LocaleFlag title={localeLabels[item]} className="h-3.5 w-5 rounded-[2px] shadow-sm ring-1 ring-black/5" />
                    {localeLabels[item]}
                  </Link>
                );
              })}
            </div>
            <Link href={localizedHref("/support", locale)} className="hidden font-bold text-[#123b5d] hover:text-[#0f2f49] md:inline-flex">
              {copy.support}
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:h-[68px] md:px-8">
        <TuLectorLogo href={localizedHref("/", locale)} />

        <nav className="hidden items-center gap-7 text-sm font-bold text-[#4b5563] lg:flex" aria-label="Navegacion principal">
          {navItems.map((item) => (
            <Link key={item.href} href={localizedHref(item.href, locale)} className="transition hover:text-[#111827]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href={localizedHref("/auth", locale)} className="rounded-md px-3 py-2 text-sm font-bold text-[#111827] hover:bg-[#f4f6f5] md:px-4">
            {copy.login}
          </Link>
          <Link href={localizedHref("/auth?mode=register", locale)} className="hidden rounded-md bg-[#123b5d] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0f2f49] active:scale-[0.99] sm:inline-flex">
            {copy.register}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#d8e0dc] bg-white text-[#111827] transition hover:bg-[#f7f8f6] lg:hidden"
            aria-expanded={open}
            aria-label={open ? copy.close : copy.menu}
          >
            <span className="flex flex-col gap-1.5" aria-hidden="true">
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[#e8eee9] bg-white px-5 py-4 shadow-lg shadow-black/5 lg:hidden">
          <nav className="mx-auto grid max-w-7xl gap-1" aria-label="Navegacion movil">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={localizedHref(item.href, locale)}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-bold text-[#374151] hover:bg-[#f7f8f6] hover:text-[#111827]"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 grid gap-2 border-t border-[#e8eee9] pt-4 sm:hidden">
              {publicLocales.map((item) => {
                const LocaleFlag = localeFlags[item];
                return (
                  <Link
                    key={item}
                    href={localizedHref("/", item)}
                    onClick={() => setOpen(false)}
                    className={item === locale
                      ? "inline-flex items-center gap-2 rounded-lg bg-[#f0f4f2] px-3 py-2 text-sm font-bold text-[#111827]"
                      : "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-[#6b7280] hover:bg-[#f7f8f6] hover:text-[#111827]"}
                  >
                    <LocaleFlag title={localeLabels[item]} className="h-4 w-6 rounded-[2px] shadow-sm ring-1 ring-black/5" />
                    {localeLabels[item]}
                  </Link>
                );
              })}
            </div>
            <Link
              href={localizedHref("/auth?mode=register", locale)}
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#123b5d] px-4 text-sm font-bold text-white transition hover:bg-[#0f2f49]"
            >
              {copy.register}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

