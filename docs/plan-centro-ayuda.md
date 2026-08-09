# Plan: Centro de Ayuda (FAQ potente) + Mesa de tickets profesional, multi-país

Fecha: 2026-07-21 · Reescrito 2026-08-09 tras auditoría contra código real.
Estado: **aprobado, listo para construcción por fases.**

## Por qué existe este plan

tuLector opera en 5 mercados (Chile, México, Perú, Argentina, Brasil —
`src/i18n/config.ts:1-9`) y hoy el "soporte" es: una página estática
(`/[locale]/support` que renderiza `PublicInfoPage`), un mailto de ventas
por país que vive en el footer global (`src/components/PublicFooter.tsx:89`),
FAQs hardcodeadas en 3 lugares distintos del código, y un inbox admin de
tickets **que ningún cliente puede alimentar** (no existe formulario de
creación). La meta es el patrón de las plataformas grandes (Tiendanube con
Zendesk Guide): centro de ayuda con categorías + buscador real +
escalamiento a ticket/WhatsApp solo cuando el artículo no resuelve.

## Auditoría de herramientas (GitHub, julio 2026)

| Herramienta | ⭐ | Stack | Veredicto para tuLector |
|---|---|---|---|
| Chatwoot | 34.6k, activo | Ruby on Rails + Redis + Sidekiq | El mejor help center OSS multi-idioma, pero exige infra Ruby paralela a Vercel+Supabase |
| Zammad | 5.8k, activo | Ruby + Elasticsearch + Redis + Memcached | Aún más pesado de operar |
| FreeScout | 4.4k, activo | PHP/Laravel | Liviano, pero introduce PHP en un stack 100 % Node |
| Frappe Helpdesk | 3.2k, activo | Vue + framework Frappe (Python/MariaDB) | Requiere adoptar todo Frappe; overkill |
| Peppermint | 3.1k | TypeScript | **Archivado sept-2025 — descartado** |
| Outline / Docmost | 39.8k / 21k | Node+TS | Wikis internas (Notion/Confluence), no portales FAQ públicos con SEO |
| Fumadocs / Nextra | 12.6k / 13.9k | Next.js + MDX | Encajan en el stack, pero el contenido vive en git → cada edición necesita deploy de un dev |

**Decisión: no adoptar ninguna.** Razones:

1. tuLector **ya tiene la mitad del sistema de tickets construido**: tablas
   `support_tickets` + `support_ticket_notes` con RLS correcta, inbox admin
   funcional (`src/app/admin/support/page.tsx`), y 3 server actions en
   `src/app/admin/actions.ts:167,198,224` (`updateSupportTicket`,
   `assignSupportTicket`, `addSupportTicketNote`). Terminarlo cuesta menos
   que integrar una plataforma externa.
2. Ya existe el rol de staff `support` (activo en `requirePlatformContext(
   [...,"support"])` en ≥10 calls de `src/app/admin/actions.ts`) — habrá
   personal no-programador editando contenido → el FAQ debe vivir en
   Supabase con CRUD en `/admin`, **no** en archivos MDX/git.
3. Ya existe el patrón de link público sin login (`result_links` +
   `/r/[token]/page.tsx` + función `SECURITY DEFINER increment_result_link_view`
   en `20260705000000_result_links.sql:126-132`) — reusable para "ver mi
   ticket sin cuenta".
4. Ya existe un botón de WhatsApp implementado y apagado
   (`src/components/header/HeaderWhatsApp.tsx` + `site_config.whatsapp_button`
   en `20260717000000_site_config.sql:20`), gestionable desde
   `/admin/settings` (`src/app/admin/settings/page.tsx:16-59`).

### Hallazgos de la auditoría de código que cambian el plan original

- **Última migración: `20260808000000_teacher_isolation.sql`** (no
  `20260717010000_support_ticket_notes.sql` como decía el plan original).
  El prefijo de la nueva migración debe ser `20260809000000_help_center.sql`
  o mayor.
