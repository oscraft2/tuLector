import type { PublicLocale } from "@/lib/public_i18n";

export type PublicPageKey = "privacy" | "terms" | "security" | "support" | "dataRequest";

type PublicPageContent = {
  eyebrow: string;
  title: string;
  intro: string;
  updated?: string;
  sections: readonly { title: string; body: string }[];
};

export const publicPages: Record<PublicPageKey, Record<PublicLocale, PublicPageContent>> = {
  privacy: {
    es: {
      eyebrow: "Privacidad",
      title: "Politica de privacidad y proteccion de datos.",
      intro: "TuLector trata datos de cuentas, instituciones, cursos, estudiantes, pruebas, respuestas, resultados y registros tecnicos para prestar el servicio de lectura de hojas, correccion y analisis academico.",
      updated: "Actualizado el 29 de junio de 2026",
      sections: [
        { title: "Datos que tratamos", body: "Podemos tratar nombre, correo, institucion, rol, cursos, identificadores de estudiantes, pruebas, respuestas, puntajes, archivos generados, imagenes de hojas y registros tecnicos necesarios para seguridad, soporte y mejora del servicio." },
        { title: "Finalidades", body: "Usamos los datos para crear y administrar cuentas, leer hojas de respuesta, calcular resultados, entregar reportes, prevenir abuso, resolver solicitudes de soporte y comunicar informacion comercial cuando el usuario la pide expresamente." },
        { title: "Datos de estudiantes", body: "Cuando una institucion usa TuLector con estudiantes, la institucion sigue siendo responsable de contar con autorizaciones y bases legales aplicables. TuLector debe operar bajo minimizacion, permisos por rol y separacion por institucion." },
        { title: "Proveedores", body: "TuLector puede usar infraestructura y servicios externos como Supabase, Vercel, Google, Apple y proveedores de pago o correo. Solo deben recibir los datos necesarios para prestar el servicio contratado o solicitado." },
        { title: "Conservacion", body: "Los datos se conservan mientras exista una cuenta activa, una relacion institucional, una obligacion legal o una necesidad operativa razonable. Las imagenes y registros tecnicos deben tener periodos de retencion definidos por plan o contrato." },
        { title: "Derechos", body: "Los usuarios pueden pedir acceso, rectificacion, actualizacion, eliminacion, oposicion o portabilidad cuando corresponda. Las solicitudes se reciben en contacto@tulector.cl o mediante la pagina de solicitud de datos." },
      ],
    },
    pt: {
      eyebrow: "Privacidade",
      title: "Politica de privacidade e protecao de dados.",
      intro: "TuLector trata dados de contas, instituicoes, turmas, estudantes, provas, respostas, resultados e registros tecnicos para prestar o servico de leitura de folhas, correcao e analise academica.",
      updated: "Atualizado em 29 de junho de 2026",
      sections: [
        { title: "Dados tratados", body: "Podemos tratar nome, email, instituicao, funcao, turmas, identificadores de estudantes, provas, respostas, pontuacoes, arquivos gerados, imagens de folhas e registros tecnicos necessarios para seguranca, suporte e melhoria do servico." },
        { title: "Finalidades", body: "Usamos os dados para criar contas, ler folhas de resposta, calcular resultados, entregar relatorios, prevenir abuso, resolver suporte e comunicar informacoes comerciais quando solicitadas pelo usuario." },
        { title: "Dados de estudantes", body: "Quando uma instituicao usa TuLector com estudantes, a instituicao deve contar com autorizacoes e bases legais aplicaveis. TuLector deve operar com minimizacao, permissoes por funcao e separacao por instituicao." },
        { title: "Fornecedores", body: "TuLector pode usar infraestrutura e servicos externos como Supabase, Vercel, Google, Apple e provedores de pagamento ou email. Eles devem receber apenas os dados necessarios para prestar o servico." },
        { title: "Retencao", body: "Os dados sao conservados enquanto existir conta ativa, relacao institucional, obrigacao legal ou necessidade operacional razoavel. Imagens e registros tecnicos devem ter periodos definidos por plano ou contrato." },
        { title: "Direitos", body: "Usuarios podem solicitar acesso, correcao, atualizacao, eliminacao, oposicao ou portabilidade quando aplicavel. As solicitacoes sao recebidas em contato@tulector.com ou na pagina de solicitacao de dados." },
      ],
    },
    en: {
      eyebrow: "Privacy",
      title: "Privacy and data protection policy.",
      intro: "TuLector processes account, institution, class, student, assessment, answer, result and technical log data to provide answer-sheet reading, scoring and academic analytics.",
      updated: "Updated June 29, 2026",
      sections: [
        { title: "Data we process", body: "We may process name, email, institution, role, classes, student identifiers, assessments, answers, scores, generated files, sheet images and technical records required for security, support and service improvement." },
        { title: "Purposes", body: "We use data to create accounts, read answer sheets, calculate results, deliver reports, prevent abuse, resolve support requests and send commercial information when the user explicitly asks for it." },
        { title: "Student data", body: "When an institution uses TuLector with students, the institution remains responsible for required permissions and legal bases. TuLector should operate with minimization, role permissions and institution-level separation." },
        { title: "Providers", body: "TuLector may use infrastructure and external services such as Supabase, Vercel, Google, Apple and payment or email providers. They should receive only the data required to provide the requested service." },
        { title: "Retention", body: "Data is kept while there is an active account, an institutional relationship, a legal obligation or a reasonable operational need. Images and technical logs should have retention periods defined by plan or contract." },
        { title: "Rights", body: "Users may request access, correction, update, deletion, objection or portability when applicable. Requests are received at contact@tulector.com or through the data request page." },
      ],
    },
  },
  terms: {
    es: {
      eyebrow: "Terminos",
      title: "Terminos de uso de TuLector.",
      intro: "Estos terminos regulan el uso de TuLector por docentes, instituciones y equipos educativos que corrigen pruebas, ensayos y simulacros con hojas de respuesta.",
      updated: "Actualizado el 29 de junio de 2026",
      sections: [
        { title: "Uso permitido", body: "TuLector esta pensado para crear pruebas, generar hojas de respuesta, leer marcas con camara, calcular resultados y entregar reportes academicos. No debe usarse para fines ilegales, discriminatorios, fraudulentos o ajenos al contexto educativo autorizado." },
        { title: "Cuenta y responsabilidad", body: "El usuario debe mantener datos de cuenta correctos, proteger sus credenciales y usar la plataforma solo con autorizacion de su institucion cuando trabaje con informacion de estudiantes." },
        { title: "Resultados academicos", body: "Los resultados automaticos ayudan a acelerar la correccion, pero deben ser revisables. La institucion y el docente conservan responsabilidad por decisiones pedagogicas, notas oficiales y comunicacion a estudiantes o apoderados." },
        { title: "Servicios de terceros", body: "El acceso con Google o Apple depende de sus condiciones, disponibilidad y politicas. TuLector no debe pedir mas permisos que los necesarios para identificar al usuario y crear la cuenta." },
        { title: "Disponibilidad", body: "La plataforma puede evolucionar, corregir errores o suspender funciones por seguridad, mantenimiento o cambios de proveedores. Los niveles de servicio comerciales deben acordarse por escrito con cada institucion." },
        { title: "Cambios", body: "TuLector puede actualizar estos terminos para reflejar mejoras del producto, cambios legales o nuevas integraciones. Los cambios relevantes deben comunicarse con claridad a usuarios e instituciones." },
      ],
    },
    pt: {
      eyebrow: "Termos",
      title: "Termos de uso do TuLector.",
      intro: "Estes termos regulam o uso do TuLector por professores, instituicoes e equipes educacionais que corrigem provas e simulados com folhas de resposta.",
      updated: "Atualizado em 29 de junho de 2026",
      sections: [
        { title: "Uso permitido", body: "TuLector foi pensado para criar provas, gerar folhas de resposta, ler marcacoes pela camera, calcular resultados e entregar relatorios academicos. Nao deve ser usado para fins ilegais, discriminatorios, fraudulentos ou sem autorizacao educacional." },
        { title: "Conta e responsabilidade", body: "O usuario deve manter os dados da conta corretos, proteger suas credenciais e usar a plataforma com autorizacao da instituicao ao trabalhar com informacoes de estudantes." },
        { title: "Resultados academicos", body: "Resultados automaticos aceleram a correcao, mas devem ser revisaveis. A instituicao e o professor continuam responsaveis por decisoes pedagogicas, notas oficiais e comunicacao com estudantes ou responsaveis." },
        { title: "Servicos de terceiros", body: "O acesso com Google ou Apple depende de seus termos, disponibilidade e politicas. TuLector nao deve pedir mais permissoes do que o necessario para identificar o usuario e criar a conta." },
        { title: "Disponibilidade", body: "A plataforma pode evoluir, corrigir erros ou suspender recursos por seguranca, manutencao ou mudancas de fornecedores. Niveis comerciais de servico devem ser acordados por escrito com cada instituicao." },
        { title: "Alteracoes", body: "TuLector pode atualizar estes termos para refletir melhorias do produto, mudancas legais ou novas integracoes. Mudancas relevantes devem ser comunicadas com clareza." },
      ],
    },
    en: {
      eyebrow: "Terms",
      title: "TuLector terms of use.",
      intro: "These terms govern TuLector usage by teachers, institutions and education teams that score assessments and practice exams with printed answer sheets.",
      updated: "Updated June 29, 2026",
      sections: [
        { title: "Permitted use", body: "TuLector is designed to create assessments, generate answer sheets, read marks by camera, calculate results and deliver academic reports. It must not be used for illegal, discriminatory, fraudulent or unauthorized education purposes." },
        { title: "Account responsibility", body: "Users must keep account information accurate, protect credentials and use the platform with institutional authorization when working with student information." },
        { title: "Academic results", body: "Automatic results help speed up scoring, but they must remain reviewable. The institution and teacher remain responsible for pedagogical decisions, official grades and communication with students or guardians." },
        { title: "Third-party services", body: "Google or Apple sign-in depends on their terms, availability and policies. TuLector should not request more permissions than needed to identify the user and create the account." },
        { title: "Availability", body: "The platform may evolve, fix errors or suspend features for security, maintenance or provider changes. Commercial service levels should be agreed in writing with each institution." },
        { title: "Changes", body: "TuLector may update these terms to reflect product improvements, legal changes or new integrations. Relevant changes should be communicated clearly to users and institutions." },
      ],
    },
  },
  security: {
    es: {
      eyebrow: "Seguridad",
      title: "Seguridad para datos academicos.",
      intro: "TuLector debe proteger cuentas, datos institucionales, imagenes de hojas y resultados academicos con controles tecnicos y operativos proporcionales al riesgo.",
      updated: "Actualizado el 29 de junio de 2026",
      sections: [
        { title: "Autenticacion", body: "Las cuentas pueden usar correo y contrasena o proveedores como Google y Apple. El registro manual debe exigir contrasenas robustas, confirmacion y aceptacion de terminos y privacidad." },
        { title: "Permisos", body: "El acceso a cursos, pruebas, estudiantes, resultados e imagenes debe separarse por usuario, rol e institucion. Los paneles administrativos deben quedar restringidos a personal autorizado." },
        { title: "Almacenamiento", body: "Las imagenes de hojas y archivos sensibles deben almacenarse en repositorios privados, con URLs firmadas, retencion definida y eliminacion cuando ya no sean necesarios." },
        { title: "Auditoria", body: "Los registros tecnicos deben ayudar a diagnosticar lecturas, errores y abuso sin exponer informacion personal innecesaria a usuarios sin permiso." },
        { title: "Proveedores", body: "Cada proveedor con acceso a datos debe estar justificado por una finalidad operativa. Las llaves, tokens y secretos deben vivir fuera del codigo fuente y rotarse si existe sospecha de exposicion." },
        { title: "Limitacion", body: "Ningun sistema es invulnerable. Si detectas una vulnerabilidad o exposicion de datos, escribe a contacto@tulector.cl con detalles tecnicos y pasos de reproduccion." },
      ],
    },
    pt: {
      eyebrow: "Seguranca",
      title: "Seguranca para dados academicos.",
      intro: "TuLector deve proteger contas, dados institucionais, imagens de folhas e resultados academicos com controles tecnicos e operacionais proporcionais ao risco.",
      updated: "Atualizado em 29 de junho de 2026",
      sections: [
        { title: "Autenticacao", body: "Contas podem usar email e senha ou provedores como Google e Apple. O cadastro manual deve exigir senhas fortes, confirmacao e aceite dos termos e privacidade." },
        { title: "Permissoes", body: "O acesso a turmas, provas, estudantes, resultados e imagens deve ser separado por usuario, funcao e instituicao. Paineis administrativos devem ficar restritos a pessoas autorizadas." },
        { title: "Armazenamento", body: "Imagens de folhas e arquivos sensiveis devem ficar em repositorios privados, com URLs assinadas, retencao definida e eliminacao quando nao forem mais necessarios." },
        { title: "Auditoria", body: "Registros tecnicos devem ajudar a diagnosticar leituras, erros e abuso sem expor informacao pessoal desnecessaria a usuarios sem permissao." },
        { title: "Fornecedores", body: "Cada fornecedor com acesso a dados deve estar justificado por uma finalidade operacional. Chaves, tokens e segredos devem ficar fora do codigo fonte e ser rotacionados se houver suspeita de exposicao." },
        { title: "Limitacao", body: "Nenhum sistema e invulneravel. Se detectar vulnerabilidade ou exposicao de dados, escreva para contato@tulector.com com detalhes tecnicos e passos de reproducao." },
      ],
    },
    en: {
      eyebrow: "Security",
      title: "Security for academic data.",
      intro: "TuLector should protect accounts, institutional data, sheet images and academic results with technical and operational controls proportional to risk.",
      updated: "Updated June 29, 2026",
      sections: [
        { title: "Authentication", body: "Accounts may use email and password or providers such as Google and Apple. Manual registration should require strong passwords, confirmation and acceptance of terms and privacy." },
        { title: "Permissions", body: "Access to classes, assessments, students, results and images should be separated by user, role and institution. Administrative panels must remain restricted to authorized staff." },
        { title: "Storage", body: "Sheet images and sensitive files should live in private repositories with signed URLs, defined retention and deletion when no longer needed." },
        { title: "Audit", body: "Technical records should help diagnose readings, errors and abuse without exposing unnecessary personal information to users without permission." },
        { title: "Providers", body: "Each provider with data access must be justified by an operational purpose. Keys, tokens and secrets must live outside source code and rotate when exposure is suspected." },
        { title: "Limitation", body: "No system is invulnerable. If you detect a vulnerability or data exposure, email contact@tulector.com with technical details and reproduction steps." },
      ],
    },
  },
  support: {
    es: {
      eyebrow: "Soporte",
      title: "Canales simples para colegios y docentes.",
      intro: "Soporte cubre cuentas, hojas imprimibles, lectura con camara, exportaciones, resultados y solicitudes sobre datos personales.",
      updated: "Actualizado el 29 de junio de 2026",
      sections: [
        { title: "Contacto", body: "Escribe a contacto@tulector.cl con institucion, curso, ensayo y descripcion del problema." },
        { title: "Diagnostico", body: "Para fallas de lectura conviene adjuntar foto original, PDF de hoja y descripcion del dispositivo usado, evitando enviar datos de estudiantes si no es necesario." },
        { title: "Datos", body: "Para acceso, correccion o eliminacion de datos, usa la pagina de solicitud de datos o escribe desde el correo asociado a la cuenta." },
        { title: "Operacion", body: "Las instituciones pueden pedir pilotos, configuracion inicial, revision de flujos de correccion y recomendaciones para imprimir hojas con mejor lectura." },
      ],
    },
    pt: {
      eyebrow: "Suporte",
      title: "Canais simples para escolas e professores.",
      intro: "O suporte cobre contas, folhas imprimiveis, leitura pela camera, exportacoes, resultados e solicitacoes sobre dados pessoais.",
      updated: "Atualizado em 29 de junho de 2026",
      sections: [
        { title: "Contato", body: "Escreva para contato@tulector.com com instituicao, turma, prova e descricao do problema." },
        { title: "Diagnostico", body: "Para falhas de leitura, anexe foto original, PDF da folha e descricao do dispositivo usado, evitando enviar dados de estudantes se nao for necessario." },
        { title: "Dados", body: "Para acesso, correcao ou eliminacao de dados, use a pagina de solicitacao de dados ou escreva pelo email associado a conta." },
        { title: "Operacao", body: "Instituicoes podem solicitar pilotos, configuracao inicial, revisao de fluxos de correcao e recomendacoes para imprimir folhas com melhor leitura." },
      ],
    },
    en: {
      eyebrow: "Support",
      title: "Simple support channels for schools and teachers.",
      intro: "Support covers accounts, printable sheets, camera reading, exports, results and personal data requests.",
      updated: "Updated June 29, 2026",
      sections: [
        { title: "Contact", body: "Email contact@tulector.com with institution, class, exam and a description of the issue." },
        { title: "Diagnostics", body: "For scan failures, attach the original photo, sheet PDF and device description, avoiding student data when it is not necessary." },
        { title: "Data", body: "For data access, correction or deletion, use the data request page or write from the email associated with the account." },
        { title: "Operations", body: "Institutions may request pilots, initial configuration, scoring workflow review and recommendations to print sheets with better reading quality." },
      ],
    },
  },
  dataRequest: {
    es: {
      eyebrow: "Solicitud de datos",
      title: "Acceso, correccion o eliminacion de datos.",
      intro: "Usa este canal para ejercer derechos sobre datos personales o informacion asociada a una cuenta TuLector. Si la solicitud involucra estudiantes, puede requerir validacion de la institucion responsable.",
      updated: "Actualizado el 29 de junio de 2026",
      sections: [
        { title: "Como solicitar", body: "Escribe a contacto@tulector.cl desde el correo asociado a la cuenta e indica si pides acceso, rectificacion, actualizacion, eliminacion, oposicion o portabilidad. Incluye institucion, rol y alcance de la solicitud." },
        { title: "Validacion", body: "Podemos pedir antecedentes adicionales para confirmar identidad, autorizacion institucional o representacion legal antes de ejecutar cambios sobre datos academicos." },
        { title: "Tiempos", body: "TuLector debe responder dentro de un plazo razonable y priorizar solicitudes relacionadas con seguridad, eliminacion de cuenta o datos de estudiantes." },
        { title: "Eliminacion", body: "La eliminacion puede excluir registros que deban conservarse por obligaciones legales, seguridad, facturacion, auditoria o defensa de derechos. Cuando sea posible, se minimiza o anonimiza informacion no necesaria." },
      ],
    },
    pt: {
      eyebrow: "Solicitacao de dados",
      title: "Acesso, correcao ou eliminacao de dados.",
      intro: "Use este canal para exercer direitos sobre dados pessoais ou informacoes associadas a uma conta TuLector. Se a solicitacao envolver estudantes, pode exigir validacao da instituicao responsavel.",
      updated: "Atualizado em 29 de junho de 2026",
      sections: [
        { title: "Como solicitar", body: "Escreva para contato@tulector.com pelo email associado a conta e indique se solicita acesso, correcao, atualizacao, eliminacao, oposicao ou portabilidade. Inclua instituicao, funcao e escopo da solicitacao." },
        { title: "Validacao", body: "Podemos pedir informacoes adicionais para confirmar identidade, autorizacao institucional ou representacao legal antes de alterar dados academicos." },
        { title: "Prazos", body: "TuLector deve responder em prazo razoavel e priorizar solicitacoes relacionadas a seguranca, eliminacao de conta ou dados de estudantes." },
        { title: "Eliminacao", body: "A eliminacao pode excluir registros que precisem ser conservados por obrigacoes legais, seguranca, faturamento, auditoria ou defesa de direitos. Quando possivel, minimizamos ou anonimizamos informacao nao necessaria." },
      ],
    },
    en: {
      eyebrow: "Data request",
      title: "Access, correction or deletion of data.",
      intro: "Use this channel to exercise rights over personal data or information associated with a TuLector account. If the request involves students, validation from the responsible institution may be required.",
      updated: "Updated June 29, 2026",
      sections: [
        { title: "How to request", body: "Email contact@tulector.com from the account email and indicate whether you request access, correction, update, deletion, objection or portability. Include institution, role and request scope." },
        { title: "Validation", body: "We may request additional information to confirm identity, institutional authorization or legal representation before making changes to academic data." },
        { title: "Timing", body: "TuLector should respond within a reasonable period and prioritize requests related to security, account deletion or student data." },
        { title: "Deletion", body: "Deletion may exclude records that must be kept for legal obligations, security, billing, audit or defense of rights. Where possible, unnecessary information is minimized or anonymized." },
      ],
    },
  },
};
