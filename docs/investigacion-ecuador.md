# Investigacion: Adaptacion de tuLector a Ecuador

> Julio 2026. Ecuador = 18M hab, dolarizado (USD), preuniversitarios masivos. Sin MercadoPago ni Stripe.

---

## 0. Diagnostico: El desafio del pago (ni MP ni Stripe)

| Factor | Chile | Ecuador |
|--------|-------|---------|
| Poblacion | 19.5M | 18M |
| Moneda | CLP | **USD** (dolarizado desde 2000) — CERO riesgo cambiario |
| Examen nacional | PAES unificado | **Transformar** (SENESCYT) — digital, no OMR fisico |
| Prep | Preuniversitarios PAES | **Preuniversitarios Transformar + niveles de universidad** |
| Escala | 1.0-7.0 | **0-10**, aprobacion 7, exigencia 70% |
| Identificador | RUT | **Cedula** (10 digitos, modulo 10) |
| Pagos | Flow/WebPay | **dLocal** — Pasarela unificada LATAM. Ver `docs/dlocal-pasarela-unificada.md`. |
| Calendario escolar | Uno solo | **DOS** (Sierra-Antonio: Sep-Jun, Costa-Galapagos: Abr-Ene) |
| Codigo en tuLector | 100% | **~35%** — solo escala y labels cualitativos |

---

## 1. Sistema educativo

### Estructura

| Nivel | Edad | Duracion |
|-------|------|----------|
| Inicial | 0-5 | 3 anos |
| EGB (Basica General) | 6-14 | **10 grados** (mas larga que el promedio LATAM) |
| Bachillerato | 15-17 | 3 anos |
| Superior | 18+ | Variable |

### Escala 0-10

```typescript
// YA IMPLEMENTADO en latam.ts:56-62
EC: {
  code: "EC", name: "Ecuador",
  gradeScale: { min: 0, max: 10 },
  passingGrade: 7,
  exigencia: 0.70,     // 70% — mas alta que el promedio LATAM
  idType: "cedula",
  // ❌ FALTA idFormat — necesita validacion modulo 10 de cedula
},
```

### Labels cualitativos (YA IMPLEMENTADOS en getGradeConcept)

```typescript
case "EC":
  if (grade >= 9) return "Domina los aprendizajes (DA)";
  if (grade >= 7) return "Alcanza los aprendizajes (AA)";
  if (grade >= 5) return "Proximo a alcanzar (PA)";
  return "No alcanza los aprendizajes (NA)";
```

### DOS calendarios escolares (unico en LATAM)

| Region | Inicio | Fin | % estudiantes |
|--------|--------|-----|---------------|
| Sierra-Amazonia (Quito, Cuenca, Loja) | Septiembre | Junio-Julio | 60% |
| Costa-Galapagos (Guayaquil, Manta) | Abril-Mayo | Enero-Febrero | 40% |

**Impacto**: Dos ventanas de marketing/venta al ano. Los preuniversitarios operan todo el ano.

---

## 2. Pruebas mas usadas

### 2.1 Transformar (SENESCYT) — El "ENEM ecuatoriano"

| Atributo | Dato |
|----------|------|
| Que es | Examen de acceso a la educacion superior publica |
| Formato | **DIGITAL** (online en centros o en casa). NO usa hoja OMR fisica. |
| Escala | 0-1000 |
| Areas | Razonamiento Logico, Verbal, Numerico, Atencion |
| Candidatos/ano | ~150,000-200,000 |

**OJO**: El examen oficial es digital, PERO el ecosistema de **preuniversitarios** usa masivamente **simulacros en papel** con formato multiple choice. Los alumnos practican con hojas impresas que simulan el examen. Ahi entra tuLector.

### 2.2 Preuniversitarios — El cliente real

- **Cientos de academias**: Mendel, PreuH, Alpha Learning, PROFE JULIO, etc.
- **Simulacros semanales** con 100-500 alumnos cada uno
- **Nivelacion universitaria**: todas las universidades publicas requieren un semestre de nivelacion con examenes frecuentes
- Mercado combinado: ~200,000 estudiantes/ano ciclando por preu + nivelacion

### 2.3 SER Estudiante (INEVAL)

- Evaluacion nacional muestral en 4, 7, 10 EGB y 3 Bachillerato
- Multiple choice
- Equivalente al SIMCE chileno

### 2.4 Quiero Ser Maestro (Concurso Docente)

- 80,000-150,000 postulantes por ciclo
- Multiple choice: conocimientos pedagogicos + disciplina + aptitud
- Mercado de prep docente en crecimiento

---

## 3. Pagos — El gran desafio

