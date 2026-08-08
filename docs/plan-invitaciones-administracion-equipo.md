# Invitación de docentes: correo real + administración completa de equipo

## Contexto

Se activó plan "school" para poder invitar profesores desde
Configuración. En la prueba real, dos invitaciones (`o.vidal@ispm.cl`,
`d.fuentes@ispm.cl`, 2026-08-08) quedaron creadas en la base de datos
pero **el correo nunca llegó**. Se pidió investigar a fondo la causa real
(no asumirla) y, por separado, ampliar mucho la sección de
administración de equipo: poder eliminar la cuenta de un docente, ver
sus datos, cuánto usa la plataforma y sus resultados.

## Parte A — Por qué no llega el correo (causa raíz confirmada, no teoría)

Se verificó línea por línea, incluyendo **las variables de entorno reales
de Vercel producción** (`vercel env ls production`, cuenta `oscraft2`,
proyecto `tulector` ya enlazado en `.vercel/`):

**`RESEND_API_KEY` y `RESEND_FROM_EMAIL` NO existen en producción.** El
listado completo de variables de Production (22 variables: Supabase,
Postgres, Flow, Google API, GA4, site URL) no incluye ninguna variable
de correo. Son las únicas dos que `src/lib/email.ts` lee para enviar
correo real vía Resend (`sendEmail()`, L312-314).

Consecuencia exacta en el código (`src/lib/email.ts` L317-326):
```ts
if (!apiKey || apiKey === "re_...") {
  console.log("[EMAIL DEV LOG] ..."); // solo en logs de Vercel, nadie lo ve
  return { success: true, id: `dev_mock_${Date.now()}` };
}
```
Sin la API key, **todo correo de la plataforma cae en este modo "mock"**
— no solo las invitaciones. Reporta `success: true` igual, así que nunca
hubo ningún error visible en ningún lado. Esto también explica por qué
`inviteMember` "parece funcionar" (la invitación sí queda creada en
`invitations`, con `status: pending`) pero no sale ningún correo real.
Ya existe una señal de esto en el propio código:
`src/app/admin/marketing/page.tsx` L52 calcula
`isResendConfigured = Boolean(RESEND_API_KEY && != "re_...")` — hoy esa
página ya debería estar mostrando "no configurado" (se puede confirmar
entrando a `/admin/marketing` con la cuenta platform_admin, que este
usuario sí tiene).

**Esto no es un bug de código a arreglar con más lógica — es una cuenta
de Resend que nunca se conectó a Vercel.** El acompañamiento del código
(templates, `sendTemplatedEmail`, etc.) está bien armado y ya
funcionaba en pruebas anteriores de esta sesión de trabajo para otros
correos (pagos, cuotas) — simplemente nunca tuvo la key real puesta en
producción, así que ninguno de esos correos salió jamás tampoco.

### Lo que sí se puede/debe arreglar en código
Aun con Resend bien conectado, quedan dos problemas reales de flujo
encontrados en la revisión (independientes de la causa de arriba):

1. **`inviteMember` nunca revisa el resultado de `sendTemplatedEmail`**
   (`src/app/dashboard/actions.ts` ~L735-770) — si el envío falla (clave
   mala, dominio no verificado, límite alcanzado), la invitación queda
   creada igual y el admin no se entera. Hay que capturar
   `{success, error}` y avisar en la UI si falló.
2. **El link de invitación no explica nada al docente.**
   `inviteMember` arma `/auth?mode=register&invite_id=<id>`, pero
   `src/app/auth/page.tsx` **nunca lee `invite_id`**. El docente cae en
   un formulario de registro genérico, sin saber a qué colegio se une.
   Peor: la vinculación real la hace un trigger de Postgres
   (`handle_new_user()`,
   `supabase/migrations/20260626170000_invite_accept_flow.sql`) que
   busca una invitación `pending` con el **email exacto** — si el
   docente se registra con otro correo (mayúsculas distintas, error de
   tipeo, u otra cuenta), la invitación **no se vincula y no hay ningún
   aviso**: el docente termina con su propio colegio nuevo en vez de
   sumarse al del admin.
