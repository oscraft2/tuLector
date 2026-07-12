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
    title: copy.privacy.title,
    description: copy.privacy.description,
    alternates: {
      canonical: `/${locale}/privacy`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${siteUrl}/${l}/privacy`]),
        ["x-default", `${siteUrl}/es-MX/privacy`],
      ]),
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <PublicInfoPage pageKey="privacy" locale={newLocaleToLegacy(locale)} currentLocale={locale} />;
}
