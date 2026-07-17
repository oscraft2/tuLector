# Investigacion: Adaptacion de tuLector a Brasil

> Documento de investigacion, pagos y plan de ejecucion. Julio 2026.
> Brasil = mercado objetivo PRINCIPAL despues de Chile. 216M habitantes vs 19M.

---

## 0. Diagnostico estrategico: Por que Brasil es el mercado prioritario

### Chile vs Brasil — tamano del mercado

| Indicador | Chile | Brasil | Multiplicador |
|-----------|-------|--------|---------------|
| Poblacion | 19.5M | 216M | **11x** |
| Estudiantes K-12 | 3.6M | 47M | **13x** |
| Ingresantes universidad/ano | ~250K (PAES) | ~8M (ENEM+cada vestibular) | **32x** |
| Cursinhos pre-vestibular | Nicho | Industria masiva ($2B+ BRL) | **50x+** |
| Escaneos potenciales/ano | ~2M (Chile actual) | ~100M+ (ENEM + vestibulares + concursos) | **50x+** |

### El "golden fit" tuLector ↔ Brasil

Brasil tiene el ecosistema perfecto para tuLector:

1. **ENEM**: 4-5 MILLONES de candidatos/ano. 180 preguntas multiple choice (A-E). El examen mas grande de America Latina. **Cada "cursinho" aplica 10+ simulados ENEM por ano a sus alumnos.**
2. **ENEM usa hoja de respuesta OMR oficial**: identica en concepto a la de tuLector. Burbujas A-B-C-D-E, ID del candidato.
3. **Brasil tiene cultura de "simulados" masiva**: cientos de miles de "cursinhos pre-vestibular" que viven de corregir examenes de practica.
4. **PIX**: pagos instantaneos, gratis, 93% de adultos lo usa.

### Estrategia de entrada

| Canal | Prioridad | Por que |
|-------|-----------|---------|
| **Cursinhos ENEM** (Sao Paulo, Rio, BH, etc.) | **ALTA** | Cada uno toma 10+ simulados/ano con 50-500 alumnos c/u. Pagan. |
| **Colegios de Elite** (particular, Ensino Medio) | **ALTA** | Preparan alumnos para ENEM y vestibulares especificos. Tienen presupuesto. |
| **Concursos Publicos** | MEDIA | Masivo (12M candidatos/ano en Brasil), multiple choice, pero muy atomizado |
| **Universidades (correccion de pruebas internas)** | MEDIA | Profesores universitarios corrigiendo parciales a mano |
| **Colegios publicos (SAEB/Prova Brasil)** | BAJA | Sin presupuesto, gobierno ya tiene su propio sistema de correccion |

---

## 1. Sistema educativo brasileno

### Estructura (LDB - Lei de Diretrizes e Bases)

| Nivel | Nombre | Edad | Duracion |
|-------|--------|------|----------|
| Educacao Infantil | Creche + Pre-escola | 0-5 | 5 anos |
| Ensino Fundamental I | 1 ao 5 ano | 6-10 | 5 anos |
| Ensino Fundamental II | 6 ao 9 ano | 11-14 | 4 anos |
| Ensino Medio | 1 ao 3 ano | 15-17 | 3 anos |
| Ensino Superior | Graduacao | 18+ | 4-6 anos |

### Escala de calificacion

| Parametro | Valor |
|-----------|-------|
| Escala | 0 a 10 |
| Aprovacao | 6.0 (60%) |
| Exigencia | 60% |
| Tipo de calculo | **LINEAL** (nota = acertos/total * 10). NO usa formula chilena de exigencia. |

**Diferencia CLAVE con Chile**: En Brasil el calculo es `nota = (acertos / total) * 10`. No hay "exigencia" que comprima la escala. Si acertaste 80%, tu nota es 8.0. Si acertaste 40%, tu nota es 4.0. Directo y lineal.

```typescript
// En calculateGrade() de latam.ts, agregar:
if (countryCode === "BR") {
  const linear = (rawScore / totalQuestions) * 10;
  grade = Math.max(0, Math.min(10, linear));
}
```

### Calendario escolar

- Ano lectivo: Febrero a Diciembre
- Receso: Julio (2-3 semanas)
- ENEM: Noviembre (principal), reaplicacao en Diciembre
- Vestibulares: Noviembre a Enero

---

## 2. Pruebas mas usadas en Brasil

### 2.1 ENEM (Exame Nacional do Ensino Medio) — EL GRANDE

