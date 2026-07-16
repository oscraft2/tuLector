# Plan: Multipágina (Fase 1) — cablear assembleMultipageResult

> Reconstruido jul 2026: este plan se diseñó en una sesión de planificación y
> quedó pausado a pedido del usuario para priorizar otro trabajo (sistema de
> correo). Se guarda aquí (en vez de en el archivo de plan efímero de la
> sesión) para que no se pierda entre sesiones. **No ejecutado todavía.**

## Contexto

tuLector limita hoy los ensayos a 100 preguntas porque físicamente no caben en
una hoja. El algoritmo puro de ensamblado de páginas (`src/lib/multipage.ts`,
`assembleMultipageResult`) ya existe y está probado (5/5 tests), y el codec del
código de hoja (`src/tulector/sheet_code.ts`) ya soporta `page`/`pagesTotal`
desde una sesión anterior — pero nada de esto está conectado: el generador
`/sheet` siempre imprime `page:1, pagesTotal:1`, y `api/scan/result` nunca
revisa esos campos. Es el último hito grande del plan multi-país (ya cerrado
para 7 países). El usuario pidió explícitamente **no tocar el motor**
(`src/tulector/**`).

**Hallazgo clave de la investigación: no hace falta tocarlo.** El codec de
página/total y el bloque de ID por hoja ya viven en el motor y funcionan.
Diseñando cada página como una hoja **físicamente independiente de tamaño
fijo** (se imprime y se lee exactamente como hoy, sin cambios), toda la feature
queda en la capa de producto: una tabla nueva, un branch en la API de escaneo,
un loop en el generador, y un mapeo local→global de números de pregunta.

## Diseño central: página de tamaño fijo, mapeo local→global en la API

- `PAGE_SIZE = MAX_QUESTIONS` (100, ya validado por el guard "Config sweep" de
  `test:omr`) — cada página física de un ensayo multipágina SIEMPRE se imprime
  y se lee con el mismo grid de 100 preguntas (la última página puede tener
  filas de burbujas sin usar; los `q` que exceden `quiz.num_questions` se
  descartan al ensamblar). **Cero cambios al pipeline de escaneo en vivo** de
  `/scan` (que hoy usa una config de grilla ESTÁTICA por ensayo activo,
  conocida de antemano) — evita el problema de "no sé qué página es hasta leer
  el código, pero necesito la config de grilla antes de leer los burbujas",
  que sí requeriría tocar el loop de frames en tiempo real (descartado a
  propósito por ser una pieza frágil y muy afinada, regla ya vigente en el
  proyecto: "un cambio a la vez" en el scan).
- `QUIZ_MAX_PAGES = 4` → tope total de 400 preguntas para un ensayo
  multipágina (conservador, fácil de subir después; el codec soporta hasta 16
  páginas).
- `pagesTotal = Math.ceil(quiz.num_questions / PAGE_SIZE)` — **no se persiste**,
  se deriva siempre del mismo `num_questions` ya guardado (una sola fuente de
  verdad, sin columna nueva en `quizzes`).
- Mapeo: página `p` (1-indexado) imprime/lee preguntas locales `1..PAGE_SIZE`;
  la pregunta global es `globalQ = (p-1)*PAGE_SIZE + localQ`. Se aplica en dos
  puntos: al generar (slice del `answer_key` completo por página) y al recibir
  un escaneo (traducir `answers[].q` local a global antes de guardar/ensamblar).

## Cambios por archivo

### 1. Migración nueva — tabla `paper_pages`
`supabase/migrations/<timestamp>_paper_pages.sql`. Reutiliza el patrón RLS ya
vigente (`is_school_member(school_id)`, definida en
`20260626093000_mobile_auth_scan_link.sql`) — **no** la policy pública de
`result_links` (páginas parciales sin ensamblar no deben ser visibles
públicamente, a diferencia de `papers`).

