# Plan: Centro de Ayuda (FAQ potente) + Mesa de tickets profesional, multi-país

Fecha: 2026-07-21. Estado: **aprobado, pendiente de construcción por fases.**
Auditoría hecha con datos reales (GitHub API + web) el mismo día — no de memoria.

## Por qué existe este plan

tuLector opera en 5 mercados (Chile, México, Perú, Argentina, Brasil — ver `src/i18n/config.ts`)
y hoy el "soporte" es: una página estática (`/[locale]/support`), un mailto de ventas por país,
FAQs hardcodeadas en 3 lugares distintos del código, y un inbox admin de tickets **que ningún
cliente puede alimentar** (no existe formulario de creación). La meta es el patrón de las
plataformas grandes (Tiendanube con Zendesk Guide): centro de ayuda con categorías + buscador
real + escalamiento a ticket/WhatsApp solo cuando el artículo no resuelve.

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

1. tuLector **ya tiene la mitad del sistema de tickets construido**: tablas `support_tickets` +
   `support_ticket_notes` con RLS correcta por colegio, inbox admin funcional
   (`src/app/admin/support/page.tsx`, acciones en `src/app/admin/actions.ts`: asignar, notas
   internas, estado/prioridad). Terminarlo cuesta menos que integrar una plataforma externa.
2. Ya existe el rol de staff `support` (`requirePlatformContext(["platform_admin","support"])`) —
   habrá personal no-programador editando contenido → el FAQ debe vivir en Supabase con CRUD en
   `/admin`, **no** en archivos MDX/git.
3. Ya existe el patrón de link público sin login (`result_links` + `/r/[token]` + función
   `SECURITY DEFINER increment_result_link_view`) — reusable para "ver mi ticket sin cuenta".
4. Ya existe un botón flotante de WhatsApp implementado y apagado
   (`src/components/WhatsAppFloatingButton.tsx` + `site_config.whatsapp_button`).

## Quick win inmediato (cero código)

Activar el botón de WhatsApp desde `/admin/settings` (`site_config.whatsapp_button` → enabled +
número real). Replica el canal de escalamiento de Tiendanube sin escribir una línea.

## Fase A — Centro de Ayuda (FAQ con categorías + búsqueda real)

1. **Migración** `supabase/migrations/<AAAAMMDDHHMMSS>_help_center.sql` (convención confirmada,
   última: `20260717010000_support_ticket_notes.sql`):
   - `faq_categories(id, locale, slug, name, sort_order, published)`
   - `faq_articles(id, category_id, locale, slug, title, body_md, tags text[], search tsvector
     GENERATED ALWAYS AS (...) STORED, view_count, helpful_yes, helpful_no, published, updated_at)`
     + índice GIN sobre `search`.
   - Sería el primer uso de full-text search en el proyecto (hoy solo hay `pg_trgm` para
     fuzzy-match de `chile_schools.nombre`). **Empezar con config `'simple'`** en el tsvector
     (funciona razonable en español y portugués); migrar a `'spanish'`/`'portuguese'` por locale
     después, sin cambiar datos.
   - RLS: lectura pública si `published=true` (mismo patrón `USING (true)` de `site_config_read`);
     escritura solo staff (`is_platform_admin()` / rol support).
2. **Rutas públicas**: `/[locale]/ayuda` (categorías + buscador) y
   `/[locale]/ayuda/[categoria]/[articulo]` (artículo + voto "¿Te sirvió? Sí/No"; si "No" → CTA a
   WhatsApp o crear ticket). Buscador:
   `supabase.from("faq_articles").textSearch("search", q, { type: "websearch" })`.
3. **Admin CRUD**: `/admin/help-center` para categorías y artículos; agregar
   `["/admin/help-center", "Centro de ayuda"]` a `adminNav` en
   `src/components/dashboard/AdminShell.tsx`.
