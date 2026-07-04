# Prompt para DeepSeek (multi-agente) — Dashboard tuLector v2

> Copia desde "Eres un equipo de ingeniería…" hacia abajo. El encabezado es para el dueño.

**Confirmación clave para el dueño:** ninguna de estas tareas modifica el motor OMR
(`src/tulector/**`, `src/lib/omr.ts`). Solo se trabaja sobre la capa de presentación,
análisis y flujos del dashboard. El motor tiene 14 guardias (`npm run test:omr`) que
deben quedar idénticas. El APK y el pipeline de escaneo no se tocan.

**Contexto de esta auditoría:** el dashboard actual (julio 2026) cubre el ciclo básico
(crear ensayo → escanear → revisar → ver resultados) pero carece de funcionalidades
que un profesor o UTP usa a diario: vista de curso, filtros por fecha, acciones
masivas, notificaciones, comparación entre ensayos, y reporting imprimible. Este plan
cierra esas brechas.

---

Eres un equipo de ingeniería (multi-agente) trabajando en **tuLector.cl**
(`C:\Users\usuar\Desktop\tulector`): app web Next.js 16 (App Router) + Supabase,
desplegada en Vercel. El dashboard es el centro de gestión para profesores y
administradores escolares: crean ensayos, importan alumnos, revisan hojas escaneadas,
y analizan resultados con estadísticas por pregunta, eje y alumno.

## ESTADO ACTUAL (verificado — no lo cambies sin razón)

### Páginas del dashboard (12 rutas)
| Ruta | Descripción |
|------|-------------|
| `/dashboard` | KPIs generales, SIMCE histórico, últimos quizzes/papers, cuota |
| `/dashboard/students` | CRUD de alumnos, import CSV, filtro por curso |
| `/dashboard/students/[id]` | Perfil del alumno: historial de notas, dominio por eje, tendencia |
| `/dashboard/quizzes` | Lista de ensayos + creación (AnswerKeyEditor con PAES/SIMCE) |
| `/dashboard/quizzes/[id]` | Detalle del ensayo: clave, papers, QuizStats |
| `/dashboard/results/[quizId]` | Resultados de un ensayo: tabla con notas, export CSV |
| `/dashboard/papers` | Hojas escaneadas (100 filas), identificación pendiente |
| `/dashboard/papers/[id]` | Identificar alumno: asignar existente o crear nuevo |
| `/dashboard/team` | Miembros del colegio + invitaciones |
| `/dashboard/settings` | Perfil, institución, idioma, desconexión |
| `/dashboard/billing` | QuotaBar + 4 planes + tabla de órdenes (29 líneas) |
| `/dashboard/onboarding` | Creación de colegio (3 tipos: colegio/superior/personal) |

### Componentes clave del dashboard
- **DashboardLayoutShell** (274 líneas): sidebar colapsable, topbar con identidad del colegio + GlobalSearch + campana (solo muestra papers pendientes, no notificaciones reales) + menú de perfil, bottom nav móvil
- **QuizStats** (278 líneas): análisis por pregunta con barras de distractores, distribución de notas, dominio por eje, sugerencias de refuerzo
- **GlobalSearch** (168 líneas): búsqueda con Ctrl+K, debounced, busca alumnos y quizzes
- **OMRVisualDebugger** (211 líneas): visor canvas de foto original + warp con burbujas superpuestas
- **DataTable** (55 líneas): tabla genérica con vista desktop/mobile
- **QuotaBar** (15 líneas): barra de progreso de cuota
- **AnswerKeyEditor** (191 líneas): editor de clave con PAES/SIMCE, selector de ejes

### Librerías de análisis (no se tocan salvo para extender)
- `src/lib/item_analysis.ts` (167 líneas): `computeItemAnalysis()`, `computeAxisMastery()`
- `src/lib/latam.ts` (266 líneas): `calculateGrade()`, `itemAnalysis()`, `groupStats()`
- `src/lib/country_profiles.ts` (74 líneas): escalas por país (CL con SIMCE/DIA)
- `src/lib/quota_alerts.ts` (125 líneas): alertas de cuota 90/100%
- `src/lib/quiz_constraints.ts` (30 líneas): límites de preguntas/opciones

### Server actions
- `src/app/dashboard/actions.ts` (827 líneas): 25 acciones (createQuiz, importStudents, inviteMember, etc.)
- `src/app/dashboard/onboarding/actions.ts` (51 líneas): completeOnboarding

