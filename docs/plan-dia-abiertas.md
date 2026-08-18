# Cargar preguntas abiertas a DIA + finalizar el instrumento completo

Estado: **EN CONSTRUCCIÓN** (2026-08-17). Copiado del plan de sesión para que sobreviva entre
conversaciones (ver `feedback_plan_file_reuse` en memoria: el archivo de plan de sesión se reusa
entre tareas distintas).

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

- **Fase 0 — Captura real del payload** (bloqueante para Fase D, la ejecuta el profesor en vivo):
  entrar en DIA a un alumno con pregunta abierta real, escribir un valor de prueba + código, usar
  "GUARDAR Y VOLVER" (nunca "FINALIZAR"), y copiar la captura técnica del popup de la extensión.
- **Fase B — Mapeo de código en tuLector** (`src/lib/dia_codigo.ts`, construida en esta sesión):
  `open_answers` → código DIA (0/1/2), usando solo `confirmed_points`.
- **Fase C — Exportar código en `export-dia`**: `src/lib/dia_export.ts` deja de forzar `""` en
  preguntas abiertas, hace join con `open_answers` y aplica el mapeo de Fase B.
- **Fase D — Extensión: enviar abiertas a DIA** (depende de Fase 0): `lib/answer_payload.js` +
  `lib/csv.js` en `dia-bot-extension`.
- **Fase E — Finalizar instrumento completo** (opcional, después de B-D probadas en vivo): retomar
  F2/F3 de `dia-bot-extension/docs/PLAN_FINALIZAR_Y_ABIERTAS.md` (ya diseñadas, nada implementado).

## Verificación

- Fase B: `src/lib/dia_codigo.test.ts` (casos borde: sin respuesta, parcial, perfecta, incorrecta
  con texto, sin confirmar todavía).
- Fase C: comparar el CSV exportado contra un ensayo con abiertas ya calificadas/confirmadas.
- Fase D/E: nunca ejecutar el modo real contra DIA sin confirmación explícita en el momento —
  escribe en una plataforma de gobierno en vivo.
