import type { Locale } from "./config";

export interface Messages {
  nav: {
    product: string;
    scan: string;
    sheet: string;
    account: string;
    security: string;
    support: string;
    login: string;
    register: string;
    menu: string;
    close: string;
    topbar: {
      region: string;
      claim: string;
      compactClaim: string;
    };
    pricing: string;
    resources: string;
    whatsapp: string;
    whatsappMessage: string;
    productMenu: {
      title: string;
      scan: { label: string; desc: string };
      sheet: { label: string; desc: string };
      features: { label: string; desc: string };
      pricing: { label: string; desc: string };
      featured: { badge: string; title: string; body: string; cta: string };
    };
    solutionsMenu: {
      title: string;
      schools: { label: string; desc: string };
      teachers: { label: string; desc: string };
      prep: { label: string; desc: string };
    };
    region: { label: string };
    geoBanner: { text: string; cta: string; dismiss: string };
  };
  home: {
    eyebrow: string;
    title: string;
    body: string;
    audience: string;
    mobileLead: string;
    badges: string[];
    actions: {
      workflow: string;
      contact: string;
      register: string;
      login: string;
      scan: string;
    };
    stats: { value: string; label: string }[];
    exam: {
      name: string;
      sync: string;
      average: string;
      alerts: string;
      score: string;
    };
  };
  footer: {
    tagline: string;
    product: string;
    resources: string;
    account: string;
    company: string;
    legal: string;
    dataProtection: string;
    securityLink: string;
    language: string;
    contactLabel: string;
    contact: string;
    response: string;
    location: string;
    appStores: { title: string; body: string };
    cta: {
      eyebrow: string;
      title: string;
      body: string;
      primary: string;
      secondary: string;
    };
    newsletter: {
      eyebrow: string;
      title: string;
      body: string;
      placeholder: string;
      namePlaceholder: string;
      institutionPlaceholder: string;
      rutPlaceholder: string;
      phonePlaceholder: string;
      countryPlaceholder: string;
      button: string;
      loading: string;
      success: string;
      successTitle: string;
      successBody: string;
      trialTitle: string;
      trialBody: string;
      trialBadge: string;
      trialNote: string;
      appsTitle: string;
      appsBody: string;
      primaryAction: string;
      error: string;
      errorTitle: string;
      consent: string;
      disclaimer: string;
      close: string;
    };
    columns: {
      product: { href: string; label: string }[];
      resources: { href: string; label: string }[];
      account: { href: string; label: string }[];
      company: { href: string; label: string }[];
    };
    copyright: string;
  };
  areaServed: string[];
  knowsAbout: string[];
  nationalExam: string;
  govBody: string;
  currency: string;
  currencyName: string;
  idName: string;
  idPlaceholder: string;
  countryName: string;
  faqs: { q: string; a: string }[];
  plans: { name: string; description: string; price: number; currency: string }[];
  privacy: { title: string; description: string };
  terms: { title: string; description: string };
  support: { title: string; description: string };
  security: { title: string; description: string };
  dataRequest: { title: string; description: string };
  paraColegios: { title: string; description: string; h1: string };
  paraDocentes: { title: string; description: string; h1: string };
  paraPreuniversitarios: { title: string; description: string; h1: string };
  precios: { title: string; description: string };
  features: { title: string; description: string };
  recursos: { title: string; description: string };
}

