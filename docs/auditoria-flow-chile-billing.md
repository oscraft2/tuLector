# Auditoría Técnica: Sistema de Pagos Flow (Chile) y Facturación TuLector

**Fecha**: 15 de Noviembre de 2026  
**Objetivo**: Auditoría técnica del trabajo de facturación realizado por Codex en la rama `origin/codex/billing-checkout-ui` (commits `2622c27` a `5326cae`) y verificación de requisitos para su puesta en marcha y prueba en Chile con Flow.

---

## 1. Resumen Ejecutivo

Codex realizó una reingeniería sustancial y de alta calidad técnica sobre la facturación de TuLector, resolviendo vulnerabilidades de concurrencia, errores de firma en Flow y atomicidad en base de datos.

Sin embargo, para que el sistema funcione en vivo en Chile **no es solo cuestión de credenciales y migración SQL**. La auditoría descubrió **dos problemas de código bloqueantes** que habrían provocado fallos inmediatos al probar Flow en producción o staging, más consideraciones operativas y de datos existentes.

---

## 2. Lo que Codex Implementó y Corrigió con Éxito

1. **Firma Canónica de Flow (`signFlowParameters`)** (`src/lib/flow.ts`):
   - **Antes**: Concatenaba parámetros con formato query-string (`key=val&key=val`), rechazado por Flow con error de autenticación.
   - **Ahora**: Orden alfabético estricto de claves (excluyendo el parámetro `s`), concatenación directa clave-valor (`keyvalkeyval`) y HMAC-SHA256 con el `secretKey`. Compatible 100% con la API oficial de Flow.
2. **Transacción Atómica PostgreSQL (`apply_paid_order`)** (`supabase/migrations/20261114000000_billing_integrity.sql`):
   - Elimina mutaciones separadas en TypeScript.
   - Bloqueos `FOR UPDATE` en `orders`, `schools` y `subscriptions`.
   - Acumulación de lecturas restantes si se renueva el mismo plan antes del término de vigencia.
   - Actualización inmediata en cambios de plan (upgrade a School).
   - Bloqueo de downgrade directo de School a Pro sin soporte.
3. **Idempotencia de Webhooks y Comprobantes** (`src/lib/billing_webhook.ts`):
   - Los reintentos de pago no bloquean el flujo.
   - Comprobantes automáticos vía Resend con clave de idempotencia (`order-receipt/${orderId}/...`).
4. **Validación Tributaria Chilena**:
   - Normalización de RUT canónico con dígito verificador (`src/lib/rut.ts`).
   - Validación de región y comuna contra la tabla `comunas` en PostgreSQL.
5. **Panel de Control Financiero y Registro de Devoluciones** (`src/app/admin/billing/page.tsx`):
   - KPIs de órdenes, suscripciones activas e ingresos por moneda.
   - Registro de devoluciones externas con referencia de pasarela (`record_external_refund`), protegiendo órdenes históricas de borrado accidental de cuotas.

---

## 3. Hallazgos Críticos y Correcciones Pendientes

### 🔴 Hallazgo Crítico 1: Error 405 en el Retorno del Navegador desde Flow (`urlReturn`)
- **Problema**: Flow devuelve al navegador del usuario a la `urlReturn` mediante una petición **HTTP POST** con el cuerpo `token=...`.
- En `src/app/api/billing/checkout/route.ts` se configuró:
  ```ts
  urlReturn: `${siteUrl}/dashboard/billing?order_id=${order.id}`
  ```
- En Next.js App Router, `/dashboard/billing` es una **Página** (`page.tsx`), no un endpoint API. Las páginas de Next.js **solo aceptan peticiones HTTP GET**.
- **Consecuencia**: Al pagar en Webpay y hacer clic en *"Volver al comercio"*, el usuario recibe un error **`405 Method Not Allowed`** en blanco.
- **Solución requerida**:
  Crear la ruta API `src/app/api/billing/flow-return/route.ts` con método `export async function POST(req: Request)` que:
  1. Lea el `token` enviado por Flow en el formulario POST.
  2. Obtenga el `order_id` (vía query param o verificando el estado en Flow).
  3. Ejecute una redirección HTTP 303 limpia hacia `/dashboard/billing?order_id=${orderId}`.

