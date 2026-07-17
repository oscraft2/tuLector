# dLocal: Pasarela unificada para los 8 paises LATAM

> Julio 2026. Analisis de dLocal como solucion de pago UNICA para todas las expansiones.

---

## 0. Conclusion ejecutiva

**dLocal reemplaza TODAS las integraciones fragmentadas propuestas en los documentos por pais.** En vez de integrar Flow (CL) + Stripe (AR) + MercadoPago (MX/CO/PE) + PIX/EBANX (BR) + Kushki (EC) + dLocal (UY) — que serian 6 pasarelas distintas — **dLocal cubre los 8 paises con una sola API.**

Una empresa chilena (tuLector SpA) puede:
1. Integrar dLocal UNA vez
2. Activar Argentina, Brasil, Mexico, Colombia, Peru, Chile, Uruguay y Ecuador
3. Cobrar en moneda local en cada pais
4. Recibir liquidacion en USD en su cuenta bancaria chilena

---

## 1. Cobertura dLocal por pais

### Argentina
| Metodo | Que es |
|--------|--------|
| Rapipago / Pago Facil | Efectivo en 8,000+ puntos |
| MODO | Billetera de 35+ bancos |
| Tarjetas (Visa, MC, Naranja, Cabal, etc.) | Credito y debito locales |
| Transferencia bancaria | 12 bancos (Galicia, Santander, BBVA, etc.) |
| Pareto | Buy Now Pay Later |

### Brasil
| Metodo | Que es |
|--------|--------|
| **PIX** | Pago instantaneo, 200M+ usuarios, gratis |
| Boleto Bancario | Efectivo en bancos/lotericas |
| PicPay / MercadoPago / Nupay | Billeteras digitales |
| Tarjetas (Visa, MC, Elo, Hipercard) | Credito/debito |
| Pagaleve | BNPL |

### Mexico
| Metodo | Que es |
|--------|--------|
| **OXXO** | Efectivo en 20,000+ tiendas |
| SPEI | Transferencia bancaria 24/7 |
| Tarjetas (Visa, MC, Carnet) | Credito/debito |
| MercadoPago wallet | Saldo de billetera |
| Kueski / DiDi Paga Despues | BNPL |

### Colombia
| Metodo | Que es |
|--------|--------|
| **PSE** | Debito bancario de TODOS los bancos |
| **Nequi** | Billetera digital 18M usuarios |
| Efecty / Baloto | Efectivo en 20,000+ puntos |
| Tarjetas (Visa, MC, Diners, Codensa) | Credito/debito |
| Bre-B | Nuevo sistema de pagos tiempo real (2025+) |

### Peru
| Metodo | Que es |
|--------|--------|
| **Yape** | Billetera BCP, 20M+ usuarios |
| Pago Efectivo | Voucher de pago en efectivo |
| Tarjetas (Visa, MC, Diners) | Credito/debito |
| Transferencia bancaria | BCP y otros |

### Chile
| Metodo | Que es |
|--------|--------|
| WebPay / Transbank | Red adquirente nacional |
| Khipu | Transferencia bancaria directa |
| Servipag / Sencillito | Efectivo + pagos en linea |
| Tarjetas (Visa, MC, CMR, etc.) | Credito/debito |

> Nota: Chile ya usa Flow. dLocal puede ser backup o reemplazo. Flow es mas barato (2.9%) pero dLocal unifica todo.

### Uruguay
| Metodo | Que es |
|--------|--------|
| Abitab / Redpagos | Efectivo en red nacional |
| Tarjetas (Visa, MC, OCA, Lider) | Credito/debito |
| Transferencia bancaria | Todos los bancos |

### Ecuador
| Metodo | Que es |
|--------|--------|
| **Deuna** | Billetera digital QR |
| Pago Efectivo | Efectivo en puntos de pago |
| Tarjetas (Visa, MC, Diners) | Credito/debito |
| Transferencia bancaria | Payvalida |

---

## 2. Ventajas de dLocal para tuLector

### vs integraciones separadas

| Criterio | 6 pasarelas separadas | dLocal unico |
|----------|----------------------|-------------|
| Integraciones a mantener | 6 (Flow, Stripe, MP, PIX/EBANX, Kushki, dLocal-uy) | **1** |
| Codigo en `src/lib/` | 6 archivos (flow.ts, stripe.ts, mercadopago.ts, pix.ts, kushki.ts, dlocal.ts) | **1 archivo** (dlocal.ts) |
| Webhooks | 6 endpoints | **1 endpoint** |
| Conciliacion bancaria | 6 fuentes distintas | **1 dashboard** |
| Reporting financiero | Pesadilla multi-moneda | **1 reporte en USD** |
| Onboarding pais nuevo | 2-4 semanas por pasarela | **1-2 dias (toggle en dashboard)** |
| Comisiones | Negociar con 6 proveedores | **Negociar con 1** (mejor volumen = mejor tasa) |
| Compliance/KYC | 6 procesos | **1 proceso** |

