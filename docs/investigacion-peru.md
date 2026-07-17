# Investigacion: Adaptacion de tuLector a Peru

> Julio 2026. Peru = academias preuniversitarias como mercado principal. Yape como pago.

---

## 0. Diagnostico: Academias preuniversitarias como cliente ideal

| Factor | Chile | Peru |
|--------|-------|------|
| Examen nacional ingreso universidad | PAES unificado | **NO existe** — cada universidad tiene su examen |
| Universidades con examenes masivos | — | **UNMSM** (70K postulantes), **UNI** (30K), **PUCP** (25K), **UNFV** (40K) |
| Cultura de academias pre | Si | **MASIVA** — cientos de academias en Lima, 2-4 simulacros/mes con 500-2000 alumnos |
| Escala | 1.0-7.0 | **0-20** |
| Identificador | RUT | **DNI** (8 digitos) |
| Pagos | Flow/WebPay | **Yape** (20M+ usuarios) + **Plin** |
| Locale | es-CL | ❌ No existe |

**Conclusio**: Peru NO tiene un "PAES peruano". El mercado esta en las **academias preuniversitarias** que toman simulacros masivos cada fin de semana. Hoy corrigen semi-manualmente con plantillas de acetato o ZipGrade. tuLector les ahorra horas de correccion.

---

## 1. Sistema educativo

| Nivel | Edad | Nota |
|-------|------|------|
| Inicial | 3-5 | Cualitativo |
| Primaria | 6-11 | AD/A/B/C (Logro destacado, esperado, en proceso, en inicio) |
| Secundaria | 12-16 | 0-20 (aprobacion 11) |
| Superior | 17+ | 0-20 (aprobacion 11-14 segun universidad) |

### Escala actual en codigo

```typescript
// latam.ts:48-55 — YA IMPLEMENTADO
PE: {
  code: "PE", name: "Peru",
  gradeScale: { min: 0, max: 20 },
  passingGrade: 11,
  exigencia: 0.55,
  idType: "dni",
  idFormat: /^[0-9]{8}$/,
},
```

### Labels cualitativos (MINEDU)

```typescript
// En getGradeConcept():
case "PE":
  if (grade >= 18) return "Logro destacado (AD)";
  if (grade >= 14) return "Logro esperado (A)";
  if (grade >= 11) return "En proceso (B)";
  return "En inicio (C)";
// YA IMPLEMENTADO en latam.ts:156-160
```

---

## 2. Pruebas mas usadas

### Examenes de admision universitarios (mercado PRINCIPAL)

| Universidad | Postulantes/ano | Formato | Preguntas |
|-------------|----------------|---------|-----------|
| **UNMSM** (San Marcos) | ~70,000 | Multiple choice, 2 fases | 100 preguntas (A-E) |
| **UNI** (Ingenieria) | ~30,000 | Multiple choice, 3 examenes (Mate, Fisica, Quimica + Aptitud) | 60-80 preg c/u |
| **UNFV** (Villarreal) | ~40,000 | Multiple choice | 100 preguntas |
| **UNAC** (Callao) | ~25,000 | Multiple choice | 100 preguntas |
| **PUCP** (Catolica) | ~25,000 | Multiple choice + entrevista | 60-80 preguntas |
| **UP** (Pacifico) | ~5,000 | Multiple choice | 60 preguntas |
| **USIL**, **UPC**, **ULIMA** | ~15-25K c/u | Multiple choice | 60-80 preguntas |

**Total**: +300K postulantes/ano en Lima metropolitana nomas. Cada uno toma 4-10 simulacros en su academia = 1.5-3M de hojas de simulacro/ano solo en Lima.

### Academias preuniversitarias — El cliente

- **Volumen**: Cientos de academias en Lima (Trilce, Pamer, Aduni, Cesar Vallejo, Saco Oliveros, etc.)
- **Simulacros**: 2-4 por mes, cada uno con 500-2,000 alumnos
- **Correccion actual**: Manual con plantilla (horas) o ZipGrade (app gringa, cara)
- **Ticket promedio**: S/200-500/mes por alumno en academia
- **Disposicion a pagar**: Alta. Una academia gasta S/500-1,000/mes en impresion + correccion de simulacros. tuLector School a $120/ano (~S/450) es mas barato que lo que ya gastan.

### Evaluaciones nacionales (MINEDU)

| Evaluacion | Niveles | Areas | Stakes |
|------------|---------|-------|--------|
| **ENLA** (antes ECE) | 2° y 4° Primaria, 2° Secundaria | Lectura, Matematica | Bajo para alumnos, medio para colegios |
| **Nombramiento Docente** | Maestros postulantes | Pedagogico + Especialidad | **ALTO** — define carrera docente, +200K postulantes/ano |

---

## 3. Pagos en Peru

> ⚠️ **Actualizado Julio 2026**: La estrategia de pagos cambio a **dLocal** como pasarela unificada para todos los paises LATAM. Ver `docs/dlocal-pasarela-unificada.md`. Una sola integracion cubre este pais y los otros 7.

### Yape (BCP) — El dominador

| Atributo | Dato |
|----------|------|
| Usuarios | 20M+ (Peru tiene 34M hab) |
| Comercios | 2M+ afiliados |
| Costo para negocio | 2.5-3.5% (varia por PSP) |
| Como funciona | QR o numero de celular |

