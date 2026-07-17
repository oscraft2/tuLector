import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";

const siteUrl = "https://tulector.app";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];
  return {
    title: copy.precios.title,
    description: copy.precios.description,
    alternates: {
      canonical: `/${locale}/precios`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${siteUrl}/${l}/precios`]),
        ["x-default", `${siteUrl}/es-MX/precios`],
      ]),
    },
    openGraph: { title: copy.precios.title, description: copy.precios.description },
  };
}

export default async function Precios({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];
  const plans = copy.plans;
  const formatPrice = (price: number, currency: string) => new Intl.NumberFormat(validLocale.startsWith("pt") ? "pt-BR" : "es-CL", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(price);

  const offersLd = plans.map((plan) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    name: `TuLector ${plan.name}`,
    description: plan.description,
    offers: {
      "@type": "Offer",
      price: plan.price.toString(),
      priceCurrency: plan.currency,
      availability: "https://schema.org/InStock",
      url: `https://tulector.app/${locale}/precios`,
    },
  }));

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <PublicHeader currentLocale={validLocale} />

      <section className="mx-auto max-w-7xl px-5 pb-6 pt-6 md:px-8">
        <Breadcrumbs items={[
          { name: "Home", href: `/${locale}` },
          { name: "Precios", href: `/${locale}/precios` },
        ]} />
      </section>

      <JsonLd data={offersLd} />

      <section className="mx-auto max-w-7xl px-5 pb-12 text-center md:px-8">
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">{copy.precios.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[#4b5563]">
          Plan gratis siempre disponible y dos planes pagados claros: Pro y School. Todos los precios en {copy.currencyName} ({copy.currency}).
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-14 md:px-8 md:pb-20">
        <div className="grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className={`rounded-xl border ${plan.name === "Pro" ? "border-[#111827] shadow-lg" : "border-[#e6e8eb]"} bg-white p-8`}>
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#2f6f5e]">{plan.name}</p>
              <p className="mt-4">
                <span className="text-4xl font-bold text-[#111827]">{formatPrice(plan.price, plan.currency)}</span>
                <span className="text-sm text-[#6b7280]">/{plan.price === 0 ? "mes" : "ano"}</span>
              </p>
              <p className="mt-4 text-sm leading-6 text-[#4b5563]">{plan.description}</p>
              <div className="mt-6">
                {plan.price === 0 ? (
                  <Link href={`/${locale}/auth?mode=register`} className="block w-full rounded-lg bg-[#111827] px-4 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-[#07305f]">
                    Empezar gratis
                  </Link>
                ) : (
                  <a href={`mailto:${copy.footer.contact}?subject=Plan%20${encodeURIComponent(plan.name)}%20TuLector`} className="block w-full rounded-lg bg-[#111827] px-4 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-[#07305f]">
                    Contactar ventas
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-[#6b7280]">El plan gratis permanece siempre disponible. Los unicos planes pagados son Pro y School; School habilita administracion de equipo.</p>
      </section>

      <section className="bg-[#f8faf9] py-14 md:py-20">
        <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Preguntas frecuentes sobre precios</h2>
          <div className="mt-8 space-y-4 text-left">
            {[
              { q: "Puedo cambiar de plan en cualquier momento?", a: "Si. Puedes mantener Gratis, subir a Pro o pasar a School cuando necesites administracion de equipo." },
              { q: "Los precios pagados son anuales?", a: "Si. Pro y School son planes anuales. El plan gratis permanece disponible con 100 lecturas mensuales." },
              { q: "Que metodos de pago aceptan?", a: "Aceptamos transferencia bancaria, tarjeta de credito y debito. En Mexico y Argentina ofrecemos MercadoPago. En Chile, Flow. En Brasil, PIX y boleto." },
              { q: "Ofrecen facturacion?", a: "Si. Emitimos factura o boleta segun la normativa fiscal de tu pais. Solo necesitas proporcionar tu RUT/CURP/CPF al momento de la contratacion." },
            ].map((faq) => (
              <details key={faq.q} className="group rounded-lg border border-[#e6e8eb] bg-white p-5">
                <summary className="cursor-pointer text-sm font-semibold text-[#111827]">{faq.q}</summary>
                <p className="mt-3 text-sm leading-6 text-[#4b5563]">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter currentLocale={validLocale} />
    </main>
  );
}