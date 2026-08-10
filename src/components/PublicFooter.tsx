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
      
      {/* App Download Banner */}
      <section className="bg-[#123b5d] text-white py-16 border-t border-[#0f2f49] relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-[#1e4d77] opacity-50 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-[#0f766e] opacity-30 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-8 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="max-w-2xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-100 text-xs font-bold uppercase tracking-wider mb-5">
              <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0004.5511-.4482.9997-.9993.9997zm-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997zm11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.022 3.503a11.8543 11.8543 0 00-5.1371-1.182 11.851 11.851 0 00-5.1371 1.182l-2.022-3.503a.4156.4156 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396z"/>
              </svg>
              App Nativa para Android
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              Lleva TuLector siempre contigo
            </h2>
            <p className="text-lg text-blue-100/90 mb-8 max-w-xl mx-auto md:mx-0">
              {copy.appStores.body}
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-5 justify-center md:justify-start">
              <a 
                href="https://play.google.com/store/apps/details?id=cl.tulector.app&utm_source=tulector_web&utm_medium=footer_banner&utm_campaign=web_to_app" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="group flex items-center gap-4 bg-white text-[#111827] px-6 py-3.5 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-lg active:scale-95 border border-transparent hover:border-gray-200"
              >
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#3DDC84] group-hover:scale-110 transition-transform" fill="currentColor">
                  <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0004.5511-.4482.9997-.9993.9997zm-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997zm11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.022 3.503a11.8543 11.8543 0 00-5.1371-1.182 11.851 11.851 0 00-5.1371 1.182l-2.022-3.503a.4156.4156 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396z"/>
                </svg>
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-widest text-[#6b7280] font-bold">Consíguela en</div>
                  <div className="text-lg font-extrabold leading-none mt-0.5 tracking-tight">Google Play</div>
                </div>
              </a>
              <div className="text-sm font-medium text-blue-200/80 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Descarga 100% Gratis
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity transform hover:scale-105 duration-300">
            <Image
              src="/store-badges/google-play.png"
              alt="Disponible en Google Play"
              width={646}
              height={250}
              className="h-[60px] w-auto drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

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
                    <a
                      href="https://play.google.com/store/apps/details?id=cl.tulector.app&utm_source=tulector_web&utm_medium=footer_badge&utm_campaign=web_to_app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block transition-transform hover:scale-[1.03] active:scale-[0.98]"
                      aria-label="Descargar TuLector en Google Play"
                    >
                      <Image
                        src="/store-badges/google-play.png"
                        alt="Disponible en Google Play"
                        width={646}
                        height={250}
                        className="h-[38px] w-auto"
                      />
                    </a>
                    <div className="opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-opacity" title="Proximamente en App Store">
                      <Image
                        src="/store-badges/app-store.svg"
                        alt="Download on the App Store (Proximamente)"
                        width={120}
                        height={40}
                        className="h-[38px] w-auto"
                      />
                    </div>
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
