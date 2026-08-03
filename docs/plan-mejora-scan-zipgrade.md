# Plan: Modo ráfaga + feedback sensorial + nombre en HUD (tuLector vs ZipGrade)

> Estado: PLAN DE DISEÑO, no implementado. Este documento está pensado para ser auditado por otra IA/revisor antes de tocar código. Todo lo marcado "CONFIRMADO" fue verificado leyendo el código real del repo (no es una suposición); lo marcado "SUPUESTO/INFERIDO" es una hipótesis (ej. comportamiento de ZipGrade, que no tenemos acceso a su código) y debe tratarse como tal.

> **AUDITORÍA 2026-08-02 (contra el código real)**: el plan fue re-verificado línea por línea contra `page.tsx`, `scanner_config.ts`, `route.ts`, `offline_queue.ts`, `package.json` y `omr.ts`. Casi todo lo marcado CONFIRMADO resultó exacto. Las correcciones quedaron integradas en el cuerpo, marcadas como **[AUDIT-CORRECCIÓN]**, y las mejoras nuevas de velocidad como **[AUDIT-MEJORA]**. Resumen:
> - §2.2 corregido: hoy los errores NO van al modal (banner + vuelta a `"detecting"`); el modal solo aparece en éxito. El gate feliz/error es un **cambio de comportamiento**, no "sin cambios" → en modo ráfaga, nada bloquea.
> - §2.2/§3.1: el cooldown de 2500ms solo se arma con el tap manual (`setLastScan` solo existe en `nextScan()`); en ráfaga hay que cablearlo en el disparo automático y bajarlo a ~1000ms.
> - Nueva fase **P0-D (costo por frame, §3.6)**: detección en frame reducido, nitidez dentro del quad, `stableFramesNeeded` 5→3, micro-opts de votación. Es la palanca de velocidad que el plan original no tocaba.
> - Objetivo cuantificado + instrumentación de tiempos (§7): p50 ≤ 3s hoja-a-hoja, ≥20 hojas/min.

## 1. Contexto y motivación

El dueño del proyecto (única persona a cargo de tuLector.cl) probó ZipGrade (competidor directo, app de corrección de hojas OMR con celular) y quedó impresionado por tres cosas que tuLector hoy NO tiene, en sus propias palabras: *"la rapidez que podía leer la hoja... dejando el celular móvil y pasando a la otra, entregando además del RUT, el nombre en una transparencia"*, además de feedback sonoro y visual en tiempo real. Pidió un plan de mejora potente, comparando/haciendo ingeniería inversa de ZipGrade contra el estado actual de tuLector.

Prioridad explícita del usuario, en orden:
1. **Velocidad de flujo continuo** — escanear en ráfaga, sin fricción manual entre hoja y hoja.
2. **Feedback sonoro + visual en tiempo real** durante la captura.
3. **RUT + NOMBRE del alumno** mostrados en una superposición transparente inmediatamente después de escanear (ZipGrade lo hace; tuLector hoy solo muestra RUT, en un modal bloqueante).

Nota sobre ZipGrade (SUPUESTO/INFERIDO, no verificado con su código fuente — solo por conocimiento general de cómo funcionan apps de este tipo y lo que el usuario describió): probablemente resuelve el nombre por lookup contra un roster/lista de curso precargada por ID/código, no por OCR de escritura a mano, y su modo de captura es continuo (detecta, captura, vibra/suena, vuelve a detectar) sin modal bloqueante entre hojas.

## 2. Estado actual de tuLector — hallazgos confirmados en el código

Repo: `C:\Users\usuar\Desktop\tulector` (Next.js App Router + Capacitor; el APK es un WebView que carga la web remota vía `server.url` en `capacitor.config.ts` — no hay build nativo de UI separado, todo el código de captura es compartido web/APK).

### 2.1 Arquitectura de captura — CONFIRMADO

Archivo central: `src\app\scan\page.tsx` (~1298 líneas).

Flujo: `<video>` en vivo (`getUserMedia`, o `@capacitor/camera` de alta resolución si `isNativeApp()` es true, ver `src\lib\native\capacitor.ts`) → loop `requestAnimationFrame` (líneas ~865-980) que en cada frame (~66ms):
- Detecta 4 esquinas (`findCorners`, motor en `src\tulector\omr.ts`, dos métodos: blobs por forma con fallback a densidad por imagen integral).
- Calcula nitidez (`isFrameSharp`) y valida geometría (ratio de aspecto, área mínima, línea ~925).
- Si `corners && sharp && valid` (línea ~927): dibuja feedback verde, marca `detected=true, inFocus=true`, incrementa `stableFrames`.
- Cuando `stableFrames.current >= stableFramesNeeded` (línea ~955): dispara `runVotingScan()`.

`runVotingScan()` (líneas 545-655): vota hasta 3 frames válidos, timeout 4s, corte anticipado si 2 frames dan resultados idénticos (línea ~586). Al terminar exitosamente: `setPhase("result")` + `navigator.vibrate(100)` (línea 650/652) + `void syncResult(...)` en background.

`processScan()` (líneas 427-539) es el camino alternativo (foto manual vía botón, no ráfaga automática) — mismo patrón: éxito → `setPhase("result")` + vibrate (línea 532); error → `setError(...)` sin ningún feedback físico (líneas 482-514).

**El OMR corre 100% client-side, sin Web Worker** (comentario explícito en el código descartando el Worker por colgarse si `solve8x8` falla). Solo el resultado ya calificado + thumbnails comprimidos viajan a `/api/scan/result`. Esto es clave: el feedback en tiempo real (sonido/vibración/overlay) NO depende de red; solo el nombre del alumno depende de la respuesta del servidor.

### 2.2 El cuello de botella de velocidad — CONFIRMADO

`ScanPhase` (línea 17, `src\app\scan\page.tsx`) hoy es `"detecting" | "scanning" | "result"` (más un valor `"cooldown"` **declarado en el tipo pero jamás usado en ningún `setPhase()`** — confirmado con grep, es un slot libre).

