# Prompt para DeepSeek (multi-agente) — APK tuLector más nativa

> Copia desde "Eres un equipo de ingeniería…" hacia abajo. El encabezado es para el dueño.

**Confirmación clave para el dueño:** ninguna de estas tareas modifica el motor OMR
(`src/tulector/**`, `src/lib/omr.ts`). Solo lo *reusan/empaquetan*. La regla dura del
prompt lo blinda. El motor tiene 14 guardias (`npm run test:omr`) que deben quedar idénticas.

---

Eres un equipo de ingeniería (multi-agente) trabajando en **tuLector.cl**
(`C:\Users\usuar\Desktop\tulector`): app web Next.js 16 (App Router) + Supabase,
desplegada en Vercel, envuelta en un **APK Capacitor**. La app escanea hojas de
respuestas (motor OMR propio en TypeScript, corre en el navegador) y las convierte
en notas en un dashboard escolar. El objetivo de este trabajo es hacer el APK **más
nativo** sin perder la ventaja de "deploy web = update instantáneo".

## ESTADO ACTUAL (verificado — no lo cambies sin razón)

- **Capacitor 8** instalado: `@capacitor/{core,android,cli,app,camera,splash-screen,status-bar}`. Carpeta `android/` ya generada.
- `capacitor.config.ts`: `appId: "cl.tulector.app"`, `server.url: "https://tulector.vercel.app/auth"`, `appendUserAgent: "TuLectorApp"`, `androidScheme: "https"`. **El APK carga la web remota en un WebView** (no empaca la app).
- `src/lib/native/capacitor.ts`: `isNativeApp()` (detecta por `window.Capacitor` y por el token del User-Agent), `nativePlatform()`, `captureNativePhoto()` (usa `window.Capacitor.Plugins.Camera` SIN importar el paquete, para no romper el build web). `applyNativeChrome()`.
- `src/components/NativeBootstrap.tsx` montado en `src/app/layout.tsx` aplica `html.cap-native` (CSS en `globals.css` que quita el "olor a web").
- Menú nativo: `src/app/app/page.tsx` (cards; "Lector Prueba" → `/dashboard/quizzes` → elegir ensayo → `/scan`).
- Versión visible: `src/lib/version.ts` (`APP_VERSION`), en el footer del menú y del escáner.
- Login nativo: `src/app/auth/page.tsx` (variante `if (isNativeApp())`).
- El pipeline de escaneo: `/scan` → cámara nativa (`captureNativePhoto`) o upload → `processImageSrc` → motor OMR (`@/lib/omr`) → `POST /api/scan/result`.

## REGLAS DURAS (violarlas rompe producción — no negociables)

1. **NUNCA toques el motor OMR**: nada de `src/tulector/**` ni `src/lib/omr.ts` ni `src/lib/sheet_*.ts` ni `src/lib/scan_log.ts`. Corre `npm run test:omr` ANTES y DESPUÉS de cada tarea: deben pasar las **14 guardias idénticas**. Si tu cambio altera su salida, revierte.
2. **La web debe seguir funcionando idéntica en el navegador.** Todo lo nativo va detrás de `isNativeApp()` o de detección de plataforma; en web debe ser no-op. Nunca importes paquetes de Capacitor de forma que rompan el build web (sigue el patrón de `capacitor.ts`: acceso por `window.Capacitor.Plugins`, no `import`).
3. **NO hagas push ni deploy.** Commits LOCALES, uno por tarea, mensaje en español `feat(apk-N): ...`. El dueño despliega.
4. **Verificación por tarea antes de commitear:** `npx tsc --noEmit` limpio (ignora errores de `tests/e2e/` por playwright), `npx next build` con exit 0, y `npm run test:omr` idéntico.
5. **NO puedes compilar ni probar el APK tú mismo.** Los pasos nativos (`npx cap sync`, `npx cap open android`, build de Gradle, instalar en teléfono) los ejecuta el DUEÑO en su máquina/dispositivo. Por cada tarea que los requiera, entrega instrucciones EXACTAS de qué comandos correr y qué verificar en el teléfono. Marca claramente esos pasos como **[REQUIERE DISPOSITIVO]**.
6. **NO toques el WIP de billing** (`src/app/api/billing/**`, `src/lib/flow.ts`, `PlanCard`, `billing_catalog`) ni `src/app/dashboard/students/page.tsx` / `CourseRoster` (pueden tener trabajo en curso de otro frente).
7. UI en español (es-CL). Reusa componentes existentes (`SubmitButton`, `ActionFeedbackDialog`, `ConfirmDialog`, patrones de `getDashboardContext`).
8. **Degradación elegante:** si un plugin nativo no está, la web no debe fallar (todo envuelto en detección + try/catch).

