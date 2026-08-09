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
    <div className="min-h-screen bg-[#f8fafc] font-sans selection:bg-blue-200">
      <PublicHeader currentLocale={validLocale} />
      
      {/* Decorative header */}
      <div className="relative overflow-hidden bg-[#071625] py-24 px-6 text-center text-white">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[800px] rounded-full bg-blue-500/20 blur-[100px] pointer-events-none"></div>
        
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Estamos aquí para <span className="text-blue-400">ayudarte</span>
          </h1>
          <p className="text-lg text-blue-100/80 max-w-xl mx-auto">
            ¿Tienes problemas técnicos, dudas de facturación o necesitas orientación? Nuestro equipo de expertos te responderá a la brevedad.
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pb-24 -mt-10 relative z-20">
        
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Card: Registered User */}
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-blue-900/5 border border-gray-100 flex flex-col justify-between transform transition duration-500 hover:-translate-y-2 hover:shadow-2xl">
            <div>
              <div className="mb-6 h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Tengo una cuenta</h2>
              <p className="text-gray-600 mb-8">
                Inicia sesión para una respuesta mucho más rápida. Tu historial de tickets se guardará y podremos ver el estado de tu cuenta de inmediato.
              </p>
            </div>
            <Link href="/auth?next=/dashboard/support/new" className="block text-center rounded-xl bg-gray-900 py-4 font-bold text-white shadow-md hover:bg-blue-600 hover:shadow-xl transition-all">
              Iniciar Sesión y Continuar
            </Link>
          </div>

          {/* Card: Create Account */}
          <div className="bg-gradient-to-br from-blue-600 to-teal-500 rounded-3xl p-8 shadow-xl shadow-blue-900/10 border border-white/10 flex flex-col justify-between transform transition duration-500 hover:-translate-y-2 hover:shadow-2xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-[80px]"></div>
            <div className="relative z-10">
              <div className="mb-6 h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3">¿Eres nuevo en TuLector?</h2>
              <p className="text-white/80 mb-8">
                Regístrate gratis para gestionar tus tickets desde un dashboard unificado y acceder a todas las funcionalidades.
              </p>
            </div>
            <Link href="/auth?mode=register&next=/dashboard/support/new" className="block relative z-10 text-center rounded-xl bg-white py-4 font-bold text-blue-900 shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all">
              Crear Cuenta Gratis
            </Link>
          </div>
        </div>

        {/* Guest Form Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8 md:p-12 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Continuar como invitado</h2>
            <p className="text-gray-500">
              Si solo tienes una consulta rápida o no deseas registrarte por ahora, utiliza este formulario. Te responderemos directo a tu correo.
            </p>
          </div>
          <div className="p-8 md:p-12 max-w-3xl mx-auto">
            <SupportForm locale={validLocale} />
          </div>
        </div>
        
      </main>
      <PublicFooter />
    </div>
  );
}
