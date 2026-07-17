# Investigacion: Adaptacion de tuLector a Uruguay

> Julio 2026. Uruguay = mercado pequeno (3.5M) pero de MUY bajo esfuerzo. Ideal como "quick win" regional.

---

## 0. Diagnostico: El mercado mas facil de habilitar

| Factor | Chile | Uruguay |
|--------|-------|---------|
| Poblacion | 19.5M | 3.5M |
| Escala | 1.0-7.0 | **1-12** |
| Examen ingreso univ. | PAES | **Ingreso libre** (UDELAR no tiene examen de entrada) |
| Evaluacion nacional | SIMCE/DIA | **Aristas** (INEEd) |
| Identificador | RUT | **CI** (Cedula — 8 digitos + digito verificador) |
| Pagos | Flow/WebPay | **MercadoPago Uruguay** (misma API que Chile) |
| Afinidad cultural | — | **Altisima** (MERCOSUR, rioplatense) |
| Friccion cross-border | — | **Minima** (Uruguay sin control de cambios) |

---

## 1. Sistema educativo

### Niveles

| Nivel | Edad | Duracion |
|-------|------|----------|
| Inicial | 3-5 | 3 anos |
| Primaria | 6-11 | 6 grados |
| Secundaria Basica | 12-14 | 3 anos |
| Secundaria Superior (Bachillerato) | 15-17 | 3 anos |
| Terciaria / Universidad | 18+ | Variable |

### Escala 1-12

| Nota | Concepto |
|------|----------|
| 11-12 | Sobresaliente |
| 9-10 | Muy Bueno |
| 7-8 | Bueno |
| 6 | **Aprobado** (minimo) |
| 1-5 | Insuficiente |

### Organismo rector

**ANEP** (Administracion Nacional de Educacion Publica). Todo el sistema publico K-12 unificado. Muy centralizado comparado con Argentina o Brasil.

---

## 2. Pruebas nacionales

### Aristas (INEEd)

| Atributo | Dato |
|----------|------|
| Organismo | INEEd (Instituto Nacional de Evaluacion Educativa) |
| Frecuencia | Cada 3-4 anos |
| Niveles | 3°, 6° Primaria, 3° Secundaria Basica |
| Areas | Lectura, Matematica, Ciencias |
| Formato | Multiple choice |
| Stakes | Diagnostico (bajo para alumnos, medio para colegios) |
| Prep | Poca — no hay cultura de "preparar para Aristas" |

### Ingreso a UDELAR

- **NO HAY EXAMEN DE INGRESO**. Ingreso libre.
- 140K+ estudiantes activos. El "filtro" es el primer ano con altas tasas de desercion, no un examen previo.
- **No existe mercado de preuniversitarios** en Uruguay como en Chile o Peru.

### Universidades privadas (ORT, UCU, UM, UDE)

- Evaluaciones de ingreso no competitivas (entrevistas, diagnosticos).
- Tampoco generan mercado de simulacros.

### Concursos docentes

- Examenes de oposicion para ingreso a la docencia publica.
- Multiple choice en muchos casos.
- Nicho pequeno pero existente.

---

## 3. Pagos

> ⚠️ **Actualizado Julio 2026**: La estrategia de pagos cambio a **dLocal** como pasarela unificada para todos los paises LATAM. Ver `docs/dlocal-pasarela-unificada.md`. Una sola integracion cubre este pais y los otros 7.

### MercadoPago Uruguay

| Atributo | Dato |
|----------|------|
| API | **Identica a MercadoPago Chile** |
| Comisiones | 3-5% segun plan |
| Tarjetas | Si |
| Efectivo | Abitab y RedPagos (redes de cobranza) |
| Suscripciones | Si |

### dLocal — Pasarela unificada LATAM (adoptada por tuLector)

**dLocal es una empresa uruguaya.** Especializada en procesar pagos LATAM para empresas extranjeras. Adoptada por tuLector como pasarela unificada para todos los paises LATAM. Procesa pagos en Uruguay y liquida en USD a Chile sin necesidad de entidad local. Ver `docs/dlocal-pasarela-unificada.md`.

### Facilidad cross-border

Uruguay NO tiene control de cambios. El peso uruguayo es libre y convertible. Un chileno puede facturar en UYU o USD sin restricciones cambiarias. MERCOSUR facilita el comercio de servicios.

---

## 4. Identificacion: CI (Cedula de Identidad)

Formato: `X.XXX.XXX-Y` (8 digitos + digito verificador).

Algoritmo modulo 10:

```typescript
export function validateCI(ci: string): boolean {
  const cleaned = ci.replace(/[^\d]/g, "");
  if (cleaned.length !== 8) return false;
  const digits = cleaned.split("").map(Number);
  // Algoritmo modulo 10 con multiplicadores 2,9,8,7,6,3,4,1
  const multipliers = [2, 9, 8, 7, 6, 3, 4, 1];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += digits[i] * multipliers[i];
  const expected = (10 - (sum % 10)) % 10;
  return digits[7] === expected;
}
```

**Impacto tuLector**: Agregar `UY` a `LATAM_COUNTRIES` con `idType: "ci"` y `idFormat: /^[0-9]\.?[0-9]{3}\.?[0-9]{3}-?[0-9]$/`.

---

## 5. Estado actual

Uruguay **NO EXISTE** en el codigo. Hay que agregarlo desde cero.

| Componente | Estado |
|------------|--------|
| `LATAM_COUNTRIES.UY` | ❌ No existe |
| `country_profiles.ts` perfil UY | ❌ No existe |
| `locales/es-UY.ts` | ❌ No existe |
| `billing_catalog.ts` precios UY | ❌ No existe |
| `EVALUATION_SYSTEMS` Aristas | ❌ No existe |
| Validacion CI | ❌ No existe |
| Calculo escala 1-12 | ❌ No existe |

---

## 6. Que hacer

### Paso 1 — Agregar UY a latam.ts

```typescript
UY: {
  code: "UY", name: "Uruguay",
  gradeScale: { min: 1, max: 12 },
  passingGrade: 6,
  exigencia: 0.50, // 50% de exigencia
  idType: "ci",
  idFormat: /^[0-9]\.?[0-9]{3}\.?[0-9]{3}-?[0-9]$/,
},
```

### Paso 2 — Calculo de nota escala 1-12

En `calculateGrade()`:

```typescript
} else if (countryCode === "UY") {
  // Escala directa: nota = 1 + (pct * (12-1)) = 1 + (pct * 11)
  grade = 1 + pct * 11;
  grade = Math.max(1, Math.min(12, grade));
  const rounded = Math.round(grade);
  const passing = pct >= 0.50;
  if (rounded >= 11) label = "Sobresaliente";
  else if (rounded >= 9) label = "Muy Bueno";
  else if (rounded >= 7) label = "Bueno";
  else if (rounded >= 6) label = "Aprobado";
  else label = "Insuficiente";
  return { grade: rounded, passing, percentage: Math.round(pct * 1000) / 10, label };
```

### Paso 3 — Perfil UY en country_profiles.ts

```typescript
export type CountryCode = "CL" | "AR" | "BR" | "MX" | "PE" | "UY";

{
  code: "UY", enabled: true, flag: "🇺🇾",
  countryName: "Uruguay", profileName: "Perfil Uruguay",
  standardsLabel: "Estandar Uruguay", locale: "es-UY",
  timezone: "America/Montevideo",
  studentIdLabel: "CI", studentIdExample: "1.234.567-8",
  grading: { min: 1, max: 12, passing: 6, exigencia: 0.5, display: "Escala 1-12, aprobacion 6, exigencia 50%" },
  ministryFormat: "uy_anep",
  evaluationSystems: ["Aristas"],
  exportFormats: ["Aristas", "CSV escolar", "Excel resultados"],
  onboardingHelper: "Uruguay activado: CI, escala 1-12, evaluaciones Aristas.",
  dashboardSummary: "Lector para colegios uruguayos: CI, escala 1-12, Aristas.",
},
```

### Paso 4 — Precios UY en billing_catalog.ts

```typescript
UY: { pro: 25, school: 120 }, // USD
// o UYU: { pro: 1000, school: 5000 } en pesos uruguayos
```

### Paso 5 — Validacion CI

Crear `src/lib/ci.ts` con funcion `validateCI()` (algoritmo modulo 10).

---

## 7. Estimacion y viability

| Fase | Horas | Notas |
|------|-------|-------|
| Perfil UY + locale + validacion CI | 3h | Desde cero |
| Evaluacion Aristas en evaluation.ts | 1h | |
| Calculo escala 1-12 | 30 min | |
| ~~Pagos (MP Uruguay o dLocal)~~ | 0h | Cubierto por dLocal (ver `docs/dlocal-pasarela-unificada.md`). No se requiere integracion adicional por pais. |
| **Total** | **4.5h** | — |

### Vale la pena?

- **TAM**: ~800-1,000 colegios alcanzables. ~(USD $96K-120K/ano de revenue potencial).
- **Esfuerzo**: 4.5 horas de desarrollo.
- **ROI**: Altisimo. Mismo codigo, mismo idioma, misma pasarela (dLocal unificado). Sin friccion regulatoria.
- **Estrategia**: No como mercado principal, sino como **quick win** regional. "Ya que estamos en LATAM, activemos Uruguay que cuesta casi nada."