```sql
CREATE TABLE IF NOT EXISTS paper_pages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  quiz_id uuid not null references quizzes(id) on delete cascade,
  student_code_norm text not null,   -- mismo criterio que resolveNationalId().normalized
  student_code_raw text,
  student_name text,
  sheet_id integer not null,
  page integer not null,
  pages_total integer not null,
  answers jsonb not null default '[]',  -- [{q, a}] YA en numeracion GLOBAL
  scanned_at timestamptz not null default now(),
  unique (quiz_id, student_code_norm, page)
);
CREATE INDEX idx_paper_pages_group ON paper_pages(quiz_id, student_code_norm);
ALTER TABLE paper_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_paper_pages" ON paper_pages FOR ALL
  USING (is_school_member(school_id)) WITH CHECK (is_school_member(school_id));
```

Deliberadamente una tabla **separada** de `papers` (no columnas nuevas ahí):
evita violar el `CHECK (status IN (...))` de `papers`, evita que el trigger
`on_paper_insert_increment_scan_usage` (dispara por cada INSERT en `papers`)
sobre-cuente la cuota por página, y evita tocar CUALQUIER lugar que hoy lista
`papers` sin filtrar por status (`dashboard/results/[quizId]`,
`api/export/results/[quizId]`, etc. — confirmado por la investigación que hoy
no filtran status, así que una página parcial en `papers` los contaminaría).
Con `paper_pages` separada, esos lugares quedan intactos, cero riesgo.

Migración preparada pero **NO aplicada sin confirmación explícita** (regla ya
vigente del proyecto).

### 2. `src/lib/quiz_constraints.ts`
- Nueva constante `QUIZ_MAX_PAGES = 4` y `QUIZ_MAX_QUESTIONS_MULTIPAGE = QUIZ_MAX_QUESTIONS * QUIZ_MAX_PAGES` (400).
- `QUIZ_MAX_QUESTIONS` (100) se mantiene como el tope de **una sola página**;
  se usa para decidir cuántas páginas hacen falta, no como tope duro del ensayo.

### 3. `src/app/dashboard/actions.ts` — `createQuiz`
- Sube la validación de rango a `QUIZ_MAX_QUESTIONS_MULTIPAGE`.
- **Fix de un bug real encontrado en la investigación**: hoy
  `numColumns = suggestColumns(numQuestions)` usa el TOTAL del ensayo — para
  250 preguntas eso rompe (`allowedColumns(250)` da `[]`, cae a 1 columna,
  inválido para el grid real de 100/página). Debe ser
  `suggestColumns(Math.min(numQuestions, QUIZ_MAX_QUESTIONS))` — el nº de
  columnas que se imprime y se lee es el de **una página**, no el total.
  Mismo fix en `duplicateQuiz` si aplica.

### 4. `src/lib/sheet_generator.ts`
- Nueva función pura `paginateQuiz(numQuestions: number): {page: number; from: number; to: number}[]`
  — trocea `1..numQuestions` en bloques de `QUIZ_MAX_QUESTIONS`.
- `randomValidNationalId`/branding sin cambios; se reusan tal cual por página.

### 5. `src/app/sheet/page.tsx`
- Cuando el ensayo (`?quiz=<id>`) tiene `num_questions > QUIZ_MAX_QUESTIONS`:
  en vez de 1 render, loop de `pagesTotal` renders — cada uno con
  `cfg.numQuestions = PAGE_SIZE` (o el resto en la última), MISMO `idBlock`
  (cada página lleva su propio bloque de ID, para poder identificarse sola —
  ya es el diseño documentado del plan multipágina original),
  `marks.code = {version:2, country, sheetId, page: i, pagesTotal}`.
- Texto de branding nuevo vía `drawBranding` (ya existe, zona libre, sin tocar
  el motor): "Página {i} de {pagesTotal} — Preguntas {from}–{to}".
- `exportPdf` ya soporta `dataUrls: string[]` multi-página — se reusa sin
  cambios, solo se le pasan N imágenes en vez de 1.
- Fuera de alcance de este pase: el generador de hojas "beta" (autollenado
  masivo con verdad-terreno) queda limitado a ensayos de 1 página — no es
  crítico para producción real, se puede sumar después.

### 6. `src/app/api/scan/active-quiz/route.ts`
- Sin cambios de esquema — ya expone `num_questions`/`num_columns` (que tras el
  fix del punto 3 ya representan **una página**, no el total). `/scan` sigue
  usando una única config de grilla estática por ensayo, sin saber ni
  necesitar saber cuántas páginas tiene el ensayo.

