# Bloque OMR compacto embebible en pruebas propias del profesor

## Contexto

Hoy TuLector solo genera hojas completas: página entera dedicada a la
hoja OMR (marcas de registro, franja de sheet_code, bloque de RUT/nombre,
grilla de preguntas). Se pide una funcionalidad nueva: que un profesor
pueda armar su propia prueba/guía (Word, Canva, lo que use, con contenido
que TuLector no conoce) y le pegue/imprima un **bloque compacto** de
TuLector — hasta ~30 preguntas, en 2-3 columnas para que ocupe poco — en
**cualquier parte** de esa hoja, junto a su propio contenido.

Requisitos confirmados con el usuario:
- El bloque puede quedar en cualquier posición de la hoja (no hay una
  zona fija acordada de antemano) — es la variante más difícil.
- Identificar al alumno es **opcional**, no obligatorio: el modo base
  solo necesita contrastar N° de respuestas correctas sobre el total, sin
  RUT ni nombre.

## Por qué esto es más difícil que un cambio de layout

El "motor" OMR (`src/tulector/sheet_render.ts`, `src/tulector/sheet_layout.ts`,
`src/tulector/omr.ts`) es código protegido con su propia suite de tests
(`npm run test:omr` → `test_omr_real.ts`, 667 líneas). Investigación
confirmó:

- **Geometría** (`sheet_layout.ts`): canvas fijo de página completa
  (`SHEET_W=1200, SHEET_H=1650`), todo posicionado en offsets absolutos
  dentro de esa página. `questionLayout()` ya soporta preguntas/opciones/
  columnas variables (1-4 columnas) — el LAYOUT del bloque compacto es
  extensión directa de algo que ya existe, no hay que inventarlo.
- **Detección de esquinas — la parte realmente difícil** (`omr.ts`,
  `findCorners()` L214-341): las 3 estrategias en cascada (blobs
  globales, zonas de borde al 45%, franjas al 8% del borde) asumen TODAS
  que la hoja fotografiada ocupa casi todo el encuadre — buscan extremos
  globales de manchas oscuras o marcas pegadas al borde de la foto. Con
  un bloque metido en cualquier parte de una hoja con contenido ajeno
  alrededor (texto, tablas, logos, otros recuadros), las 3 estrategias
  muy probablemente fallan: agarran una marca ajena como "esquina", o
  nunca encuentran nada porque el bloque no está pegado al borde de la
  foto.
- La matemática de rectificación (`warpBilinear`/`warpImageData`,
  `omr.ts:344-533`) SÍ es reutilizable tal cual — no le importa qué
  representan las 4 esquinas, solo hace el mapeo. El problema es
  exclusivamente **encontrar** esas esquinas dentro de una foto con
  contenido desconocido alrededor — una capacidad nueva, no una
  parametrización de la que ya existe.

## Lo que aporta `omr_reference.json` (ingeniería inversa de un competidor)

Referencia técnica completa (APK descompilado) de un lector OMR comercial
maduro (arquitectura/paleta compatible con ZipGrade). Hallazgos
relevantes:

1. **Tampoco resuelven este caso.** Su hoja también es página completa
   fija (1200x1650 — casi idéntico a nuestras dimensiones, probablemente
   no es casualidad). Sus marcas de esquina son más robustas que las
   nuestras (cuadrado de **doble borde**: exterior 3px, interior 1px,
   50x50px — se localizan uniendo el doble borde con "morphological
   close" en C++ y sacando el centro de masa de píxeles oscuros por
   cuadrante), pero se buscan por **cuadrante esperado del encuadre**, no
   "en cualquier parte de una foto con contenido ajeno". Ni un producto
   comercial maduro soporta nuestro caso — es terreno nuevo.
2. **Hallazgo clave: no procesan una foto fija, procesan video en vivo.**
   `ProcessByteFrame` corre en cada frame de cámara (CameraX
   ImageAnalysis), con un visor (`ScanningSquaresView`) que dibuja 4
   cuadrados verdes en tiempo real sobre las esquinas detectadas,
   guiando al profesor a encuadrar bien — recién "califica" cuando el
   tracking es estable. Esto baja mucho la dificultad real: en vez de
   que el algoritmo tenga que encontrar a ciegas una marca chica en una
   foto grande y desconocida, se guía activamente al usuario a encuadrar
   de cerca (como un lector de QR).
