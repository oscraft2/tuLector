# Hoja propia de tuLector para instrumentos DIA (selección múltiple + opciones variables)

**Estado (2026-07-24): motor + dashboard/DB + presets automáticos de 5°/6° básico implementados
y probados. Falta aplicar la migración en producción, cablear la pauta de corrección IA (Fase 4,
no construida) y el lado dia-bot (Fase B, no construida). Ver "Pendientes" al final.**

**Alcance confirmado con el usuario (2026-07-24): esta actualización cubre ÚNICAMENTE 5° y 6°
básico** (los únicos niveles con hoja de respuestas real auditada — ver
`docs/dia-instrumentos-monitoreo-2026.md`). Cualquier otro nivel (7°, 8°, medios) queda fuera de
alcance hasta que se audite su propia hoja real; no se debe inventar su estructura.

Rama de trabajo: `feature/dia-motor-beta` (no pusheada a `master` — ver "Estrategia de trabajo
seguro"). Commits: `c59c46f` (motor), `525aa50` (dashboard/DB).

Catálogo de las evaluaciones reales (5° básico a II medio, Lenguaje/Lectura y Matemática,
Monitoreo Intermedio 2026 — 11 de 12 instrumentos posibles, falta Matemática 8° básico) con la
config exacta de `openQuestions`/`optionOverrides`/`multiSelectQuestions` de cada una: ver
`docs/dia-instrumentos-monitoreo-2026.md`. Los 11 ya son presets automáticos en
`src/lib/dia_presets.ts`.

## 1. Contexto y objetivo

El usuario compartió `hoja_de_respuestas_matematica_monitoreo_2026_6_basico.pdf`: la hoja OFICIAL
de la Agencia de Calidad de la Educación (plataforma **DIA**, "Monitoreo Intermedio 2026",
Matemática 6° básico). Preguntó si el motor OMR de tuLector podía "completarse" para leer hojas
así, entregando lo máximo posible, **sin apartar el trabajo ya avanzado** (el motor real, probado
en producción, con 24+ guardias en `test:omr`).

Estructura real de esa hoja (35 preguntas):
- La mayoría: burbujas A-B-C-D.
- **P20**: solo A-B-C (3 opciones en vez de 4).
- **P7, P15, P18**: respuesta de desarrollo (abierta).
- **P29**: "Marca todas las correctas" — 6 casillas numeradas 1-6, selección MÚLTIPLE (0 a 6
  marcas válidas), sin RUT en la hoja (solo nombre manuscrito).

**Decisión de arquitectura (corrigió un primer enfoque descartado):** en vez de construir un
subsistema nuevo para leer el PDF oficial de DIA tal cual (sin anclas propias, sin pista de
temporización, geometría fija de terceros — alto riesgo, motor paralelo), **tuLector genera su
propia hoja de respuestas para un instrumento con esta misma estructura** (35 preguntas, opciones
variables, abiertas al reverso, una fila de selección múltiple), impresa con las primitivas YA
construidas y probadas (anclas, warp por bloques, pista de temporización, RUT, código de hoja,
contraste relativo). El contenido del examen lo sigue entregando DIA; lo único que cambia es la
HOJA DE RESPUESTAS, igual que cualquier otro ensayo que el profesor ya crea en tuLector.

Esto requería **dos capacidades nuevas y pequeñas** en el motor (ninguna existía antes):
1. Nº de opciones distinto por pregunta puntual (para P20).
2. Una fila de selección múltiple, con grading independiente por burbuja (para P29).

## 2. Qué se completó

### 2.1 Motor (`src/tulector/*.ts`, commit `c59c46f`)

- `SheetConfig`/`OMRConfig` ganan dos campos **opcionales y aditivos**:
  - `optionOverrides?: Record<number, number>` — nº de opciones de una pregunta puntual
    (1-indexada). Sin overrides, cero cambio de comportamiento.
  - `multiSelectQuestions?: number[]` — preguntas donde CUALQUIER subconjunto de burbujas
    marcadas es una respuesta válida (a diferencia de selección única, donde más de una marca es
    ambigüedad/error). Se imprimen con etiquetas numéricas (`MULTI_SELECT_LABELS = "123456789"`)
    en vez de letras, y se leen como las etiquetas marcadas unidas por `"|"` (ej. `"1|3|5"`, `"-"`
    si no se marcó ninguna).
- `QLayout` (la única fuente de verdad de geometría, en `sheet_layout.ts`) gana
  `optionsFor(q)`/`labelsFor(q)`/`isMultiSelect(q)`, usados tanto por `sheet_render.ts` (qué
  dibujar) como por `omr.ts` `gradeBubbles` (qué leer) — una sola fuente de verdad para ambos
  lados, mismo patrón que el resto del motor.
- `gradeBubbles` en `omr.ts`: el nº de opciones y las etiquetas ahora se resuelven POR PREGUNTA
  (antes eran un único valor global para toda la hoja). Una fila `multiSelect` se gradúa distinto
  — sin la lógica de "un solo ganador"/dominancia que usa selección única, cada burbuja
  independiente contra el umbral relativo al papel local (mismo principio de contraste relativo
  que ya usa todo el motor).
- `sheet_render.ts`: `SheetMarks` gana `multiAnswers?: Record<number, number[]>` (para
  pre-marcar una fila multiSelect en hojas de referencia/fixtures, análogo a `answers` pero
  soportando varias marcas).
- **Guardias nuevas en `test_omr_real.ts`**: "Per-question option override guard" y "Multi-select
  row guard" (incluye el caso de 0 marcas → `"-"` con flag `"blanco"`). **`npm run test:omr`:
  26/26 guardias en verde** (24 preexistentes idénticas + 2 nuevas). `npx tsc --noEmit` limpio.

### 2.2 Dashboard/DB (commit `525aa50`)

- **Migración** `supabase/migrations/20260724000000_option_overrides.sql` (aditiva, sin backfill):
  `quizzes.option_overrides TEXT`, `quizzes.multi_select_questions TEXT` (mismo formato CSV que
  `open_questions`: `"20:3,29:6"` y `"29"` respectivamente).
- `src/lib/quiz_constraints.ts`: `parseOptionOverrides`/`serializeOptionOverrides` nuevos;
  `multiSelectQuestions` reusa **tal cual** `parseOpenQuestions`/`serializeOpenQuestions` (mismo
  formato: lista de nº de pregunta).
- `src/lib/grading.ts` (`computeQuizScore`): las preguntas de selección múltiple quedan FUERA del
  puntaje automático (numerador y denominador), igual que las abiertas — una letra-clave-única no
  representa "qué subconjunto es correcto".
- `src/app/dashboard/actions.ts` (`createQuiz`/`updateQuiz`): parsea, valida (una pregunta no
  puede ser abierta Y multiSelect a la vez) y guarda ambos campos, con degradación elegante si la
  BD todavía no tiene las columnas (igual patrón que `open_questions`: si el ensayo no usa la
  característica, no falla; si la usa y la columna no existe, error explícito pidiendo migrar).
- `AnswerKeyEditor.tsx`/`AnswerKeyGrid.tsx`: nueva sección "Opciones avanzadas (replicar un
  instrumento externo, ej. DIA)" con los dos campos de texto; la grilla de clave bloquea/marca
  visualmente las preguntas de selección múltiple (chip morado "▤") igual que ya hace con las
  abiertas (chip ámbar "✎").
