# Sub-motor OMR compacto (bloque embebible) — plan de ejecución

## Estado (2026-08-11)

**Todas las fases (0 → 3) construidas y verdes. La decisión go/no-go de la Fase 0 salió GO.**

| Fase | Estado | Resultado |
|---|---|---|
| Pre-0 — `export` en `omr.ts` | ✅ | Diff de **9 palabras** (9 `export`), cero cambios de lógica. `npm run test:omr` idéntico antes y después. |
| 0 — Localización | ✅ **GO** | 8/8 casos. Error de esquina **0.6–1.4 px**. Exactamente 3 candidatos por caso: el logo negro sólido y el cuadrado de doble borde sembrados como señuelos **no** generaron ni un falso finder. Página sin bloque → `null` (sin falso positivo). |
| 0.5 — Degradación | ✅ | 8/8. JPEG q=0.3, desenfoque, ruido ±28, sombra diagonal al 45%, remuestreo 0.6x y combinaciones. Error máximo **1.4 px**. |
| 1 — Layout + calificación | ✅ | 54/54 configuraciones (preguntas × opciones × columnas) leídas al **100%**. |
| 1.5 — Exportación PNG/PDF | ✅ | PNG con `pHYs` = **300 DPI** real e idempotente; bloque de **98 × 76 mm**; guía y etiqueta impresas sin generar falsos finders (3 candidatos, 20/20); invariante de zonas verificado. |
| 2 — `sheet_mode` + modo sin identificación | ✅ | Migración `20260811000000_quiz_sheet_mode.sql`; regla de producto en `src/lib/sheet_mode.ts` validada igual en cliente y servidor; guardia nueva en `test:compact` (límite 30q/5op impreso y leído 30/30). |
| 3 — UI de generación y escaneo | ✅ | `/bloque` (generar/descargar) y `/scan/compacto` (leer). `npm run build` exit 0 con ambas rutas. |

`npm run build` pasa (exit 0) con todo lo anterior.

Correr con `npm run test:compact` (suite propia, separada de `test:omr`).

### Qué se construyó en las Fases 2 y 3 (2026-08-11)

**Fase 2 — el modo vive en el ensayo, no en la pantalla.**
`quizzes.sheet_mode ∈ ('full','compact')` con DEFAULT `'full'`: todo ensayo
existente se imprime y se lee exactamente igual que antes. El SQL evita
dollar-quoting a propósito (se pega a mano en el editor de Supabase, donde `$$`
se corrompe) y termina con `NOTIFY pgrst, 'reload schema'`.

`src/lib/sheet_mode.ts` concentra la **regla de producto** (`compactModeIssue`):
un ensayo no puede ser compacto con más de 30 preguntas, más de 5 opciones o con
preguntas de desarrollo (el bloque no tiene reverso donde escribir). La misma
función corre en el generador (apaga la opción y escribe el motivo), en el
endpoint que persiste el formato y en `createQuiz`/`updateQuiz`. Los límites
duros los sigue definiendo `compact_layout.ts`: `sheet_mode.ts` los importa, no
los repite.

**Dónde se elige el formato (decisión del usuario, 2026-08-11):** en el
**generador de hojas**, no en el formulario del ensayo. El ensayo nace `'full'`
y el switch vive arriba de los controles de `/sheet` y `/bloque`
(`SheetFormatSwitch`), que son dos caras de "generar la hoja". Al **descargar**,
la pantalla persiste el formato en el ensayo vía
`POST /api/quiz/[id]/sheet-mode` y lo dice a la vista — descargar es el momento
en que la elección se vuelve real, y es lo que hace que "Abrir lector" entre al
lector correcto. Editar un ensayo NO toca su formato (`updateQuiz` conserva el
valor existente cuando el form no manda `sheet_mode`).

Degradación ante una BD sin migrar, con un criterio deliberado por caso:
`'full'` se degrada **en silencio** (es el default real), `'compact'` **no** —
sin la columna el lector no tendría cómo saber que esa hoja se lee con el
sub-motor, y leería mal sin avisar.

El camino **sin identificación** no hubo que construirlo: `/api/scan/result` ya
rotulaba `student_name: "Sin RUT"` cuando no llega RUT (hallazgo de la
corrección 4 de este plan). `/scan/compacto` manda el ID que el profesor tipee,
o vacío.