3. **Ya tenemos esa arquitectura.** `src/app/scan/page.tsx` ya corre un
   loop continuo de frames vía `requestAnimationFrame` (`captureFrame`,
   loop con frame-skip, L1008-1153) — no es una foto única. Adoptar
   "seguimiento en vivo + bloquear solo cuando el tracking es estable"
   para el bloque compacto es extender algo que ya existe en el flujo de
   escaneo actual, no un paradigma nuevo. Baja bastante el riesgo de
   ejecución.
4. Clasificación de burbujas por SVM (marcada/no marcada/glare) en vez de
   solo densidad de píxeles — mejora de robustez general, ortogonal al
   problema de localización, se puede evaluar después.

## Enfoque recomendado

Marca de esquina más distintiva que un cuadrado sólido — **patrón finder
tipo código QR** (cuadrados concéntricos en proporción 1:1:3:1:1) en vez
del doble-borde del competidor: es la técnica estándar y probada
específicamente para encontrar marcas en una imagen con contenido
arbitrario alrededor (así logran los QR funcionar en escenas reales con
cosas impresas cerca — más robusto todavía que el doble-borde). Combinado
con el loop de video en vivo ya existente: se busca el patrón en CADA
frame (no solo bordes/extremos como hoy), y recién se "bloquea"/lee
cuando la posición es estable por varios frames seguidos, con feedback
visual en pantalla mientras el profesor encuadra.

## Plan de implementación (fases)

### Fase 0 — Prototipo de localización (el riesgo real, va primero y aislado)

Antes de tocar generación de hojas o UI: validar que se puede encontrar
el bloque de forma confiable en una foto con contenido ajeno alrededor.
Si esto no funciona bien, el resto no vale la pena construirlo.

- Nuevo módulo `src/tulector/compact_block.ts`, separado de `omr.ts`
  (cero riesgo de regresión sobre la detección de hoja completa
  existente). Nueva función `findCompactBlockCorners()`: escanea la foto
  completa (no solo bordes) buscando 3-4 patrones finder con la
  proporción esperada, valida el cuadrilátero resultante por
  aspecto/tamaño esperado del bloque, entrega las 4 esquinas a la MISMA
  `warpBilinear` que ya existe.
- Extender el loop de `src/app/scan/page.tsx` (o una variante nueva de
  pantalla de escaneo) para intentar `findCompactBlockCorners()` en cada
  frame y solo "bloquear" tras N frames consecutivos con detección
  estable — mismo espíritu que el visor de cuadrados verdes del
  competidor, adaptado a lo que ya existe acá.
- Nuevos fixtures de test: renderizar el bloque compacto SOBRE un fondo
  sintético con contenido ajeno (texto, tablas, recuadros, logos en
  posiciones variadas) — los fixtures actuales de `test_omr_real.ts` son
  de página limpia y no prueban justamente lo nuevo.

### Fase 1 — Layout del bloque compacto

- Extiende `questionLayout()` (ya parametrizable) a un canvas chico en
  vez de `SHEET_W/SHEET_H` completo — hasta 30 preguntas en 2-3
  columnas, con las nuevas marcas finder en sus 4 esquinas.
- Bloque de identificación (RUT/nombre) **opcional** — mismo patrón de
  checklist "Poner RUT / Poner Nombre" ya construido en `/sheet` esta
  sesión. Si está desactivado, el bloque no lo incluye en absoluto (más
  chico todavía).

### Fase 2 — Modo de calificación "solo contraste"

- Nuevo `evaluation_type`/`evaluation_variant` (mismo patrón ya usado
  para DIA/PAES/custom) para este modo: calcula únicamente
  `N correctas / total`, sin pasar por el pipeline de identificación de
  alumno cuando no hay bloque de RUT/nombre presente.

### Fase 3 — Generación y escaneo

- Pantalla para generar/descargar SOLO el bloque compacto (imagen o PDF
  chico) para que el profesor lo pegue en su propio documento.
- Punto de entrada de escaneo que sepa que está buscando un bloque
  compacto (usa `findCompactBlockCorners()` + el loop de video-en-vivo
  de la Fase 0, en vez de `findCorners()`).

## Riesgos / preguntas abiertas
- Fase 0 es un prototipo de verdad, no una tarea garantizada — el
  resultado (funciona confiablemente / necesita ajustes / no es viable
  tal como está planteado) decide si se sigue a las fases siguientes tal
  cual, o se reconsidera el enfoque (marca más grande, exigir un
  encuadre más cerrado, limitar a una posición semi-fija después de
  todo, etc.).
