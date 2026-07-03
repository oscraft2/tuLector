# Prompt para Codex — Tareas 3–6 de la auditoría lector↔dashboard

> Copia desde aquí hacia abajo y pégalo como instrucción inicial.

---

Eres un ingeniero senior trabajando en **tuLector.cl** (`C:\Users\usuar\Desktop\tulector`): Next.js 16 App Router + Supabase (Postgres con RLS), deploy en Vercel vía push a `master`. La app escanea hojas de respuestas (OMR propio en TS) y las convierte en notas en un dashboard escolar. Una auditoría identificó 4 brechas que debes cerrar (tareas 3–6). Las tareas 1–2 (RLS de scan_logs y cuota real) YA están hechas — no las repitas.

## REGLAS DURAS (violarlas rompe producción)

1. **NO toques el motor OMR**: nada de `src/tulector/**` ni `src/lib/omr.ts`. Antes y después de cada tarea corre `npm run test:omr`: deben pasar las **14 guardias idénticas**. Si un cambio tuyo altera su salida, revierte.
2. **La BD de producción NO corre migraciones automáticamente.** Vercel solo construye el código. Por cada cambio de esquema: (a) crea el archivo en `supabase/migrations/` con timestamp `2026MMDDHHMMSS_nombre.sql`, y (b) entrega al final un bloque **"SQL PARA PRODUCCIÓN"** consolidado para pegar en Supabase → SQL Editor. Ese SQL debe ser **idempotente** (`ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE`), **sin dollar-quoting `$$`** (el editor lo corrompe al pegar; si necesitas una función usa cuerpo en comillas simples `LANGUAGE sql AS '...'`), y terminar con `NOTIFY pgrst, 'reload schema';`.
3. **El código debe degradar elegante si la columna/tabla nueva aún no existe en prod** (el deploy del código y la aplicación del SQL no son atómicos). Patrón: envolver el uso de campos nuevos en try/catch o tolerar `undefined`; **jamás** dejar que una columna faltante tire un 500 en un flujo existente (crear ensayo, escanear, listar).
4. **Verificación por tarea antes de commitear**: `npx tsc --noEmit` limpio (ignora errores de `tests/e2e/` por playwright sin instalar) y `npx next build` con exit 0.
5. **Commits atómicos, uno por tarea**, mensajes en español con prefijo `feat(auditoria-N):`. **NO hagas push** — el dueño despliega. No toques archivos de billing (`src/app/api/billing/**`, `src/lib/flow.ts`, `PlanCard`, `billing_catalog`) que pueden tener trabajo en curso.
6. UI en español (es-CL). Reutiliza los patrones existentes:
   - Server actions con estado: tipo `DashboardActionState` + helpers `actionSuccess()`/`actionError()` en `src/app/dashboard/actions.ts`.
   - Componentes de feedback: `ActionButton`, `SubmitButton`, `ConfirmDialog`, `ActionFeedbackDialog`, `DeleteButton` en `src/components/dashboard/`.
   - Contexto de sesión server: `getDashboardContext()` de `@/lib/supabase_server` (devuelve `{ supabase, user, school, isAdmin, locale }`, todo scopeado al colegio activo).
   - Estilo visual: bordes `#e6e8eb`, azul `#07305f`, tipografía existente. Mira `src/app/dashboard/students/page.tsx` como referencia.

## TAREA 3 — Exportar CSV real (hoy los botones no exportan nada)

**Problema:** el botón "Exportar CSV" (`src/app/dashboard/students/page.tsx`) y "Registrar exportacion PDF/Excel" (`src/app/dashboard/results/[quizId]/page.tsx`) llaman `logExport` (`actions.ts`), que solo inserta una fila en `export_logs`. **No se genera ningún archivo.**

**Qué hacer:**
1. Nuevo route handler `GET /api/export/students` que: use `getDashboardContext()`, exija `isAdmin` (403 si no), genere un CSV UTF-8 con BOM (para Excel) con columnas `rut,nombre,curso,registrado` de los `students` del colegio, registre la exportación en `export_logs` (mismos campos que hoy usa `logExport`), y responda con `Content-Type: text/csv; charset=utf-8` y `Content-Disposition: attachment; filename="alumnos_<fecha>.csv"`. Acepta query param opcional `?course=<nombre>` para filtrar por curso.
2. Nuevo route handler `GET /api/export/results/[quizId]` análogo: columnas `alumno,rut,correctas,total,porcentaje,nota,puntaje_equivalente,fecha` desde `papers` del quiz (scopeado al colegio), nombre de archivo `resultados_<titulo-slug>.csv`.
3. Reemplaza los botones actuales por links `<a href="/api/export/..." download>` con el mismo estilo visual, deshabilitados si `!isAdmin`. Elimina los forms de `logExport` que queden huérfanos (pero NO elimines la action `logExport` si otra página la usa — verifica con grep).
4. Escapa correctamente los campos CSV (comillas, comas, saltos de línea).

**Criterio de aceptación:** descargar el archivo desde el navegador logueado como admin abre un CSV legible en Excel con datos reales; un profe no-admin recibe 403; queda fila en `export_logs`.

## TAREA 4 — Persistir y verificar el código de hoja en el SERVIDOR

**Contexto:** cada hoja impresa desde un ensayo lleva un código OMR (`sheet_code` del quiz, entero). El lector (`/scan`) lo lee y lo manda en `payload.code` (`{ version, sheetId, page, pagesTotal } | null`) a `POST /api/scan/result` (`src/app/api/scan/result/route.ts`)… **donde se ignora**: hoy la verificación es solo un aviso en el cliente, y un escaneo de la hoja equivocada se guarda como nota válida.