3. **No hay respaldo manual.** Si el correo no sale (por lo que sea), hoy
   no hay forma de copiar el link de invitación y mandarlo por otro
   medio (WhatsApp, etc.).

### Cambios de código — Parte A
- `src/app/dashboard/actions.ts` (`inviteMember`): capturar el resultado
  de `sendTemplatedEmail`; si falla, `redirect` a
  `/dashboard/settings?invite_warning=<email>` (mismo patrón `redirect()`
  ya usado en este archivo) en vez de fallar en silencio.
- Nuevo endpoint `src/app/api/invitations/[id]/route.ts` (GET, sin
  sesión, usa `createSupabaseAdminClient()`): devuelve
  `{ valid, email, role, schoolName }` de una invitación pendiente y no
  vencida — solo lo mínimo no sensible.
- `src/app/auth/page.tsx`: leer `invite_id` de la URL, pedir ese
  endpoint, y si es válida forzar modo registro + precargar y bloquear
  el campo email (evita el error de "se registró con otro correo") +
  mostrar un banner "Fuiste invitado a colaborar en **{colegio}** como
  **{rol}**". Si no es válida, aviso chico sin bloquear el formulario.
  Sin `invite_id` en la URL, cero cambios de comportamiento.
- `src/app/dashboard/settings/page.tsx` + nuevo
  `src/components/dashboard/CopyInviteLinkButton.tsx`: botón "Copiar
  enlace" por invitación pendiente, y banner si `invite_warning` viene en
  la URL.
- **Acción del usuario, fuera de este código**: crear/recuperar la
  cuenta de Resend, generar una API key, verificar un dominio remitente,
  y cargar `RESEND_API_KEY` + `RESEND_FROM_EMAIL` en Vercel → Production
  (`vercel env add RESEND_API_KEY production`, o desde el dashboard de
  Vercel). Sin este paso, el "Copiar enlace" queda como el único camino
  real para invitar a alguien.

## Parte B — Administración completa de cada docente

Hoy la tabla de "Equipo y administración" (agregada la sesión pasada en
Configuración) solo muestra email/rol/ensayos/hojas/fecha en línea, con
un botón "Eliminar" que solo saca al docente de ESTE colegio
(`revokeMember`, borra la fila de `school_members`). Se pide bastante
más: ver el perfil completo, cuánto usa la plataforma, sus resultados, y
poder eliminar la cuenta.

### Diseño: página de detalle por miembro
Nueva ruta `src/app/dashboard/team/[id]/page.tsx` (no choca con
`/dashboard/team/page.tsx`, que hoy redirige a Configuración — Next.js
resuelve `[id]` como ruta más específica). Mismo patrón que la consola
interna `src/app/admin/users/[id]/page.tsx` pero acotada al colegio
activo y protegida con `isAdmin` (no es la consola de plataforma). Desde
la fila de cada miembro en Configuración, el email pasa a ser un link a
esta página.

Contenido:
- **Perfil**: email, rol, fecha de alta en el colegio (`school_members.created_at`),
  último inicio de sesión (`auth.users.last_sign_in_at`, ya disponible
  gratis en la misma llamada `admin.auth.admin.getUserById()` que hoy
  solo se usa para el email).
- **Uso**: ensayos creados, hojas escaneadas (ya calculado hoy), y fecha
  de la última hoja escaneada (`papers.scanned_at` más reciente) como
  señal de actividad real, no solo un conteo.
- **Resultados**: tabla de sus ensayos (`quizzes` con `created_by = id`),
  cada uno con link directo a `/dashboard/results/[quizId]` (ya existe)
  para ver las notas/resultados de ese ensayo puntual.
- **Zona de riesgo**: mismo botón "Quitar del colegio" que ya existe
  (`revokeMember`), más la opción de eliminar la cuenta completa — ver
  decisión pendiente abajo.