## COORDINACIÓN MULTI-AGENTE (evita choques entre sub-agentes)

Asigna **un archivo a un solo agente por vez**. Archivos de alto contacto que solo UN agente puede tocar a la vez: `src/app/layout.tsx`, `src/lib/native/capacitor.ts`, `capacitor.config.ts`, `package.json`, `src/app/app/page.tsx`, `next.config.*`. Si dos tareas necesitan el mismo archivo, hazlas en serie, no en paralelo. Después de cada tarea: build verde + `test:omr` idéntico ANTES de pasar a la siguiente.

---

## FASE A — Quick wins (bajo riesgo, autocontenidos). Empieza por aquí.

### Tarea A1 — Estrategia de actualización robusta (mata el "WebView pegado")
**Problema:** el WebView cachea el bundle y el usuario queda en una versión vieja (se vio `b-0629p` días después de deployar). No hay forma de avisar ni forzar refresco.
**Qué hacer:**
1. Endpoint liviano `GET /api/version` que devuelve `{ version: APP_VERSION }` (lee `src/lib/version.ts`).
2. Componente cliente montado solo en nativo (`isNativeApp()`) que, al abrir la app y cada X minutos, compara `APP_VERSION` local vs `/api/version`. Si difieren, muestra un banner no intrusivo "Hay una versión nueva — Actualizar" que al tocar hace `location.reload(true)` / limpia caché del WebView.
3. Bump de `APP_VERSION` documentado como paso de release.
**Archivos:** nuevo `src/app/api/version/route.ts`, nuevo componente en `src/components/`, montaje en `NativeBootstrap.tsx` o `layout.tsx`. **No toca motor.**
**Aceptación:** en web es no-op; en APK, tras un deploy con nueva versión, aparece el banner y al actualizar carga el bundle nuevo.

### Tarea A2 — Compartir/guardar nativo del PDF de hojas
**Qué hacer:** en `/sheet`, cuando `isNativeApp()`, además de descargar, ofrecer el **share sheet nativo** (`@capacitor/share` — agrégalo a package.json) para enviar el PDF por WhatsApp/guardar. Fallback a la descarga web actual si no es nativo.
**Archivos:** `src/app/sheet/page.tsx` (solo la parte de export, detrás de `isNativeApp()`), `package.json`. **No toca motor.**
**[REQUIERE DISPOSITIVO]** tras esto: `npx cap sync android` y probar en teléfono.

---

## FASE B — El gran salto: modo offline del lector (alto valor, alto cuidado)

> Esta es la fase crítica. Hazla **incremental y con checkpoints**, NO de una sola vez. El dolor real: salas de colegio sin wifi donde hoy el APK ni abre (todo es `server.url` remoto).

