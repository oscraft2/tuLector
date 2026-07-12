import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

function detectLocaleFromAccept(accept: string): Locale | null {
  const langs = accept.split(",").map((l) => l.split(";")[0].trim().toLowerCase());
  for (const lang of langs) {
    if (locales.includes(lang as Locale)) return lang as Locale;
    if (lang.startsWith("es-mx")) return "es-MX";
    if (lang.startsWith("es-pe")) return "es-PE";
    if (lang.startsWith("es-ar")) return "es-AR";
    if (lang.startsWith("pt-br") || lang.startsWith("pt")) return "pt-BR";
    if (lang.startsWith("es-cl")) return "es-CL";
    if (lang.startsWith("es")) return "es-MX";
  }
  return null;
}

export default async function RootPage() {
  const h = await headers();
  const accept = h.get("accept-language") ?? "";
  const detected = detectLocaleFromAccept(accept) ?? defaultLocale;
  redirect(`/${detected}`);
}
