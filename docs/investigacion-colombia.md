# Investigacion: Adaptacion de tuLector a Colombia

> Julio 2026. Colombia = 52M hab, ICFES Saber 11 (650K candidatos/ano), preICFES masivos. PSE + Nequi.

---

## 0. Diagnostico: PreICFES + PSE = oportunidad masiva

| Factor | Chile | Colombia |
|--------|-------|----------|
| Poblacion | 19.5M | 52M |
| Examen nacional masivo | PAES (250K/ano) | **Saber 11** (650K/ano) + Saber Pro (450K) + Saber TyT (250K) |
| Formato examen | Multiple choice A-E | **Multiple choice A-B-C-D** (4 opciones, no 5) |
| Hoja de respuesta | Burbujas OMR | **OMR ICFES azul/rosado** — identico concepto |
| Prep masivo | Preuniversitarios PAES | **PreICFES** — 200+ institutos, simulacros semanales |
| Escala | 1.0-7.0 | **0-100** (o 0.0-5.0 en universidad) |
| Identificador | RUT | **CC** (Cedula de Ciudadania), **TI** (Tarjeta de Identidad para menores) |
| Pagos | Flow/WebPay | **PSE** (debito bancario) + **Nequi** + **Efecty** |
| Codigo en tuLector | 100% | **~60%** — escala y sistemas ya existen, falta perfil + locale + checkout |

---

## 1. Sistema educativo

| Nivel | Edad | Grados |
|-------|------|--------|
| Preescolar | 5 | Transicion |
| Basica Primaria | 6-10 | 1° a 5° |
| Basica Secundaria | 11-14 | 6° a 9° |
| Media | 15-16 | 10° y 11° |
| Superior | 17+ | Pregrado y Posgrado |

### Escala y evaluacion

```typescript
// YA IMPLEMENTADO en latam.ts:41-47
CO: {
  code: "CO", name: "Colombia",
  gradeScale: { min: 0, max: 100 },
  passingGrade: 60,
  exigencia: 0.60,
  idType: "documento",
  // ❌ FALTA idFormat — necesita validacion numerica
},
```

- Escala 0-100 (oficial). Algunas universidades usan 0.0-5.0.
- **Aprobacion: 60/100**. Exigencia 60%.
- NOTA: Colombia delega la escala evaluativa a cada colegio via PEI (Decreto 1290/2009). La configuracion 0-100 cubre la mayoria.

---

## 2. Pruebas mas usadas

### 2.1 Saber 11 (ICFES) — EL GRANDE

| Atributo | Dato |
|----------|------|
| Candidatos/ano | **~650,000-700,000** (2024) |
| Formato | **254 preguntas, 4 opciones (A-B-C-D)**, 2 sesiones |
| Materias | Lectura Critica (41), Matematicas (50), Sociales (50), Naturales (58), Ingles (55) |
| Hoja de respuesta | **OMR fisica azul (sesion 1) y rosada (sesion 2)** |
| Escala | **0-500 por materia** y puntaje global (percentil 1-1000) |
| Stakes | **ALTISIMO** — define ingreso a universidad + becas |
| Prep | **200+ institutos preICFES** (Formarte, Milton Ochoa, Grupo Geard) tomando simulacros semanales con 500-2000 alumnos c/u |

**Oportunidad tuLector**: Cada preICFES toma facil 8-16 simulacros/ano. Con 200 institutos y 500 alumnos promedio c/u = 100,000 alumnos x 12 simulacros = **1.2M escaneos/ano potenciales**. Y 254 preguntas por hoja — maximo uso del plan School.

### 2.2 Saber Pro (Universitario) — 450K candidatos/ano

- Examen obligatorio para TODOS los universitarios de ultimo ano
- Multiple choice A-B-C-D, OMR
- Escala 0-300
- Las universidades preparan a sus estudiantes internamente

### 2.3 Concurso Docente CNSC — 250-400K por ciclo

- Examen multiple choice para ingreso y ascenso en el magisterio publico
- Prep masiva: cursos para concurso docente en todo el pais

### 2.4 Saber 3, 5, 9 — ~2.5M estudiantes combinados

- Evaluaciones censales diagnosticas
- Menor prep comercial pero volumen enorme

---

## 3. Pagos en Colombia

> ⚠️ **Actualizado Julio 2026**: La estrategia de pagos cambio a **dLocal** como pasarela unificada para todos los paises LATAM. Ver `docs/dlocal-pasarela-unificada.md`. Una sola integracion cubre este pais y los otros 7.

### PSE (Pagos Seguros en Linea) — El rey

| Atributo | Dato |
|----------|------|
| Tipo | Debito directo de cuenta bancaria via ACH |
| Cobertura | **Todos los bancos colombianos** |
| Uso | 40-50% de transacciones e-commerce |
| Comision | 2.99% + COP 800 por transaccion |
| En MP Colombia | ✅ Soportado |

### Nequi + Daviplata (billeteras digitales)

| Billetera | Usuarios | Banco |
|-----------|----------|-------|
| Nequi | 18M | Bancolombia |
| Daviplata | 16M | Davivienda |

Ambas soportadas via MercadoPago Colombia como metodo de pago adicional.

### Efecty / Baloto (efectivo)

- 20,000+ puntos de pago en efectivo a nivel nacional
- Critico para el segmento no bancarizado (~30%)
- MP Colombia lo soporta