### Plin (BBVA, Scotiabank, Interbank)

| Atributo | Dato |
|----------|------|
| Usuarios | 10M+ |
| Interoperabilidad | Desde 2023, Yape y Plin son interoperables |
| Costo | Similar a Yape |

### Otros metodos

| Metodo | Nota |
|--------|------|
| Tarjetas credito/debito | ~40% penetracion |
| PagoEfectivo | Voucher en efectivo (Bancos, Tiendas) |
| Niubiz (VisaNet) | Procesador de tarjetas dominante |
| MercadoPago Peru | Disponible pero menor adopcion que Yape |

### Ruta cross-border

**dLocal**: Pasarela unificada LATAM adoptada por tuLector. Soporta Yape, Plin, tarjetas, PagoEfectivo. Liquidan en USD. Ver `docs/dlocal-pasarela-unificada.md`.

**Precios Peru en codigo**: USD 25 Pro / USD 120 School. Correcto para el mercado.

---

## 4. Estado actual

| Componente | Estado |
|------------|--------|
| `LATAM_COUNTRIES.PE` (0-20, passing 11, DNI) | ✅ Completo |
| `calculateGrade()` + labels AD/A/B/C | ✅ Completo |
| DNI validacion regex (8 digitos) | ✅ Completo |
| `getGradeConcept()` caso PE | ✅ Completo |
| `billing_catalog.ts` precios PE (25/120 USD) | ✅ Completo |
| `gatewayForCountry("PE")` → `"mercadopago"` | ✅ Asignado pero reemplazado por `"dlocal"` (ver `docs/dlocal-pasarela-unificada.md`) |
| `country_profiles.ts` perfil PE | ❌ **NO EXISTE** |
| `locales/es-PE.ts` | ❌ **NO EXISTE** |
| `EVALUATION_SYSTEMS` peruanas | ❌ No modeladas |
| Checkout | ✅ Cubierto por dLocal |

---

## 5. Que hacer

### Paso 1 — Perfil PE en `country_profiles.ts`

```typescript
export type CountryCode = "CL" | "AR" | "BR" | "MX" | "PE";

{
  code: "PE", enabled: true, flag: "🇵🇪",
  countryName: "Peru", profileName: "Perfil Peru",
  standardsLabel: "Estandar Peru", locale: "es-PE",
  timezone: "America/Lima",
  studentIdLabel: "DNI", studentIdExample: "12345678",
  grading: { min: 0, max: 20, passing: 11, exigencia: 0.55, display: "Escala 0-20, aprobacion 11, exigencia 55%" },
  ministryFormat: "pe_minedu",
  evaluationSystems: ["Admision_UNMSM", "Admision_UNI", "ENLA", "Nombramiento_Docente"],
  exportFormats: ["MINEDU", "CSV academico", "Excel resultados"],
  onboardingHelper: "Peru activado: DNI, escala 0-20, simulacros de admision universitaria y evaluaciones MINEDU.",
  dashboardSummary: "Lector para academias preuniversitarias y colegios peruanos: DNI, escala 0-20, admision UNMSM/UNI.",
},
```

### Paso 2 — Locale es-PE

Crear `src/locales/es-PE.ts` con terminos peruanos. Similar a es-CL con ajustes: "Simulacro de admision", "Academia", etc.

### Paso 3 — Sistemas de evaluacion en `evaluation.ts`

```typescript
// EVALUATION_SYSTEMS:
{
  code: "UNMSM", countryCode: "PE", name: "Admision UNMSM",
  description: "Examen de Admision - Universidad Nacional Mayor de San Marcos",
  gradeLevels: ["Egresados Secundaria"],
  subjects: ["Habilidad Verbal", "Habilidad Logico-Matematica", "Conocimientos"],
  scoreMin: 0, scoreMax: 100,
},

// PERFORMANCE_LEVELS:
"PE_UNMSM": [
  { levelNumber: 1, levelName: "No alcanzo vacante", minScore: 0, maxScore: 40, description: "Puntaje insuficiente para ingreso", colorHex: "#EF4444" },
  { levelNumber: 2, levelName: "En competencia", minScore: 41, maxScore: 60, description: "Cerca del puntaje de corte", colorHex: "#F59E0B" },
  { levelNumber: 3, levelName: "Alcanzo vacante", minScore: 61, maxScore: 80, description: "Puntaje de ingreso estimado", colorHex: "#3B82F6" },
  { levelNumber: 4, levelName: "Tercio Superior", minScore: 81, maxScore: 100, description: "Excelencia academica", colorHex: "#22C55E" },
],
```

### Paso 4 — Pagos (cubierto por dLocal)

> **Actualizado Julio 2026**: Pagos: cubierto por dLocal (ver `docs/dlocal-pasarela-unificada.md`). No se requiere integracion adicional por pais. dLocal soporta Yape, Plin, tarjetas y PagoEfectivo en Peru.

---

## 6. Estimacion

| Fase | Horas |
|------|-------|
| Perfil PE + locale + sistemas | 3h |
| ~~Pagos~~ | 0h (cubierto por dLocal) |
| **Total** | **3h** |

Peru es uno de los paises mas rapidos de habilitar porque su escala 0-20 ya esta implementada completamente en `latam.ts`.
