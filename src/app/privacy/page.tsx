import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/PublicInfoPage";
import { resolvePublicLocale } from "@/lib/public_i18n";

export const metadata: Metadata = {
  title: "Politica de Privacidad | TuLector",
  description: "Politica de privacidad y proteccion de datos de TuLector.",
  alternates: { canonical: "/privacy" },
};

type PageProps = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const locale = resolvePublicLocale(params?.lang);
  return <PublicInfoPage pageKey="privacy" locale={locale} />;
}
