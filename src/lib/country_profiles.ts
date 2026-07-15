import type { DashboardLocale } from "@/locales";
import {
  ID_BLOCK_CL, ID_BLOCK_AR, ID_BLOCK_BR, ID_BLOCK_PE, ID_BLOCK_CO, ID_BLOCK_EC, ID_BLOCK_UY,
  type IdBlockConfig,
} from "@/lib/sheet_layout";
import {
  ID_READ_CL, ID_READ_AR, ID_READ_BR, ID_READ_PE, ID_READ_CO, ID_READ_EC, ID_READ_UY,
  type IdReadConfig,
} from "@/lib/omr";

export type CountryCode = "CL" | "AR" | "BR" | "PE" | "CO" | "EC" | "UY";

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
  {
    code: "AR",
    enabled: true,
    flag: "🇦🇷",
    countryName: "Argentina",
    profileName: "Perfil Argentina",
    standardsLabel: "Estandar Argentina",
    locale: "es-CL",
    timezone: "America/Argentina/Buenos_Aires",
    studentIdLabel: "DNI",
    studentIdExample: "12.345.678",
    grading: {
      min: 1,
      max: 10,
      passing: 6,
      exigencia: 0.6,
      display: "Escala 1-10, aprobacion 6, exigencia 60%",
    },
    ministryFormat: "ar_aprender",
    evaluationSystems: ["Aprender", "ERCE", "PISA_REF", "FEPBA"],
    exportFormats: ["Aprender", "CSV colegio", "Excel resultados"],
    onboardingHelper: "Argentina queda activo para el colegio: DNI, escala 1-10, aprobacion 6 y exigencia 60%.",
    dashboardSummary: "Lector y reportes preparados para colegios argentinos: DNI, escala 1-10, simulacros para ingreso universitario y Aprender.",
  },
  {
    code: "BR",
    enabled: true,
    flag: "🇧🇷",
    countryName: "Brasil",
    profileName: "Perfil Brasil",
    standardsLabel: "Padrao Brasil",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    studentIdLabel: "CPF",
    studentIdExample: "123.456.789-00",
    grading: {
      min: 0,
      max: 10,
      passing: 6,
      exigencia: 0.6,
      display: "Escala 0-10, aprovacao 6.0, calculo linear",
    },
    ministryFormat: "br_enem",
    evaluationSystems: ["ENEM", "SAEB"],
    exportFormats: ["ENEM", "CSV escolar", "Excel resultados"],
    onboardingHelper: "Brasil ativado: CPF, escala 0-10, calculo linear, simulados ENEM e vestibulares.",
    dashboardSummary: "Leitor e relatorios para escolas e cursinhos brasileiros: CPF, escala 0-10, ENEM, vestibulares e exportacao.",
  },
  {
    code: "PE",
    enabled: true,
    flag: "🇵🇪",
    countryName: "Peru",
    profileName: "Perfil Peru",
    standardsLabel: "Estandar Peru",
    locale: "es-CL",
    timezone: "America/Lima",
    studentIdLabel: "DNI",
    studentIdExample: "12345678",
    grading: {
      min: 0,
      max: 20,
      passing: 11,
      exigencia: 0.55,
      display: "Escala 0-20, aprobacion 11, exigencia 55%",
    },
    ministryFormat: "pe_minedu",
    evaluationSystems: ["Admision_UNMSM", "Admision_UNI", "ENLA", "Nombramiento_Docente"],
    exportFormats: ["MINEDU", "CSV academico", "Excel resultados"],
    onboardingHelper: "Peru activado: DNI, escala 0-20, simulacros de admision universitaria y evaluaciones MINEDU.",
    dashboardSummary: "Lector y reportes para academias y colegios peruanos: DNI, escala 0-20, admision UNMSM/UNI y MINEDU.",
  },
  {
    code: "CO",
    enabled: true,
    flag: "🇨🇴",
    countryName: "Colombia",
    profileName: "Perfil Colombia",
    standardsLabel: "Estandar Colombia",
    locale: "es-CL",
    timezone: "America/Bogota",
    studentIdLabel: "CC / TI",
    studentIdExample: "1234567890",
    grading: {
      min: 0,
      max: 100,
      passing: 60,
      exigencia: 0.6,
      display: "Escala 0-100, aprobacion 60, exigencia 60%",
    },
    ministryFormat: "co_icfes",
    evaluationSystems: ["Saber", "Saber_Pro", "Concurso_Docente"],
    exportFormats: ["ICFES", "CSV escolar", "Excel resultados"],
    onboardingHelper: "Colombia activado: CC/TI, escala 0-100, simulacros Saber 11 y preICFES.",
    dashboardSummary: "Lector para colegios y preICFES colombianos: CC/TI, escala 0-100, ICFES Saber 11/Pro.",
  },
  {
    code: "EC",
    enabled: true,
    flag: "🇪🇨",
    countryName: "Ecuador",
    profileName: "Perfil Ecuador",
    standardsLabel: "Estandar Ecuador",
    locale: "es-CL",
    timezone: "America/Guayaquil",
    studentIdLabel: "Cedula",
    studentIdExample: "1712345678",
    grading: {
      min: 0,
      max: 10,
      passing: 7,
      exigencia: 0.7,
      display: "Escala 0-10, aprobacion 7, exigencia 70%",
    },
    ministryFormat: "ec_ineval",
    evaluationSystems: ["Transformar", "SER_Estudiante", "Quiero_Ser_Maestro"],
    exportFormats: ["INEVAL", "CSV escolar", "Excel resultados"],
    onboardingHelper: "Ecuador activado: Cedula, escala 0-10, aprobacion 7, preuniversitarios Transformar.",
    dashboardSummary: "Lector para colegios y preuniversitarios ecuatorianos: Cedula, escala 0-10, dolarizado (USD).",
  },
  {
    code: "UY",
    enabled: true,
    flag: "🇺🇾",
    countryName: "Uruguay",
    profileName: "Perfil Uruguay",
    standardsLabel: "Estandar Uruguay",
    locale: "es-CL",
    timezone: "America/Montevideo",
    studentIdLabel: "CI",
    studentIdExample: "1.234.567-8",
    grading: {
      min: 1,
      max: 12,
      passing: 6,
      exigencia: 0.5,
      display: "Escala 1-12, aprobacion 6, exigencia 50%",
    },
    ministryFormat: "uy_anep",
    evaluationSystems: ["Aristas"],
    exportFormats: ["Aristas", "CSV escolar", "Excel resultados"],
    onboardingHelper: "Uruguay activado: CI, escala 1-12, evaluaciones Aristas.",
    dashboardSummary: "Lector para colegios uruguayos: CI, escala 1-12, Aristas.",
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

// ─── Bloque de ID nacional del motor OMR, por pais ─────────────
// Une el perfil de producto (CountryProfile) con la geometria/checksum del
// motor (src/tulector/sheet_layout.ts + omr.ts, ya generalizados a 7 paises).
// Unico lugar donde "pais" se traduce a "que bloque de burbujas imprimir/leer"
// — asi /sheet, /scan y sheet_generator.ts comparten la misma fuente de verdad.
const ID_BLOCK_BY_COUNTRY: Record<CountryCode, IdBlockConfig> = {
  CL: ID_BLOCK_CL, AR: ID_BLOCK_AR, BR: ID_BLOCK_BR, PE: ID_BLOCK_PE, CO: ID_BLOCK_CO, EC: ID_BLOCK_EC, UY: ID_BLOCK_UY,
};

const ID_READ_BY_COUNTRY: Record<CountryCode, IdReadConfig> = {
  CL: ID_READ_CL, AR: ID_READ_AR, BR: ID_READ_BR, PE: ID_READ_PE, CO: ID_READ_CO, EC: ID_READ_EC, UY: ID_READ_UY,
};

export function resolveIdBlock(value?: string | null): IdBlockConfig {
  return ID_BLOCK_BY_COUNTRY[resolveCountryProfile(value).code];
}

export function resolveIdReadConfig(value?: string | null): IdReadConfig {
  return ID_READ_BY_COUNTRY[resolveCountryProfile(value).code];
}
