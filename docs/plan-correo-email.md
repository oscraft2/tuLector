# Sistema de correo transaccional

Inventario y estado del sistema de correo de TuLector (auditado y actualizado
jul 2026). Mismo espíritu que `docs/dlocal-pasarela-unificada.md` para pagos:
un solo lugar donde ver qué hay, qué falta, y qué le toca al usuario fuera del
código.

## Proveedor

**Resend**, vía llamada REST directa (`src/lib/email.ts`, función `sendEmail`),
sin el SDK oficial. Dos variables de entorno:

- `RESEND_API_KEY` — sin ella (o con el placeholder `re_...`), el sistema cae
  a **modo dev-log**: cada correo se imprime por consola completo (asunto,
  texto, HTML) y nunca sale de verdad. Es el estado actual en local/staging.
- `RESEND_FROM_EMAIL` — remitente. Default `onboarding@resend.dev` (dominio
  sandbox de Resend). **Pendiente: verificar un dominio propio** (ej.
  `notificaciones@tulector.app`) en el dashboard de Resend — sin esto, los
  correos reales quedan limitados/marcados como sandbox y no se ve profesional.

## Cómo funciona `sendTemplatedEmail`

`sendTemplatedEmail({ to, templateKey, locale, variables })`:
1. Busca la plantilla en la tabla Supabase `email_templates` (editable desde
   `/admin/marketing` → pestaña "Plantillas HTML"), con clave compuesta
   `templateKey:locale` con prioridad sobre `templateKey` a secas.
2. Si no hay match en BD, cae a `STATIC_TEMPLATES` hardcodeadas en
   `src/lib/email.ts`.
3. Compila `{{variable}}` con los valores pasados y envía.

Esto permite editar el contenido de un correo sin deploy (vía el panel admin)
manteniendo un fallback confiable si la tabla está vacía o falla la conexión.

## Plantillas y disparadores

| Plantilla | Disparador | Idiomas | Archivo |
|---|---|---|---|
| `invitation` | Invitar colaborador a un colegio | es-CL, en, pt-BR | `dashboard/actions.ts` |
| `quota_alert_90` / `quota_alert_100` | Colegio llega a 90%/100% de cuota de escaneos | es-CL | `lib/quota_alerts.ts` |
| `payment_success` | Webhook de pago aprobado (Flow, MercadoPago) | es-CL | `api/billing/webhook/{flow,mercadopago}/route.ts` |
| `payment_failed` | Webhook de pago **rechazado explícitamente** | es-CL | `lib/billing_orders.ts` (`notifyPaymentFailed`) |
| `order_receipt` | Comprobante formal tras un pago aprobado | es-CL | `lib/billing_orders.ts` (`sendOrderReceiptIfNeeded`) |
| `account_welcome` | Bienvenida al crear un colegio | es-CL | `dashboard/onboarding/actions.ts` |
| `newsletter_confirm` | Confirmación simple al dejar los datos en el sitio público | es-CL, en, pt-BR | `api/leads/newsletter/route.ts` |

Todos los disparadores usan `resolveLocaleForCountry(school.country_code)`
(`src/lib/country_profiles.ts`) para elegir el idioma — hoy solo `invitation`
y `newsletter_confirm` tienen contenido real en los 3 idiomas; el resto cae a
es-CL vía el fallback interno de `sendTemplatedEmail` aunque se les pida otro
locale (no rompe nada, simplemente no está traducido todavía).

## Envíos best-effort

Todos los disparadores de negocio son **best-effort**: si `sendTemplatedEmail`
falla, se loguea (`console.warn`) pero NO bloquea la operación principal (crear
colegio, procesar pago, guardar lead). El único punto con protección
anti-duplicado real es `order_receipt` (columna `orders.receipt_sent_at`).
`payment_failed` no tiene protección anti-duplicado — un reintento del webhook
de la pasarela podría reenviarlo (riesgo aceptado: como mucho 2 avisos de "no
se pudo cobrar", no confunde como un doble cobro).

## Emails nativos de Supabase Auth (fuera de este sistema)

Dos flujos usan el sistema de Auth de Supabase directamente, **sin pasar por
`sendTemplatedEmail`**:
- Confirmación de cuenta al registrarse (`src/app/auth/page.tsx`, `signUp`).
- Magic link del portal de apoderados (`src/app/api/portal/request-link/route.ts`,
  `signInWithOtp`).

La configuración de estos (SMTP custom, plantillas propias de Auth, dominio
remitente) se gestiona desde el **dashboard de Supabase en producción**, no
está versionada en este repo (`supabase/config.toml` es solo la config
local/CLI). **Pendiente de verificar por el usuario**: si producción tiene SMTP
custom configurado o sigue con el límite/defaults de Supabase.

## Checklist pendiente (fuera del código, le toca al usuario)

- [ ] Verificar un dominio propio en Resend (dashboard de Resend → Domains).
- [ ] Cargar `RESEND_API_KEY` y `RESEND_FROM_EMAIL` en Vercel → Settings →
      Environment Variables (producción y preview si corresponde).
- [ ] Revisar si Supabase Auth en producción tiene SMTP custom para los emails
      nativos (confirmación de cuenta, magic link) o sigue con el límite de
      envíos por hora del proveedor default de Supabase.
- [ ] Decidir si vale la pena traducir `quota_alert_*`, `payment_success`,
      `payment_failed`, `order_receipt` y `account_welcome` a en/pt-BR (hoy
      solo tienen es-CL; el sistema funciona igual, solo que en español para
      colegios de cualquier país).