- No se investigó todavía el detalle exacto de cómo el usuario "confirma
  encuadre" en pantalla (UI del visor en vivo) — se define durante la
  Fase 0 junto con el prototipo, no antes.

## Verificación
- Fase 0 es el punto de decisión real: si `findCompactBlockCorners()` no
  logra encontrar el bloque de forma confiable contra los fixtures con
  contenido ajeno, se reevalúa el enfoque antes de seguir.
- `npx tsc --noEmit`, `npx eslint`, `npm run build`, y `npm run test:omr`
  (con los nuevos fixtures) en cada fase.

---

# Auditoría de código (revisión contra el código y `omr_reference.json`)

Se verificó cada afirmación del plan contra el código real y el
`omr_reference.json` de la APK descompilada. Marca lo que confirma, las
desviaciones menores y las **tres adiciones obligatorias** que conviene
incorporar antes de iniciar la construcción (el otro modelo que audite
puede contrastar sus hallazgos con los de esta sección).

## ✅ Afirmaciones verificadas como correctas

- **`SHEET_W=1200, SHEET_H=1650`** (`src/tulector/sheet_layout.ts:18-19`):
  exacto. La coincidencia con el competidor no es casualidad —
  `omr_reference.json:310` dice textualmente `"dimensions": "1200x1650
  pixeles (proporcion cercana a US Letter)"`.
- **Anchors nuestros son sólidos de un solo borde**, no "doble borde":
  `src/tulector/sheet_render.ts:153-155` llama a
  `solidSquare(ctx, cx, cy, L.ANCHOR_SIZE)` con `ANCHOR_SIZE=40`
  (`sheet_layout.ts:33`) — un único `fillRect`. El competidor sí usa
  doble borde: `omr_reference.json:311` `"corner_marks": "4 cuadrados
  doble borde: outer 3px, inner 1px. Tamaño 50x50. Centros en (65,65),
  (1135,65), (1135,1585), (65,1585)"`. El contraste del plan es correcto.
- **`questionLayout()` soporta 1-4 columnas** (`sheet_layout.ts:220,287-298`):
  exacto. La extensión a un canvas chico es directa como dice el plan.
- **`findCorners()` L214-341 con 3 estrategias en cascada**:
  `src/tulector/omr.ts:214-341`. Confirmadas las 3: blob
  (`findCornersByBlobs` L189 → invocado L224), zonas 45% (L246-320),
  `findCornersByMass` L72 como fallback (invocado en L309/331/335/337-338).
  Todas asumen hoja pegada al borde del encuadre → no reutilizables para
  "en cualquier parte de una foto con contenido ajeno". El plan acierta.
- **`warpBilinear/warpImageData` reutilizable tal cual**: `warpImageData`
  L344, `warpBilinear` L491, `warpSheet` L530. Todas operan sobre 4
  esquinas abstractas → vale para el bloque compacto sin tocarlas. ✅
- **`omr_reference.json` — la APK confirma ProcessByteFrame + visor en
  vivo**: `omr_reference.json:34-57` (`ProcessByteFrame` signature),
  `:117-126` (`ScanningSquaresView` visor de cuadrados verdes),
  `:153` (`CameraX ImageAnalysis + Camera2 interop`),
  `:179-198` (`ImageAnalysis.Analyzer` corre cada frame),
  `:374` (`ScanningSquaresView`), `:400` (`STRATEGY_KEEP_ONLY_LATEST`).
  El hallazgo clave del plan (video en vivo, no foto fija) está bien
  documentado en el JSON.
- **`omr_reference.json:569` confirma detección del competidor por
  cuadrante expected**, no "en cualquier parte":
  `"corner_detection": "morphological close en C++ para unir doble
  borde. Centro de masa de pixeles oscuros en cada cuadrante"` — coincide
  con "tampoco resuelven este caso" del plan.
- **Loop de `src/app/scan/page.tsx` ya existe y es continuo**:
  `requestAnimationFrame(loop)` en L1008 (salida temprana) y L1153
  (relanzamiento al final). `frameSkipMs` en L1015. Comentario L1000-1001
  "con 5 fases en modo ráfaga, remontar en cada una arriesgaba perder
  frames" confirma que уже hay arquitectura de detección por frame. ✅
- **Checklist "Poner RUT / Poner Nombre" en `/sheet`**:
  `src/app/sheet/page.tsx:73-74` (`// RUT (burbujas), Nombre (recuadro),
  o ambos -- a eleccion del profesor`; state `printRut`). Patrón
  reutilizable para bloque compacto opcional exactamente como dice el
  plan. ✅