- El array de navegación admin **NO** se llama `adminNav` ni vive en
  `AdminShell.tsx`: es la constante `ADMIN_NAV` en
  `src/components/dashboard/AdminLayoutShell.tsx:8-21` (tuplas
  `[href, label]`, no objetos `{href,label}`). Editar ahí.
- `WhatsAppFloatingButton.tsx` **no existe**. El botón de WhatsApp vive
  en el header (`HeaderWhatsApp.tsx` + `PublicHeader.tsx:118`). El quick
  win "activar WhatsApp" es viable hoy sin crear componente nuevo; sólo si
  más adelante se quiere un _floating button_ real, se crea.
- `support_ticket_notes` tiene RLS **solo staff** (`is_platform_staff()`)
  porque son internas — no es "RLS por colegio". El nuevo
  `support_ticket_messages` (hilo visible al cliente) **debe** espejar la
  policy `support_tickets_school_staff` (`is_school_member(school_id) OR
  is_platform_staff()`), **no** la de `support_ticket_notes`.
- `pg_trgm` ya está instalado (`20260626150000_chile_reference_data.sql:41`)
  para fuzzy match de `chile_schools.nombre`. El help-center será el
  **primer** uso de full-text search (`tsvector` + `websearch_to_tsquery`)
  en el proyecto; `.textSearch("search", q, { type: "websearch" })` está
  soportado por `@supabase/postgrest-js` (firmas en
  `PostgrestFilterBuilder.ts:1579,1690`).
- `footer.columns.resources` ya existe por locale (`messages.ts:114,270`)
  y es consumido por `PublicFooter.tsx:99` — listo para añadir "Centro de
  Ayuda".
- El `nav` del dashboard (`src/app/dashboard/layout.tsx:70-78`) es un
  array de `{href,label}` — listo para push de `/dashboard/support`.
- `addSupportTicketNote` (`src/app/admin/actions.ts:224-244`) es la
  plantilla exacta a replicar como `replySupportTicket` (mismo rol
  `support`, misma tabla familiar, misma auditoría + envío de email).

## Quick win inmediato (cero código)

Activar el botón de WhatsApp desde `/admin/settings`
(`site_config.whatsapp_button` → `enabled: true` + número real + mensaje
default). El botón ya se renderea en `PublicHeader.tsx:118` cuando
`whatsapp.enabled` es true. Replica el canal de escalamiento de Tiendanube
sin escribir una línea.

---

## Fase A — Centro de Ayuda (FAQ con categorías + búsqueda real)

### A1. Migración `20260809000000_help_center.sql`

