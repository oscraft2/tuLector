# Investigacion: Adaptacion de tuLector a Mexico

> Julio 2026. Mexico = 2do mercado mas grande LATAM (130M hab). EXANI-II, COMIPEMS y OXXO son claves.

---

## 0. Diagnostico: Mexico tiene TODO lo que tuLector necesita

| Factor | Chile | Mexico | Verdict |
|--------|-------|--------|---------|
| Examen nacional ingreso universidad | PAES (250K/ano) | **EXANI-II** (+1M/ano) | ✅ Mas grande |
| Examen ingreso prepa | No (no existe nivel) | **COMIPEMS** (300K/ano solo en CDMX) | ✅ Mercado unico |
| Multiple choice estandarizado | Si (A-E) | Si (A-C en EXANI, A-E en otros) | ✅ Compatible |
| Cultura de simulacros | Si (preuniversitarios PAES) | **Masiva** (5,000+ academias preuniversitarias) | ✅ Mas grande |
| Pagos locales | Flow/WebPay | **MercadoPago + OXXO** (efectivo) | ✅ MP ya integrado |
| Identificador unico | RUT | **CURP** (18 chars) | ✅ Ya en codigo |
| Locale | es-CL | **es-MX** (ya implementado!) | ✅ Listo |

**Conclusio**: Mexico ya tiene ~85% del codigo implementado. Lo unico que falta es desbloquear el checkout y agregar EXANI-II/COMIPEMS como sistemas de evaluacion. Es el pais mas cercano a "production-ready" despues de Chile.

---

## 1. Sistema educativo

### Niveles

| Nivel | Edad | Duracion |
|-------|------|----------|
| Preescolar | 3-5 | 3 anos |
| Primaria | 6-11 | 6 grados |
| Secundaria | 12-14 | 3 grados |
| Media Superior (Prepa/Bachillerato) | 15-17 | 2-3 anos |
| Superior (Licenciatura) | 18+ | 4-5 anos |

### Escala

Escala 0-100 (SEP). Aprobacion: 60. Ya implementado en `latam.ts` (scale 0-100, passing 60, exigencia 60%).

---

## 2. Pruebas mas usadas (las que generan ingresos)

### EXANI-II (CENEVAL) — +1,000,000 candidatos/ano

| Atributo | Dato |
|----------|------|
| Candidatos/ano | **+1,000,000** |
| Usado por | **300+ universidades** |
| Formato | **168 items, 3 opciones (A/B/C)**, 4.5 horas |
| Estructura | 2 modulos disciplinares (24 c/u) + Comprension Lectora (30) + Redaccion (30) + Matematico (30) + Ingles diagnostico (30) |
| Hoja de respuesta | **CENEVAL distribuye hojas OMR oficiales** para la version impresa |
| Simulacros | Academias preuniversitarias toman 8-20 simulacros por alumno |

**Impacto tuLector**: EXANI-II usa 3 OPCIONES (no 5 como Chile). La hoja actual de tuLector soporta 3 opciones via config. Solo falta el template pre-armado EXANI-II.

### COMIPEMS (CDMX) — +300,000 candidatos/ano

| Atributo | Dato |
|----------|------|
| Candidatos/ano | **~310,000** solo en area metropolitana CDMX |
| Que determina | A que prepa entra el alumno (UNAM, IPN, etc.) |
| Formato | 128 preguntas multiple choice |
| Areas | Verbal, Matematica, Naturales, Sociales |
| Simulacros | Cientos de "cursos COMIPEMS" en CDMX toman simulacros mensuales |

### Teacher exams (USICAMM) — +150,000/ano

Multiple choice. Nicho especifico pero con alto ticket: los maestros pagan capacitacion + simulacros.

---

## 3. Pagos — OXXO es el diferenciador

> ⚠️ **Actualizado Julio 2026**: La estrategia de pagos cambio a **dLocal** como pasarela unificada para todos los paises LATAM. Ver `docs/dlocal-pasarela-unificada.md`. Una sola integracion cubre este pais y los otros 7.

### Ecosistema

| Metodo | Penetracion | Para tuLector |
|--------|-------------|---------------|
| **OXXO Pay** | 20,000+ tiendas. **60% de mexicanos no estan bancarizados** | **CRITICO** — MercadoPago lo incluye via Checkout Pro |
| Tarjetas credito/debito | ~30% adultos | Importante. MSI (meses sin intereses) clave psicologica |
| SPEI | Transferencias 24/7 | MP lo soporta |
| CoDi | QR pagos | Menor adopcion |

### Precios MX

```typescript
MX: { pro: 490, school: 2490 } // MXN
// Pro ≈ $24 USD, School ≈ $122 USD
```

Muy competitivo. Una academia de 100 alumnos pagando MXN$2,490/ano = MXN$24.9/alumno/ano. Menos de lo que cobran por UN simulacro presencial tradicional.

---

## 4. Estado actual — Mexico es el mas avanzado despues de Chile

| Componente | Estado |
|------------|--------|
| `LATAM_COUNTRIES.MX` (0-100, passing 60, CURP) | ✅ Completo |
| `calculateGrade()` soporte MX | ✅ Completo |
| CURP regex validacion | ✅ Completo |
| Locale `es-MX` (243-357 lineas en messages.ts) | ✅ **Completo y extenso** |
| PLANEA en `EVALUATION_SYSTEMS` | ✅ Completo |
| PLANEA performance levels (4 tiers) | ✅ Completo |
| MX curriculum taxonomy | ✅ Completo |
| PLANEA CSV export | ✅ Completo |
| `billing_catalog.ts` precios MX (490/2490 MXN) | ✅ Completo |
| `gatewayForCountry("MX")` → `"mercadopago"` | ✅ Asignado pero bloqueado |
| Checkout desbloqueado | ✅ Cubierto por dLocal (ver `docs/dlocal-pasarela-unificada.md`) |
| EXANI-II system | ❌ No modelado |
| COMIPEMS system | ❌ No modelado |
| OXXO UX | ❌ No mencionado en UI |

