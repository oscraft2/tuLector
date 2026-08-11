# Fase 2 — Acotar el App Link de Android (pendiente, exige recompilar el APK)

## Estado

**No implementado.** Se hizo la Fase 1 (traspaso de sesión al navegador), que
elimina el síntoma. Esto cierra la causa de raíz y va en la **próxima versión
del APK**, porque obliga a recompilar, reinstalar y que Android revalide el App
Link.

## El problema de fondo

`android/app/src/main/AndroidManifest.xml` declara:

```xml
<intent-filter android:autoVerify="true">
    <data android:scheme="https" android:host="tulector.vercel.app"
          android:pathPrefix="/auth/callback" />
</intent-filter>
```

Android entrega **cualquier** navegación a `tulector.vercel.app/auth/callback`
al APK, **venga de donde venga**. Incluido Chrome.

Consecuencia: si alguien inicia sesión en Chrome en un teléfono que tiene el
APK instalado, Supabase guarda el `code_verifier` en Chrome, pero el callback se
lo lleva la app — que no lo tiene. Error:

```
PKCE code verifier not found in storage.
```

La Fase 1 lo evita porque el profesor ya no necesita iniciar sesión en Chrome
(llega con la sesión abierta). Pero cualquier otro camino que sí inicie sesión
desde Chrome en ese teléfono va a seguir chocando.

## El cambio

1. **Manifiesto**: acotar el `pathPrefix` a una ruta exclusiva de la app, por
   ejemplo `/auth/callback/app`. Así `/auth/callback` "a secas" nunca se
   intercepta y Chrome conserva su propio callback.
2. **`src/lib/native/capacitor.ts:201`**: `OAUTH_DEEP_LINK` pasa a apuntar a esa
   ruta nueva.
3. **Ruta nueva** `src/app/auth/callback/app/route.ts`: puede reexportar el
   handler de `src/app/auth/callback/route.ts` (misma lógica; lo único que
   cambia es que esta ruta sí es del APK, así que el `isNative` deja de
   depender del User-Agent).
4. **Supabase → Authentication → URL Configuration**: agregar la nueva Redirect
   URL. Conviene dejar la antigua un tiempo para no romper a quien siga con la
   versión vieja instalada.
5. **`public/.well-known/assetlinks.json`**: revisar que siga correcto; el
   cambio de path no altera la huella de firma, pero conviene verificar la
   verificación del App Link tras instalar
   (`adb shell pm get-app-links cl.tulector.app`).

## Compatibilidad

Durante la transición conviven dos versiones del APK. La vieja seguirá pidiendo
`/auth/callback`, así que **esa ruta tiene que seguir funcionando** hasta que la
base instalada se actualice. El cambio es aditivo: se agrega la ruta nueva, no
se elimina la vieja.

## Verificación

- Instalar el APK nuevo y confirmar que el login nativo (Google y correo) sigue
  funcionando de punta a punta.
- En el mismo teléfono, iniciar sesión en `tulector.app` **desde Chrome**: ya no
  debe abrirse la app a mitad de camino ni aparecer el error de PKCE.
- Confirmar que un APK de la versión anterior sigue pudiendo iniciar sesión.