```sql
-- Help Center: FAQ con categorías, multi-locale, full-text search.
CREATE TABLE IF NOT EXISTS public.faq_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale      text NOT NULL CHECK (locale IN ('es-CL','es-MX','es-PE','es-AR','pt-BR')),
  slug        text NOT NULL,
  name        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  published   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locale, slug)
);

CREATE TABLE IF NOT EXISTS public.faq_articles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.faq_categories(id) ON DELETE CASCADE,
  locale      text NOT NULL CHECK (locale IN ('es-CL','es-MX','es-PE','es-AR','pt-BR')),
  slug        text NOT NULL,
  title       text NOT NULL,
  body_md     text NOT NULL,
  tags        text[] NOT NULL DEFAULT '{}',
  search      tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body_md,''))
  ) STORED,
  view_count  int  NOT NULL DEFAULT 0,
  helpful_yes int  NOT NULL DEFAULT 0,
  helpful_no  int  NOT NULL DEFAULT 0,
  published   boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locale, slug)
);

CREATE INDEX IF NOT EXISTS idx_faq_articles_search ON public.faq_articles USING gin (search);
CREATE INDEX IF NOT EXISTS idx_faq_articles_category ON public.faq_articles (category_id);
CREATE INDEX IF NOT EXISTS idx_faq_categories_locale ON public.faq_categories (locale, published, sort_order);

ALTER TABLE public.faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_articles  ENABLE ROW LEVEL SECURITY;

-- Lectura pública si published=true (mismo patrón que site_config_read).
DROP POLICY IF EXISTS "faq_categories_public_read" ON public.faq_categories;
CREATE POLICY "faq_categories_public_read" ON public.faq_categories
  FOR SELECT USING (published);
DROP POLICY IF EXISTS "faq_articles_public_read" ON public.faq_articles;
CREATE POLICY "faq_articles_public_read" ON public.faq_articles
  FOR SELECT USING (published);

-- Escritura solo plataforma (admin o staff `support`).
DROP POLICY IF EXISTS "faq_categories_staff_write" ON public.faq_categories;
CREATE POLICY "faq_categories_staff_write" ON public.faq_categories
  FOR ALL USING (is_platform_staff()) WITH CHECK (is_platform_staff());
DROP POLICY IF EXISTS "faq_articles_staff_write" ON public.faq_articles;
CREATE POLICY "faq_articles_staff_write" ON public.faq_articles
  FOR ALL USING (is_platform_staff()) WITH CHECK (is_platform_staff());

-- Voto "útil/no útil" anónimo (sin login, sin identificar al votante).
-- La policy UPDATE solo permite tocar helpful_yes/helpful_no via RPC
-- SECURITY DEFINER, no UPDATE directo desde anon.
CREATE OR REPLACE FUNCTION public.faq_vote(p_article_id uuid, p_helpful boolean)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.faq_articles
  SET helpful_yes = helpful_yes + CASE WHEN p_helpful THEN 1 ELSE 0 END,
      helpful_no  = helpful_no  + CASE WHEN p_helpful THEN 0 ELSE 1 END
  WHERE id = p_article_id AND published;
$$;
REVOKE ALL ON FUNCTION public.faq_vote(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.faq_vote(uuid, boolean) TO anon, authenticated;

-- Incrementar view_count sin exponer UPDATE directo.
CREATE OR REPLACE FUNCTION public.faq_view(p_article_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.faq_articles SET view_count = view_count + 1 WHERE id = p_article_id AND published;
$$;
REVOKE ALL ON FUNCTION public.faq_view(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.faq_view(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
```

Notas:
- `'simple'` funciona razonable en español y portugués sin diccionario.
  Migrar a `'spanish'`/`'portuguese'` por locale después (cambia sólo la
  definición del `tsvector`, no los datos) si la calidad de búsqueda lo
  requiere.
- El `CHECK (locale IN (...))` alinea con `src/i18n/config.ts:1` (5
  locales reales).

### A2. Rutas públicas

- `/[locale]/ayuda/page.tsx` — lista categorías publicadas + buscador.
  Buscador: `supabase.from("faq_articles").select("id,title,slug,
  category_id").textSearch("search", q, { type: "websearch" }).eq(
  "published", true).eq("locale", activeLocale).limit(10)`. `force-dynamic`.
- `/[locale]/ayuda/[categoria]/[articulo]/page.tsx` — artículo + botón
  "¿Te sirvió? Sí/No" (POST a `/api/faq/vote` o RPC `faq_vote`), si "No" →
  CTA a WhatsApp (`site_config.whatsapp_button`) o a `/support` para crear
  ticket (Fase B). Tras montar, llamar `faq_view(article_id)` para
  contar vista. `robots: { index: true }` (sí indexable).

### A3. Admin CRUD

- `src/app/admin/help-center/page.tsx` — lista categorías + artículos,
  crear/editar/publicar, search preview.
- Server actions en `src/app/admin/help-center/actions.ts` (mismo patrón
  que `src/app/admin/actions.ts:224-244`): `upsertFaqCategory`,
  `upsertFaqArticle`, `toggleFaqPublished`, `deleteFaqArticle`. Todas con
  `requirePlatformContext(["platform_admin","support"])` + `writeAuditLog`
  (`action: "faq.*"`).
