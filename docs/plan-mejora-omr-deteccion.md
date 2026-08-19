# Plan: mejorar detección OMR — desalineamiento de filas cuando hay bloque RUT adyacente

Estado: **PROPUESTO — nada implementado.** Análisis hecho en sesión 2026-08-19 a partir de un caso
real reportado por el usuario (auditoría OMR `7033cb37`), con lectura completa del motor
(`src/tulector/omr.ts`) y del registro real en `/admin/usage`. El usuario pidió explícitamente
**solo analizar y proponer, sin tocar el motor** — este doc es esa propuesta, para retomarla cuando
se decida implementar.

## Contexto

El profesor reportó un escaneo (`admin/usage/7033cb37-5f45-4e50-acca-4ab073a1001d`, "Ensayo N° 2
Matemática 7mo — 7° Básico A") que muestra casi ninguna alternativa detectada, a pesar de que en la
foto se ven burbujas claramente marcadas. Motivo original de la duda: "me acuerdo que en el motor
tenía un sistema que podía mejorar" — esa recolección terminó siendo real (ver punto 3 de la
propuesta), aunque no es la causa de este caso puntual.

## Diagnóstico confirmado (con evidencia del propio registro, no una hipótesis)

**No es un problema de umbral de tinta ni de foco/contraste.** Es un **desalineamiento de filas**:
el motor asigna los primeros ~9 números de pregunta a las filas del **bloque RUT**, no a las filas
reales de alternativas.

Evidencia, comparando la vista "Plano Proyectado" (la imagen ya enderezada que usa el motor para
leer) contra la tabla "Datos de Lectura OMR" del mismo registro en `/admin/usage/[id]`:
- Las etiquetas de fila reales de la hoja (impresas en el margen izquierdo: "1, 2, 3, 4...") quedan
  alineadas verticalmente con el **bloque RUT** (a la derecha) en las primeras ~9 filas, no con la
  grilla de alternativas.
- El motor lee **Q1 a Q9 desde las burbujas del RUT** (5 columnas de dígitos 0-9, no A-D) — por eso
  salen casi todas en blanco (`"-"`, scores ~0.00): la lógica de alternativas A-D no encuentra nada
  parecido a una marca real ahí. Q1 coincidentalmente leyó "D" (score 0.51) porque una burbuja de
  RUT oscura cayó donde el motor esperaba la opción D.
- Desde ahí en adelante, las preguntas reales (fila numerada "1", "2", "3"... en la hoja) quedan
  etiquetadas como **Q10, Q11, Q12...** — además de perderse las primeras ~9 preguntas, **todas las
  siguientes quedan corridas ~9 posiciones**, atribuidas al número de pregunta equivocado.
- Dato adicional que encaja: `Q6` y `Q12` tienen `scores: []` (array vacío, ni siquiera se calculó
  nada) — señal de que esas posiciones cayeron directamente fuera de cualquier burbuja real.
- El RUT en sí **se leyó bien** (`24252115-3`, dígito verificador OK) — tiene sentido: la lectura
  de RUT (`readRut` en `omr.ts`) usa su propio anclaje independiente del conteo de filas de
  preguntas, así que no comparte el bug.
- "Alineación Local: dx 0px / dy 0px" y "Timing Track: 18 marcas de tiempo leídas" — el motor
  reporta esto como si estuviera todo bien (`Estado: VÁLIDO`, no rechazado), confirmando que el
  bug no es un rechazo — es una lectura "exitosa" con las filas contadas mal desde el principio.

**Hipótesis de la causa raíz** (a confirmar por quien lo implemente, revisando
`readTimingRows`/`rowsFromTiming` y el fallback `findGridOffset` en `src/tulector/omr.ts`): en esta
plantilla de hoja, el bloque RUT está ubicado verticalmente al lado de donde empiezan las
preguntas, y el motor no está descontando/saltando las filas que corresponden al bloque RUT antes
de empezar a numerar preguntas — cuenta 18 marcas de tiempo pero las asigna desde arriba del todo,
incluyendo filas que en realidad pertenecen al RUT.

## Por qué nadie lo había visto (gap en el sistema de auditoría, no solo en el motor)