| Atributo | Dato |
|----------|------|
| Candidatos/ano | **4-5 millones** |
| Formato | **180 preguntas multiple choice (A-E)** + redacao (ensayo) |
| Division | Dia 1: 90 preguntas (Linguagens + Ciencias Humanas + Redacao). Dia 2: 90 preguntas (Matematica + Ciencias da Natureza) |
| Escala | IRT (Teoria de Resposta ao Item). Puntaje 0-1000 por area, NO es % de aciertos |
| Uso | Ingreso a universidades via SISU, PROUNI, FIES |
| Hoja de respuesta | **OMR oficial con burbujas A-B-C-D-E, identica en concepto a tuLector** |
| Prep masiva | **Cientos de miles de "cursinhos" toman 10+ simulados ENEM al ano** |

**Oportunidad tuLector**: Un cursinho con 200 alunos tomando 12 simulados ENEM = 2,400 escaneos/ano. Con 500 cursihnos en Sao Paulo nomas = 1.2M escaneos/ano. Y cada hoja ENEM tiene 180 preguntas con 5 opciones — tuLector ya lo soporta.

### 2.2 Vestibulares (por universidad)

| Universidad | Examen | Candidatos/ano | Formato |
|-------------|--------|---------------|---------|
| **USP** | FUVEST | ~130K | 90 preguntas MC (1 fase) + discursiva (2 fase) |
| **UNICAMP** | Comvest | ~70K | 72 preguntas MC (1 fase) + discursiva |
| **UNESP** | VUNESP | ~100K | 90 preguntas MC |
| **UFMG** | Vestibular UFMG | ~60K | MC + discursiva |
| **UFRJ** | Vestibular UFRJ | ~50K | MC + discursiva |
| **UNB** | Vestibular UnB | ~40K | MC + discursiva |

Muchas universidades federales estan migrando a usar solo ENEM via SISU, pero las grandes (USP, UNICAMP, UNESP) mantienen sus propios vestibulares.

### 2.3 SAEB / Prova Brasil (diagnostico nacional)

- **SAEB**: Sistema de Avaliacao da Educacao Basica. Diagnostico censal cada 2 anos.
- **Niveles**: 5 e 9 ano EF, 3 ano EM
- **Areas**: Lingua Portuguesa, Matematica
- **Stakes**: BAJO para alumnos, MEDIO para colegios (indice IDEB)
- **Prep**: Algunos colegios particulares preparan, pero menor que ENEM.

### 2.4 Concursos Publicos

- **Volumen**: ~12 millones de candidatos/ano en todas las esferas (federal, estatal, municipal)
- **Formato**: Casi todos multiple choice
- **Oportunidad tuLector**: Los "cursinhos preparatorios para concurso" toman simulados masivos. Nicho enorme.

### 2.5 OAB (Ordem dos Advogados do Brasil)

- **Volumen**: ~200K candidatos/examen (2 fases al ano)
- **Formato**: 1 fase con 80 preguntas multiple choice (A-D)
- **Prep**: Cursinhos de OAB usan simulados. Nicho de alto valor.

---

## 3. Sistema de identificacion: CPF

- **CPF**: Cadastro de Pessoas Fisicas. `XXX.XXX.XXX-XX` (11 digitos, con digito verificador modulo 11).
- **Universal**: Todo brasileno tiene CPF desde el nacimiento. Usado en escuelas, universidades, ENEM.
- **Validacion**: Algoritmo modulo 11 (diferente al RUT chileno).
- **Impacto en tuLector**: Agregar validacion de CPF en `latam.ts`.

```typescript
export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/[^\d]/g, "");
  if (cleaned.length !== 11 || /^(\d)\1{10}$/.test(cleaned)) return false;
  // Validacion modulo 11
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (parseInt(cleaned[9]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return parseInt(cleaned[10]) === d2;
}
```

---

## 4. Metodos de pago en Brasil

> ⚠️ **Actualizado Julio 2026**: La estrategia de pagos cambio a **dLocal** como pasarela unificada para todos los paises LATAM. Ver `docs/dlocal-pasarela-unificada.md`. Una sola integracion cubre este pais y los otros 7.

### 4.1 PIX — El rey absoluto

| Atributo | Dato |
|----------|------|
| Usuarios | 200M+ (93% de adultos) |
| Transacciones/mes | 4B+ |
| Costo para comercio | 0.33% (via PSP) a 0.99% |
| Gratis para persona fisica | Si |
| Instantaneo | 24/7 |
| Como funciona | QR code o "Pix Copia e Cola" (string que el usuario pega en su app bancaria) |

**Para tuLector**: PIX es el metodo de pago OBLIGATORIO en Brasil. Sin PIX, no entras. Un PSP cross-border como dLocal o EBANX puede exponer PIX a tuLector sin necesidad de cuenta bancaria brasilena.