- Impresión: `/api/quiz/[id]` y `src/app/sheet/page.tsx` heredan y aplican ambos campos al generar
  la hoja (solo si el ensayo cabe en 1 página — misma limitación ya documentada para
  `open_questions` en multipágina).
- Escaneo: `/api/scan/active-quiz`, `src/app/scan/page.tsx` y `/api/scan/result` propagan ambos
  campos hasta `gradeBubbles`/`computeQuizScore`.
- Export CSV: `src/lib/dia_export.ts` (`buildDiaCsv`) acepta `multiSelectQuestions` para no
  colapsar `"1|3|5"` a `"NULA"` (bug que habría tenido si no se tocaba — `celdaRespuesta` original
  trata cualquier respuesta de más de 1 carácter como doble-marca inválida).
- **Verificación**: `npx tsc --noEmit` limpio; `npx eslint` sobre los 17 archivos tocados — 9
  avisos/errores, los **9 preexistentes en la rama base** (confirmado corriendo eslint con
  `git stash` sobre el mismo commit base), **cero nuevos**; `npm run test:omr` sigue 26/26 después
  de este commit también (el dashboard no toca el motor).

### 2.3 Estrategia de trabajo seguro

Todo el trabajo vive en la rama `feature/dia-motor-beta`, no en `master` — producción no se entera
de nada hasta decidir pushear. Se evaluó y descartó duplicar el motor en un módulo/carpeta aparte
(`src/tulector_beta/`): quedaría con dos motores que mantener en paralelo y riesgo de
desincronización, contrario al principio ya acordado de que "la base [del motor] no es
desechable". El aislamiento real viene de (a) la rama de git y (b) que ambos campos nuevos son
opcionales y gateados — ningún ensayo existente cambia de comportamiento aunque el código llegue a
`master`.