### ⚠️ Hallazgo que bloquea decidir el alcance de "eliminar cuenta"
Se revisó qué pasa realmente al borrar un `auth.users` (mismo mecanismo
que ya usa `deleteMyAccount`, `src/app/dashboard/actions.ts` L1330,
para autoeliminación) y hay dos comportamientos distintos según la
tabla, verificados en las migraciones:
- `quizzes.created_by` → `REFERENCES auth.users(id)` **sin
  `ON DELETE`**, o sea `NO ACTION`: si el docente tiene algún ensayo
  creado, Postgres **rechaza el borrado del usuario** con error de
  llave foránea. Esto probablemente ya afecta a `deleteMyAccount` hoy
  mismo para cualquier docente que haya creado un ensayo.
- `papers.user_id` → `REFERENCES auth.users(id) ON DELETE CASCADE`: si
  se logra borrar al usuario, **las hojas que él escaneó se borran en
  cascada** — esto es notas/resultados reales de alumnos, no solo
  metadata.

Osea "eliminar cuenta" hoy, tal como está construido el esquema, o
falla con error si el docente creó ensayos, o borra resultados de
alumnos escaneados por él si no los creó. Ninguna de las dos es lo que
un admin esperaría al apretar "Eliminar".

**Decisión (confirmada con el usuario): transferir sus ensayos al admin
y recién ahí eliminar la cuenta.** Antes de borrar, se reasignan al
admin las filas que realmente pueden bloquear el borrado o perder datos
reales (verificado columna por columna contra
`REFERENCES auth.users(id)` en todas las migraciones):
- `quizzes.created_by` → admin (des-bloquea la FK sin `ON DELETE`).
- `papers.user_id` (quién escaneó) → admin (evita que el `ON DELETE
  CASCADE` borre hojas/notas de alumnos reales).
- `papers.corrected_by` → admin, si está poblado.
- `invitations.invited_by` → `NULL`, si está poblado (solo metadata).
Todo acotado a `school_id = school.id` (no tocar datos de otros
colegios si el docente perteneciera a más de uno). El resto de columnas
que referencian `auth.users(id)` (`audit_log`, `site_config`,
`support_tickets`, `data_requests`) son de uso interno/plataforma — muy
improbable que un docente de colegio las haya tocado, así que no se
reasignan proactivamente, pero el `deleteUser()` final queda en
try/catch: si igual choca con alguna FK no prevista, se muestra un
error claro en vez de fallar en silencio o a medias.

### Cambios de código — Parte B
- `src/app/dashboard/actions.ts`: nuevo `deleteMemberAccount(formData)`
  — requiere `isAdmin`, recibe `id` = `school_members.id` (mismo dato
  que ya usa `revokeMember`), resuelve `user_id` + valida que pertenece
  a `school.id` y que no es el propio admin. Hace la reasignación de
  arriba con `createSupabaseAdminClient()`, luego
  `admin.auth.admin.deleteUser(user_id)` en try/catch, y por último
  limpia `school_members`/`profiles` igual que `deleteMyAccount`
  (`src/app/dashboard/actions.ts` L1330) — es prácticamente el mismo
  procedimiento pero ejecutado por el admin sobre otra cuenta, con el
  paso extra de reasignación antes.
- Nueva ruta `src/app/dashboard/team/[id]/page.tsx` (`id` =
  `school_members.id`) — perfil, uso y resultados del docente descritos
  arriba, protegida con `isAdmin` (`redirect` si no). El email de cada
  fila en la tabla de Configuración pasa a ser link a esta página.
- Nuevo `src/components/dashboard/DeleteMemberAccountButton.tsx` —
  mismo patrón que `DeleteAccountButton.tsx` (reusa
  `ConfirmDialog`, ya existe en `src/components/dashboard/ConfirmDialog.tsx`),
  pero llamando a `deleteMemberAccount` con el `id` del miembro objetivo
  y un mensaje de confirmación que menciona explícitamente la
  transferencia de ensayos al admin.