### 4.2 Boleto Bancario

- Generas un PDF con codigo de barras. El usuario paga en cualquier banco, loterica o app.
- Tarda 1-3 dias en compensar.
- Comision: 1.5-3%.
- Aun usado, especialmente por usuarios sem conta bancaria (minoria declinante).

### 4.3 Tarjetas de credito/debito

- Parcelado: cultura fuertisima. "Parcele em ate 12x sem juros".
- Comision: 3-5% para el comercio.
- Bandera local: Elo (ademas de Visa/Mastercard).

### 4.4 Gateways disponibles

| Gateway | PIX | Boleto | Tarjetas | Cross-border? |
|---------|-----|--------|----------|---------------|
| **dLocal** (uruguayo) | Si | Si | Si | **SI** — Pasarela unificada LATAM adoptada por tuLector. Ver `docs/dlocal-pasarela-unificada.md`. |
| **EBANX** (brasileno) | Si | Si | Si | **SI** — Alternativa evaluada, dLocal elegido |
| **Stripe Brasil** | Si (via checkout) | Si | Si | Medio — requiere entidad |
| **MercadoPago Brasil** | Si | Si | Si | **NO cross-border** — requiere CNPJ local |

**Recomendacion**: **dLocal** como gateway unificado cross-border para todos los paises LATAM. Soporta PIX, boleto, tarjetas, y liquida en USD al exterior.

### 4.5 Precios actuales en tuLector

```typescript
// billing_catalog.ts ya tiene:
BR: { pro: 149, school: 749 } // BRL
// Pro ≈ $25 USD, School ≈ $125 USD
```

Precios competitivos. El cursinho promedio en SP cobra R$200-500/mes por alumno. R$749/ano por plan School (escaneos ilimitados) se paga solo con evitarl 2h de correccion manual por semana.

---

## 5. Estado actual en tuLector para Brasil

### Lo que YA existe

| Componente | Estado |
|------------|--------|
| `LATAM_COUNTRIES.BR` | ❌ **NO EXISTE** — Brasil no esta en `latam.ts` |
| `billing_catalog.ts` precios BR (R$149/R$749) | ✅ Existe |
| `gatewayForCountry("BR")` → mercadopago | ✅ Existe pero bloqueado |
| `country_profiles.ts` perfil BR | ❌ **NO EXISTE** |
| `locales/pt-BR.ts` | ✅ **YA EXISTE** (portugues brasileno) |
| `PERFORMANCE_LEVELS` BR | ❌ **NO EXISTE** |
| `CURRICULUM_TAXONOMIES` BR | ❌ **NO EXISTE** |
| `EVALUATION_SYSTEMS` ENEM | ❌ **NO EXISTE** |
| Validacion CPF | ❌ **NO EXISTE** |

### Lo que FALTA

| Componente | Prioridad |
|------------|-----------|
| Agregar `BR` a `LATAM_COUNTRIES` | **CRITICA** |
| Agregar `BR` a `CountryCode` y `countryProfiles` | **CRITICA** |
| Agregar `ENEM` y `SAEB` a `EVALUATION_SYSTEMS` | **CRITICA** |
| Agregar performance levels y taxonomia BR | **ALTA** |
| Calculo de nota LINEAL para BR (no exigencia chilena) | **CRITICA** |
| Validacion CPF | **ALTA** |
| Pasarela PIX funcional (dLocal/EBANX) | **CRITICA** |
| Hoja template ENEM (180 preg, A-E, 2 columnas) | **ALTA** |
| Labels cualitativos BR (pt-BR) | ALTA |
| ENEM score simulation (IRT → percentil) | MEDIA |

---

## 6. Plan de ejecucion

### Paso 1 — Agregar BR a `LATAM_COUNTRIES` en `latam.ts`

```typescript
BR: {
  code: "BR", name: "Brasil",
  gradeScale: { min: 0, max: 10 },
  passingGrade: 6.0,
  exigencia: 0.60, // aunque BR usa calculo lineal, mantener para compatibilidad
  idType: "cpf",
  idFormat: /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/,
},
```

### Paso 2 — Calculo de nota LINEAL en `calculateGrade()` y `getGradeConcept()`

Agregar antes del `else` final en `calculateGrade()`:

```typescript
} else if (countryCode === "BR") {
  grade = (rawScore / totalQuestions) * 10;
  grade = Math.max(0, Math.min(10, grade));
  const rounded = Math.round(grade * 10) / 10;
  const passing = pct >= 0.60;
  if (rounded >= 9) label = "Excelente";
  else if (rounded >= 7) label = "Bom";
  else if (rounded >= 6) label = "Regular";
  else if (rounded >= 4) label = "Insuficiente";
  else label = "Deficiente";
  return { grade: rounded, passing, percentage: Math.round(pct * 1000) / 10, label };
```

