# TuLector — Resumen de cambios (sesión Jul 26, 2026)

## 1. Banner DIA Bot en landing Chile

**Archivos:** `src/components/DiaExtensionBanner.tsx` (nuevo), `src/app/[locale]/page.tsx`

- Banner promocional de la extensión DIA Bot (Chrome) que sube resultados escaneados a la plataforma DIA de la Agencia de Calidad de la Educación.
- Visible solo en `es-CL`.
- Usa el logo azul "D" del bot (`public/dia-bot-icon.png`), tipografía del sitio, paleta `#111827` / `#2f6f5e` / `#f0f7f4`.
- Muestra los 3 pasos del flujo (escanear → abrir DIA → simular y guardar) con mock visual del popup de la extensión.

## 2. Checkout conectado (precios → auth → billing → Flow)

**Archivos:** 9 archivos modificados + `src/lib/safe_next.ts` (nuevo)

- **`/[locale]/precios`**: botón "Contratar Pro/School" en es-CL → `/dashboard/billing?plan=pro|school`. Otros locales mantienen mailto.
- **Middleware**: header `x-request-path` preserva la URL completa con query (`?plan=pro`) a través de redirects.
- **`getDashboardContext`**: redirect a `/auth?next=...` y onboarding con `next` preservado (anti open-redirect vía `safeNextPath`).
- **`/auth`**: respeta `?next=` en login, sesión existente, OAuth y registro.
- **Onboarding**: hidden input con `next` → tras crear la escuela vuelve al billing con el plan preseleccionado.
- **`BillingCheckoutPanel`**: prop `initialPlan` → preselecciona el plan correcto en el checkout de Flow.
- **Seguridad**: monto y plan validados server-side en `/api/billing/checkout` (`resolveBillingCatalogItem`); pago confirmado por webhook firmado de Flow.

## 3. SEO — paquete prioritario

**Archivos:** `next.config.ts`, `middleware.ts`, `src/app/layout.tsx`, `src/app/[locale]/layout.tsx`, 5 páginas + 2 nuevas OG images

1. **Redirects 308** de rutas legacy (`/support`, `/security`, `/privacy`, `/terms`, `/data-request`) → `/{locale}/...` detectando cookie/geo/idioma en middleware.
2. **FAQ JSON-LD** en precios, para-colegios, para-docentes, para-preuniversitarios y artículos `[slug]` (rich results).
3. **Logo Organization** → `icon-512.png` (cuadrado 512×512) en vez de la hero 1400×980.
4. **OG images** para `para-docentes` y `para-preuniversitarios` (ImageResponse, 1200×630, diseño consistente).
5. **Headings**: planes de precios como `<h2>` + `noindex` en `/scan` y `/sheet`.
6. **Service JSON-LD** en para-docentes y para-preuniversitarios.

## 4. Google Analytics 4

**Archivos:** `src/components/GoogleAnalytics.tsx` (nuevo), `src/lib/gtag.ts` (nuevo), `src/app/layout.tsx`

- Snippet GA4 con `afterInteractive` (inyectado en cliente, no en HTML del servidor).
- Page views automáticos en navegación SPA con `usePathname` + `useSearchParams`.
- Excluye el APK nativo (TuLectorApp).
- Eventos de conversión pre-armados en `src/lib/gtag.ts`: `eventSignUp`, `eventLogin`, `eventBeginCheckout`, `eventPurchase`, `eventExportDia`, `eventScanComplete`.
- Measurement ID: `G-WGRG4DCH5D`.

## Deploy

Tres commits en `master`, desplegados vía Vercel (automático en push):
1. `df0bdcd` — DIA: banner de la extension DIA Bot en landing es-CL
2. `5d86ed0` — DIA: banner con el logo azul del bot y tipografia del sitio
3. `0872f4e` — Precios: boton Contratar conecta con el checkout seguro
4. `b861493` — SEO: redirects legacy, FAQ JSON-LD, logo Organization, OG docentes/preu
5. `93cffc4` — build: activar GA4 G-WGRG4DCH5D
6. `616ae6d` — analytics: hardcodear GA4 ID (es publico, no requiere env)

## Pendientes para SEO de posicionamiento

1. Páginas de aterrizaje por país/examen (PAES Chile, EXANI México, etc.)
2. Diferenciar títulos OG de home por país
3. Mejorar meta descriptions con hook de venta
4. Google for Education + directorios edtech (backlinks)
5. Medir Core Web Vitals en Search Console