### 🔴 Hallazgo Crítico 2: Bloqueo de Flow Sandbox en Vercel
- En `src/app/api/billing/checkout/route.ts` líneas 154-156:
  ```ts
  if (flowConfig.sandbox && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Flow sandbox no esta permitido en produccion." }, { status: 503 });
  }
  ```
- **Problema**: Vercel ejecuta **todos** los despliegues (incluyendo ramas Preview / Staging) con `NODE_ENV = "production"`.
- **Consecuencia**: No es posible probar Flow Sandbox en Vercel antes de lanzar a cobros reales; el checkout arroja error 503.
- **Solución requerida**: Permitir una variable explícita como `ALLOW_FLOW_SANDBOX=true` para autorizar pruebas en entornos Vercel sin bloquear el checkout.

### ⚠️ Hallazgo 3: Efecto de la Migración SQL en Colegios Existentes
- La función `effective_school_scan_limit` introducida en la migración SQL valida que para tener límite Pro/School debe existir una fila activa en `subscriptions`:
  ```sql
  SELECT CASE WHEN s.plan IN ('pro', 'school') AND NOT EXISTS (
    SELECT 1 FROM subscriptions sub WHERE sub.school_id = s.id AND sub.status = 'active'
      AND sub.plan = s.plan AND sub.current_period_end > now()
  ) THEN least(coalesce(s.scans_limit, 100), 100) ELSE s.scans_limit END
  FROM schools s WHERE s.id = p_school_id;
  ```
- **Riesgo**: Si existen colegios con plan `pro` o `school` asignado manualmente pero sin registro en `subscriptions`, la migración los bajará inmediatamente a 100 lecturas (Starter).
- **Acción requerida**: Correr la consulta previa de reconciliación antes de aplicar la migración en Supabase.

### ⚠️ Hallazgo 4: Comprobante Comercial vs Factura Electrónica SII
- El comprobante enviado por correo (`TL-XXXXXXXX`) es un recibo comercial interno.
- Los colegios en Chile requieren Factura Electrónica (afecta o exenta) ante el SII. Se debe coordinar la emisión manual en el portal del SII o integrar un facturador DTE (LibreDTE / OpenFactura / Facto).

---

## 4. Checklist de Puesta en Marcha

| # | Tarea | Componente / Archivo | Estado |
|---|---|---|---|
| 1 | Crear endpoint puente `POST /api/billing/flow-return` | `src/app/api/billing/flow-return/route.ts` | Pendiente |
| 2 | Ajustar `urlReturn` para apuntar a `/api/billing/flow-return` | `src/app/api/billing/checkout/route.ts` | Pendiente |
| 3 | Permitir `ALLOW_FLOW_SANDBOX=true` en staging de Vercel | `src/app/api/billing/checkout/route.ts` | Pendiente |
| 4 | Reconciliar consultas previas en Supabase producción | `docs/billing-admin-deployment.md` | Pendiente |
| 5 | Aplicar migración SQL `20261114000000_billing_integrity.sql` | Supabase SQL Editor | Pendiente |
| 6 | Merge de la rama `origin/codex/billing-checkout-ui` a `master` | Git | Pendiente |
| 7 | Configurar variables en Vercel (`FLOW_API_KEY`, `FLOW_SECRET_KEY`, etc.) | Vercel Project Settings | Pendiente |
| 8 | Prueba de compra en Sandbox con Webpay | Dashboard TuLector | Pendiente |
| 9 | Cambio a credenciales reales de producción Flow | Vercel Project Settings | Pendiente |