Al llegar a `phase === "result"` se muestra un **modal bloqueante** (líneas 1189-1273): overlay full-screen `bg-black/60 backdrop-blur-sm` con el puntaje, grid de respuestas, badge de RUT, y dos botones — "Confirmar lectura" (etiquetado para dataset ML, ver 2.6) y **"Siguiente"** (línea 1268, `onClick={nextScan}`), que es el único camino para volver a `phase="detecting"` y poder escanear la próxima hoja.

Comentario explícito en el código, línea 533: *"El resultado queda en pantalla hasta que el profe pulse 'Siguiente'"*. Esto es el cuello de botella #1: cada hoja exige un tap manual, sin excepción, sin importar si el escaneo fue perfecto.

**[AUDIT-CORRECCIÓN] — el modal hoy aparece SOLO en éxito, no en errores.** Las ramas de mala calidad NO muestran modal: `WRONG_FORMAT` (línea 486), `OUT_OF_FOCUS` (499), `CURVE_FAIL` (510) y fallo de votación sin frame estable (595) hacen `setPhase("detecting")` + banner rojo (`setError`, líneas 1038-1042) y el escaneo continúa solo. Es decir, hoy el flujo de errores ya es no-bloqueante y el tap obligatorio existe únicamente en el caso feliz. Esto es clave para el gate (ver 3.1): mandar los casos malos a un modal bloqueante sería una **regresión de velocidad respecto a hoy**, no "comportamiento actual sin cambios".

Agravante: **el loop de detección se apaga por completo mientras `phase === "result"`** (línea 867: `if (!stream || phase === "result") return;`). Es decir, hoy no existe ningún mecanismo de "detectar que la hoja salió de cuadro" — si se eliminara el modal sin más, la misma hoja podría re-dispararse sola apenas se cumplieran los frames estables.

Existe un gate de cooldown por tiempo, casi decorativo hoy: `cooldownMs = SCAN_THRESHOLDS.scanCooldownMs` (2500ms) y `canScan = Date.now() - lastScan > cooldownMs` (línea ~282 y ~954) — no resuelve el problema de fondo porque el loop ya está apagado en ese momento.

**[AUDIT-CORRECCIÓN]**: `setLastScan()` solo se llama dentro de `nextScan()` (línea 984), es decir, solo tras un tap manual. En un flujo de ráfaga sin tap, `lastScan` queda obsoleto y `canScan` queda siempre `true`: el "piso mínimo de seguridad" no operaría si no se cablea en el disparo automático (ver 3.1). Además `lastScan` es `useState` y está en las dependencias del loop RAF (línea 980), así que cada actualización remonta el loop (ver riesgo 4). Y el valor importa: 2500ms fija un techo duro de ~24 hojas/min al flujo; ver 3.1 para el valor propuesto (~1000ms → techo ~40/min).

### 2.3 Señales que hoy fuerzan revisión manual — CONFIRMADO, todas locales/síncronas salvo las de servidor

Estas se conocen ANTES de llamar a `syncResult()` (no dependen de red):
- `report.valid === false` → formato inválido (`WRONG_FORMAT`).
- `answeredCount === 0` → fuera de foco / nada leído (`OUT_OF_FOCUS`).
- `answerSet.size === 1 && answeredCount > 3` → papel curvado (`CURVE_FAIL`).
- `checkSheetCode()` (línea 211-217) → hoja de otro ensayo (`sheetWarn`), comparación local contra `activeSheetCode` cargado una vez al abrir el ensayo.
- `rutR.dvOk` → dígito verificador de RUT inválido, calculado en `readRut()`, local y síncrono.

Estas SÍ dependen de la respuesta de `/api/scan/result` (llegan tarde, vía red, dentro de `syncResult()`, líneas 302-397):
- `multipage?.reason` (tabla `paper_pages` no habilitada en producción, o falta ID/código de hoja).
- `multipage && !multipage.complete` (falta alguna página del ensayo multipágina).
- `sheetMismatch` (duplicado detectado en servidor).
- `payload.status === "manual_review"` (alumno no matriculado, cupo excedido, etc.).

Esto simplifica el diseño del modo ráfaga: la decisión "auto-avanzar vs. bloquear para revisión" se puede tomar en el 95% de los casos **sin esperar la red**.

### 2.4 El nombre del alumno ya viaja del backend y se descarta — CONFIRMADO

`src\app\api\scan\result\route.ts`:
- `findStudentByCode()` (líneas ~89-120) busca en la tabla `students` por `rut_normalized` o `student_id`, trayendo columnas `id, student_id, rut, rut_normalized, name`.
- La respuesta del endpoint incluye `studentName` (líneas 195, 202, 299: `return NextResponse.json({ action, paperId, status, matchedStudent, studentName, studentCode, ... })`) y también persiste `student_name` en la fila guardada (línea 214: `student_name: studentName ?? (studentCode ? "Sin identificar" : "Sin RUT")`).

En el frontend, `syncResult()` (`src\app\scan\page.tsx:302-397`) hace `const payload = await response.json()` (línea 327) y lee `payload.score`, `payload.quota`, `payload.multipage`, `payload.status`, `payload.studentCode`, `payload.sheetMismatch` — **pero nunca `payload.studentName`**. El modal solo muestra `RUT: {studentId.join("")}` (línea 1206), que es el RUT leído localmente por OMR, no el nombre resuelto en servidor.

Conclusión: mostrar el nombre del alumno (lo que más impresionó al usuario de ZipGrade) es, en el caso feliz, tan barato como capturar un campo que el backend ya envía y hoy se tira a la basura. **No requiere ningún cambio de backend.**

Caso offline: `src\lib\offline_queue.ts` (`enqueueScan`) no tiene campo de nombre — no hay roster cacheado localmente, así que en modo sin conexión no hay forma de mostrar el nombre hasta sincronizar.

### 2.5 Feedback sonoro/háptico — CONFIRMADO, prácticamente inexistente

Búsqueda exhaustiva (`grep` de `Audio|beep|playSound|.mp3|.wav|.ogg|AudioContext` en `src/`): cero resultados relevantes. No hay archivos de audio en el repo, no hay librería de sonido en `package.json`.