### Tarjetas

- 25M tarjetas activas. Visa 60%, Mastercard 35%.
- **Cultura de cuotas**: 12/24/36 meses (con interes).
- MP soporta cuotas configurable.

### MercadoPago Colombia

✅ **Disponible y funcional**. Soporta PSE, Nequi, Daviplata, tarjetas, Efecty.
**Ya esta asignado como gateway para CO** en `billing_catalog.ts:62`. **Actualizado**: El gateway real es `"dlocal"` (ver `docs/dlocal-pasarela-unificada.md`).

### Precios actuales

```typescript
CO: { pro: 99000, school: 490000 } // COP
// Pro ≈ $24 USD, School ≈ $120 USD
```

Muy competitivo. Un preICFES grande paga facil COP $10M+/ano solo en papel + correccion manual.

---

## 4. Identificacion: CC y TI

- **CC** (Cedula de Ciudadania): 6-10 digitos numericos. Mayores de 18.
- **TI** (Tarjeta de Identidad): Similar formato. Menores de 7-17.
- **NIT**: 9 digitos + DV. Para facturacion institucional.

**Agregar en `latam.ts`:**
```typescript
idFormat: /^[0-9]{6,12}$/,
```

---

## 5. Estado actual en codigo

| Componente | Estado |
|------------|--------|
| `LATAM_COUNTRIES.CO` (0-100, passing 60) | ✅ |
| Saber en `EVALUATION_SYSTEMS` (escala 100-500) | ✅ |
| CO_Saber `PERFORMANCE_LEVELS` (4 tiers) | ✅ |
| CO `CURRICULUM_TAXONOMIES` (Lectura Critica + Matematicas) | ✅ |
| `billing_catalog.ts` precios COP | ✅ |
| `gatewayForCountry("CO")` → dlocal | ✅ dLocal como pasarela unificada LATAM |
| `country_profiles.ts` perfil CO | ❌ |
| `locales/es-CO.ts` | ❌ |
| `i18n/config.ts` + `messages.ts` es-CO | ❌ |
| idFormat regex | ❌ |
| Checkout | ✅ Cubierto por dLocal (ver `docs/dlocal-pasarela-unificada.md`) |

---

## 6. Que hacer

### Paso 1 — Perfil CO en `country_profiles.ts`

```typescript
export type CountryCode = "CL" | "AR" | "BR" | "MX" | "PE" | "UY" | "CO";

{
  code: "CO", enabled: true, flag: "🇨🇴",
  countryName: "Colombia", profileName: "Perfil Colombia",
  standardsLabel: "Estandar Colombia", locale: "es-CO",
  timezone: "America/Bogota",
  studentIdLabel: "CC / TI", studentIdExample: "1234567890",
  grading: { min: 0, max: 100, passing: 60, exigencia: 0.6, display: "Escala 0-100, aprobacion 60, exigencia 60%" },
  ministryFormat: "co_icfes",
  evaluationSystems: ["Saber", "Saber_Pro", "Concurso_Docente"],
  exportFormats: ["ICFES", "CSV escolar", "Excel resultados"],
  onboardingHelper: "Colombia activado: CC/TI, escala 0-100, simulacros Saber 11 y preICFES.",
  dashboardSummary: "Lector para colegios y preICFES colombianos: CC/TI, escala 0-100, ICFES Saber 11/Pro.",
},
```

### Paso 2 — Locale es-CO

Crear `src/locales/es-CO.ts`, `i18n` entries, y `PublicHeader` flags.

### Paso 3 — Saber Pro en evaluation.ts

```typescript
// EVALUATION_SYSTEMS:
{
  code: "Saber_Pro", countryCode: "CO", name: "Saber Pro",
  description: "Examen de Estado de Calidad de la Educacion Superior",
  gradeLevels: ["Ultimo ano Universitario"],
  subjects: ["Competencias Genericas", "Modulos Especificos"],
  scoreMin: 0, scoreMax: 300,
},
```

### Paso 4 — Checkout (cubierto por dLocal)

> **Actualizado Julio 2026**: El gateway real sera `dlocal` (no MercadoPago como se especificaba en este doc pre-dLocal). Pagos: cubierto por dLocal (ver `docs/dlocal-pasarela-unificada.md`). No se requiere integracion adicional por pais. El mismo checkout multi-gateway funciona con `gateway = "dlocal"`.

### Paso 5 — idFormat CC/TI

```typescript
idFormat: /^[0-9]{6,12}$/, // en latam.ts CO
```

### Paso 6 — Hoja template Saber 11

- 254 preguntas, 4 opciones (A-B-C-D)
- 2 columnas
- Titulo: "Simulacro Saber 11"

---

## 7. Estimacion

| Fase | Horas | Dependencias |
|------|-------|--------------|
| Perfil CO + locale + sistemas | 3h | Ninguna |
| ~~Checkout desbloqueado~~ | 0h | Cubierto por dLocal |
| Template Saber 11 | 1h | Ninguna |
| **Total** | **4h** | — |

Colombia es uno de los paises mas rapidos de habilitar: ~60% del codigo ya existe, los pagos son via dLocal (integracion unificada), y el mercado (preICFES) es identico al chileno en dinamica (simulacros masivos, OMR, multiple choice).
