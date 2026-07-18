import type { DashboardLocale } from "@/locales";

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
  adminDivisionLabel: string;
  adminDivisionExample: string;
  adminDivisions: readonly string[];
  localityLabel: string;
  localityExample: string;
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
    adminDivisionLabel: "Región",
    adminDivisionExample: "Metropolitana",
    adminDivisions: [
      "Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo",
      "Valparaíso", "Metropolitana de Santiago", "Libertador Bernardo O'Higgins",
      "Maule", "Ñuble", "Biobío", "La Araucanía", "Los Ríos", "Los Lagos",
      "Aysén", "Magallanes y de la Antártica Chilena",
    ],
    localityLabel: "Comuna",
    localityExample: "Santiago",
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
    adminDivisionLabel: "Provincia",
    adminDivisionExample: "Buenos Aires",
    adminDivisions: [
      "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
      "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza",
      "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
      "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego",
      "Tucumán", "Ciudad Autónoma de Buenos Aires",
    ],
    localityLabel: "Localidad",
    localityExample: "La Plata",
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
    adminDivisionLabel: "Estado",
    adminDivisionExample: "São Paulo",
    adminDivisions: [
      "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará",
      "Distrito Federal", "Espírito Santo", "Goiás", "Maranhão",
      "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba",
      "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte",
      "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina",
      "São Paulo", "Sergipe", "Tocantins",
    ],
    localityLabel: "Cidade",
    localityExample: "São Paulo",
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
    adminDivisionLabel: "Departamento",
    adminDivisionExample: "Lima",
    adminDivisions: [
      "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca",
      "Callao", "Cusco", "Huancavelica", "Huánuco", "Ica", "Junín",
      "La Libertad", "Lambayeque", "Lima", "Loreto", "Madre de Dios",
      "Moquegua", "Pasco", "Piura", "Puno", "San Martín", "Tacna", "Tumbes",
      "Ucayali",
    ],
    localityLabel: "Provincia",
    localityExample: "Lima",
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
    adminDivisionLabel: "Departamento",
    adminDivisionExample: "Cundinamarca",
    adminDivisions: [
      "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bolívar", "Boyacá",
      "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba",
      "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira",
      "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo",
      "Quindío", "Risaralda", "San Andrés y Providencia", "Santander",
      "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada",
      "Bogotá D.C.",
    ],
    localityLabel: "Municipio",
    localityExample: "Bogotá",
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
    adminDivisionLabel: "Provincia",
    adminDivisionExample: "Pichincha",
    adminDivisions: [
      "Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi",
      "El Oro", "Esmeraldas", "Galápagos", "Guayas", "Imbabura", "Loja",
      "Los Ríos", "Manabí", "Morona Santiago", "Napo", "Orellana", "Pastaza",
      "Pichincha", "Santa Elena", "Santo Domingo de los Tsáchilas",
      "Sucumbíos", "Tungurahua", "Zamora Chinchipe",
    ],
    localityLabel: "Cantón",
    localityExample: "Quito",
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
    adminDivisionLabel: "Departamento",
    adminDivisionExample: "Montevideo",
    adminDivisions: [
      "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores",
      "Florida", "Lavalleja", "Maldonado", "Montevideo", "Paysandú",
      "Río Negro", "Rivera", "Rocha", "Salto", "San José", "Soriano",
      "Tacuarembó", "Treinta y Tres",
    ],
    localityLabel: "Localidad",
    localityExample: "Montevideo",
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