export const messages: Record<Locale, Messages> = {
  "es-CL": {
    areaServed: ["CL"],
    knowsAbout: ["PAES", "SIMCE"],
    nationalExam: "PAES",
    govBody: "DEMRE / MINEDUC",
    currency: "CLP",
    currencyName: "Pesos chilenos",
    idName: "RUT",
    idPlaceholder: "RUT institucion (opcional)",
    countryName: "Chile",
    faqs: [
      { q: "Que es TuLector?", a: "TuLector es una plataforma de lectura optica con camara movil que corrige ensayos, simulacros y pruebas estandarizadas en Chile y Latinoamerica." },
      { q: "Como funciona el lector de hojas?", a: "Escanea hojas de respuesta con la camara del celular o navegador web. El sistema detecta automaticamente las marcas, las corrige segun la clave de respuestas y entrega resultados inmediatos." },
      { q: "Es compatible con la PAES?", a: "Si. TuLector soporta el formato de ensayos PAES y SIMCE. Puedes configurar la cantidad de preguntas, puntajes y escala de notas que necesites." },
      { q: "Cuantas hojas puedo escanear gratis?", a: "El plan gratis siempre esta disponible e incluye 100 lecturas mensuales. Los unicos planes pagados son Pro y School." },
      { q: "Funciona sin internet?", a: "La app movil permite escanear sin conexion y sincroniza los resultados cuando recuperas la señal." },
    ],
    plans: [
      { name: "Gratis", description: "100 lecturas mensuales, acceso web y movil, exportacion basica.", price: 0, currency: "CLP" },
      { name: "Pro", description: "2.000 lecturas anuales para docentes o equipos pequenos.", price: 19990, currency: "CLP" },
      { name: "School", description: "10.000 lecturas anuales, administracion de equipo y soporte institucional.", price: 99990, currency: "CLP" },
    ],
    privacy: { title: "Politica de Privacidad", description: "Como TuLector recopila, usa y protege tus datos personales y los de tus estudiantes en cumplimiento de la legislacion chilena." },
    terms: { title: "Terminos y Condiciones", description: "Condiciones de uso de la plataforma TuLector para instituciones educativas y usuarios en Chile." },
    support: { title: "Soporte", description: "Centro de ayuda y soporte tecnico de TuLector. Contacto para colegios y docentes en Chile." },
    security: { title: "Seguridad", description: "Practicas de seguridad, cifrado y proteccion de datos de TuLector para el mercado chileno." },
    dataRequest: { title: "Solicitud de Datos", description: "Solicita acceso, rectificacion o eliminacion de tus datos personales almacenados en TuLector." },
    paraColegios: { title: "TuLector para Colegios en Chile", description: "Plataforma de lectura optica y correccion de ensayos PAES y SIMCE para colegios chilenos.", h1: "Lectura optica y resultados academicos para colegios en Chile" },
    paraDocentes: { title: "TuLector para Docentes en Chile", description: "Corrige ensayos PAES y controles en minutos. Herramienta para docentes chilenos.", h1: "TuLector para docentes en Chile: corrige ensayos en 2 minutos" },
    paraPreuniversitarios: { title: "TuLector para Preuniversitarios en Chile", description: "Implementa TuLector en tu preuniversitario. Simulacros PAES con resultados inmediatos.", h1: "Implementa TuLector en tu preuniversitario en Chile" },
    precios: { title: "Precios", description: "Planes y precios de TuLector para colegios, preuniversitarios y docentes en Chile. Precios en CLP." },
    features: { title: "Funcionalidades", description: "Descubre todas las funcionalidades de TuLector: lector OMR, dashboard, exportacion y mas." },
    recursos: { title: "Recursos", description: "Articulos, guias y recursos sobre correccion de ensayos PAES, SIMCE y evaluacion educativa en Chile." },
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
      topbar: { region: "Chile", claim: "Corrige ensayos PAES, simulacros y pruebas en minutos", compactClaim: "Corrige pruebas PAES en minutos" },
      pricing: "Precios",
      resources: "Recursos",
      whatsapp: "WhatsApp",
      whatsappMessage: "Hola, quiero informacion sobre TuLector",
      productMenu: {
        title: "Producto",
        scan: { label: "Probar lector", desc: "Escanea hojas con la camara, gratis y sin instalar nada." },
        sheet: { label: "Hojas imprimibles", desc: "Genera tu hoja de respuestas y descargala en PDF." },
        features: { label: "Funcionalidades", desc: "Lector OMR, dashboard, exportacion y modo offline." },
        pricing: { label: "Precios", desc: "Planes desde $0. Valores en CLP." },
        featured: { badge: "Listo para PAES", title: "Simulacros con resultados en terreno", body: "Implementa TuLector en tu preuniversitario o colegio.", cta: "Ver soluciones" },
      },
      solutionsMenu: {
        title: "Soluciones",
        schools: { label: "Para colegios", desc: "Lectura optica y analisis para todo el establecimiento." },
        teachers: { label: "Para docentes", desc: "Corrige ensayos PAES y controles en 2 minutos." },
        prep: { label: "Para preuniversitarios", desc: "Simulacros PAES con resultados inmediatos." },
      },
      region: { label: "Mercado e idioma" },
      geoBanner: { text: "Parece que estas en {country}.", cta: "Ver la version para {country}", dismiss: "Cerrar aviso" },
    },
    home: {
      eyebrow: "Correccion de ensayos PAES",
      title: "Lee. Corrige. Analiza.",
      body: "Administra ensayos, hojas de respuesta y resultados academicos en un flujo simple para equipos docentes.",
      audience: "Para colegios, preuniversitarios y docentes en Chile",
      mobileLead: "Corrige hojas con camara y revisa resultados sin digitar.",
      badges: ["Ensayos PAES", "Simulacros", "Controles", "Diagnosticos"],
      actions: { workflow: "Ver como funciona", contact: "Recibir informacion", register: "Crear cuenta", login: "Iniciar sesion", scan: "Probar lector" },
      stats: [{ value: "Camara", label: "lector" }, { value: "1.0-7.0", label: "notas" }, { value: "CL", label: "listo" }],
      exam: { name: "Ensayo PAES Matematica M1", sync: "38 hojas sincronizadas", average: "prom.", alerts: "dudas", score: "puntaje" },
    },
    footer: {
      tagline: "Lectura de ensayos PAES, correccion automatica y analisis academico para instituciones educativas en Chile.",
      product: "Producto",
      resources: "Recursos",
      account: "Cuenta",
      company: "Empresa",
      legal: "Legal",
      dataProtection: "Proteccion de datos",
      securityLink: "Seguridad",
      language: "Mercado e idioma",
      contactLabel: "Contacto comercial",
      contact: "ventas-cl@tulector.app",
      response: "Para pilotos, soporte institucional o implementaciones con equipos docentes.",
      location: "Hecho para Chile. Preparado para Latinoamerica y Brasil.",
      appStores: { title: "App movil proximamente", body: "Estamos preparando la experiencia movil para acompanarte en lectura y correccion en terreno." },
      cta: { eyebrow: "Implementacion rapida", title: "Empieza con una hoja imprimible y el lector de respuestas.", body: "Crea una cuenta, genera tus hojas de respuesta y prueba el escaneo desde el navegador o la app movil.", primary: "Crear cuenta", secondary: "Probar lector" },
      newsletter: {
        eyebrow: "Recibe mas informacion", title: "Dejanos tus datos y te contactamos lo antes posible.",
        body: "Cuentanos donde escribirte para enviarte detalles de implementacion, pilotos institucionales y proximas mejoras de TuLector.",
        placeholder: "correo@colegio.cl", namePlaceholder: "Nombre", institutionPlaceholder: "Colegio o institucion",
        rutPlaceholder: "RUT institucion (opcional)", phonePlaceholder: "Telefono o WhatsApp (opcional)", countryPlaceholder: "Pais",
        button: "Solicitar contacto", loading: "Guardando...", success: "Solicitud recibida. Te contactaremos lo antes posible.",
        successTitle: "Solicitud recibida", successBody: "Un agente de TuLector revisara tu solicitud y te contactara lo antes posible.",
        trialTitle: "Tambien puedes empezar ahora", trialBody: "Crea una cuenta gratis y prueba la plataforma con hasta 100 lecturas mensuales.",
        trialBadge: "100 lecturas/mes", trialNote: "Ideal para validar el flujo con hojas reales antes de una implementacion institucional.",
        appsTitle: "Web y app movil", appsBody: "TuLector funciona desde el navegador y acompana la lectura en terreno con aplicacion movil.",
        primaryAction: "Crear cuenta", error: "No pudimos registrar tu solicitud. Intenta nuevamente.",
        errorTitle: "No pudimos registrar la solicitud", consent: "Autorizo que TuLector me contacte sobre esta solicitud.",
        disclaimer: "Usaremos estos datos solo para responder tu solicitud sobre TuLector.", close: "Entendido",
      },
      columns: {
        product: [
          { href: "/scan", label: "Lector de hojas" },
          { href: "/sheet", label: "Hojas imprimibles" },
          { href: "/features", label: "Caracteristicas" },
          { href: "/precios", label: "Precios" },
        ],
        resources: [
          { href: "/support", label: "Soporte" },
          { href: "/security", label: "Seguridad" },
          { href: "/privacy", label: "Privacidad" },
          { href: "/data-request", label: "Solicitud de datos" },
          { href: "/recursos", label: "Recursos" },
        ],
        account: [
          { href: "/auth?mode=register", label: "Crear cuenta" },
          { href: "/auth", label: "Iniciar sesion" },
          { href: "/precios", label: "Planes" },
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

  "es-MX": {
    areaServed: ["MX"],
    knowsAbout: ["EXANI-I", "EXANI-II", "COMIPEMS", "UNAM"],
    nationalExam: "EXANI",
    govBody: "CENEVAL",
    currency: "MXN",
    currencyName: "Pesos mexicanos",
    idName: "CURP",
    idPlaceholder: "CURP institucion (opcional)",
    countryName: "Mexico",
    faqs: [
      { q: "Que es TuLector?", a: "TuLector es una plataforma de lectura optica con camara movil que corrige examenes, simulacros y pruebas estandarizadas en Mexico y Latinoamerica." },
      { q: "Como funciona el lector de hojas?", a: "Escanea hojas de respuesta con la camara del celular o navegador web. El sistema detecta automaticamente las marcas, las corrige segun la clave de respuestas y entrega resultados inmediatos." },
      { q: "Es compatible con el EXANI del CENEVAL?", a: "Si. TuLector soporta el formato de examenes EXANI-I, EXANI-II, COMIPEMS y UNAM. Puedes configurar la cantidad de preguntas y escala que necesites." },
      { q: "Cuantas hojas puedo escanear gratis?", a: "El plan gratis siempre esta disponible e incluye 100 lecturas mensuales. Los unicos planes pagados son Pro y School." },
      { q: "Funciona sin internet?", a: "La app movil permite escanear sin conexion y sincroniza los resultados cuando recuperas la señal." },
    ],
    plans: [
      { name: "Gratis", description: "100 lecturas mensuales, acceso web y movil, exportacion basica.", price: 0, currency: "MXN" },
      { name: "Pro", description: "2.000 lecturas anuales para docentes o equipos pequenos.", price: 490, currency: "MXN" },
      { name: "School", description: "10.000 lecturas anuales, administracion de equipo y soporte institucional.", price: 2490, currency: "MXN" },
    ],
    privacy: { title: "Politica de Privacidad", description: "Como TuLector recopila, usa y protege tus datos personales y los de tus estudiantes en cumplimiento de la legislacion mexicana." },
    terms: { title: "Terminos y Condiciones", description: "Condiciones de uso de la plataforma TuLector para instituciones educativas y usuarios en Mexico." },
    support: { title: "Soporte", description: "Centro de ayuda y soporte tecnico de TuLector. Contacto para colegios y docentes en Mexico." },
    security: { title: "Seguridad", description: "Practicas de seguridad, cifrado y proteccion de datos de TuLector para el mercado mexicano." },
    dataRequest: { title: "Solicitud de Datos", description: "Solicita acceso, rectificacion o eliminacion de tus datos personales almacenados en TuLector." },
    paraColegios: { title: "TuLector para Colegios en Mexico", description: "Plataforma de lectura optica y correccion de examenes EXANI y COMIPEMS para colegios mexicanos.", h1: "Lectura optica y resultados academicos para colegios en Mexico" },
    paraDocentes: { title: "TuLector para Docentes en Mexico", description: "Corrige examenes EXANI y controles en minutos. Herramienta para docentes mexicanos.", h1: "TuLector para docentes en Mexico: corrige examenes en 2 minutos" },
    paraPreuniversitarios: { title: "TuLector para Preuniversitarios en Mexico", description: "Implementa TuLector en tu academia preuniversitaria. Simulacros EXANI con resultados inmediatos.", h1: "Implementa TuLector en tu academia preuniversitaria en Mexico" },
    precios: { title: "Precios", description: "Planes y precios de TuLector para colegios, preuniversitarios y docentes en Mexico. Precios en MXN." },
    features: { title: "Funcionalidades", description: "Descubre todas las funcionalidades de TuLector: lector OMR, dashboard, exportacion y mas." },
    recursos: { title: "Recursos", description: "Articulos, guias y recursos sobre correccion de examenes EXANI, COMIPEMS y evaluacion educativa en Mexico." },
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
      topbar: { region: "Mexico", claim: "Corrige examenes EXANI, simulacros y pruebas en minutos", compactClaim: "Corrige examenes EXANI en minutos" },
      pricing: "Precios",
      resources: "Recursos",
      whatsapp: "WhatsApp",
      whatsappMessage: "Hola, quiero informacion sobre TuLector",
      productMenu: {
        title: "Producto",
        scan: { label: "Probar lector", desc: "Escanea hojas con la camara, gratis y sin instalar nada." },
        sheet: { label: "Hojas imprimibles", desc: "Genera tu hoja de respuestas y descargala en PDF." },
        features: { label: "Funcionalidades", desc: "Lector OMR, dashboard, exportacion y modo offline." },
        pricing: { label: "Precios", desc: "Planes desde $0. Valores en MXN." },
        featured: { badge: "Listo para EXANI", title: "Simulacros con resultados en terreno", body: "Implementa TuLector en tu preuniversitario o colegio.", cta: "Ver soluciones" },
      },
      solutionsMenu: {
        title: "Soluciones",
        schools: { label: "Para colegios", desc: "Lectura optica y analisis para todo el establecimiento." },
        teachers: { label: "Para docentes", desc: "Corrige examenes EXANI y controles en 2 minutos." },
        prep: { label: "Para preuniversitarios", desc: "Simulacros EXANI con resultados inmediatos." },
      },
      region: { label: "Mercado e idioma" },
      geoBanner: { text: "Parece que estas en {country}.", cta: "Ver la version para {country}", dismiss: "Cerrar aviso" },
    },
    home: {
      eyebrow: "Correccion de examenes EXANI",
      title: "Lee. Corrige. Analiza.",
      body: "Administra examenes, hojas de respuesta y resultados academicos en un flujo simple para equipos docentes.",
      audience: "Para colegios, preuniversitarios y docentes en Mexico",
      mobileLead: "Corrige hojas con camara y revisa resultados sin digitar.",
      badges: ["EXANI-I", "EXANI-II", "COMIPEMS", "UNAM"],
      actions: { workflow: "Ver como funciona", contact: "Recibir informacion", register: "Crear cuenta", login: "Iniciar sesion", scan: "Probar lector" },
      stats: [{ value: "Camara", label: "lector" }, { value: "0-100", label: "aciertos" }, { value: "MX", label: "listo" }],
      exam: { name: "EXANI-II Matemáticas", sync: "38 hojas sincronizadas", average: "prom.", alerts: "dudas", score: "puntaje" },
    },
    footer: {
      tagline: "Lectura de examenes EXANI, correccion automatica y analisis academico para instituciones educativas en Mexico.",
      product: "Producto",
      resources: "Recursos",
      account: "Cuenta",
      company: "Empresa",
      legal: "Legal",
      dataProtection: "Proteccion de datos",
      securityLink: "Seguridad",
      language: "Mercado e idioma",
      contactLabel: "Contacto comercial",
      contact: "ventas-mx@tulector.app",
      response: "Para pilotos, soporte institucional o implementaciones con equipos docentes.",
      location: "Hecho para Mexico. Preparado para Latinoamerica y Brasil.",
      appStores: { title: "App movil proximamente", body: "Estamos preparando la experiencia movil para acompanarte en lectura y correccion en terreno." },
      cta: { eyebrow: "Implementacion rapida", title: "Empieza con una hoja imprimible y el lector de respuestas.", body: "Crea una cuenta, genera tus hojas de respuesta y prueba el escaneo desde el navegador o la app movil.", primary: "Crear cuenta", secondary: "Probar lector" },
      newsletter: {
        eyebrow: "Recibe mas informacion", title: "Dejanos tus datos y te contactamos lo antes posible.",
        body: "Cuentanos donde escribirte para enviarte detalles de implementacion, pilotos institucionales y proximas mejoras de TuLector.",
        placeholder: "correo@colegio.mx", namePlaceholder: "Nombre", institutionPlaceholder: "Colegio o institucion",
        rutPlaceholder: "CURP institucion (opcional)", phonePlaceholder: "Telefono o WhatsApp (opcional)", countryPlaceholder: "Pais",
        button: "Solicitar contacto", loading: "Guardando...", success: "Solicitud recibida. Te contactaremos lo antes posible.",
        successTitle: "Solicitud recibida", successBody: "Un agente de TuLector revisara tu solicitud y te contactara lo antes posible.",
        trialTitle: "Tambien puedes empezar ahora", trialBody: "Crea una cuenta gratis y prueba la plataforma con hasta 100 lecturas mensuales.",
        trialBadge: "100 lecturas/mes", trialNote: "Ideal para validar el flujo con hojas reales antes de una implementacion institucional.",
        appsTitle: "Web y app movil", appsBody: "TuLector funciona desde el navegador y acompana la lectura en terreno con aplicacion movil.",
        primaryAction: "Crear cuenta", error: "No pudimos registrar tu solicitud. Intenta nuevamente.",
        errorTitle: "No pudimos registrar la solicitud", consent: "Autorizo que TuLector me contacte sobre esta solicitud.",
        disclaimer: "Usaremos estos datos solo para responder tu solicitud sobre TuLector.", close: "Entendido",
      },
      columns: {
        product: [
          { href: "/scan", label: "Lector de hojas" },
          { href: "/sheet", label: "Hojas imprimibles" },
          { href: "/features", label: "Caracteristicas" },
          { href: "/precios", label: "Precios" },
        ],
        resources: [
          { href: "/support", label: "Soporte" },
          { href: "/security", label: "Seguridad" },
          { href: "/privacy", label: "Privacidad" },
          { href: "/data-request", label: "Solicitud de datos" },
          { href: "/recursos", label: "Recursos" },
        ],
        account: [
          { href: "/auth?mode=register", label: "Crear cuenta" },
          { href: "/auth", label: "Iniciar sesion" },
          { href: "/precios", label: "Planes" },
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

  "es-PE": {
    areaServed: ["PE"],
    knowsAbout: ["ECE", "ECFL", "Examen Admision UNI", "PUCP"],
    nationalExam: "ECE / Examen de Admision",
    govBody: "MINEDU",
    currency: "PEN",
    currencyName: "Soles",
    idName: "DNI",
    idPlaceholder: "DNI institucion (opcional)",
    countryName: "Peru",
    faqs: [
      { q: "Que es TuLector?", a: "TuLector es una plataforma de lectura optica con camara movil que corrige examenes, simulacros y pruebas estandarizadas en Peru y Latinoamerica." },
      { q: "Como funciona el lector de hojas?", a: "Escanea hojas de respuesta con la camara del celular o navegador web. El sistema detecta automaticamente las marcas, las corrige segun la clave de respuestas y entrega resultados inmediatos." },
      { q: "Es compatible con la ECE del MINEDU?", a: "Si. TuLector soporta el formato de examenes ECE, ECFL, Examen de Admision UNI y PUCP. Configura la cantidad de preguntas y escala que necesites." },
      { q: "Cuantas hojas puedo escanear gratis?", a: "El plan gratis siempre esta disponible e incluye 100 lecturas mensuales. Los unicos planes pagados son Pro y School." },
      { q: "Funciona sin internet?", a: "La app movil permite escanear sin conexion y sincroniza los resultados cuando recuperas la señal." },
    ],
    plans: [
      { name: "Gratis", description: "100 lecturas mensuales, acceso web y movil, exportacion basica.", price: 0, currency: "PEN" },
      { name: "Pro", description: "2.000 lecturas anuales para docentes o equipos pequenos.", price: 25, currency: "USD" },
      { name: "School", description: "10.000 lecturas anuales, administracion de equipo y soporte institucional.", price: 120, currency: "USD" },
    ],
    privacy: { title: "Politica de Privacidad", description: "Como TuLector recopila, usa y protege tus datos personales y los de tus estudiantes en cumplimiento de la legislacion peruana." },
    terms: { title: "Terminos y Condiciones", description: "Condiciones de uso de la plataforma TuLector para instituciones educativas y usuarios en Peru." },
    support: { title: "Soporte", description: "Centro de ayuda y soporte tecnico de TuLector. Contacto para colegios y docentes en Peru." },
    security: { title: "Seguridad", description: "Practicas de seguridad, cifrado y proteccion de datos de TuLector para el mercado peruano." },
    dataRequest: { title: "Solicitud de Datos", description: "Solicita acceso, rectificacion o eliminacion de tus datos personales almacenados en TuLector." },
    paraColegios: { title: "TuLector para Colegios en Peru", description: "Plataforma de lectura optica y correccion de examenes ECE y de admision para colegios peruanos.", h1: "Lectura optica y resultados academicos para colegios en Peru" },
    paraDocentes: { title: "TuLector para Docentes en Peru", description: "Corrige examenes ECE, controles y examenes de admision en minutos. Herramienta para docentes peruanos.", h1: "TuLector para docentes en Peru: corrige examenes en 2 minutos" },
    paraPreuniversitarios: { title: "TuLector para Preuniversitarios en Peru", description: "Implementa TuLector en tu academia preuniversitaria. Simulacros de admision UNI y PUCP con resultados inmediatos.", h1: "Implementa TuLector en tu academia preuniversitaria en Peru" },
    precios: { title: "Precios", description: "Planes y precios de TuLector para colegios, preuniversitarios y docentes en Peru. Precios en soles (PEN)." },
    features: { title: "Funcionalidades", description: "Descubre todas las funcionalidades de TuLector: lector OMR, dashboard, exportacion y mas." },
    recursos: { title: "Recursos", description: "Articulos, guias y recursos sobre correccion de examenes ECE, admision universitaria y evaluacion educativa en Peru." },
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
      topbar: { region: "Peru", claim: "Corrige examenes ECE, simulacros y pruebas en minutos", compactClaim: "Corrige examenes ECE en minutos" },
      pricing: "Precios",
      resources: "Recursos",
      whatsapp: "WhatsApp",
      whatsappMessage: "Hola, quiero informacion sobre TuLector",
      productMenu: {
        title: "Producto",
        scan: { label: "Probar lector", desc: "Escanea hojas con la camara, gratis y sin instalar nada." },
        sheet: { label: "Hojas imprimibles", desc: "Genera tu hoja de respuestas y descargala en PDF." },
        features: { label: "Funcionalidades", desc: "Lector OMR, dashboard, exportacion y modo offline." },
        pricing: { label: "Precios", desc: "Planes desde $0. Valores en USD." },
        featured: { badge: "Listo para ECE", title: "Simulacros con resultados en terreno", body: "Implementa TuLector en tu preuniversitario o colegio.", cta: "Ver soluciones" },
      },
      solutionsMenu: {
        title: "Soluciones",
        schools: { label: "Para colegios", desc: "Lectura optica y analisis para todo el establecimiento." },
        teachers: { label: "Para docentes", desc: "Corrige examenes ECE y controles en 2 minutos." },
        prep: { label: "Para preuniversitarios", desc: "Simulacros de admision con resultados inmediatos." },
      },
      region: { label: "Mercado e idioma" },
      geoBanner: { text: "Parece que estas en {country}.", cta: "Ver la version para {country}", dismiss: "Cerrar aviso" },
    },
    home: {
      eyebrow: "Correccion de examenes ECE y admision",
      title: "Lee. Corrige. Analiza.",
      body: "Administra examenes, hojas de respuesta y resultados academicos en un flujo simple para equipos docentes.",
      audience: "Para colegios, preuniversitarios y docentes en Peru",
      mobileLead: "Corrige hojas con camara y revisa resultados sin digitar.",
      badges: ["ECE", "Admision UNI", "Simulacros", "Diagnosticos"],
      actions: { workflow: "Ver como funciona", contact: "Recibir informacion", register: "Crear cuenta", login: "Iniciar sesion", scan: "Probar lector" },
      stats: [{ value: "Camara", label: "lector" }, { value: "0-20", label: "nota" }, { value: "PE", label: "listo" }],
      exam: { name: "Examen ECE Matematica", sync: "38 hojas sincronizadas", average: "prom.", alerts: "dudas", score: "puntaje" },
    },
    footer: {
      tagline: "Lectura de examenes ECE, correccion automatica y analisis academico para instituciones educativas en Peru.",
      product: "Producto",
      resources: "Recursos",
      account: "Cuenta",
      company: "Empresa",
      legal: "Legal",
      dataProtection: "Proteccion de datos",
      securityLink: "Seguridad",
      language: "Mercado e idioma",
      contactLabel: "Contacto comercial",
      contact: "ventas-pe@tulector.app",
      response: "Para pilotos, soporte institucional o implementaciones con equipos docentes.",
      location: "Hecho para Peru. Preparado para Latinoamerica y Brasil.",
      appStores: { title: "App movil proximamente", body: "Estamos preparando la experiencia movil para acompanarte en lectura y correccion en terreno." },
      cta: { eyebrow: "Implementacion rapida", title: "Empieza con una hoja imprimible y el lector de respuestas.", body: "Crea una cuenta, genera tus hojas de respuesta y prueba el escaneo desde el navegador o la app movil.", primary: "Crear cuenta", secondary: "Probar lector" },
      newsletter: {
        eyebrow: "Recibe mas informacion", title: "Dejanos tus datos y te contactamos lo antes posible.",
        body: "Cuentanos donde escribirte para enviarte detalles de implementacion, pilotos institucionales y proximas mejoras de TuLector.",
        placeholder: "correo@colegio.pe", namePlaceholder: "Nombre", institutionPlaceholder: "Colegio o institucion",
        rutPlaceholder: "DNI institucion (opcional)", phonePlaceholder: "Telefono o WhatsApp (opcional)", countryPlaceholder: "Pais",
        button: "Solicitar contacto", loading: "Guardando...", success: "Solicitud recibida. Te contactaremos lo antes posible.",
        successTitle: "Solicitud recibida", successBody: "Un agente de TuLector revisara tu solicitud y te contactara lo antes posible.",
        trialTitle: "Tambien puedes empezar ahora", trialBody: "Crea una cuenta gratis y prueba la plataforma con hasta 100 lecturas mensuales.",
        trialBadge: "100 lecturas/mes", trialNote: "Ideal para validar el flujo con hojas reales antes de una implementacion institucional.",
        appsTitle: "Web y app movil", appsBody: "TuLector funciona desde el navegador y acompana la lectura en terreno con aplicacion movil.",
        primaryAction: "Crear cuenta", error: "No pudimos registrar tu solicitud. Intenta nuevamente.",
        errorTitle: "No pudimos registrar la solicitud", consent: "Autorizo que TuLector me contacte sobre esta solicitud.",
        disclaimer: "Usaremos estos datos solo para responder tu solicitud sobre TuLector.", close: "Entendido",
      },
      columns: {
        product: [
          { href: "/scan", label: "Lector de hojas" },
          { href: "/sheet", label: "Hojas imprimibles" },
          { href: "/features", label: "Caracteristicas" },
          { href: "/precios", label: "Precios" },
        ],
        resources: [
          { href: "/support", label: "Soporte" },
          { href: "/security", label: "Seguridad" },
          { href: "/privacy", label: "Privacidad" },
          { href: "/data-request", label: "Solicitud de datos" },
          { href: "/recursos", label: "Recursos" },
        ],
        account: [
          { href: "/auth?mode=register", label: "Crear cuenta" },
          { href: "/auth", label: "Iniciar sesion" },
          { href: "/precios", label: "Planes" },
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

  "es-AR": {
    areaServed: ["AR"],
    knowsAbout: ["CBC UBA", "CPC", "Ingreso Universitario"],
    nationalExam: "CBC / Ingreso Universitario",
    govBody: "UBA / BCRA educ",
    currency: "ARS",
    currencyName: "Pesos argentinos",
    idName: "DNI",
    idPlaceholder: "DNI institucion (opcional)",
    countryName: "Argentina",
    faqs: [
      { q: "Que es TuLector?", a: "TuLector es una plataforma de lectura optica con camara movil que corrige examenes, simulacros y pruebas estandarizadas en Argentina y Latinoamerica." },
      { q: "Como funciona el lector de hojas?", a: "Escanea hojas de respuesta con la camara del celular o navegador web. El sistema detecta automaticamente las marcas, las corrige segun la clave de respuestas y entrega resultados inmediatos." },
      { q: "Es compatible con el CBC de la UBA?", a: "Si. TuLector soporta el formato de examenes CBC UBA, ingresos universitarios y CPC. Configura la cantidad de preguntas y escala que necesites." },
      { q: "Cuantas hojas puedo escanear gratis?", a: "El plan gratis siempre esta disponible e incluye 100 lecturas mensuales. Los unicos planes pagados son Pro y School." },
      { q: "Funciona sin internet?", a: "La app movil permite escanear sin conexion y sincroniza los resultados cuando recuperas la señal." },
    ],
    plans: [
      { name: "Gratis", description: "100 lecturas mensuales, acceso web y movil, exportacion basica.", price: 0, currency: "ARS" },
      { name: "Pro", description: "2.000 lecturas anuales para docentes o equipos pequenos.", price: 25, currency: "USD" },
      { name: "School", description: "10.000 lecturas anuales, administracion de equipo y soporte institucional.", price: 120, currency: "USD" },
    ],
    privacy: { title: "Politica de Privacidad", description: "Como TuLector recopila, usa y protege tus datos personales y los de tus estudiantes en cumplimiento de la legislacion argentina." },
    terms: { title: "Terminos y Condiciones", description: "Condiciones de uso de la plataforma TuLector para instituciones educativas y usuarios en Argentina." },
    support: { title: "Soporte", description: "Centro de ayuda y soporte tecnico de TuLector. Contacto para colegios y docentes en Argentina." },
    security: { title: "Seguridad", description: "Practicas de seguridad, cifrado y proteccion de datos de TuLector para el mercado argentino." },
    dataRequest: { title: "Solicitud de Datos", description: "Solicita acceso, rectificacion o eliminacion de tus datos personales almacenados en TuLector." },
    paraColegios: { title: "TuLector para Colegios en Argentina", description: "Plataforma de lectura optica y correccion de examenes CBC y de ingreso para colegios argentinos.", h1: "Lectura optica y resultados academicos para colegios en Argentina" },
    paraDocentes: { title: "TuLector para Docentes en Argentina", description: "Corrige examenes CBC, controles e ingresos universitarios en minutos. Herramienta para docentes argentinos.", h1: "TuLector para docentes en Argentina: corrige examenes en 2 minutos" },
    paraPreuniversitarios: { title: "TuLector para Preuniversitarios en Argentina", description: "Implementa TuLector en tu academia preuniversitaria. Simulacros CBC UBA con resultados inmediatos.", h1: "Implementa TuLector en tu academia preuniversitaria en Argentina" },
    precios: { title: "Precios", description: "Planes y precios de TuLector para colegios, preuniversitarios y docentes en Argentina. Precios en ARS." },
    features: { title: "Funcionalidades", description: "Descubre todas las funcionalidades de TuLector: lector OMR, dashboard, exportacion y mas." },
    recursos: { title: "Recursos", description: "Articulos, guias y recursos sobre correccion de examenes CBC, ingreso universitario y evaluacion educativa en Argentina." },
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
      topbar: { region: "Argentina", claim: "Corrige examenes CBC, simulacros y pruebas en minutos", compactClaim: "Corrige examenes CBC en minutos" },
      pricing: "Precios",
      resources: "Recursos",
      whatsapp: "WhatsApp",
      whatsappMessage: "Hola, quiero informacion sobre TuLector",
      productMenu: {
        title: "Producto",
        scan: { label: "Probar lector", desc: "Escanea hojas con la camara, gratis y sin instalar nada." },
        sheet: { label: "Hojas imprimibles", desc: "Genera tu hoja de respuestas y descargala en PDF." },
        features: { label: "Funcionalidades", desc: "Lector OMR, dashboard, exportacion y modo offline." },
        pricing: { label: "Precios", desc: "Planes desde $0. Valores en USD." },
        featured: { badge: "Listo para el CBC", title: "Simulacros con resultados en terreno", body: "Implementa TuLector en tu preuniversitario o colegio.", cta: "Ver soluciones" },
      },
      solutionsMenu: {
        title: "Soluciones",
        schools: { label: "Para colegios", desc: "Lectura optica y analisis para todo el establecimiento." },
        teachers: { label: "Para docentes", desc: "Corrige examenes CBC y controles en 2 minutos." },
        prep: { label: "Para preuniversitarios", desc: "Simulacros CBC UBA con resultados inmediatos." },
      },
      region: { label: "Mercado e idioma" },
      geoBanner: { text: "Parece que estas en {country}.", cta: "Ver la version para {country}", dismiss: "Cerrar aviso" },
    },
    home: {
      eyebrow: "Correccion de examenes CBC e ingreso",
      title: "Lee. Corrige. Analiza.",
      body: "Administra examenes, hojas de respuesta y resultados academicos en un flujo simple para equipos docentes.",
      audience: "Para colegios, preuniversitarios y docentes en Argentina",
      mobileLead: "Corrige hojas con camara y revisa resultados sin digitar.",
      badges: ["CBC UBA", "Ingresos", "Simulacros", "Diagnosticos"],
      actions: { workflow: "Ver como funciona", contact: "Recibir informacion", register: "Crear cuenta", login: "Iniciar sesion", scan: "Probar lector" },
      stats: [{ value: "Camara", label: "lector" }, { value: "1-10", label: "notas" }, { value: "AR", label: "listo" }],
      exam: { name: "CBC Matematica", sync: "38 hojas sincronizadas", average: "prom.", alerts: "dudas", score: "puntaje" },
    },
    footer: {
      tagline: "Lectura de examenes CBC, correccion automatica y analisis academico para instituciones educativas en Argentina.",
      product: "Producto",
      resources: "Recursos",
      account: "Cuenta",
      company: "Empresa",
      legal: "Legal",
      dataProtection: "Proteccion de datos",
      securityLink: "Seguridad",
      language: "Mercado e idioma",
      contactLabel: "Contacto comercial",
      contact: "ventas-ar@tulector.app",
      response: "Para pilotos, soporte institucional o implementaciones con equipos docentes.",
      location: "Hecho para Argentina. Preparado para Latinoamerica y Brasil.",
      appStores: { title: "App movil proximamente", body: "Estamos preparando la experiencia movil para acompanarte en lectura y correccion en terreno." },
      cta: { eyebrow: "Implementacion rapida", title: "Empieza con una hoja imprimible y el lector de respuestas.", body: "Crea una cuenta, genera tus hojas de respuesta y prueba el escaneo desde el navegador o la app movil.", primary: "Crear cuenta", secondary: "Probar lector" },
      newsletter: {
        eyebrow: "Recibe mas informacion", title: "Dejanos tus datos y te contactamos lo antes posible.",
        body: "Cuentanos donde escribirte para enviarte detalles de implementacion, pilotos institucionales y proximas mejoras de TuLector.",
        placeholder: "correo@colegio.ar", namePlaceholder: "Nombre", institutionPlaceholder: "Colegio o institucion",
        rutPlaceholder: "DNI institucion (opcional)", phonePlaceholder: "Telefono o WhatsApp (opcional)", countryPlaceholder: "Pais",
        button: "Solicitar contacto", loading: "Guardando...", success: "Solicitud recibida. Te contactaremos lo antes posible.",
        successTitle: "Solicitud recibida", successBody: "Un agente de TuLector revisara tu solicitud y te contactara lo antes posible.",
        trialTitle: "Tambien puedes empezar ahora", trialBody: "Crea una cuenta gratis y prueba la plataforma con hasta 100 lecturas mensuales.",
        trialBadge: "100 lecturas/mes", trialNote: "Ideal para validar el flujo con hojas reales antes de una implementacion institucional.",
        appsTitle: "Web y app movil", appsBody: "TuLector funciona desde el navegador y acompana la lectura en terreno con aplicacion movil.",
        primaryAction: "Crear cuenta", error: "No pudimos registrar tu solicitud. Intenta nuevamente.",
        errorTitle: "No pudimos registrar la solicitud", consent: "Autorizo que TuLector me contacte sobre esta solicitud.",
        disclaimer: "Usaremos estos datos solo para responder tu solicitud sobre TuLector.", close: "Entendido",
      },
      columns: {
        product: [
          { href: "/scan", label: "Lector de hojas" },
          { href: "/sheet", label: "Hojas imprimibles" },
          { href: "/features", label: "Caracteristicas" },
          { href: "/precios", label: "Precios" },
        ],
        resources: [
          { href: "/support", label: "Soporte" },
          { href: "/security", label: "Seguridad" },
          { href: "/privacy", label: "Privacidad" },
          { href: "/data-request", label: "Solicitud de datos" },
          { href: "/recursos", label: "Recursos" },
        ],
        account: [
          { href: "/auth?mode=register", label: "Crear cuenta" },
          { href: "/auth", label: "Iniciar sesion" },
          { href: "/precios", label: "Planes" },
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

  "pt-BR": {
    areaServed: ["BR"],
    knowsAbout: ["ENEM", "FUVEST", "UNICAMP", "Vestibular"],
    nationalExam: "ENEM",
    govBody: "INEP",
    currency: "BRL",
    currencyName: "Reais",
    idName: "CPF",
    idPlaceholder: "CPF instituicao (opcional)",
    countryName: "Brasil",
    faqs: [
      { q: "O que e TuLector?", a: "TuLector e uma plataforma de leitura otica com camera movel que corrige simulados, vestibulares e provas padronizadas no Brasil e America Latina." },
      { q: "Como funciona o leitor de folhas?", a: "Escaneia folhas de resposta com a camera do celular ou navegador web. O sistema detecta automaticamente as marcacoes, corrige conforme o gabarito e entrega resultados imediatos." },
      { q: "E compativel com o ENEM e FUVEST?", a: "Sim. O TuLector suporta o formato de provas ENEM, FUVEST, UNICAMP e vestibulares. Configure a quantidade de questoes e a escala de notas que precisar." },
      { q: "Quantas folhas posso escanear gratis?", a: "O plano gratuito sempre esta disponivel e inclui 100 leituras mensais. Os unicos planos pagos sao Pro e School." },
      { q: "Funciona sem internet?", a: "O app movel permite escanear sem conexao e sincroniza os resultados quando voce recupera o sinal." },
    ],
    plans: [
      { name: "Gratuito", description: "100 leituras mensais, acesso web e movel, exportacao basica.", price: 0, currency: "BRL" },
      { name: "Pro", description: "2.000 leituras anuais para professores ou equipes pequenas.", price: 149, currency: "BRL" },
      { name: "School", description: "10.000 leituras anuais, administracao de equipe e suporte institucional.", price: 749, currency: "BRL" },
    ],
    privacy: { title: "Politica de Privacidade", description: "Como o TuLector coleta, usa e protege seus dados pessoais e os de seus alunos em conformidade com a LGPD." },
    terms: { title: "Termos e Condicoes", description: "Condicoes de uso da plataforma TuLector para instituicoes educacionais e usuarios no Brasil." },
    support: { title: "Suporte", description: "Central de ajuda e suporte tecnico do TuLector. Contato para escolas e professores no Brasil." },
    security: { title: "Seguranca", description: "Praticas de seguranca, criptografia e protecao de dados do TuLector para o mercado brasileiro." },
    dataRequest: { title: "Solicitacao de Dados", description: "Solicite acesso, retificacao ou exclusao dos seus dados pessoais armazenados no TuLector." },
    paraColegios: { title: "TuLector para Escolas no Brasil", description: "Plataforma de leitura otica e correcao de simulados ENEM e vestibulares para escolas brasileiras.", h1: "Leitura otica e resultados academicos para escolas no Brasil" },
    paraDocentes: { title: "TuLector para Professores no Brasil", description: "Corrija simulados ENEM, FUVEST e provas em minutos. Ferramenta para professores brasileiros.", h1: "TuLector para professores no Brasil: corrija simulados em 2 minutos" },
    paraPreuniversitarios: { title: "TuLector para Cursinhos no Brasil", description: "Implemente o TuLector no seu cursinho pre-vestibular. Simulados ENEM com resultados imediatos.", h1: "Implemente o TuLector no seu cursinho pre-vestibular no Brasil" },
    precios: { title: "Precos", description: "Planos e precos do TuLector para escolas, cursinhos e professores no Brasil. Precos em reais (BRL)." },
    features: { title: "Funcionalidades", description: "Descubra todas as funcionalidades do TuLector: leitor OMR, dashboard, exportacao e mais." },
    recursos: { title: "Recursos", description: "Artigos, guias e recursos sobre correcao de simulados ENEM, FUVEST e avaliacao educacional no Brasil." },
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
      topbar: { region: "Brasil", claim: "Corrija simulados ENEM, vestibulares e provas em minutos", compactClaim: "Corrija simulados ENEM em minutos" },
      pricing: "Precos",
      resources: "Recursos",
      whatsapp: "WhatsApp",
      whatsappMessage: "Ola, quero informacoes sobre o TuLector",
      productMenu: {
        title: "Produto",
        scan: { label: "Testar leitor", desc: "Escaneie folhas com a camera, gratis e sem instalar nada." },
        sheet: { label: "Folhas imprimiveis", desc: "Gere sua folha de respostas e baixe em PDF." },
        features: { label: "Funcionalidades", desc: "Leitor OMR, dashboard, exportacao e modo offline." },
        pricing: { label: "Precos", desc: "Planos a partir de R$ 0. Valores em reais." },
        featured: { badge: "Pronto para o ENEM", title: "Simulados com resultados em campo", body: "Implemente o TuLector no seu cursinho ou escola.", cta: "Ver solucoes" },
      },
      solutionsMenu: {
        title: "Solucoes",
        schools: { label: "Para escolas", desc: "Leitura otica e analise para toda a instituicao." },
        teachers: { label: "Para professores", desc: "Corrija simulados ENEM e provas em 2 minutos." },
        prep: { label: "Para cursinhos", desc: "Simulados ENEM com resultados imediatos." },
      },
      region: { label: "Mercado e idioma" },
      geoBanner: { text: "Parece que voce esta em {country}.", cta: "Ver a versao para {country}", dismiss: "Fechar aviso" },
    },
    home: {
      eyebrow: "Correcao de simulados ENEM",
      title: "Leia. Corrija. Analise.",
      body: "Administre simulados, folhas de resposta e resultados academicos em um fluxo simples para equipes docentes.",
      audience: "Para escolas, cursinhos e professores no Brasil",
      mobileLead: "Corrija folhas pela camera e revise resultados sem digitacao manual.",
      badges: ["ENEM", "FUVEST", "Vestibular", "Diagnosticos"],
      actions: { workflow: "Ver como funciona", contact: "Receber informacoes", register: "Criar conta", login: "Entrar", scan: "Testar leitor" },
      stats: [{ value: "Camera", label: "leitor" }, { value: "0-1000", label: "pontuacao" }, { value: "BR", label: "pronto" }],
      exam: { name: "Simulado ENEM Matematica", sync: "38 folhas sincronizadas", average: "media", alerts: "duvidas", score: "pontos" },
    },
    footer: {
      tagline: "Leitura de simulados ENEM, correcao automatica e analise academica para instituicoes educacionais no Brasil.",
      product: "Produto",
      resources: "Recursos",
      account: "Conta",
      company: "Empresa",
      legal: "Legal",
      dataProtection: "Protecao de dados",
      securityLink: "Seguranca",
      language: "Mercado e idioma",
      contactLabel: "Contato comercial",
      contact: "vendas-br@tulector.app",
      response: "Para pilotos, suporte institucional ou implementacoes com equipes docentes.",
      location: "Feito para o Brasil. Preparado para America Latina.",
      appStores: { title: "App movel em breve", body: "Estamos preparando a experiencia movel para apoiar leitura e correcao em campo." },
      cta: { eyebrow: "Implementacao rapida", title: "Comece com uma folha imprimivel e o leitor de respostas.", body: "Crie uma conta, gere suas folhas de resposta e teste o escaneamento pelo navegador ou app movel.", primary: "Criar conta", secondary: "Testar leitor" },
      newsletter: {
        eyebrow: "Receba mais informacoes", title: "Deixe seus dados e entraremos em contato o quanto antes.",
        body: "Informe onde podemos escrever para enviar detalhes de implementacao, pilotos institucionais e proximas melhorias do TuLector.",
        placeholder: "email@escola.com.br", namePlaceholder: "Nome", institutionPlaceholder: "Escola ou instituicao",
        rutPlaceholder: "CPF instituicao (opcional)", phonePlaceholder: "Telefone ou WhatsApp (opcional)", countryPlaceholder: "Pais",
        button: "Solicitar contato", loading: "Salvando...", success: "Solicitacao recebida. Entraremos em contato o quanto antes.",
        successTitle: "Solicitacao recebida", successBody: "Um agente do TuLector revisara sua solicitacao e entrara em contato o quanto antes.",
        trialTitle: "Voce tambem pode comecar agora", trialBody: "Crie uma conta gratis e teste a plataforma com ate 100 leituras mensais.",
        trialBadge: "100 leituras/mes", trialNote: "Ideal para validar o fluxo com folhas reais antes de uma implementacao institucional.",
        appsTitle: "Web e app movel", appsBody: "TuLector funciona no navegador e acompanha a leitura em campo com aplicativo movel.",
        primaryAction: "Criar conta", error: "Nao foi possivel registrar a solicitacao. Tente novamente.",
        errorTitle: "Nao foi possivel registrar", consent: "Autorizo que TuLector entre em contato sobre esta solicitacao.",
        disclaimer: "Usaremos estes dados apenas para responder sua solicitacao sobre TuLector.", close: "Entendido",
      },
      columns: {
        product: [
          { href: "/scan", label: "Leitor de folhas" },
          { href: "/sheet", label: "Folhas imprimiveis" },
          { href: "/features", label: "Funcionalidades" },
          { href: "/precios", label: "Precos" },
        ],
        resources: [
          { href: "/support", label: "Suporte" },
          { href: "/security", label: "Seguranca" },
          { href: "/privacy", label: "Privacidade" },
          { href: "/data-request", label: "Solicitacao de dados" },
          { href: "/recursos", label: "Recursos" },
        ],
        account: [
          { href: "/auth?mode=register", label: "Criar conta" },
          { href: "/auth", label: "Entrar" },
          { href: "/precios", label: "Planos" },
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
};