### 2.4 Presets automáticos en tulector.app (commit `a36d47b`)

Pedido explícito del usuario: que crear un ensayo DIA de 5°/6° básico sea automático, sin tipear
nº de preguntas/opciones/abiertas/overrides a mano cada vez. Implementado:

- `src/lib/dia_presets.ts`: única fuente de verdad de las 4 config (misma info que
  `docs/dia-instrumentos-monitoreo-2026.md`, no duplicada a ojo — si el catálogo cambia, hay que
  actualizar ambos a mano por ahora, no hay generación automática desde el doc).
- `AnswerKeyEditor.tsx`: nuevo selector "Instrumento DIA" (mismo patrón que las variantes
  PAES/SIMCE ya existentes) con las 4 opciones + "Otro nivel/asignatura" (preserva el
  comportamiento 100% manual de antes, para no bloquear ensayos DIA de otros niveles). Al elegir
  un instrumento, precarga preguntas/opciones/desarrollo/overrides — el profesor puede seguir
  ajustando cualquier campo después.
- `evaluation_variant` ahora guarda el id real del preset (`dia_5b_lectura`, `dia_5b_matematica`,
  `dia_6b_lectura`, `dia_6b_matematica`) en vez del genérico `"dia"` de antes; `getVariantLabel()`
  en el detalle del ensayo (`dashboard/quizzes/[id]/page.tsx`) muestra el nombre del instrumento.
  Ensayos viejos con `evaluation_variant = "dia"` (genérico) siguen funcionando igual, sin migrar.

## 3. Qué falta (explícitamente, no implementado)

1. **Aplicar la migración en Supabase.** Como con toda migración de este proyecto, Vercel NO la
   corre — hay que pegarla a mano en el SQL Editor de Supabase antes de usar estos campos en
   producción (y correr `NOTIFY pgrst, 'reload schema';` después, como siempre).
2. **Fase 4 (IA para las preguntas de desarrollo) — NO construida.** Ya existe el plan completo en
   `docs/plan-correccion-ia-abiertas.md` (reverso escaneable → recorte por pregunta → LLM de
   visión sugiere valor/puntaje → profesor confirma), con un Experimento 0 de factibilidad
   pendiente (comparar Opus 4.8 / Haiku 4.5 / **Gemini**, sumado a pedido del usuario — ver esa
   sección más abajo sobre cómo conseguir la API de Google).
   - **Pedido explícito del usuario, agregado al plan y AÚN NO construido:** al crear un ensayo
     con preguntas de desarrollo, un popup/panel minimalista para subir la **pauta de corrección**
     (PDF o texto pegado) de esas preguntas — insumo que la IA necesita para evaluar con criterio
     en vez de "adivinar" sin rúbrica. Diseño propuesto: aparece solo si hay `openQuestions`;
     columnas nuevas en `quizzes` (`grading_rubric_text`, `grading_rubric_file_path`); se
     implementa junto con la Fase 4 (depende de tener ya un proveedor de IA elegido).