**Qué hacer:**
1. Migración: `ALTER TABLE papers ADD COLUMN IF NOT EXISTS sheet_code_read INT;`
2. En `/api/scan/result`: extrae `payload.code?.sheetId` (valida que sea entero ≥ 0), guárdalo en `paperPayload.sheet_code_read` (null si no vino). **Tolerante**: si la columna aún no existe en prod, el insert no debe fallar (inserta sin ese campo en un retry, o detecta el error de columna y reintenta sin él).
3. Verificación server-side SUAVE: si `quiz.sheet_code` existe **y** `sheetIdRead` existe **y** difieren → fuerza `status = "manual_review"` (aunque el RUT haya matcheado) y agrega a la respuesta `sheetMismatch: { read, expected }`. Si cualquiera de los dos falta, no penalices (hojas antiguas sin código siguen funcionando igual que hoy).
4. En `/scan` (`syncResult`, `src/app/scan/page.tsx`): si la respuesta trae `sheetMismatch`, muestra en `syncMessage` algo como `"Hoja de otro ensayo (código X, esperado Y) → guardado para revisión"`. NO toques nada más de esa página.
5. En `src/app/dashboard/papers/page.tsx`: cuando un paper esté en `manual_review` y tenga mismatch detectable, muestra un pill ámbar "Hoja de otro ensayo". (Si no persistes el expected, basta con mostrar el pill cuando `sheet_code_read` no coincida con el `sheet_code` del quiz — puedes traer `quizzes(sheet_code)` en el select.)

**Criterio de aceptación:** escanear una hoja del ensayo B con el ensayo A activo → queda en revisión manual con el aviso; hoja sin código → flujo idéntico al actual; `test:omr` intacto.

## TAREA 5 — Darle uso a `grade_records` (hoy es una tabla write-only)

**Contexto:** `grade_records` se upsertea en cada escaneo y cada asignación manual (`school_id, student_code, quiz_id, paper_id, raw_score, total_questions, calculated_grade, passing, graded_at`, unique en `school_id,student_code,quiz_id`), pero **ninguna página lo lee**.

**Qué hacer:**
1. En la ficha del alumno `src/app/dashboard/students/[id]/page.tsx`, agrega una sección **"Historial de evaluaciones"**: tabla con `Ensayo (título) | Correctas | Nota | Aprobado | Fecha`, leyendo `grade_records` del `student_code` (= rut normalizado del alumno) con join/lookup a `quizzes` para el título. Orden: `graded_at desc`. Respeta el layout/estilo existente de esa página (tabla desktop + cards móvil, como `DataTable` si esa página ya lo usa).
2. En `src/app/dashboard/results/[quizId]/page.tsx`, agrega KPI "Aprobación": % de `grade_records.passing = true` del quiz (si no hay registros, muestra "—").
3. Si `grade_records` está vacío para ese alumno/quiz, estado vacío elegante ("Aún no rinde evaluaciones.").

**Criterio de aceptación:** tras escanear una hoja identificada, la ficha del alumno muestra la evaluación con su nota sin tocar nada más.

## TAREA 6 — Ligar curso↔ensayo↔alumno por `course_id` (hoy es texto frágil)

**Contexto:** `quizzes.grade` y `students.course` guardan el **nombre** del curso como texto. Renombrar/borrar un curso rompe los vínculos en silencio. Existe `courses(id, school_id, name, grade)` con unique `(school_id, name)`.

**Qué hacer (migración SUAVE, sin romper datos ni flujos):**
1. Migración:
   - `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;`
   - `ALTER TABLE students ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;`
   - Backfill por nombre: `UPDATE quizzes q SET course_id = c.id FROM courses c WHERE c.school_id = q.school_id AND c.name = q.grade AND q.course_id IS NULL;` (análogo para `students` con `students.course`).
2. **Doble escritura** (texto + id) en todas las actions que crean/actualizan: `createQuiz`, `duplicateQuiz`, `createStudent`, `importStudents`, `createStudentAndAssignPaper`, `updateStudentCourse`, y `findOrCreateCourse` (que ya devuelve el id — úsalo). El texto se mantiene como fallback/display; el id es la verdad.
3. **Lectura tolerante**: donde se filtra o agrupa por curso, preferir `course_id` si existe y caer al texto si es null (datos viejos). No cambies las UI de golpe: el objetivo de esta tarea es que los datos nuevos queden bien ligados.
4. Al **renombrar** un curso (si existe esa action) solo cambia `courses.name` — los vínculos por id sobreviven; sincroniza el texto de students/quizzes del colegio en la misma action (`UPDATE ... SET course/grade = nuevoNombre WHERE course_id = ...`).
5. `deleteCourse`: hoy borra la fila; con FK `ON DELETE SET NULL` los alumnos/ensayos quedan con `course_id = null` y conservan el texto — mantén ese comportamiento y ajusta el mensaje de confirmación si hace falta.

**Criterio de aceptación:** crear alumno + ensayo nuevos deja `course_id` poblado en ambos; el backfill liga los existentes; renombrar un curso no rompe el roster ni los ensayos; todo lo anterior funciona ANTES de aplicar el SQL (degradación elegante) y mejor después.

## ENTREGABLE FINAL

1. Cuatro commits (uno por tarea) con build verde y `test:omr` idéntico.
2. Un bloque único **"SQL PARA PRODUCCIÓN"** al final de tu resumen, consolidando TODAS las migraciones nuevas, idempotente, sin `$$`, terminando en `NOTIFY pgrst, 'reload schema';` — listo para pegar una sola vez en Supabase SQL Editor.
3. Lista de verificación manual para el dueño (qué clickear para validar cada tarea en producción).
