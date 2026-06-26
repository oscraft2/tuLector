import { PublicInfoPage } from "@/components/PublicInfoPage";
import { resolvePublicLocale } from "@/lib/public_i18n";

type PageProps = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const locale = resolvePublicLocale(params?.lang);
  return <PublicInfoPage pageKey="security" locale={locale} />;
}