3. **Fase B (dia-bot entiende selección múltiple y desarrollo) — NO construida.** Antes de
   escribir código en `dia-bot/src/answer_payload.js`, hace falta captura pasiva en vivo (misma
   metodología que ya usó el proyecto para `ABIERTA_*`/`FINALIZAR`, ver `dia-bot/docs/
   FINDINGS.md` §11-12) para confirmar: (a) el `tipoPregunta.codigo` real que usa la API de DIA
   para "marca todas las correctas" y la forma exacta del payload; (b) qué espera el payload para
   preguntas `ABIERTA_*` (`respuestaAbierta`/`criterioEscritura`/`puntaje`).
4. **Foto en ángulo para esta hoja** — hoy el motor ya soporta esto de forma general (no es
   específico de esta feature); no hay pendiente nuevo acá.

## 4. Cómo probar lo que ya está

```bash
cd tulector
npm run test:omr        # 26/26 guardias, incluye las 2 nuevas
npx tsc --noEmit        # limpio (salvo el error preexistente y ajeno de tests/e2e, sin @playwright/test instalado)
```

Prueba manual end-to-end (pendiente de hacer, no hecha en esta sesión): crear un ensayo de 35
preguntas en el dashboard con `Preguntas de desarrollo = 7,15,18`, `Preguntas de selección
múltiple = 29` y `Nº de opciones por pregunta puntual = 20:3`, imprimir la hoja, marcarla a mano
(incluyendo varias marcas en la P29), escanear, y comparar contra una verdad-terreno armada a
mano.

## 5. IA para las abiertas: ¿Gemini (Google)? Cómo obtener acceso

(Trasladado del plan, para que quede documentado junto con el resto — no implementado todavía.)

- **Prototipo/Experimento 0: Google AI Studio.** `aistudio.google.com` → cuenta Google → "Get API
  key" → clave asociada a un proyecto de Google Cloud (se crea automático si no hay uno). Capa
  gratuita con límites, suficiente para probar con manuscrito real.
- **Producción: Vertex AI (Google Cloud).** Mismo modelo Gemini, proyecto de GCP con facturación e
  IAM (cuentas de servicio) en vez de una clave suelta — mejor control de acceso y términos de
  procesamiento de datos más claros para datos de menores de edad (nombre, respuestas de examen).
- **Alternativa, dado que tuLector está en Vercel:** Vercel AI Gateway — acceso a modelos de
  Google (y otros) con una sola clave gestionada por Vercel, útil si el Experimento 0 compara
  varios proveedores (Opus, Haiku, Gemini) sin manejar credenciales de cada uno por separado.
- La clave siempre va en variable de entorno (`.env` local / Vercel env vars), nunca committeada.

## 6. Archivos tocados (referencia rápida)

**Motor** (`feature/dia-motor-beta`, commit `c59c46f`): `src/tulector/sheet_layout.ts`,
`src/tulector/sheet_render.ts`, `src/tulector/omr.ts`, `test_omr_real.ts`, `src/lib/dia_export.ts`,
`src/lib/quiz_constraints.ts`.

**Dashboard/DB** (commit `525aa50`): `supabase/migrations/20260724000000_option_overrides.sql`,
`src/lib/grading.ts`, `src/app/dashboard/actions.ts`, `src/components/dashboard/
AnswerKeyEditor.tsx`, `src/components/dashboard/AnswerKeyGrid.tsx`, `src/components/dashboard/
QuizCreateForm.tsx`, `src/app/dashboard/quizzes/[id]/edit/page.tsx`, `src/app/api/quiz/[id]/
route.ts`, `src/app/api/quiz/[id]/export-dia/route.ts`, `src/app/api/scan/active-quiz/route.ts`,
`src/app/api/scan/result/route.ts`, `src/app/scan/page.tsx`, `src/app/sheet/page.tsx`.

**No tocado en absoluto:** `dia-bot/**` (Fase B pendiente), cualquier proveedor de IA (Fase 4
pendiente).
