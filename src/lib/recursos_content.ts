export type ArticleContent = {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  authorSlug: string;
  body: string[];
  resumenEjecutivo: string;
  faqs: { q: string; a: string }[];
};

export const articleContent: Record<string, ArticleContent> = {
  "como-escanear-hojas-con-camara": {
    slug: "como-escanear-hojas-con-camara",
    title: "Como escanear hojas de respuesta con camara",
    excerpt: "Guia paso a paso para digitalizar hojas de respuesta usando la camara de tu celular. Sin scanner OMR ni hardware especial.",
    author: "Equipo TuLector",
    authorSlug: "equipo-tulector",
    resumenEjecutivo: "Escanea hojas de respuesta con la camara de tu celular usando TuLector. Solo necesitas imprimir las hojas, que tus alumnos las completen, y pasar la camara. El sistema detecta marcas, corrige automaticamente y entrega resultados en minutos. Sin hardware especial ni scanner OMR.",
    body: [
      "Corregir hojas de respuesta a mano consume horas del tiempo docente que podrian dedicarse a preparar mejores clases o atender a los alumnos que mas lo necesitan. La lectura optica tradicional requiere hardware especializado que pocos colegios pueden costear. TuLector cambia esto: convierte la camara de tu celular en un lector OMR de precision.",
      "El proceso es simple: disenas tu evaluacion con la cantidad de preguntas que necesites, generas las hojas de respuesta con el formato de tu preferencia, las imprimes y las entregas a tus alumnos. Una vez que completan las marcas con lapiz, solo necesitas abrir TuLector, apuntar la camara a cada hoja y el sistema hace el resto.",
      "La tecnologia de TuLector usa algoritmos de vision por computadora para detectar las marcas en las hojas. Identifica los circulos rellenos, corrige la perspectiva si la foto no esta perfectamente alineada y aplica votacion multi-frame para maximizar la precision. Puedes confiar en que los resultados son tan exactos como los de un scanner OMR tradicional.",
      "Todo el proceso, desde que tomas la primera foto hasta que ves los resultados, toma menos de 3 minutos para una sala de 40 alumnos. Los resultados se sincronizan automaticamente con el dashboard, donde puedes filtrar por curso, fecha, pregunta y alumno. Tambien puedes exportar a Excel o compartir resultados individuales con cada estudiante via link privado.",
      "No necesitas instalar software adicional. TuLector funciona en el navegador del celular y del computador. Tambien ofrecemos una aplicacion nativa para Android que permite escanear sin conexion a internet, ideal para colegios con conectividad limitada. Los resultados se sincronizan automaticamente cuando el dispositivo recupera la senal.",
    ],
    faqs: [
      { q: "Necesito un telefono especial para escanear?", a: "No. Cualquier celular con camara de al menos 5 megapixeles funciona. La aplicacion usa algoritmos de correccion de perspectiva que compensan angulos y condiciones de luz variables." },
      { q: "Cuantas hojas puedo escanear por minuto?", a: "Aproximadamente 15-20 hojas por minuto con un solo dispositivo. Si tienes varios docentes escaneando en paralelo, la velocidad se multiplica." },
      { q: "Que tipo de lapiz funciona mejor?", a: "Lapiz grafito No. 2 (HB) o lapiz pasta negro. Evita colores claros como amarillo o celeste porque el algoritmo necesita contraste para detectar las marcas." },
    ],
  },
  "exani-vs-comipems-mexico": {
    slug: "exani-vs-comipems-mexico",
    title: "EXANI vs COMIPEMS: diferencias y como preparar a tus alumnos",
    excerpt: "Comparativa de los examenes de ingreso mas importantes de Mexico. Estrategias de preparacion y como usar simulacros efectivos.",
    author: "Equipo TuLector",
    authorSlug: "equipo-tulector",
    resumenEjecutivo: "El EXANI-II del CENEVAL evalua competencias academicas para ingreso a universidad, mientras el COMIPEMS define la asignacion a bachillerato en la ZMCM. Ambos requieren preparacion con simulacros frecuentes. TuLector permite crear ensayos en formato EXANI o COMIPEMS, escanear con el celular y obtener resultados inmediatos por alumno y area de conocimiento.",
    body: [
      "En Mexico, dos de los examenes mas importantes para estudiantes son el EXANI (Examen Nacional de Ingreso) administrado por el CENEVAL, y el COMIPEMS (Concurso de Ingreso a la Educacion Media Superior) para la Zona Metropolitana de la Ciudad de Mexico. Aunque ambos evaluan conocimientos academicos, tienen diferencias fundamentales en estructura, proposito y alcance.",
      "El EXANI-II esta disenado para el ingreso a educacion superior (licenciatura). Evalua areas como razonamiento logico-matematico, razonamiento verbal, espanol, matematicas y ciencias. El EXANI-I es su equivalente para ingreso a bachillerato. Ambos son utilizados por universidades publicas y privadas en todo el pais como parte de su proceso de seleccion.",
      "El COMIPEMS, por otro lado, es un examen unico que define la asignacion de estudiantes a las instituciones de educacion media superior en la Zona Metropolitana del Valle de Mexico. Evalua habilidad verbal, habilidad matematica, ciencias naturales y ciencias sociales. El resultado determina en que plantel estudiara el alumno, no solo si es admitido o no.",
      "Para preparar a tus alumnos para cualquiera de estos examenes, los simulacros frecuentes son la estrategia mas efectiva. Con TuLector puedes crear evaluaciones en el formato exacto de EXANI o COMIPEMS: cantidad de preguntas, numero de opciones por pregunta, escala de puntaje y tiempo. Cada simulacro se corrige en minutos y los alumnos reciben feedback inmediato sobre sus areas de mejora.",
      "La clave esta en la frecuencia: mientras mas simulacros realice un alumno, mejor entendera el formato del examen, administrara su tiempo y reducira la ansiedad el dia de la prueba. Con la correccion automatica de TuLector, tu academia puede aplicar un simulacro semanal sin sobrecargar al equipo docente.",
    ],
    faqs: [
      { q: "Cuantas preguntas tiene el EXANI-II?", a: "El EXANI-II tiene aproximadamente 170 preguntas distribuidas en modulos de razonamiento logico-matematico, razonamiento verbal y areas disciplinares especificas segun la carrera." },
      { q: "Cada cuanto debo hacer simulacros?", a: "Lo ideal es un simulacro cada 2-3 semanas los primeros meses, aumentando a uno semanal en el ultimo mes antes del examen real." },
      { q: "TuLector soporta el formato CENEVAL?", a: "Si. Puedes configurar de 3 a 6 opciones por pregunta, como se usa en el EXANI. El lector OMR reconoce las marcas y asigna puntajes segun la clave de respuestas que definas." },
    ],
  },
  "enem-2026-como-preparar-simulados": {
    slug: "enem-2026-como-preparar-simulados",
    title: "ENEM 2026: como preparar simulados eficientes",
    excerpt: "Estrategias para criar e corrigir simulados ENEM com resultados imediatos. Preparacao completa para o exame nacional.",
    author: "Equipe TuLector",
    authorSlug: "equipe-tulector",
    resumenEjecutivo: "O ENEM e o principal exame de acesso ao ensino superior no Brasil. Preparar alunos com simulados frequentes e a estrategia mais eficaz. Com o TuLector, voce cria simulados no formato TRI do ENEM, escaneia as folhas com a camera do celular e obtem resultados imediatos. Frequencia e feedback rapido sao os diferenciais.",
    body: [
      "O Exame Nacional do Ensino Medio (ENEM) e a principal porta de entrada para universidades publicas e privadas no Brasil. Com mais de 4 milhoes de inscritos anuais, a preparacao adequada exige nao apenas dominio do conteudo, mas familiaridade com o formato da prova e a Teoria de Resposta ao Item (TRI), que calcula a nota final de forma diferente de uma simples contagem de acertos.",
      "Simulados frequentes sao a estrategia mais comprovada para melhorar o desempenho no ENEM. Quando um aluno realiza simulados regularmente, ele desenvolve resistencia para as 180 questoes em dois dias de prova, aprende a gerenciar o tempo entre as areas de conhecimento e se familiariza com o estilo de perguntas do INEP.",
      "O grande desafio para escolas e cursinhos e corrigir esses simulados rapidamente. A correcao manual de 180 questoes por aluno, multiplicada por dezenas ou centenas de alunos, consome horas que poderiam ser dedicadas a revisao dos topicos com maior indice de erro. E aqui que o TuLector transforma a preparacao.",
      "Com o TuLector, voce configura o simulado com 180 questoes divididas em Linguagens, Ciencias Humanas, Ciencias da Natureza e Matematica. Os alunos preenchem as folhas de resposta, voce escaneia com o celular e os resultados sao processados em minutos. O sistema calcula automaticamente a porcentagem de acertos por area.",
      "Para 2026, a tendencia e que o ENEM continue evoluindo seu modelo de questoes. Os simulados do TuLector podem ser adaptados para refletir mudancas no formato ou na distribuicao de conteudos. E como a correcao e instantanea, voce pode aplicar um simulado por semana sem sobrecarregar sua equipe docente.",
    ],
    faqs: [
      { q: "Como funciona a TRI no ENEM?", a: "A Teoria de Resposta ao Item nao conta apenas acertos, mas considera a coerencia das respostas. Acertar questoes dificeis e errar faceis pode indicar chute e reduzir a nota. Simulados ajudam a entender esse comportamento." },
      { q: "Quantos simulados devo aplicar por mes?", a: "O ideal e um simulado completo a cada 15 dias, com revisao dos erros na semana seguinte. No ultimo mes, aumente para um simulado semanal." },
      { q: "Funciona com o formato de 5 alternativas do ENEM?", a: "Sim. O gerador de folhas de resposta permite configurar de 2 a 6 alternativas por questao. O leitor OMR reconhece as marcacoes e compara com o gabarito automaticamente." },
    ],
  },
  "cbc-uba-ingreso-2026": {
    slug: "cbc-uba-ingreso-2026",
    title: "CBC UBA: como preparar el ingreso con simulacros efectivos",
    excerpt: "Guia completa del Ciclo Basico Comun de la UBA. Estrategias de estudio, simulacros y herramientas digitales para el ingreso.",
    author: "Equipo TuLector",
    authorSlug: "equipo-tulector",
    resumenEjecutivo: "El CBC de la UBA es la puerta de entrada a una de las universidades mas prestigiosas de Latinoamerica. La preparacion con simulacros frecuentes aumenta significativamente las chances de aprobacion. Con TuLector podes crear examenes en el formato exacto del CBC, corregir al instante con la camara del celular y dar feedback inmediato a tus alumnos.",
    body: [
      "El Ciclo Basico Comun (CBC) de la Universidad de Buenos Aires es el primer filtro academico que enfrentan los aspirantes a las carreras de la UBA. Con materias como Matematica, Fisica, Quimica, Sociedad y Estado, Pensamiento Cientifico, entre otras, el CBC evalua las competencias basicas necesarias para el inicio de la vida universitaria.",
      "La tasa de aprobacion en el CBC varia segun la materia y la sede, pero en promedio un porcentaje significativo de estudiantes recursa al menos una materia en su primer cuatrimestre. La preparacion previa con simulacros de examen es una de las estrategias mas efectivas para mejorar estas cifras.",
      "TuLector ofrece una solucion concreta para academias y docentes que preparan alumnos para el CBC. Podes disenar examenes con la cantidad exacta de preguntas de cada materia, configurar la escala de notas de 1 a 10 como se usa en Argentina, y generar hojas de respuesta personalizadas con el formato que prefieras.",
      "El flujo es simple: creas el examen, generas las hojas, las imprimis y las entregas a tus alumnos. Cuando terminan, escaneas cada hoja con la camara de tu celular. Los resultados se procesan en minutos y estan disponibles en el dashboard, con detalle por alumno, por pregunta y por tema.",
      "Para las academias que preparan el CBC, la frecuencia de simulacros es un diferenciador competitivo. Mientras que la correccion manual limita a un simulacro por mes, con TuLector podes hacer uno por semana. Tus alumnos llegan al examen real con mas practica, mejor manejo del tiempo y menos ansiedad.",
    ],
    faqs: [
      { q: "Cuantas materias tiene el CBC?", a: "El CBC consta de 6 materias: 2 comunes a todas las carreras (Sociedad y Estado, Pensamiento Cientifico) y 4 especificas segun la orientacion (Matematica, Fisica, Quimica, Biologia, entre otras)." },
      { q: "Se puede usar TuLector para parciales del CBC?", a: "Si. Podes simular el formato exacto de los parciales del CBC: cantidad de preguntas, ejercicios de multiple choice, escala de notas de 1 a 10." },
      { q: "Cuanto cuesta TuLector en Argentina?", a: "El plan gratuito incluye 100 lecturas mensuales. Los unicos planes pagos son Pro y School; consulta la pagina de precios para ver valores vigentes." },
    ],
  },
  "ece-peru-evaluacion-censal": {
    slug: "ece-peru-evaluacion-censal",
    title: "ECE Peru: como preparar la Evaluacion Censal de Estudiantes",
    excerpt: "Todo sobre la ECE del MINEDU: estructura, areas evaluadas y como implementar simulacros efectivos en tu colegio.",
    author: "Equipo TuLector",
    authorSlug: "equipo-tulector",
    resumenEjecutivo: "La Evaluacion Censal de Estudiantes (ECE) del MINEDU mide el nivel de aprendizaje en comprension lectora y matematica en escuelas peruanas. Preparar a los alumnos con simulacros frecuentes en el formato ECE mejora los resultados significativamente. TuLector permite crear, aplicar y corregir ensayos ECE con la camara del celular.",
    body: [
      "La Evaluacion Censal de Estudiantes (ECE) es aplicada por el Ministerio de Educacion del Peru (MINEDU) para medir los logros de aprendizaje en areas fundamentales como lectura y matematica. Se aplica anualmente a estudiantes de 2do y 4to grado de primaria, y 2do grado de secundaria en la mayoria de regiones del pais.",
      "Los resultados de la ECE tienen un impacto directo en la reputacion y financiamiento de los colegios. Las instituciones que consistentemente obtienen buenos resultados atraen mas matricula y acceden a programas de mejora del MINEDU. La preparacion con simulacros en el formato ECE es una inversion estrategica.",
      "TuLector permite replicar exactamente el formato de la ECE: cantidad de preguntas por area, numero de opciones (generalmente 4), y escala de calificacion (Previo al inicio, En inicio, En proceso, Satisfactorio). Podes crear ensayos tanto de comprension lectora como de matematica, con preguntas alineadas a los estandares del curriculo nacional.",
      "El proceso es especialmente util para colegios con multiples secciones del mismo grado. En lugar de corregir cientos de hojas a mano, tus docentes pueden escanear todas las hojas en minutos usando sus celulares. El sistema agrupa automaticamente los resultados por seccion y te muestra comparativas entre grupos.",
      "Ademas de la ECE, TuLector tambien soporta el formato de la ECFL para secundaria tecnica, y los examenes de admision de las principales universidades peruanas como la UNI, PUCP, San Marcos y otras.",
    ],
    faqs: [
      { q: "Que grados evalua la ECE?", a: "La ECE se aplica en 2do y 4to grado de primaria (lectura y matematica) y 2do grado de secundaria (lectura, matematica y, en algunas regiones, ciudadania e historia)." },
      { q: "Cuales son los niveles de logro de la ECE?", a: "Los niveles son: Previo al inicio, En inicio, En proceso y Satisfactorio. TuLector puede configurarse con estas escalas de calificacion." },
      { q: "Puedo usar TuLector para examenes de admision a la UNI?", a: "Si. Configura examenes con la cantidad de preguntas del formato UNI (100 preguntas, 5 opciones). La correccion automatica da resultados inmediatos por area." },
    ],
  },
  "simular-paes-paso-a-paso": {
    slug: "simular-paes-paso-a-paso",
    title: "Como simular la PAES paso a paso",
    excerpt: "Aprende a crear, aplicar y corregir simulacros PAES para tus alumnos con resultados inmediatos y reportes por eje tematico.",
    author: "Equipo TuLector",
    authorSlug: "equipo-tulector",
    resumenEjecutivo: "Crea simulacros PAES para tus alumnos y corrigelos en minutos con TuLector. Disena la prueba, imprime las hojas, escanea con el celular y obten resultados inmediatos por competencia y eje tematico. Ideal para colegios y preuniversitarios chilenos que preparan la PAES obligatoria y electiva.",
    body: [
      "La Prueba de Acceso a la Educacion Superior (PAES) reemplazo a la PSU como el examen de ingreso a las universidades chilenas. Con competencias obligatorias (Competencia Lectora, Competencia Matematica M1) y electivas (Matematica M2, Historia y Ciencias Sociales, Ciencias), la PAES evalua habilidades mas que memorizacion de contenidos.",
      "Preparar a tus alumnos para la PAES requiere simulacros frecuentes que repliquen el formato real del DEMRE. El problema: corregir ensayos a mano es lento. Una prueba de Competencia Matematica M1 tiene 60 preguntas; si tienes 40 alumnos, son 2,400 respuestas que revisar. Con TuLector, ese trabajo se reduce a escanear las hojas con el celular.",
      "El formato de la PAES usa 4 opciones por pregunta (A, B, C, D). TuLector soporta exactamente esta configuracion. Las hojas de respuesta se generan con el numero de preguntas que necesites (generalmente 60 o 70) y campos para el identificador del alumno. Una vez impresas, los alumnos completan las marcas y tu las escaneas.",
      "Los resultados se entregan de inmediato, con puntajes por competencia, porcentaje de logro y comparacion con la media del curso. Esto permite identificar que areas necesitan mas refuerzo y ajustar la planificacion de clases en consecuencia. Para preuniversitarios, la frecuencia de simulacros es un diferenciador clave.",
      "TuLector tambien soporta el formato SIMCE para evaluaciones censales en ensenanza basica y media. La flexibilidad permite configurar cualquier tipo de prueba estandarizada que necesites, desde ensayos PAES hasta controles de lectura mensuales.",
    ],
    faqs: [
      { q: "Cuantas preguntas tiene la PAES de Matematica M1?", a: "La PAES de Competencia Matematica M1 tiene 60 preguntas de seleccion multiple con 4 opciones cada una. El tiempo asignado es de 2 horas y 20 minutos." },
      { q: "Que diferencia hay entre M1 y M2?", a: "M1 es obligatoria para todas las carreras y evalua competencias basicas. M2 es electiva y evalua competencias mas avanzadas, requerida por carreras de ingenieria y ciencias." },
      { q: "Puedo generar hojas de respuesta con el formato PAES?", a: "Si. El generador de hojas de TuLector te permite configurar 60 preguntas con 4 opciones cada una, exactamente como la PAES. Incluye campos para el identificador del alumno." },
    ],
  },
};