Único feedback físico hoy: `navigator.vibrate(100)`, en dos lugares (`scan/page.tsx:532` y `:652`), SOLO en el camino de éxito, sin patrón diferenciado, y **nunca** en errores.

**Problema de plataforma confirmado**: `navigator.vibrate` no existe en WKWebView de iOS (Safari/iOS nunca implementó la Vibration API estándar) — en el build de iOS del APK, esas dos líneas son hoy un no-op silencioso. No hay `@capacitor/haptics` instalado (`package.json` solo tiene los plugins Capacitor: android/app/browser/camera/cli/core/ios/network/share/splash-screen/status-bar).

Existe una config pensada para esto y **nunca cableada**, en `src\tulector\scanner_config.ts`:
```ts
export const SCAN_PREFS = {
  focusReq: { default: 50, min: 1, max: 100 },
  brightDetect: { default: true },
  resolutionSelection: { default: "0" },
  playShutterSound: { default: true },   // NO conectado a nada
  vibrateOnScan: { default: true },      // NO conectado a nada
  showPaperOnScan: { default: false },
  betweenGrading: { default: "0" },
  onePaperPerStudent: { default: true },
  warnBeforeOverwriting: { default: true },
} as const;
```
Confirmado con grep: este objeto no se importa en ningún otro archivo del repo. Parece un placeholder ya pensado (con nombres que calzan casi 1:1 con las preferencias reales de ZipGrade) pero nunca conectado a UI ni a lógica.

También en `scanner_config.ts` existen `SCAN_CODES` (GRADED=1, BRIGHT=5, CURVE_FAIL=10, WRONG_FORMAT=30, ALIGN_START/END=100-106, OUT_OF_FOCUS=1001) y `SCAN_MESSAGES` con el texto por código — es esencialmente el "enum de eventos" que se necesita para mapear código→sonido/vibración.

### 2.6 Feedback visual en tiempo real — CONFIRMADO

Overlay (`overlayRef`, canvas dibujado cada frame dentro del mismo loop RAF):
- Guía de encuadre fija (rectángulo punteado blanco translúcido), siempre visible, no depende de detección.
- Si `corners && sharp && valid`: círculos verdes (`#22c55e`, radio 12px) en cada esquina + líneas verdes translúcidas hacia el centro (líneas ~931-943).
- **Si la detección falla o el frame no es válido: no se dibuja nada extra** — no hay estado amarillo/rojo, solo "verde o ausencia total de feedback". Esta es la brecha visual más grande.
- No hay contorno completo del cuatrilátero de la hoja, solo 4 puntos sueltos + líneas al centro.
- `isFrameSharp()` y `diagnoseFrame()` (motor OMR) ya calculan nitidez/brillo pero **solo se exponen en un panel de "Debug"** oculto tras un toggle manual (`showDebug`), no visible al usuario en uso normal.
- No hay progreso visual durante la votación de hasta 3 frames (`runVotingScan`) — el pill de estado solo dice "Procesando..." sin indicar cuántos frames lleva.

Pill de estado (líneas 1029-1036): "Buscando hoja" (gris) / "Detectado" (verde) / "Procesando..." (verde con fondo). Banner de error genérico en rojo (líneas 1038-1042), texto suelto no ligado visualmente a la zona del problema.

Modal de resultado: grid 5 columnas, una celda por pregunta (verde=correcta, rojo=incorrecta, gris=sin responder, celeste=pregunta abierta/desarrollo).

### 2.7 `confirmRead` no es control de calidad — CONFIRMADO

El botón "Confirmar lectura" del modal (línea 1261-1267, función `confirmRead`, líneas ~197-206) marca la lectura como correcta para fines de **dataset de entrenamiento ML** (`rutTrue`, `verified: true`), no es una confirmación que el profe deba hacer para que el alumno "cuente". No debería ser parte del camino crítico del modo ráfaga.

### 2.8 Redirección automática a reverso (multipágina) — CONFIRMADO, riesgo de interacción

`syncResult()`, líneas 369-377: si el ensayo tiene preguntas de desarrollo (`scanCfg.openQuestions.length > 0`) Y el alumno quedó identificado con certeza, la app **navega automáticamente** a `/scan/reverso?paper=...` para capturar el reverso de ESA hoja. Esto ya interrumpe el flujo normal hoy. El modo ráfaga debe verificar que no compita con esta redirección (ej. no debe intentar auto-avanzar a `"detecting"` si ya se está navegando a otra ruta).

### 2.9 Pantallas de configuración existentes — CONFIRMADO

Hay 3 rutas de "settings" en el repo: `src\app\dashboard\settings\page.tsx`, `src\app\app\configuracion\page.tsx`, `src\app\settings\page.tsx`. Ninguna menciona sonido/vibración/escaneo (grep vacío). `src\app\app\configuracion\page.tsx` es la pantalla nativa real (dentro del shell `/app`, mismo árbol que `/app/scan`), con patrón de componentes `NativeCard`/`NativeRow` ya establecido (ej. sección "Seguridad" con `BiometricToggle`) — es el lugar natural para clonar el patrón visual.

### 2.10 Cola de revisión ya existente — CONFIRMADO

`src\app\dashboard\papers\page.tsx` + `[id]\page.tsx` (vista escritorio/profe) y `src\app\app\results\page.tsx` (vista nativa) ya funcionan como cola de hojas pendientes de revisión. Relevante para el diseño de ráfaga: las sorpresas tardías del servidor no necesitan interrumpir la captura en vivo, pueden acumularse como contador y resolverse después ahí.

### 2.11 Costo por frame del loop de detección — CONFIRMADO (audit 2026-08-02)

El loop RAF se throttla con `frameSkipMs = 66` (línea 280) y exige `stableFramesNeeded = 5` frames estables (línea 283) → mínimo ~330ms de espera antes de disparar la votación, asumiendo detección perfecta continua.