Y en `getGradeConcept()`:

```typescript
case "BR":
  if (grade >= 9) return "Excelente (MB)";
  if (grade >= 7) return "Bom (B)";
  if (grade >= 6) return "Regular (R)";
  if (grade >= 4) return "Insuficiente (I)";
  return "Deficiente (D)";
```

### Paso 3 — Agregar perfil BR en `country_profiles.ts`

```typescript
export type CountryCode = "CL" | "AR" | "BR";
// Agregar en el array:
{
  code: "BR",
  enabled: true,
  flag: "🇧🇷",
  countryName: "Brasil",
  profileName: "Perfil Brasil",
  standardsLabel: "Padrao Brasil",
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
  studentIdLabel: "CPF",
  studentIdExample: "123.456.789-00",
  grading: { min: 0, max: 10, passing: 6, exigencia: 0.6, display: "Escala 0-10, aprovacao 6.0, calculo linear" },
  ministryFormat: "br_enem",
  evaluationSystems: ["ENEM", "SAEB"],
  exportFormats: ["ENEM", "CSV escolar", "Excel resultados"],
  onboardingHelper: "Brasil ativado: CPF, escala 0-10, calculo linear, simulados ENEM e vestibulares.",
  dashboardSummary: "Leitor e relatorios para escolas e cursinhos brasileiros: CPF, escala 0-10, ENEM, vestibulares e exportacao.",
},
```

### Paso 4 — Agregar sistemas de evaluacion en `evaluation.ts`

```typescript
// En EVALUATION_SYSTEMS:
{
  code: "ENEM", countryCode: "BR", name: "ENEM",
  description: "Exame Nacional do Ensino Medio — ingresso ao ensino superior",
  gradeLevels: ["3 Ano Ensino Medio", "Egressos"],
  subjects: ["Linguagens e Codigos", "Matematica", "Ciencias da Natureza", "Ciencias Humanas"],
  scoreMin: 0, scoreMax: 1000,
},
{
  code: "SAEB", countryCode: "BR", name: "SAEB",
  description: "Sistema de Avaliacao da Educacao Basica",
  gradeLevels: ["5 Ano EF", "9 Ano EF", "3 Ano EM"],
  subjects: ["Lingua Portuguesa", "Matematica"],
  scoreMin: 0, scoreMax: 500,
},

// En PERFORMANCE_LEVELS:
"BR_ENEM": [
  { levelNumber: 1, levelName: "Insuficiente (0-400)", minScore: 0, maxScore: 400, description: "Abaixo da media nacional", colorHex: "#EF4444" },
  { levelNumber: 2, levelName: "Regular (401-550)", minScore: 401, maxScore: 550, description: "Proximo a media nacional", colorHex: "#F59E0B" },
  { levelNumber: 3, levelName: "Bom (551-700)", minScore: 551, maxScore: 700, description: "Acima da media nacional", colorHex: "#3B82F6" },
  { levelNumber: 4, levelName: "Excelente (701-1000)", minScore: 701, maxScore: 1000, description: "Desempenho excepcional", colorHex: "#22C55E" },
],

// En CURRICULUM_TAXONOMIES:
BR: {
  ENEM: [
    {
      subject: "Linguagens e Codigos",
      axes: [
        { axisCode: "LEC", axisName: "Interpretacao de Texto", skills: ["Localizar informacao", "Inferir", "Analisar"] },
        { axisCode: "ART", axisName: "Artes e Literatura", skills: ["Reconhecer", "Contextualizar", "Interpretar"] },
      ],
    },
    {
      subject: "Matematica",
      axes: [
        { axisCode: "NUM", axisName: "Numeros e Algebra", skills: ["Calcular", "Modelar", "Resolver problemas"] },
        { axisCode: "GEO", axisName: "Geometria e Medidas", skills: ["Visualizar", "Calcular", "Aplicar"] },
        { axisCode: "EST", axisName: "Estatistica e Probabilidade", skills: ["Interpretar graficos", "Calcular probabilidades", "Analisar dados"] },
      ],
    },
    {
      subject: "Ciencias da Natureza",
      axes: [
        { axisCode: "BIO", axisName: "Biologia", skills: ["Reconhecer", "Relacionar", "Explicar"] },
        { axisCode: "FIS", axisName: "Fisica", skills: ["Reconhecer", "Aplicar formulas", "Resolver problemas"] },
        { axisCode: "QUI", axisName: "Quimica", skills: ["Reconhecer", "Aplicar", "Resolver problemas"] },
      ],
    },
    {
      subject: "Ciencias Humanas",
      axes: [
        { axisCode: "HIS", axisName: "Historia", skills: ["Contextualizar", "Analisar", "Relacionar"] },
        { axisCode: "GEO", axisName: "Geografia", skills: ["Interpretar mapas", "Analisar fenomenos", "Contextualizar"] },
        { axisCode: "SOC", axisName: "Sociologia e Filosofia", skills: ["Interpretar conceitos", "Analisar criticamente", "Argumentar"] },
      ],
    },
  ],
},
```

