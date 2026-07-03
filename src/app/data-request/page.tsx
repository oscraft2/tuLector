import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/PublicInfoPage";
import { resolvePublicLocale } from "@/lib/public_i18n";

type PageProps = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export const metadata: Metadata = {
  title: "Solicitud de datos | TuLector",
  description: "Canal para pedir acceso, correccion o eliminacion de datos asociados a una cuenta TuLector.",
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const locale = resolvePublicLocale(params?.lang);
  return <PublicInfoPage pageKey="dataRequest" locale={locale} />;
}