Cada frame procesado (a hasta 1920×1080, líneas 875-884) paga DOS conversiones a escala de grises de frame completo + un Laplaciano full-frame:
- `findCorners(frame, config)` convierte a gris internamente (`src\tulector\omr.ts:216`, `new Uint8Array(w*h)`).
- `isFrameSharp(frame)` (`page.tsx:21-37`) hace su propia conversión a gris (`Float32Array(w*h)`) + Laplaciano sobre los ~2M píxeles.
- `gradeBubbles`/`readRut`/`readSheetCode` también arrancan con su propio `Float32Array(width*height)` (omr.ts:851, 1030, 1307, 1439) — relevante para la votación, que corre warp+grade+RUT completos por intento.

Este costo es el que justifica el `frameSkipMs` de 66ms, y es la palanca de velocidad que el diseño original no tocaba (ver P0-D, §3.6).

Dato adicional: la salida temprana de la votación (línea 586) compara solo `frameReads` (respuestas), NO el RUT — dos frames con mismas respuestas pero RUT distinto cortan el loop y `voteField` desempata el RUT al primero. Ver P0-D ítem 4.

## 3. Diseño propuesto

Seis frentes de trabajo (P0-D agregado en el audit 2026-08-02). P0-A, P0-C, P0-D y P1 tocan zonas distintas y son paralelizables; conviene mergear P0-A primero porque cambia los nombres de fase de los que P0-C y P1 cuelgan sus triggers. P0-B depende de que el HUD (P0-A) exista. P2 depende de que existan las prefs reales que expone (P0-C + el flag de modo ráfaga de P0-A). P0-D es independiente de la máquina de estados (toca el loop de detección y la votación, no las fases) y aporta la mayor ganancia de velocidad por hoja después de eliminar el tap.

| Fase | Qué | Esfuerzo relativo | Depende de |
|---|---|---|---|
| P0-A | Máquina de estados + modo ráfaga con HUD no bloqueante | Alto (es el corazón del cambio) | — |
| P0-B | Nombre + RUT en el HUD | Bajo | P0-A |
| P0-C | Módulo de sonido + vibración (`useSensoryFeedback`) | Medio | — (paralelo a P0-A) |
| P1 | Feedback visual en tiempo real (contorno, colores, progreso N/3, nitidez visible) | Medio | — (paralelo a P0-A) |
| P0-D | Costo por frame: detección reducida, nitidez en quad, menos frames estables, micro-opts de votación | Medio | — (paralelo a P0-A) |
| P2 | Pantalla/drawer de configuración con toggles reales | Bajo | P0-A + P0-C |

### 3.1 P0-A — Modo ráfaga / auto-advance

Nuevo `ScanPhase`: `"detecting" | "scanning" | "hud" | "review" | "clearing"`.

- **`"hud"`** (nuevo; se agrega al union type y se elimina `"cooldown"`, que está declarado pero jamás se usa — **[AUDIT-MEJORA]** borrarlo es más claro que "reaprovechar" el slot): reemplaza el modal para el **caso feliz**. Franja translúcida que NO tapa toda la pantalla (a diferencia del modal actual `bg-black/60 backdrop-blur-sm`) — debe dejar la cámara visible para que el profe pueda re-encuadrar la próxima hoja mientras lee el resultado. Contenido: puntaje, RUT (instantáneo), nombre (se completa cuando llega, ver P0-B), mini-grid de aciertos opcional. Auto-dismiss por temporizador (~1.5s) o antes si la hoja ya salió de cuadro. Sin botón obligatorio; "Confirmar lectura" puede quedar como affordance opcional flotante, no bloqueante.
- **`"review"`** (renombre de `"result"`): el modal bloqueante actual. **[AUDIT-CORRECCIÓN]** Ojo: hoy las ramas de mala calidad NO ven este modal (banner rojo + vuelta a `"detecting"`, ver 2.2). Mandarlas ahora a un modal bloqueante sería una **regresión de velocidad**: cada hoja mala exigiría un tap. **Decisión de diseño corregida: en modo ráfaga, nada bloquea.** Los casos no-felices van a una variante del HUD (fondo ámbar/rojo, motivo visible, sonido de error, auto-dismiss más largo ~3s) y suman al `pendingReviewCount`; el modal `"review"` queda solo para cuando el modo ráfaga está apagado (toggle P2). Si se quiere una excepción bloqueante (ej. `sheetWarn` = hoja de otro ensayo), debe ser una decisión explícita del usuario, no el default.
- **`"clearing"`** (nuevo): tras el HUD, exige que la hoja salga de cuadro antes de rearmar el disparo automático. El loop RAF debe **seguir corriendo** durante `"hud"`/`"clearing"` (hoy se apaga por completo en `"result"`, línea 867 — hay que cambiar esa condición de salida temprana). Lógica: guardar `lastCorners` al entrar a `"hud"`; en `"clearing"`, verificar `corners === null` o desplazamiento/cambio de área >40% respecto a `lastCorners` → recién ahí `setPhase("detecting")` y reset de `stableFrames.current = 0`. Timeout de seguridad ~6s: si el profe se queda con la hoja en mano más tiempo que eso, avanzar igual a `"detecting"` (no debe ser una trampa que bloquee el flujo). Esto además reutiliza `cooldownMs` como piso mínimo de seguridad. **[AUDIT-CORRECCIÓN]** Para que ese piso exista hay que cablear `setLastScan(Date.now())` al disparar la votación (hoy solo se setea en `nextScan()`, ver 2.2), y **bajar `SCAN_THRESHOLDS.scanCooldownMs` de 2500ms a ~1000ms** (`scanner_config.ts:29`): con `"clearing"` activo, el cooldown por tiempo es redundante como protección anti-doble-escaneo, y 2500ms pondría un techo duro de ~24 hojas/min al flujo (con ~1000ms el techo sube a ~40/min, por encima de lo que permite el swap físico de hojas).

