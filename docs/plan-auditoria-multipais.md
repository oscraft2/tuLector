# Plan de acción — hallazgos de la auditoría multi-país (jul 15 2026)

Contexto: tras cablear la capa de producto a 7 países (commits `5c623fa`,
`274f23b`, `58218f9`) se auditó el resultado. Este plan ordena lo que queda,
priorizado por **riesgo × valor**, no por orden de descubrimiento.

Estado global de la auditoría: **build de prod 135/135 OK · `test:omr` 23/23 ·
typecheck limpio · Chile byte-idéntico (cero regresión)**. Lo de abajo es mejora,
no incendio.

---

## P0 — Ya resuelto (solo registro)

### ✅ Bug cédula ecuatoriana — CERRADO (`58218f9`, en producción)
El regex de EC en `national_id.ts` (`^[0-9]{10}$`) rechazaba la salida con guion
del motor (`"172345678-4"`) → `canonical=null` → `papers.student_rut_norm` nulo en
colegios de Ecuador. Corregido: `validateNationalIdFormat` prueba crudo **o**
normalizado. Sin acción pendiente.

---

## P1 — Rápido y de bajo riesgo (recomendado hacer ya)

### ✅ 1. Desacoplar `country_profiles.ts` del motor OMR — CERRADO (`a316e10`, en producción)
**Problema:** `country_profiles.ts` importa `@/lib/omr` (~1400 líneas) solo por
`resolveIdBlock`/`resolveIdReadConfig`, y lo importan `supabase_server.ts` (server,
toda la app) y `AnswerKeyEditor.tsx` (cliente, form de crear ensayo) que **solo**
usan `resolveCountryProfile` → el motor entra a bundles que no lo necesitan.

**Acción:**
1. Crear `src/lib/country_id_blocks.ts` con `resolveIdBlock`/`resolveIdReadConfig`
   (mover desde `country_profiles.ts`, junto con sus imports de `omr`/`sheet_layout`
   y los dos `Record<CountryCode, ...>`).
2. Quitar de `country_profiles.ts` los imports de `@/lib/omr` y `@/lib/sheet_layout`.
3. Actualizar los 3 únicos consumidores reales a importar del módulo nuevo:
   `src/app/sheet/page.tsx`, `src/app/scan/page.tsx`, `src/lib/sheet_generator.ts`.

**Verificación:** `tsc` + build; `grep -rl "@/lib/omr"` no debe aparecer vía
`country_profiles`. **Esfuerzo:** S (~20 min). **Riesgo:** BAJO (movimiento puro).

---

## P2 — Gaps funcionales que bloquean el uso real fuera de Chile

### ✅ 2. `/consulta` público multi-país — CERRADO (`dea4fd3`, en producción)
**Problema:** `src/app/consulta/page.tsx` + `src/app/api/consulta/route.ts` son
100% RUT: UI con formato chileno, y el backend usa `canonicalRut()` → rechaza
cualquier ID no-RUT con "RUT no válido". Hoy un apoderado de Brasil NO puede
consultar por CPF.

**Acción:**
1. `api/consulta/route.ts`: aceptar `country_code` (query param), reemplazar
   `canonicalRut` por `resolveNationalId(raw, country)`, buscar por
   `national_id_normalized` (columna generada que ya existe, país-agnóstica).
2. `consulta/page.tsx`: selector de país + label/placeholder dinámicos
   (`COUNTRY_ID_FORMATS` de `national_id.ts` ya tiene label+ejemplo por país).
3. Ojo con la colisión entre países: el `national_id_normalized` no es único
   global. Scopear por `country_code` (o por colegio si el flujo lo permite).

**Verificación:** consultar una nota real de un alumno CL (no debe cambiar) + una
de un alumno de otro país de prueba. **Esfuerzo:** M. **Riesgo:** MEDIO (público,
toca un lookup en vivo — probar Chile primero para descartar regresión).

### ✅ 3. `api/search` interno por ID nacional — CERRADO (`a316e10`, en producción)
**Problema:** `src/app/api/search/route.ts` filtra por `canonicalRut` (además de
nombre/`student_id`), inútil para IDs de otros países. Menos crítico porque ya cae
a nombre/`student_id`.

**Acción:** sumar un filtro por `national_id_normalized` (usa `school.country_code`,
sesión autenticada → país conocido). Es aditivo, no reemplaza los existentes.

**Verificación:** buscar un alumno no-CL por su ID en el buscador del dashboard.
**Esfuerzo:** S–M. **Riesgo:** BAJO (aditivo).

---

## P3 — Pulido (no bloquea el uso, mejora la experiencia)

### 4. Overlay de cámara en `/scan` según el bloque de ID del país
**Problema:** el overlay dibuja la grilla con forma de RUT chileno (nº de columnas
fijo). La **lectura real ya es correcta** por país; esto es solo lo que ve el
usuario en cámara → puede confundir en un colegio de, p.ej., Brasil (CPF tiene
distinto nº de columnas).

