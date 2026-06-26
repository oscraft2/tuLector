# Plan de remediación TuLector — concilia auditoría 1 + 2

Dos relojes en paralelo: **calibración** (destrabar pruebas reales) y **P0 seguridad/legal**
(antes de cualquier dato de alumnos). A1 = auditoría 1, A2 = auditoría 2, **ambas** = consenso.

Guardia de regresión en cada cambio: `npm run test:omr` (20/20+3/3) + `npm run build` +
sintaxis C++ (NDK clang) + (nuevo) test del camino del worker.

## FASE 0 — Calibración (no bloqueante legal)
- **0.1 Deduplicar el warp.** Eliminar la copia en `omr_worker.ts`; usar `warpImageData`.
  Resuelve A1 P1-3 (cuelgue si `solve8x8` falla) y A1 P1-4 (borde negro≠blanco). ✅
- **0.2 Guardia del camino real** (test que ejercite la ruta de `/scan`, no solo `warpImageData`). ✅
- **0.3 Timing parcial.** `validateFormat` y `gradeBubbles` comparten criterio; interpolar filas
  faltantes por regresión lineal en vez de caer al offset global. Resuelve A2 timing frágil. ✅
- **0.4 Aflojar `checkCurve`** (foto a mano tiene perspectiva). Causa probable del código 30. ✅
- **0.5 Umbral adaptativo** (Otsu local / normalización). A1 P1-7. → diferido a Fase 3 (necesita fotos reales).

## FASE 1 — P0 Seguridad scan_logs (urgente, hoy está público)
- **1.1 Mitigación:** rutear todos los inserts por `saveScanLog` (quitar bypass directo);
  tope de tamaño de payload. ✅ (parcial)
- **1.2 Auth anónima + Storage privado + RLS por `user_id`** (decisión del usuario: cambia el flujo). ⏳

## FASE 2 — P0 Legal clean-room
- `git filter-repo` para purgar `omr_reference.json`, `tulector_tech.json` del historial;
  rotar credenciales Zendesk ajenas; cambiar comentarios "Port 1:1" / referencias a la spec. ⏳

## FASE 3 — Dataset real
- 30→300 fotos impresas etiquetadas; matriz de fixtures versionada. ⏳

## FASE 4 — Robustez de visión
- Usar las 12 anclas (registro por bloques) — A1 P1-6/A2. Warp bilineal — A1 P1-10/A2. ⏳

## FASE 5 — Paridad, clasificador, móvil
- Generar `sheet_layout`/`CALIB` desde JSON único → TS+C++ + golden test — A2 paridad.
- `OmrResult`/bridge con `diag` — A2. Clasificador entrenado — A1 P1-9/A2. Móvil YUV/rotación — A2 P2. ⏳

Leyenda: ✅ hecho en esta tanda · ⏳ pendiente