El dashboard de `/admin/usage` (Motor OMR & Diagnóstico) solo trackea **rechazos duros** ("Lecturas
Fallidas", con motivos como "Falta ancla de esquina", "Warp vacío"). Este escaneo **no fue
rechazado** — pasó como `VÁLIDO (Graded)`, así que es invisible en las métricas agregadas. No
existe hoy ninguna señal de "escaneo válido pero sospechosamente en blanco" que hubiera hecho
saltar esto sin que un profesor lo mirara a mano. Es probable que haya más casos así, silenciosamente
arruinando notas, sin que el panel de monitoreo lo muestre.

## Plan de trabajo propuesto (priorizado, nada implementado)

**1. Arreglar la causa raíz — desalineamiento de filas cuando hay bloque RUT adyacente.**
Revisar `readTimingRows`/`rowsFromTiming` (y el fallback `findGridOffset`) en `src/tulector/omr.ts`
para que las filas del bloque RUT nunca se cuenten como preguntas. Como es un bug de conteo de
filas (no de umbral de tinta), no tocar `CALIB.inkMinDelta` para esto — cambiar ese umbral arriesga
revivir el bug de invención de respuestas ya corregido (guardia "Anti-invención", `omr.ts:571-577`).

**2. Agregar una métrica de "válido pero sospechoso" al dashboard de auditoría.**
Hoy `/admin/usage` solo cuenta rechazos duros. Agregar un conteo de escaneos `VÁLIDO` con, por
ejemplo, >70-80% de preguntas en blanco, mostrado como categoría separada (no mezclado con
"Lecturas Fallidas") para que estos casos salten a la vista sin depender de que un profesor lo note
por casualidad al revisar notas raras.

**3. Activar el clasificador entrenado ya construido pero apagado.**
`src/tulector/classifier.ts` tiene un clasificador logístico ya armado
(`CLASSIFIER: {w,b} | null`) que hoy está en `null` — "el motor usa la heurística actual, cero
cambio. Solo se activa cuando haya datos reales suficientes y pase el test" (comentario del propio
archivo). Esto es casi seguro **"el sistema que podía mejorar"** que el usuario recordaba. El
pipeline para entrenarlo ya existe (`scripts/export_dataset.ts` + `scripts/train_classifier.ts`,
alimentado por las correcciones manuales que ya se guardan en `scan_logs` vía el panel de auditoría
/ "Confirmar lectura" de `/scan`). No resuelve el bug de filas de este caso puntual, pero es la vía
ya construida para que el motor aprenda de casos reales difíciles (letra tenue, marcas parciales)
en vez de depender solo de umbrales fijos.

**4. Ampliar las pruebas del motor con casos reales degradados, no solo sintéticos.**
`test_omr_real.ts` ya prueba sombra/bajo-contraste/foto lavada, pero con ruido **sintético
uniforme** generado en código, no con una segunda foto real degradada. `docs/omr-spec.md` pide
explícitamente fixtures de "hojas reales impresas" con luz baja/sombras/lápiz tenue, pendiente
según el propio doc. Esta plantilla (RUT adyacente a las preguntas) tampoco tiene un fixture de
test dedicado — valdría la pena agregar uno que la reproduzca como caso de regresión, una vez
entendida la causa exacta.

## Verificación (para cuando se decida implementar)

- Reproducir el bug con esta misma plantilla de hoja (Ensayo N°2 Matemática 7mo) en un test
  aislado, confirmando que hoy el motor cuenta el bloque RUT como preguntas 1-9.
- Corregir el conteo de filas y volver a correr el "Re-análisis" (`OMRReanalyzePanel.tsx`, ya
  existe en `/admin/usage/[id]`) sobre este mismo registro para comparar antes/después sin
  necesidad de una hoja nueva.
- `npm run test:omr` debe seguir en verde (26/26 guardias) después de cualquier cambio — incluye
  el guardia anti-invención, que no debe romperse al arreglar esto.
- Antes de implementar el punto 3 (activar el clasificador), correr `scripts/export_dataset.ts` +
  `scripts/train_classifier.ts` sobre datos reales suficientes y confirmar que pasa el test propio
  antes de pegar los pesos en `classifier.ts` (tal como indica el comentario del archivo).
