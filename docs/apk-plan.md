# Plan de la APK de tuLector — **Capacitor** (Flutter DEPRECADO)

> ⚠️ **PARA CUALQUIER IA O DEV:** la app móvil de tuLector se construye con **Capacitor**,
> NO con Flutter. La carpeta `mobile/` (Flutter + motor C++ `omr_engine.cpp`) está
> **DEPRECADA** y se va a eliminar. **No agregues features ahí.** Todo el motor OMR
> vive en TypeScript (`src/tulector/`); la app reutiliza ese código.

## Decisión

La app móvil = **contenedor Capacitor que carga la web desplegada** (`server.url` remoto a
`tulector.vercel.app`), igual que ya hizo AyudaDocente.cl. Un solo código (Next + el motor
TS), cámara nativa vía plugin.

### Por qué Capacitor y no Flutter
- **El motor OMR está en TypeScript** (`src/tulector/omr.ts`): 12 anclas, warp bilineal por
  bloques, lectura RUT, DV calculado, etc. Flutter obligaría a **portar y mantener un 2º
  motor en C++** (`omr_engine.cpp`) sincronizado para siempre → impuesto permanente.
- **El pipeline de UPLOAD ya lee el RUT perfecto** a alta resolución (probado: `12345678-5`).
  La cámara nativa solo tiene que **entregar una foto de alta resolución a ese pipeline**.
- **Un solo código** (web) → cada feature se programa una vez; la app se actualiza al
  deployar la web.
- **Precedente del usuario:** AyudaDocente.cl ya abandonó Flutter por Capacitor por la misma
  razón (duplicación de features). Ver memoria `project_ayudadocente_capacitor`.

## Arquitectura

```
APK (Capacitor)
 └─ WebView (full-screen, sin barra de navegador)
     └─ server.url = https://tulector.vercel.app   (la web real)
         ├─ Login NATIVO (hero + bottom sheet + safe areas)   ← se ve app, no web
         ├─ Menú (escalable; hoy 1 botón: "Lector Prueba")
         └─ Lector Prueba = /scan
              ├─ web  → getUserMedia / upload (actual)
              └─ nativo → PLUGIN DE CÁMARA (foto alta-res) → mismo motor TS
```

- **Motor:** sin cambios, vive en TS y corre en el WebView. Cero motor nativo.
- **Cámara:** único componente nativo nuevo. `Capacitor.isNativePlatform()` → en app usa la
  cámara nativa (foto a resolución de sensor) y se la pasa al pipeline de upload existente.

## Las 3 pantallas (alcance v1)

1. **Login nativo** — logo de tuLector (`TuLectorLogo` / `tulector-hero`), hero oscuro
   (`#111827` / acento `#07305f`), **bottom sheet** que sube, **safe areas**, animaciones
   (framer-motion). Variante `isNativeApp()`; la web queda intacta. Empezar con
   **correo/contraseña**; Google nativo después.
2. **Menú** — pantalla limpia tipo cards, pensada para escalar. Hoy solo **"Lector Prueba"**.
3. **Lector Prueba** — `/scan` con cámara nativa de alta resolución.

## Qué se reutiliza de AyudaDocente (probado y funcionando)
`C:\Users\usuar\OneDrive\Desktop\PORTAFOLIO\PORTAFOLIO`
- `src/lib/native/capacitor.ts` (`isNativeApp`, login nativo, `pickImage`).
- `src/components/native/NativeBootstrap.tsx` (init nativo, callback OAuth).
- Patrón de **login premium** (`src/app/login/page.tsx`, variante `if (native)`).
- CSS `html.cap-native` (sin selección/overscroll/tap-highlight → mata el "olor a web").
- Scripts `cap:sync` / `cap:android` / `cap:run:android`.

## Pasos de construcción
1. Instalar `@capacitor/{core,cli,android,app,camera,status-bar,splash-screen,preferences}`.
2. `capacitor.config.ts` con `server.url = https://tulector.vercel.app` + appId (`cl.tulector.app`).
3. Portar el **puente nativo** (`capacitor.ts` + `NativeBootstrap`) adaptado a tuLector.
4. **Login nativo** de tuLector (calcado del patrón AyudaDocente, con branding propio).
5. CSS `cap-native` + **StatusBar/SplashScreen** con branding.
6. **Puente de cámara nativa** → foto alta-res → pipeline de upload de `/scan`.
7. `npx cap add android`, ícono + splash, build/firma (keystore propio).

## Pendientes conocidos (de la experiencia de AyudaDocente)
- **Google nativo:** requiere crear OAuth client **Android** en Google Cloud con package
  `cl.tulector.app` + SHA-1 (debug y release). Sin eso → falla silenciosa. Por eso v1 = correo.
- **Deploy:** producción de tuLector es `master` (público, `tulector.vercel.app`). Hoy se
  publica con fast-forward de la rama a `master` (ver historial del repo).
- **Play Store:** cuenta (US$25), AAB firmado, Play App Signing (2º SHA-1), política de
  privacidad, "eliminar cuenta", Data Safety. AyudaDocente ya tiene plantilla de todo esto.

## Estado de Flutter
**DEPRECADO.** `mobile/` (Flutter + `omr_engine.cpp`) ya no se mantiene. El motor C++ quedó
atrás (sin 12 anclas, sin las mejoras del RUT). Se eliminará/archivará. No invertir ahí.
