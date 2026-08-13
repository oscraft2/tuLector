# Compartir ensayos dentro del equipo (plan school)

## Contexto

Hoy, en un colegio con plan `school`, cada docente está **aislado**:
`supabase/migrations/20260808000000_teacher_isolation.sql` dejó las policies
`school_quizzes`, `school_papers`, `school_grade_records`,
`school_question_metadata` y `school_paper_pages` como
`is_school_member(school_id) AND (created_by = auth.uid() OR is_school_admin(...))`.
Un docente no-admin **solo ve lo que él creó**.

Consecuencia real: si la profesora A crea el ensayo "Ensayo PAES Matemática 2M"
e imprime las hojas, el profesor B **no puede colaborar**. No le aparece en
`/dashboard/quizzes`, ni en `/app/scan`, ni en `/api/scan/quiz-packs`. Su único
camino es crear/duplicar un ensayo propio — que recibe **otro `sheet_code`**
(índice único `quizzes_school_sheet_code_uk`), así que las hojas ya impresas por
A caen en `manual_review` cuando B las escanea. Resultado: dos ensayos paralelos,
la base de resultados partida en dos y la comparación por curso rota.

Lo que se quiere: que el dueño de un ensayo lo **comparta con docentes concretos
del colegio**, que estos se enteren **por correo y por notificación dentro de la
web y dentro del APK**, que **acepten**, y que desde ese momento vean el ensayo
y puedan **escanear hojas que caen en el MISMO ensayo** — misma base de datos,
sin crear uno nuevo.

Decisiones tomadas con el usuario:
- **Permiso único: "ver + escanear"**. El invitado ve el ensayo, imprime su hoja,
  escanea y sus hojas quedan en el mismo `quiz_id`. **No** puede editar pauta,
  puntajes ni archivar.
- **Comparte el dueño del ensayo** (`quizzes.created_by`) **o el admin** del colegio.
- **Destinatarios: miembros concretos** del colegio (`school_members`), elegidos de
  una lista. Nada de correos externos (eso ya es el flujo de invitación al equipo).

## Idea central

El 90% del comportamiento "y al escanearlo se comparte la base y no se crea uno
nuevo" **sale gratis de la RLS**. Todas las rutas de escaneo ya consultan
`quizzes` filtrando solo por `school_id` y delegan el aislamiento a la RLS:

- `src/app/api/scan/active-quiz/route.ts` (`.eq("school_id", school.id)`)
- `src/app/api/scan/quiz-packs/route.ts` (lista para corregir offline)
- `src/app/api/scan/result/route.ts` (L509-570: carga el quiz; L393+ inserta el paper)
- `src/app/app/scan/page.tsx`, `src/app/dashboard/quizzes/page.tsx`,
  `startScanForQuiz` (`src/app/dashboard/actions.ts:1265`)

Si la RLS deja pasar el ensayo compartido, **esas pantallas y endpoints no
cambian**: el ensayo aparece, el `sheet_code` impreso calza, el paper se inserta
con `quiz_id` del ensayo original y `user_id` = quien escaneó. El trabajo real es
la tabla de compartición, las policies, y la UI de compartir/aceptar/notificar.

---

## Fase 0 — Arreglar el canal de notificación in-app (prerrequisito)

El campanario ya existe (`src/components/dashboard/NotificationBell.tsx`, montado
en `src/components/dashboard/DashboardLayoutShell.tsx:129,143`) pero está roto:

1. `src/app/api/notifications/route.ts` hace `select(...,link,...)` y la columna
   **`link` no existe** en `notifications` (`20260626010000_dashboard_platform.sql:92`)
   → el GET devuelve 500 y el bell se lo traga en su `catch`.
2. El bell hace `PATCH /api/notifications` para marcar leído y **ese handler no
   existe** (la ruta solo exporta `GET`).
3. La policy `notifications_user` tiene `WITH CHECK (is_school_admin(school_id))`
   → un docente no-admin no puede marcar leída su propia notificación.

