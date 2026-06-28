# Spec: Código de hoja (OMR-nativo) — TuLector

Contrato de implementación para el **código impreso por hoja** que (1) verifica que se
escanea la hoja/versión correcta y (2) auto-vincula cada escaneo con su prueba y, en
multipágina, reensambla las páginas. Estado: **propuesta v1, sin implementar.**

## Por qué OMR-nativo y no QR

- Reutiliza el detector de cuadros oscuros que el motor ya tiene (anclas, pista de
  temporización) → **cero librerías de decodificación nuevas**.
- Robusto a las mismas condiciones de foto/ángulo que el resto de la hoja.
- Se registra con las mismas anclas y el mismo warp `1200×1650`.

## Geometría del código

Una **franja horizontal de celdas cuadradas** (lleno = bit 1, vacío = bit 0), en una
posición fija de la hoja, dentro del espacio canónico `1200×1650`.

Constantes propuestas (irían en `sheet_layout.ts`):

```
CODE_Y        = 180     // centro Y de la franja (banda superior, bajo las esquinas)
CODE_X0       = 110     // centro X de la primera celda
CODE_CELL     = 18      // lado del cuadrado impreso
CODE_STEP     = 24      // separación horizontal entre celdas (centro a centro)
CODE_R        = 7       // radio de muestreo del motor por celda
CODE_CELLS    = 46      // total de celdas (ver estructura)
codeCellX(i)  = CODE_X0 + i * CODE_STEP   // → 110 .. 1190 con 46 celdas
```

46 celdas × 24px = 1104px de ancho: cabe con márgenes. Si en pruebas físicas las celdas
salen muy chicas para el ángulo real, la v1.1 puede partir la franja en **2 filas de 23**.

## Estructura de bits (izquierda → derecha)

| Campo | Celdas | Bits | Descripción |
| --- | --- | --- | --- |
| `START` | 3 | — | Patrón guía fijo `1 0 1` (localiza la franja y da orientación) |
| `VERSION` | 4 | 4 | Versión del layout de hoja (el motor rechaza versiones que no entiende) |
| `SHEET_ID` | 20 | 20 | Id de la prueba/plantilla (~1.048.575) |
| `PAGE` | 4 | 4 | Nº de página, 0-15 → página 1-16 |
| `PAGES_TOTAL` | 4 | 4 | Total de páginas de la prueba |
| `CHECKSUM` | 8 | 8 | CRC-8 sobre los 32 bits de datos (VERSION..PAGES_TOTAL) |
| `STOP` | 3 | — | Patrón guía fijo `1 0 1` |

Total: **46 celdas** (6 de guía + 40 de datos). Bits MSB-first dentro de cada campo.

## Lectura (motor)

1. Sobre el warp `1200×1650`, registro local de la franja (búsqueda de offset `(dx,dy)`
   que maximiza oscuridad sobre los centros de celda, igual que `findRutOffset`).
2. Muestrear cada celda (`codeCellX(i), CODE_Y`, radio `CODE_R`) → ratio oscuro →
   umbral → bit.
3. Verificar `START` y `STOP` (`1 0 1`). Si fallan → **código no encontrado** (la hoja
   puede ser vieja/sin código): no es error fatal, solo no hay metadata.
4. Decodificar campos; verificar `CHECKSUM` (CRC-8). Si no cuadra → **código inválido**
   (no confiar; pedir reintento o avisar "hoja dañada/ilegible").
5. Salida: `{ version, sheetId, page, pagesTotal } | null`.

## Render (generador de hoja)

- `drawSheetCode(ctx, { version, sheetId, page, pagesTotal })` en `sheet_render.ts`,
  llamado desde `drawSheet` cuando los `marks`/config traen un código.
- Calcula los 40 bits de datos + CRC-8, antepone/pospone los guías `1 0 1`, y dibuja
  cuadros llenos/vacíos en `codeCellX(i), CODE_Y`.

## Integración en la app

- **Al generar** una hoja/prueba: asignar `sheetId` (desde el id del `paper`/`quiz`) y
  `page`/`pagesTotal`; persistir el mapeo `sheetId → quiz/paper`.
- **Al escanear**: leer el código; si `version` ≠ la que espera el motor → avisar "hoja
  desactualizada, reimprime". Vincular el escaneo al `quiz` correcto vía `sheetId`. En
  multipágina, juntar páginas por `sheetId` + `page` hasta tener `pagesTotal`.
- Registrar lo leído en `scan_logs.log.code` para diagnóstico.

## Rol en escalabilidad (multipágina)

`PAGE`/`PAGES_TOTAL` son la columna vertebral del multipágina: pruebas de 65+ preguntas
que no caben en una hoja se imprimen en varias, se escanean **en cualquier orden** y se
reensamblan por `sheetId` + `page`. Ver layout multi-columna como paso previo (más
preguntas por página antes de partir en páginas).

## Pendientes de validación física

- Confirmar tamaño de celda (`CODE_CELL`/`CODE_STEP`) legible con foto angulada real.
- Decidir 1 fila vs 2 filas según densidad.
- Elegir polinomio CRC-8 concreto y fijarlo aquí.