### Tarea B1 — Cola de escaneos offline + sincronización
**Objetivo:** que el profe pueda escanear SIN conexión y que los resultados se envíen solos al recuperar señal. **El motor OMR ya corre client-side**, así que la lectura funciona offline si la página está cacheada; lo que falta es (a) que la página cargue offline y (b) colar el `POST /api/scan/result` cuando no hay red.
**Qué hacer (en este orden, con checkpoint entre cada uno):**
1. **Cola local:** cuando `/scan` va a hacer `POST /api/scan/result` y no hay red (o falla), guarda el payload en almacenamiento local persistente (usa `@capacitor/preferences` o SQLite; NO localStorage para payloads con imágenes). Marca el escaneo como "pendiente de sincronizar" en la UI.
2. **Sincronizador:** al recuperar conexión (evento `online` / `@capacitor/network`), reintenta enviar la cola en orden, con backoff. Actualiza la UI (pendiente → sincronizado). Idempotencia: el server ya deduplica por `(school_id, quiz_id, student)` — respétalo.
3. **Carga offline de `/scan`:** que la ruta `/scan` + el motor + la config del ensayo activo estén disponibles sin red. Opción recomendada: un **service worker** que cachee el shell de `/scan` y sus assets JS (el motor viene en el bundle, NO se modifica). Alternativa: precargar en el arranque del APK. Evalúa el impacto en la estrategia de update de A1 (coordina cache-busting).
**Archivos:** `/scan` (solo la capa de red/persistencia, NO la lectura), nuevos módulos de cola/sync en `src/lib/`, posible `public/sw.js` + registro, `package.json` (`@capacitor/preferences`, `@capacitor/network`). **NO toca motor ni la lógica de lectura.**
**[REQUIERE DISPOSITIVO]** obligatorio: probar en teléfono en modo avión (escanear → queda pendiente → activar red → sincroniza).
**Aceptación:** con avión activado, `/scan` abre, lee una hoja y guarda el escaneo localmente; al reconectar, aparece en el dashboard sin duplicar.

---

## FASE C — Pulido profesional (independientes entre sí)

### Tarea C1 — Cámara guiada nativa
Overlay de encuadre + auto-disparo cuando se detecta la hoja (la detección es JS/motor existente vía frames; nativo solo entrega el frame de alta resolución al `processImageSrc` actual). Control de flash/torch (`@capacitor/camera` o plugin). **No toca el motor**, solo cómo se obtiene el frame. **[REQUIERE DISPOSITIVO]**.

### Tarea C2 — Sesión persistente + biometría
Login persistente con huella/FaceID (`@capacitor-community/biometric-auth` o similar) para no reingresar en cada uso. Detrás de `isNativeApp()`. Web sin cambios. **[REQUIERE DISPOSITIVO]**.

### Tarea C3 — Notificaciones push
Push nativo (cuota al 90%/100%, resultados listos, hoja en revisión). Requiere config de FCM (Firebase) que el DUEÑO debe crear; documenta los pasos. Conéctalo a los eventos que ya existen (la cuota real ya se calcula en `/api/scan/result`). **[REQUIERE DISPOSITIVO + cuenta FCM]**.

---

## LO QUE NO DEBES HACER
- No reescribir el motor OMR en nativo (Kotlin/Swift). Está probado en TS con 14 guardias.
- No migrar a Flutter (ya descartado; habría doble motor).
- No empacar TODO offline: **solo el lector** (`/scan`). El dashboard/gestión sigue online (cambia seguido, se beneficia del update instantáneo).
- No cambiar `server.url` a local sin una estrategia de update clara (romperías el "deploy = update").

## ENTREGABLE
1. Commits atómicos por tarea (local, sin push), con `test:omr` idéntico y build verde.
2. Por cada tarea con **[REQUIERE DISPOSITIVO]**: instrucciones exactas de comandos (`npx cap sync`, build, instalar) y checklist de qué verificar en el teléfono.
3. Un resumen final: qué quedó hecho en código, qué falta que el dueño ejecute/pruebe en dispositivo, y en qué orden desplegar.
4. Si algún plugin nuevo requiere permisos en `AndroidManifest.xml` o cambios en `android/`, lístalos explícitamente (el dueño los revisa).
