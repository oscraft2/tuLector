import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/PublicInfoPage";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { newLocaleToLegacy } from "@/lib/public_i18n";

const siteUrl = "https://tulector.app";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];
  return {
    title: copy.terms.title,
    description: copy.terms.description,
    alternates: {
      canonical: `/${locale}/terms`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${siteUrl}/${l}/terms`]),
        ["x-default", `${siteUrl}/es-MX/terms`],
      ]),
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <PublicInfoPage pageKey="terms" locale={newLocaleToLegacy(locale)} currentLocale={locale} />;
}