> ⚠️ **Actualizado Julio 2026**: La estrategia de pagos cambio a **dLocal** como pasarela unificada para todos los paises LATAM. Ver `docs/dlocal-pasarela-unificada.md`. Una sola integracion cubre este pais y los otros 7.

### Ecuador ahora cubierto por dLocal

> **Actualizado Julio 2026**: Ecuador es uno de los paises cubiertos por **dLocal** como pasarela unificada LATAM (ver `docs/dlocal-pasarela-unificada.md`). Ya no se requiere integracion de Kushki por separado. dLocal soporta tarjetas (Visa, MC, Diners, PacifiCard), transferencias SPI y cuotas en Ecuador.

### Gateways disponibles

| Gateway | Tipo | Origen | Soporta |
|---------|------|--------|---------|
| **Kushki** | Adquirente full-stack | Ecuatoriano (Quito) | Tarjetas, transferencias SPI, QR, efectivo, POS. API REST. PCI Level 1. |
| **PlacetoPay** | Gateway multibanco | Colombiano con operacion EC | Tarjetas, transferencias, efectivo (Servipagos), PSE |
| **PayPhone** | Billetera QR | Ecuatoriano | QR, WhatsApp payments, P2P |
| **Deuna** | Billetera + e-commerce | Ecuatoriano | QR, payment links, checkout |

### Recomendacion: Kushki

- Fundada en Ecuador. Opera en todo LATAM.
- Soporta **tarjetas (Visa, MC, Diners, PacifiCard)** + **transferencias SPI** + **cuotas (diferido)**
- API moderna, SDK JS, web checkout (Kajita)
- **Liquida en USD** a cuenta bancaria ecuatoriana o internacional
- Puede procesar pagos recurrentes

### Tarjetas locales importantes

- **Diners Club Ecuador** — cuota de mercado inusualmente alta en Ecuador (~15-20% vs <1% en otros paises)
- **PacifiCard** (Banco del Pacifico)
- Visa y Mastercard universales

### Cultura de cuotas (diferido)

3, 6, 9, 12 meses con interes. Kushki y PlacetoPay lo soportan.

### Precios sugeridos

```typescript
EC: { pro: 25, school: 120 } // USD — igual que AR/PE/GLOBAL
// Dolarizacion = sin riesgo FX, sin inflacion que ajustar
```

Competitivo. Un preuniversitario de 200 alumnos pagando $120/ano = $0.60/alumno/ano.

---

## 4. Identificacion: Cedula (10 digitos, modulo 10)

```typescript
export function validateCedulaEC(cedula: string): boolean {
  const cleaned = cedula.replace(/[^\d]/g, "");
  if (cleaned.length !== 10) return false;

  const province = parseInt(cleaned.substring(0, 2));
  if (province < 1 || province > 24) return false; // 24 provincias

  const digits = cleaned.split("").map(Number);
  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let product = digits[i] * coefficients[i];
    if (product >= 10) product -= 9;
    sum += product;
  }

  const expected = (10 - (sum % 10)) % 10;
  return digits[9] === expected;
}
```

Agregar en `latam.ts`:
```typescript
idFormat: /^[0-9]{10}$/,
```

---

## 5. Estado actual en codigo

| Componente | Estado |
|------------|--------|
| `LATAM_COUNTRIES.EC` (0-10, passing 7, exigencia 70%) | ✅ |
| `getGradeConcept()` caso EC (DA/AA/PA/NA) | ✅ |
| `billing_catalog.ts` precios EC | ❌ |
| `billing_catalog.ts` gateway EC | ❌ (no existe "kushki" como tipo) |
| `country_profiles.ts` perfil EC | ❌ |
| `locales/es-EC.ts` | ❌ |
| `EVALUATION_SYSTEMS` Transformar / SER Estudiante | ❌ |
| Validacion cedula modulo 10 | ❌ |
| Template hoja Transformar | ❌ |

---

## 6. Que hacer

### Paso 1 — Agregar EC a billing_catalog.ts (actualizado para dLocal)

```typescript
// BillingCountry type:
export type BillingCountry = "CL" | "MX" | "BR" | "CO" | "AR" | "PE" | "EC" | "GLOBAL";

// BillingGateway type:
export type BillingGateway = "flow" | "mercadopago" | "stripe" | "dlocal";

// PLAN_PRICES:
EC: { pro: 25, school: 120 }, // USD

// CURRENCIES:
EC: "usd",

// gatewayForCountry:
if (country === "EC") return "dlocal"; // dLocal como pasarela unificada LATAM
```

### Paso 2 — Pagos: cubierto por dLocal

