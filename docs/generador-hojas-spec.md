# Especificación: Generador de Hojas de Respuesta

**Objetivo:** convertir `/sheet` en el **generador base del cliente** — configurable (nº preguntas, opciones, columnas, título, logo del colegio, etc.) — y agregar un **beta que autollene 40 hojas** (RUT y respuestas aleatorias) para imprimir, escanear y contrastar *ideal vs real*.

Va dirigido a la IA/dev que construya el generador. **Aún no construido** — esto es el plano.

---

## ⛔ REGLA DURA — EL MOTOR NO SE TOCA

**Prohibido modificar `src/tulector/**`** — incluido `sheet_render.ts` y `sheet_layout.ts`.

La hoja que el motor **dibuja** y la que **lee** son el mismo código (`drawSheet` + `questionLayout`): si las separas, divergen y el motor deja de leer. La geometría (anclas, riel de temporización, burbujas, grilla RUT, franja de código) está calibrada con el lector. **No se mueve ni un pixel de eso.**

- ✅ Usas `drawSheet(ctx, marks, cfg)` tal cual para la parte funcional.
- ✅ Dibujas marca/branding SOLO en las **zonas libres** (abajo).
- ❌ No editas `sheet_render.ts` ni `sheet_layout.ts` para meter el logo/título.
- ❌ No cambias posiciones de anclas, riel, burbujas, RUT ni código.

**Verificación:** `npm run test:omr` debe seguir pasando idéntico. Si cambia, tocaste el motor → revierte.

---

## El cable: API de render ya lista

```ts
import { drawSheet, parseRut, type SheetMarks } from "@/lib/sheet_render";
import { type SheetConfig, SHEET_W, SHEET_H } from "@/lib/sheet_layout";

const cfg: SheetConfig = { numQuestions: 40, numOptions: 5, numColumns: 2 };
const marks: SheetMarks = { answers: [...], rut: "12345678-5", filled: true, code: {...} };
drawSheet(ctx, marks, cfg);   // dibuja la hoja funcional completa
```

### `SheetConfig` (variantes que el motor YA soporta)
```ts
interface SheetConfig {
  numQuestions: number;   // 1..~60
  numOptions: number;     // 3 | 4 | 5
  numColumns?: number;    // 1 (default) | 2  ← multi-columna ya implementado
}
```

### `SheetMarks` (qué imprimir relleno)
```ts
interface SheetMarks {
  answers?: number[];     // respuesta por pregunta (índice 0..4) o -1
  rut?: string;           // "12345678-5"
  filled?: boolean;       // true = rellena las marcas (para hojas de prueba)
  code?: SheetCodeData;   // versión / id de prueba / página
}
```

---

## Parte 1 — Generador configurable (la base del cliente)

UI en `/sheet` con un formulario que arme el `SheetConfig` + branding, preview en canvas y descarga (PDF/PNG, alta resolución para imprimir).

### Controles
- **Nº de preguntas** (1–60).
- **Nº de opciones** (3/4/5).
- **Nº de columnas** (1/2) — o automático según nº de preguntas.
- **Título del ensayo / Nº de hoja** (texto, va en zona libre).
- **Nombre del colegio** (texto, zona libre).
- **Logo del colegio** (subir imagen, o dejar el recuadro/espacio).
- (El campo NOMBRE del alumno ya lo dibuja el motor.)

### Branding: SOLO en zonas libres
El motor nunca muestrea estas zonas, así que puedes dibujar ahí **encima** del canvas, después de `drawSheet`, sin tocar el motor:

| Zona | Coordenadas (canónicas, SHEET_W×SHEET_H) | Uso |
|---|---|---|
| Banda superior | `y` 0–100, `x` 120–1080 | Título, nombre del colegio |
| Esquina sup. izq. | `x` 110–300, `y` 10–95 | Logo (recuadro) |
| Margen inferior | `y` 1560–1640 | Pie: instrucciones, nº de hoja |

**NO dibujar nada** sobre: las 12 anclas (esquinas y `x≈580/1130`), el riel de temporización (`x≈120`), la caja NOMBRE, la franja de código (`y≈180`), la grilla RUT (`x` 560–1000, `y` 250–600) ni las burbujas de preguntas. Ante la duda, deja margen.

> Recomendación: pídele al motor que primero dibuje (`drawSheet`), y recién encima pintas el branding en las zonas libres. Así es imposible pisar una zona de lectura.

### Salida
- **PDF** (preferido para imprimir, escala ≥2x para nitidez).
- Nombre con el contexto: `hoja_<colegio>_<titulo>.pdf`.

---

## Parte 2 — Beta: autollenado de 40 hojas (calibración ideal vs real)

Genera 40 hojas, cada una con **RUT aleatorio válido** (DV correcto, usa `computeRutDV` del motor) y **respuestas aleatorias**, para imprimir, escanear y **contrastar lo que el motor lee vs lo que se imprimió**.

### Qué produce
1. Un **PDF de 40 páginas** (una hoja por página, `filled: true`).
2. Un **archivo de verdad-terreno** (JSON o CSV) con, por hoja:
   ```json
   { "page": 1, "rut": "12345678-5", "answers": ["A","C","B", ...] }
   ```
   Esto es el "ideal". Tras escanear las 40, comparas la lectura del motor contra este archivo → mides exactitud real (por burbuja y por hoja).

### Generación (pseudocódigo)
```ts
for (let p = 1; p <= 40; p++) {
  const rut = randomValidRut();                  // cuerpo aleatorio + computeRutDV
  const answers = randomAnswers(cfg.numQuestions, cfg.numOptions);
  drawSheet(ctx, { rut, answers, filled: true, code: { ..., page: p } }, cfg);
  addPageToPdf(canvas);
  groundTruth.push({ page: p, rut, answers: answers.map(a => labels[a]) });
}
downloadPdf("test_40_hojas.pdf");
downloadJson("test_40_hojas_verdad.json", groundTruth);
```

### Para qué sirve
- **Hoja autollenada (ideal):** imprimes, escaneas → el motor debería leer exactamente la verdad-terreno. Mide el piso de error del sistema (impresión + cámara + motor), sin error humano.
- **Luego lo mismo a mano (real):** alumnos/tú rellenan a mano → escaneas → contrastas. La diferencia entre "ideal" y "real" aísla el error del marcado humano (lápiz flojo, fuera de la burbuja) del error del motor.
- El código de hoja (`code.page`) permite emparejar automáticamente cada escaneo con su verdad-terreno.

---

## Límites claros
- ✅ Tocar `src/app/sheet/**`, crear utilidades en `src/lib/**` (fuera de `omr.ts`), generación de PDF, branding en zonas libres.
- ❌ Tocar `src/tulector/**` (incluido `sheet_render.ts`, `sheet_layout.ts`), `src/lib/omr.ts`, el fixture, `test_omr_real.ts`.
- ❌ Reimplementar la geometría/dibujo de la hoja: **siempre** vía `drawSheet`.

## Checklist de cierre
- [ ] `npm run test:omr` idéntico (motor intacto).
- [ ] `npm run build` compila.
- [ ] El generador arma hojas de 1 y 2 columnas con título/logo en zonas libres.
- [ ] El beta exporta PDF de 40 hojas + el JSON de verdad-terreno.
- [ ] Una hoja generada, impresa y escaneada, se lee correctamente (las anclas/riel/RUT intactos).
