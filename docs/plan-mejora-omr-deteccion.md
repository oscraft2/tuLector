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

**Hipótesis de la causa raíz — EN DUDA, refutada parcialmente por el usuario (2026-08-19).** El
usuario observa que otras hojas de la MISMA plantilla, con mejor calidad de marca, se leen
correctamente — así que no es un bug permanente de esta plantilla (el motor no confunde el bloque
RUT con preguntas siempre). Hipótesis revisada: es probable que solo pase cuando la pista de
temporización (timing track) no se lee completa en esa hoja puntual — el KPI del registro
`7033cb37` mostraba **"18 marcas de tiempo leídas"**, y si el número real de filas de pregunta es
mayor, eso sugiere que la lectura de timing track falló parcialmente en ESTE escaneo (probablemente
por la calidad/ángulo de la foto, no por la plantilla), y el motor cayó a un método de fallback
(`findGridOffset` u otro conteo aproximado) que ahí sí se confunde con el bloque RUT. **Pendiente de
verificar antes de tocar código**: comparar este registro contra otro escaneo bueno del MISMO
instrumento en `/admin/usage` y confirmar cuántas marcas de temporización se esperan v/s se leyeron
en cada caso — recién con eso se puede aislar si el bug está en el fallback (probable) o en otro
lado.

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

**3. Activar el clasificador entrenado ya construido pero apagado — INTENTADO 2026-08-19, TODAVÍA
NO ES SEGURO, confirmado en la práctica (no solo en teoría).**
`src/tulector/classifier.ts` tiene un clasificador logístico ya armado
(`CLASSIFIER: {w,b} | null`), apagado por defecto. Se corrió el pipeline completo:
`export_dataset.ts` → **32 escaneos etiquetados, sin cambio desde el intento anterior del
2026-08-17** (último "Confirmar lectura" real: 2026-07-22 — casi un mes sin datos nuevos) →
`train_classifier.ts` → mismos pesos/accuracy que antes (95.5%, dataset idéntico) → pegados en
`classifier.ts` → `npm run test:omr` → **se rompe exactamente igual que la vez pasada**: guardia de
4 columnas falla (`q100 leyó "AB" esperaba "B"`). Revertido a `CLASSIFIER = null` de inmediato, 28
guardias verdes de nuevo, working tree limpio.

Causa confirmada del bloqueo: el dataset etiquetado nunca superó 40 preguntas / 2 columnas por
escaneo (máximo observado en los 32 ejemplos) — no cubre layouts densos (3-4 columnas, ~75-100
preguntas), que es justo donde el guardia rompe. **No es seguro reintentar esto hasta juntar
"Confirmar lectura" de hojas reales con 3-4 columnas** — la funcionalidad de "Confirmar lectura" ya
existe (`/scan` y el panel de auditoría), solo falta que se use en hojas de ese formato.

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