> **Actualizado Julio 2026**: Pagos: cubierto por dLocal (ver `docs/dlocal-pasarela-unificada.md`). No se requiere integracion adicional por pais. Ya no es necesario crear `kushki.ts` ni integrar Kushki por separado. dLocal maneja tarjetas, transferencias, cuotas y todos los metodos de pago ecuatorianos.

### Paso 3 — Perfil EC en country_profiles.ts

```typescript
export type CountryCode = "CL" | "AR" | "BR" | "MX" | "PE" | "UY" | "CO" | "EC";

{
  code: "EC", enabled: true, flag: "🇪🇨",
  countryName: "Ecuador", profileName: "Perfil Ecuador",
  standardsLabel: "Estandar Ecuador", locale: "es-EC",
  timezone: "America/Guayaquil",
  studentIdLabel: "Cedula", studentIdExample: "1712345678",
  grading: { min: 0, max: 10, passing: 7, exigencia: 0.70, display: "Escala 0-10, aprobacion 7, exigencia 70%" },
  ministryFormat: "ec_ineval",
  evaluationSystems: ["Transformar", "SER_Estudiante", "Quiero_Ser_Maestro"],
  exportFormats: ["INEVAL", "CSV escolar", "Excel resultados"],
  onboardingHelper: "Ecuador activado: Cedula, escala 0-10, aprobacion 7, preuniversitarios Transformar.",
  dashboardSummary: "Lector para colegios y preuniversitarios ecuatorianos: Cedula, escala 0-10, dolarizado (USD).",
},
```

### Paso 4 — Locale + i18n es-EC

Crear `src/locales/es-EC.ts`, agregar a `i18n/config.ts`.

### Paso 5 — Validacion cedula modulo 10

Crear `src/lib/cedula.ts` con la funcion `validateCedulaEC()`.

### Paso 6 — Sistemas de evaluacion en evaluation.ts

```typescript
// EVALUATION_SYSTEMS:
{
  code: "Transformar", countryCode: "EC", name: "Transformar (SENESCYT)",
  description: "Examen de Acceso a la Educacion Superior",
  gradeLevels: ["Egresados Bachillerato"],
  subjects: ["Razonamiento Logico", "Razonamiento Verbal", "Razonamiento Numerico", "Atencion y Concentracion"],
  scoreMin: 0, scoreMax: 1000,
},

// PERFORMANCE_LEVELS:
"EC_Transformar": [
  { levelNumber: 1, levelName: "Insuficiente (0-549)", minScore: 0, maxScore: 549, description: "No alcanza el puntaje minimo", colorHex: "#EF4444" },
  { levelNumber: 2, levelName: "Basico (550-699)", minScore: 550, maxScore: 699, description: "Puntaje regular", colorHex: "#F59E0B" },
  { levelNumber: 3, levelName: "Satisfactorio (700-849)", minScore: 700, maxScore: 849, description: "Buen desempeno", colorHex: "#3B82F6" },
  { levelNumber: 4, levelName: "Excelente (850-1000)", minScore: 850, maxScore: 1000, description: "Desempeno excepcional", colorHex: "#22C55E" },
],
```

---

## 7. Estimacion

| Fase | Horas | Dependencias |
|------|-------|--------------|
| Perfil EC + locale + i18n | 2h | Ninguna |
| Validacion cedula | 1h | Ninguna |
| Sistemas Transformar + SER | 1h | Ninguna |
| ~~Integracion Kushki~~ | 0h | Cubierto por dLocal |
| ~~Checkout route (gateway "kushki")~~ | 0h | dLocal unificado |
| Template hoja Transformar | 1h | Ninguna |
| **Total** | **5h** | — |

El 100% del esfuerzo de pagos para Ecuador ahora es 0h gracias a dLocal como pasarela unificada (ver `docs/dlocal-pasarela-unificada.md`). La dolarizacion hace que el retorno sea en USD puro, sin riesgo cambiario.

---

## 8. Resumen estrategico

Ecuador es un mercado de tamano medio (18M) con una **ventaja unica sobre todos los demas paises LATAM**: el dolar. Cero riesgo cambiario, revenue en USD, sin inflacion que ajustar. Los pagos se manejan via **dLocal** como pasarela unificada LATAM (ver `docs/dlocal-pasarela-unificada.md`), eliminando la necesidad de integrar Kushki por separado.

La oportunidad de mercado esta en los **preuniversitarios** (simulacros masivos de Transformar + nivelacion) y en **Quiero Ser Maestro** (concurso docente con +100K postulantes/ano). Ambos son clientes ideales de tuLector: alto volumen de simulacros, multiple choice, correccion manual lenta.
