# Investigacion profunda: Adaptacion de tuLector a Argentina

> Documento de investigacion, pagos y plan de adaptacion. Julio 2026.
> Perspectiva: empresa chilena (tuLector) expandiendose a Argentina.

---

## Indice

1. [Diagnostico estrategico: Chile vs Argentina](#0-diagnostico-estrategico-chile-vs-argentina)
2. [Sistema educativo argentino](#1-sistema-educativo-argentino)
3. [Escala de calificacion y evaluacion](#2-escala-de-calificacion-y-evaluacion)
4. [Pruebas mas usadas en Argentina](#3-pruebas-mas-usadas-en-argentina)
5. [Pruebas jurisdiccionales (provinciales)](#4-pruebas-jurisdiccionales-provinciales)
6. [Pruebas internacionales con participacion argentina](#5-pruebas-internacionales-con-participacion-argentina)
7. [Metodos de pago en Argentina](#6-metodos-de-pago-en-argentina)
8. [Estado actual de tuLector para Argentina](#7-estado-actual-de-tulector-para-argentina)
9. [Plan de adaptacion completo](#8-plan-de-adaptacion-completo)
10. [Implementacion tecnica por archivo](#9-implementacion-tecnica-por-archivo)
11. [Referencias oficiales](#10-referencias-oficiales)

---

## 0. Diagnostico estrategico: Chile vs Argentina

### Por que tuLector funciona en Chile

En Chile, el producto resuelve un problema claro y masivo:

| Necesidad | Solucion tuLector |
|-----------|-------------------|
| **PAES** (ex-PSU) — examen nacional de ingreso a la universidad, ~250K estudiantes/ano lo rinden, define el futuro academico | Ensayos PAES con hoja de respuesta identica a la oficial, puntaje escala 100-1000 |
| **SIMCE** — prueba censal nacional, todos los colegios deben rendirla | Ensayos tipo SIMCE para preparar a los cursos |
| **DIA** — diagnostico obligatorio de la Agencia de Calidad | Evaluaciones formativas con taxonomia DIA |
| **RUT** — identificador nacional unico con digito verificador | Lectura y validacion de RUT desde la hoja |
| **Escala 1-7** — estandar chileno de calificacion con exigencia 60% | Calculo de nota automatico con `calculateGrade()` |
| **Pago** — Flow/WebPay domina, Stripe como respaldo | Integracion Flow nativa funcional |

**Chile tiene UN solo gran examen que todo el pais prepara.** El producto calza perfecto.

### Por que Argentina es DIFERENTE (y que implica)

| Diferencia | Impacto para tuLector |
|------------|----------------------|
| **NO hay examen nacional de ingreso a la universidad** | No existe un "PAES argentino". No hay un mercado masivo de ~250K estudiantes preparando un mismo test. |
| **NO hay examen nacional de egreso secundario** | No hay un "high-stakes test" que motive compra de simulacros. |
| **Aprender es diagnostico, sin consecuencias para el alumno** | Los colegios no tienen incentivo fuerte para "preparar" a los alumnos. No afecta notas ni promocion. |
| **Cada universidad tiene su propio ingreso** (UBA=CBC, UTN=examen, UNLP/UNC=ingreso directo) | El mercado se fragmenta en N examenes distintos, no UN gran examen. |
| **24 jurisdicciones con autonomia curricular** | Las pruebas provinciales varian. No hay un "SIMCE" unico. |
| **Escala 1-10 con variaciones provinciales** (aprobacion 6 vs 7 segun provincia) | La exigencia debe ser configurable por provincia. |
| **DNI de 7-8 digitos, sin digito verificador** | Mas simple que el RUT chileno. |
| **Mercado de pagos fragmentado, control de cambios, brecha cambiaria, inflacion** | Cobrar desde Chile es complejo. Se requiere entidad local o PSP cross-border. |

### Donde SI hay mercado en Argentina

| Segmento | Tamano estimado | Competencia actual | Oportunidad tuLector |
|----------|----------------|-------------------|---------------------|
| **Ingresos universitarios (CBC UBA, UTN, privadas)** | ~500K estudiantes/ano entre todas las universidades | Academias presenciales, PDFs, Filadd (app de estudio) | **ALTA** — las hojas OMR permiten correccion masiva automatica de simulacros de ingreso |
| **Colegios secundarios (examenes de materia)** | ~11M estudiantes en el sistema | Correccion manual (profesor) | **ALTA** — el profesor genera la hoja, la imprime, los alumnos la rellenan, el profe la escanea y obtiene nota automatica |
| **Concursos docentes** | ~50K aspirantes/ano compitiendo por cargos titulares | Preparacion presencial, material en papel | **MEDIA** — el formato multiple choice es comun en las pruebas de oposicion |
| **Institutos de idiomas (Cambridge FCE/CAE, etc.)** | ~100K examenes/ano | Simulacros en papel corregidos a mano | **MEDIA** — tuLector perfecto para simular la hoja de respuesta de Cambridge |
| **Simulacros Aprender (colegios que preparan)** | Nicho (~5-10% de colegios preparan activamente) | Materiales oficiales gratis del gobierno | **BAJA** — sin stakes para el alumno, la demanda es limitada |
| **Universitarios (parciales multiple choice)** | ~2.5M universitarios | Correccion manual, Moodle, Google Forms | **MEDIA** — tuLector corrige mas rapido que Moodle si ya tenes la hoja impresa |

### Estrategia recomendada

**No intentar replicar el modelo chileno (PAES/SIMCE) en Argentina.** Ese modelo no existe.

En su lugar, enfocarse en:

1. **"El profesor como cliente principal"** — no el alumno individual. El profe crea el simulacro/examen, imprime 40 hojas, las reparte, y las escanea UNA por UNA con su telefono. Lo que en Chile es "ensayo PAES", en Argentina es "examen de Matematica de 3er ano".

2. **Posicionarse como "herramienta de correccion automatica"** generica, que funciona con CUALQUIER examen multiple choice, no atada a un test especifico. La hoja parametrica ya lo permite.

3. **Marketing por universidad** — "Simulacro CBC UBA con correccion instantanea", "Curso de ingreso UTN — practica con scanner automatico".

4. **Integracion con prepas/institutos** — academias como Filadd, Aulica, Clases y Aulas son el canal, no el alumno suelto.

---

## 1. Sistema educativo argentino

### Estructura (Ley de Educacion Nacional 26.206)

| Nivel | Edad | Duracion | Obligatorio |
|-------|------|----------|-------------|
| Educacion Inicial (sala 4 y 5) | 4-5 | 2 anos | Si |
| Educacion Primaria | 6-11/12 | 6 o 7 anos (segun provincia) | Si |
| Educacion Secundaria | 12/13-17/18 | 5 o 6 anos (segun provincia) | Si |
| Educacion Superior | 18+ | Variable | No |

**Dato clave**: 24 jurisdicciones educativas (23 provincias + CABA), cada una con cierta autonomia curricular. Los NAP (Nucleos de Aprendizajes Prioritarios) definen el piso comun nacional.

### Estructura primaria por provincia

- **6 anos**: Formosa, Tucuman, Catamarca, San Juan, San Luis, Cordoba, Corrientes, Entre Rios, La Pampa, Buenos Aires, Chubut, Tierra del Fuego, Santa Fe
- **7 anos**: Rio Negro, Neuquen, Santa Cruz, Mendoza, CABA, La Rioja, Santiago del Estero, Chaco, Misiones, Salta, Jujuy

### Modalidades (8 reconocidas por ley)

1. Educacion Tecnico Profesional
2. Educacion Artistica
3. Educacion Especial
4. Educacion Permanente de Jovenes y Adultos
5. Educacion Rural
6. Educacion Intercultural Bilingue
7. Educacion Domiciliaria y Hospitalaria
8. Educacion en Contextos de Privacion de Libertad

---

## 2. Escala de calificacion y evaluacion

### Escala nacional (nivel primario y secundario)

| Escala | Minimo | Maximo | Aprobacion | Exigencia |
|--------|--------|--------|------------|-----------|
| Argentina | 1 | 10 | 6 | 60% |

**Niveles cualitativos comunes (varian por jurisdiccion):**

| Nota | Concepto |
|------|----------|
| 9-10 | Sobresaliente / Excelente |
| 7-8 | Muy Bueno |
| 6 | Bueno / Aprobado |
| 4-5 | Regular / En Proceso |
| 1-3 | Insuficiente / No alcanzado |

### Diferencias jurisdiccionales importantes

Algunas provincias usan escalas alternativas o informes cualitativos:

| Jurisdiccion | Escala |
|-------------|--------|
| CABA | 1-10 (aprobacion 6) |
| Provincia de Buenos Aires | 1-10 (aprobacion 7 en nivel primario en algunos distritos) |
| Cordoba | 1-10 (aprobacion 6) |
| Santa Fe | 1-10 (aprobacion 6) |
| Mendoza | 1-10 (aprobacion 7) |

> **Impacto para tuLector**: La exigencia del 60% como default para Argentina es correcta, pero debe ser configurable por institucion/provincia.

### Regimenes de promocion

- La promocion se define por promedio anual
- El regimen de evaluacion, acreditacion y promocion es definido por cada jurisdiccion
- La Resolucion CFE N 174/12 establece criterios federales minimos

---

## 3. Pruebas mas usadas en Argentina

> **Hallazgo clave**: Argentina NO tiene un examen nacional de ingreso universitario (como PAES en Chile o ENEM en Brasil) ni un examen nacional de egreso secundario. El mercado de pruebas es radicalmente distinto al chileno.

### 3.1 Aprender — Prueba nacional diagnostica (NO tiene stakes para el alumno)

**Organismo**: Secretaria de Educacion de la Nacion (Subsecretaria de Informacion y Evaluacion Educativa).

**Caracteristica critica**: Es una prueba **diagnostica y anonima**. No afecta notas, promocion ni graduacion. Los resultados son para el sistema educativo, no para el alumno individual. Esto la hace radicalmente diferente al SIMCE chileno (que tiene consecuencias reputacionales para el colegio) o a la PAES (que define el ingreso universitario).

**Datos Aprender 2023-2024:**

| Ano | Nivel | Areas | Estudiantes | Escuelas |
|-----|-------|-------|-------------|----------|
| 2023 | 6 Primaria | Lengua, Matematica | ~615K | ~19,272 |
| 2024 | 5/6 Secundaria | Lengua, Matematica | ~379K | ~11,846 |
| 2024 | 3 Primaria (muestral) | Lengua | ~91K | ~4,178 |
| 2025 | Programado | — | ~750K estimados | ~20,000 |

**Niveles de desempeno Aprender (escala 0-100):**

| Nivel | Rango | Descripcion |
|-------|-------|-------------|
| Por debajo del basico | 0-39 | No logra resolver consignas basicas |
| Basico | 40-59 | Resuelve parcialmente, requiere apoyo |
| Satisfactorio | 60-79 | Alcanza los aprendizajes esperados |
| Avanzado | 80-100 | Supera ampliamente los aprendizajes |

**Oportunidad para tuLector**: BAJA. Pocos colegios preparan activamente a sus alumnos para Aprender porque no tiene consecuencias. Algunos colegios privados de elite compran simulacros, pero es un nicho pequeño.

### 3.2 Examenes de ingreso universitario — El mercado REAL

Argentina tiene **ingreso universitario descentralizado**. Cada universidad define su mecanismo. Esto fragmenta el mercado pero crea oportunidades por universidad:

| Universidad | Mecanismo de ingreso | Tipo | Demanda anual | Oportunidad tuLector |
|-------------|---------------------|------|---------------|---------------------|
| **UBA** | CBC (Ciclo Basico Comun) — 6 materias en 1 ano, ~48% aprobacion en 1er ano | Nivelatorio, no es un examen unico | ~70K ingresantes/ano | **ALTA** — Academias pre-CBC usarian hojas OMR para simulacros de Matematica, Semiologia, IPC, etc. |
| **UTN** | Examen de ingreso eliminatorio (Matematica, Fisica, Orientacion Universitaria) | Examen + curso | ~20K aspirantes/ano | **MUY ALTA** — Es uno de los pocos examenes de ingreso eliminatorios del pais. Las academias pre-UTN son un mercado activo |
| **UNLP** | Ingreso directo + curso de nivelacion no eliminatorio | Curso introductorio | ~30K ingresantes/ano | BAJA — sin examen eliminatorio no hay presion por prepararse |
| **UNC (Cordoba)** | Ingreso directo + cursos de nivelacion por facultad | Curso por facultad | ~40K ingresantes/ano | MEDIA — algunas facultades (Medicina, Ingenieria) tienen nivelaciones exigentes |
| **UNR (Rosario)** | Ingreso directo | Directo | ~20K ingresantes/ano | BAJA |
| **UCA y privadas** | Curso de ingreso evaluado | Curso con evaluacion | ~50K entre todas | MEDIA — algunas tienen filtros reales, varian por universidad |

**Estrategia**: Apuntar al ecosistema de **academias/institutos preuniversitarios** que preparan para el CBC (UBA) y el ingreso UTN. Estas academias ya venden cursos de preparacion y necesitan corregir masivamente simulacros. tuLector les ahorraria horas de correccion manual.

### 3.3 Examenes escolares de materia — El mercado COTIDIANO

**NO es una "prueba estandarizada nacional" pero es el uso mas masivo y recurrente:**

| Tipo | Frecuencia | Volumen |
|------|-----------|---------|
| Examenes de materia (Matematica, Lengua, Historia, etc.) | 2-4 por materia por trimestre | **Millones** de examenes por ano |
| Pruebas de diagnostico de inicio de ano | 1 por curso por materia | Colegios con >100 alumnos/curso |
| Recuperatorios e instancias de diciembre/febrero | Variable | Miles por colegio |
| Simulacros internos antes de examenes provinciales | 1-2 por ano | Variable |

**Impacto**: Un profesor de secundaria que toma un examen multiple choice a 40 alumnos tarda ~2 horas en corregirlo a mano. Con tuLector tarda 20 minutos (imprimir hojas + escanear). Ese ahorro de tiempo es el valor central.

### 3.4 Concursos docentes (pruebas de oposicion)

Cada provincia tiene su propio sistema de concursos para ingreso y ascenso docente. Las **pruebas de oposicion** suelen incluir:
- Examen escrito de conocimientos pedagogicos y disciplinares (frecuentemente multiple choice)
- Evaluacion de antecedentes (titulos, capacitaciones)
- Defensa oral o clase simulada

| Provincia | Modalidad | Postulantes/ano |
|-----------|-----------|-----------------|
| Provincia de Buenos Aires | Listados 108A/108B + Concurso de Titularizacion | ~30K |
| CABA | Examen escrito + puntaje por antecedentes | ~10K |
| Cordoba, Santa Fe, Mendoza | Juntas de Clasificacion con examen escrito (varia) | ~5-10K cada una |

**Oportunidad**: MEDIA — los institutos de preparacion para concursos docentes podrian usar tuLector para simulacros.

### 3.5 Certificaciones de idiomas (Cambridge, IELTS, DELE)

Mercado activo y en crecimiento. Argentina tiene una cultura fuerte de certificacion de ingles:

| Examen | Organismo | Volumen anual estimado en AR |
|--------|-----------|------------------------------|
| FCE (B2 First) | Cambridge | ~25K candidatos/ano |
| CAE (C1 Advanced) | Cambridge | ~10K candidatos/ano |
| IELTS | British Council | ~8K candidatos/ano |
| DELE | Instituto Cervantes | ~3K candidatos/ano |

**Oportunidad**: MEDIA — todos usan hoja de respuesta tipo multiple choice para la seccion de Reading/Use of English. Las academias de ingles (Liceo Britanico, AACI, ICANA, Wall Street English) ya preparan alumnos con simulacros. tuLector corrige instantaneamente lo que hoy corrigen a mano.

---

## 4. Pruebas jurisdiccionales (provinciales)

### 4.1 FEPBA — Evaluacion Formativa de la Provincia de Buenos Aires (2024+)

- **Jurisdiccion**: Provincia de Buenos Aires
- **Niveles**: 3 y 6 grado de primaria
- **Areas**: Practicas del Lenguaje, Matematica
- **Escala**: Niveles cualitativos (Inicial, En Proceso, Consolidado)
- **Caracter**: Censal (~290K estudiantes en 2024)

### 4.2 Otros operativos provinciales

| Provincia | Evaluacion | Nivel | Areas |
|-----------|------------|-------|-------|
| CABA | Evaluacion de la Calidad Educativa (desde 2020) | 3, 6 primaria; 2, 5 secundaria | Lengua y Matematica |
| Cordoba | Operativo Provincial de Evaluacion | 3, 6 primaria | Lengua, Matematica |
| Mendoza | Evaluacion Provincial de Aprendizajes | Primaria y Secundaria | Lengua, Matematica |
| Rio Negro | Dispositivo Provincial de Evaluacion | Primaria | Lengua, Matematica |

> **Para tuLector**: Con las hojas parametricas ya implementadas (`hoja-parametrica-spec.md`), un colegio puede configurar cualquier ensayo que simule estas pruebas jurisdiccionales.

---

## 5. Pruebas internacionales con participacion argentina

### 5.1 PISA (Programme for International Student Assessment)

- **Organismo**: OECD
- **Frecuencia**: Cada 3 anos (ultima: 2022, resultados publicados dic 2023)
- **Poblacion**: Estudiantes de 15 anos
- **Areas**: Lectura, Matematica, Ciencias
- **Argentina en PISA 2022**:
  - Lectura: 399 puntos (promedio OECD: 476)
  - Matematica: 377 puntos (promedio OECD: 472)
  - Ciencias: 406 puntos (promedio OECD: 485)
  - Posicion: 65 entre 81 paises

### 5.2 ERCE (Estudio Regional Comparativo y Explicativo)

- **Organismo**: UNESCO / LLECE (Laboratorio Latinoamericano de Evaluacion de la Calidad de la Educacion)
- **Frecuencia**: ~6 anos (ERCE 2019 ultimo; ERCE 2025 en preparacion)
- **Niveles**: 3 y 6 grado de primaria
- **Areas**: Lectura, Matematica, Ciencias
- **Niveles de desempeno ERCE (Lectura, Matematica):**

| Nivel | Descripcion |
|-------|-------------|
| Nivel I | Desempeno mas bajo |
| Nivel II | Desempeno basico |
| Nivel III | Desempeno esperado |
| Nivel IV | Desempeno destacado |

### 5.3 ICCS (Estudio Internacional de Educacion Civica y Ciudadana)

- **Argentina participa**: Si (desde 2009)
- **Poblacion**: 8 grado / 2 ano secundaria
- **Area**: Formacion civica y ciudadana

### 5.4 PIAAC (Programme for the International Assessment of Adult Competencies)

- **Poblacion**: Adultos 16-65
- **Areas**: Comprension lectora, matematicas, resolucion de problemas

---

## 6. Metodos de pago en Argentina

> ⚠️ **Actualizado Julio 2026**: La estrategia de pagos cambio a **dLocal** como pasarela unificada para todos los paises LATAM. Ver `docs/dlocal-pasarela-unificada.md`. Una sola integracion cubre este pais y los otros 7.

### 6.1 Ecosistema de pagos digitales argentino (2024-2026)

| Metodo | Tipo | Penetracion | Relevancia para SaaS |
|--------|------|-------------|---------------------|
| **MercadoPago** | Billetera digital / PSP | ~50M+ usuarios registrados. 8 de cada 10 argentinos lo usan. | **IMPRESCINDIBLE** — domina el checkout online, acepta tarjetas + saldo de billetera + efectivo |
| **Tarjetas de credito/debito** | Tradicional | ~40M debito, ~20M credito | Necesario. Visa/Mastercard universales. Cuotas sin interes (Ahora 3/6/12) son CLAVE para vender. |
| **Transferencia bancaria (CBU/CVU)** | Pago inmediato | Transferencias 3.0 (BCRA). QR interoperable desde 2021. | Importante para B2B (colegios pagan desde cuenta bancaria). |
| **MODO** | Billetera de bancos | +35 bancos. Crece fuerte. | Complementario a MP. No criticio si ya tenes MP. |
| **Uala** | Billetera digital / tarjeta prepaga | ~5M+ usuarios. Jovenes y no bancarizados. | Segmento joven/estudiantes. |
| **Pago Facil / Rapipago** | Efectivo en locales fisicos | 8,000+ puntos en todo el pais. | Importante si el target incluye consumidores no bancarizados (~30% de la poblacion). Para colegios/instituciones es menos relevante. |
| **Cripto (Lemon, Belo, Buenbit)** | Billeteras cripto-fiat | ~12-15% de la poblacion. | Nicho. No prioritario para un SaaS educativo. |

### 6.2 Costos de MercadoPago Argentina (julio 2026)

| Velocidad de cobro | Tarjeta / QR | Suscripciones |
|--------------------|-------------|---------------|
| Inmediato | 6.29% + IVA = **7.61%** | 6.99% + IVA = **8.46%** |
| 10 dias | 4.39% + IVA = **5.31%** | 4.49% + IVA = **5.43%** |
| 18 dias | 3.39% + IVA = **4.10%** | 3.39% + IVA = **4.10%** |
| 35 dias | 1.49% + IVA = **1.80%** | 1.49% + IVA = **1.80%** |

**Comparacion Chile (MercadoPago):**

| Velocidad | Tarjeta |
|-----------|---------|
| Inmediato | 3.19% + IVA = **3.80%** |
| 10 dias | 2.89% + IVA = **3.44%** |

> Las comisiones en Argentina son **el doble** que en Chile. Impacto directo en margenes.

### 6.3 El problema del cobro cross-border (Chile → Argentina)

**Bloqueo actual en tuLector**: La pasarela MercadoPago para paises que no son Chile retorna HTTP 501 ("La pasarela para este pais aun no esta habilitada"). `src/app/api/billing/checkout/route.ts:86-87`.

**Por que**: MercadoPago opera en silos nacionales (MLA=Argentina, MLC=Chile, etc.). Una empresa con cuenta en Chile NO puede procesar pagos en ARS de usuarios argentinos. Requiere una cuenta MP Argentina separada.

**Opciones para resolverlo:**

| Opcion | Complejidad | Costo | Tiempo | Recomendada |
|--------|------------|-------|--------|-------------|
| **dLocal — Pasarela unificada LATAM** | Baja | Comisiones ~3-8% | **Ya implementado** | **ADOPTADA** — Ver `docs/dlocal-pasarela-unificada.md`. Cubre Argentina + 7 paises mas. |
| ~~A. Crear entidad legal en Argentina (SRL)~~ | — | — | — | Postergado. dLocal elimina la urgencia. |
| ~~B. PSP cross-border (dLocal, EBANX)~~ | — | — | — | dLocal ya implementado. |
| C. Cobrar en USD con tarjeta internacional (Stripe) | Baja | ~3-4% | Ya implementado | Fallback. Solo para tarjetas internacionales. |
| D. Precios en USD + crypto (USDT/USDC) | Baja | ~1-2% | 1-2 semanas | Nicho. |
| E. Partner local argentino | Media | Negociable | 2-4 semanas | Alternativa. |

### 6.4 Problemas macroeconomicos argentinos a considerar

| Problema | Impacto | Mitigacion |
|----------|---------|------------|
| **Inflacion** (~2-3% mensual en 2026, aunque bajando) | Precios en ARS se devaluan rapido | **Precios en USD**. Ya se hace en `billing_catalog.ts` (AR = USD 25 Pro / USD 120 School) |
| **Brecha cambiaria** (oficial vs MEP/CCL, ~1-5% en 2026) | Perdida al repatriar ARS a CLP/USD | Minimal actualmente (brecha casi cerrada con Milei). Pero monitorear. |
| **Control de cambios (cepo)** | Dificulta girar dolares al exterior | Usar MEP/CCL (legal, via bonos) o facturar desde Chile en USD |
| **Impuesto PAIS (30%)** | Lo paga el comprador argentino al usar tarjeta en USD, no el vendedor | Precio final alto para el consumidor. Las cuotas sin interes atenuan esto. |
| **IVA digital (21%)** | Si facturas desde Chile a consumidor final argentino, aplica IVA servicios digitales | Complejo. La entidad local simplifica esto. |
| **Retencion de ganancias** (15-35% a pagos al exterior) | Si el colegio argentino te paga via transferencia SWIFT | El tratado de doble imposicion Chile-Argentina (2015) lo reduce. |

### 6.5 Estrategia de pagos recomendada para Argentina

**Estrategia actual (Julio 2026):** dLocal como pasarela unificada (ver `docs/dlocal-pasarela-unificada.md`). Cubre todos los metodos de pago locales (MercadoPago, tarjetas, transferencias, efectivo) sin necesidad de entidad local.

**Fases historicas (pre-dLocal, mantenidas como contexto):**
- ~~Fase 1: Stripe USD para early adopters~~ → Cubierto por dLocal
- ~~Fase 2: dLocal/EBANX cross-border~~ → dLocal implementado
- ~~Fase 3: Entidad legal + MP Argentina~~ → Postergado (dLocal elimina la urgencia)

### 6.6 Mercado de pagos chileno (contexto de donde viene tuLector)

|Metodo|Penetracion|Estado en tuLector|
|------|-----------|-------------------|
|**Flow** (agregador: WebPay, Servipag, Mach, tarjetas)|~80% del e-commerce chileno|✅ Integrado y funcional. Comisiones ~2.9%+IVA|
|**WebPay/Transbank**|Red adquirente detras de Flow|✅ Via Flow|
|**Stripe**|Tarjetas internacionales|⚠️ Codigo listo, keys no configuradas|
|**MercadoPago Chile**|Menor que en Argentina pero creciendo|⚠️ Codigo listo pero bloqueado para no-CL|
|**Khipu**|Transferencias bancarias directas|❌ No implementado|

---

## 7. Estado actual de tuLector para Argentina

### 7.1 Lo que YA esta implementado

| Componente | Archivo | Estado |
|------------|---------|--------|
| Configuracion de pais AR | `src/lib/latam.ts:25-32` | ✅ Escala 1-10, aprobacion 6, exigencia 60%, DNI |
| Calculo de nota Argentina | `src/lib/latam.ts:66-105` | ✅ `calculateGrade()` con soporte AR |
| Sistema Aprender definido | `src/lib/evaluation.ts:63-69` | ✅ `code: "Aprender"` con niveles y areas |
| Exportacion CSV formato AR | `src/lib/evaluation.ts:323-329` | ✅ DNI, nombre, curso, puntaje, porcentaje, nivel |
| Validacion DNI | `src/lib/latam.ts:108-119` | ✅ Formato /^[0-9]{7,8}$/ |
| Hojas configurables (1/2 col) | `src/lib/sheet_layout.ts`, `src/tulector/sheet_layout.ts` | ✅ Cualquier n preguntas/opciones |
| OMR engine (motor lector) | `src/tulector/omr.ts` | ✅ Funciona con cualquier hoja 1200x1650 |

### 7.2 Lo que FALTA implementar (ahora incluye pagos)

| Componente | Estado | Prioridad |
|------------|--------|-----------|
| Perfil de pais AR en `country_profiles.ts` | ❌ Solo CL existe | **ALTA** |
| Locale `es-AR` | ❌ Solo `es-CL`, `en`, `pt-BR` | **ALTA** |
| Niveles de desempeno `AR_Aprender` en `PERFORMANCE_LEVELS` | ❌ No definidos | **ALTA** |
| Taxonomia curricular AR en `CURRICULUM_TAXONOMIES` | ❌ No definida | **ALTA** |
| **Pasarela de pago Argentina funcional** | ✅ dLocal como pasarela unificada LATAM | **CRITICA** |
| **Stripe configurado con keys reales** | ⬜ Codigo listo (fallback historico), sin keys | BAJA |
| Evaluacion `ERCE` en `EVALUATION_SYSTEMS` | ❌ No definido | MEDIA |
| Evaluacion `PISA` en `EVALUATION_SYSTEMS` | ❌ No definido | MEDIA |
| Escala FEPBA (BsAs) en `evaluation.ts` | ❌ No definida | MEDIA |
| **Soporte para cuotas (Ahora 12/18)** | ❌ No implementado | MEDIA |
| Exportacion CSV formato `FEPBA` o `CABA` | ❌ No definido | BAJA |
| Validacion de CUIL/CUIT como ID adicional | ❌ Solo DNI | BAJA |
| Mapa de equivalencias Aprender <-> PISA | ❌ No implementado | BAJA |
| NAPs (contenidos curriculares) | ❌ No mapeados | BAJA |
| Equivalencia puntaje Aprender (escala 0-100) | ⚠️ Definida pero sin performance levels | **ALTA** |

### 7.3 Compatibilidad de la hoja de respuesta con Argentina

La hoja actual de tuLector (1200x1650px, anclas en 4 esquinas, burbujas A-E, ID numerico) es **totalmente compatible** con el sistema argentino:

- **DNI argentino** (7-8 digitos): ✅ La grilla de ID del lector soporta digitos numericos con grilla 3x10 (3 filas x 10 columnas de digitos 0-9). El DNI argentino cabe perfectamente.
- **Opciones A-B-C-D-E**: ✅ Misma nomenclatura.
- **Numero de preguntas variable**: ✅ Soporta 10-50 preguntas con 1-2 columnas.
- **Escala de notas**: ✅ La formula chilena con exigencia se adapta a Argentina (60% de exigencia).

---

## 8. Plan de adaptacion completo

### Fase 0: Pagos — Cubierto por dLocal (CRITICA — ~0.5 horas)

> ⚠️ **Actualizado Julio 2026**: Pagos: cubierto por dLocal (ver `docs/dlocal-pasarela-unificada.md`). No se requiere integracion adicional por pais. Una sola integracion cubre Argentina y los otros 7 paises LATAM.

**Objetivo**: Que un cliente argentino pueda pagar via dLocal con metodos locales (MercadoPago, tarjetas, transferencias, efectivo).

**Archivos a modificar:**
- Ninguno especifico de Argentina — dLocal se integra una sola vez a nivel global.

> El codigo de checkout multi-gateway (Stripe, MercadoPago) abajo se conserva como referencia historica. La implementacion real usa `gateway = "dlocal"`.

**Sub-tareas con codigo exacto (referencia historica):**

#### Tarea 0.0 — Instalar dependencia Stripe

```bash
npm install stripe
```

#### Tarea 0.1 — Agregar `createStripeCheckoutSession()` en `src/lib/stripe.ts`

Reemplazar TODO el archivo `src/lib/stripe.ts` con:

```typescript
import "server-only";
import Stripe from "stripe";

export function getStripeConfig() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
  };
}

export function assertStripeConfigured() {
  const config = getStripeConfig();
  if (!config.configured) throw new Error("Stripe no esta configurado. Define STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET y NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.");
  return config;
}

export async function createStripeCheckoutSession(options: {
  amountCents: number;
  currency: string;
  description: string;
  orderId: string;
  successUrl: string;
  cancelUrl: string;
  schoolId: string;
}): Promise<{ url: string; sessionId: string }> {
  const config = assertStripeConfigured();
  const stripe = new Stripe(config.secretKey!, { apiVersion: "2025-06-16.basil" as any });

  if (!config.secretKey || config.secretKey === "sk_live_...") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Stripe no esta configurado para procesar pagos reales.");
    }
    console.log("[stripe] MOCK: Creando sesion simulacion:", options);
    const mockSessionId = `mock_stripe_session_${Date.now()}`;
    return {
      url: `/api/billing/mock-payment?gateway=stripe&token=${mockSessionId}&orderId=${options.orderId}`,
      sessionId: mockSessionId,
    };
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [{
      price_data: {
        currency: options.currency,
        product_data: { name: options.description },
        unit_amount: options.amountCents,
      },
      quantity: 1,
    }],
    metadata: {
      order_id: options.orderId,
      school_id: options.schoolId,
    },
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
  });

  if (!session.url) throw new Error("Stripe no retorno URL de checkout");

  return { url: session.url, sessionId: session.id };
}

export async function getStripeSession(sessionId: string): Promise<{
  status: string;
  amountTotal: number;
  currency: string;
  metadata: Record<string, string>;
}> {
  const config = assertStripeConfigured();
  const stripe = new Stripe(config.secretKey!, { apiVersion: "2025-06-16.basil" as any });

  if (!config.secretKey || config.secretKey === "sk_live_...") {
    if (sessionId.startsWith("mock_stripe_session_")) {
      const orderId = sessionId.split("_orderId_")[1] || "mock_order";
      return { status: "complete", amountTotal: 2500, currency: "usd", metadata: { order_id: orderId } };
    }
    throw new Error("Stripe no esta configurado y la sesion no es mock.");
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return {
    status: session.status ?? "unknown",
    amountTotal: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    metadata: session.metadata ?? {},
  };
}
```

#### Tarea 0.2 — Crear webhook de Stripe: `src/app/api/billing/webhook/stripe/route.ts`

Crear archivo NUEVO:

```typescript
import { NextResponse } from "next/server";
import { assertStripeConfigured, getStripeSession } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { markOrderPaidAndApplyEntitlement } from "@/lib/billing_orders";
import Stripe from "stripe";

export async function POST(request: Request) {
  try {
    const config = assertStripeConfigured();
    const stripe = new Stripe(config.secretKey!, { apiVersion: "2025-06-16.basil" as any });
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Falta firma" }, { status: 400 });
    }

    const rawBody = await request.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret!);
    } catch {
      return NextResponse.json({ error: "Firma invalida" }, { status: 400 });
    }

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ status: "ignored", event: event.type });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    if (!orderId) return NextResponse.json({ error: "Falta order_id en metadata" }, { status: 400 });

    const admin = createSupabaseAdminClient();
    await markOrderPaidAndApplyEntitlement(admin, orderId, {
      expectedAmountCents: session.amount_total ?? 0,
      expectedCurrency: (session.currency ?? "usd").toLowerCase(),
      gateway: "stripe",
      gatewayPaymentId: session.id,
      billingPeriodMonths: 12,
    });

    return NextResponse.json({ status: "success", order_id: orderId });
  } catch (err: unknown) {
    console.error("[stripe_webhook] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Excepcion" }, { status: 500 });
  }
}
```

#### Tarea 0.3 — Reemplazar el checkout route completo

Reemplazar TODO `src/app/api/billing/checkout/route.ts` con la version multi-gateway:

```typescript
import { NextResponse } from "next/server";
import { assertSchoolAdmin, getDashboardContext } from "@/lib/supabase_server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createFlowPayment, getFlowConfig } from "@/lib/flow";
import { createStripeCheckoutSession } from "@/lib/stripe";
import { createMercadoPagoPreference } from "@/lib/mercadopago";
import { canonicalRut } from "@/lib/rut";
import { isMissingColumnError } from "@/lib/supabase_errors";
import {
  readBillingDetailsPayload,
  parseBillingCheckoutInput,
  resolveBillingCatalogItem,
  type ChileanBillingDetails,
} from "@/lib/billing_catalog";

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 160).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

async function parseChileanBillingDetails(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  payload: Record<string, unknown>,
  accountEmail: string,
): Promise<ChileanBillingDetails | null> {
  const taxIdInput = cleanText(payload.taxId ?? payload.tax_id, 20);
  const canonicalTaxId = taxIdInput ? canonicalRut(taxIdInput) : null;
  const legalName = cleanText(payload.legalName ?? payload.legal_name, 160);
  const businessActivity = cleanText(payload.businessActivity ?? payload.business_activity, 160);
  const email = accountEmail;
  const phone = cleanText(payload.phone, 40) || null;
  const addressLine = cleanText(payload.addressLine ?? payload.address_line, 180);
  const regionCode = cleanText(payload.regionCode ?? payload.region_code, 20).toUpperCase();
  const commune = cleanText(payload.commune ?? payload.comuna, 120).toUpperCase();

  if ((taxIdInput && !canonicalTaxId) || legalName.length < 3 || businessActivity.length < 3 || !email || addressLine.length < 5 || !regionCode || !commune) {
    return null;
  }

  const { data: communeRow, error } = await admin
    .from("comunas")
    .select("region_cod, region_nombre, comuna")
    .eq("region_cod", regionCode)
    .eq("comuna", commune)
    .maybeSingle();

  if (error || !communeRow) return null;
  return { taxId: canonicalTaxId, legalName, businessActivity, email, phone, addressLine, regionCode: communeRow.region_cod, regionName: communeRow.region_nombre || regionCode, commune: communeRow.comuna };
}

/** Billing details minimo para paises no chilenos (Stripe / MercadoPago). */
interface WorldBillingDetails {
  legalName: string;
  email: string;
  country: string;
}

function parseWorldBillingDetails(accountEmail: string, schoolCountry: string): WorldBillingDetails | null {
  if (!accountEmail) return null;
  return { legalName: "Institucion", email: accountEmail, country: schoolCountry };
}

export async function POST(request: Request) {
  try {
    const { school, user, isAdmin } = await getDashboardContext();
    try { assertSchoolAdmin(isAdmin); } catch {
      return NextResponse.json({ error: "Solo un administrador puede contratar planes o comprar escaneos." }, { status: 403 });
    }

    let payload: unknown;
    try { payload = await request.json(); } catch {
      return NextResponse.json({ error: "El cuerpo de la solicitud no es JSON valido." }, { status: 400 });
    }

    const input = parseBillingCheckoutInput(payload);
    if (!input) return NextResponse.json({ error: "Solicitud de pago invalida." }, { status: 400 });

    const item = resolveBillingCatalogItem(input, school.country_code);
    const accountEmail = cleanEmail(user.email);
    if (!accountEmail) {
      return NextResponse.json({ error: "Tu cuenta no tiene un correo valido para iniciar el pago." }, { status: 422 });
    }

    // ─── Router multi-gateway ───
    const admin = createSupabaseAdminClient();
    let redirectUrl = "";
    let sessionToken = "";
    let billingDetails: Record<string, unknown> = {};

    if (item.gateway === "flow") {
      // ─── Chile: Flow ───
      const flowConfig = getFlowConfig();
      if (!flowConfig.configured && process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Flow no esta configurado para pagos reales." }, { status: 503 });
      }
      if (flowConfig.sandbox && process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Flow sandbox no esta permitido en produccion." }, { status: 503 });
      }
      const chileanDetails = await parseChileanBillingDetails(admin, readBillingDetailsPayload(payload), accountEmail);
      if (!chileanDetails) {
        return NextResponse.json({ error: "Completa datos de facturacion validos para Chile." }, { status: 422 });
      }
      billingDetails = chileanDetails as unknown as Record<string, unknown>;
      const flowResult = await createFlowPayment({
        amount: item.amount, email: accountEmail, subject: item.description,
        commerceOrder: "", // se completa abajo con el order.id real
        urlConfirmation: "", urlReturn: "",
      });
      redirectUrl = flowResult.url;
      sessionToken = flowResult.token;
    } else if (item.gateway === "stripe") {
      // ─── Argentina / Global: Stripe ───
      const worldDetails = parseWorldBillingDetails(accountEmail, school.country_code ?? "AR");
      if (!worldDetails) {
        return NextResponse.json({ error: "Correo invalido para iniciar el pago." }, { status: 422 });
      }
      billingDetails = worldDetails as unknown as Record<string, unknown>;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const stripeResult = await createStripeCheckoutSession({
        amountCents: item.amountCents, currency: item.currency, description: item.description,
        orderId: "", schoolId: school.id,
        successUrl: `${siteUrl}/dashboard/billing?order_id={ORDER_ID}`,
        cancelUrl: `${siteUrl}/dashboard/billing?cancelled=1`,
      });
      redirectUrl = stripeResult.url;
      sessionToken = stripeResult.sessionId;
    } else if (item.gateway === "mercadopago") {
      // ─── LATAM sin MP local aun habilitado → Stripe fallback ───
      return NextResponse.json({
        error: "La pasarela MercadoPago para este pais aun no esta habilitada. Contactanos para activar pagos institucionales.",
      }, { status: 501 });
    }

    // ─── Insertar orden ───
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    let orderInsert = await admin
      .from("orders")
      .insert({
        school_id: school.id,
        type: item.type,
        status: "pending",
        scans_added: item.scansAdded,
        amount_cents: item.amountCents,
        currency: item.currency,
        billing_details: billingDetails,
      })
      .select("id")
      .single();

    if (orderInsert.error && isMissingColumnError(orderInsert.error, "billing_details")) {
      orderInsert = await admin
        .from("orders")
        .insert({
          school_id: school.id, type: item.type, status: "pending",
          scans_added: item.scansAdded, amount_cents: item.amountCents, currency: item.currency,
        })
        .select("id")
        .single();
    }

    const { data: order, error: orderError } = orderInsert;
    if (orderError || !order) {
      console.error("[checkout] error al registrar orden:", orderError?.message);
      return NextResponse.json({ error: "No se pudo registrar la orden de pago" }, { status: 500 });
    }

    await admin.from("orders").update({ stripe_checkout_session_id: sessionToken }).eq("id", order.id);
    return NextResponse.json({ url: redirectUrl });
  } catch (err: unknown) {
    console.error("[checkout] error critico:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Excepcion de servidor" }, { status: 500 });
  }
}
```

#### Tarea 0.4 — Arreglar webhook MercadoPago (agregar campos faltantes)

En `src/app/api/billing/webhook/mercadopago/route.ts`, reemplazar el bloque de `markOrderPaidAndApplyEntitlement` (linea 41-44 actual) con:

```typescript
    const result = await markOrderPaidAndApplyEntitlement(admin, orderId, {
      expectedAmountCents: Math.round(payment.amount * 100),
      expectedCurrency: "usd",
      gateway: "mercadopago",
      gatewayPaymentId: paymentId,
      billingPeriodMonths: 12,
    });
```

#### Tarea 0.5 — Variables de entorno necesarias

Agregar al `.env.local` (y documentar en `.env.local.example`):

```env
# Stripe (para pagos internacionales / Argentina)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# MercadoPago por pais (cuando se active)
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
```

#### Tarea 0.6 — (OBSOLETO) `gatewayForCountry()` — Reemplazado por dLocal

> **Actualizado Julio 2026**: El gateway real sera `dlocal` (no `stripe` como dice este doc pre-dLocal). Ver `docs/dlocal-pasarela-unificada.md` para la implementacion actual.

En `src/lib/billing_catalog.ts`, la funcion `gatewayForCountry` (linea 60-64) ahora retorna `"dlocal"` para todos los paises LATAM:

```typescript
export function gatewayForCountry(country: BillingCountry): BillingGateway {
  if (country === "CL") return "flow";
  // dLocal cubre todos los paises LATAM como pasarela unificada
  if (country === "AR" || country === "BR" || country === "MX" || country === "CO" || country === "PE" || country === "EC" || country === "UY" || country === "GLOBAL") return "dlocal";
  return "dlocal";
}
```

### Fase 1: Perfil Argentina basico (CRITICA — 2-3 horas)

> ⚠️ **Ejecutar PRIMERO.** El resto de las fases dependen de que `country_code = "AR"` sea valido.

**Objetivo**: Que un colegio argentino pueda usar tuLector con su escala, DNI y terminos locales.

**Orden de ejecucion obligatorio:**

#### Paso 1 — Expandir `CountryCode` (PRIMERO DE TODO)

En `src/lib/country_profiles.ts`, cambiar la linea 3:

```typescript
export type CountryCode = "CL" | "AR";
```

Sin este cambio, TypeScript rechazara `"AR"` en cualquier otro archivo.

#### Paso 2 — Agregar perfil AR al array

En `src/lib/country_profiles.ts`, agregar dentro del array `countryProfiles` (despues del objeto CL, antes del `] as const`):

```typescript
  {
    code: "AR",
    enabled: true,
    flag: "🇦🇷",
    countryName: "Argentina",
    profileName: "Perfil Argentina",
    standardsLabel: "Estandar Argentina",
    locale: "es-AR",
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
```

#### Paso 3 — Crear locale es-AR

Crear archivo NUEVO `src/locales/es-AR.ts`:

```typescript
export const esAR = {
  dashboard: "Panel",
  quizzes: "Simulacros",
  students: "Alumnos",
  papers: "Lecturas app",
  results: "Resultados",
  team: "Equipo",
  billing: "Plan y compras",
  settings: "Configuracion",
  scan: "Abrir app lector",
  sheet: "Hoja imprimible",
  empty: "No hay datos todavia.",
  createQuiz: "Crear simulacro",
  importStudents: "Importar alumnos",
  inviteMember: "Invitar miembro",
  save: "Guardar",
  role: "Rol",
  admin: "Administrador",
  teacher: "Profesor",
  viewer: "Observador",
} as const;
```

#### Paso 4 — Reemplazar `src/locales/index.ts` COMPLETO

```typescript
import { esCL } from "./es-CL";
import { en } from "./en";
import { ptBR } from "./pt-BR";
import { esAR } from "./es-AR";

export const dashboardLocales = {
  "es-CL": esCL,
  "es-AR": esAR,
  en,
  "pt-BR": ptBR,
} as const;

export type DashboardLocale = keyof typeof dashboardLocales;
export type DashboardMessages = typeof esCL;

export function resolveDashboardLocale(value?: string | null): DashboardLocale {
  if (value === "en" || value === "pt-BR" || value === "es-CL" || value === "es-AR") return value;
  return "es-CL";
}

export function getDashboardMessages(locale: DashboardLocale): DashboardMessages {
  return dashboardLocales[locale] as DashboardMessages;
}

export function formatDate(value: string | Date, locale: DashboardLocale = "es-CL") {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatNumber(value: number, locale: DashboardLocale = "es-CL") {
  return new Intl.NumberFormat(locale).format(value);
}
```

**Cambios respecto al original:**
1. Agregado `import { esAR } from "./es-AR";`
2. Agregado `"es-AR": esAR` al objeto `dashboardLocales`
3. Agregado `value === "es-AR"` en `resolveDashboardLocale()` (linea 15)

#### Paso 5 — Agregar niveles de desempeno Aprender

En `src/lib/evaluation.ts`, agregar dentro del objeto `PERFORMANCE_LEVELS` (despues de `"CO_Saber"`):

```typescript
  "AR_Aprender": [
    { levelNumber: 1, levelName: "Por debajo del basico", minScore: 0, maxScore: 39, description: "No logra resolver consignas basicas del nivel esperado", colorHex: "#EF4444" },
    { levelNumber: 2, levelName: "Basico", minScore: 40, maxScore: 59, description: "Resuelve parcialmente, requiere apoyo especifico", colorHex: "#F59E0B" },
    { levelNumber: 3, levelName: "Satisfactorio", minScore: 60, maxScore: 79, description: "Alcanza los aprendizajes esperados", colorHex: "#3B82F6" },
    { levelNumber: 4, levelName: "Avanzado", minScore: 80, maxScore: 100, description: "Supera ampliamente los aprendizajes esperados", colorHex: "#22C55E" },
  ],
  "AR_ERCE": [
    { levelNumber: 1, levelName: "Nivel I", minScore: 0, maxScore: 39, description: "No alcanza los aprendizajes minimos", colorHex: "#EF4444" },
    { levelNumber: 2, levelName: "Nivel II", minScore: 40, maxScore: 59, description: "Alcanza parcialmente los aprendizajes", colorHex: "#F59E0B" },
    { levelNumber: 3, levelName: "Nivel III", minScore: 60, maxScore: 79, description: "Alcanza los aprendizajes esperados", colorHex: "#3B82F6" },
    { levelNumber: 4, levelName: "Nivel IV", minScore: 80, maxScore: 100, description: "Supera los aprendizajes con desempeno destacado", colorHex: "#22C55E" },
  ],
```

#### Paso 6 — Agregar taxonomia curricular Aprender

En `src/lib/evaluation.ts`, agregar dentro de `CURRICULUM_TAXONOMIES` (despues del bloque `CO`):

```typescript
  AR: {
    Aprender: [
      {
        subject: "Lengua",
        axes: [
          { axisCode: "LEC", axisName: "Lectura", skills: ["Extraer/Localizar", "Interpretar", "Reflexionar y Evaluar"] },
          { axisCode: "RLG", axisName: "Reflexion sobre el lenguaje", skills: ["Reconocer", "Aplicar"] },
        ],
      },
      {
        subject: "Matematica",
        axes: [
          { axisCode: "NUM", axisName: "Numeros y Operaciones", skills: ["Reconocer conceptos", "Resolver operaciones", "Resolver situaciones"] },
          { axisCode: "GEO", axisName: "Geometria y Medida", skills: ["Reconocer conceptos", "Resolver operaciones", "Resolver situaciones"] },
          { axisCode: "EST", axisName: "Estadistica y Probabilidad", skills: ["Reconocer conceptos", "Resolver operaciones", "Resolver situaciones"] },
          { axisCode: "ALG", axisName: "Algebra y Funciones", skills: ["Reconocer conceptos", "Resolver operaciones", "Resolver situaciones"] },
        ],
      },
      {
        subject: "Ciencias Naturales",
        axes: [
          { axisCode: "SER", axisName: "Seres Vivos", skills: ["Reconocer", "Relacionar", "Explicar"] },
          { axisCode: "MUN", axisName: "Mundo Fisico", skills: ["Reconocer", "Relacionar", "Explicar"] },
          { axisCode: "TIE", axisName: "Tierra y Universo", skills: ["Reconocer", "Relacionar", "Explicar"] },
        ],
      },
      {
        subject: "Ciencias Sociales",
        axes: [
          { axisCode: "HIS", axisName: "Sociedades a traves del tiempo", skills: ["Reconocer", "Relacionar", "Analizar"] },
          { axisCode: "GEO", axisName: "Sociedades y territorios", skills: ["Reconocer", "Relacionar", "Analizar"] },
        ],
      },
    ],
  },
```

#### Paso 7 — Agregar sistemas ERCE y FEPBA a `EVALUATION_SYSTEMS`

En `src/lib/evaluation.ts`, agregar dentro del array `EVALUATION_SYSTEMS` (despues del objeto Aprender):

```typescript
  {
    code: "ERCE", countryCode: "AR", name: "ERCE",
    description: "Estudio Regional Comparativo y Explicativo - UNESCO/LLECE",
    gradeLevels: ["3° Grado Primaria", "6° Grado Primaria"],
    subjects: ["Lectura", "Matematica", "Ciencias"],
    scoreMin: 0, scoreMax: 100,
  },
  {
    code: "PISA_REF", countryCode: "AR", name: "PISA (Referencia)",
    description: "Programme for International Student Assessment (escala de referencia)",
    gradeLevels: ["15 anos / 3°-5° Ano Secundaria"],
    subjects: ["Lectura", "Matematica", "Ciencias"],
    scoreMin: 100, scoreMax: 1000,
  },
  {
    code: "FEPBA", countryCode: "AR", name: "FEPBA",
    description: "Evaluacion Formativa de la Provincia de Buenos Aires",
    gradeLevels: ["3° Grado", "6° Grado"],
    subjects: ["Practicas del Lenguaje", "Matematica"],
    scoreMin: 0, scoreMax: 100,
  },
```

#### Paso 8 — Labels cualitativos argentinos

En `src/lib/latam.ts`, modificar dos funciones:

**A) En `calculateGrade()` (linea 94-102 actual):**

Reemplazar el bloque de labels:
```typescript
  let label: string;
  if (countryCode === "CL") {
    if (rounded >= 6.5) label = "Muy Bueno";
    else if (rounded >= 5.5) label = "Bueno";
    else if (rounded >= 4.0) label = "Suficiente";
    else if (rounded >= 3.0) label = "Insuficiente";
    else label = "Deficiente";
  } else {
    label = passing ? "Aprobado" : "Reprobado";
  }
```

Con:
```typescript
  let label: string;
  if (countryCode === "CL") {
    if (rounded >= 6.5) label = "Muy Bueno";
    else if (rounded >= 5.5) label = "Bueno";
    else if (rounded >= 4.0) label = "Suficiente";
    else if (rounded >= 3.0) label = "Insuficiente";
    else label = "Deficiente";
  } else if (countryCode === "AR") {
    if (rounded >= 9) label = "Sobresaliente";
    else if (rounded >= 7) label = "Muy Bueno";
    else if (rounded >= 6) label = "Bueno";
    else if (rounded >= 4) label = "Regular";
    else label = "Insuficiente";
  } else {
    label = passing ? "Aprobado" : "Reprobado";
  }
```

**B) En `getGradeConcept()` (linea 143-164 actual):**

Agregar un `case "AR"` antes del `default:`. Insertar entre `case "PE"` block y `default:`:

```typescript
    case "AR":
      if (grade >= 9) return "Sobresaliente (10)";
      if (grade >= 7) return "Muy Bueno (8-7)";
      if (grade >= 6) return "Bueno (6)";
      if (grade >= 4) return "Regular (4-5)";
      return "Insuficiente (1-3)";
```

### Fase 2: Evaluaciones extra y CSV (2-3 horas — mayormente cubierta en Pasos 5-7 de Fase 1)

Agregar al final de `src/lib/evaluation.ts`:

```typescript
export function simulateAprenderScore(rawScore: number, total: number): {
  scaledScore: number;
  level: PerformanceLevel;
  levelNumber: number;
} {
  if (total <= 0) return { scaledScore: 0, levelNumber: 1, level: PERFORMANCE_LEVELS["AR_Aprender"][0] };
  const scaled = Math.round((rawScore / total) * 100);
  const levels = PERFORMANCE_LEVELS["AR_Aprender"];
  const level = levels.find((l) => scaled >= l.minScore && scaled <= l.maxScore) ?? levels[0];
  return { scaledScore: scaled, level, levelNumber: level.levelNumber };
}
```

### Fase 3: Pagos MercadoPago Argentina (FUTURO — requiere CUIT argentino)

No ejecutable hoy. Requisitos: entidad legal argentina + cuenta MP Argentina.
Cuando este listo: cambiar `gatewayForCountry("AR")` de `"stripe"` a `"mercadopago"` en `billing_catalog.ts`.

### Fase 4: UX y landing Argentina (FUTURO — 3-4h)

- Landing tulector.com.ar con copy argentino
- Templates de hoja: "Examen Materia", "Simulacro CBC", "Ingreso UTN", "Cambridge FCE"
- Override de aprobacion por provincia (configuracion del colegio)

### Fase 5: Dataset entrenamiento AR (FUTURO — 8h+)

Requisito: 500+ hojas reales escaneadas de colegios argentinos.

---

## 9. Orden de ejecucion para habilitar Argentina

Ejecutar en este orden EXACTO:

| Orden | Paso | Archivo | Que hace |
|-------|------|---------|----------|
| **1** | Expandir CountryCode | `country_profiles.ts:3` | `"CL"` → `"CL" \| "AR"` |
| **2** | Agregar perfil AR | `country_profiles.ts` (dentro del array) | Objeto CountryProfile Argentina |
| **3** | Crear locale es-AR | `src/locales/es-AR.ts` (NUEVO) | 19 claves con terminos argentinos |
| **4** | Reemplazar locales/index.ts | `src/locales/index.ts` | Agregar import + registro + resolveDashboardLocale |
| **5** | Performance levels AR | `evaluation.ts` → `PERFORMANCE_LEVELS` | AR_Aprender + AR_ERCE |
| **6** | Taxonomia AR | `evaluation.ts` → `CURRICULUM_TAXONOMIES` | AR.Aprender con 4 materias |
| **7** | Sistemas ERCE/FEPBA/PISA | `evaluation.ts` → `EVALUATION_SYSTEMS` | 3 nuevos sistemas |
| **8** | Labels cualitativos AR | `latam.ts` → `calculateGrade()` + `getGradeConcept()` | Sobresaliente, Muy Bueno, etc. |
| **9** | Instalar stripe npm | `package.json` | `npm install stripe` |
| **10** | Nuevo stripe.ts | `src/lib/stripe.ts` | Reemplazar completo con createStripeCheckoutSession |
| **11** | Webhook Stripe | `src/app/api/billing/webhook/stripe/route.ts` (NUEVO) | Manejar checkout.session.completed |
| **12** | Router multi-gateway | `src/app/api/billing/checkout/route.ts` | Reemplazar todo el archivo |
| **13** | Fix MP webhook | `src/app/api/billing/webhook/mercadopago/route.ts:41` | Agregar expectedCurrency, gateway, gatewayPaymentId |
| **14** | Rutear AR a Stripe | `billing_catalog.ts:60-64` | `gatewayForCountry("AR")` → `"stripe"` |
| **15** | Agregar env vars | `.env.local` | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY |
| **16** | Simulador Aprender | `evaluation.ts` (al final) | Funcion simulateAprenderScore |
| **17** | Build + test | `npx tsc --noEmit` | Verificar que compile sin errores |



---

> El codigo detallado para cada paso esta en las Secciones 8 (Fase 0 y Fase 1) de este documento. Revisar arriba.

---
{
  code: "AR",
  enabled: true,
  flag: "🇦🇷",
  countryName: "Argentina",
  profileName: "Perfil Argentina",
  standardsLabel: "Estandar Argentina",
  locale: "es-AR",
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
  evaluationSystems: ["Aprender", "ERCE", "PISA"],
  exportFormats: ["Aprender", "CSV colegio", "Excel resultados"],
  onboardingHelper: "Argentina queda activo para el colegio: DNI, escala 1-10, aprobacion 6 y exigencia 60%.",
  dashboardSummary: "Lector y reportes preparados para colegios argentinos: DNI, escala 1-10, simulacros Aprender y exportacion local.",
},
```

### 9.2 `src/lib/evaluation.ts` — Niveles de desempeno Aprender

```typescript
// Agregar en PERFORMANCE_LEVELS:
"AR_Aprender": [
  {
    levelNumber: 1,
    levelName: "Por debajo del basico",
    minScore: 0,
    maxScore: 39,
    description: "No logra resolver consignas basicas del nivel esperado",
    colorHex: "#EF4444",
  },
  {
    levelNumber: 2,
    levelName: "Basico",
    minScore: 40,
    maxScore: 59,
    description: "Resuelve parcialmente, requiere apoyo especifico",
    colorHex: "#F59E0B",
  },
  {
    levelNumber: 3,
    levelName: "Satisfactorio",
    minScore: 60,
    maxScore: 79,
    description: "Alcanza los aprendizajes esperados",
    colorHex: "#3B82F6",
  },
  {
    levelNumber: 4,
    levelName: "Avanzado",
    minScore: 80,
    maxScore: 100,
    description: "Supera ampliamente los aprendizajes esperados",
    colorHex: "#22C55E",
  },
],
```

### 9.3 `src/lib/evaluation.ts` — Taxonomia Aprender

```typescript
// Agregar en CURRICULUM_TAXONOMIES.AR:
AR: {
  Aprender: [
    {
      subject: "Lengua",
      axes: [
        {
          axisCode: "LEC",
          axisName: "Lectura",
          skills: ["Extraer/Localizar", "Interpretar", "Reflexionar y Evaluar"],
        },
        {
          axisCode: "RLG",
          axisName: "Reflexion sobre el lenguaje",
          skills: ["Reconocer", "Aplicar"],
        },
      ],
    },
    {
      subject: "Matematica",
      axes: [
        {
          axisCode: "NUM",
          axisName: "Numeros y Operaciones",
          skills: ["Reconocer conceptos", "Resolver operaciones", "Resolver situaciones"],
        },
        {
          axisCode: "GEO",
          axisName: "Geometria y Medida",
          skills: ["Reconocer conceptos", "Resolver operaciones", "Resolver situaciones"],
        },
        {
          axisCode: "EST",
          axisName: "Estadistica y Probabilidad",
          skills: ["Reconocer conceptos", "Resolver operaciones", "Resolver situaciones"],
        },
        {
          axisCode: "ALG",
          axisName: "Algebra y Funciones",
          skills: ["Reconocer conceptos", "Resolver operaciones", "Resolver situaciones"],
        },
      ],
    },
    {
      subject: "Ciencias Naturales",
      axes: [
        { axisCode: "SER", axisName: "Seres Vivos", skills: ["Reconocer", "Relacionar", "Explicar"] },
        { axisCode: "MUN", axisName: "Mundo Fisico", skills: ["Reconocer", "Relacionar", "Explicar"] },
        { axisCode: "TIE", axisName: "Tierra y Universo", skills: ["Reconocer", "Relacionar", "Explicar"] },
      ],
    },
    {
      subject: "Ciencias Sociales",
      axes: [
        { axisCode: "HIS", axisName: "Sociedades a traves del tiempo", skills: ["Reconocer", "Relacionar", "Analizar"] },
        { axisCode: "GEO", axisName: "Sociedades y territorios", skills: ["Reconocer", "Relacionar", "Analizar"] },
      ],
    },
  ],
},
```

### 9.4 `src/lib/evaluation.ts` — Nuevos sistemas de evaluacion

```typescript
// Agregar en EVALUATION_SYSTEMS:
{
  code: "ERCE",
  countryCode: "AR",
  name: "ERCE",
  description: "Estudio Regional Comparativo y Explicativo (UNESCO/LLECE)",
  gradeLevels: ["3° Grado Primaria", "6° Grado Primaria"],
  subjects: ["Lectura", "Matematica", "Ciencias"],
  scoreMin: 0,
  scoreMax: 100,
},
{
  code: "PISA_REF",
  countryCode: "AR",
  name: "PISA (Referencia)",
  description: "Programme for International Student Assessment (escala de referencia)",
  gradeLevels: ["15 anos / 3°-5° Secundaria"],
  subjects: ["Lectura", "Matematica", "Ciencias"],
  scoreMin: 100,
  scoreMax: 1000,
},
{
  code: "FEPBA",
  countryCode: "AR",
  name: "FEPBA",
  description: "Evaluacion Formativa de la Provincia de Buenos Aires",
  gradeLevels: ["3° Grado", "6° Grado"],
  subjects: ["Practicas del Lenguaje", "Matematica"],
  scoreMin: 0,
  scoreMax: 100,
},
```

### 9.5 `src/lib/evaluation.ts` — Niveles de desempeno ERCE

```typescript
"AR_ERCE": [
  {
    levelNumber: 1,
    levelName: "Nivel I (Desempeno mas bajo)",
    minScore: 0,
    maxScore: 39,
    description: "No alcanza los aprendizajes minimos esperados para la region",
    colorHex: "#EF4444",
  },
  {
    levelNumber: 2,
    levelName: "Nivel II (Basico)",
    minScore: 40,
    maxScore: 59,
    description: "Alcanza parcialmente los aprendizajes minimos",
    colorHex: "#F59E0B",
  },
  {
    levelNumber: 3,
    levelName: "Nivel III (Esperado)",
    minScore: 60,
    maxScore: 79,
    description: "Alcanza los aprendizajes esperados para el grado",
    colorHex: "#3B82F6",
  },
  {
    levelNumber: 4,
    levelName: "Nivel IV (Destacado)",
    minScore: 80,
    maxScore: 100,
    description: "Supera los aprendizajes esperados con desempeno destacado",
    colorHex: "#22C55E",
  },
],
```

### 9.6 `src/lib/latam.ts` — Conceptos cualitativos AR

```typescript
// Agregar case "AR" en getGradeConcept():
case "AR":
  if (grade >= 9) return "Sobresaliente";
  if (grade >= 7) return "Muy Bueno";
  if (grade >= 6) return "Bueno";
  if (grade >= 4) return "Regular";
  return "Insuficiente";
```

### 9.7 `src/lib/latam.ts` — Label cualitativo en calculateGrade

```typescript
// Agregar case "AR" en el bloque de labels de calculateGrade():
if (countryCode === "AR") {
  if (rounded >= 9) label = "Sobresaliente";
  else if (rounded >= 7) label = "Muy Bueno";
  else if (rounded >= 6) label = "Bueno";
  else if (rounded >= 4) label = "Regular";
  else label = "Insuficiente";
}
```

### 9.8 `src/locales/es-AR.ts` — Nuevo locale

```typescript
export const esAR = {
  dashboard: "Panel",
  quizzes: "Simulacros",
  students: "Alumnos",
  papers: "Lecturas app",
  results: "Resultados",
  team: "Equipo",
  billing: "Plan y compras",
  settings: "Configuracion",
  scan: "Abrir app lector",
  sheet: "Hoja imprimible",
  empty: "No hay datos todavia.",
  createQuiz: "Crear simulacro",
  importStudents: "Importar alumnos",
  inviteMember: "Invitar miembro",
  save: "Guardar",
  role: "Rol",
  admin: "Administrador",
  teacher: "Profesor",
  viewer: "Observador",
} as const;
```

### 9.9 `src/lib/evaluation.ts` — Exportacion CSV Aprender completa

```typescript
// El formato actual funciona pero expandirlo para incluir niveles por eje
case "AR":
  csv = `DNI${delim}Nombre${delim}Curso${delim}Puntaje${delim}Porcentaje${delim}Nivel${delim}Area${delim}Eje${delim}Fecha\n`;
  students.forEach((s) => {
    const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
    csv += `${s.id}${delim}${s.name}${delim}${metadata.grade || ""}${delim}${s.score}${delim}${pct}%${delim}${s.level.levelName}${delim}${metadata.subject || ""}${delim}${metadata.axis || ""}${delim}${date}\n`;
  });
  break;
```

---

## 10. Referencias oficiales

### Fuentes gubernamentales argentinas

| Recurso | URL |
|---------|-----|
| Aprender (portal oficial) | https://www.argentina.gob.ar/educacion/evaluacion-informacion-educativa/aprender |
| Aprender 2023 (resultados 6 grado) | https://www.argentina.gob.ar/educacion/evaluacion-informacion-educativa/aprender/aprender-2023 |
| Aprender 2024 Secundaria | https://www.argentina.gob.ar/educacion/evaluacion-informacion-educativa/aprender/aprender-2024/aprender-secundaria-2024 |
| Aprender 2024 Primaria (3 grado) | https://www.argentina.gob.ar/educacion/evaluacion-informacion-educativa/aprender/aprender-2024/aprender-primaria-2024 |
| Datos abiertos (microdatos Aprender) | https://www.argentina.gob.ar/educacion/evaluacion-e-informacion-educativa/datos-abiertos-de-la-secretaria-de-educacion |
| Reportes por escuela | https://aprenderenlaescuela.educacion.gob.ar/ |
| Ley de Educacion Nacional 26.206 | http://servicios.infoleg.gob.ar/infolegInternet/anexos/120000-124999/123542/norma.htm |
| Secretaria de Educacion | https://www.argentina.gob.ar/capital-humano/educacion |

### Fuentes internacionales

| Recurso | URL |
|---------|-----|
| PISA 2022 — Resultados Argentina | https://www.oecd.org/en/publications/pisa-2022-results-volume-i_53f23881-en.html |
| ERCE 2019 — UNESCO | https://unesdoc.unesco.org/ark:/48223/pf0000380242 |
| LLECE (UNESCO) | https://llece.unesco.org/ |

### Normativa relevante

| Norma | Descripcion |
|-------|-------------|
| Ley 26.206/06 | Ley de Educacion Nacional |
| Ley 26.075/05 | Ley de Financiamiento Educativo |
| Resolucion CFE N 174/12 | Criterios de evaluacion, acreditacion y promocion |
| Resolucion CFE N 280/16 | Marco de organizacion de los aprendizajes (MOA) |
| Resolucion CFE N 342/18 | NAP para nivel primario y secundario |
| Resolucion CFE N 343/18 | NAP de Educacion Digital, Programacion y Robotica |

---

## Resumen ejecutivo para el equipo de ingenieria

### Lo CRITICO — Fase 0 (Pagos)

0. **Desbloquear checkout y configurar Stripe** para cobrar en USD desde Argentina (`billing/checkout/route.ts`, `stripe.ts`)

### Que hay que hacer AHORA — Fase 1 (Perfil AR basico)

1. **Agregar el perfil de pais Argentina** en `country_profiles.ts` (~20 lineas)
2. **Crear el locale es-AR** en `src/locales/es-AR.ts` (~20 lineas) y registrarlo
3. **Agregar niveles de desempeno Aprender** en `evaluation.ts` (~40 lineas)
4. **Agregar taxonomia curricular Aprender** en `evaluation.ts` (~60 lineas)
5. **Agregar conceptos cualitativos argentinos** en `latam.ts` (~15 lineas)

### Que es deseable — Fase 2+3

6. **Agregar sistemas ERCE y PISA** en `evaluation.ts` (~50 lineas)
7. **Investigar e integrar dLocal/EBANX** para pagos locales AR (~1-2 semanas)
8. **Crear simulador Aprender** (~15 lineas)
9. **Soporte para cuotas** (Ahora 12/18) — critico para conversion

### Lo que NO hay que tocar

- **Motor OMR** (`src/tulector/omr.ts`, `src/tulector/classifier.ts`): La hoja argentina es identica en geometria.
- **Sheet layout** (`src/tulector/sheet_layout.ts`): El DNI argentino (7-8 digitos) cabe en la grilla 3x10 actual.
- **Scan pipeline** (`src/app/scan/page.tsx`, `src/app/api/scan/result/route.ts`): Ya usa `calculateGrade()` con `countryCode` y `customConfig`.

### Estimacion total

| Fase | Horas estimadas | Riesgo | Dependencia externa |
|------|----------------|--------|---------------------|
| Fase 0 (Pagos basicos) | 4-8h | Bajo | Ninguna (Stripe ya esta en codigo) |
| Fase 1 (Perfil basico) | 4-6h | Bajo (solo datos/config) | Ninguna |
| Fase 2 (Estandarizadas) | 3-4h | Bajo (solo datos/config) | Ninguna |
| Fase 3 (Pagos avanzados) | 5-8h | **Alto** — requiere PSP externo o entidad legal | dLocal/EBANX o registro MP Argentina |
| Fase 4 (UX AR) | 3-4h | Medio (toca UI) | Ninguna |
| Fase 5 (Dataset AR) | 8h+ | Medio (requiere datos reales) | Colegios argentinos |
| **Total** | **27-38h** | — | — |

---

> **Conclusion final**: Argentina NO es Chile. No tiene PAES, no tiene SIMCE, no tiene un examen nacional que todos preparan. Pero tiene un mercado educativo 4x mas grande (46M vs 19M habitantes), con un sistema fragmentado donde el profesor de aula y las academias preuniversitarias son el cliente. tuLector ya tiene el 60% del codigo listo. Lo que falta es **pagos locales** (el bloqueo mas grande), **perfil y locale argentino**, y **posicionamiento de marketing** distinto al chileno: "correccion automatica de examenes multiple choice" en vez de "ensayos PAES".