### API endpoints del dashboard
- `GET /api/search` — búsqueda global (alumnos + quizzes)
- `GET /api/export/students` — CSV de alumnos
- `GET /api/export/results/[quizId]` — CSV de resultados

## REGLAS DURAS (violarlas rompe producción — no negociables)

1. **NUNCA toques el motor OMR**: nada de `src/tulector/**` ni `src/lib/omr.ts` ni `src/lib/sheet_*.ts` ni `src/lib/scan_log.ts`. Corre `npm run test:omr` ANTES y DESPUÉS de cada tarea: deben pasar las **14 guardias idénticas**. Si tu cambio altera su salida, revierte.
2. **El build de Next.js debe ser verde**: `npx next build` con exit 0 ANTES de cada commit. `npx tsc --noEmit` limpio (ignora errores de `tests/e2e/` por playwright).
3. **NO hagas push ni deploy.** Commits LOCALES, uno por tarea, mensaje en español `feat(dashboard-<letra><numero>): ...`. El dueño despliega.
4. **La app móvil (APK) debe seguir funcionando igual.** No quites `isNativeApp()`, no toques `capacitor.config.ts`, no rompas el flujo `/scan` → `/dashboard`.
5. **UI en español (es-CL).** Reusa componentes existentes (`SubmitButton`, `ActionFeedbackDialog`, `ConfirmDialog`, `DataTable`, `KPI`, `KPIGrid`, `PageHeader`, patrones de `getDashboardContext`). No inventes nuevos sistemas de diseño.
6. **Server Components por defecto.** Solo usa `"use client"` cuando necesites interactividad (estado, efectos, eventos). Las queries de datos van en el server.
7. **Respeta el modelo de datos existente.** No crees columnas nuevas en tablas sin documentarlo explícitamente. Si necesitas una columna o tabla nueva, descríbela en el commit y agrega el SQL de migración.
8. **No toques el WIP de billing** (`src/app/api/billing/**`, `src/lib/flow.ts`, `src/lib/mercadopago.ts`, `src/lib/stripe.ts`) excepto en la tarea C4.

## COORDINACIÓN MULTI-AGENTE (evita choques entre sub-agentes)

Asigna **un archivo a un solo agente por vez**. Archivos de alto contacto que solo UN agente puede tocar a la vez: `src/app/dashboard/layout.tsx`, `src/components/dashboard/DashboardLayoutShell.tsx`, `src/app/dashboard/actions.ts`, `src/app/dashboard/page.tsx`, `src/lib/supabase_server.ts`. Si dos tareas necesitan el mismo archivo, hazlas en serie, no en paralelo. Después de cada tarea: build verde + `test:omr` idéntico ANTES de pasar a la siguiente.

---

## FASE A — Lo que todo profesor necesita el día 1 (bajo riesgo, alto impacto)

### Tarea A1 — Vista de curso (`/dashboard/courses/[id]`)
**Problema:** hoy un profesor no puede ver "¿cómo le fue al 4°A en el SIMCE de Matemática?". Tiene que mirar alumno por alumno o el resultado global de la escuela. No hay agregación por curso.
**Qué hacer:**
1. Nueva ruta `src/app/dashboard/courses/[id]/page.tsx` (Server Component). Carga el curso por ID (validando que pertenece al `school.id` del contexto).
2. Muestra KPIs del curso: N° de alumnos, promedio general, % sobre 4.0, último ensayo rendido.
3. Tabla de alumnos del curso con: nombre, RUT, promedio acumulado, último ensayo (nota), tendencia (↑↓→).
4. Sección "Ensayos del curso": tabla con cada ensayo donde al menos un alumno del curso tiene paper, mostrando: nombre del ensayo, fecha, N° alumnos que rindieron, promedio del curso en ese ensayo, % aprobación. Click en la fila → `/dashboard/results/[quizId]`.
5. Gráfico de evolución: mini sparkline del promedio del curso a través de los ensayos (usar `grade_records` agregados).
**Archivos:** nuevo `courses/[id]/page.tsx`, `src/app/dashboard/layout.tsx` (agregar nav item "Cursos"), `src/app/dashboard/actions.ts` (si se necesita alguna acción nueva). **No toca motor.**
**Aceptación:** desde el menú lateral, "Cursos" lista los cursos; click en uno muestra KPIs + alumnos + historial de ensayos.

