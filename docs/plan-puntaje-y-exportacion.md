# Plan — tuLector: puntaje por pregunta, escala de nota propia y exportación configurable

## Contexto

Hoy un ensayo se corrige con un modelo único y rígido:

- **Toda pregunta cerrada vale 1 punto.** `computeQuizScore` (`src/lib/grading.ts:55`) suma
  `+1` por acierto y el total es `num_questions − abiertas − selección múltiple`. No hay forma de
  decir "la 7 vale 3".
- **La nota sale de una sola fórmula.** `calculateGrade` (`src/lib/latam.ts:66`) interpola con
  exigencia. El ensayo puede ajustar `exigencia` (selector en `QuizCreateForm.tsx:225`), pero la
  **nota mínima de aprobación** y la **escala** solo existen a nivel de colegio
  (`schools.passing_grade`, `grading_scale_min/max`) — un colegio con su propia tabla oficial
  puntaje→nota no la puede cargar.
- **El puntaje equivalente solo conoce tres casos**: PAES 100-1000, SIMCE 100-400 y % simple
  (`equivalentScore`, `grading.ts:16`). No hay escala propia.
- **Las preguntas de desarrollo no suman.** Tienen `max_points` en la rúbrica y el profesor ya
  confirma puntaje uno por uno (`confirmOpenAnswer`, `actions.ts:1010`), pero ese número **no
  cuenta para nada**: `computeQuizScore` las excluye del numerador y del denominador.
- **La exportación es fija.** El CSV de resultados tiene 8 columnas invariables y separador coma
  (`src/app/api/export/results/[quizId]/route.ts`); el otro exportador es el de la plataforma DIA
  (`src/lib/dia_export.ts`). No hay forma de que un cliente pida sus columnas, sus encabezados o
  el detalle pregunta por pregunta.

**Lo que se quiere:** que cada ensayo defina cuánto vale cada pregunta, con qué escala se traduce
a nota, con qué puntaje equivalente, y que la salida se exporte con las columnas y el formato que
pida cada cliente.

**Lo que ya existe y hay que reusar, no reinventar:**

- `question_metadata.weight DECIMAL DEFAULT 1.0` (`20260525000001_latam.sql:94`) — columna por
  pregunta que **ningún código lee hoy**. Se descarta a propósito: obliga a una fila por pregunta
  y a un JOIN en el camino caliente del escaneo. El puntaje va en `quizzes`, junto al resto de la
  configuración del ensayo (mismo criterio que `open_questions`, `option_overrides`).
- `export_formats` (`20260525000001_latam.sql:102`), sembrada con los mapeos de columnas de
  Agencia de Calidad (CL), ICFES (CO) y PLANEA (MX) — **nunca consultada**. Es la base de los
  presets institucionales.
- `generateExportCSV` (`latam.ts:235`) — código muerto con esos mismos formatos hardcodeados. Se
  **elimina**: lo reemplaza el catálogo de columnas de la Fase 4.
- `open_question_rubrics[q].max_points` — ya es el puntaje de cada abierta. No se duplica.
- `parseOptionOverrides` / `serializeOptionOverrides` (`quiz_constraints.ts:146`) — el patrón
  exacto de "CSV `pregunta:valor` solo para las distintas" que pide el panel.
- El trigger `calculate_paper_results`, que recalculaba `grade` en la BD con exigencia 0.60
  hardcodeada, **ya fue eliminado** (`20260701200000_drop_paper_results_trigger.sql`). La app es
  la única fuente de verdad del puntaje — no hay que pelear con la BD.

---

## Decisión de diseño que sostiene todo el plan

**`papers.score` / `papers.total` NO cambian de significado.** Siguen siendo *respuestas
correctas* / *preguntas cerradas* (columnas `INT`). Toda la UI que dice "Respuestas Correctas"
(`quizzes/[id]/page.tsx:314`), el promedio del ensayo (`page.tsx:65`), la ficha del alumno, el
reporte de curso y el portal del apoderado siguen funcionando sin tocarse.

El puntaje ponderado vive en **columnas nuevas**: `papers.points` / `papers.points_total`
(`NUMERIC`). La **nota** y el **puntaje equivalente** pasan a calcularse siempre desde
`points/points_total`.

Cuando un ensayo no tiene ponderación ni abiertas puntuadas, `points === score` y
`points_total === total` — **cero cambio de comportamiento en todo lo que hay hoy en producción**.
Esa equivalencia es la guardia de regresión principal.

