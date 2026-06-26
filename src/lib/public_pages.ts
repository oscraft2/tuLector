import type { PublicLocale } from "@/lib/public_i18n";

export type PublicPageKey = "privacy" | "terms" | "security" | "support";

type PublicPageContent = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: readonly { title: string; body: string }[];
};

export const publicPages: Record<PublicPageKey, Record<PublicLocale, PublicPageContent>> = {
  privacy: {
    es: {
      eyebrow: "Privacidad",
      title: "Datos educativos tratados con criterio institucional.",
      intro: "TuLector debe operar con cuentas, permisos por usuario y almacenamiento separado para imagenes de escaneo antes de produccion.",
      sections: [
        { title: "Datos", body: "La plataforma considera alumnos, cursos, ensayos, respuestas, resultados y trazas tecnicas de lectura." },
        { title: "Menores", body: "El tratamiento de datos de estudiantes requiere controles de acceso, minimizacion y acuerdos con cada institucion." },
        { title: "Proximo paso", body: "Mover fotos a Storage privado, quitar base64 de JSONB y aplicar RLS por usuario e institucion." },
      ],
    },
    pt: {
      eyebrow: "Privacidade",
      title: "Dados educacionais tratados com criterio institucional.",
      intro: "TuLector deve operar com contas, permissoes por usuario e armazenamento separado para imagens de leitura antes da producao.",
      sections: [
        { title: "Dados", body: "A plataforma considera alunos, turmas, provas, respostas, resultados e rastros tecnicos de leitura." },
        { title: "Estudantes", body: "O tratamento de dados de estudantes requer controle de acesso, minimizacao e acordos com cada instituicao." },
        { title: "Proximo passo", body: "Mover fotos para Storage privado, remover base64 do JSONB e aplicar RLS por usuario e instituicao." },
      ],
    },
    en: {
      eyebrow: "Privacy",
      title: "Education data handled with institutional controls.",
      intro: "TuLector must run with accounts, user permissions and separate scan image storage before production.",
      sections: [
        { title: "Data", body: "The platform handles students, classes, exams, answers, results and technical scan traces." },
        { title: "Students", body: "Student data requires access control, minimization and agreements with each institution." },
        { title: "Next step", body: "Move photos to private Storage, remove base64 from JSONB and enforce RLS by user and institution." },
      ],
    },
  },
  terms: {
    es: {
      eyebrow: "Terminos",
      title: "Condiciones de uso para una herramienta de correccion academica.",
      intro: "Estas condiciones son una base de producto. Deben ser revisadas legalmente antes de abrir cuentas reales.",
      sections: [
        { title: "Uso permitido", body: "TuLector esta pensado para docentes e instituciones que corrigen ensayos y pruebas objetivas." },
        { title: "Resultados", body: "Los puntajes y notas deben ser verificables; el docente conserva responsabilidad sobre decisiones academicas." },
        { title: "Disponibilidad", body: "La app movil y el motor OMR deben estabilizarse antes de comprometer niveles de servicio." },
      ],
    },
    pt: {
      eyebrow: "Termos",
      title: "Condicoes de uso para uma ferramenta de correcao academica.",
      intro: "Estas condicoes sao uma base de produto. Devem ser revisadas juridicamente antes de abrir contas reais.",
      sections: [
        { title: "Uso permitido", body: "TuLector foi pensado para professores e instituicoes que corrigem simulados e provas objetivas." },
        { title: "Resultados", body: "Pontuacoes e notas devem ser verificaveis; o professor mantem responsabilidade sobre decisoes academicas." },
        { title: "Disponibilidade", body: "O app movel e o motor OMR devem estabilizar antes de prometer niveis de servico." },
      ],
    },
    en: {
      eyebrow: "Terms",
      title: "Use terms for an academic scoring tool.",
      intro: "These terms are a product baseline and need legal review before real accounts are opened.",
      sections: [
        { title: "Permitted use", body: "TuLector is designed for teachers and institutions scoring objective tests and practice exams." },
        { title: "Results", body: "Scores and grades must be auditable; teachers remain responsible for academic decisions." },
        { title: "Availability", body: "The mobile app and OMR engine must be stabilized before service levels are promised." },
      ],
    },
  },
  security: {
    es: {
      eyebrow: "Seguridad",
      title: "Arquitectura segura antes de operar con datos reales.",
      intro: "El estado objetivo es autenticacion obligatoria, Storage privado, RLS por organizacion y auditoria de escaneos.",
      sections: [
        { title: "Autenticacion", body: "Cada profesor debe iniciar sesion y pertenecer a una institucion antes de crear cursos o escaneos." },
        { title: "Storage", body: "Las imagenes deben guardarse en buckets privados con URLs firmadas, no dentro de JSONB." },
        { title: "Auditoria", body: "Los scan_logs deben registrar eventos tecnicos sin exponer fotos ni datos personales a usuarios anonimos." },
      ],
    },
    pt: {
      eyebrow: "Seguranca",
      title: "Arquitetura segura antes de operar com dados reais.",
      intro: "O estado alvo e autenticacao obrigatoria, Storage privado, RLS por organizacao e auditoria de leituras.",
      sections: [
        { title: "Autenticacao", body: "Cada professor deve entrar e pertencer a uma instituicao antes de criar turmas ou leituras." },
        { title: "Storage", body: "Imagens devem ficar em buckets privados com URLs assinadas, nao dentro de JSONB." },
        { title: "Auditoria", body: "Os scan_logs devem registrar eventos tecnicos sem expor fotos ou dados pessoais a usuarios anonimos." },
      ],
    },
    en: {
      eyebrow: "Security",
      title: "Secure architecture before real education data.",
      intro: "The target state is mandatory auth, private Storage, organization-scoped RLS and scan audit trails.",
      sections: [
        { title: "Authentication", body: "Every teacher must sign in and belong to an institution before creating classes or scans." },
        { title: "Storage", body: "Images should live in private buckets with signed URLs, not inside JSONB." },
        { title: "Audit", body: "scan_logs should capture technical events without exposing photos or personal data to anonymous users." },
      ],
    },
  },
  support: {
    es: {
      eyebrow: "Soporte",
      title: "Canales simples para colegios y docentes.",
      intro: "Soporte debe cubrir cuentas, hojas imprimibles, lectura OMR, exportaciones y recuperacion de resultados.",
      sections: [
        { title: "Contacto", body: "Escribe a contacto@tulector.cl con institucion, curso, ensayo y descripcion del problema." },
        { title: "Diagnostico", body: "Para fallas de lectura se debe adjuntar foto original, PDF de hoja y log tecnico del escaneo." },
        { title: "Operacion", body: "Antes de produccion, el lector se validara con un set real de hojas impresas y fotos de telefonos distintos." },
      ],
    },
    pt: {
      eyebrow: "Suporte",
      title: "Canais simples para escolas e professores.",
      intro: "O suporte deve cobrir contas, folhas imprimiveis, leitura OMR, exportacoes e recuperacao de resultados.",
      sections: [
        { title: "Contato", body: "Escreva para contato@tulector.com com instituicao, turma, prova e descricao do problema." },
        { title: "Diagnostico", body: "Para falhas de leitura, anexe foto original, PDF da folha e log tecnico da leitura." },
        { title: "Operacao", body: "Antes da producao, o leitor sera validado com um conjunto real de folhas impressas e fotos de celulares diferentes." },
      ],
    },
    en: {
      eyebrow: "Support",
      title: "Simple support channels for schools and teachers.",
      intro: "Support should cover accounts, printable sheets, OMR reading, exports and result recovery.",
      sections: [
        { title: "Contact", body: "Email contact@tulector.com with institution, class, exam and a description of the issue." },
        { title: "Diagnostics", body: "For scan failures, attach the original photo, sheet PDF and technical scan log." },
        { title: "Operations", body: "Before production, the scanner will be validated with real printed sheets and photos from different phones." },
      ],
    },
  },
};