### Tarea A2 — Empty states con guía
**Problema:** un colegio nuevo entra al dashboard y ve ceros, tablas vacías, y un mensaje genérico "No hay datos". No sabe qué hacer primero.
**Qué hacer:**
1. Componente `EmptyState` reutilizable: ícono, título, descripción, botón de acción principal, enlace secundario. Variantes: "Sin ensayos", "Sin alumnos", "Sin papers", "Sin cursos".
2. En `/dashboard` (página principal): si `quizCount === 0`, mostrar empty state "Crea tu primer ensayo" con botón que lleve a `/dashboard/quizzes`.
3. En `/dashboard/students`: si no hay alumnos, mostrar "Importa tu lista de alumnos" con botón que abra el CSV import.
4. En `/dashboard/papers`: si no hay papers, mostrar "Escanea hojas desde la app móvil" con instrucción breve.
5. En `/dashboard/quizzes`: si no hay quizzes, el `QuizCreateForm` ya está visible; agregar un texto guía encima: "Un ensayo define las preguntas, la clave de respuestas y el tipo de evaluación."
**Archivos:** nuevo `src/components/dashboard/EmptyState.tsx`, modificar `page.tsx` de cada ruta afectada. **No toca motor.**
**Aceptación:** cada sección vacía muestra una guía visual con el siguiente paso claro. Un colegio nuevo puede onboardearse sin documentación externa.

### Tarea A3 — Filtrado por fecha en resultados y dashboard
**Problema:** el dashboard y las tablas de resultados muestran "todo el histórico" sin posibilidad de acotar por período. Un colegio que usa la app 6 meses no puede ver solo "marzo-abril".
**Qué hacer:**
1. Componente `DateRangeFilter` (client component): dos inputs date (desde/hasta) + botón "Aplicar" + botón "Limpiar". Usa `useSearchParams` para persistir en la URL (`?from=2026-03-01&to=2026-04-30`).
2. Integrarlo en `/dashboard/results/[quizId]`: filtra papers por `scanned_at` dentro del rango. Recalcula KPIs (promedio, aprobación) solo con los papers filtrados.
3. Integrarlo en `/dashboard` (página principal): filtra "últimos papers", "últimos quizzes" y KPIs por el rango seleccionado.
4. Los filtros se pasan como searchParams a los Server Components, que los usan en las queries Supabase (`.gte("scanned_at", from).lte("scanned_at", to)`).
**Archivos:** nuevo `src/components/dashboard/DateRangeFilter.tsx`, modificar `dashboard/page.tsx`, `dashboard/results/[quizId]/page.tsx`. **No toca motor.**
**Aceptación:** seleccionar un rango de fechas actualiza las estadísticas y tablas. La URL refleja el filtro (compartible). Sin filtro → mismo comportamiento actual.

---

## FASE B — Multiplicadores de productividad (impacto medio, cuidado medio)

### Tarea B1 — Acciones masivas en papers
**Problema:** si un profesor escanea 40 hojas de un curso y 5 quedan sin RUT identificado, tiene que entrar a `/papers/[id]` una por una para asignar alumno. No hay selección múltiple.
**Qué hacer:**
1. Agregar checkboxes a la DataTable de `/dashboard/papers` (solo filas con `status = 'manual_review'`).
2. Barra de acciones masivas que aparece al seleccionar ≥1 fila: "Asignar a alumno existente" (dropdown con búsqueda de alumnos del curso), "Marcar como revisado" (cambia status sin asignar), "Descartar" (soft-delete).
3. Server action `batchUpdatePapers(ids: string[], action: 'assign' | 'review' | 'discard', studentId?: string)` que procesa en lote dentro de una transacción.
4. Feedback con contador: "5 papers actualizados".
5. No romper el flujo individual actual (el link a `/papers/[id]` sigue funcionando).
**Archivos:** modificar `dashboard/papers/page.tsx`, nuevo server action en `actions.ts`, posible nuevo componente `BatchActionBar.tsx`. **No toca motor.**
**Aceptación:** seleccionar N papers pendientes, elegir acción masiva, ver confirmación con resultado.