---

## Fase 1 — Puntaje por pregunta

### Migración `supabase/migrations/20260813000000_quiz_points.sql`

Aditiva, sin backfill (los `NULL` ya son el default correcto):

```sql
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS default_question_points NUMERIC;  -- NULL = 1
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS question_points TEXT;             -- "3:2,7:0.5"
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS score_open_questions BOOLEAN;     -- NULL/false = hoy
ALTER TABLE papers  ADD COLUMN IF NOT EXISTS points NUMERIC;
ALTER TABLE papers  ADD COLUMN IF NOT EXISTS points_total NUMERIC;
ALTER TABLE grade_records ALTER COLUMN raw_score TYPE NUMERIC;
ALTER TABLE grade_records ALTER COLUMN total_questions TYPE NUMERIC;
NOTIFY pgrst, 'reload schema';
```

`grade_records.raw_score` pasa a guardar **puntos** (su nombre ya es "puntaje bruto"); con
ponderación ausente el valor no cambia respecto de hoy.

### Parser en `src/lib/quiz_constraints.ts`

`parseQuestionPoints(value, numQuestions)` → `Record<number, number>` y su
`serializeQuestionPoints`. Calcado de `parseOptionOverrides`, con dos diferencias: acepta
**decimales** (`/^(\d+)\s*[:=]\s*(\d+(?:[.,]\d+)?)$/`, coma o punto) y el rango válido es
`0 ≤ pts ≤ 100`. Tolerante a basura, descarta pares fuera de rango — igual que sus hermanas.

### `computeQuizScore` (`src/lib/grading.ts`)

Es el único lugar donde se corrige (lo llaman el escaneo en vivo,
`api/scan/result/route.ts:337`, y la re-corrección masiva, `actions.ts:425`). Se extiende:

1. `pointsFor(q)` = override de `question_points` → `default_question_points` → `1`.
2. Cerradas: `points += pointsFor(q)` por acierto; `pointsTotal += pointsFor(q)` siempre.
   `score`/`total` se siguen calculando igual que hoy, en paralelo.
3. Abiertas, solo si `score_open_questions`: `pointsTotal += rubrics[q].max_points` y
   `points += confirmed_points` de `open_answers` (**nunca** `puntaje`, el de la IA sin
   confirmar — el principio del plan de abiertas es "la IA sugiere, el profesor decide"). Las
   abiertas sin confirmar suman 0 al numerador pero **sí** al denominador; hay que avisarlo en la
   UI, porque hasta que el profesor confirme la nota está deprimida.
   Esto obliga a pasar las `open_answers` del paper como parámetro nuevo y opcional a
   `computeQuizScore` — el llamador del escaneo en vivo pasa `[]` (recién escaneada, nada
   confirmado) y `confirmOpenAnswer` gana un recálculo (ver Fase 5).
4. Selección múltiple: sigue fuera de numerador y denominador. Sin cambio.
5. Devuelve `{ score, total, points, pointsTotal, grade, passing, equivalentScore }`.

`calculateGrade` y `equivalentScore` reciben `points/pointsTotal`, no `score/total`.

---

## Fase 2 — Nota y equivalencia por ensayo

### Migración `supabase/migrations/20260813000001_quiz_grade_scale.sql`

```sql
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS passing_grade NUMERIC;     -- NULL = la del colegio
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS grade_scale_min NUMERIC;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS grade_scale_max NUMERIC;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS grade_table TEXT;          -- JSON, ver abajo
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS equivalent_scale TEXT;     -- JSON {"min":0,"max":100}
```

### Cadena de resolución (en `grading.ts`, un solo lugar)

`grade_table` del ensayo → fórmula de exigencia con overrides del ensayo
(`exigencia`, `passing_grade`, `grade_scale_min/max`) → valores del colegio → perfil de país.
Cada eslabón solo aporta lo que tiene definido, así que hoy (todo `NULL`) el resultado es
idéntico al actual.

### Tabla puntaje→nota

`src/lib/grade_table.ts`, nuevo. Formato JSON-string en `quizzes.grade_table`, con el mismo
criterio tolerante de `parseOpenQuestionRubrics` (JSON inválido → `null` → se cae a la fórmula):

```json
{"mode":"points","rows":[{"from":0,"grade":1.0},{"from":12,"grade":4.0},{"from":20,"grade":7.0}]}
```

