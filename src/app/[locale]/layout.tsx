import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { JsonLd } from "@/components/JsonLd";

const siteUrl = "https://tulector.app";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${siteUrl}/${l}`]),
        ["x-default", `${siteUrl}/es-MX`],
      ]),
    },
    openGraph: {
      locale: locale.replace("-", "_"),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();

  const m = messages[locale as Locale];
  const eduLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "TuLector",
    url: `https://tulector.app/${locale}`,
    areaServed: m.areaServed,
    knowsAbout: m.knowsAbout,
    publishingPrinciples: "https://tulector.app/security",
  };

  return (
    <>
      <JsonLd data={eduLd} />
      {children}
    </>
  );
}