### Modelo de liquidacion

```
Cliente paga en ARS/BRL/MXN/COP/PEN/CLP/UYU
        ↓
dLocal recibe en moneda local
        ↓
dLocal convierte a USD
        ↓
dLocal transfiere USD a cuenta chilena de tuLector SpA
```

- Sin necesidad de entidades legales en cada pais
- Sin cuentas bancarias en cada pais
- Sin riesgo cambiario (dLocal absorbe la conversion)
- dLocal es el "merchant of record" en cada pais

---

## 3. Desventajas y riesgos

| Riesgo | Mitigacion |
|--------|------------|
| **Comisiones mas altas** que integracion directa (dLocal cobra ~3.5-7% vs 2.9% de Flow o 1.8% de MP a 35 dias) | El ahorro en desarrollo y operaciones compensa. Negociar por volumen cuando crezca. |
| **Vendor lock-in** — dependes de un solo proveedor para 8 paises | Mantener Flow para Chile (ya funciona) como backup. Agregar Stripe como fallback global. |
| **dLocal es un PSP uruguayo** — riesgo pais Uruguay bajo, pero riesgo corporativo | Es empresa publica (NASDAQ: DLO). Auditada. $650M+ revenue en 2024. |
| **No soporta MercadoPago como metodo de pago en Argentina directamente** (MP es competidor) | dLocal soporta Rapipago + MODO + transferencias que cubren el 80% del mercado sin MP |

---

## 4. Impacto en el plan de implementacion

### Plan ORIGINAL (por pais)

| Pais | Pasarela original | Horas |
|------|-------------------|-------|
| Mexico | MercadoPago (ya integrado, desbloquear checkout) | 5h |
| Colombia | MercadoPago (idem) | 4h |
| Peru | Stripe USD → EBANX | 3h |
| Argentina | Stripe USD | 6-8h |
| Uruguay | MP Uruguay / dLocal | 6.5h |
| Brasil | PIX (dLocal/EBANX) | 10h+ |
| Ecuador | Kushki (nueva desde cero) | 16-20h |
| **TOTAL** | **6 pasarelas** | **50-56h** |

### Plan NUEVO (dLocal unificado)

| Fase | Que | Horas |
|------|-----|-------|
| 1 | Integrar dLocal SDK + API en `src/lib/dlocal.ts` | 8-12h |
| 2 | Crear checkout unificado multi-pais en `checkout/route.ts` | 3h |
| 3 | Webhook unificado en `webhook/dlocal/route.ts` | 2h |
| 4 | Agregar metodos de pago locales al checkout UI | 4h |
| 5 | Configurar paises en dashboard dLocal (toggle ON/OFF) | 1h por pais |
| **TOTAL** | **1 pasarela para 8 paises** | **17-21h** |

**Ahorro**: ~30 horas de desarrollo menos, y ~5 integraciones menos que mantener a perpetuidad.

---

## 5. Arquitectura propuesta

### Archivos a crear/modificar

```
src/lib/dlocal.ts              ← NUEVO: SDK dLocal (similar a flow.ts/mercadopago.ts)
src/app/api/billing/checkout/route.ts  ← MODIFICAR: router multi-pais via dLocal
src/app/api/billing/webhook/dlocal/route.ts ← NUEVO: unico webhook para 8 paises
src/lib/billing_catalog.ts     ← MODIFICAR: gateway "dlocal" para todos menos CL
.env.local                     ← MODIFICAR: DLOCAL_API_KEY, DLOCAL_SECRET_KEY
```

### Tipo de gateway

```typescript
export type BillingGateway = "flow" | "dlocal";

export function gatewayForCountry(country: BillingCountry): BillingGateway {
  if (country === "CL") return "flow";  // Chile sigue con Flow (mas barato)
  return "dlocal";                       // TODO el resto: AR, BR, MX, CO, PE, UY, EC
}
```

### Flujo de pago

```
1. Usuario en Argentina elige Plan Pro ($25 USD)
2. Checkout detecta country_code = "AR" → gateway = "dlocal"
3. dlocal.ts → POST /v1/payments → crea intencion de pago
4. dLocal devuelve URL de checkout o QR (segun metodo elegido)
5. Usuario paga con Rapipago/Pago Facil/tarjeta/MODO
6. dLocal envia webhook a /api/billing/webhook/dlocal
7. webhook marca orden como "paid" y aplica entitlement
8. dLocal liquida USD a cuenta chilena (T+2 a T+30 segun metodo)
```

### Checkout UI por pais

Cada pais muestra sus metodos locales automaticamente:

| Pais | Metodos visibles en checkout |
|------|------------------------------|
| Argentina | "Pagá en Rapipago/Pago Facil" + "Transferencia bancaria" + "Tarjeta (hasta 12 cuotas)" |
| Brasil | "PIX (instantaneo)" + "Boleto (vence en 3 dias)" + "Cartao de credito (ate 12x)" |
| Mexico | "Paga en OXXO" + "SPEI (transferencia)" + "Tarjeta (meses sin intereses)" |
| Colombia | "PSE (debito de tu banco)" + "Nequi" + "Efecty" + "Tarjeta" |
| Peru | "Yape" + "Pago Efectivo" + "Tarjeta" |
| Chile | "WebPay" (via Flow — mismo checkout actual) |
| Uruguay | "Abitab / RedPagos" + "Tarjeta" |
| Ecuador | "Deuna" + "Pago Efectivo" + "Tarjeta" |

---

## 6. Comisiones estimadas dLocal

| Metodo de pago | Comision aprox | Settlement |
|----------------|---------------|------------|
| Tarjetas de credito | 3.5-5% | T+2 |
| Tarjetas de debito | 2.5-4% | T+1 |
| PIX (Brasil) | 1-2% | Instantaneo |
| Boleto (Brasil) | 2-3% | T+2 |
| OXXO (Mexico) | 3-4% | T+1 |
| PSE (Colombia) | 2-3% | T+1 |
| Efectivo (todos) | 3-5% | T+1 a T+3 |
| Transferencia bancaria | 1.5-3% | T+1 |
| Billeteras (Yape, Nequi, Deuna) | 2-4% | T+1 |

> Las comisiones se negocian por volumen. Con $10K/mes inicial, esperar el rango alto. Con $100K+/mes, bajan al rango bajo.

---

## 7. Comparacion final: dLocal vs alternativas

| Gateway | Paises cubiertos | Integraciones | Settlement USD | Recurring | Mejor para |
|---------|-----------------|---------------|----------------|-----------|------------|
| **dLocal** | **AR, BR, MX, CO, PE, CL, UY, EC** | **1** | **Si** | Si | **tuLector (cobertura total LATAM en 1 sola integracion)** |
| EBANX | BR, MX, CO, PE, AR, CL | 1 | Si | Si | Similar a dLocal, mas fuerte en Brasil |
| MercadoPago | AR, BR, MX, CO, PE, CL, UY | 1 | No directo | Si | Solo si tenes entidad local en cada pais |
| Stripe | MX, BR (parcial) | 1 | Si | Si | Solo 2 paises LATAM |
| Kushki | EC, CO, PE, CL | 1 | Parcial | Si | Mejor si Ecuador es prioridad |
| Flow | CL | 1 | No | No | Solo Chile |

**dLocal y EBANX son los unicos que cubren los 8 paises con settlement en USD a entidad extranjera.** dLocal tiene la ventaja de ser uruguayo (misma region, misma zona horaria, mejor conocimiento del ecosistema educativo LATAM). EBANX es mas fuerte en Brasil especificamente (PIX + Boleto con mejor pricing).

---

## 8. Recomendacion

**Integrar dLocal como pasarela principal para los 7 paises nuevos + mantener Flow para Chile.**

1. **Chile**: Flow (ya funciona, mas barato, no migrar)
2. **Argentina, Brasil, Mexico, Colombia, Peru, Uruguay, Ecuador**: dLocal

Esto reduce el esfuerzo de **50-56 horas (6 pasarelas)** a **17-21 horas (1 pasarela nueva + modificacion de checkout existente)**.

El codigo de `mercadopago.ts` y `stripe.ts` se mantiene como respaldo pero se desprioriza su activacion para nuevos paises.

---

## 9. Estado post-implementacion (jul 2026)

- **Activos**: `src/lib/flow.ts` (Chile) y `src/lib/dlocal.ts` (resto de LatAm, incluye
  Mexico -- se mantuvo en `billing_catalog.ts` por las paginas SEO publicas que ya
  anuncian precios en MXN, aunque el onboarding de dashboard todavia no lo soporte via
  `country_profiles.ts`). Checkout (`api/billing/checkout/route.ts`) y webhook
  (`api/billing/webhook/dlocal/route.ts`) probados end-to-end en modo mock: orden queda
  `paid`, entitlement se aplica, webhook es idempotente.
- **Huerfano pero vivo (no eliminado)**: `src/lib/mercadopago.ts` y
  `api/billing/webhook/mercadopago/route.ts`, marcados `@deprecated` -- ningun checkout
  los invoca ya. Se conservan por si queda un webhook activo en el dashboard de
  MercadoPago apuntando a esa URL.
- **Eliminado**: `src/lib/stripe.ts` y `src/app/api/stripe/*` -- era 100% stub (nunca
  proceso un pago real, sin SDK instalado, sin referencias fuera de si mismo).
- **Credenciales dLocal**: aun no configuradas (`DLOCAL_X_LOGIN`/`DLOCAL_X_TRANS_KEY`/
  `DLOCAL_SECRET_KEY`) -- checkout/webhook funcionan hoy en modo mock local; falta el
  alta comercial + KYC con dLocal y cargar las credenciales de sandbox/produccion en
  Vercel para probar contra su API real.