**Fase 3 — dos pantallas nuevas, cero cambios en `/scan`.**

- `/bloque` (+ `?quiz=<id>`): vista previa con regla en mm, descarga PNG 300 DPI
  y PDF, instrucciones de pegado, y el código del ensayo impreso en el bloque.
  Avisa si el ensayo está guardado como hoja completa.
- `/scan/compacto`: cámara con latido de detección para el HUD (cuadro reducido
  cada 600 ms; la lectura real usa el cuadro completo al capturar), captura
  manual o subida de foto, verificación **suave** del código de bloque, y POST
  al mismo `/api/scan/result` de siempre.

Se creó una página aparte, como `/scan/reverso`, en vez de meter el sub-motor en
`/scan` (2.400 líneas, en producción): son dos **localizadores** distintos sobre
el mismo clasificador de burbuja, y mezclarlos obligaría a tocar el lector que
hoy funciona.

Enrutado: `startScanForQuiz` manda a `/scan/compacto` cuando el ensayo es
compacto, y los enlaces "Hoja"/"Generar hoja" pasan a "Bloque"/"Generar bloque"
en el listado, el detalle y la pantalla de escaneo del APK.

### Hallazgo de la Fase 1: límite físico de filas

El bloque no puede llevar 30 preguntas en 1 columna. Con el alto mínimo de fila
que mantiene la burbuja marcable a mano (`MIN_ROW_H = 30 px`) caben
**`MAX_ROWS = 19` filas por columna**. Pedir más desbordaba la grilla por debajo
de `Q_BOTTOM`, encima de las marcas de localización inferiores — rompía la
*detección*, no solo la lectura.

`compactQuestionLayout()` ahora sube sola al mínimo de columnas que sí alcanza
(`minColumnsFor()`), y render y motor pasan por esa misma función, así que no
pueden discrepar. Se exportan `maxQuestionsFor(cols)` y `minColumnsFor(n)` para
que la UI de la Fase 3 lo muestre antes de generar, en vez de corregirlo callada.

### Hallazgo de la Fase 1.5: por qué el PNG necesita el chunk `pHYs`

Un PNG de canvas no declara resolución, así que Word asume 96 DPI y lo inserta
**~3× más grande** de lo diseñado. Por eso `compactBlockPngBlob()` inyecta un
chunk `pHYs` con 11811 píxeles/metro (300 DPI): es lo único que hace que Word lo
coloque al tamaño físico correcto sin que el profesor ajuste nada.

También apareció un conflicto geométrico real: debajo de las dos marcas inferiores
solo quedan 38 px hasta el borde, que son **exactamente** su zona de aislamiento.
La banda de la guía se acotó al tramo central (`x ∈ [160, 1000]`, derivado de la
geometría de las marcas) y hay un test que lo comprueba como solape de rectángulos.

### Verificación pendiente que NO es automatizable

El ciclo real **pegar en Word → imprimir → fotografiar** necesita impresora y
cámara: es lo único que queda por validar, y lo tiene que hacer el usuario. Lo
sintético (escalado, compresión, desenfoque, sombra) ya está cubierto en 0.5.

Pasada de aceptación sugerida, en orden:

1. Aplicar `supabase/migrations/20260811000000_quiz_sheet_mode.sql` en Supabase →
   SQL Editor (**Vercel no corre migraciones**).
2. Tomar cualquier ensayo de ≤30 preguntas (no hace falta crearlo de nuevo),
   entrar a "Generar hoja" → cambiar el *Formato* a **Bloque compacto** y
   descargar el PNG.
3. Pegarlo en un Word, **sin tocarle el tamaño**, imprimir al 100% y medir con
   regla: debe dar 98 mm de ancho. Si no da, el problema es el reescalado de
   Word, no el motor.
4. Marcar respuestas a mano, "Abrir lector" desde el ensayo (lleva solo a
   `/scan/compacto`) y capturar. `/scan/compacto` también acepta subir una foto,
   que es la vía más rápida para probar desde el escritorio.

---

## Context

`docs/plan-bloque-omr-compacto.md` (tuLector, escrito hoy) define una funcionalidad
nueva: que el profesor arme su propia prueba en Word/Canva y pegue un **bloque OMR
compacto** de TuLector (hasta ~30 preguntas, 2-3 columnas) en cualquier parte de la
hoja, junto a contenido que TuLector no conoce. Identificar al alumno es **opcional**:
el modo base solo cuenta correctas/total.