- El botón "Eliminar" que ya existe en la fila de la tabla (llama a
  `revokeMember`, solo saca del colegio) **se mantiene igual** — sigue
  siendo la acción rápida no-destructiva. "Eliminar cuenta completa"
  vive únicamente dentro de la página de detalle, con más fricción a
  propósito por ser irreversible y afectar al docente en TODOS los
  colegios a los que pertenezca, no solo este.

## Verificación
- `npx tsc --noEmit -p .`, `npx eslint <archivos tocados>`, `npm run build`.
- Parte A (correo): confirmar en `/admin/marketing` que
  `isResendConfigured` muestra el estado real; una vez el usuario cargue
  `RESEND_API_KEY`/`RESEND_FROM_EMAIL` en Vercel, usar el propio
  "Enviar correo de prueba" de esa página para confirmar entrega real
  antes de dar por cerrado el tema del correo. Sin esa key, probar el
  flujo completo igual usando el botón "Copiar enlace" en vez de
  esperar el correo: pegar el link en una ventana de incógnito,
  confirmar el banner con colegio/rol y el email precargado/bloqueado,
  completar registro, y confirmar en `school_members` que quedó en el
  colegio correcto con el rol invitado (no un colegio nuevo).
- Parte B (administración): desde Configuración, entrar al detalle de
  un docente de prueba, confirmar que perfil/uso/resultados se ven
  correctos; probar "Eliminar cuenta completa" con una cuenta de
  prueba que tenga al menos un ensayo creado y una hoja escaneada,
  confirmar que sus ensayos quedan con `created_by` del admin (visibles
  igual en `/dashboard/quizzes`) y que la cuenta ya no existe en
  `auth.users` sin error de FK.

---

# Auditoría de código y mejoras (revisión contra el código real)

Se verificó cada afirmación del plan contra el código/migraciones
actuales. Marca lo que confirma, las brechas reales que abre, y las
ideas que conviene sumar antes de implementar.

## ✅ Afirmaciones verificadas como correctas

- **Modo mock de correo** (`src/lib/email.ts` L317-326): confirmado
  letra por letra. Sin `RESEND_API_KEY` real, TODO cae a
  `dev_mock_*` con `success: true`. El plan acierta en que no es un
  bug de lógica sino de configuración de Vercel.
- **`inviteMember` ignora el resultado del envío**
  (`src/app/dashboard/actions.ts` L735-770): confirmado. El
  `await sendTemplatedEmail({...})` no se captura; la invitación ya
  quedó insertada antes, así que un fallo de Resend queda invisible.
- **`auth/page.tsx` nunca lee `invite_id`**: confirmado (todo el
  archivo, L1-661). El docente cae en un registro genérico.
- **Trigger `handle_new_user`** (`20260626170000_invite_accept_flow.sql`):
  confirma que vincula por `WHERE email = LOWER(NEW.email) AND status
  = 'pending'`. Registrar con otro correo → no vincula y se crea un
  colegio nuevo en silencio.
- **`revokeMember`** (L772-779): solo `delete` de `school_members`.
  No toca `auth.users`. Correcto para "quitar del colegio".
- **`deleteMyAccount`** (L1330-1353): NO reasigna nada antes de
  `admin.auth.admin.deleteUser`. Confirmado: choca con FK de
  `quizzes.created_by` (sin `ON DELETE`) para cualquier docente con
  un ensayo. **Hoy ya está roto para el caso más común.**
- **Esquema de FKs** (verificado contra todas las migraciones):
  - `quizzes.created_by` → sin `ON DELETE` (`NO ACTION`) → bloquea. ✅
  - `papers.user_id` → `ON DELETE CASCADE` → borra hojas/notas. ✅
  - `papers.corrected_by` → sin `ON DELETE` → bloquea. ✅
  - `invitations.invited_by` → sin `ON DELETE` → bloquea. ✅
- **Componentes reutilizables**: `ConfirmDialog` y `DeleteAccountButton`
  existen y el patrón de reuso propuesto es viable.
