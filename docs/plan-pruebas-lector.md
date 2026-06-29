# Plan de Desarrollo y Pruebas del Lector (ideal vs real)

**Objetivo:** medir y documentar la exactitud del lector OMR de forma **reproducible**, separando el error del **sistema** (impresión + cámara + motor) del error del **marcado humano** (lápiz flojo, fuera de la burbuja). Sin esto, "funciona" es una opinión; con esto, es un número que mejora con el tiempo.

**Regla:** el motor (`src/tulector/**`) no se toca durante las pruebas. Solo se mide. Versión del motor en cada prueba = `APP_VERSION` (`src/lib/version.ts`).

---

## Herramientas (qué se construye para poder probar)

| # | Herramienta | Estado | Para qué |
|---|---|---|---|
| 1 | **Generador de hojas** (`/sheet`) | ✅ esta entrega | imprimir hojas configurables (1/2 col, nº preguntas/opciones, título, colegio, logo) |
| 2 | **Beta autollenado 40 hojas** | ✅ esta entrega | 40 hojas con RUT+respuestas aleatorias + **verdad-terreno** (JSON) → Fase A |
| 3 | **Plantilla de registro** | ✅ este doc | tabla estándar para anotar cada lote |
| 4 | **Comparador automático** | ⏳ siguiente | cruza scan_logs ↔ verdad-terreno (por RUT) → reporte de métricas |

La verdad-terreno y los `scan_logs` se emparejan **por RUT** (cada hoja del beta tiene un RUT aleatorio único y válido). El comparador hace el join y calcula las métricas.

---

## Las 3 fases de prueba

### Fase A — Piso del sistema (IDEAL, sin error humano)
Hojas **autollenadas** (beta de 40) → imprimir → escanear las 40 → comparar con la verdad-terreno.
- Aísla el error de **impresión + cámara + motor**, sin marcado humano.
- **Meta: ≥99% por burbuja, RUT 100%.** Si acá falla, el problema es del sistema (geometría/impresión/cámara), no del alumno.

### Fase B — Marcado humano (REAL)
Hojas **en blanco** → rellenar a mano con variaciones **controladas y anotadas**:
- Lápiz grafito vs pasta vs lápiz pasta de color.
- Relleno completo vs parcial (50%) vs solo un palito.
- Marca corrida (fuera de la burbuja), doble marca, marca borrada.
→ escanear → comparar.
- Mide la robustez ante el marcado real. La diferencia **A vs B** es exactamente el error que aporta el marcado humano.

### Fase C — Condiciones ambientales
Repetir A y/o B variando **una** condición a la vez (para aislar su efecto):
- **Luz:** natural / fluorescente / sombra / contraluz / flash.
- **Ángulo:** 0° / 15° / 30°.
- **Distancia y encuadre.**
- **Device:** varios teléfonos (gama baja/alta).
- **Papel:** blanco / reciclado / con arruga o doblez.

---

## Métricas (qué se mide en cada lote)

| Métrica | Definición |
|---|---|
| **Exactitud por burbuja** | opciones leídas correctas / total de burbujas |
| **Exactitud por hoja** | hojas 100% correctas / total de hojas |
| **Exactitud de RUT** | RUT completo correcto / total (distinguir `dvOk` vs `dvComputed`) |
| **Tasa de no-lectura** | hojas que no se detectaron / frames descartados |
| **Tipos de error** | falso positivo (marca vacía leída como llena), falso negativo (marca llena no leída), doble marca mal resuelta, RUT parcial |

Fuente de datos: los `scan_logs` **ya guardan todo** (RUT, respuestas, `scores`, `diag`, foto, `APP_VERSION` implícita por fecha). No hay que instrumentar nada nuevo para medir.

---

## Plantilla de registro (una fila por lote)

Copiar a una planilla o a `docs/registro-pruebas.md`:

| Fecha | Versión | Fase | Config (Q/opc/col) | Condición | N° hojas | Exac. burbuja | Exac. hoja | Exac. RUT | No-lectura | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-06-29 | b-0629h | A | 20/5/1 | luz natural, 0° | 40 | — | — | — | — | piso del sistema |

Anotar SIEMPRE: versión del motor, condición exacta, device, y un comentario cualitativo (qué falló y por qué se cree que falló).

---

## Protocolo de una corrida (paso a paso)

1. En `/sheet`, configurar (preguntas/opciones/columnas, título, colegio).
2. **Fase A:** "Generar 40 hojas de prueba" → imprimir el PDF + guardar el JSON de verdad-terreno.
   **Fase B:** imprimir N hojas en blanco y rellenarlas a mano según el plan de variaciones.
3. Escanear todas las hojas con la app (confirmar que el footer dice la versión esperada).
4. Cruzar resultados:
   - Manual (ahora): revisar `scan_logs` y comparar contra la verdad-terreno.
   - Automático (cuando esté la herramienta #4): subir el JSON → reporte de métricas.
5. Llenar una fila en la plantilla de registro.
6. Anotar los **casos que fallaron** (foto + por qué) → alimentan el dataset del clasificador (FASE 5) y futuras mejoras.

---

## Cómo las pruebas alimentan la mejora (el ciclo)

```
generar → imprimir → escanear → comparar con verdad-terreno → registrar métricas
       ↘ casos fallidos (features + ground truth) → dataset → entrenar clasificador → motor más robusto
```

- Los errores reales (Fase B/C) son el **combustible del clasificador entrenado** (FASE 5): cada hoja confirmada/corregida es un ejemplo etiquetado.
- Las métricas por versión permiten saber si un cambio **mejoró o empeoró** (regresión), de forma objetiva.

---

## Criterios de aceptación (metas)

| Fase | Meta exactitud burbuja | Meta RUT |
|---|---|---|
| A (ideal) | ≥ 99.5% | 100% |
| B (humano, marcado decente) | ≥ 98% | ≥ 98% |
| C (adverso) | ≥ 95% | ≥ 95% |

Por debajo de la meta en Fase A → revisar impresión/geometría/cámara. Por debajo solo en B/C → es robustez de marcado/ambiente → dataset + clasificador.

---

## Orden de desarrollo

1. ✅ **Generador + beta 40 hojas + verdad-terreno** (esta entrega).
2. **Correr Fase A** (piso del sistema) y registrar.
3. **Comparador automático** (herramienta #4): join scan_logs↔verdad-terreno por RUT → métricas.
4. **Fase B/C** + acumular casos fallidos.
5. **Entrenar el clasificador** con los casos reales y re-medir (¿mejoró?).