En la migración de la Fase 1 (mismo archivo):
```sql
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;
DROP POLICY IF EXISTS "notifications_user" ON notifications;
CREATE POLICY "notifications_user" ON notifications FOR ALL
  USING (user_id = auth.uid() OR is_school_admin(school_id))
  WITH CHECK (user_id = auth.uid() OR is_school_admin(school_id));
```
Y agregar el `PATCH` en `src/app/api/notifications/route.ts` (marca `read_at` de
una notificación propia, `.eq("id", id)` — la RLS ya restringe a las suyas).

## Fase 1 — Base de datos: `quiz_shares` + RLS

Archivo nuevo: `supabase/migrations/20260815000000_quiz_shares.sql`
(la última es `20260814000000_help_center_more_articles.sql`).

```sql
CREATE TABLE IF NOT EXISTS quiz_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES auth.users(id),
  shared_with UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
-- Una sola compartición viva por (ensayo, docente); rechazadas/revocadas no bloquean reintentar.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_shares_live_uk
  ON quiz_shares(quiz_id, shared_with) WHERE status IN ('pending','accepted');
CREATE INDEX IF NOT EXISTS quiz_shares_recipient_idx ON quiz_shares(shared_with, status);
```

Helper, en el mismo estilo que `is_school_admin` / `next_sheet_code`:
```sql
CREATE OR REPLACE FUNCTION public.has_quiz_share(p_quiz UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM quiz_shares
    WHERE quiz_id = p_quiz AND shared_with = auth.uid() AND status = 'accepted'
  );
$$;
```
**`SECURITY DEFINER` es obligatorio**: las policies de `quizzes`/`papers` van a
llamar a esta función y las de `quiz_shares` miran `quizzes` — sin definer se
arma recursión de RLS.

Policies **nuevas y permisivas** (se suman con OR, **NO se tocan** las de
`teacher_isolation` — el aislamiento por defecto se mantiene intacto):

| Tabla | Policy nueva | Alcance | Por qué |
|---|---|---|---|
| `quizzes` | `shared_quizzes_read` | `FOR SELECT USING (has_quiz_share(id))` | Solo lectura: el invitado no edita pauta ni archiva |
| `papers` | `shared_quiz_papers` | `FOR ALL USING/WITH CHECK (has_quiz_share(quiz_id))` | Tiene que **insertar** hojas al escanear y corregir/asignar |
| `grade_records` | `shared_quiz_grade_records` | `FOR ALL` idem | El upsert de `/api/scan/result` (L437-448) |
| `paper_pages` | `shared_quiz_paper_pages` | `FOR ALL` idem | Multipágina |
| `open_answers` | `shared_quiz_open_answers` | `FOR ALL` idem | Confirmar preguntas de desarrollo |
| `question_metadata` | `shared_quiz_question_metadata` | `FOR SELECT` | Metadata del instrumento = del dueño |

Policies de `quiz_shares` mismo:
- `SELECT`: `shared_with = auth.uid() OR shared_by = auth.uid() OR is_school_admin(school_id)`
- `INSERT`: `is_school_member(school_id) AND (is_school_admin(school_id) OR EXISTS (SELECT 1 FROM quizzes q WHERE q.id = quiz_id AND q.created_by = auth.uid()))`
- `UPDATE`: `shared_with = auth.uid() OR shared_by = auth.uid() OR is_school_admin(school_id)` — las transiciones válidas se validan en el server action.

