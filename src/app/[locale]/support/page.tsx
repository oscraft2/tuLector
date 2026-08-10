import type { Metadata } from "next";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { SupportForm } from "./SupportForm";
import { SearchHero } from "@/components/support/SearchHero";
import Link from "next/link";
import Image from "next/image";

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
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-blue-200">
      <PublicHeader currentLocale={validLocale} />
      
      {/* Decorative header */}
      <div className="bg-[#0a0a0a] py-20 px-6 text-center text-white border-b border-[#e5e7eb]">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Estamos aquí para ayudarte
          </h1>
          <p className="text-lg text-gray-300 max-w-xl mx-auto">
            ¿Tienes problemas técnicos, dudas de facturación o necesitas orientación? Nuestro equipo de expertos te responderá a la brevedad.
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-16">
        
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Card: Registered User */}
          <div className="bg-white rounded-lg p-8 shadow-sm border border-[#e5e7eb] flex flex-col justify-between">
            <div>
              <div className="mb-6 h-12 w-12 rounded bg-[#eff6ff] flex items-center justify-center text-[#2563eb]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[#111827] mb-3">Tengo una cuenta</h2>
              <p className="text-[#4b5563] mb-8">
                Inicia sesión para una respuesta mucho más rápida. Tu historial de tickets se guardará y podremos ver el estado de tu cuenta de inmediato.
              </p>
            </div>
            <Link href="/auth?next=/dashboard/support/new" className="block text-center rounded bg-[#111827] py-3.5 font-semibold text-white hover:bg-[#374151] transition-colors">
              Iniciar Sesión y Continuar
            </Link>
          </div>

          {/* Card: Create Account */}
          <div className="bg-[#f0fdfa] rounded-lg p-8 shadow-sm border border-[#ccfbf1] flex flex-col justify-between">
            <div>
              <div className="mb-6 h-12 w-12 rounded bg-[#ccfbf1] flex items-center justify-center text-[#0f766e]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[#111827] mb-3">¿Eres nuevo en TuLector?</h2>
              <p className="text-[#4b5563] mb-8">
                Regístrate gratis para gestionar tus tickets desde un dashboard unificado y acceder a todas las funcionalidades.
              </p>
            </div>
            <Link href="/auth?mode=register&next=/dashboard/support/new" className="block text-center rounded bg-[#0f766e] py-3.5 font-semibold text-white hover:bg-[#115e59] transition-colors">
              Crear Cuenta Gratis
            </Link>
          </div>
        </div>

        {/* Guest Form Section */}
        <div className="bg-white rounded-lg shadow-sm border border-[#e5e7eb] overflow-hidden">
          <div className="p-8 md:p-10 border-b border-[#e5e7eb] bg-[#f9fafb]">
            <h2 className="text-2xl font-bold text-[#111827] mb-2">Continuar como invitado</h2>
            <p className="text-[#6b7280]">
              Si solo tienes una consulta rápida o no deseas registrarte por ahora, utiliza este formulario. Te responderemos directo a tu correo.
            </p>
          </div>
          <div className="p-8 md:p-10 max-w-3xl mx-auto">
            <SupportForm locale={validLocale} />
          </div>
        </div>
        
      </main>
      <PublicFooter />
    </div>
  );
}
