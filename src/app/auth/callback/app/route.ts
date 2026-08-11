/**
 * Callback de OAuth EXCLUSIVO del APK (v2 en adelante).
 *
 * Existe para que el App Link verificado del manifiesto deje de apuntar a
 * `/auth/callback`, que es tambien la ruta del flujo web. Mientras apuntaba
 * ahi, Android le quitaba a Chrome su propio callback y se lo entregaba al APK:
 * quien iniciaba sesion en Chrome en un telefono con la app instalada terminaba
 * con "PKCE code verifier not found in storage", porque el code_verifier se
 * habia quedado en Chrome. Ver docs/plan-apk-applink-fase2.md.
 *
 * La logica es identica a la del callback web, asi que se reexporta su handler
 * en vez de duplicarla: el request llega desde el WebView del APK (User-Agent
 * con TuLectorApp), asi que su deteccion de nativo ya resuelve el destino
 * correcto (/app en vez de /dashboard).
 *
 * La ruta antigua `/auth/callback` se mantiene intacta: los APK ya instalados
 * (v1) siguen usandola, porque su manifiesto solo declara esa.
 */
export { GET } from "../route";
