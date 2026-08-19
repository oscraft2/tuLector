# Cargar preguntas abiertas a DIA + finalizar el instrumento completo

Estado: **Fases 0-E construidas (2026-08-19)**. Falta probar Fase E (finalizar) en vivo contra un
alumno de prueba, y la prueba E2E real de todo el flujo contra un curso completo. Copiado del plan
de sesión para que sobreviva entre conversaciones (ver `feedback_plan_file_reuse` en memoria: el
archivo de plan de sesión se reusa entre tareas distintas).

## Contexto

Hoy la sync tuLector.app ↔ DIA (extensión `dia-bot-extension` en `C:\Users\usuar\dia-bot-extension`
+ endpoint `export-dia` en este repo) solo carga preguntas de alternativas. Las preguntas abiertas
("de desarrollo") se saltan por completo, así que un ensayo nunca queda 100% cargado en DIA y nunca
se puede finalizar. Objetivo: que tuLector entregue también el código de las preguntas abiertas, y
que la extensión pueda finalizar el instrumento una vez todo esté cargado.

## Diagnóstico

**Cómo pide DIA el código, confirmado en vivo contra la pantalla real de "Ingreso de respuestas" +
la pauta de corrección oficial descargada (no estaba documentado en ningún repo antes de esta
sesión):** cada pregunta abierta tiene un cuadro de texto + selector **"CÓDIGO"** con valores
**0, 1, 2**:
- **Código 2** = respuesta correcta
- **Código 1** = respuesta parcialmente correcta
- **Código 0** = respuesta incorrecta **o en blanco / no responde**

Un alumno que no escribió nada queda en **código 0** por defecto (confirmado con el profesor,
coincide con la definición oficial de "no responde" de la pauta DIA).

"Finalizar" en la API de DIA es a nivel de **instrumento completo por alumno**
(`finalizarInstrumentoRendido`, ver `dia-bot/docs/FINDINGS.md` sección 12.2 — POST con el
`idInstrumentoRendido` como valor plano, **irreversible**, confirmado en vivo), no pregunta por
pregunta. Se hace una vez que ese alumno tiene alternativas + abiertas ya cargadas.

**Lo que ya existe y se reusa:**
- `dia-bot-extension/lib/answer_payload.js` — `aplicarRespuestas()` hoy es exclusivo de
  `SELECCION_UNICA_SIMPLE`; cualquier `ABIERTA_*` se devuelve sin tocar.