El motor actual (`src/tulector/omr.ts`, `sheet_layout.ts`, `sheet_render.ts`) está en
producción, tiene suite propia (`npm run test:omr`, 668 líneas) y **no se toca**. Todo
lo nuevo va en un **sub-motor paralelo** que reusa las piezas puras del actual sin
alterar su comportamiento.

Este plan corrige tres afirmaciones del `.md` que no calzan con el código real
(verificadas leyendo `omr.ts` completo) y fija el orden de ejecución.

---

## Qué significa "no tocar el motor"

Regla dura para toda la implementación:

- **Cero cambios de lógica** en `omr.ts`, `sheet_layout.ts`, `sheet_render.ts`.
- El **único** cambio permitido en esos archivos: agregar la palabra `export` a
  funciones puras que hoy son privadas. Sin mover código, sin renombrar, sin
  reordenar. Diff de una palabra por función.
- `npm run test:omr` debe pasar idéntico antes y después de cada fase.

Esto **reemplaza la "Adición 1" del `.md`** (extraer utils a `image_utils.ts`).
Mudar código de `omr.ts` a otro archivo es un diff grande sobre el motor protegido
para el mismo beneficio. Si tras la Fase 0 se quiere el módulo limpio, se hace
después, con el sub-motor ya validado.

---

## Correcciones al `.md` (verificadas contra el código)

1. **`warpBilinear`/`warpImageData` NO son reusables "tal cual".** Ambas fijan el
   destino canónico de la hoja completa: `warpImageData` (`omr.ts:349-357`) escribe
   `L.CORNER_CENTERS` como `dst`, y `warpBilinear` (`omr.ts:491-508`) recorre la
   grilla `L.ANCHOR_GRID_X/Y` de 12 anclas y sale a `config.sheetWidth/Height`.
   Lo reusable es la **matemática**: `solveHomography` (`omr.ts:415`), `solve8x8`
   (`:536`), `applyH` (`:425`), `sampleBilinear` (`:466`). El sub-motor necesita su
   propio warp (~40 líneas) apuntando a su canvas canónico.

2. **La calificación tampoco se reusa entera.** `gradeBubbles` (`omr.ts:847`) está
   atada a la hoja completa: `validateFormat` (`:746`), `readTimingRows` (`:671`,
   lee en `L.TIMING_X`) y `L.questionLayout()` con geometría absoluta de página
   (`Q_TOP=340`, `COL_GEOM` en X absolutos). El sub-motor necesita su propio bucle
   de calificación **reusando el clasificador**: `classifyBubble` (`:574`), `CALIB`
   (`:558`), `CONF` (`:833`), `markConfidence` (`:836`). Así la calibración de
   burbuja sigue siendo única para ambos motores.

3. **`evaluation_type: "compact_only"` es el modelado equivocado.**
   `evaluation_type` define la **escala de puntaje** (`evaluation_types.ts:9-14`:
   custom=%, paes=pts 100-1000, simce=pts 100-400) y alimenta el trigger
   `calculate_paper_results`; además tiene CHECK constraint cerrado
   (`20260627000000_paes_simce.sql:3`). El bloque compacto no cambia la escala
   (sigue siendo %), cambia **cómo se genera y se localiza la hoja**. Va en una
   columna propia: `quizzes.sheet_mode TEXT CHECK (sheet_mode IN ('full','compact'))
   DEFAULT 'full'`.

4. **Hallazgo que abarata la Fase 2**: el "sin identificación" ya existe. La API
   `/api/scan/result` guarda `student_name: "Sin identificar" / "Sin RUT"`
   (`route.ts:241`) cuando no hay RUT resuelto. No hay que construir un camino
   anónimo desde cero, solo no invocar el bloque de ID.

Desviaciones menores del `.md` que confirmo y quedan corregidas acá: las zonas de
`findCornersByMass` son 8% del ancho × 6% del alto (`omr.ts:74`), y `captureFrame`
(`scan/page.tsx:767`, botón manual) es distinto del `loop()` de preview en vivo
(`scan/page.tsx:1005-1153`).

---

## Lo que el `.md` acierta y se conserva