---

## 5. Que hacer (orden de ejecucion)

### Prioridad MAXIMA

| # | Tarea | Archivo |
|---|-------|---------|
| 1 | ~~Desbloquear checkout para MX~~ → Pagos: cubierto por dLocal (ver `docs/dlocal-pasarela-unificada.md`). No se requiere integracion adicional por pais. | — |
| 2 | Agregar EXANI-II como sistema | `evaluation.ts` — EVALUATION_SYSTEMS + PERFORMANCE_LEVELS + taxonomia |
| 3 | Agregar COMIPEMS como sistema | `evaluation.ts` — mismo patron |
| 4 | Agregar perfil MX a `country_profiles.ts` si no existe | `country_profiles.ts` — CountryCode "MX" |
| 5 | Template hoja EXANI-II (168 items, 3 opciones A/B/C) | Sheet generator preset |
| 6 | Template hoja COMIPEMS (128 items, 4-5 opciones) | Sheet generator preset |

### Codigo para EXANI-II en evaluation.ts

```typescript
// EVALUATION_SYSTEMS:
{
  code: "EXANI_II", countryCode: "MX", name: "EXANI-II (CENEVAL)",
  description: "Examen Nacional de Ingreso a la Educacion Superior",
  gradeLevels: ["Egresados Media Superior"],
  subjects: ["Pensamiento Matematico", "Pensamiento Analitico", "Comprension Lectora", "Redaccion Indirecta", "Ingles", "Modulo Disciplinar"],
  scoreMin: 0, scoreMax: 100,
},

// PERFORMANCE_LEVELS:
"MX_EXANI_II": [
  { levelNumber: 1, levelName: "No Satisfactorio", minScore: 0, maxScore: 599, description: "Debajo del puntaje minimo esperado", colorHex: "#EF4444" },
  { levelNumber: 2, levelName: "Satisfactorio", minScore: 600, maxScore: 799, description: "Cumple con los conocimientos esperados", colorHex: "#F59E0B" },
  { levelNumber: 3, levelName: "Sobresaliente", minScore: 800, maxScore: 1000, description: "Supera ampliamente lo esperado", colorHex: "#22C55E" },
],
```

### Desbloquear checkout para MX (OBSOLETO — cubierto por dLocal)

> **Actualizado Julio 2026**: El gateway real sera `dlocal` (no MercadoPago como se especificaba en este doc pre-dLocal). Ver `docs/dlocal-pasarela-unificada.md`.

En `gatewayForCountry()` de `billing_catalog.ts`:

```typescript
export function gatewayForCountry(country: BillingCountry): BillingGateway {
  if (country === "CL") return "flow";
  if (country === "MX") return "dlocal"; // dLocal como pasarela unificada LATAM
  return "dlocal";
}
```

En `checkout/route.ts`, despues de `if (item.gateway === "stripe")`:

```typescript
} else if (item.gateway === "mercadopago") {
  const worldDetails = parseWorldBillingDetails(accountEmail, school.country_code ?? "MX");
  if (!worldDetails) return NextResponse.json({ error: "Correo invalido." }, { status: 422 });
  billingDetails = worldDetails as unknown as Record<string, unknown>;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const mpResult = await createMercadoPagoPreference({
    title: item.description,
    unitPrice: item.amount,
    currencyId: item.currency.toUpperCase(), // MXN
    externalReference: "", // se completa abajo
    notificationUrl: `${siteUrl}/api/billing/webhook/mercadopago`,
    backUrl: `${siteUrl}/dashboard/billing?order_id={ORDER_ID}`,
    schoolId: school.id,
  });
  redirectUrl = mpResult.url;
  sessionToken = mpResult.preferenceId;
```

### Agregar perfil MX a country_profiles.ts

```typescript
export type CountryCode = "CL" | "AR" | "BR" | "MX";

// En el array:
{
  code: "MX", enabled: true, flag: "🇲🇽",
  countryName: "Mexico", profileName: "Perfil Mexico",
  standardsLabel: "Estandar Mexico", locale: "es-MX",
  timezone: "America/Mexico_City",
  studentIdLabel: "CURP", studentIdExample: "ABCD123456HDFABC01",
  grading: { min: 0, max: 100, passing: 60, exigencia: 0.6, display: "Escala 0-100, aprobacion 60, exigencia 60%" },
  ministryFormat: "mx_planea",
  evaluationSystems: ["EXANI_II", "COMIPEMS", "PLANEA"],
  exportFormats: ["PLANEA", "CSV escolar", "Excel resultados"],
  onboardingHelper: "Mexico activado: CURP, escala 0-100, EXANI-II, COMIPEMS y PLANEA.",
  dashboardSummary: "Lector para escuelas y academias mexicanas: CURP, escala 0-100, simulacros EXANI-II/COMIPEMS.",
},
```

---

## 6. Estimacion

| Fase | Horas | Dependencias |
|------|-------|--------------|
| ~~Desbloquear checkout MX~~ | 0h | Cubierto por dLocal |
| Perfil MX + sistemas EXANI/COMIPEMS | 2h | Ninguna |
| Templates hoja EXANI-II y COMIPEMS | 1h | Ninguna |
| **Total** | **3h** | — |

**Nota**: Mexico es el pais mas rapido de habilitar. 85% del codigo ya existe. Los pagos son via dLocal (integracion unificada, sin configuracion por pais).
