# Fase 2 — App Link acotado a una ruta exclusiva de la app

## Estado: implementado en el código, PENDIENTE de compilar el APK

El lado web está hecho y desplegado. Falta **recompilar e instalar el APK** para
que el cambio surta efecto, y agregar la Redirect URL en Supabase.

## El problema que cierra

`AndroidManifest.xml` declaraba un App Link verificado sobre
`https://tulector.vercel.app/auth/callback` — que es **también la ruta del flujo
web**. Android entrega esa URL al APK venga de donde venga, así que quien
iniciaba sesión en Chrome en un teléfono con la app instalada perdía su
callback: el `code_verifier` se quedaba en Chrome y salía

```
PKCE code verifier not found in storage.
```

La Fase 1 (traspaso de sesión) evitó el síntoma en "Mi plan". Esto elimina la
causa.

## ⚠️ El detalle que casi rompe todo: el APK carga la web REMOTA

`capacitor.config.ts` usa `server.url = https://tulector.vercel.app/auth`. Es
decir: **un APK ya instalado siempre ejecuta el JS más nuevo desplegado.**

Si se cambiaba la ruta del callback en el código web sin más, todos los APK ya
instalados (cuyo manifiesto solo declara `/auth/callback`) habrían pedido el
callback en `/auth/callback/app`, Android no lo habría enrutado a la app, y el
login habría quedado **roto para toda la base instalada**.

Por eso el callback se elige **según la versión del contenedor**, leída de un
token en el User-Agent:

- `capacitor.config.ts` → `appendUserAgent: "TuLectorApp/2"`.
- `src/lib/native/capacitor.ts` → `nativeAppVersion()` y `oauthDeepLink()`:
  v2+ usa `/auth/callback/app`; v1 (sin sufijo) sigue con `/auth/callback`.
- La detección de "es nativo" no cambia: sigue buscando el substring
  `TuLectorApp`.

## Qué se cambió

| Archivo | Cambio |
|---|---|
| `android/app/src/main/AndroidManifest.xml` | `pathPrefix` → `/auth/callback/app` (sigue con `autoVerify`) |
| `capacitor.config.ts` | `appendUserAgent: "TuLectorApp/2"` |
| `src/lib/native/capacitor.ts` | `nativeAppVersion()` + `oauthDeepLink()`; se elimina la constante fija |
| `src/app/auth/callback/app/route.ts` | **nuevo** — reexporta el handler del callback web |
| `src/app/auth/page.tsx`, `forgot-password/page.tsx`, `NativeBootstrap.tsx` | Usan `oauthDeepLink()` |
| `src/app/auth/app-bridge/page.tsx` | Dos `intent://`: ruta v2 como principal y la v1 de respaldo |

La ruta `/auth/callback` **se mantiene intacta**: es la del flujo web y la que
siguen usando los APK v1.

## Orden de despliegue (importante)

1. **Web primero** (ya hecho). Con esto los APK v1 siguen funcionando igual.
2. **Supabase → Authentication → URL Configuration**: agregar a Redirect URLs
   `https://tulector.vercel.app/auth/callback/app`. Dejar también la antigua:
   los v1 la siguen necesitando.
3. **Recién entonces** compilar e instalar el APK nuevo
   (`npx cap sync android` y build). Si se instala antes del paso 1, el APK v2
   pediría el callback viejo, que su manifiesto ya no declara, y no podría
   iniciar sesión.

## Verificación tras instalar el APK

- Login nativo completo (Google y correo) desde el APK nuevo.
- En el **mismo teléfono**, iniciar sesión en `tulector.app` desde **Chrome**:
  ya no debe abrirse la app a mitad de camino ni aparecer el error de PKCE.
- Un APK v1 (versión anterior) debe seguir pudiendo iniciar sesión.
- Confirmar la verificación del App Link:
  `adb shell pm get-app-links cl.tulector.app` → el dominio debe salir
  `verified` para la ruta nueva.
