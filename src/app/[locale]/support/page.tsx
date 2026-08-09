import type { Metadata } from "next";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { SupportForm } from "./SupportForm";
import { SearchHero } from "@/components/support/SearchHero";

const siteUrl = "https://tulector.app";

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const { locale } = params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];
  return {
    title: copy.support.title,
    description: copy.support.description,
    alternates: {
      canonical: `/${locale}/support`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${siteUrl}/${l}/support`]),
        ["x-default", `${siteUrl}/es-MX/support`],
      ]),
    },
  };
}

export default function SupportPage({ params }: { params: { locale: string } }) {
  const { locale } = params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  
  return (
    <>
      <PublicHeader activeLocale={validLocale} />
      <main className="min-h-screen bg-[#fafafa] py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <SearchHero locale={validLocale} />
          
          <div className="bg-white p-8 rounded-xl shadow-sm border border-[#e5e7eb] mt-12 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-[#111827] mb-2">Crear Ticket de Soporte</h1>
            <p className="text-[#4b5563] mb-8">
              Si no encontraste la respuesta en nuestro Centro de Ayuda, completa este formulario y te responderemos a la brevedad.
            </p>
            <SupportForm locale={validLocale} />
          </div>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
