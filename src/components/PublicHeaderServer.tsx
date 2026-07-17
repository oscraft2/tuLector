import { getWhatsappButtonConfig } from "@/lib/site_config";
import { PublicHeader } from "@/components/PublicHeader";
import type { PublicLocale } from "@/lib/public_i18n";

type Props = { locale?: PublicLocale; currentLocale?: string };

export async function PublicHeaderServer({ locale, currentLocale }: Props) {
  const whatsapp = await getWhatsappButtonConfig();
  return <PublicHeader locale={locale} currentLocale={currentLocale} whatsapp={whatsapp} />;
}