**Gate feliz vs. bloqueante**, calculado en el punto donde hoy se hace `setPhase("result")` (`processScan` línea ~525, `runVotingScan` línea ~629), **sin esperar red** (ver 2.3):
```
isHappyPath =
  report.valid &&
  answeredCount > 0 &&
  !(answerSet.size === 1 && answeredCount > 3) &&   // no CURVE_FAIL
  votedRut.length === expectedRutLength &&
  rutR.dvOk === true &&
  sheetWarn === null
```
- `isHappyPath === true` → `setPhase("hud")`, `void syncResult(...)` en background como hoy, auto-avanza.
- `isHappyPath === false` → HUD de error no-bloqueante (ver `"review"` arriba) + `fire("error")` + `pendingReviewCount++`. Nada de modal en modo ráfaga.

**[AUDIT-CORRECCIÓN] Notas de implementación del gate:**
1. En `runVotingScan` el `readSheetCode()`/`checkSheetCode()` se hace hoy DESPUÉS de `setPhase("result")` (líneas 629-632). El gate necesita el warning ANTES de decidir la fase → reordenar: leer `codeR` y computar el warning antes del `setPhase`.
2. `setSheetWarn(...)` es `useState` (asíncrono): el gate no puede leer el state recién seteado. Computar en variable local (`const warn = checkSheetCode(codeR); setSheetWarn(warn);`) y usar `warn` en el gate.
3. Definir la fuente de `expectedRutLength`: debe salir de `idReadCfg` (`resolveIdReadConfig(activeCountryCode)`, línea 187), no hardcodearse a un largo chileno.
4. El auto-avance `"clearing"→"detecting"` debe replicar la limpieza completa de `nextScan()` (líneas 982-991): `setLastDiag(null)`, `setDebugLog([])`, `setWarpedThumb(null)`, `setLabeled(false)`, `setSyncState("idle")`, `setSyncMessage("")` — el plan original solo mencionaba resetear `studentName`.

**Sorpresas tardías del servidor** (multipágina incompleta, `sheetMismatch`, `manual_review` por cupo/matrícula — ver 2.3): como el HUD ya se cerró para cuando llegan, **no reabrir el modal retroactivamente** (interrumpir rompe el objetivo de velocidad). En su lugar: contador `pendingReviewCount` en estado del componente, incrementado dentro de `syncResult()` en esas ramas (líneas 335-360 hoy); badge discreto fijo (ej. esquina superior, "3 por revisar") que linkea a la cola ya existente (`/dashboard/papers` o `/app/results`, ver 2.10). Nada se pierde, solo se revisa después en lote.

**Verificar interacción con la redirección a `/scan/reverso`** (2.8): el auto-avance a `"detecting"` no debe competir con esa navegación — si hay redirección pendiente, no debe intentarse `setPhase("clearing"/"detecting")` en el mismo tick.

**Remount del loop RAF — eliminar por construcción, no solo verificar** **[AUDIT-MEJORA]**: el `useEffect` del loop depende de `[stream, phase, lastScan, config]` (línea 980) — cada cambio de `phase` o `lastScan` desmonta/remonta el loop entero, y con 5 fases transicionando en ráfaga eso puede comerse frames justo en cada transición. Solución estructural: espejar `phase` y `lastScan` en refs (`phaseRef.current`, `lastScanRef.current`) leídos dentro del loop, y dejar las dependencias en `[stream, config]` (`config` ya es `useMemo` estable, línea 287). El loop se monta una sola vez por cámara y el riesgo desaparece, en vez de quedar como algo a "medir en dispositivo".

### 3.2 P0-B — RUT + nombre en el HUD

1. `const [studentName, setStudentName] = useState<string | null>(null)`.
2. En `syncResult()`, agregar `setStudentName(payload.studentName ?? null)` **inmediatamente después de `const payload = await response.json()` (línea 327)** — NO solo tras `setSyncState("saved")` **[AUDIT-CORRECCIÓN]**: la ruta devuelve `studentName` también en los caminos de `manual_review`/multipágina (route.ts:299, y `null` en 417/444/484), y los early-returns de las líneas 342/349/356 se saltarían el seteo si queda al final. Mostrar el nombre incluso en casos de revisión ayuda al profe.
3. En la transición a `"detecting"` (o al iniciar un nuevo `"hud"`), resetear `setStudentName(null)`.
4. En el HUD: `RUT: {studentId.join("")}` (local, instantáneo) + nombre debajo, que se completa cuando `syncResult()` resuelve. Con latencia normal esto entra dentro de la ventana de ~1.5s del HUD casi siempre; si tarda más, el HUD igual se cierra por temporizador — el nombre puede "llegar tarde" un instante, aceptable, no crítico. No dejar un loader indefinido que ancle el HUD más de lo que dura su temporizador.
5. **Caso offline** (`enqueueScan`, sin roster cacheado, ver 2.4): mostrar solo RUT + etiqueta secundaria "Sin conexión — nombre disponible al sincronizar". No se implementa cache de roster offline en esta fase — sería un proyecto aparte si se quiere en el futuro.

### 3.3 P0-C — Módulo de feedback sonoro/háptico

Nuevo hook: `src\lib\hooks\useSensoryFeedback.ts`.

```ts
type SensoryEvent = "lock" | "captureStart" | "success" | "error" | "warning";

function useSensoryFeedback(prefs: { sound: boolean; vibration: boolean }): {
  fire(event: SensoryEvent): void;
  unlock(): void; // debe llamarse en el primer gesto real del usuario
}
```