### Tarea B2 — Centro de notificaciones en la UI
**Problema:** la campana del `DashboardLayoutShell` solo muestra el contador de papers pendientes. No hay bandeja de notificaciones. `quota_alerts.ts` ya crea registros en BD pero el usuario nunca los ve en la UI.
**Qué hacer:**
1. Componente `NotificationBell` que reemplace el badge actual: muestra contador de notificaciones no leídas desde una tabla `notifications` (ya debería existir por `quota_alerts.ts`; si no, créala).
2. Dropdown al hacer click: lista de últimas 10 notificaciones con ícono (cuota⚠️, paper📄, equipo👥), mensaje, timestamp relativo ("hace 2 horas"), y link a la página relevante.
3. Endpoint `GET /api/notifications` que devuelve las notificaciones del `school_id` del usuario, ordenadas por fecha DESC.
4. Marcar como leída al hacer click (`.update({ read: true })`). Contador se actualiza.
5. `NotificationBell` se monta en `DashboardLayoutShell` en lugar del badge actual.
**Archivos:** nuevo `NotificationBell.tsx`, nuevo `api/notifications/route.ts`, modificar `DashboardLayoutShell.tsx`. Posible migración SQL para la tabla `notifications` si no existe. **No toca motor.**
**SQL si hace falta:**
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id),
  user_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```
**Aceptación:** la campana muestra contador de no leídas. Click abre dropdown con notificaciones. Click en una notificación → navega a la página relevante y la marca como leída.

### Tarea B3 — Comparación entre ensayos
**Problema:** un profesor quiere ver la mejora entre el "Ensayo diagnóstico" y el "Ensayo final". Hoy no hay forma de comparar dos quizzes lado a lado.
**Qué hacer:**
1. Nueva ruta `/dashboard/compare?q1=<id>&q2=<id>`. Server Component que carga ambos quizzes con sus `item_analysis` y `grade_records`.
2. Selector de quizzes: dropdowns para elegir Quiz A y Quiz B (filtrados por `school_id`).
3. Vista comparativa:
   - KPIs lado a lado: N° alumnos, promedio, % aprobación, nota máxima/mínima.
   - Tabla de preguntas comparadas: fila = N° pregunta, columnas = % acierto Quiz A, % acierto Quiz B, delta (mejora/empeora en verde/rojo), distractores más comunes en cada uno.
   - Comparación por eje (si ambos quizzes tienen metadatos de preguntas con `axis`): dominio por eje en A vs B.
   - Alumnos que rindieron ambos: tabla con nombre, nota en A, nota en B, delta.
4. Usar `computeItemAnalysis()` existente para ambos quizzes; solo hay que presentarlos juntos.
**Archivos:** nueva ruta `dashboard/compare/page.tsx`, posible utilidad `src/lib/compare_quizzes.ts`. **No toca motor.**
**Aceptación:** elegir dos ensayos → ver comparación numérica y visual lado a lado.

---

## FASE C — Madurez de plataforma (mayor alcance, algunas con dependencias)

### Tarea C1 — Reporte imprimible del análisis
**Problema:** `QuizStats` muestra análisis rico (barras de distractores, ejes, histograma) pero no se puede imprimir ni exportar para reuniones de apoderados o consejo de profesores.
**Qué hacer:**
1. Botón "Vista de impresión" en `/dashboard/quizzes/[id]` y `/dashboard/results/[quizId]` que abre una variante printer-friendly (`?print=1`).
2. La vista de impresión usa CSS `@media print` para ocultar sidebar, header, y botones. Muestra: nombre del ensayo, fecha, KPIs, tabla de resultados (top 10 + resumen estadístico), gráficos de QuizStats simplificados (barras de acierto por pregunta, histograma de notas, dominio por eje). Sin dependencia de canvas (los gráficos se renderizan con divs/barras CSS para que impriman).
3. Alternativa: botón "Exportar PDF" que usa `jspdf` (ya instalado) para generar un PDF con el mismo contenido, sin depender del diálogo de impresión del navegador.
4. El PDF incluye membrete con logo del colegio (si está configurado en `schools.branding`).
**Archivos:** modificar `quizzes/[id]/page.tsx`, `results/[quizId]/page.tsx`, nuevo componente `PrintableReport.tsx` o `QuizReportPDF.tsx`. **No toca motor.**
**Aceptación:** desde la página de un ensayo, "Imprimir reporte" genera un documento limpio con estadísticas y gráficos.

### Tarea C2 — Roles por miembro (permisos granulares)
**Problema:** el modelo actual es binario: `role = 'admin'` o no. En un colegio real coexisten profesores (ven solo sus cursos), UTP (ve todo, no administra), y admin (gestión completa). La tabla `school_members` ya tiene columna `role`, pero el layout no distingue permisos.
**Qué hacer:**
1. Definir enum de roles: `admin`, `utp`, `teacher`. (La columna `role` ya existe en `school_members`.)
2. En `getDashboardContext()`, exponer `role` del miembro actual.
3. En `DashboardLayoutShell`, filtrar items del nav según rol: `teacher` no ve "Team", "Billing", "Settings" (solo "Configuración" reducida).
4. En cada página, validar rol antes de mostrar acciones sensibles:
   - Solo `admin` puede: invitar/revocar miembros, cambiar settings del colegio, ver billing, eliminar quizzes/alumnos.
   - `utp` puede: crear quizzes, ver todos los cursos, exportar resultados, revisar papers.
   - `teacher` puede: ver sus cursos asignados, crear quizzes, escanear, ver resultados de sus cursos.
5. Si `teacher`, las queries de dashboard se filtran por `course_id` (necesita columna `course_id` en `school_members` o tabla de relación `member_courses`).
6. UI sutil: items de nav que el rol no puede ver = no se renderizan (no "disabled", simplemente no están).
**Archivos:** modificar `supabase_server.ts` (exponer role), `DashboardLayoutShell.tsx` (nav condicional), `actions.ts` (validar rol en acciones sensibles), varias pages para filtros por curso. Posible migración SQL. **No toca motor.**
**Aceptación:** un profesor logueado solo ve "Resumen", "Cursos", "Ensayos", "Papers". No ve Team ni Billing. No puede invitar miembros ni eliminar quizzes de otros.

### Tarea C3 — Bitácora de actividad (audit log visible)
**Problema:** `scan_log.ts` guarda cada escaneo y `export_logs` guarda cada export, pero no hay una vista en el dashboard que muestre "quién hizo qué y cuándo". Los administradores necesitan trazabilidad.
**Qué hacer:**
1. Nueva ruta `/dashboard/activity` (solo visible para `admin` y `utp`).
2. Tabla unificada que combina eventos de:
   - Escaneos (`scan_logs`) → "Prof. X escaneó hoja de alumno Y en ensayo Z"
   - Exports (`export_logs`) → "Prof. X exportó resultados de ensayo Z"
   - Cambios en quizzes (`quizzes.updated_at`) → "Prof. X modificó ensayo Z" (requiere trigger o consulta directa)
   - Papers identificados (`papers.updated_at` donde cambió student_id) → "Prof. X identificó alumno Y en paper de ensayo Z"
3. Filtros: por usuario, por tipo de evento, por ensayo, por fecha.
4. Paginación (100 eventos por página). No editable, solo consulta.
**Archivos:** nueva ruta `dashboard/activity/page.tsx`, posible nuevo endpoint `api/activity/route.ts` para unificar fuentes. **No toca motor.**
**SQL:** Si no existe tabla `activity_log`, crearla con triggers en las tablas relevantes O hacer queries UNION en el server component. Recomendación: queries UNION para no añadir complejidad de triggers en v1.
**Aceptación:** `/dashboard/activity` muestra timeline de acciones, filtrable, solo visible para admin/UTP.

### Tarea C4 — Billing: historial de consumo + facturas
**Problema:** la página de billing son 29 líneas. Un administrador que paga necesita ver: consumo mensual, historial de pagos, y facturas.
**Qué hacer:**
1. Gráfico de consumo mensual: barras con escaneos por mes (desde `scan_logs` o `papers.scanned_at` agrupados por mes).
2. Tabla de órdenes/pagos mejorada: columnas de monto, moneda, estado, fecha, link a comprobante.
3. Si el país tiene facturación electrónica (CL), mostrar campo RUT de facturación y botón "Solicitar factura".
4. Proyección: si el consumo mensual se mantiene, ¿cuándo alcanza el límite del plan?
5. No tocar los archivos de integración de pago (`flow.ts`, `mercadopago.ts`, `stripe.ts`). Solo consumir datos que ya existen en `subscriptions` y `orders`.
**Archivos:** modificar `dashboard/billing/page.tsx`. **No toca los conectores de pago. No toca motor.**
**Aceptación:** la página de billing muestra consumo histórico, proyección, y estado de pagos.

---

## LO QUE NO DEBES HACER
- No tocar el motor OMR ni `src/tulector/**`.
- No modificar el flujo de escaneo (`/scan`).
- No cambiar la arquitectura de auth (`getDashboardContext`, middleware).
- No migrar a otro framework de UI (seguir con Tailwind + Server Components).
- No crear nuevos paquetes npm sin documentar por qué (reusa `jspdf`, `framer-motion` si hiciera falta).
- No romper la versión móvil (APK) — todo esto es dashboard web.
- No modificar los conectores de pago en C4.

## ENTREGABLE
1. Commits atómicos por tarea (local, sin push), con `test:omr` idéntico y build verde.
2. Para tareas que requieran SQL nuevo: incluir el DDL exacto en el mensaje del commit.
3. Un resumen final: qué quedó implementado, qué rutas nuevas existen, y qué columnas/tablas nuevas se crearon (para que el dueño las ejecute en Supabase).
4. Si alguna tarea requiere cambios en `middleware.ts` o `layout.tsx`, explicitar el impacto en otras rutas.

---

## CORRECCIONES POST-AUDITORÍA (Codex, jul 2026)

### Bug detectado y corregido: doble conteo de scans_used
- **Problema:** `/api/scan/result` llamaba `increment_scans_used()` vía RPC (+1) Y además
  existía un trigger `on_paper_insert_increment_scan_usage` que también incrementaba (+1).
  Cada escaneo consumía 2 del contador.
- **Solución aplicada:** se eliminó la llamada RPC de la ruta. El trigger existente basta.
  La ruta ahora lee `schools.scans_used` vía SELECT después del insert para las alertas
  de cuota. Archivo: `src/app/api/scan/result/route.ts`.

### Correcciones al plan original

**A1 — Cursos (dos rutas, no una):**
- Crear `/dashboard/courses/page.tsx` (índice/listado de cursos con conteo de alumnos y último ensayo).
- Crear `/dashboard/courses/[id]/page.tsx` (detalle: KPIs, alumnos, historial de ensayos).
- Agregar "Cursos" al `DashboardLayoutShell` nav.

**B1 — Acciones masivas:**
- "Descartar" = `status = 'void'` (no soft-delete, no hay columna `deleted_at`).
- Todos los queries de papers, resultados, exports, dashboard y comparación deben excluir `status = 'void'`.
- Agregar filtro `WHERE status != 'void'` en: `results/[quizId]`, `quizzes/[id]`, `papers`, dashboard KPI.

**B2 — Notificaciones:**
- La tabla `notifications` ya existe pero usa `read_at timestamptz` (no `read boolean`).
- No tiene columna `link`. SQL incremental:
  ```sql
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;
  ```
- El contador debe usar `SELECT COUNT(*) WHERE read_at IS NULL`.

**C2 — Roles (épica separada, al final):**
- Los roles reales son `admin | teacher | viewer` (no `admin | utp | teacher`).
- Requiere: migración si se añade `utp`, cambios de tipos en `supabase_server.ts`,
  guards server-side en cada acción, RLS condicional, nav condicional, y
  filtrado por curso para teachers (`member_courses`).
- Separar en subtareas: (a) modelo roles, (b) nav condicional, (c) guards server,
  (d) filtros por curso, (e) APIs/RLS.

**C3 — Bitácora de actividad:**
- No usar `scan_logs` (no tiene `school_id`/`user_id`, y su SELECT está restringido a staff).
- Usar `papers` (+ `corrected_by`/`corrected_at` si existen) y `export_logs` como fuentes.
- Hacer UNION en el Server Component, no crear tabla nueva.

**Reglas duras — comando tsc corregido:**
- Usar `npx tsc --noEmit --incremental false` para no modificar `tsconfig.tsbuildinfo`.
- Ignorar errores de `tests/e2e/**` por Playwright (no solo `e2e/`).

**Orden de implementación recomendado:**
1. A2 — Empty states
2. A3 — Filtros por fecha
3. A1 — Cursos (índice + detalle)
4. B3 — Comparación entre ensayos
5. C1 — Reporte imprimible
6. B2 — Notificaciones
7. B1 — Acciones masivas
8. C4 — Billing
9. C3 — Actividad
10. C2 — Roles (épica separada)
