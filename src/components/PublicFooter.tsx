"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { localeHref } from "@/lib/public_i18n";
import { locales, defaultLocale, localeToCountry, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { PublicLeadCapture } from "@/components/PublicLeadCapture";
import { TuLectorLogo } from "@/components/TuLectorLogo";

type PublicFooterProps = {
  currentLocale?: string;
};

export function PublicFooter({ currentLocale }: PublicFooterProps) {
  const locale = locales.includes(currentLocale as Locale) ? (currentLocale as Locale) : defaultLocale;
  // Copy sacado DIRECTO del locale real por pais (mismo fix que PublicHeader:
  // antes usaba el puente viejo de 3 idiomas, que colapsaba todo el espanol
  // a contenido de Chile).
  const copy = messages[locale].footer;
  const year = new Date().getFullYear();

  return (
    <>
      <PublicLeadCapture currentLocale={locale} />
      <footer className="border-t border-[#dfe5e2] bg-[#f8faf9] text-[#4b5563]">
        <div className="mx-auto max-w-7xl px-5 py-7 md:px-8 md:py-10 lg:py-12">
          <div className="mb-10 hidden gap-5 rounded-xl border border-[#dfe5e2] bg-white p-5 shadow-sm md:grid md:grid-cols-[1fr_auto] md:items-center md:p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f6f5e]">{copy.cta.eyebrow}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#111827]">{copy.cta.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f6b66]">{copy.cta.body}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
              <Link
                href={localeHref("/auth?mode=register", locale)}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#123b5d] px-5 text-sm font-bold text-white transition hover:bg-[#0f2f49] active:scale-[0.99]"
              >
                {copy.cta.primary}
              </Link>
              <Link
                href={localeHref("/scan", locale)}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#cfd8d4] bg-white px-5 text-sm font-bold text-[#111827] transition hover:border-[#aebbb5] hover:bg-[#f7f8f6] active:scale-[0.99]"
              >
                {copy.cta.secondary}
              </Link>
            </div>
          </div>

          <div className="grid gap-7 lg:grid-cols-[1.1fr_2fr] lg:gap-10">
            <div className="max-w-none">
              <TuLectorLogo href={localeHref("/", locale)} />
              <p className="mt-3 text-sm leading-6 md:mt-4">{copy.tagline}</p>
              <p className="mt-3 text-sm font-medium text-[#111827] md:mt-4">{copy.location}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="rounded-lg border border-[#dfe5e2] bg-white p-3 md:p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6b7280]">{copy.appStores.title}</p>
                  <p className="mt-1 hidden text-xs leading-5 text-[#6b7280] md:block">{copy.appStores.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:flex-col sm:items-start xl:flex-row xl:items-center">
                    <Image
                      src="/store-badges/app-store.svg"
                      alt="Download on the App Store"
                      width={120}
                      height={40}
                      className="h-[38px] w-auto"
                    />
                    <Image
                      src="/store-badges/google-play.png"
                      alt="Get it on Google Play"
                      width={646}
                      height={250}
                      className="h-[38px] w-auto"
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-[#dfe5e2] bg-white p-3 md:p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6b7280]">{copy.contactLabel}</p>
                  <a href={`mailto:${copy.contact}`} className="mt-2 inline-flex text-sm font-bold text-[#123b5d] hover:underline">
                    {copy.contact}
                  </a>
                  <p className="mt-2 hidden text-xs leading-5 text-[#6b7280] md:block">{copy.response}</p>
                </div>
              </div>
            </div>

            <div className="hidden gap-8 sm:grid-cols-2 md:grid lg:grid-cols-4">
              <FooterColumn title={copy.product} links={copy.columns.product} locale={locale} />
              <FooterColumn title={copy.resources} links={copy.columns.resources} locale={locale} />
              <FooterColumn title={copy.account} links={copy.columns.account} locale={locale} />
              <FooterColumn title={copy.company} links={copy.columns.company} locale={locale} />
            </div>

            <div className="grid gap-2 border-y border-[#dfe5e2] py-2 md:hidden">
              <MobileFooterGroup title={copy.product} links={copy.columns.product} locale={locale} initialOpen />
              <MobileFooterGroup title={copy.resources} links={copy.columns.resources} locale={locale} />
              <MobileFooterGroup title={copy.account} links={copy.columns.account} locale={locale} />
              <MobileFooterGroup title={copy.company} links={copy.columns.company} locale={locale} />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 md:mt-10 md:flex-row md:items-center md:justify-between md:border-t md:border-[#dfe5e2] md:pt-6">
            <div>
              <h2 className="hidden text-xs font-bold uppercase tracking-[0.12em] text-[#6b7280] md:block">{copy.language}</h2>
              <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs font-bold md:mt-3 md:gap-2">
                {locales.map((item) => (
                  <Link
                    key={item}
                    href={localeHref("/", item)}
                    aria-current={item === locale ? "page" : undefined}
                    className={item === locale
                      ? "text-[#111827] md:rounded-full md:bg-[#111827] md:px-3 md:py-1.5 md:text-white"
                      : "text-[#6b7280] hover:text-[#111827] md:rounded-full md:border md:border-[#dfe5e2] md:bg-white md:px-3 md:py-1.5"}
                  >
                    {localeToCountry[item]}
                  </Link>
                ))}
              </div>
            </div>

            <div className="text-xs text-[#6b7280] md:text-right">
              <p>© {year} TuLector. {copy.copyright}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2 md:mt-3 md:justify-end md:gap-4">
                <Link href={localeHref("/terms", locale)} className="hover:text-[#111827]">{copy.legal}</Link>
                <Link href={localeHref("/privacy", locale)} className="hover:text-[#111827]">{copy.dataProtection}</Link>
                <Link href={localeHref("/security", locale)} className="hover:text-[#111827]">{copy.securityLink}</Link>
                <Link href={localeHref("/data-request", locale)} className="hover:text-[#111827] md:hidden">Datos</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

function FooterColumn({
  title,
  links,
  locale,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
  locale: Locale;
}) {
  return (
    <div>
      <h2 className="text-sm font-bold text-[#111827]">{title}</h2>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={localeHref(link.href, locale)} className="text-sm font-medium text-[#5f6b66] hover:text-[#111827]">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MobileFooterGroup({
  title,
  links,
  locale,
  initialOpen = false,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
  locale: Locale;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);

  return (
    <div className="border-b border-[#e4eae6] last:border-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between py-3 text-left text-sm font-bold text-[#111827]"
        aria-expanded={open}
      >
        {title}
        <span className="text-lg leading-none text-[#6b7280]" aria-hidden="true">{open ? "-" : "+"}</span>
      </button>
      {open ? (
        <ul className="grid gap-2 pb-3">
          {links.slice(0, 4).map((link) => (
            <li key={link.href}>
              <Link href={localeHref(link.href, locale)} className="text-sm font-medium text-[#5f6b66] hover:text-[#111827]">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