- **Patrón `evaluation_type`/`evaluation_variant` ya usado**: ver
  `20260627000000_paes_simce.sql` y `dashboard-v2-plan.md`. La nueva
  variante `compact_only` es coherente con el patrón existente. ✅
- **`sheet_code` mini como identificador del bloque** (idea de esta
  auditoría abajo, no del plan original): `readSheetCode()` ya existe
  (`omr.ts:1437`), la infraestructura del `sheet_code` (4-6 chars como
  burbujas) es directamente reutilizable dentro del bloque compacto para
  que la detección confirme "esto es un bloque TuLector" y lo enlace al
  `quiz` correcto.

## ⚠️ Desviaciones menores (cosmético, no invalidan el argumento)

1. **"zonas al 8% del borde"**: más preciso es "8% del ancho × 6% del
   alto". `findCornersByMass` (`omr.ts:74`) usa
   `Math.floor(w * 0.08), Math.floor(h * 0.06)`. No cambia el argumento
   del plan pero conviene precisarlo para que el implementador no lo
   reinstale mal.
2. **`captureFrame` no vive en L1008-1153**: el bucle `loop()` sí está en
   L1005-1153, pero `captureFrame` (la foto única del botón "Capturar")
   está en **L767**. El plan los mezcla. `captureFrame` es la acción del
   botón; `loop()` es el preview en vivo + detección. La conclusión del
   plan sigue en pie (ya hay loop continuo) pero conviene separarlos en
   la redacción para no confundir al segundo agente.
3. **`test_omr_real.ts` 667 vs 668 líneas**: 668 (probablemente contó sin
   el EOF). Mismo comentario para el otro modelo auditor.
4. **`omr_reference.json` habla de 50x50 + 3px/1px, pero el plan no
   cita** el renglón exacto (`:311, :569`). Conviene hacerlo para que el
   plan sea autocontenido y el segundo agente no "re-descubra" ese dato.

## 💡 Tres adiciones obligatorias antes de iniciar la construcción

El usuario pidió explícitamente: **"una imagen que lo peguen en un word y
luego permita revisarlo"**. El plan Fase 3 solo menciona de pasada
("pantalla para generar/descargar SOLO el bloque compacto"). Eso es
insuficiente para el flujo real Word → imprimir → fotografiar. Tres
adiciones que conviene incorporar al plan antes de cualquier código:

### Adición 1 — Pre-Fase 0: extraer utils puras de `omr.ts`

`omr.ts` tiene funciones *puras* reutilizables que el nuevo
`compact_block.ts` necesitará. Reescribirlas duplica código y riesgo:

- `otsuThreshold` (`omr.ts:112`)
- `validateQuad` (`omr.ts:132`)
- `findAnchorBlobs` (`omr.ts:153`)
- `sampleBilinear` (`omr.ts:466`)
- grayscale + integral image (`omr.ts:216-235`)

**Acción**: crear `src/tulector/image_utils.ts` con estas funciones
extraídas como exports. Importar desde `omr.ts` (sin tocar comportamiento
— mismo código, sólo mudado) y desde `compact_block.ts` nuevo. Fase 0
queda reducida a implementar únicamente el detector QR-pattern finder.

### Adición 2 — Fase 1: marca `sheet_code` mini dentro del bloque

El patrón finder QR (1:1:3:1:1) es robusto pero no exclusivo. Un logo
cuadrado negro de tamaño similar pegado en Word puede pasar
morfológicamente por un finder si el detector no está perfectamente
tuneado. más importante todavía: sin identificación interno, la API no
sabe a qué `quiz` pertenece el bloque que se está leyendo.

**Acción**: incrustar dentro del bloque compacto un mini `sheet_code`
(usando `readSheetCode()` `omr.ts:1437` ya existente). Beneficios:
1. Valida "esto es un bloque TuLector" (no cualquier cuadrado QR en la
   página del profesor con logos/tablas).
2. Enlaza el bloque al `quiz` correcto en backend, igual que la hoja
   completa actual.
3. Permite múltiples bloques en una misma hoja (caso futuro: el profesor
   reparte distintos bloques a distintos grupos sin confundirlos).

### Adición 3 — Fase 1.5: exportación PNG 300DPI + guía para el profesor