- Añadir `["/admin/help-center", "Centro de ayuda"]` a `ADMIN_NAV` en
  **`src/components/dashboard/AdminLayoutShell.tsx:8-21`** (tupla, no
  objeto) — **no** editar `AdminShell.tsx` (su propio comentario `:1-8`
  aclara que el nav vive en `AdminLayoutShell`).

### A4. Nav pública

- `src/components/PublicHeader.tsx:119-120` ya tiene un link "Soporte".
  Añadir paralelo "Centro de Ayuda" → `localeHref("/ayuda", activeNewLocale)`
  usando una nueva clave `copy.helpCenter` en `messages.ts` por locale
  (5 locales: `:164,302,438,574,710`).
- `messages[locale].footer.columns.resources` (`messages.ts:270,406,542,
  678,814`) — hacer push de `{ href: "/ayuda", label: "Centro de Ayuda" }`
  en cada locale. Render automático en `PublicFooter.tsx:99`.

### A5. Fuera de alcance en esta fase

Dejar **intactos** los 3 FAQ actuales:
- `src/i18n/messages.ts → faqs` (consumido por `para-colegios`).
- Inline en `src/app/[locale]/precios/page.tsx:56-64` — alimenta JSON-LD
  `FAQPage` (`:66-87`) que Google indexa como rich-snippets. **No moverlo**
  a /ayuda: duplicaría contenido en Search Console. Migrarlo a /ayuda es
  fase posterior opcional, y si se hace, dejar el JSON-LD en /precios con
  `<link rel="canonical">` apuntando a la versión /ayuda para evitar
  contenido duplicado.
- `src/lib/recursos_content.ts` (FAQs por país/evaluación).

---

## Fase B — Completar los tickets (el cliente crea y ve respuestas)

### B1. Migración `20260809000001_support_tickets_public.sql`

```sql
-- Tickets accesibles por el cliente (logueado o por link público /t/[token]).
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS name  text,
  ADD COLUMN IF NOT EXISTS token uuid UNIQUE DEFAULT gen_random_uuid();

-- Hilo visible al cliente (a diferencia de support_ticket_notes, que es
-- interno y solo staff). RLS espeja support_tickets_school_staff, NO
-- support_ticket_notes (que es solo is_platform_staff).
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_type text NOT NULL CHECK (author_type IN ('customer','staff')),
  author_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.support_ticket_messages (ticket_id, created_at);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Staff y miembros del colegio (RLS espeja support_tickets_school_staff
-- de 20260626010000_dashboard_platform.sql:265-266).
DROP POLICY IF EXISTS "ticket_messages_school_staff" ON public.support_ticket_messages;
CREATE POLICY "ticket_messages_school_staff" ON public.support_ticket_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND (is_platform_staff() OR is_school_member(t.school_id))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND (is_platform_staff() OR is_school_member(t.school_id))
    )
  );

-- Acceso anónimo SOLO por token (patrón /r/[token]): una función
-- SECURITY DEFINER devuelve el hilo + datos mínimos del ticket sin
-- exponer school_id/user_id (igual que /r/[token] no filtra PII de
-- result_links).
CREATE OR REPLACE FUNCTION public.get_ticket_by_token(p_token uuid)
RETURNS TABLE (
  ticket_id uuid,
  subject text,
  status text,
  locale text,
  created_at timestamptz,
  msg_id uuid,
  msg_author_type text,
  msg_body text,
  msg_created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.id, t.subject, t.status, t.locale, t.created_at,
         m.id, m.author_type, m.body, m.created_at
  FROM public.support_tickets t
  LEFT JOIN public.support_ticket_messages m ON m.ticket_id = t.id
  WHERE t.token = p_token
  ORDER BY m.created_at;
$$;
REVOKE ALL ON FUNCTION public.get_ticket_by_token(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_ticket_by_token(uuid) TO anon, authenticated;

-- Insert anónimo por token (el cliente responde sin login).
CREATE OR REPLACE FUNCTION public.reply_ticket_by_token(
  p_token uuid, p_body text
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.support_ticket_messages (ticket_id, author_type, body)
  SELECT id, 'customer', p_body
  FROM public.support_tickets WHERE token = p_token;
$$;
REVOKE ALL ON FUNCTION public.reply_ticket_by_token(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reply_ticket_by_token(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
```