4. **Nav pública**: link "Centro de Ayuda" en `src/components/PublicHeader.tsx` (junto al link
   "Soporte" existente) y en `columns.resources` del footer (`messages[locale].footer.columns`).
5. **Fuera de alcance en esta fase** (evitar regresiones): dejar intactos los 3 FAQ actuales
   (`i18n/messages.ts → faqs` usado en `para-colegios`, el inline de `precios/page.tsx`, y
   `lib/recursos_content.ts`). Migrarlos al nuevo sistema es una fase posterior opcional.

## Fase B — Completar los tickets (el cliente crea y ve respuestas)

1. **Migración**: a `support_tickets` agregar `email text`, `name text` (tickets sin cuenta) y
   `token uuid UNIQUE DEFAULT gen_random_uuid()` (link público, patrón `result_links`). Nueva
   tabla `support_ticket_messages(id, ticket_id, author_type CHECK IN ('customer','staff'),
   author_id, body, created_at)` — hilo VISIBLE al cliente (las `support_ticket_notes` siguen
   siendo internas). RLS espeja `support_tickets_school_staff`; acceso anónimo por token vía
   función `SECURITY DEFINER` análoga a `increment_result_link_view`.
2. **Cliente logueado**: página `/dashboard/support` — lista de tickets del colegio + formulario
   "Nuevo ticket" (locale precompletado desde `getDashboardContext()`) + hilo. Agregar
   `{ href: "/dashboard/support", label: "Soporte" }` al `nav` de `src/app/dashboard/layout.tsx`.
3. **Público sin login**: extender `/[locale]/support` con formulario real
   (nombre+email+asunto+mensaje) → crea ticket con `school_id`/`user_id` null → devuelve link
   `/t/[token]`. Página `/t/[token]` calcada de `/r/[token]` (`createSupabaseAdminClient()` +
   `.maybeSingle()` + `notFound()`, `dynamic:"force-dynamic"`, `robots:{index:false}`).
4. **Admin**: acción `replySupportTicket` en `src/app/admin/actions.ts` (inserta en
   `support_ticket_messages` como staff + dispara email) — patrón de `addSupportTicketNote`;
   textarea de respuesta en `/admin/support`.
5. **Emails** (reusar `sendTemplatedEmail` de `src/lib/email.ts`): plantillas `ticket_created`
   (confirmación con link `/t/[token]` si es anónimo) y `ticket_reply` (aviso de respuesta staff).

## Fase C — Deflection (la que realmente reduce tickets)

Mientras el usuario escribe el asunto del ticket (dashboard y público), buscar en `faq_articles`
(debounced) y sugerir artículos ANTES de dejar enviar — "¿esto responde tu duda?". Es el patrón
central de Zendesk/Tiendanube/Chatwoot: la mayoría de las consultas se auto-resuelven ahí.
Requiere que Fase A lleve tiempo en producción con artículos reales cargados.

## Orden recomendado en el tiempo

1. **Hoy**: activar WhatsApp (cero código).
2. **Iteración 1**: Fase A completa + cargar los primeros ~15 artículos (los 3 FAQ existentes son
   la semilla natural de contenido).
3. **Iteración 2**: Fase B.
4. **Iteración 3**: Fase C, cuando ya exista una base de artículos que sugerir.

## Verificación por fase

- `npm run build` tras cada fase; deploy vía push a `master` (Vercel).
- **A**: crear artículos en `/admin/help-center`; probar `/es-CL/ayuda` y `/pt-BR/ayuda`;
  confirmar que el buscador encuentra por texto parcial en ambos idiomas.
- **B**: ticket de colegio A logueado no visible para colegio B (RLS); ticket anónimo desde
  `/es-MX/support` → link `/t/[token]` funciona sin sesión → llega email de confirmación
  (Resend); respuesta desde `/admin/support` → llega email y aparece en el hilo del cliente.
- **C**: escribir un asunto que coincida con un artículo publicado → aparece la sugerencia antes
  de enviar.
