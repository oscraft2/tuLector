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
  es: "Chile - Espanol",
  pt: "Brasil - Portugues",
  en: "English",
};

export const publicCopy = {
  es: {
    nav: {
      product: "Producto",
      scan: "Escanear",
      sheet: "Hoja imprimible",
      account: "Cuenta",
      security: "Seguridad",
      support: "Soporte",
      login: "Entrar",
      register: "Crear cuenta",
      menu: "Abrir menu",
      close: "Cerrar menu",
      topbar: {
        region: "America Latina",
        claim: "Corrige ensayos, simulacros y pruebas en minutos",
        compactClaim: "Corrige pruebas en minutos",
      },
    },
    home: {
      eyebrow: "Correccion de ensayos",
      title: "Lee. Corrige. Analiza.",
      body: "Administra ensayos, hojas de respuesta y resultados academicos en un flujo simple para equipos docentes.",
      audience: "Para colegios, preuniversitarios y docentes LATAM",
      mobileLead: "Corrige hojas con camara y revisa resultados sin digitar.",
      badges: ["Ensayos PAES", "Simulacros", "Controles", "Diagnosticos"],
      actions: {
        workflow: "Ver como funciona",
        contact: "Recibir informacion",
        register: "Crear cuenta",
        login: "Iniciar sesion",
        scan: "Probar lector",
      },
      stats: [
        { value: "Camara", label: "lector" },
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
    },
    footer: {
      tagline: "Lectura de ensayos, correccion automatica y analisis academico para instituciones educativas.",
      product: "Producto",
      resources: "Recursos",
      account: "Cuenta",
      company: "Empresa",
      legal: "Legal",
      dataProtection: "Proteccion de datos",
      securityLink: "Seguridad",
      language: "Mercado e idioma",
      contactLabel: "Contacto comercial",
      contact: "contacto@tulector.cl",
      response: "Para pilotos, soporte institucional o implementaciones con equipos docentes.",
      location: "Hecho para Chile. Preparado para Latinoamerica y Brasil.",
      appStores: {
        title: "App movil proximamente",
        body: "Estamos preparando la experiencia movil para acompanarte en lectura y correccion en terreno.",
      },
      cta: {
        eyebrow: "Implementacion rapida",
        title: "Empieza con una hoja imprimible y el lector de respuestas.",
        body: "Crea una cuenta, genera tus hojas de respuesta y prueba el escaneo desde el navegador o la app movil.",
        primary: "Crear cuenta",
        secondary: "Probar lector",
      },
      newsletter: {
        eyebrow: "Recibe mas informacion",
        title: "Dejanos tus datos y te contactamos lo antes posible.",
        body: "Cuentanos donde escribirte para enviarte detalles de implementacion, pilotos institucionales y proximas mejoras de TuLector.",
        placeholder: "correo@colegio.cl",
        namePlaceholder: "Nombre",
        institutionPlaceholder: "Colegio o institucion",
        rutPlaceholder: "RUT institucion (opcional)",
        phonePlaceholder: "Telefono o WhatsApp (opcional)",
        countryPlaceholder: "Pais",
        button: "Solicitar contacto",
        loading: "Guardando...",
        success: "Solicitud recibida. Te contactaremos lo antes posible.",
        successTitle: "Solicitud recibida",
        successBody: "Un agente de TuLector revisara tu solicitud y te contactara lo antes posible.",
        trialTitle: "Tambien puedes empezar ahora",
        trialBody: "Crea una cuenta gratis y prueba la plataforma con hasta 100 lecturas mensuales.",
        trialBadge: "100 lecturas/mes",
        trialNote: "Ideal para validar el flujo con hojas reales antes de una implementacion institucional.",
        appsTitle: "Web y app movil",
        appsBody: "TuLector funciona desde el navegador y acompana la lectura en terreno con aplicacion movil.",
        primaryAction: "Crear cuenta gratis",
        error: "No pudimos registrar tu solicitud. Intenta nuevamente.",
        errorTitle: "No pudimos registrar la solicitud",
        consent: "Autorizo que TuLector me contacte sobre esta solicitud.",
        disclaimer: "Usaremos estos datos solo para responder tu solicitud sobre TuLector.",
        close: "Entendido",
      },      columns: {
        product: [
          { href: "/scan", label: "Lector de hojas" },
          { href: "/sheet", label: "Hojas imprimibles" },
          { href: "/dashboard", label: "Panel docente" },
          { href: "/logs", label: "Analisis de escaneos" },
        ],
        resources: [
          { href: "/support", label: "Soporte" },
          { href: "/security", label: "Seguridad" },
          { href: "/privacy", label: "Privacidad" },
          { href: "/data-request", label: "Solicitud de datos" },
        ],
        account: [
          { href: "/auth?mode=register", label: "Crear cuenta" },
          { href: "/auth", label: "Iniciar sesion" },
          { href: "/dashboard/billing", label: "Facturacion" },
        ],
        company: [
          { href: "/terms", label: "Terminos" },
          { href: "/privacy", label: "Privacidad" },
          { href: "/support", label: "Contacto" },
        ],
      },
      copyright: "Todos los derechos reservados.",
    },
  },
  pt: {
    nav: {
      product: "Produto",
      scan: "Escanear",
      sheet: "Folha imprimivel",
      account: "Conta",
      security: "Seguranca",
      support: "Suporte",
      login: "Entrar",
      register: "Criar conta",
      menu: "Abrir menu",
      close: "Fechar menu",
      topbar: {
        region: "America Latina",
        claim: "Corrija simulados e provas em minutos",
        compactClaim: "Corrija provas em minutos",
      },
    },
    home: {
      eyebrow: "Correcao de simulados",
      title: "Leia. Corrija. Analise.",
      body: "Administre simulados, folhas de resposta e resultados academicos em um fluxo simples para equipes docentes.",
      audience: "Para escolas, cursos preparatorios e professores LATAM",
      mobileLead: "Corrija folhas pela camera e revise resultados sem digitacao manual.",
      badges: ["Simulados", "Provas", "Controles", "Diagnosticos"],
      actions: {
        workflow: "Ver como funciona",
        contact: "Receber informacoes",
        register: "Criar conta",
        login: "Entrar",
        scan: "Testar leitor",
      },
      stats: [
        { value: "Camera", label: "leitor" },
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
    },
    footer: {
      tagline: "Leitura de simulados, correcao automatica e analise academica para instituicoes educacionais.",
      product: "Produto",
      resources: "Recursos",
      account: "Conta",
      company: "Empresa",
      legal: "Legal",
      dataProtection: "Protecao de dados",
      securityLink: "Seguranca",
      language: "Mercado e idioma",
      contactLabel: "Contato comercial",
      contact: "contato@tulector.com",
      response: "Para pilotos, suporte institucional ou implementacoes com equipes docentes.",
      location: "Nascido no Chile. Preparado para Brasil e America Latina.",
      appStores: {
        title: "App movel em breve",
        body: "Estamos preparando a experiencia movel para apoiar leitura e correcao em campo.",
      },
      cta: {
        eyebrow: "Implementacao rapida",
        title: "Comece com uma folha imprimivel e o leitor de respostas.",
        body: "Crie uma conta, gere suas folhas de resposta e teste o escaneamento pelo navegador ou app movel.",
        primary: "Criar conta",
        secondary: "Testar leitor",
      },
      newsletter: {
        eyebrow: "Receba mais informacoes",
        title: "Deixe seus dados e entraremos em contato o quanto antes.",
        body: "Informe onde podemos escrever para enviar detalhes de implementacao, pilotos institucionais e proximas melhorias do TuLector.",
        placeholder: "email@escola.com",
        namePlaceholder: "Nome",
        institutionPlaceholder: "Escola ou instituicao",
        rutPlaceholder: "Identificador institucional (opcional)",
        phonePlaceholder: "Telefone ou WhatsApp (opcional)",
        countryPlaceholder: "Pais",
        button: "Solicitar contato",
        loading: "Salvando...",
        success: "Solicitacao recebida. Entraremos em contato o quanto antes.",
        successTitle: "Solicitacao recebida",
        successBody: "Um agente do TuLector revisara sua solicitacao e entrara em contato o quanto antes.",
        trialTitle: "Voce tambem pode comecar agora",
        trialBody: "Crie uma conta gratis e teste a plataforma com ate 100 leituras mensais.",
        trialBadge: "100 leituras/mes",
        trialNote: "Ideal para validar o fluxo com folhas reais antes de uma implementacao institucional.",
        appsTitle: "Web e app movel",
        appsBody: "TuLector funciona no navegador e acompanha a leitura em campo com aplicativo movel.",
        primaryAction: "Criar conta gratis",
        error: "Nao foi possivel registrar a solicitacao. Tente novamente.",
        errorTitle: "Nao foi possivel registrar",
        consent: "Autorizo que TuLector entre em contato sobre esta solicitacao.",
        disclaimer: "Usaremos estes dados apenas para responder sua solicitacao sobre TuLector.",
        close: "Entendido",
      },      columns: {
        product: [
          { href: "/scan", label: "Leitor de folhas" },
          { href: "/sheet", label: "Folhas imprimiveis" },
          { href: "/dashboard", label: "Painel docente" },
          { href: "/logs", label: "Analise de leituras" },
        ],
        resources: [
          { href: "/support", label: "Suporte" },
          { href: "/security", label: "Seguranca" },
          { href: "/privacy", label: "Privacidade" },
          { href: "/data-request", label: "Solicitacao de dados" },
        ],
        account: [
          { href: "/auth?mode=register", label: "Criar conta" },
          { href: "/auth", label: "Entrar" },
          { href: "/dashboard/billing", label: "Faturamento" },
        ],
        company: [
          { href: "/terms", label: "Termos" },
          { href: "/privacy", label: "Privacidade" },
          { href: "/support", label: "Contato" },
        ],
      },
      copyright: "Todos os direitos reservados.",
    },
  },
  en: {
    nav: {
      product: "Product",
      scan: "Scan",
      sheet: "Printable sheet",
      account: "Account",
      security: "Security",
      support: "Support",
      login: "Sign in",
      register: "Create account",
      menu: "Open menu",
      close: "Close menu",
      topbar: {
        region: "America Latina",
        claim: "Score practice tests, mock exams and quizzes in minutes",
        compactClaim: "Score tests in minutes",
      },
    },
    home: {
      eyebrow: "Exam scoring",
      title: "Read. Score. Analyze.",
      body: "Manage assessments, answer sheets and academic results in a simple workflow for education teams.",
      audience: "For schools, test-prep teams and teachers in LATAM",
      mobileLead: "Score sheets by camera and review results without manual entry.",
      badges: ["Practice tests", "Mock exams", "Quizzes", "Diagnostics"],
      actions: {
        workflow: "See how it works",
        contact: "Get information",
        register: "Create account",
        login: "Sign in",
        scan: "Try scanner",
      },
      stats: [
        { value: "Camera", label: "reader" },
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
    },
    footer: {
      tagline: "Answer-sheet reading, automatic scoring and academic analytics for education teams.",
      product: "Product",
      resources: "Resources",
      account: "Account",
      company: "Company",
      legal: "Legal",
      dataProtection: "Data protection",
      securityLink: "Security",
      language: "Market and language",
      contactLabel: "Commercial contact",
      contact: "contact@tulector.com",
      response: "For pilots, institutional support or implementations with teaching teams.",
      location: "Built for Chile. Ready for Latin America and Brazil.",
      appStores: {
        title: "Mobile app coming soon",
        body: "We are preparing the mobile experience for field reading and scoring workflows.",
      },
      cta: {
        eyebrow: "Fast implementation",
        title: "Start with a printable sheet and the answer-sheet reader.",
        body: "Create an account, generate answer sheets and test scanning from the browser or mobile app.",
        primary: "Create account",
        secondary: "Try scanner",
      },
      newsletter: {
        eyebrow: "Get more information",
        title: "Leave your details and we will contact you as soon as possible.",
        body: "Tell us where to write so we can send implementation details, institutional pilot information and upcoming TuLector updates.",
        placeholder: "email@school.org",
        namePlaceholder: "Name",
        institutionPlaceholder: "School or institution",
        rutPlaceholder: "Institution ID (optional)",
        phonePlaceholder: "Phone or WhatsApp (optional)",
        countryPlaceholder: "Country",
        button: "Request contact",
        loading: "Saving...",
        success: "Request received. We will contact you as soon as possible.",
        successTitle: "Request received",
        successBody: "A TuLector agent will review your request and contact you as soon as possible.",
        trialTitle: "You can also start now",
        trialBody: "Create a free account and test the platform with up to 100 monthly readings.",
        trialBadge: "100 readings/month",
        trialNote: "Ideal to validate the workflow with real sheets before an institutional rollout.",
        appsTitle: "Web and mobile app",
        appsBody: "TuLector works from the browser and supports field reading with the mobile app.",
        primaryAction: "Create free account",
        error: "We could not register your request. Please try again.",
        errorTitle: "We could not register the request",
        consent: "I authorize TuLector to contact me about this request.",
        disclaimer: "We will use this data only to respond to your TuLector request.",
        close: "Got it",
      },      columns: {
        product: [
          { href: "/scan", label: "Sheet reader" },
          { href: "/sheet", label: "Printable sheets" },
          { href: "/dashboard", label: "Teacher dashboard" },
          { href: "/logs", label: "Scan analytics" },
        ],
        resources: [
          { href: "/support", label: "Support" },
          { href: "/security", label: "Security" },
          { href: "/privacy", label: "Privacy" },
          { href: "/data-request", label: "Data request" },
        ],
        account: [
          { href: "/auth?mode=register", label: "Create account" },
          { href: "/auth", label: "Sign in" },
          { href: "/dashboard/billing", label: "Billing" },
        ],
        company: [
          { href: "/terms", label: "Terms" },
          { href: "/privacy", label: "Privacy" },
          { href: "/support", label: "Contact" },
        ],
      },
      copyright: "All rights reserved.",
    },
  },
} as const;
















