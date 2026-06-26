export const publicLocales = ["es", "pt", "en"] as const;

export type PublicLocale = (typeof publicLocales)[number];

export function resolvePublicLocale(value?: string | string[] | null): PublicLocale {
  const locale = Array.isArray(value) ? value[0] : value;
  return publicLocales.includes(locale as PublicLocale) ? (locale as PublicLocale) : "es";
}

export function localizedHref(href: string, locale: PublicLocale) {
  if (locale === "es") return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}lang=${locale}`;
}

export const localeLabels: Record<PublicLocale, string> = {
  es: "Chile / ES",
  pt: "Brasil / PT",
  en: "English",
};

export const publicCopy = {
  es: {
    nav: {
      scan: "Escanear",
      sheet: "Hoja",
      account: "Cuenta",
      login: "Entrar",
      register: "Crear cuenta",
    },
    home: {
      eyebrow: "Correccion de ensayos",
      title: "Lee. Corrige. Analiza.",
      body: "Una cuenta para administrar alumnos, ensayos, resultados y puntajes. Una app para leer hojas con camara.",
      actions: {
        register: "Crear cuenta",
        login: "Iniciar sesion",
        scan: "Probar lector",
      },
      stats: [
        { value: "OMR", label: "lector" },
        { value: "1.0-7.0", label: "notas" },
        { value: "LATAM", label: "listo" },
      ],
      exam: {
        name: "Ensayo Matematica M1",
        sync: "38 hojas sincronizadas",
        average: "prom.",
        alerts: "dudas",
        score: "puntaje",
      },
      workflow: ["Crear ensayos", "Imprimir hojas", "Escanear con app", "Exportar resultados"],
    },
    footer: {
      tagline: "Lectura de ensayos, correccion OMR y analisis academico para instituciones educativas.",
      product: "Producto",
      resources: "Recursos",
      company: "Empresa",
      legal: "Legal",
      dataProtection: "Proteccion de datos",
      securityLink: "Seguridad",
      language: "Mercado e idioma",
      contact: "contacto@tulector.cl",
      location: "Hecho para Chile. Preparado para Latinoamerica y Brasil.",
      columns: {
        product: [
          { href: "/scan", label: "Lector OMR" },
          { href: "/sheet", label: "Hojas imprimibles" },
          { href: "/dashboard", label: "Panel docente" },
          { href: "/logs", label: "Analisis de escaneos" },
        ],
        resources: [
          { href: "/support", label: "Soporte" },
          { href: "/security", label: "Seguridad" },
          { href: "/auth?mode=register", label: "Crear cuenta" },
        ],
        company: [
          { href: "/privacy", label: "Privacidad" },
          { href: "/terms", label: "Terminos" },
        ],
      },
      copyright: "Todos los derechos reservados.",
    },
  },
  pt: {
    nav: {
      scan: "Escanear",
      sheet: "Folha",
      account: "Conta",
      login: "Entrar",
      register: "Criar conta",
    },
    home: {
      eyebrow: "Correcao de simulados",
      title: "Leia. Corrija. Analise.",
      body: "Uma conta para administrar alunos, provas, resultados e notas. Um app para ler folhas pela camera.",
      actions: {
        register: "Criar conta",
        login: "Entrar",
        scan: "Testar leitor",
      },
      stats: [
        { value: "OMR", label: "leitor" },
        { value: "0-1000", label: "pontuacao" },
        { value: "LATAM", label: "pronto" },
      ],
      exam: {
        name: "Simulado Matematica",
        sync: "38 folhas sincronizadas",
        average: "media",
        alerts: "duvidas",
        score: "pontos",
      },
      workflow: ["Criar provas", "Imprimir folhas", "Escanear no app", "Exportar resultados"],
    },
    footer: {
      tagline: "Leitura de simulados, correcao OMR e analise academica para instituicoes educacionais.",
      product: "Produto",
      resources: "Recursos",
      company: "Empresa",
      legal: "Legal",
      dataProtection: "Protecao de dados",
      securityLink: "Seguranca",
      language: "Mercado e idioma",
      contact: "contato@tulector.com",
      location: "Nascido no Chile. Preparado para Brasil e America Latina.",
      columns: {
        product: [
          { href: "/scan", label: "Leitor OMR" },
          { href: "/sheet", label: "Folhas imprimiveis" },
          { href: "/dashboard", label: "Painel docente" },
          { href: "/logs", label: "Analise de leituras" },
        ],
        resources: [
          { href: "/support", label: "Suporte" },
          { href: "/security", label: "Seguranca" },
          { href: "/auth?mode=register", label: "Criar conta" },
        ],
        company: [
          { href: "/privacy", label: "Privacidade" },
          { href: "/terms", label: "Termos" },
        ],
      },
      copyright: "Todos os direitos reservados.",
    },
  },
  en: {
    nav: {
      scan: "Scan",
      sheet: "Sheet",
      account: "Account",
      login: "Sign in",
      register: "Create account",
    },
    home: {
      eyebrow: "Exam scoring",
      title: "Read. Score. Analyze.",
      body: "One account to manage students, exams, results and score conversions. One app to read printed answer sheets by camera.",
      actions: {
        register: "Create account",
        login: "Sign in",
        scan: "Try scanner",
      },
      stats: [
        { value: "OMR", label: "reader" },
        { value: "1.0-7.0", label: "grades" },
        { value: "LATAM", label: "ready" },
      ],
      exam: {
        name: "Math Practice Test",
        sync: "38 sheets synced",
        average: "avg.",
        alerts: "flags",
        score: "score",
      },
      workflow: ["Create exams", "Print sheets", "Scan with app", "Export results"],
    },
    footer: {
      tagline: "Exam reading, OMR scoring and academic analytics for education teams.",
      product: "Product",
      resources: "Resources",
      company: "Company",
      legal: "Legal",
      dataProtection: "Data protection",
      securityLink: "Security",
      language: "Market and language",
      contact: "contact@tulector.com",
      location: "Built for Chile. Ready for Latin America and Brazil.",
      columns: {
        product: [
          { href: "/scan", label: "OMR scanner" },
          { href: "/sheet", label: "Printable sheets" },
          { href: "/dashboard", label: "Teacher dashboard" },
          { href: "/logs", label: "Scan analytics" },
        ],
        resources: [
          { href: "/support", label: "Support" },
          { href: "/security", label: "Security" },
          { href: "/auth?mode=register", label: "Create account" },
        ],
        company: [
          { href: "/privacy", label: "Privacy" },
          { href: "/terms", label: "Terms" },
        ],
      },
      copyright: "All rights reserved.",
    },
  },
} as const;



