# `src/tulector/` — Motor OMR (aislado de la UI)

Todo el **motor** vive aquí. La UI (`src/app/**`, `src/components/**`) NO debería
tener lógica de visión/OMR; solo consume este módulo.

## Contenido
- `omr.ts` — núcleo: detección de esquinas (componentes conectados), warp,
  registro por temporización, clasificador de burbujas, `readRut` + DV (módulo 11).
- `sheet_layout.ts` — fuente única de posiciones + layout paramétrico (`questionLayout`).
- `sheet_render.ts` — generador de hoja (`drawSheet`), compartido con el fixture.
- `omr_worker.ts` — wrapper de warp.

> La app móvil se construye con **Capacitor** (reusa este motor TS), NO con Flutter.
> El motor C++ nativo y el proyecto Flutter (`mobile/`) están **DEPRECADOS y eliminados**.
> Ver `docs/apk-plan.md`.

## Imports
Código nuevo: `import { ... } from "@/tulector/omr"`.
Los paths viejos `@/lib/omr`, `@/lib/sheet_layout`, etc. siguen funcionando como
**shims** de re-exportación (compatibilidad). Se pueden migrar y borrar luego.

## Regla de oro
- Cambios de motor/hoja → tocan **solo** `src/tulector/`
  y se verifican con `npm run test:omr` (default 20/20 + RUT + paramétrico).
- Cambios de UI → todo lo demás. Así motor y UI no chocan.
