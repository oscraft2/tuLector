export { locales, defaultLocale, localeToCountry, localeToCurrency, localeToContact, type Locale } from "@/i18n/config";
export { messages } from "@/i18n/messages";
export type { Messages } from "@/i18n/messages";

export const publicLocales = ["es", "pt", "en"] as const;
export type PublicLocale = (typeof publicLocales)[number];
export type LegacyLocale = PublicLocale;

const legacyToNew: Record<PublicLocale, string> = { es: "es-CL", pt: "pt-BR", en: "es-CL" };
import { messages as msgs } from "@/i18n/messages";
import type { Locale } from "@/i18n/config";

export function resolvePublicLocale(value?: string | string[] | null): PublicLocale {
  const locale = Array.isArray(value) ? value[0] : value;
  return publicLocales.includes(locale as PublicLocale) ? (locale as PublicLocale) : "es";
}

export function newLocaleToLegacy(locale: string): PublicLocale {
  if (locale === "pt-BR") return "pt";
  return "es";
}

export function localizedHref(href: string, locale: PublicLocale) {
  if (locale === "es") return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}lang=${locale}`;
}

export function localeHref(href: string, locale: Locale) {
  return `/${locale}${href}`;
}

export const localeLabels: Record<PublicLocale, string> = {
  es: "Chile - Espanol",
  pt: "Brasil - Portugues",
  en: "English",
};

function adaptMessages(locale: PublicLocale) {
  const newLocale = legacyToNew[locale] as Locale;
  const m = msgs[newLocale];
  return {
    nav: m.nav,
    home: m.home,
    footer: {
      tagline: m.footer.tagline,
      product: m.footer.product,
      resources: m.footer.resources,
      account: m.footer.account,
      company: m.footer.company,
      legal: m.footer.legal,
      dataProtection: m.footer.dataProtection,
      securityLink: m.footer.securityLink,
      language: m.footer.language,
      contactLabel: m.footer.contactLabel,
      contact: m.footer.contact,
      response: m.footer.response,
      location: m.footer.location,
      appStores: m.footer.appStores,
      cta: m.footer.cta,
      newsletter: m.footer.newsletter,
      columns: m.footer.columns,
      copyright: m.footer.copyright,
    },
  };
}

export const publicCopy = {
  es: adaptMessages("es"),
  pt: adaptMessages("pt"),
  en: adaptMessages("en"),
} as const;
















