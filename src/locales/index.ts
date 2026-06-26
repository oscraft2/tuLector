import { esCL } from "./es-CL";
import { en } from "./en";
import { ptBR } from "./pt-BR";

export const dashboardLocales = {
  "es-CL": esCL,
  en,
  "pt-BR": ptBR,
} as const;

export type DashboardLocale = keyof typeof dashboardLocales;
export type DashboardMessages = typeof esCL;

export function resolveDashboardLocale(value?: string | null): DashboardLocale {
  if (value === "en" || value === "pt-BR" || value === "es-CL") return value;
  return "es-CL";
}

export function getDashboardMessages(locale: DashboardLocale): DashboardMessages {
  return dashboardLocales[locale] as DashboardMessages;
}

export function formatDate(value: string | Date, locale: DashboardLocale = "es-CL") {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatNumber(value: number, locale: DashboardLocale = "es-CL") {
  return new Intl.NumberFormat(locale).format(value);
}