### 7. `src/app/api/scan/result/route.ts` — el cableado real
- Nuevo helper `readSheetPage(value: unknown): {sheetId, page, pagesTotal} | null`
  (reemplaza/extiende `readSheetId`, hoy solo saca `sheetId`).
- `pagesTotal = Math.ceil(quiz.num_questions / QUIZ_MAX_QUESTIONS)`.
- **Si `pagesTotal <= 1`: el código de HOY se ejecuta exactamente igual, sin
  ninguna rama nueva en el camino** (cero riesgo de regresión — es el 100% del
  tráfico real actual).
- **Si `pagesTotal > 1`**:
  1. Traducir `answers[].q` (local 1..100) a global con la página leída del
     código de hoja.
  2. Upsert en `paper_pages` (`onConflict: quiz_id,student_code_norm,page`;
     "la última por `scanned_at` gana", mismo criterio que ya trae
     `assembleMultipageResult`). Incrementa `scans_used` +1 SOLO si la fila es
     nueva (mismo criterio que el trigger existente: una página re-escaneada
     no vuelve a gastar cupo).
  3. Trae todas las filas de `paper_pages` para ese `(quiz_id, student_code_norm)`,
     las mapea a `PageScanResult[]` y llama a `assembleMultipageResult`
     (`src/lib/multipage.ts`, sin cambios).
  4. Si **incompleto**: responde `{ ok:true, multipage:{page,pagesTotal,pagesPresent,missingPages,complete:false} }`.
     No se toca `papers` ni `grade_records` todavía.
  5. Si **completo**: se corre el MISMO cálculo de score/nota/upsert a
     `papers`+`grade_records` que ya existe hoy (se extrae a una función
     compartida para no duplicar ~80 líneas), usando `assembled.answers`
     (numeración global) contra el `answer_key` completo del ensayo.
- El chequeo de "hoja de otro ensayo" (`sheetMismatch`, ya existente) se
  mantiene igual, comparando `sheetId` leído vs `quiz.sheet_code`.

### 8. `src/app/scan/page.tsx`
- Nuevo valor en `ScanSyncState`: `"partial"`.
- En `syncResult`, nueva rama (mismo patrón que `sheetMismatch`/`manual_review`
  ya existentes): si `payload.multipage && !payload.multipage.complete` →
  `setSyncState("partial")` con mensaje "Página {page} de {pagesTotal}
  guardada. Faltan: {missingPages.join(', ')}.". Reusa el mismo banner
  condicional que ya pinta `saved`/`review`/`queued` (un color nuevo, sin
  rediseño).

## Explícitamente fuera de este pase

- Generador "beta" (autollenado masivo) para ensayos multipágina.
- Vista de dashboard dedicada a "papers esperando más páginas" (hoy solo se
  quedan en `paper_pages`, invisibles al staff hasta completarse — aceptable
  para un v1, se puede sumar una vista de progreso después).
- Reimpresión/reemplazo de una página perdida a mitad de secuencia.
- Motor OMR: cero cambios, confirmado por el diseño.

## Verificación

1. `npx tsc --noEmit` + `npx eslint` sobre los archivos tocados.
2. `npm run test:omr` — debe seguir 23/23 sin ninguna guardia nueva (el motor
   no se toca; si algo lo rompe, es una señal de que me salí del diseño).
3. `npm run build` — build de producción completo, 0 errores.
4. Prueba manual con datos sintéticos (sin cámara real): script temporal (como
   los usados en sesiones anteriores) que genera un ensayo de 150 preguntas,
   renderiza sus 2 páginas vía `renderSheet`, las "escanea" con el motor real
   (`findCorners`+`warpSheet`+`gradeBubbles`+`readSheetCode`) en cualquier
   orden, y verifica que el mapeo local→global + `assembleMultipageResult`
   reconstruyan las 150 respuestas correctas.
5. La migración de `paper_pages` se prepara pero **se pide confirmación
   explícita antes de aplicarla** a producción (regla ya vigente del proyecto).