### Paso 5 — Validacion CPF en `rut.ts` o nuevo `src/lib/cpf.ts`

Crear `src/lib/cpf.ts`:

```typescript
export function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/[^\d]/g, "");
  if (cleaned.length !== 11 || /^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (parseInt(cleaned[9]) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return parseInt(cleaned[10]) === d2;
}

export function canonicalCPF(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input.replace(/[^\d]/g, "");
  if (!isValidCPF(cleaned)) return null;
  return cleaned;
}
```

### Paso 6 — Pagos PIX via gateway cross-border

- Usar **EBANX** o **dLocal** (investigar cual ofrece mejores fees para Brasil).
- Crear `src/lib/pix.ts` con funcion `createPixCharge()` que llama al PSP.
- En `billing_catalog.ts`, rutear `"BR"` a `"pix"` como gateway.
- En `checkout/route.ts`, agregar el caso `"pix"` que genera QR code PIX y lo muestra al usuario.

### Paso 7 — Template de hoja ENEM

Agregar preset en el generador de hojas:
- 180 preguntas, 5 opciones (A-E)
- 2 columnas (90 por columna)
- Titulo: "Simulado ENEM 2026"
- Subtitulo: area especifica o "Prova completa"
- ID: CPF del aluno

---

## 7. Orden de ejecucion

| # | Tarea | Estimado |
|---|-------|----------|
| 1 | Agregar BR a `LATAM_COUNTRIES` en `latam.ts` | 10 min |
| 2 | Agregar calculo lineal BR en `calculateGrade()` + `getGradeConcept()` | 15 min |
| 3 | Agregar perfil BR en `country_profiles.ts` | 10 min |
| 4 | Crear `cpf.ts` con validacion | 15 min |
| 5 | Agregar `ENEM`, `SAEB` a `EVALUATION_SYSTEMS` | 5 min |
| 6 | Agregar `BR_ENEM` a `PERFORMANCE_LEVELS` | 5 min |
| 7 | Agregar `BR.ENEM` a `CURRICULUM_TAXONOMIES` | 15 min |
| 8 | **Pagos: cubierto por dLocal** (ver `docs/dlocal-pasarela-unificada.md`). No se requiere integracion adicional por pais. | **~0h** |
| 9 | ~~Implementar `createPixCharge()`~~ — dLocal maneja PIX nativamente | 0h |
| 10 | ~~Actualizar `checkout/route.ts` para gateway `"pix"`~~ — gateway unificado `"dlocal"` | 0h |
| 11 | Template hoja ENEM en sheet generator | 1 hora |
| 12 | Labels cualitativos en pt-BR (locale ya existe) | 5 min |
| 13 | Build + test | 30 min |

**Tiempo total estimado**: ~2 horas de codigo (tareas 1-7, 11-13). Pagos: 0h (cubierto por dLocal).

---

## 8. Resumen ejecutivo

Brasil es el mercado mas grande de LATAM para tuLector (13x mas estudiantes que Chile). El fit es perfecto: ENEM + cultura de simulados + OMR bubble sheets + CPF como ID. Lo que falta es principalmente:

1. **PIX via dLocal** — cubierto por la pasarela unificada (ver `docs/dlocal-pasarela-unificada.md`). Sin PIX no hay Brasil.
2. **Calculo de nota lineal** — Brasil no usa la formula chilena de exigencia.
3. **Validacion CPF** — como Chile valida RUT, Brasil necesita CPF.
4. **ENEM como sistema de evaluacion** — taxonomias, niveles, templates.

El locale `pt-BR` ya existe. Los precios ya estan en `billing_catalog.ts`. El checkout multi-gateway ahora usa `"dlocal"` como gateway unificado.

**Meta de mercado**: 500 cursinhos usando tuLector a R$749/ano cada uno = R$374,500/ano (~USD $62K). Escalando a 5,000 cursinhos = R$3.7M/ano (~USD $620K). Alcanzable en 2-3 anos con presencia local.