- **Plantilla de invitación** ya vive en `STATIC_TEMPLATES.invitation`
  (`src/lib/email.ts`) con las variables `invited_by_email`,
  `school_name`, `role`, `invite_link` ya cableadas. No hay que
  crear nada nuevo para el correo.

## ⚠️ Brechas reales que el plan no cubre (corregir antes de implementar)

### B1. `result_links.created_by` es `ON DELETE CASCADE` → pérdida silenciosa de enlaces de resultados
`20260705000000_result_links.sql` L17:
`created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`.
El plan reasigna `papers.user_id` para no perder hojas, **pero
olvida `result_links`**: borrar al docente elimina en cascada los
enlaces públicos de resultados que él generó (los que se mandan por
WhatsApp a los apoderados). Son datos reales en circulación, misma
clase de pérdida que el plan evita para `papers`.
**Acción:** reasignar `result_links.created_by` → admin (acotado a
`school_id`) antes de `deleteUser()`, igual que `quizzes.created_by`.

### B2. `notifications.user_id` no tiene `ON DELETE` → bloquea el borrado en un caso común
`20260626010000_dashboard_platform.sql` L95: `user_id UUID REFERENCES
auth.users(id)` (sin `ON DELETE`). Un docente con notificaciones
(aunque sean pocas) hace que `deleteUser()` falle con error de FK.
El plan deja esto al `try/catch` final bajo la hipótesis de que "un
docente de colegio no toca esas tablas", pero `notifications` sí se
dirige a usuarios no-admin.
**Acción:** antes de `deleteUser`, limpiar
`DELETE FROM notifications WHERE user_id = target AND school_id =
school.id` (o `UPDATE ... SET user_id = NULL` si se quiere historiar).
Mismo chequeo proactivo para `export_logs` y `audit_log` si el target
resulta tener filas (barato de contar antes de borrar).