Cerrar con `NOTIFY pgrst, 'reload schema';` y el comentario de cabecera de
siempre ("Aplicar a mano en Supabase → SQL Editor o `supabase db push`; Vercel no
corre migraciones").

**Gate de plan**: agregar `quiz_sharing: ["school"]` a `PLAN_FEATURES` en
`src/lib/plan_gates.ts` y consultarlo con `planHasFeature(school.plan, "quiz_sharing")`
en las pantallas y actions. La RLS no distingue plan a propósito — el gate vive
en la app, igual que `dia_sync`.

## Fase 2 — Server actions, correo y notificación

Archivo nuevo: `src/app/dashboard/quizzes/actions.ts` (mismo patrón que
`src/app/dashboard/papers/actions.ts`; usar `actionSuccess`/`actionError` y el
tipo `DashboardActionState` de `src/app/dashboard/actions.ts`).

- **`shareQuiz(prevState, formData)`** — `quiz_id` + `user_ids[]`.
  Valida plan (`planHasFeature`), que el actor sea dueño o `isAdmin`, y que cada
  destinatario sea miembro (reusar **`fetchTeacherOptions`** de
  `src/lib/teacher_scope.ts`, que ya resuelve los correos vía service role).
  Inserta las filas `pending`, y por cada destinatario:
  - **Notificación in-app**: insert en `notifications` con
    `{ user_id, school_id, type: "share", title, body, link: "/dashboard/quizzes/compartidos" }`
    usando `createSupabaseAdminClient()` — mismo camino que
    `src/lib/quota_alerts.ts:67` (la policy no deja a un docente insertar para otro).
    Agregar el icono `share` → `🤝` en `iconFor()` del `NotificationBell`.
  - **Correo**: `sendTemplatedEmail({ templateKey: "quiz_shared", ... })`
    (`src/lib/email.ts`). Añadir la plantilla a `STATIC_TEMPLATES` con las tres
    localizaciones (`es-CL`, `en`, `pt-BR`) copiando la estructura de `invitation`
    (`src/lib/email.ts:65`), variables: `shared_by_email`, `quiz_title`,
    `school_name`, `accept_link` = `${getSiteUrl()}/dashboard/quizzes/compartidos`.
    Si el correo falla, la compartición **igual queda creada** y se avisa con
    `actionSuccess(..., "⚠")` — mismo criterio que `inviteMember`
    (`src/app/dashboard/actions.ts:1005`).
- **`acceptQuizShare` / `declineQuizShare`** — solo `shared_with = auth.uid()` y
  `status = 'pending'`; setean `status` + `responded_at`. Al aceptar, notificar al
  dueño (notificación in-app + correo `quiz_share_accepted`, opcional pero barato)
  y `revalidatePath` de `/dashboard/quizzes`, `/dashboard/papers`, `/app/scan`.
- **`revokeQuizShare`** — dueño o admin; `status = 'revoked'` + `revoked_at`.
  Los papers ya escaneados por el invitado **se quedan** en el ensayo (son datos
  del colegio); solo se corta el acceso futuro. Decirlo en el texto de confirmación.

## Fase 3 — UI web

1. **Compartir desde el ensayo** — `src/app/dashboard/quizzes/[id]/page.tsx`:
   sección "Compartir con el equipo" (solo si dueño/admin y plan `school`), con un
   componente cliente nuevo `src/components/dashboard/ShareQuizPanel.tsx`
   (checkboxes de docentes desde `fetchTeacherOptions`, botón que dispara
   `shareQuiz`) y la lista de comparticiones vigentes con su estado y "Revocar"
   (`ActionButton` de `src/components/dashboard/ActionButton.tsx`).
   Botón "Compartir" también en cada fila de `src/app/dashboard/quizzes/page.tsx`
   (link al detalle, no un segundo formulario).
2. **Página "Compartidos"** — nueva ruta `src/app/dashboard/quizzes/compartidos/page.tsx`
   con dos bloques usando `PageHeader` + `DataTable`:
   *Compartidos conmigo* (pendientes con Aceptar/Rechazar; aceptados con enlace al
   ensayo y a sus resultados) y *Compartidos por mí* (con Revocar).
   Es el destino del correo y del `link` de la notificación.
3. **Distinguir lo ajeno** — en `/dashboard/quizzes` y `/dashboard/quizzes/[id]`,
   pintar un pill "Compartido por {correo}" y **ocultar** Archivar / Editar /
   Duplicar-destructivo cuando `created_by !== user.id && !isAdmin` (la RLS ya lo
   impediría, pero un botón que revienta es peor que un botón ausente). Mantener
   visibles Hoja/Bloque, Escanear y Exportar.
4. **Scope del admin** — `src/lib/teacher_scope.ts`: en modo `mine` el admin filtra
   `created_by = yo`, lo que escondería un ensayo compartido con él. Extender
   `applyTeacherScope` (y `quizIdsInScope`) con una lista opcional de ids
   compartidos conmigo → `or(created_by.eq.me,created_by.is.null,id.in.(...))`.
   Afecta los 5 llamadores: `dashboard/page.tsx`, `dashboard/quizzes/page.tsx`,
   `dashboard/papers/page.tsx`, `app/results/page.tsx`.
   Para un docente **no-admin no hay nada que hacer**: su scope es "sin filtro" y
   la RLS nueva ya le muestra lo compartido.

## Fase 4 — APK (nativo, sin mandar a la web)

Regla del proyecto: **el APK nunca deriva a `/dashboard`** salvo el plan.

- Pantalla nueva `src/app/app/compartidos/page.tsx` (server component, estilo de
  `src/app/app/scan/page.tsx`: header oscuro, tarjetas, `safe-pt`) con los
  pendientes y los botones Aceptar/Rechazar contra los mismos server actions.
- Tarjeta/banner "Tienes N ensayo(s) compartido(s) por aceptar" en
  `src/app/app/page.tsx` (junto al conteo de `manual_review`, L17-21) y en
  `src/app/app/scan/page.tsx`, enlazando a `/app/compartidos`.
- Nada que tocar en el motor OMR ni en `/scan`: una vez aceptado, el ensayo
  aparece solo en la lista de `/app/scan` y en `/api/scan/quiz-packs` (offline).

## Fase 5 — Escaneo compartido: verificar, no reescribir

No debería requerir código nuevo, pero hay que **confirmar en la prueba real**:

- `/api/scan/result` carga el quiz con `.eq("id", quizId).eq("school_id", school.id)`
  → pasa por `shared_quizzes_read`.
- El `sheet_code` impreso por el dueño calza con `quiz.sheet_code`, así que
  `sheetMismatch` es `false` y **no** cae en `manual_review`
  (`src/app/api/scan/result/route.ts:292`).
- El paper queda con `quiz_id` del ensayo original, `school_id` del colegio y
  `user_id` = quien escaneó (L393-416) → un mismo ensayo con hojas de dos docentes.
- La cuota (`scans_used`) es del colegio: escanee quien escanee, descuenta del mismo pozo.
- `next_sheet_code` no se toca — nadie crea un ensayo nuevo en este flujo, que es
  justamente el objetivo.

---

## Verificación (extremo a extremo)

1. Aplicar `20260815000000_quiz_shares.sql` en Supabase → SQL Editor (Vercel no
   corre migraciones) y `NOTIFY pgrst, 'reload schema';`.
2. `npm run dev` con **dos cuentas** del mismo colegio plan `school` (dos
   navegadores/perfiles): A dueña, B docente no-admin.
3. A comparte el ensayo con B → verificar fila `pending` en `quiz_shares`,
   notificación en el campanario de B y correo (si `RESEND_API_KEY` no está en el
   entorno, `sendEmail` cae al mock y solo loguea — revisar el log
   `[EMAIL DEV LOG]`, ver `docs/plan-invitaciones-administracion-equipo.md`).
4. **Antes de aceptar**: B no ve el ensayo en `/dashboard/quizzes` ni en
   `/app/scan` ni en `/api/scan/quiz-packs`. Es la prueba de que la RLS exige
   `status = 'accepted'`.
5. B acepta → aparece con el pill "Compartido por A", sin botones de Archivar/Editar.
6. **Prueba impresa (la que decide)**: imprimir la hoja desde la cuenta de A
   (`/sheet?quiz=<id>`), escanearla desde el APK de B, y confirmar en la BD que el
   paper quedó con el `quiz_id` de A, `status = 'corrected'` (no `manual_review`)
   y `user_id` de B — y que **no se creó ningún `quizzes` nuevo**
   (`SELECT count(*) FROM quizzes WHERE school_id = ...` antes y después).
7. A ve la hoja de B en `/dashboard/results/<quizId>` y la exportación incluye a
   los alumnos de ambos.
8. Revocar desde A → B pierde el ensayo de sus listas en la siguiente navegación;
   los papers ya escaneados siguen visibles para A.
9. `npm run build` y `npx tsc --noEmit` limpios antes de deployar.