- **Sonido**: sintetizado con Web Audio API (osciladores cortos, distinto pitch/duración por evento — ej. bip agudo corto para "lock", tono tipo obturador para "captureStart", ding ascendente para "success", buzz grave para "error", tono medio para "warning"). Razones para empezar así en vez de samples grabados: (a) cero infraestructura de audio hoy en el repo, cero costo de mantener assets; (b) evita bundlear binarios y problemas de precarga en un WebView con conexión potencialmente mala en aulas; (c) los tonos de ZipGrade son simples, un par de tonos alcanza para diferenciar eventos. Trade-off explícito: un sonido sintetizado suena más "genérico" que el click de obturador real de ZipGrade — si tras probarlo el usuario quiere ese sonido específico, la alternativa es 1-2 archivos `.wav` cortos (<20KB) en `public\sounds\`, cargados con `<audio>` precargado. Recomendación: empezar con síntesis, pasar a sample grabado solo si se pide explícitamente después de probar.
- **Vibración/haptics**: `navigator.vibrate` con patrones diferenciados por evento (ej. `[30]` para lock, `[15,30,15]` para success, `[80,40,80]` para error) como fallback universal en Android/web. Para iOS real, agregar `@capacitor/haptics` (`npm install @capacitor/haptics`, **requiere rebuild nativo** del APK/IPA — coordinar con el ciclo de release, no es un cambio puramente web). El hook debe intentar `Haptics.impact()` vía Capacitor primero (mismo patrón `plugin<T>()` ya usado en `src\lib\native\capacitor.ts` para `toggleTorch`/`Camera`), y caer a `navigator.vibrate` si el plugin no está disponible (contexto web/desktop).
- **Riesgo de autoplay/gesto de usuario**: `AudioContext` en iOS WKWebView (y Chrome, aunque menos estricto) requiere que `resume()` se llame dentro de un gesto de usuario real, o queda `suspended` silenciosamente. Mitigación: `unlock()` se llama en el primer tap real del usuario en `/scan` (ej. al tocar el botón de captura manual, o mediante un pequeño overlay tipo "Toca para activar sonido" la primera vez que se entra a la pantalla, si no hay garantía de un tap previo). Documentar esto explícitamente — es la causa más común y menos obvia de "el sonido no suena en el celular pero sí anduvo en el navegador de escritorio" durante pruebas.

**Puntos de enganche** (todos dentro de `src\app\scan\page.tsx`, ubicaciones ya confirmadas):
1. Transición no-detectado → detectado+enfocado, dentro del loop RAF (línea ~927-929) → `fire("lock")`. Necesita guard para no disparar en cada frame — comparar contra el estado previo vía `ref` (no vía `useState`, que es asíncrono), disparando solo en el flanco false→true.
2. `stableFrames.current >= stableFramesNeeded` (línea ~955-958), dispara `runVotingScan` → `fire("captureStart")`.
3. (Opcional, menor prioridad) durante `runVotingScan`, cada `sessions.push(...)` (línea ~581) → tick sutil de progreso, bajo volumen o solo háptico — evaluar si no es ruido excesivo dado que 3 frames a veces se completan en <1s.
4. Transición a `"hud"` (antes `"result"`, líneas 525/629) → `fire("success")`, **reemplazando** los `navigator.vibrate(100)` sueltos de las líneas 532 y 652 por la llamada al hook (no duplicar).
5. Ramas de error (`processScan`, líneas 482-514: `WRONG_FORMAT`/`OUT_OF_FOCUS`/`CURVE_FAIL`) → `fire("error")`, hoy sin ningún feedback físico.
6. Timeout de votación sin frame estable (línea ~593-597) → `fire("error")` o variante más suave.
7. `sheetWarn` detectado (hoja de otro ensayo) → `fire("warning")`, tono distinto del error genérico.

**Cableado de `SCAN_PREFS`**: `playShutterSound`/`vibrateOnScan` (`src\tulector\scanner_config.ts`, hoy huérfanos) se leen desde `localStorage` bajo una clave nueva (ej. `tulector_sensory_prefs`), siguiendo el mismo patrón ya usado en el archivo para `tulector_scan_config` (línea ~269), con default = los valores `.default` de `SCAN_PREFS`. Se pasan como argumento a `useSensoryFeedback({ sound, vibration })`. La UI para cambiarlos es P2.

### 3.4 P1 — Feedback visual en tiempo real

Todo dentro del mismo loop RAF de overlay (`scan/page.tsx:865-980`), que ya calcula `corners`, `sharpScore`, `valid` cada frame — no se agrega cómputo nuevo, solo se mejora el dibujo y se expone lo que ya existe:

1. **Contorno completo de la hoja**: en vez de (o además de) los círculos en cada esquina (líneas ~931-943), dibujar el cuatrilátero completo conectando las 4 corners (`moveTo`→`lineTo`×3→`closePath`→`stroke`).
2. **Estados de color** (hoy solo "verde o nada"): 
   - Gris: guía punteada fija, nada detectado (sin cambios).
   - **Amarillo (nuevo)**: `corners` detectado pero `!sharp` (fuera de foco) o geometría inválida (ratio/área fuera de rango) — hoy este caso no dibuja nada (líneas ~960-965), es la brecha más visible a tapar.
   - Verde: como hoy, `valid && sharp` con corners estables.
   - Rojo (opcional, cosmético, menor prioridad, depende de que P0-A ya exista): contorno breve en rojo si se sabe de antemano que el frame va a caer en `"review"`.
3. **Indicador de calidad visible siempre** (no solo en el panel Debug oculto): exponer `sharpScore` como barra/número pequeño, reusando `isFrameSharp`/`diagnoseFrame` ya existentes en el motor, mapeado al mismo umbral (40) ya usado en el código (línea ~888).
4. **Progreso de votación N/3**: durante `runVotingScan` (líneas 545-655), agregar `useState<number>` (ej. `voteProgress`), actualizado en cada `sessions.push(...)` (línea ~581), renderizado como indicador simple ("●●○" o barra) mientras `phase === "scanning"`. Dado que la salida temprana (línea ~586, 2 frames idénticos corta el loop) hace que a veces dure <1s, el indicador debe aparecer instantáneamente sin fade-in lento, o será inútil en el caso rápido.

### 3.5 P2 — Configuración de usuario

No existe pantalla de configuración de escaneo hoy (ver 2.9). Recomendado: **drawer/sheet inline dentro de `/app/scan`** (ícono de engranaje flotante) con 3 toggles reales — sonido, vibración, modo ráfaga on/off — sin navegar fuera de la cámara, más un link secundario a `src\app\app\configuracion\page.tsx` (patrón `NativeCard`/`NativeRow` ya usado ahí, ej. sección "Seguridad") para el resto de las prefs menos usadas (ej. `focusReq` si se decide exponerlo). Un drawer inline es más coherente con la prioridad #1 del usuario (velocidad) que forzar salir de la pantalla de cámara a otra ruta. Persistencia en `localStorage`, mismo patrón que `tulector_scan_config`.

### 3.6 P0-D — Costo por frame (la palanca de velocidad que faltaba) [AUDIT-MEJORA]

El diseño original elimina el tap manual pero deja intacto el costo por frame, que es lo que dicta el ritmo de detección (ver 2.11). Cuatro cambios, todos dentro de `page.tsx` (loop RAF y `runVotingScan`), sin tocar el motor OMR:

1. **Detección en frame reducido**: dibujar el video a un canvas de detección de ~960×540 (en vez de 1920×1080), correr `findCorners`+`isFrameSharp` ahí, y escalar las corners ×2 para el overlay y para la votación (que sigue capturando a resolución completa). ~4× menos píxeles → `frameSkipMs` puede bajar de 66 a ~33ms y la ventana de estabilidad de ~330ms a ~165ms. Verificar en dispositivo real que `findCorners` siga encontrando las 4 anclas a 540p (las anclas son grandes; debería sobrar — ver riesgo 11).
2. **Nitidez solo dentro del cuadrilátero**: mientras no haya corners (la mayoría de los frames durante el swap de hojas), saltarse el Laplaciano full-frame; calcularlo solo cuando hay corners, y solo dentro del quad detectado (o sobre el frame reducido). Menos jank y preview más fluido.
3. **`stableFramesNeeded` 5→3** (constante, línea 283): la votación de 3 frames ya es la red de seguridad de precisión; los 5 frames estables solo agregan latencia al disparo. Cada frame eliminado ahorra ~33-66ms por hoja.
4. **Micro-opts de votación** (`runVotingScan`, líneas 545-655):
   - **[AUDIT-CORRECCIÓN]** Incluir el RUT en la comparación de salida temprana (líneas 582/586): hoy `frameReads` guarda solo respuestas; dos frames con mismas respuestas pero RUT distinto cortan el loop y el RUT queda al azar entre los dos. Guardar `reads.join(",") + "|" + rutR.rut` en `frameReads`. Misma velocidad cuando hay consenso; solo cuesta el 3er frame cuando el RUT difiere — que es exactamente cuando hace falta.
   - Eliminar el `await sleep(40)` posterior a una lectura exitosa (línea 587): es tiempo muerto puro antes del siguiente intento (~40-80ms por hoja). Mantener los sleeps solo tras rechazos.

**Presupuesto estimado por hoja** (a validar con la instrumentación de §7): hoy ≈ 330ms estabilidad + 0.5-1.5s votación + tap humano 1-3s + cooldown 2.5s ≈ **5-8s/hoja (8-12 hojas/min)**. Con P0-A + P0-D ≈ 165ms estabilidad + votación + swap humano ~1s ≈ **2-3s/hoja (20-30 hojas/min)** — comparable a lo descrito de ZipGrade.

## 4. Riesgos concretos a vigilar durante la implementación

1. **Falso "listo para siguiente" / doble-escaneo de la misma hoja**: cubierto por el estado `"clearing"` (comparación de `corners` contra `lastCorners`) + timeout de seguridad de ~6s.
2. **Sonido silencioso en iOS por política de autoplay**: cubierto por `unlock()` en el primer gesto real del usuario en `/scan`.
3. **`navigator.vibrate` no existe en iOS WKWebView**: requiere `@capacitor/haptics` + **rebuild nativo** del APK/IPA — no es un cambio puramente web, coordinar con el ciclo de release de Capacitor. Verificar versión de Capacitor instalada antes de agregar el plugin.
4. **Remount del loop RAF por cambios frecuentes de `phase` y `lastScan`** (dependencias en línea 980): resuelto por construcción con el cambio a refs (ver 3.1) — si por alguna razón no se hace ese cambio, vuelve a ser un riesgo real a medir en dispositivo.
5. **El HUD compite visualmente con la cámara en vivo**: a diferencia del modal actual (que tapa todo con backdrop), el HUD debe dejar suficiente cámara visible para re-encuadrar mientras se lee el resultado — vale la pena bocetar/iterar el layout exacto con el usuario antes de darlo por cerrado, no es una decisión puramente técnica.
6. **Nombre "tarde" en el HUD si la red es lenta**: aceptable como degradación (mostrar solo RUT, completar con nombre si llega a tiempo dentro de la ventana del HUD), pero debe decidirse explícitamente el comportamiento — no dejar un loader indefinido que extienda el HUD más allá de su temporizador.
7. **Interacción con la redirección automática a `/scan/reverso`** (multipágina con preguntas abiertas, líneas 369-377): verificar que el modo ráfaga no compita con esa navegación — no debe intentar auto-avanzar a `"detecting"` si ya se está navegando a otra ruta.
8. **`AGENTS.md`/`CLAUDE.md` del repo advierte** que esta versión de Next.js tiene breaking changes respecto al conocimiento de entrenamiento estándar — revisar `node_modules\next\dist\docs\` antes de tocar cualquier ruta/config de Next al implementar.
9. **Sesgo de "ZipGrade" no verificado**: todo lo que se atribuye a ZipGrade en este documento (sección 1) es inferencia/descripción del usuario, no ingeniería inversa real de su código o tráfico de red — el diseño se basa en el objetivo funcional descrito (velocidad, sonido, nombre visible), no en una réplica exacta de su implementación interna, que no tenemos forma de conocer con certeza.
10. **[AUDIT] Regresión silenciosa de velocidad en hojas malas**: si el gate manda casos no-felices al modal `"review"` en modo ráfaga (diseño original, corregido en 3.1), cada hoja mala exige un tap — peor que hoy, donde los errores ya son no-bloqueantes. Verificar en la implementación que en modo ráfaga NADA renderice el modal.
11. **[AUDIT] `findCorners` a 540p** (P0-D ítem 1): si la detección se degrada a resolución reducida (anclas chicas en hojas lejanas), la ganancia se paga con fallos de detección. Medir tasa de detección antes/después; si baja, subir el canvas de detección a 720p como punto intermedio.
12. **[AUDIT] Cooldown mal cableado**: si se olvida el `setLastScan` en el disparo automático (ver 2.2/3.1), el piso de seguridad no existe y el único anti-doble-escaneo queda en `"clearing"`; si se deja en 2500ms, el techo de flujo queda en ~24 hojas/min. Ambos fallos son silenciosos — cubrir con la métrica de §7 ítem 8.

## 5. Fuera de alcance de este plan (posibles fases futuras, no incluidas)

- Cache de roster local para mostrar nombre del alumno en modo offline (hoy `enqueueScan` no tiene ese dato disponible).
- Reemplazo de sonido sintetizado por samples de audio grabados (solo si se pide tras probar la versión sintetizada).
- Exponer `focusReq`/`brightDetect`/otros campos de `SCAN_PREFS` no mencionados explícitamente por el usuario en la UI de configuración.
- Cualquier cambio de backend — no se identificó ninguno necesario para este plan (`studentName` ya lo devuelve `/api/scan/result`).
- Web Worker / OffscreenCanvas para el pipeline OMR: el costo por frame se ataca más barato con resolución reducida (P0-D); el Worker sigue descartado por el historial de cuelgues con `solve8x8` (comentario en `processScan`, línea ~445).

## 6. Archivos clave

- `src\app\scan\page.tsx` — máquina de estados, loop de detección/overlay, modal/HUD, `syncResult`, `processScan`, `runVotingScan`
- `src\tulector\scanner_config.ts` — `SCAN_PREFS`, `SCAN_CODES`, `SCAN_MESSAGES`, `SCAN_THRESHOLDS` (`scanCooldownMs:29` a bajar de 2500→~1000, ver 3.1)
- Nota: los imports reales en `page.tsx` usan los shims `@/lib/omr` y `@/lib/scanner_config` (re-exports de `src\tulector\*`); editar siempre los archivos de `src\tulector\`.
- Constantes de velocidad a tocar (P0-D, todas en `page.tsx` salvo cooldown): `frameSkipMs` (línea 280), `stableFramesNeeded` (283), `VOTE_TARGET`/`VOTE_TIMEOUT_MS`/`VOTE_FOCUS_MIN` (115-118).
- `src\tulector\omr.ts` — `findCorners`, `isFrameSharp`, `diagnoseFrame`, `gradeBubbles`, `readRut`, `readSheetCode`, `warpSheet`, `cropNameBox`
- `src\app\api\scan\result\route.ts` — ya devuelve `studentName`; no requiere cambios
- `src\lib\native\capacitor.ts` — patrón `plugin<T>()` para agregar `@capacitor/haptics`; `isNativeApp()`, `captureNativePhoto`, `toggleTorch`
- `src\app\app\configuracion\page.tsx` — pantalla nativa de settings, patrón `NativeCard`/`NativeRow` a reutilizar
- `src\lib\offline_queue.ts` — confirma ausencia de nombre en modo offline (`enqueueScan`, `OfflineScanEntry`)
- `src\app\dashboard\papers\page.tsx` / `src\app\app\results\page.tsx` — cola de revisión existente, destino del badge `pendingReviewCount`
- Nuevo: `src\lib\hooks\useSensoryFeedback.ts`

## 7. Verificación end-to-end sugerida (al implementar)

1. Navegador de escritorio con webcam (`getUserMedia`): ráfaga de 3-4 hojas seguidas sin tocar la pantalla, confirmar que no hay doble-escaneo y que el HUD se cierra solo.
2. Caso "mala hoja" (RUT con DV inválido, o hoja de otro ensayo) **con el modo ráfaga APAGADO**: confirmar que cae en el modal bloqueante `"review"`, sin regresión. Con ráfaga ENCENDIDA el comportamiento esperado es el del ítem 9 (nada de modal) — **[AUDIT-CORRECCIÓN]** el texto original de este ítem contradecía el diseño corregido de §3.1.
3. APK real en Android (dispositivo físico, no solo emulador) para sonido/vibración — el emulador no siempre refleja audio/haptics reales.
4. Build de iOS (si aplica en el ciclo actual) para confirmar el fallback de `@capacitor/haptics` cuando `navigator.vibrate` no existe.
5. Confirmar visualmente que `payload.studentName` aparece en el HUD con conexión normal, y que el fallback offline muestra el mensaje correcto (cortar wifi del celular a mitad de una ráfaga y escanear).
6. Confirmar que un ensayo con preguntas de desarrollo (multipágina) sigue redirigiendo correctamente a `/scan/reverso` sin que el modo ráfaga interfiera.
7. ~~Medir en dispositivo real que las transiciones rápidas de `phase` no pierdan frames de detección~~ → cubierto por construcción con el cambio a refs (riesgo 4); si no se hace ese cambio, mantener esta medición.
8. **[AUDIT] Métrica de velocidad end-to-end**: instrumentar timestamps por hoja (`t_detect` al cumplirse los frames estables, `t_vote_end` al cerrar la votación, `t_hud` al mostrar el HUD, `t_rearmed` al volver a `"detecting"`) y loguearlos vía `saveScanLog` (o consola en build de prueba). **Objetivo cuantificado: p50 ≤ 3s hoja-a-hoja y ≥20 hojas/min sostenidos en una ráfaga de 10 hojas reales en dispositivo físico.** Medir también la línea base actual (estimada en 5-8s/hoja) para tener el antes/después. Sin esta medición, "más rápido" es una impresión, no un dato.
9. **[AUDIT] Hoja mala en medio de ráfaga**: intercalar una hoja con DV inválido entre 3 buenas → confirmar que NO aparece modal, suena el feedback de error, el contador `pendingReviewCount` sube, y la ráfaga continúa sin tap (riesgo 10).
10. **[AUDIT] Detección a resolución reducida** (P0-D): confirmar tasa de detección igual o mejor que hoy a 540p en el dispositivo más lento disponible; si baja, usar 720p (riesgo 11).
