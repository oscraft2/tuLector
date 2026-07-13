# Plan: motor OMR multi-país (clasificador + multipágina) + login estudiantil

Estado al 12 jul 2026: motor estable (14/14 guardias `test:omr`, barrido 36/36), sin cambios desde `aa79934`. Este plan cubre los 3 pendientes: **#1 entrenar clasificador**, **#2 multipágina**, **login estudiantil con sesión** — todos re-secuenciados para no chocar con la expansión a 9 países ya documentada en `docs/investigacion-*.md` y `docs/dlocal-pasarela-unificada.md`.

## Hallazgo clave que reordena todo

La base de datos **ya tiene** una tabla `countries` (`supabase/migrations/20260525000001_latam.sql`) con 9 filas — `CL, AR, BR, MX, CO, PE, EC, BO, PY` — cada una con `id_type` e `id_format_regex`. `schools.country_code` ya referencia esa tabla. La capa TS (`src/lib/country_profiles.ts`) **no se ha puesto al día**: `CountryCode` sigue siendo el union `"CL"` solamente. O sea, el "id de cada país" que pedías no hay que inventarlo — hay que **usar el que ya existe en el schema** y cablearlo en TS + en el motor.

El bloque de identificación del alumno en la hoja (`readRut`/`computeRutDV`, `omr.ts`) hoy es 100% RUT chileno: 8 dígitos + 1 dígito verificador mod-11 fijo. Eso es lo que bloquea tanto multipágina (el `sheet_code` necesita saber de qué país es la hoja) como el clasificador multi-país (los datos de entrenamiento deben poder segmentarse por país) y el login estudiantil (la credencial es el ID nacional, que cambia de formato por país).

## Formatos de ID por país (de los docs de investigación)

| País | Doc | ID | Dígitos | Dígito verificador |
|---|---|---|---|---|
| Chile (base) | — | RUT | 8 | mod-11, multiplicadores 2-7 |
| Argentina | investigacion-argentina.md:51,398,426 | DNI | 7-8 | ninguno |
| Perú | investigacion-peru.md:15,135-160 | DNI | 8 | ninguno |
| Colombia | investigacion-colombia.md:139-148 | CC | 6-10 | ninguno |
| Brasil | investigacion-brasil.md:134-155 | CPF | 11 | mod-11, dos pasadas (algoritmo distinto al de Chile) |
| Ecuador | investigacion-ecuador.md:150-179 | Cédula | 10 | mod-10, coeficientes `[2,1,2,1,2,1,2,1,2]` + validación de provincia (dígitos 1-2 entre 01-24) |
| Uruguay | investigacion-uruguay.md:107-127 | CI | 8 | mod-10, multiplicadores `[2,9,8,7,6,3,4,1]` |
| México | investigacion-mexico.md:16,196 | CURP | **18 alfanumérico** (letras+dígitos) | no tiene dígito verificador propio |

Conclusión técnica: 7 de 8 países son **numéricos de largo variable (6-11 dígitos) con algoritmo de verificación intercambiable (ninguno / dos variantes mod-11 / dos variantes mod-10)** — encajan en la MISMA grilla de burbujas que ya existe (columnas de dígito 0-9 + fila K opcional), solo cambiando cuántas columnas y qué función de checksum. **México (CURP) es la excepción real**: 18 caracteres alfanuméricos no caben en una grilla de burbujas de dígitos sin rediseñar el alfabeto (26 letras + 10 dígitos por columna, o un mecanismo distinto). Por eso CURP se trata como fase aparte, no como parte de la generalización base — meterlo primero contaminaría el diseño de la abstracción.

**Recomendación técnica de validación (reemplaza el ranking de negocio, que se autocontradice entre docs):** generalizar primero con **Argentina** (caso más simple: numérico, sin dígito verificador — prueba que la grilla funciona con largo variable y "sin checksum" como caso válido) y luego **Brasil** (numérico, CON dígito verificador, pero algoritmo distinto al de Chile — prueba que el checksum es de verdad intercambiable y no quedó hardcodeado a mod-11 estilo RUT). Con esos dos casos cubiertos, Perú/Colombia/Ecuador/Uruguay entran "gratis" (mismo patrón, solo cambian largo/coeficientes). México (CURP) queda como Fase 3 explícita.

## Fase 0 — Generalizar el bloque de ID nacional (fundacional, bloquea #2 y el login)

No toca el motor de preguntas ni de warp — solo el bloque RUT.

1. `src/lib/country_profiles.ts`: expandir `CountryCode` a los 9 valores de la tabla `countries`; cada perfil declara `idDigits: number` y `checkDigit: (digits: number[]) => number | string | null` (null = sin verificador).
2. `src/tulector/sheet_layout.ts`: el bloque hoy fijo en `RUT_COLS=9` (8 dígitos + DV) pasa a derivarse de `idDigits + (hasCheckDigit ? 1 : 0)` del país del colegio/prueba.
3. `src/tulector/omr.ts`: `computeRutDV` se separa en funciones puras por algoritmo (`checkDigitMod11Cl`, `checkDigitMod11Br`, `checkDigitMod10Ec`, `checkDigitMod10Uy`, `null` para AR/PE/CO) seleccionadas por perfil de país. `readRut` (renombrar a `readNationalId` o mantener alias) usa el largo de columnas dinámico.
4. Guardias nuevas en `test_omr_real.ts`: una por Argentina (sin DV) y una por Brasil (DV mod-11 dos-pasadas) generando+leyendo con el layout paramétrico ya existente (`questionLayout`/config ya soporta variar dimensiones — mismo patrón que el guard "Parametric" de 30preg/3op).
5. **No se toca nada de Chile**: el perfil CL con 8+1 y mod-11 actual queda como caso por defecto, cero regresión (regla dura ya vigente: `npm run test:omr` idéntico salvo las guardias nuevas que se agregan).

