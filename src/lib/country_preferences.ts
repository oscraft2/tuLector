import type { DashboardLocale } from "@/locales";

export type CountryCode = "CL" | "BR" | "US";

export type CountryPreference = {
  code: CountryCode;
  flag: string;
  name: string;
  standardsLabel: string;
  locale: DashboardLocale;
  helper: string;
};

export const countryPreferences: readonly CountryPreference[] = [
  {
    code: "CL",
    flag: "🇨🇱",
    name: "Chile",
    standardsLabel: "Estandar Chile",
    locale: "es-CL",
    helper: "Resultados y escalas preparados para Chile: escala 1.0-7.0, RUT y exigencia 60%.",
  },
  {
    code: "BR",
    flag: "🇧🇷",
    name: "Brasil",
    standardsLabel: "Estandar Brasil",
    locale: "pt-BR",
    helper: "Resultados y escalas preparados para Brasil: escala 0-10 y configuracion local.",
  },
  {
    code: "US",
    flag: "🌐",
    name: "Internacional",
    standardsLabel: "Estandar general",
    locale: "en",
    helper: "Resultados y escalas preparados para uso internacional: escala 0-100 y configuracion generica.",
  },
] as const;

export function resolveCountryPreference(value?: string | null): CountryPreference {
  return countryPreferences.find((country) => country.code === value) ?? countryPreferences[0];
}

export function resolveLocaleForCountry(value?: string | null): DashboardLocale {
  return resolveCountryPreference(value).locale;
}

export function countryDefaults(value?: string | null) {
  const country = resolveCountryPreference(value);
  if (country.code === "BR") {
    return {
      grading_scale_min: 0,
      grading_scale_max: 10,
      passing_grade: 6,
      exigencia: 0.6,
      ministry_format: "br_generic",
    };
  }
  if (country.code === "US") {
    return {
      grading_scale_min: 0,
      grading_scale_max: 100,
      passing_grade: 60,
      exigencia: 0.6,
      ministry_format: "generic",
    };
  }
  return {
    grading_scale_min: 1,
    grading_scale_max: 7,
    passing_grade: 4,
    exigencia: 0.6,
    ministry_format: "cl_mineduc",
  };
}
