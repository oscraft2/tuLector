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

## Comandos para compilar el APK (en tu máquina, con Android SDK)

Lo web ya está hecho (login nativo, menú `/app`, detección nativa en `/scan`,
puente de cámara, `capacitor.config.ts`). Falta instalar Capacitor y compilar:

```bash
# 1. Instalar Capacitor + plugins (los plugins se acceden por window.Capacitor.Plugins)
npm i @capacitor/core @capacitor/cli @capacitor/android \
      @capacitor/camera @capacitor/status-bar @capacitor/splash-screen @capacitor/app

# 2. Añadir la plataforma Android (crea ./android)
npx cap add android

# 3. Sincronizar (cada vez que cambian plugins/config)
npx cap sync android

# 4. Abrir en Android Studio para correr/depurar en emulador o dispositivo
npx cap open android
```

- La app carga `https://tulector.vercel.app` (server.url), así que **se actualiza
  sola al deployar la web**; solo recompilas el APK si cambian plugins nativos.
- **Permiso de cámara:** agregar a `android/app/src/main/AndroidManifest.xml`
  `<uses-permission android:name="android.permission.CAMERA"/>` (el plugin Camera
  también lo pide en runtime).
- Ícono/splash: usar `@capacitor/assets` o reemplazar en `android/app/src/main/res`.
- Firma/AAB: keystore propio (como AyudaDocente). Ver su memoria para el flujo Play.

## Estado de Flutter
**DEPRECADO.** `mobile/` (Flutter + `omr_engine.cpp`) ya no se mantiene. El motor C++ quedó
atrás (sin 12 anclas, sin las mejoras del RUT). Se eliminará/archivará. No invertir ahí.

## Estado actual (04-05 jul 2026) — login nativo, UI propia, tiendas

**Login nativo:**
- Google: `@capgo/capacitor-social-login` con Credential Manager (bottom-sheet
  del sistema, SIN abrir navegador). Requiere un cliente OAuth "Android" en
  Google Cloud (proyecto `docentelab-12b2b`) por cada SHA-1 (debug ya
  registrado; release pendiente — ver keystore abajo). El `webClientId` en
  `initGoogleSignIn()` es el Web Client ID que ya usa Supabase, NO el del
  cliente Android.
- Apple: Android no tiene SDK nativo → sale a Chrome Custom Tabs
  (`@capacitor/browser`) y vuelve por deep link `cl.tulector.app://auth-callback`
  (`onAppUrlOpen` en `NativeBootstrap.tsx`).
- Push notifications: **removido** (`@capacitor/push-notifications` crasheaba
  sin `google-services.json`). Reactivar requiere crear proyecto Firebase.

**UI nativa propia (no replica la web):**
- `/app` (menú), `/app/scan`, `/app/results(+[quizId])`, `/app/students` —
  pantallas mobile-first reales, reusan las mismas queries/acciones de
  `dashboard/actions.ts` pero con su propio diseño de tarjetas.
- `dashboard/layout.tsx` redirige TODO `/dashboard/*` a `/app` para el
  User-Agent nativo, EXCEPTO `/dashboard/quizzes`, `/dashboard/students`,
  `/dashboard/settings` y `/dashboard/billing` (fallbacks a acciones
  avanzadas que las pantallas nativas no cubren todavía).
- `/dashboard/billing` en nativo es de **solo lectura** (sin el checkout de
  Flow) — Apple/Google prohíben vender contenido digital dentro del APK sin
  su IAP; el pago sigue siendo 100% externo (web).
- Layout persistente (`src/app/app/layout.tsx`) + `loading.tsx` por ruta +
  queries paralelas en `getDashboardContext()` → navegación fluida (antes se
  sentía "pegada" por falta de skeletons y queries en serie).

**Release Android:**
- Keystore de producción en `android/app/tulector-release.keystore`
  (gitignored) + `android/keystore.properties` (gitignored) con las
  credenciales. **SHA-1 de release necesita su PROPIO cliente OAuth Android**
  en Google Cloud (distinto al de debug) — sin esto el login con Google falla
  en el build de producción con `UNREGISTERED_ON_API_CONSOLE`.
- `minifyEnabled true` + `shrinkResources true` verificados sin crashes.
- Permiso `AD_ID` removido (`tools:node="remove"`) — la app no usa publicidad.
- "Eliminar cuenta" implementado (`deleteMyAccount` en `dashboard/actions.ts`,
  botón en `/dashboard/settings`) — requisito de Apple 5.1.1(v) y Google Play.

**iOS (recien agregado, sin probar — requiere Mac/Codemagic):**
- `npx cap add ios` ya corrido (usa SPM, no CocoaPods). `Info.plist` con los
  usage descriptions obligatorios (cámara, Face ID, fotos) y el URL scheme
  del deep link.
- Pendiente (requiere Apple Developer Portal, manual): habilitar "Sign in
  with Apple" capability, crear cliente OAuth **iOS** en Google Cloud, y
  cablear `SocialLogin.initialize({ apple: {...} })` para el login nativo con
  Apple en iOS (Android usa su propio flujo via Browser, no este).
- `codemagic.yaml` en la raíz: pipeline de CI para compilar Android (AAB
  firmado) e iOS (.ipa + TestFlight) en la nube sin Mac local. Secretos se
  configuran en codemagic.io, nunca en el repo.

**Ficha de tienda:** ver `store-assets/` (ícono 512, feature graphic,
capturas, y `ficha-play-store.md` con todos los textos y el checklist de
Data Safety / política de privacidad).