Esfuerzo estimado: medio — es refactor mecánico + 2 guardias, no diseño nuevo, porque la grilla paramétrica ya existe.

## Fase 1 — #2 Multipágina (país integrado)

Depende de Fase 0 solo para que el código de hoja pueda declarar de qué país es la prueba; el ensamblado de páginas en sí es independiente del ID.

1. `src/tulector/sheet_code.ts`: el codec actual es 46 celdas — `GUARD(3) + VERSION(4) + SHEET_ID(20) + PAGE(4) + PAGES_TOTAL(4) + CRC8(8) + STOP(3)`. Agregar `COUNTRY(4 bits)` (16 valores, cubren los 9 países + margen) entre VERSION y SHEET_ID; recalcular CRC8 sobre el payload ampliado. Es aditivo — hojas viejas sin el campo deben seguir leyéndose con país por defecto = CL (fallback, no rotura).
2. Ensamblado real (lo que hoy NO existe): nueva función `assembleMultipageResult(quizId, studentIdNormalized)` que junta todos los `scan_logs`/`papers` de un mismo `quiz_id` + `student_id` con `pagesTotal>1`, valida que estén las N páginas (usa el campo `page`/`pagesTotal` ya leído), y solo entonces hace el upsert final a `grade_records` — hoy cada escaneo se gradúa solo, aislado.
3. UI: estado "esperando página 2 de 3" en `/scan` mientras no estén todas las páginas de ese alumno.
4. Guard nuevo en `test_omr_real.ts`: generar 2 páginas, escanear en orden inverso, verificar ensamblado correcto (ya existe el patrón de "barrido"/guardias sintéticas para modelar esto sin cámara real).

## Fase 2 — #1 Entrenar el clasificador (en paralelo, no bloqueado por Fase 0/1)

La colección de datos vía "Confirmar lectura" es agnóstica al país — el clasificador aprende features de burbuja (`darkRatio,contrast,variance,edgeDensity`), no formato de ID. Puede seguir corriendo AHORA solo con Chile.

1. Cambio mínimo, ahora: agregar `country_code` (default `"CL"`) al payload que `scan_logs` type="label" ya guarda, para poder segmentar el dataset por país cuando haya pilotos en otros países (el papel/impresora/luz local podría correr features distinto — no se sabe todavía, por eso etiquetar desde ya es barato y evita re-recolectar).
2. Seguir acumulando hasta tener volumen suficiente (sin fecha objetivo — depende de uso real).
3. Cuando haya datos: `export_dataset.ts` → `train_classifier.ts` → pegar pesos en `classifier.ts` → recalibrar umbrales → `npm run test:omr` debe seguir en verde antes de activar (`CLASSIFIER` deja de ser `null`).
4. Si Fase 0 ya aterrizó cuando haya pilotos en AR/BR, evaluar si conviene un `CLASSIFIER` único global o uno por país (decisión futura, con datos reales en mano, no ahora).

## Fase 3 — Login estudiantil con sesión (depende de Fase 0)

Hoy NO existe login de estudiante: `/consulta` (`src/app/consulta/page.tsx`) es búsqueda pública sin sesión por RUT; `/auth` es solo profesor/colegio. Se construye una cuenta real:

1. Nueva tabla/rol `students` con sesión (recomendado: **magic link por email**, no password — reduce fricción y soporte para menores/apoderados, consistente con que el resto del sistema no maneja contraseñas de alumnos hoy).
2. Credencial de vinculación = ID nacional + `country_code` (no RUT a secas) — valida contra `countries.id_format_regex` de Fase 0 antes de crear/vincular la cuenta. Esto es lo que ata esta fase a Fase 0: sin el país-aware ID, no se puede validar el ID de un alumno mexicano/brasileño al crear su cuenta.
3. Vista autenticada: historial de TODAS sus pruebas (across `grade_records`), no solo la última — mejora sobre `/consulta` que hoy es lookup puntual.
4. `/consulta` se mantiene como fallback público (útil para apoderados sin cuenta) pero pasa a usar la misma validación de ID por país de Fase 0.

## Orden de ejecución sugerido

```
Fase 0 (generaliza ID: AR + BR primero)
   ├──> Fase 1 (#2 multipágina, incluye país en sheet_code)
   └──> Fase 3 (login estudiantil)
Fase 2 (#1 clasificador) — arranca YA, en paralelo, solo requiere el campo country_code en el log (1 línea)
```

## Explícitamente fuera de este plan (fase futura, no ahora)

- México/CURP: rediseño del bloque de ID a alfanumérico — se aborda después de validar el patrón numérico en Fase 0.
- Perfiles de evaluación/exigencia por país (`evaluation_systems`, mencionado en migraciones) — es producto, no motor.
- Pasarela dLocal — ya tiene su propio doc (`docs/dlocal-pasarela-unificada.md`), no depende de nada de este plan.