`gradeFromTable(points, table)`: interpola linealmente entre tramos y satura en los extremos.
`mode` admite `"points"` o `"percent"` para colegios que definen su tabla por porcentaje.
`passing` = `grade >= passing_grade` resuelto.

### Escala de equivalencia propia

`equivalentScore()` gana una rama previa: si el ensayo tiene `equivalent_scale`
(`{min,max}`), devuelve `min + pct * (max − min)` redondeado. PAES/SIMCE siguen siendo casos
cerrados por `evaluation_type` y tienen precedencia (son fórmulas oficiales, no configurables).

---

## Fase 3 — UI en el editor del ensayo

Todo dentro de `src/components/dashboard/AnswerKeyEditor.tsx`, siguiendo el patrón del panel
"Rúbrica de corrección (IA)" que ya vive ahí (`AnswerKeyEditor.tsx:451-545`): plegado por
defecto, resumen en la cabecera, y campos con el manejo de texto-en-edición que ya se usa para
`num_questions` y `max_points` (estado `string | null`, normalización en `onBlur` — sin eso el
campo no se puede vaciar para reescribir).

**Panel "Puntaje por pregunta"** (cerrado por defecto; cabecera: *"Todas valen 1 pt · total 20
pts"*):
- Campo "Aplicar mismo puntaje a todas" → `default_question_points`.
- Grilla compacta de las preguntas cuyo puntaje difiere del default, con botón para agregar.
- Si hay abiertas: casilla **"Sumar las preguntas de desarrollo al puntaje"** →
  `score_open_questions`, mostrando el total de la rúbrica y advirtiendo que las no confirmadas
  suman 0.
- Total vivo: *"Total del ensayo: 27 pts (20 alternativas + 7 desarrollo)"*.
- Hidden inputs `default_question_points` y `question_points` (serializado), igual que hoy con
  `open_questions` / `option_overrides`.

**Panel "Nota y equivalencia"** (recoge el selector de Exigencia que hoy está suelto en
`QuizCreateForm.tsx:223-236`):
- Exigencia (el selector actual, sin cambios), **Nota mínima de aprobación**, **Nota mínima /
  máxima de la escala** — todos con el valor del colegio como placeholder y `NULL` si no se tocan.
- Alternador **"Usar tabla de equivalencia del colegio"** → editor de tramos puntaje→nota.
- **Puntaje equivalente**: `Ninguno / % / PAES / SIMCE / Rango propio (min–max)`.

**Tabla de resultados del ensayo** (`quizzes/[id]/page.tsx:313`). Hoy son seis columnas —
`Alumno | Curso | Respuestas Correctas | Resultado Equivalente | Estado | Fecha`— donde
"Respuestas Correctas" es `18/20` y "Resultado Equivalente" muestra **una sola** cosa según
`evaluation_type` (`getScoreDisplay`, `page.tsx:119`): `pts PAES`, `pts SIMCE` o `Nota X.X`.

Con ponderación, `18/20` pasa a ser engañoso (si la 7 vale 3, 18 correctas no son 18 puntos). Por
eso:

- Si el ensayo **tiene** ponderación o abiertas puntuadas, la columna de correctas muestra
  **`18/20 · 22/24 pts`** y aparece la nota junto al equivalente (`750 pts PAES · Nota 6.2`) — el
  profesor necesita ver ambas. Se replica en `renderMobileRow` (`page.tsx:343`), que hoy repite la
  misma información en tarjeta.
- Si **no** la tiene, la tabla queda exactamente como está hoy.
- Mismo criterio en `QuizStats`, en la ficha del alumno (`dashboard/students/[id]/page.tsx`) y en
  el portal de resultados `/r/[token]`, que hoy arman su encabezado con `score/total`.

Server actions `createQuiz` y `updateQuiz` (`src/app/dashboard/actions.ts`) leen los campos
nuevos y los agregan al payload con **la misma degradación por columna faltante** que ya usan
`sheet_mode`, `course_id`, `option_overrides` y `multi_select_questions`
(`isMissingColumnError` + `withoutX`, `actions.ts:381-409`): si la migración no está aplicada, el
ensayo se guarda igual y solo se rechaza cuando el profesor **sí** configuró algo que requiere la
columna.

---

## Fase 4 — Exportación configurable

### Catálogo único de columnas — `src/lib/export_columns.ts` (nuevo)

Una sola definición de qué se puede exportar; la usan la UI, el CSV, el Excel y los presets:

```ts
export const EXPORT_COLUMNS = [
  { id: "student_name", label: "Alumno",   value: (r) => ... },
  { id: "rut",          label: "RUT",      value: (r) => ... },
  { id: "course",       label: "Curso",    value: (r) => ... },
  { id: "correct",      label: "Correctas" },
  { id: "points",       label: "Puntos" },
  { id: "points_total", label: "Puntos totales" },
  { id: "percent",      label: "Porcentaje" },
  { id: "grade",        label: "Nota" },
  { id: "equivalent",   label: "Puntaje equivalente" },
  { id: "passing",      label: "Aprobado" },
  { id: "scanned_at",   label: "Fecha" },
] as const;
```

Más dos bloques expandibles a `p1..pN`: `answers_per_question` (la letra marcada) y
`points_per_question` (puntos obtenidos). El mapeo de la respuesta cruda a celda ya está resuelto
en `dia_export.ts` (`celdaRespuesta` / `celdaMultiSelect`: `-` → vacío, `?` o doble marca →
`NULA`, multi-select `1|3|5` tal cual) — **se extraen a `export_columns.ts` y `dia_export.ts`
pasa a importarlas**, para que la exportación DIA y la genérica no diverjan.

El label de cada columna es **sobrescribible** por plantilla (así el cliente que exige `RUN` en
vez de `rut` lo obtiene sin código nuevo).

### Ruta — `src/app/api/export/results/[quizId]/route.ts` (se extiende, no se duplica)

Acepta querystring: `?cols=student_name,rut,points,grade&sep=;&fmt=xlsx&template=<uuid>`.
**Sin querystring devuelve exactamente el CSV actual** (compatibilidad con cualquier enlace
guardado). `fmt=xlsx` genera el libro con `xlsx`, que ya es dependencia del proyecto
(`package.json:42`, hoy solo usada en el cliente para leer la clave). El `toCsv` de
`src/lib/csv.ts` gana un parámetro de separador. Se conserva el BOM `﻿` (Excel en Windows) y
el registro en `export_logs`, que hoy es **bloqueante** (`route.ts:69`): si falla el log, no hay
descarga — se mantiene ese criterio, sumando el detalle de columnas al campo `reason`.

Sigue exigiendo `isAdmin`, igual que hoy.

### Plantillas — migración `20260813000002_export_templates.sql`

```sql
CREATE TABLE IF NOT EXISTS export_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    columns JSONB NOT NULL,        -- ["student_name","rut","points","grade"]
    header_labels JSONB,           -- {"rut":"RUN"}
    separator TEXT DEFAULT ',',
    format TEXT DEFAULT 'csv',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name)
);
```

Con RLS por `school_id` siguiendo el patrón de `open_answers`
(`20260724010000_open_answers.sql:44`). La plantilla con `is_default` es la del establecimiento:
el panel la preselecciona para todos los docentes. Solo un admin la crea o edita.

### Presets institucionales

`src/lib/export_presets.ts`: lee `export_formats` (ya sembrada con Agencia de Calidad, ICFES y
PLANEA) y traduce su `column_mapping` a `{columns, header_labels, separator}` del catálogo. Si la
tabla está vacía o el país no tiene preset, el selector simplemente no los ofrece.

### Panel — `src/components/dashboard/ExportPanel.tsx` (nuevo)

Reemplaza el par de botones sueltos de `quizzes/[id]/page.tsx:291-312`. Casillas de columnas,
separador, formato, selector de plantilla/preset y botón "Guardar como plantilla" (solo admin).
El botón **"Exportar Formato Pruebas DIA"** se conserva tal cual como una entrada más del panel:
es un formato cerrado que consume la extensión de dia-bot y no debe volverse configurable.

---

## Fase 5 — Recalcular lo que ya está escaneado

`updateQuiz` (`actions.ts:412`) ya re-corrige todas las hojas cuando cambia la clave, la
estructura o las abiertas, reusando `computeQuizScore`. Se amplía la condición para incluir
cambios en puntaje y escala (`question_points`, `default_question_points`,
`score_open_questions`, `grade_table`, `passing_grade`, `grade_scale_*`, `equivalent_scale`), y el
`update` de `papers` pasa a escribir también `points` / `points_total`. El diálogo de confirmación
que ya advierte "se recalcularán N hojas" (`QuizCreateForm.tsx:254`) cubre este caso sin cambios.

`confirmOpenAnswer` (`actions.ts:1010`) hoy solo escribe `confirmed_points`. Si el ensayo tiene
`score_open_questions`, debe **recalcular el paper** (mismo `computeQuizScore`, mismo upsert a
`grade_records`) — si no, el puntaje confirmado sigue sin llegar a la nota y la feature queda a
medias.

---

## Verificación

1. **Test de puntaje** — `src/lib/grading.test.ts` (nuevo, `node:test` + `tsx`, mismo patrón que
   `src/lib/dia_curso.test.ts`):
   - **Guardia de no-regresión (la más importante):** un ensayo sin nada configurado da
     `points === score`, `points_total === total` y **la misma nota exacta** que hoy, en una
     batería de casos (con abiertas, con selección múltiple, con clave parcial `-`, 0 correctas,
     todas correctas).
   - Ponderación: `"3:2,7:3"` con default 1 sobre 20 preguntas → total 24 pts; acertar solo la 3
     y la 7 → 5 pts.
   - Decimales (`0.5`) y coma decimal (`7:0,5`).
   - Abiertas: con `score_open_questions` off no tocan el total; on, suman `max_points` al
     denominador y solo `confirmed_points` al numerador (una abierta sin confirmar suma 0).
   - Tabla puntaje→nota: tramos exactos, interpolación intermedia y saturación fuera de rango.
   - Escala equivalente propia, y que PAES/SIMCE le ganan.
2. **Test de exportación** — `src/lib/export_columns.test.ts`: selección y orden de columnas,
   separador `;`, `header_labels` sobrescribiendo (`rut` → `RUN`), expansión `p1..pN`, y que las
   celdas de respuesta coinciden con las que produce `buildDiaCsv` para el mismo paper (la prueba
   de que extraer `celdaRespuesta` no cambió nada).
3. **`npm run test:omr`** (28 guardias) y **`npm run test:compact`** verdes: el motor OMR no se
   toca en todo este trabajo.
4. **`npm run build`** limpio.
5. **En la app, con un ensayo real:**
   - Crear un ensayo ponderado (una pregunta de 3 pts), imprimir, escanear una hoja → la nota del
     HUD, la del detalle del ensayo y la del portal `/r/[token]` coinciden entre sí.
   - Editar el puntaje de un ensayo **ya escaneado** → confirmar el recálculo y verificar que
     `papers` y `grade_records` quedaron consistentes, sin notas duplicadas.
   - Confirmar una abierta con `score_open_questions` activo → la nota sube en el acto.
   - Un ensayo **antiguo** (sin nada configurado) → la nota no se movió ni un decimal.
   - Exportar con columnas elegidas, con `;`, en `.xlsx`, y con detalle por pregunta; abrirlo en
     Excel en Windows y verificar tildes y Ñ.
   - Guardar una plantilla como admin y comprobar que otro docente del colegio la ve
     preseleccionada.
6. **Migraciones:** aplicar los tres SQL en Supabase **antes** del deploy. Verificar además el
   camino sin migrar (base vieja): el ensayo se sigue guardando y solo se rechaza al configurar
   puntaje/escala, gracias a la degradación por `isMissingColumnError`.

## Antes de empezar

Copiar este plan a `docs/plan-puntaje-y-exportacion.md` dentro del repo: el archivo de plan de la
sesión se reutiliza entre tareas distintas y se pierde.

## Riesgos conocidos

- **Cambio de significado de `grade_records.raw_score`** (pasa de correctas a puntos). Es
  invisible mientras no haya ponderación, pero cualquier consulta que lo asuma entero hay que
  revisarla: `src/lib/course_report.ts`, `src/lib/test_report.ts`, la ficha del alumno y el portal
  del apoderado.
- **`points_total` y las abiertas sin confirmar**: mientras el profesor no confirme, la nota está
  deprimida a propósito. Sin un aviso claro en la UI del ensayo, se lee como un bug.
- **Ensayos hermanos de un mismo lote** (`batch_id`) comparten clave y formato pero son filas
  distintas: la ponderación se configura por ensayo, así que editar uno **no** propaga al resto.
  Vale advertirlo en el panel cuando el ensayo tiene `batch_id`.