- `compact_block.ts` separado de `omr.ts` (cero riesgo de regresión). ✅
- Patrón finder tipo QR (1:1:3:1:1) en vez del doble-borde del competidor. ✅
- Live-tracking sobre el RAF loop existente: `scan/page.tsx:1005-1153` ya hace
  exactamente el patrón "detectar cada frame → contar frames estables (`stableFrames`,
  `<25px` de movimiento) → disparar solo si estable" (`:1114-1129`). Cambiar
  `findCorners` por `findCompactBlockCorners` es una sustitución, no un paradigma nuevo. ✅
- Fase 0 como punto go/no-go. ✅
- Mini `sheet_code` dentro del bloque: `encodeSheetCode`/`decodeSheetCode`
  (`sheet_code.ts:67,98`) son codec de bits puros, reusables sin tocar nada. ✅
- La SVM de burbujas queda fuera de alcance (ortogonal a localización).

---

## Arquitectura del sub-motor

**Archivos nuevos** (ninguno de estos existe hoy):

| Archivo | Rol |
|---|---|
| `src/tulector/compact_layout.ts` | Geometría canónica del bloque: `BLOCK_W/BLOCK_H`, posiciones de los finder patterns, franja del mini código, pista de temporizacion, grilla de preguntas. Espejo de `sheet_layout.ts` pero para el canvas chico. |
| `src/tulector/compact_render.ts` | `drawCompactBlock(ctx, marks, cfg)`. Reusa la interfaz `Ctx2D` ya exportada (`sheet_render.ts:12`). |
| `src/tulector/compact_block.ts` | El sub-motor: `findCompactBlockCorners()`, `warpCompactBlock()`, `gradeCompactBlock()`. |
| `src/lib/compact_block_generator.ts` | Exportación PNG 300DPI / PDF. Fuera del motor, mismo patrón que `sheet_generator.ts` (que ya hace branding sin tocar `drawSheet`). |
| `test_compact_block.ts` + script `test:compact` | Suite propia, separada de `test:omr`. |

**Se exporta (solo la palabra `export`) desde `omr.ts`:** `otsuThreshold` (:112),
`findAnchorBlobs` (:153), `solveHomography` (:415), `solve8x8` (:536), `applyH` (:425),
`sampleBilinear` (:466), `classifyBubble` (:574), `CALIB` (:558), `markConfidence` (:836).

**Se reusa ya exportado:** `crc8`/`encodeSheetCode`/`decodeSheetCode` (`sheet_code.ts`),
`Ctx2D` (`sheet_render.ts:12`), el RAF loop de `scan/page.tsx`.

### Decisiones de geometría (punto de partida, se afinan en Fase 1)

- **Canvas canónico del bloque**: ~900×560 px, declarado como 76×47 mm a 300 DPI.
  Tamaño **fijo**, no estirable por el usuario.
- **3 finder patterns QR (TL, TR, BL) + 1 marca de alineación menor en BR**, no 4
  marcas iguales. Con 4 marcas idénticas la orientación es ambigua (el bloque pegado
  en Word puede quedar rotado 180°); con el esquema 3+1 la orientación se deduce sola,
  igual que en un QR.
- **Mini `sheet_code`**: se reusa el codec de 46 celdas **sin cambios**, dispuesto en
  **2 filas de 23 celdas** dentro del bloque. En una sola fila el paso quedaría ~1 mm
  impreso (contra 2,9 mm de la hoja completa); en 2 filas se conserva un paso cómodo.

---

## Fases

### Fase 0 — Prototipo de localización (go/no-go, va primero y aislado)

1. Agregar `export` a las funciones listadas arriba en `omr.ts`. Correr
   `npm run test:omr` → debe pasar igual.
2. `compact_layout.ts` mínimo: solo lo necesario para dibujar los finder patterns.
3. `findCompactBlockCorners(imageData)` en `compact_block.ts`: barre la foto
   **completa** (no bordes/extremos como `findCornersByBlobs`) buscando la firma
   1:1:3:1:1 por escaneo de líneas horizontales y verticales, agrupa candidatos,
   valida el cuadrilátero por aspecto/tamaño esperado, y resuelve orientación con
   el esquema 3+1.
4. `warpCompactBlock()`: homografía de 4 puntos hacia el canvas canónico del bloque,
   armada con `solveHomography` + `sampleBilinear`.