### B2. Cliente logueado

- `src/app/dashboard/support/page.tsx` — lista tickets del colegio activo
  (`getDashboardContext` + `.eq("school_id", school.id)` para defense-in-
  depth además de RLS) + formulario "Nuevo ticket" (locale precompletado
  desde `getDashboardContext().locale`) + hilo (`support_ticket_messages`
  filtrado por `ticket_id IN (tickets del colegio)`).
- Push `({ href: "/dashboard/support", label: "Soporte" })` a `nav` en
  **`src/app/dashboard/layout.tsx:70-78`** (es array de objetos — distinto
  de `ADMIN_NAV` que son tuplas).

### B3. Público sin login

- Extender `src/app/[locale]/support/page.tsx`: añadir formulario real
  (nombre+email+asunto+mensaje) → server action que crea ticket con
  `school_id`/`user_id` NULL (RLS permite INSERT anónimo: añadir policy
  `support_tickets_public_insert WITH CHECK (true)` limitada a
  `school_id IS NULL AND user_id IS NULL` para no permitir que un anon
  falsifique un ticket de colegio ajeno).
- Tras insert, devolver link `/t/[token]` en pantalla + email
  `ticket_created` con el link.
- `src/app/t/[token]/page.tsx` — calcado de `src/app/r/[token]/page.tsx`:
  `createSupabaseAdminClient()` + `adminClient.rpc("get_ticket_by_token",
  { p_token })` + `notFound()` si vacío, `dynamic="force-dynamic"`,
  `robots:{index:false}`. Botón "Responder" → form que llama a
  `reply_ticket_by_token` o a server action con `createSupabaseServerClient`
  anónimo.

### B4. Admin: `replySupportTicket`

En `src/app/admin/actions.ts`, copiar `addSupportTicketNote` (`:224-244`)
como `replySupportTicket`:
- `requirePlatformContext(["platform_admin","support"])`.
- `INSERT INTO support_ticket_messages` con `author_type='staff'`,
  `author_id = user.id`.
- `sendTemplatedEmail({ to: ticket.email ?? owner_email, templateKey:
  "ticket_reply", locale: ticket.locale ?? "es-CL", variables: {
  ticket_subject, ticket_link: siteUrl + "/t/" + ticket.token } })`.
- `writeAuditLog({ action: "support_ticket.reply", ... })`.
- `revalidatePath("/admin/support")`.
- Importar `sendTemplatedEmail` desde `@/lib/email` (ya importado en
  `src/app/admin/actions.ts:7`).

### B5. Plantillas de email

Añadir a `STATIC_TEMPLATES` en `src/lib/email.ts`:
- `ticket_created` (5 locales mínimo `es-CL` + `pt-BR`, fallback al resto).
  Variables: `{{ticket_subject}}`, `{{ticket_link}}`.
- `ticket_reply` — variables `{{ticket_subject}}`, `{{ticket_link}}`,
  `{{reply_preview}}` (primeros 200 chars del body de staff).
Estático primero; mover a `email_templates` (Supabase) después vía
`/admin/marketing` para edición no-programador.

⚠️ **Bloqueante**: si la Tarea 4 de `SECURITY_PROMPT.md` (escape HTML en
`compileTemplate`) no está aplicada, el correo puede inyectar HTML desde
el `subject` del ticket (controlado por el cliente). Aplicarla primero o
escapar localmente en `replySupportTicket` antes de enviar.

---

## Fase C — Deflection (la que realmente reduce tickets)

Mientras el usuario escribe el asunto del ticket (dashboard y público),
buscar en `faq_articles` (debounced, 300ms) y sugerir 3 artículos ANTES
de dejar enviar — "¿esto responde tu duda?". Patrón central de
Zendesk/Tiendanube/Chatwoot. Requiere que Fase A lleve tiempo en
producción con artículos reales cargados (mínimo ~15).

