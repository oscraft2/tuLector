import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/PublicInfoPage";
import { resolvePublicLocale } from "@/lib/public_i18n";

export const metadata: Metadata = {
  title: "Terminos de Uso | TuLector",
  description: "Terminos de uso de TuLector.",
  alternates: { canonical: "/terms" },
};

type PageProps = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const locale = resolvePublicLocale(params?.lang);
  return <PublicInfoPage pageKey="terms" locale={locale} />;
}