5. Fixtures sintéticos nuevos en `test_compact_block.ts`: bloque renderizado **sobre
   fondo con contenido ajeno** (párrafos de texto, tablas, recuadros, un logo negro
   cuadrado como señuelo), en posiciones y rotaciones variadas. Los fixtures de
   `test_omr_real.ts` son de página limpia y no prueban justamente esto.

**Punto de decisión**: si la localización no es confiable contra esos fixtures, se
para y se reconsidera (marca más grande, encuadre más cerrado, posición semi-fija).

### Fase 0.5 — Degradación realista

Antes de declarar viable, los mismos fixtures pasados por: escalado 0.85x / 1x / 1.15x
(Word reescalando según DPI), compresión JPEG, desenfoque leve, perspectiva e
iluminación despareja.

Nota honesta: el "pegar en .docx → imprimir → fotografiar" del `.md` **no es un test
de CI** (necesita impresora y cámara). Se parte en dos: lo sintético automatizado acá,
y **una pasada manual de aceptación** que hace el usuario con una impresión real antes
de pasar a Fase 2.

### Fase 1 — Layout y render del bloque

- `compact_layout.ts` completo: hasta 30 preguntas en 2-3 columnas, pista de
  temporizacion propia, franja del mini código en 2 filas.
- `drawCompactBlock()` en `compact_render.ts`.
- `gradeCompactBlock()`: bucle de calificación propio reusando `classifyBubble` +
  `CALIB` + `markConfidence`, con registro por temporizacion local del bloque.
- Bloque de identificación **opcional**: mismo patrón de checkbox que ya existe en
  `/sheet` (`printRut`/`printName`, `sheet/page.tsx:74-75,537-541`). Desactivado =
  el bloque no lo dibuja en absoluto.

### Fase 1.5 — Exportación para pegar en Word

- PNG con chunk `pHYs` a 300 DPI (para que Word no reescale) + PDF de 1 página con
  solo el bloque (vía `jspdf`, ya usado en `sheet/page.tsx:25`).
- Preview en pantalla con regla en **mm**.
- Instrucción impresa junto al bloque: "Pega manteniendo el tamaño 100% — no recortar
  ni estirar" (modo de falla más frecuente del flujo).

### Fase 2 — Modo de calificación "solo contraste"

- Migración: `quizzes.sheet_mode TEXT CHECK (sheet_mode IN ('full','compact'))
  DEFAULT 'full'` (**no** tocar el CHECK de `evaluation_type`).
- Camino de resultado sin identificación: se omite `readRut`; la API ya rotula
  `"Sin identificar"` (`api/scan/result/route.ts:241`).

### Fase 3 — Generación y escaneo

- Pantalla para generar/descargar el bloque (`src/lib/compact_block_generator.ts` +
  UI, mismo patrón que `/sheet`).
- Punto de entrada de escaneo en modo compacto: reusa el `loop()` de
  `scan/page.tsx:1005-1153` sustituyendo `findCorners` → `findCompactBlockCorners`
  y `warpSheet` → `warpCompactBlock`, y ajustando la guía de encuadre (hoy usa
  `SHEET_W/SHEET_H`, `:1047`).

---

## Verificación

- Por fase: `npx tsc --noEmit`, `npx eslint`, `npm run build`.
- `npm run test:omr` **en cada fase** — es la guardia de que el motor actual no se
  movió. Cualquier fallo = revertir, no "ajustar el test".
- `npm run test:compact` (nuevo): fixtures de localización con contenido ajeno +
  degradaciones de Fase 0.5 + verificación de que `gradeCompactBlock` recupera las
  respuestas sembradas.
- Aceptación manual (usuario) al cerrar Fase 1.5: generar bloque → pegar en Word →
  imprimir → fotografiar con la app → verificar lectura.

## Riesgos

- **Fase 0 es un prototipo real, no una tarea garantizada.** Su resultado decide si
  siguen las demás fases tal cual.
- Un logo/recuadro negro en la hoja del profesor puede imitar un finder mal tuneado;
  el mini `sheet_code` es la validación de segundo nivel ("esto es un bloque
  TuLector" + a qué quiz pertenece).
- La UI exacta del visor en vivo (cómo confirma encuadre el profesor) se define
  durante la Fase 0, junto con el prototipo.

## Antes de empezar

Copiar este plan a `docs/plan-bloque-omr-compacto-ejecucion.md` en el repo (el
archivo de plan de la sesión se reutiliza entre tareas y se pierde).