- El payload de DIA ya reserva campos para esto, siempre `null` en el único ejemplo capturado
  hasta ahora (ver `dia-bot/docs/FINDINGS.md`): `respuestaAbierta`, `respuestaEscalar`,
  `criterioEscritura`, `puntaje`, `puntajePapel`. **Nunca se ha capturado un ejemplo real** con
  estos campos poblados — pendiente en `dia-bot-extension/docs/PLAN_FINALIZAR_Y_ABIERTAS.md`
  (Fase A1) y en `dia-bot/docs/FINDINGS.md` (§12.2, pendiente #3).
- La extensión **ya tiene construido** el mecanismo de captura para esto: `inject.js` intercepta
  cualquier XHR que matchee `/finalizar|guardarrespuestas/i` y lo guarda en
  `chrome.storage.session`, visible/copiable desde el popup en "🔬 Captura técnica (temporal)". No
  hay que construir nada nuevo — solo falta usarlo una vez contra una pregunta abierta real.
- En tuLector, `open_answers` (migración `20260724010000_open_answers.sql`) ya tiene el pipeline
  completo de corrección con IA + confirmación humana: `transcripcion`, `puntaje`, `max_points`,
  `confianza`, `legible`, y `confirmed_points`/`confirmed_at`. `src/lib/quiz_score.ts` ya usa
  exclusivamente `confirmed_points` para la nota, nunca el puntaje sugerido sin confirmar.
- **Pero** `export-dia` nunca lee esa tabla: `src/lib/dia_export.ts` fuerza cada celda de pregunta
  abierta a `""` siempre. Aunque un profesor ya calificó y confirmó todas las abiertas en tuLector,
  nada de eso llega hoy al CSV que usa la extensión.

## Plan de trabajo

- **Fase 0 — Captura real del payload — CERRADA (2026-08-18/19).** Confirmado en vivo para los 3
  subtipos reales de la prueba de referencia (P27/P29/P33):
  - `ABIERTA_SIMPLE` (P29): el código (0/1/2, mismo rango que `pregunta.tipoPregunta.puntajes`) va
    en **`puntajePapel`** (número). `respuestaAbierta` queda `null` aunque no se escriba texto —
    no hace falta para que el guardado sea aceptado. `estado` pasa a `"RESPONDIDA"`.
  - `ABIERTA_ENTERO_DECIMAL` (P33): el valor va en **`respuestas[0].respuestaEscalar`** (string),
    comparado por DIA contra `pregunta.escalares[0].valorCorrecto` (autocorrección). `puntajePapel`
    queda `null` — la UI real de DIA para este tipo ni siquiera tiene el selector de código.
  - `ABIERTA_PAR_ORDENADO` (P27): misma familia que `ENTERO_DECIMAL` pero con 2 casilleros
    (`respuestas[]` con `orden:1`/`orden:2`, cada uno con su propio `respuestaEscalar`) — inferido
    por la forma de la pauta y la estructura del payload, no se llegó a guardar un valor real de
    prueba para confirmarlo al 100%.
- **Fase B — Mapeo de código en tuLector — CERRADA.** `src/lib/dia_codigo.ts`: `open_answers` →
  código DIA (0/1/2), usando solo `confirmed_points`.
- **Fase C — Exportar código en `export-dia` — CERRADA.** `src/lib/dia_export.ts` hace join con
  `open_answers` y aplica el mapeo de Fase B a toda pregunta abierta configurada en el ensayo.
- **Fase D — Extensión: enviar abiertas a DIA — CERRADA (2026-08-19).**
  `dia-bot-extension/lib/answer_payload.js` (`aplicarAbierta()`) ya sube las 3: `ABIERTA_SIMPLE`
  vía `puntajePapel`, `ABIERTA_PAR_ORDENADO`/`ABIERTA_ENTERO_DECIMAL` vía `respuestaEscalar`.
  **Decisión explícita del usuario** (no la propuesta original de este doc): en vez de dejar
  par-ordenado/entero-decimal para carga manual, se sube el mismo valor de la columna del CSV
  (0 por defecto) también ahí — aunque semánticamente sea un "código" y esos tipos en realidad
  quieran el número literal que escribió el alumno. Es decir: para esos 2 tipos, el envío
  automático hoy escribe el mismo 0/1/2 en el casillero numérico, NO la respuesta real transcrita
  — hay que revisarlas/corregirlas a mano en DIA antes de finalizar si importa el valor exacto
  (afecta la autocorrección de DIA para esas 2 preguntas puntuales).
- **Fase E — Finalizar instrumento completo — IMPLEMENTADA (2026-08-19), sin probar en vivo
  todavía.** `dia-bot-extension`: `lib/dia_client.js` + `background.js` (mensaje de puerto
  `"finalizar"` separado, nunca automático) + `popup.js`/`popup.html` (paso aparte con doble
  confirmación, solo ofrece alumnos "completos" de la corrida real). Detalle en
  `dia-bot-extension/docs/PLAN_FINALIZAR_Y_ABIERTAS.md`. Falta correrlo de verdad contra 1 alumno
  de prueba antes de usarlo sobre un curso completo.

## Verificación

- Fase B: `src/lib/dia_codigo.test.ts` (9 casos, todos verdes).
- Fase C: `src/lib/dia_export.test.ts` (4 casos, todos verdes).
- Fase D: `dia-bot-extension/lib/answer_payload.test.js` (18 casos incl. los 3 subtipos abiertos,
  todos verdes).
- Falta la prueba E2E real: correr el flujo completo (tuLector calificado → CSV → extensión →
  DIA) sobre un curso de II medio real y comparar contra lo esperado antes de dar por cerrado.
- Fase E: nunca ejecutar el modo real de finalizar sin confirmación explícita en el momento —
  escribe en una plataforma de gobierno en vivo y es irreversible.
