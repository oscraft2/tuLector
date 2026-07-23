# Plan: Corrección IA de preguntas de desarrollo con rúbrica

**Estado: PROPUESTA — no construido.** Acordado 2026-07-23. Requiere como prerequisito
que la feature de preguntas de desarrollo (commit `8adcc02`, en producción) esté
validada en terreno con papel real.

## Idea

Hoy las preguntas de desarrollo (abiertas) se resuelven en la **hoja de desarrollo**
(reverso con recuadros numerados) y quedan **fuera del puntaje automático** — el
profesor las corrige a mano por su cuenta. Esta propuesta cierra ese ciclo: escanear
también el reverso, recortar el recuadro de cada pregunta, y que un modelo de visión
(LLM) **sugiera un puntaje según una rúbrica** definida por el profesor. El profesor
revisa/ajusta y confirma; recién ahí el puntaje entra a la nota.

**Principio rector: la IA sugiere, el profesor decide.** Nunca se publica un puntaje
de desarrollo sin confirmación humana (confianza del docente + es diagnóstico DIA).

## Por qué es viable

- **El reverso lo generamos nosotros** (`renderOpenAnswersSheet` en
  `src/lib/sheet_generator.ts`): las coordenadas de cada recuadro son conocidas.
  No hay que "entender" una hoja arbitraria — solo rectificar la foto y recortar
  por posición, igual que hace el motor OMR con las burbujas.
- El pipeline de rectificación ya existe (`findCorners → warpImageData` en
  `src/tulector/omr.ts`) y el código de hoja (`sheet_code.ts`) ya identifica ensayo/página.
- Los modelos de visión actuales leen manuscrito escolar corto (números, pares
  ordenados, 2-3 líneas) con precisión razonable; con rúbrica explícita y campo de
  confianza, los casos dudosos van a revisión igual que hoy el flag "revisar" del OMR.
- **Costo marginal**: ~US$0.01 por pregunta/alumno → ~US$1–1.5 por curso de 35
  alumnos con 3 abiertas (mitad con Batch API). El costo no es la barrera.

## Decisión de modelo

- **NO DeepSeek**: su API pública es solo texto (no acepta imágenes). Sus modelos de
  visión (DeepSeek-OCR/VL) son open-source auto-hospedados → arrendar GPU cuesta más
  que las llamadas API. Descartado para esta tarea (sigue siendo buena opción para
  tareas de texto puro).
- **Recomendación inicial: Claude Opus 4.8** (`claude-opus-4-8`, $5/$25 por M tokens)
  por manuscrito difícil + apego a rúbrica. **Alternativa barata: Haiku 4.5**
  ($1/$5, 5×) que puede bastar para respuestas cortas. Gemini Flash como opción
  no-Anthropic si se quiere comparar.
- **Desacoplado del proveedor**: implementar con AI SDK + AI Gateway de Vercel
  (modelo como string `"proveedor/modelo"` en env var, fallback automático).
  Cambiar de modelo = editar config, no código.
- **La elección final la decide el Experimento 0** (abajo), no el precio de lista.

## Experimento 0 — factibilidad (hacer ANTES de construir)

Barato y sin tocar el producto:

1. Conseguir 5–10 respuestas manuscritas reales (o simuladas a mano) fotografiadas.
2. Rúbrica de ejemplo por pregunta (ej. "2 pts: plantea y resuelve; 1: solo plantea; 0: otro").
3. Script suelto (scratchpad, no repo) que manda recorte + enunciado + rúbrica a
   2-3 modelos en paralelo (Opus 4.8, Haiku 4.5, opcional Gemini Flash) con
   structured outputs → `{puntaje, justificacion, confianza, transcripcion}`.
4. Comparar contra corrección manual del profesor. Métricas: exactitud de puntaje,
   calidad de transcripción del manuscrito, tasa de "no legible".
5. Decisión: modelo, umbral de confianza para auto-sugerir vs mandar a revisión.

Si el experimento da mal con manuscrito real de niños, se detiene aquí sin haber
construido nada.

## Fases de implementación

### Fase 1 — Reverso escaneable
Hoy la hoja de desarrollo es solo impresa (sin anclas ni código). Cambios:
- `renderOpenAnswersSheet`: agregar las 4 esquinas (`CORNER_CENTERS`/`solidSquare`)
  + código de hoja (`drawSheetCode`) con un flag/página que lo distinga del frente
  (ej. bit o rango de página en `SheetCodeData`; hoy `page/pagesTotal` llega a 16).
  Los recuadros NO cambian de estética; solo se agregan marcas en zonas libres.
