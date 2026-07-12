export const locales = ["es-MX", "es-PE", "es-AR", "pt-BR", "es-CL"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es-MX";
export const localeToCountry: Record<Locale, string> = {
  "es-MX": "Mexico",
  "es-PE": "Peru",
  "es-AR": "Argentina",
  "pt-BR": "Brasil",
  "es-CL": "Chile",
};
export const localeToCurrency: Record<Locale, string> = {
  "es-MX": "MXN",
  "es-PE": "PEN",
  "es-AR": "ARS",
  "pt-BR": "BRL",
  "es-CL": "CLP",
};
export const localeToContact: Record<Locale, string> = {
  "es-MX": "ventas-mx@tulector.app",
  "es-PE": "ventas-pe@tulector.app",
  "es-AR": "ventas-ar@tulector.app",
  "pt-BR": "vendas-br@tulector.app",
  "es-CL": "ventas-cl@tulector.app",
};