### B3. `deleteMyAccount` está roto HOY y debe arreglarse en el mismo pase
El plan lo menciona como nota al paso ("probablemente ya afecta a
`deleteMyAccount`"), pero **es un bug de cumplimiento Apple 5.1.1(v) /
Google Play**: la autoeliminación falla para cualquier docente que
haya creado un ensayo. Es el caso más común.
**Acción:** extraer la reasignación a un helper compartido
`reassignSchoolUserData(admin, { schoolId, fromUserId, toUserIdOrNullOrAdmin })`
y usarlo desde **ambos** `deleteMemberAccount` y `deleteMyAccount`.
Para autoeliminación, el destino es: otro admin del colegio si existe,
si no, `NULL` para `quizzes.created_by` (es nullable) y otro admin
para `papers.user_id` (es `NOT NULL`, no admite NULL). Si no hay otro
admin ni siquiera para `papers`, ahí sí dejar que el `try/catch`
retorne un error claro en vez de borrar resultados de alumnos en
cascada. Documentar ese caso extremo en la UI.

### B4. Falta auditoría del acto destructivo
Ningún `server action` de dashboard escribe `audit_log` hoy (es
plataforma), pero eliminar la cuenta de un docente desde un colegio
es lo bastante grave para registrar Quién/Qué/Cuánto.
**Acción:** `deleteMemberAccount` debe dejar una fila en `audit_log`
(`action: "school_member.account_delete"`, `metadata: {
transferred_quizzes, transferred_papers, transferred_result_links }`)
vía `writeAuditLog` (ya importado en `src/app/admin/actions.ts`; para
dashboard se puede importar el mismo helper o duplicar el insert con
el client admin).

### B5. Eliminar al último admin del colegio deja la cuenta huérfana
El plan valida "que no es el propio admin", pero no el caso en que el
target es el **único admin** restante: borrarlo deja el colegio sin
ningún admin y nadie puede gestionarlo después.
**Acción:** en `deleteMemberAccount`, si `role === 'admin'` y no
existe otro `school_members` con `role='admin'` en ese `school_id`,
rechazar con mensaje claro ("designa otro admin antes de eliminarlo")
o forzar reasignación de admin a otro miembro como paso previo.

## 💡 Mejoras de UX / robustez (idea, no bloqueantes)

### M1. `inviteMember` no previene duplicados
Hoy se puede invitar el mismo email dos veces (quedan dos filas
`pending`) o invitar a quien ya es miembro. Cuesta poco: antes del
`insert`, chequear `school_members` (email → user_id) y
`invitations` pendientes para ese `school_id`+`email`, y devolver un
aviso en vez de una segunda fila.

### M2. El endpoint público `/api/invitations/[id]` devuelve PII
El plan pide retornar `{ valid, email, role, schoolName }` sin
sesión. El `email` es PII; el UUID es inadivinable, así que el riesgo
es bajo, pero conviene **documentarlo como decisión consciente** (el
canal del link ya es el correo del invitado) y garantizar que NUNCA
devuelve `school_id`, `invited_by` ni `token_hash`. Devolver solo
`{ valid: boolean, email, role, schoolName }` y nada más. Si se quiere
endurecer: devolver `email` enmascarado y confirmar el real solo al
submit del registro — pero eso rompe el UX de "campo bloqueado y
precargado" del plan.

### M3. El trigger marca `accepted` + `revoked_at = NOW()` al INSERT, no al confirmar
`handle_new_user` corre en el INSERT de `auth.users` (al `signUp`), no
tras confirmar correo. Si las confirmaciones de email están activas y
el docente abandona el registro a mitad, la invitación queda
`accepted` sin usuario real usable. El "Copiar enlace" del plan
ayuda, pero conviene: (a) no setear `revoked_at` al aceptar (es
redundante con `status`), y/o (b) considerar mover la aceptación al
primer `last_sign_in_at` real. Mínimo: dejar una nota de este edge
case para no diagnosticarlo como "invitación fantasma" más adelante.

### M4. Interacción con el aislamiento por docente (`20260808000000_teacher_isolation.sql`)
La migración reciente hace que `quizzes`/`papers`/`grade_records`/
`question_metadata`/`paper_pages` estén bajo RLS
`created_by = auth.uid() OR is_school_admin(school_id)`. Reasignar
`created_by` al admin es **consistente** con esa policy (el admin ya
ve todo por `is_school_admin`, y ahora además es `created_by`).
Conviene citar esta dependencia en el plan para que quien lo lea no
piense que la reasignación rompe el aislamiento: lo preserva y lo
traslada limpiamente al admin.

### M5. "Quitar del colegio" vs "Eliminar cuenta" — copiar también el link en la fila
El "Copiar enlace" propuesto para invitaciones pendientes es buen
respaldo. Idea extra: el mismo botón "Copiar enlace" puede vivir en
la fila de la tabla de Equipo (no solo en invitaciones) para
re-enviar el link de invitación si el docente todavía no aceptó,
evitando que el admin tenga que ir a otra pantalla.

### M6. Rate-limit / idempotencia del endpoint de invitación
El `GET /api/invitations/[id]` público es de solo lectura y el UUID
no es enumerable, pero conviene dejar explícito que es idempotente y
no incrementa contadores ni tiene side-effects (distinto a
`increment_result_link_view`, que sí muta).

## Resumen de adiciones al plan original
1. **B1**: reasignar `result_links.created_by` → admin antes de borrar.
2. **B2**: limpiar `notifications` (y chequear `export_logs`/`audit_log`)
   del target antes de `deleteUser`.
3. **B3**: extraer helper `reassignSchoolUserData` y arreglar
   `deleteMyAccount` en el mismo pase (bug de cumplimiento store).
4. **B4**: `audit_log` para `deleteMemberAccount`.
5. **B5**: bloquear eliminación del último admin del colegio.
6. **M1**: prevenir invitaciones duplicadas.
7. **M2**: documentar la decisión de exponer `email` en el endpoint
   público y acotar los campos retornados.