- Lector: detectar "esto es un reverso" por el código → rectificar con el warp
  existente → recortar cada recuadro por coordenadas conocidas (mismo layout que
  imprimió `chunkOpenQuestions`, máx 4 recuadros/página).
- **Identidad del alumno**: el reverso lleva nombre/RUT manuscrito, sin burbujas.
  Opciones (decidir en diseño): (a) pareo por secuencia de escaneo — el reverso se
  escanea inmediatamente después del frente del mismo alumno (simple, frágil ante
  desorden); (b) la IA transcribe el RUT manuscrito y el profe confirma; (c) agregar
  mini bloque OMR de RUT al reverso (más robusto, más tinta). Recomendación: (a)+(b)
  combinadas — pareo por secuencia con verificación IA del RUT.
- Persistencia: nueva tabla `open_answers` (paper_id, question, image, status)
  con la imagen del recorte (storage Supabase, no base64 en tabla).

### Fase 2 — Rúbricas por pregunta
- Tabla `question_rubrics` (quiz_id, question, rubric TEXT, max_points INT) o
  extender `question_metadata` (ya existe por pregunta: axis/skill/difficulty).
- UI en creación/edición del ensayo: para cada pregunta marcada como desarrollo,
  campo de rúbrica + puntaje máximo. Sin rúbrica → la pregunta queda solo-manual.
- Futuro DIA: importar la rúbrica real del instrumento desde `criterioEscritura`
  de la API DIA (dia-bot FINDINGS.md; captura pendiente = Fase A1 de dia-bot).

### Fase 3 — Corrección IA + cola de revisión
- API route server-side (`api/quiz/[id]/grade-open` o similar): por cada recorte
  pendiente → llamada al modelo (recorte + enunciado opcional + rúbrica) con
  structured outputs → guarda `{puntaje_sugerido, justificacion, confianza,
  transcripcion}` en `open_answers`.
- Batch API cuando sea el flujo "corregir curso completo" (50% descuento, no es
  tiempo real).
- UI cola de revisión (en el detalle del ensayo): imagen del recuadro + sugerencia
  IA + rúbrica lado a lado; el profe confirma con 1 clic o corrige el puntaje.
  Orden: baja confianza primero.
- **Gate de plan**: feature Pro, mismo patrón que `dia_sync` en `plan_gates.ts`.
  Límite de llamadas por colegio/mes para controlar costo.

### Fase 4 — Integración al puntaje (+ DIA)
- `open_answers.confirmed_points` suma al score del paper una vez confirmado:
  score final = correctas OMR + Σ puntos abiertas confirmadas; total = alternativas
  + Σ max_points. Requiere generalizar `computeQuizScore` (hoy excluye abiertas
  de numerador y denominador) con un modo "abiertas puntuadas".
- Re-corrección al editar rúbrica → invalida confirmaciones afectadas (avisar).
- Opcional/futuro: sync de respuestas abiertas a la plataforma DIA (Fase 2 de
  dia-bot, hoy la extensión las salta) usando la transcripción + puntaje confirmado.

## Riesgos

- **Manuscrito ilegible / fotos malas**: umbral de confianza + estado "no legible"
  → siempre cae a corrección manual, nunca a puntaje 0 silencioso.
- **Confianza docente**: nunca auto-publicar; mostrar siempre justificación e imagen.
- **Privacidad**: los recortes son trabajo de menores → storage privado por colegio,
  retención limitada, y revisar términos del proveedor LLM (no-training).
- **Identidad frente↔reverso**: el punto más frágil del diseño; validar en la
  Fase 1 con curso real antes de seguir.
- **Costo runaway**: gate Pro + tope mensual por colegio + Batch API.

## Referencias de código (estado al 2026-07-23)

- Reverso: `src/lib/sheet_generator.ts` → `renderOpenAnswersSheet`, `chunkOpenQuestions`
- Motor/warp: `src/tulector/omr.ts` → `findCorners`, `warpImageData`; `sheet_code.ts`
- Abiertas en BD: `quizzes.open_questions` (CSV), parser en `src/lib/quiz_constraints.ts`
- Puntaje: `src/lib/grading.ts` → `computeQuizScore` (excluye abiertas)
- Metadata por pregunta existente: tabla `question_metadata`
- Gates de plan: `src/lib/plan_gates.ts` (patrón `dia_sync`)
- Rúbricas DIA reales: `dia-bot/docs/FINDINGS.md` (`criterioEscritura`, Fase A1 pendiente)