Implementación: endpoint `GET /api/faq/search?q=...&locale=...` que
envuelva `.textSearch("search", q, { type: "websearch" }).eq("published",
true).eq("locale", locale).limit(3)`. Aplicar `rateLimit` (Tarea 2 de
`SECURITY_PROMPT.md`) si Tarea 2 ya está aplicada; si no, dejarlo pendiente
de esa dependencia.

---

## Orden recomendado en el tiempo

| Iteración | Qué | Dependencias |
|---|---|---|
| **Hoy** | Activar WhatsApp desde `/admin/settings` (cero código) | Ninguna |
| **Iter 1** | Fase A completa + cargar los primeros ~15 artículos (los 3 FAQ existentes son semilla) | A1→A2→A3→A4 |
| **Iter 2** | Fase B (`replySupportTicket`, `/t/[token]`, formularios) | B1 requiere A1 aplicada; B4/B5 recomienda aplicar Tarea 4 de `SECURITY_PROMPT.md` primero |
| **Iter 3** | Fase C Bruselas | Solo tras Iter 1 con artículos en producción |

## Verificación por fase

- `npm run lint && npm run build` tras cada fase; deploy vía push a
  `master` (Vercel). Aplicar migraciones a mano (Vercel no las corre).
- **A**: crear 2 categorías + 3 artículos en `/admin/help-center`;
  visitar `/es-CL/ayuda` y `/pt-BR/ayuda`; confirmar que el buscador
  encuentra por texto parcial en ambos idiomas; votar Sí/No y ver
  contadores subir; visitar `/es-CL/ayuda/<cat>/<art>` sin login (RLS
  permite lectura publicada).
- **B**: ticket de colegio A logueado **no** visible para colegio B
  (probar con dos cuentas); ticket anónimo desde `/es-MX/support` →
  link `/t/[token]` funciona sin sesión y sin exponer `school_id` →
  llega email `ticket_created` (Reend conectado); respuesta desde
  `/admin/support` → llega email `ticket_reply` + aparece en
  `/t/[token]`. Probar `get_ticket_by_token` con token inexistente →
  vacío, no revela existencia.
- **C**: escribir un asunto que coincida con un artículo publicado →
  aparece la sugerencia antes de enviar; 4 intentos rápidos seguidos
  no rompen nada (rate-limit pendiente de Tarea 2 si no aplicada).

## Notas de seguridad a respetar (cruce con `SECURITY_PROMPT.md`)

1. **Todas las queries** en `dashboard/support` y `t/[token]` deben llevar
   `.eq("school_id", school.id)` además de RLS (defense-in-depth, Tarea
   5 / Tarea 14 de `SECURITY_PROMPT.md`).
2. **`/api/faq/search`** si se crea en Fase C: envolver con `rateLimit`
   una vez exista `src/lib/rateLimit.ts` (Tarea 2). Mientras tanto, el
   endpoint admin y el form del dashboard usan el client SSR normal.
3. **`replySupportTicket`** debe replicar `requirePlatformContext` +
   `writeAuditLog` como `addSupportTicketNote:224-244` — no exponer a
   school_admin (sólo `["platform_admin","support"]`).
4. **`get_ticket_by_token` / `reply_ticket_by_token`**: SECURITY DEFINER
   con `search_path = ''` (mismo patrón que `increment_result_link_view`
   `20260705000000_result_links.sql:128`). Nunca devolver `school_id` ni
   `user_id` al caller anónimo — solo `subject, status, locale,
   created_at` + hilo `body`.
5. **`support_tickets_public_insert`**: `WITH CHECK (school_id IS NULL
   AND user_id IS NULL)` — un anon puede crear ticket suelto, no
   falsificar uno adosado a un colegio existente.
6. **Emails**: bloquear B5 hasta que `compileTemplate` escape HTML
   (Tarea 4 `SECURITY_PROMPT.md`), o escapar `ticket_subject` /
   `reply_preview` localmente antes de pasarlos como `variables`.