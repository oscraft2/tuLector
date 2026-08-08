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
  "simular-paes-paso-a-paso": {
    slug: "simular-paes-paso-a-paso",
    title: "Como simular la PAES paso a paso",
    excerpt: "Aprende a crear, aplicar y corregir simulacros PAES para tus alumnos con resultados inmediatos y reportes por eje tematico.",
    author: "Equipo TuLector",
    authorSlug: "equipo-tulector",
    resumenEjecutivo: "Crea simulacros PAES para tus alumnos y corrigelos en minutos con TuLector. Disena la prueba, imprime las hojas, escanea con el celular y obten resultados inmediatos por competencia y eje tematico. Ideal para colegios y preuniversitarios chilenos que preparan la PAES obligatoria y electiva.",
    body: [
      "La Prueba de Acceso a la Educacion Superior (PAES) evalua competencias y habilidades academicas necesarias para ingresar a las universidades chilenas. Con pruebas obligatorias (Competencia Lectora y Competencia Matematica M1) y electivas (Matematica M2, Historia y Ciencias Sociales, Ciencias), la preparacion constante mediante simulacros reales es fundamental para el exito estudiantil.",
      "Replicar las condiciones del examen oficial del DEMRE exige aplicar ensayos con la misma estructura y tiempo asignado. Sin embargo, para docentes y preuniversitarios, la correccion manual de 65 a 80 preguntas por estudiante resulta agotadora. TuLector resuelve este cuello de botella permitiendo corregir un curso completo en menos de tres minutos.",
      "El generador de hojas de respuesta de TuLector permite configurar exactamente el formato PAES: 4 o 5 opciones de seleccion multiple (A, B, C, D, E), distribucion limpia y cuadricula para el RUT chileno con digito verificador. Esto acostumbra al estudiante al llenado correcto de la hoja antes de rendir la prueba oficial.",
      "Al escanear las hojas, el sistema procesa los puntajes y desglosa los resultados segun los ejes tematicos definidos por el DEMRE (Numeros, Algebra y Funciones, Geometria, Probabilidad y Estadistica en Matematica). Esto permite a las UTP y profesores jefes identificar de inmediato las brechas de aprendizaje y planificar reforzamientos focalizados.",
      "Los reportes se pueden exportar a planillas Excel compatibles con sistemas de gestion escolar o compartir directamente con estudiantes y apoderados a traves de enlaces individuales seguros.",
    ],
    faqs: [
      { q: "Cuantas preguntas tiene la PAES de Matematica M1?", a: "La prueba de Competencia Matematica M1 cuenta con 65 preguntas de 4 opciones cada una, de las cuales 60 son consideradas para el puntaje final y 5 son de pilotaje experimental." },
      { q: "Se puede exportar el puntaje a escala PAES (100 a 1000 puntos)?", a: "Si. TuLector permite configurar tablas de conversion de puntajes brutos a escala PAES o transformar a escala de notas tradicional de 1.0 a 7.0." },
      { q: "Soporta el formato de RUT con digito verificador K?", a: "Si, el bloque de identificador chileno en TuLector incluye la columna K y valida el algoritmo de Modulo 11." },
    ],
  },
  "correccion-automatica-ensayos": {
    slug: "correccion-automatica-ensayos",
    title: "Correccion automatica de ensayos: guia para docentes en Chile",
    excerpt: "Reduce el tiempo de correccion de ensayos de horas a minutos con tecnologia de lectura optica por camara movil y escala 1.0 a 7.0.",
    author: "Equipo TuLector",
    authorSlug: "equipo-tulector",
    resumenEjecutivo: "La correccion automatica de ensayos y pruebas estandarizadas con la camara del celular permite a docentes y colegios en Chile procesar cursos completos en 2 minutos. Con calculo automatico de notas de 1.0 a 7.0 al 60% de exigencia y exportacion a Excel, optimiza el tiempo pedagogico sin requerir costosos lectores opticos.",
    body: [
      "La carga administrativa de los docentes en Chile es una de las principales causas de sobrecarga laboral. La correccion manual de pruebas de seleccion multiple, controles de lectura y ensayos SIMCE o PAES toma entre 2 y 4 horas por curso. Con TuLector, ese tiempo se reduce a solo un par de minutos pasando la camara del celular sobre las hojas.",
      "TuLector incorpora la escala de calificaciones reglamentaria del Ministerio de Educacion de Chile (MINEDUC), permitiendo ajustar el porcentaje de exigencia (por defecto al 60%) y la nota minima (1.0), nota de aprobacion (4.0) y nota maxima (7.0). El calculo de notas es instantaneo y preciso.",
      "A diferencia de los lectores opticos tradicionales de sobremesa que requieren papel especial y calibraciones mecanicas complejas, TuLector funciona con cualquier impresora estandar en hojas bond comunes y con la camara de smartphones Android o navegadores web modernos.",
      "El analisis por item entrega un mapa de calor que revela de forma inmediata que alternativas incorrectas fueron seleccionadas con mayor frecuencia (distractores pedagogicos). Esto transforma la evaluacion en una potente herramienta formativa para la retroalimentacion en sala de clases.",
      "La plataforma es 100% compatible con los requerimientos del Decreto 67 de Evaluacion, facilitando el seguimiento del progreso academico y la elaboracion de informes para UTP y reuniones de apoderados.",
    ],
    faqs: [
      { q: "Como se calcula la escala de notas de 1.0 a 7.0?", a: "TuLector aplica la formula oficial chilena con punto de inflexion en el puntaje de corte (generalmente el 60% del puntaje maximo para obtener un 4.0)." },
      { q: "Puedo modificar la clave de respuestas despues de escanear?", a: "Si. Si detectas un error o decides anular una pregunta, puedes actualizar la clave y todos los puntajes y notas se recalculan automaticamente en tiempo real." },
      { q: "Los resultados se pueden importar en plataformas como Lirmi o Webclass?", a: "Si. Las planillas Excel exportadas por TuLector estan formateadas para facilitar el copiado y pegado directo o la importacion por RUT en las principales plataformas de gestion escolar chilenas." },
    ],
  },
  "como-automatizar-carga-notas-plataforma-dia": {
    slug: "como-automatizar-carga-notas-plataforma-dia",
    title: "Como automatizar la carga de respuestas en la plataforma DIA (Agencia de Calidad)",
    excerpt: "Guia para digitalizar las evaluaciones DIA en papel y cargar las respuestas automaticamente en la plataforma de la Agencia de Calidad con DIA Bot.",
    author: "Equipo TuLector",
    authorSlug: "equipo-tulector",
    resumenEjecutivo: "Automatiza la digitacion del Diagnostico Integral de Aprendizajes (DIA) de la Agencia de Calidad de la Educacion. Escanea las hojas de respuesta impresas con TuLector y utiliza la extension gratuita DIA Bot para transferir las alternativas de cada estudiante directamente a la plataforma oficial sin digitar una sola respuesta a mano.",
    body: [
      "El Diagnostico Integral de Aprendizajes (DIA) promovido por la Agencia de Calidad de la Educacion de Chile es una herramienta clave para evaluar los aprendizajes en tres momentos del ano escolar: Evaluacion Diagnostica (marzo), Monitoreo Intermedio (julio) y Evaluacion de Cierre (noviembre).",
      "Cuando los colegios optan por aplicar los instrumentos en formato papel, el cuerpo docente debe enfrentar el extenso trabajo de transcribir manualmente cada alternativa de cada estudiante en el portal web del DIA. Para un colegio con 500 alumnos, esto significa digitar decenas de miles de respuestas de forma repetitiva.",
      "TuLector y su extension asociada DIA Bot ofrecen una solucion integral: primero, los alumnos responden en las hojas de respuesta DIA; segundo, el docente escanea las hojas en segundos con la camara de su celular; tercero, la extension de Chrome DIA Bot lee los datos exportados e ingresa las respuestas en la plataforma oficial respetando la sesion segura del profesor.",
      "La extension realiza una simulacion previa antes de guardar cualquier cambio, mostrando un resumen visual de estudiantes validados, coincidencias y advertencias para que el docente tenga total control y tranquilidad sobre los datos.",
      "Esta tecnologia respeta los mas altos estandares de privacidad y seguridad: trabaja exclusivamente dentro de la sesion autenticada del usuario y nunca almacena contraseñas ni credenciales del portal ministerial.",
    ],
    faqs: [
      { q: "Que instrumentos del DIA son compatibles?", a: "TuLector incluye plantillas preconfiguradas para Lectura, Matematica, Historia y Ciencias de Ensenanza Basica y Media, asi como cuestionarios socioemocionales de seleccion multiple." },
      { q: "La extension DIA Bot pide mi clave de la Agencia de Calidad?", a: "No. La extension opera sobre la pestana donde ya iniciaste sesion normalmente, sin solicitar jamas tu usuario ni contraseña." },
      { q: "Cuanto tiempo se ahorra por curso?", a: "Un curso de 40 estudiantes que antes tomaba mas de 45 minutos de digitacion manual se completa en menos de 2 minutos." },
    ],
  },
  "hoja-de-respuestas-paes-pdf-descargar": {
    slug: "hoja-de-respuestas-paes-pdf-descargar",
    title: "Hojas de respuesta PAES en PDF: descarga y formato estandarizado",
    excerpt: "Descarga plantillas de hojas de respuesta tipo DEMRE en formato PDF listas para imprimir, con casillas de RUT y opciones A, B, C, D y E.",
    author: "Equipo TuLector",
    authorSlug: "equipo-tulector",
    resumenEjecutivo: "Descarga e imprime gratis hojas de respuesta estandarizadas para ensayos PAES y pruebas de seleccion multiple. Compatibles con lectura optica por camara de TuLector, incluyen cuadrícula para RUT chileno, formato de 4 o 5 alternativas y marcas de alineacion optica para correccion instantanea.",
    body: [
      "Contar con hojas de respuesta bien disenadas es indispensable para realizar simulacros academicos efectivos y entrenar a los estudiantes en el correcto llenado de pruebas estandarizadas como la PAES o el SIMCE.",
      "Las hojas generadas por TuLector cuentan con marcadores de posicion en las esquinas que permiten al algoritmo de vision computacional corregir automaticamente la inclinacion, la perspectiva y las sombras al momento de tomar la foto con el celular.",
      "Las plantillas incluyen campos para el nombre del estudiante, curso, fecha, codigo de prueba y un bloque estructurado para el RUT chileno con casillas individuales y columna para el digito verificador K.",
      "Estan optimizadas para impresion economica en blanco y negro en hojas tamano Carta o A4, permitiendo ahorrar presupuesto escolar y aprovechar papel comun sin necesidad de gramajes especiales.",
      "Una vez que los estudiantes marcan sus respuestas con lapiz grafito No. 2 o lapiz pasta negro, cualquier docente puede escanearlas desde la web o la app de TuLector sin importar si estan en la sala de clases o sin acceso a internet.",
    ],
    faqs: [
      { q: "Puedo personalizar la hoja con el logo de mi colegio?", a: "Si. En los planes Pro y School de TuLector puedes generar hojas de respuesta personalizadas con el nombre y logo de tu establecimiento educacional." },
      { q: "Que pasa si un estudiante borra una marca con goma?", a: "El algoritmo de TuLector mide la densidad del trazo y descarta borrones suaves, priorizando la marca oscura definitiva." },
      { q: "Se pueden imprimir en cualquier impresora convencional?", a: "Si, cualquier impresora laser o de inyeccion de tinta estandar en papel bond de 75g u 80g funciona perfectamente." },
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
  "correccion-automatica-examenes": {
    slug: "correccion-automatica-examenes",
    title: "Correccion automatica de examenes: guia CENEVAL y bachillerato",
    excerpt: "Optimiza la correccion de examenes tipo CENEVAL con tecnologia de lectura optica. Resultados inmediatos por alumno y grupo.",
    author: "Equipo TuLector",
    authorSlug: "equipo-tulector",
    resumenEjecutivo: "Digitaliza y califica examenes de opcion multiple en escuelas y preparatorias de Mexico. Con TuLector puedes procesar formatos tipo CENEVAL y EXANI en segundos con la camara del celular, obteniendo promedios y reportes en escala 0-10 de forma instantanea.",
    body: [
      "La calificacion de examenes en instituciones educativas mexicanas representa un consumo significativo de horas de trabajo docente. TuLector transforma cualquier smartphone en un escaner OMR de alta velocidad para calificar examenes parciales y departamentales sin errores.",
      "El sistema permite parametrizar la escala de calificacion mexicana de 5 a 10 o de 0 a 100, configurando reactivos de opcion multiple con 4 o 5 incisos y casillas para matricula o CURP.",
      "Los docentes obtienen reportes inmediatos por reactivo, lo que permite identificar conceptos no comprendidos antes de avanzar en el plan de estudios.",
      "Con soporte para trabajo offline y sincronizacion en la nube, TuLector es apto para planteles con conexiones a internet intermitentes.",
    ],
    faqs: [
      { q: "Soporta escala de calificacion 0 a 10?", a: "Si, es totalmente configurable segun el reglamento de evaluacion de la institucion." },
      { q: "Se puede usar con hojas fotocopiadas?", a: "Si, siempre que las marcas de las esquinas se mantengan visibles y bien alineadas." },
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
  "como-escanear-hojas-com-camera": {
    slug: "como-escanear-hojas-com-camera",
    title: "Como escanear folhas de resposta com a camera",
    excerpt: "Guia passo a passo para digitalizar folhas de resposta usando a camera do celular. Sem scanner OMR ou hardware especial.",
    author: "Equipe TuLector",
    authorSlug: "equipe-tulector",
    resumenEjecutivo: "Digitalize e corrija gabaritos com a camera do celular usando o TuLector. Imprima as folhas de resposta personalizadas, recolha as marcacoes dos alunos e aponte a camera para obter relatorios de desempenho instantaneos sem precisar de leitor optico fisico.",
    body: [
      "A correcao manual de provas em escolas e cursinhos vestibulares consome dias preciosos da rotina pedagogica. O TuLector transforma qualquer smartphone em um leitor optico de precisao, permitindo corrigir ate 20 folhas por minuto.",
      "As folhas contam com marcadores inteligentes que corrigem inclinacoes e reflexos de luz, garantindo precisao equivalente aos scanners OMR profissionais.",
      "Os dados sao organizados por turma e disciplina, permitindo exportar planilhas Excel e gerar links individuais para os estudantes acompanharem seus resultados.",
    ],
    faqs: [
      { q: "Precisa de internet para escanear?", a: "O aplicativo permite leitura offline e sincroniza os dados automaticamente assim que o aparelho conecta a rede." },
      { q: "Qual lapis e recomendado?", a: "Lapis preto HB No. 2 ou caneta esferografica preta ou azul escura." },
    ],
  },
  "fuvest-unicamp-vestibular": {
    slug: "fuvest-unicamp-vestibular",
    title: "FUVEST e UNICAMP: simulados para os principais vestibulares paulistas",
    excerpt: "Como preparar alunos para FUVEST, UNICAMP e outros vestibulares com simulados frequentes e correcao automatica.",
    author: "Equipe TuLector",
    authorSlug: "equipe-tulector",
    resumenEjecutivo: "Otimize a preparacao dos seus alunos para os vestibulares da FUVEST (USP), UNICAMP e UNESP. Crie simulados de primeira fase com 90 questoes de multipla escolha e obtenha notas e analises por disciplina em minutos.",
    body: [
      "Os vestibulares paulistas como FUVEST e UNICAMP possuem caracteristicas proprias e exigem alto nivel de preparo na primeira fase de multipla escolha. A aplicacao recorrente de simulados desenvolve ritmo de prova e confianca nos vestibulandos.",
      "Com o TuLector, cursinhos e colegios configuram o numero exato de questoes e alternativas dos vestibulares, geram os gabaritos em PDF e realizam a leitura optica imediata apos o termino da prova.",
      "O relatorio detalha a taxa de acerto por materia (Historia, Geografia, Biologia, Fisica, Quimica, Matematica, Portugues e Ingles), orientando a revisao dos pontos mais criticos.",
    ],
    faqs: [
      { q: "Suporta simulados de 90 questoes?", a: "Sim, e possivel gerar folhas de resposta de 10 a 100 questoes." },
      { q: "Calcula a nota de corte?", a: "O dashboard permite ordenar a classificacao geral e simular listas de convocacao para a segunda fase." },
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
  "correccion-automatica-ingresos": {
    slug: "correccion-automatica-ingresos",
    title: "Correccion automatica de examenes de ingreso universitario",
    excerpt: "Como los preuniversitarios y academias estan usando tecnologia OMR para corregir examenes de ingreso en minutos.",
    author: "Equipo TuLector",
    authorSlug: "equipo-tulector",
    resumenEjecutivo: "Optimiza la evaluacion de aspirantes a carreras universitarias e institutos terciarios en Argentina. Con TuLector podes corregir parciales de multiple choice en escala 1-10 al instante con el celular y exportar planillas completas a Excel.",
    body: [
      "Los institutos de preparacion universitaria y colegios secundarios en Argentina requieren herramientas agiles para evaluar a cientos de estudiantes en periodos de examenes.",
      "TuLector permite generar hojas de respuesta con campo de DNI y leerlas rapidamente en cualquier dispositivo movil, calculando promedios y porcentajes de aprobacion al instante.",
      "El analisis de respuestas brinda un panorama claro de los temas que requieren mayor refuerzo antes de las fechas oficiales de evaluacion.",
    ],
    faqs: [
      { q: "Soporta el formato de DNI argentino?", a: "Si, incluye casillas para documento nacional de identidad de hasta 8 digitos." },
      { q: "Se puede usar en escala 1 a 10 con 4 de aprobacion?", a: "Si, la escala de notas y nota de corte se configuran libremente." },
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
      "La Evaluacion Censal de Estudiantes (ECE) es aplicada por el Ministerio de Educacion del Peru (MINEDU) para medir los logros de aprendizaje en areas fundamentales como lectura y matematica. Se aplica anualmente a estudiantes de primaria y secundaria en todo el pais.",
      "Los resultados de la ECE tienen un impacto directo en la gestion pedagogica de los colegios. La preparacion con simulacros en el formato ECE permite a las instituciones monitorear los niveles de logro (Previo al inicio, En inicio, En proceso, Satisfactorio) a lo largo del ano escolar.",
      "TuLector permite replicar exactamente el formato de la ECE: cantidad de preguntas por area, numero de opciones y escala de calificacion cualitativa y cuantitativa.",
      "El proceso es especialmente util para colegios con multiples secciones del mismo grado. En lugar de corregir cientos de hojas a mano, tus docentes pueden escanear todas las hojas en minutos usando sus celulares.",
    ],
    faqs: [
      { q: "Que grados evalua la ECE?", a: "La ECE se aplica en 2do y 4to grado de primaria y 2do grado de secundaria en comprension lectora, matematica e historia/ciudadania." },
      { q: "TuLector permite configurar los niveles de logro del MINEDU?", a: "Si, puedes asignar equivalencias entre puntaje obtenido y los niveles de logro oficiales." },
    ],
  },
  "examen-admision-uni-preparacion": {
    slug: "examen-admision-uni-preparacion",
    title: "Examen de Admision UNI y San Marcos: estrategia de preparacion con simulacros",
    excerpt: "Como usar simulacros frecuentes para preparar el examen de admision de la UNI y UNMSM con correccion OMR instantanea.",
    author: "Equipo TuLector",
    authorSlug: "equipo-tulector",
    resumenEjecutivo: "Prepara a tus postulantes para los examenes de admision mas exigentes del Peru (UNI, San Marcos, PUCP). Con TuLector disenas simulacros de 100 preguntas con puntaje a favor y en contra, escaneas las fichas opticas con el celular y publicas el ranking general al instante.",
    body: [
      "Los examenes de admision a universidades peruanas como la Universidad Nacional de Ingenieria (UNI) y la Universidad Nacional Mayor de San Marcos (UNMSM) destacan por su alto nivel de competencia y formato de calificacion con puntos en contra por respuesta errada.",
      "Las academias preuniversitarias y colegios pre necesitan procesar miles de fichas opticas de simulacro cada fin de semana. TuLector permite escanear las fichas con cualquier celular, aplicando la formula de calificacion exacta (puntos positivos por acierto, penalizacion por error y cero puntos por pregunta en blanco).",
      "El cuadro de merito se genera de forma inmediata, permitiendo a los postulantes conocer su puntaje acumulado y posicion en el ranking respecto al corte de su carrera.",
    ],
    faqs: [
      { q: "Soporta puntaje con descuento por respuesta incorrecta?", a: "Si, puedes definir puntaje positivo por acierto y negativo por fallo segun el reglamento del examen." },
      { q: "Permite registrar DNI de postulante?", a: "Si, las hojas incluyen bloque para DNI de 8 digitos." },
    ],
  },
};