El flujo "generar → pegar en Word → imprimir → fotografiar" tiene
_distorsiones_ que la foto directa en `scan/page.tsx` no sufre:

- **Escalado de Word según DPI settings** del usuario.
- **Compresión JPEG** del insert de imagen.
- **Rotación** si el profesor pega en orientación landscape.
- **Contraste variado** según impresora (láser vs inkjet).

**Acción**: nueva Fase 1.5 (entre Fase 1 y Fase 2) con entregables:

1. **PNG con metadata DPI correcta** (`pHYs` chunk en PNG) a 300 DPI
   mínimo, con tamaño de bloque fijo declarado en mm (ej. 70×40 mm
   constante interna, no free — el usuario no debería poder
   estirarlo/encogerlo). Si Word respeta el `pHYs`, no reescalea.
2. **PDF de 1 página con solo el bloque** (alternativa al PNG para
   impresión directa sin Word).
3. **Preview en pantalla con regla en mm** (no solo pixels) para que el
   profesor vea "cómo se verá impreso" antes de descargar.
4. **Instrucciones impresas/tooltip**: "Pega este bloque manteniendo el
   tamaño 100% — no lo recortes ni estires". Modo de falla real y muy
   frecuente.
5. **Fixture de test end-to-end**: render del bloque → PNG 1x/0.85x/1.15x
   → pegar en `.docx` → exportar PDF → imprimir → fotografiar. Si este
   fixture pasa, el flujo del usuario real está garantizado. Si no,
   ajustar marcas antes de tocar la Fase 2.

## Orden de fases sugerido definitivo

1. **Pre-Fase 0**: extraer utils de `omr.ts` a `image_utils.ts`.
2. **Fase 0**: `findCompactBlockCorners()` + fixtures sintéticos con
   contenido ajeno (decisión go/no-go sobre la localización).
3. **Fase 0.5**: fixtures **Word → PDF → print → photo** con 3 tamaños
   (0.85x / 1x / 1.15x) antes de declarar viable. El fixture sintético
   puede pasar y este real fallar (escalado + compresión + impresión).
4. **Fase 1**: layout del bloque compacto en canvas chico + **mini
   `sheet_code`** como identificación interna.
5. **Fase 1.5** (nueva): exportación PNG 300DPI + PDF + preview en mm +
   guía impresa para el profesor. Es el flujo "pegar en Word y revisar"
   del enunciado del usuario.
6. **Fase 2**: `evaluation_type: "compact_only"` (sin RUT/nombre).
7. **Fase 3**: pantalla de generación del bloque + punto de escaneo
   seleccionando modo compacto (usa `findCompactBlockCorners()` + loop
   de video en vivo ya existente).

## Qué NO cambiaría del plan original

- ✅ `compact_block.ts` separado de `omr.ts` (cero riesgo de regresión).
- ✅ Patrón finder QR 1:1:3:1:1 (estándar y probado, más robusto que el
  doble-borde del competidor para escenas con contenido arbitrario).
- ✅ Live-tracking reusando el RAF loop existente (`scan/page.tsx:1005-1153`).
- ✅ RUT/nombre opcional via el patrón ya existente en `/sheet`.
- ✅ Fase 0 como punto de decisión go/no-go — muy maduro del plan original.
- ✅ `evaluation_type` nuevo (no parámetro en uno existente).

## Notas para el segundo auditor

- Tres claims del plan原始 son **imprecisas pero no invalidan**:
  "8% del borde" (mejor: "8%an × 6%al"), `captureFrame` mezclado con
  `loop()` (L767 vs L1005-1153), 667 vs 668 líneas de test. Corríjanse
  en una pasada de redacción, no afectan el razonamiento.
- Si el segundo auditor encuentra que `findCompactBlockCorners()` puede
  reutilizar `findCornersByBlobs` (`omr.ts:189`) con un cambio de
  parámetros — verifíquese primero; ese algoritmo también busca en
  bordes/zonas esperadas, no en cualquier parte de la imagen. El
  detector específico QR finder es necesario, no es parametrización.
- `omr_reference.json:311` confirma que el competidor tampoco soporta
  el caso "en cualquier parte" → el plan acierta al declarar "terreno
  nuevo". Si el segundo auditor objeta el enfoque citando el competidor,
  ese dato refuta la objeción.
- La SVM de clasificación de burbujas (punto 4 del "hallazgo clave" del
  plan, `classifier.ts` ya existe 932 bytes) — es ortogonal a la
  localización y mejor postpone, no bloquear Fase 0.
