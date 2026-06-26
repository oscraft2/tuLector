import type { DashboardLocale } from "@/locales";

export type CountryCode = "CL";

export type CountryProfile = {
  code: CountryCode;
  enabled: boolean;
  flag: string;
  countryName: string;
  profileName: string;
  standardsLabel: string;
  locale: DashboardLocale;
  timezone: string;
  studentIdLabel: string;
  studentIdExample: string;
  grading: {
    min: number;
    max: number;
    passing: number;
    exigencia: number;
    display: string;
  };
  ministryFormat: string;
  evaluationSystems: readonly string[];
  exportFormats: readonly string[];
  onboardingHelper: string;
  dashboardSummary: string;
};

export const countryProfiles: readonly CountryProfile[] = [
  {
    code: "CL",
    enabled: true,
    flag: "🇨🇱",
    countryName: "Chile",
    profileName: "Perfil Chile",
    standardsLabel: "Estandar Chile",
    locale: "es-CL",
    timezone: "America/Santiago",
    studentIdLabel: "RUT",
    studentIdExample: "12.345.678-9",
    grading: {
      min: 1,
      max: 7,
      passing: 4,
      exigencia: 0.6,
      display: "Escala 1.0-7.0, aprobacion 4.0, exigencia 60%",
    },
    ministryFormat: "cl_mineduc",
    evaluationSystems: ["SIMCE", "DIA"],
    exportFormats: ["Agencia de Calidad", "CSV colegio", "Excel resultados"],
    onboardingHelper: "Chile queda activo para el colegio: RUT, escala 1.0-7.0, aprobacion 4.0 y exigencia 60%.",
    dashboardSummary: "Lector y reportes preparados para colegios chilenos: RUT, escala 1.0-7.0, SIMCE/DIA y exportacion local.",
  },
] as const;

export function resolveCountryProfile(value?: string | null): CountryProfile {
  return countryProfiles.find((profile) => profile.code === value) ?? countryProfiles[0];
}

export function resolveLocaleForCountry(value?: string | null): DashboardLocale {
  return resolveCountryProfile(value).locale;
}

export function countryDefaults(value?: string | null) {
  const profile = resolveCountryProfile(value);
  return {
    grading_scale_min: profile.grading.min,
    grading_scale_max: profile.grading.max,
    passing_grade: profile.grading.passing,
    exigencia: profile.grading.exigencia,
    ministry_format: profile.ministryFormat,
  };
}