**Acción:** derivar el dibujo del overlay de `idBlock` (`idBlockCols`/
`idBlockRowsForCol`, ya disponibles vía `resolveIdBlock`) en vez de constantes RUT.

**Verificación:** abrir `/scan` con un ensayo de país no-CL y mirar que el overlay
calce con la hoja impresa. **Esfuerzo:** M (código de canvas). **Riesgo:** BAJO
(cosmético, no toca la lectura).

### 5. i18n real por país (traducción de UI)
**Problema:** los 5 países hispanohablantes reusan el texto `es-CL` (español
chileno); solo el label del ID y la escala de notas cambian por perfil. Los docs
`investigacion-*.md` proponían locales `es-AR`/`es-PE`/etc.

**Acción (grande, opcional):** crear `src/locales/es-{AR,PE,CO,EC,UY}.ts` +
registrarlos en `locales/index.ts` y `resolveDashboardLocale`. Evaluar si el ROI
justifica el esfuerzo — hoy la app ya es funcional en esos países, solo con
modismos chilenos. **Esfuerzo:** L. **Riesgo:** BAJO pero mucha superficie tocada.

---

## Fuera de este plan (hito propio, ya conocido)

- **Multipágina (Fase 1):** cablear `assembleMultipageResult` (`src/lib/multipage.ts`,
  algoritmo aislado y probado, DORMIDO) a `api/scan/result/route.ts`. Requiere
  diseño de migración (retener páginas parciales). Es el próximo hito grande del
  plan multi-país, independiente de los hallazgos de auditoría.
- **México / CURP:** bloque de ID alfanumérico (18 chars), fuera de la grilla de
  dígitos actual — fase explícitamente aparte desde el plan original.

---

## Verificación del alta de un colegio nuevo (jul 15 2026, mismo día)

Se recorrió el flujo de onboarding punta a punta para confirmar que un usuario
nuevo puede realmente conectar su colegio a su país:

- `dashboard/onboarding/page.tsx` renderiza los 7 perfiles como opciones (sin
  filtro por `enabled`, campo que hoy no gatea nada — ver más abajo).
- **Bug encontrado y corregido** (incluido en `a316e10`): el texto de ayuda bajo
  el selector de país quedaba fijo en el mensaje de Chile (`resolveCountryProfile("CL")`
  calculado una sola vez al montar) sin importar qué país el usuario eligiera —
  confuso pero NO afectaba los datos guardados (el `value` del radio siempre fue
  correcto). Corregido con estado reactivo.
- `completeOnboarding` inserta `country_code` + `countryDefaults(country.code)`
  (escala de notas) correctamente para los 7 países — el FK contra `countries`
  ya no falla para ninguno (Brasil se agregó en la migración de la sesión previa).
- `getDashboardContext()` resuelve `countryProfile` del `country_code` guardado
  y lo expone a TODA la app (dashboard, settings, `/app/configuracion` nativo) —
  confirmado que las 3 pantallas que muestran el perfil (`dashboard/page.tsx`,
  `settings/page.tsx`, `app/configuracion/page.tsx`) ya leían del `countryProfile`
  dinámico, sin hardcodear Chile.
- `SeleccionarInstitucion` (autocompletar contra el registro RBD/MINEDU) sigue
  siendo específico de Chile, pero SIEMPRE hay una vía manual ("Ingresar
  manualmente") disponible sin importar el país elegido — no bloquea el alta,
  solo no ofrece autocompletado para otros países (gap conocido, no arreglado:
  agregar autocompletado por país sería un proyecto aparte, cada país tiene su
  propio registro oficial o ninguno).
- El campo `CountryProfile.enabled` existe en el tipo pero **no filtra nada en
  ningún lado** (confirmado por grep) — es metadata muerta hoy. Si en el futuro
  se quiere lanzar un país "en beta" sin mostrarlo aún, hay que cablear ese
  filtro donde corresponda (onboarding + settings); hoy los 7 están 100% abiertos.

**Conclusión: un usuario nuevo SÍ puede conectar su colegio a cualquiera de los
7 países y queda funcional de punta a punta** (ID correcto en hojas/escaneo,
escala de notas correcta, sistemas de evaluación propios, búsqueda de alumnos
por su ID). Verificado con build de producción + `test:omr`, no solo lectura de
código.

## Secuencia recomendada

```
P1.1 (desacople)  ── quick win, sin dependencias, hazlo primero
   │
P2.2 (/consulta)  ── el gap funcional de mayor valor para otros países
P2.3 (api/search) ── aditivo, se puede hacer en paralelo con P2.2
   │
P3.4 (overlay)    ── pulido, cuando P2 esté cerrado
P3.5 (i18n)       ── solo si el ROI lo justifica; decisión de negocio
```

**Sugerencia:** ejecutar P1.1 + P2.3 en una sola tanda (ambos bajo riesgo,
verificables con typecheck/build), dejar P2.2 (/consulta) para una sesión propia
por ser público y en vivo, y tratar P3.5 (i18n) como decisión aparte.
