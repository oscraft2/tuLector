# `src/tulector/` — Motor OMR (aislado de la UI)

Todo el **motor** vive aquí. La UI (`src/app/**`, `src/components/**`) NO debería
tener lógica de visión/OMR; solo consume este módulo.

## Contenido
- `omr.ts` — núcleo: detección de esquinas (componentes conectados), warp,
  registro por temporización, clasificador de burbujas, `readRut` + DV (módulo 11).
- `sheet_layout.ts` — fuente única de posiciones + layout paramétrico (`questionLayout`).
- `sheet_render.ts` — generador de hoja (`drawSheet`), compartido con el fixture.
- `omr_worker.ts` — wrapper de warp.

El motor nativo (C++) está en `mobile/native/` y replica esta lógica.

## Imports
Código nuevo: `import { ... } from "@/tulector/omr"`.
Los paths viejos `@/lib/omr`, `@/lib/sheet_layout`, etc. siguen funcionando como
**shims** de re-exportación (compatibilidad). Se pueden migrar y borrar luego.

## Regla de oro
- Cambios de motor/hoja → tocan **solo** `src/tulector/` (+ `mobile/native/` para C++)
  y se verifican con `npm run test:omr` (default 20/20 + RUT + paramétrico).
- Cambios de UI → todo lo demás. Así motor y UI no chocan.
