# Integración: Motor OMR ↔ Interfaz / Producto

**Estado:** el motor está terminado, probado y desplegado. La interfaz (dashboard, quizzes, alumnos, resultados) está avanzada. **Falta el cable que los une:** que un escaneo se convierta en **nota de un alumno guardada** y aparezca en el dashboard.

Este documento define ese cable. Va dirigido a la IA/dev que hará la conexión.

---

## ⛔ REGLA DURA — EL MOTOR NO SE TOCA

**Prohibido modificar `src/tulector/**`** (`omr.ts`, `sheet_layout.ts`, `sheet_render.ts`, `sheet_code.ts`, `classifier.ts`, `scan_log.ts`) y el barrel `src/lib/omr.ts`.

El motor es código calibrado y validado a un costo alto. Tocarlo ha causado regresiones graves (lectura del RUT, captura, falsos positivos). **No es negociable:**

- ❌ No "mejores", refactorices, renombres ni "limpies" nada del motor.
- ❌ No cambies umbrales, geometría, layout, ni firmas de funciones.
- ✅ Solo lo **consumes** a través de su API pública (abajo).
- ✅ Si crees que necesitas un cambio en el motor, **PARA y pregúntale al dueño.** No lo hagas por tu cuenta.

**Verificación obligatoria antes y después de tu trabajo:**
```bash
npm run test:omr   # deben pasar las 8 guardias. Si cambian, tocaste el motor → revierte.
```
Si `npm run test:omr` no da exactamente el mismo resultado que antes de empezar, **rompiste algo: revierte tu cambio.**

---

## La API pública del motor (los cables ya listos)

Importar siempre desde `@/lib/omr`. Todo opera sobre `ImageData` (canvas), 100% en el cliente.

```ts
import {
  findCorners, warpSheet, gradeBubbles, readRut, readSheetCode,
  type OMRConfig, type GradeReport, type BubbleResult, type RutResult,
} from "@/lib/omr";
```

### Contrato de tipos (lo que el motor te entrega)

```ts
interface OMRConfig {
  numQuestions: number;
  numOptions: number;
  optionLabels: string;   // ej. "ABCDE"
  numColumns?: number;    // 1 (default) | 2
  idRows: number; idCols: number;
}

interface BubbleResult {
  question: number;       // 1..numQuestions
  answer: string;         // "A".."E", "-" (blanco), "?" (glare), "AB" (múltiple)
  scores: number[];       // score por opción
  correct: boolean | null;
  features?: number[][];  // crudos por opción (dataset/clasificador)
}

interface GradeReport {
  results: BubbleResult[];
  valid: boolean;         // false → hoja no leíble (ver reason)
  reason?: string;
  diag?: GradeDiag;
}

interface RutResult {
  rut: string;            // "12345678-5" o "" si incompleto
  dvOk: boolean;          // DV leído coincide con el calculado
  complete: boolean;
  dvComputed?: boolean;   // DV rellenado por cálculo
  diag?: RutDiag;
}
```

### El flujo de lectura (ya implementado en `src/app/scan/page.tsx`)

```ts
const corners = findCorners(frame, config);          // detecta las 12 anclas
const warped  = warpSheet(frame, corners, config);   // rectifica (homografía por celda)
const report  = gradeBubbles(warped, config, corners); // respuestas
const rut     = readRut(warped, config);             // RUT
const code    = readSheetCode(warped);               // código de hoja (opcional)
```

**`/scan` ya produce `report.results` (respuestas) y `rut.rut`.** Tu trabajo NO es leer la hoja — eso ya funciona. Tu trabajo es **qué hacer con esos datos.**

---

## Tu tarea: conectar el resultado al producto

Hoy el escaneo solo guarda un registro de diagnóstico en `scan_logs`. **No** persiste la nota del alumno. Hay que cerrar el ciclo:

```
escaneo → match RUT con alumno → calcular nota vs clave del quiz → GUARDAR → dashboard
```

### Pasos del cable

1. **Obtener la clave del quiz activo.** Ya existe `GET /api/scan/active-quiz` (devuelve `answer_key`, `title`). El escaneo ya la carga. Asegúrate de tener también el `quiz_id`.

2. **Match del RUT con un alumno** (`students`):
   - `rut.rut` (ej. `"12345678-5"`) → buscar el `student` del curso/colegio del profe.
   - Si no hay match: crear alumno provisional o marcar "sin identificar" (no bloquear el guardado). El RUT puede venir vacío en fotos malas — manejar ese caso.

3. **Calcular la nota** comparando `report.results[i].answer` con `answer_key[i]`:
   - correctas / total → puntaje → nota (según escala chilena 1.0–7.0, exigencia configurable; ver `evaluation_systems` / `performance_levels`).

4. **Persistir** en las tablas del producto (ya existen):
   - `grade_records` y/o `papers`: { quiz_id, student_id, respuestas, puntaje, nota, foto, timestamp }.
   - Esto es lo que leen `dashboard/results/[quizId]` y `dashboard/papers`.

5. **Idempotencia / re-escaneo:** si se vuelve a escanear al mismo alumno en el mismo quiz, actualizar (no duplicar).

### Dónde enchufar
- **No** metas lógica de negocio dentro de `/scan` que toque el motor. Crea un **endpoint** (`POST /api/scan/result`) o una server action que reciba el payload del escaneo y haga match + cálculo + guardado.
- El cliente (`/scan`) ya tiene `report.results`, `rut.rut`, `quiz_id`, foto. Solo **POSTea** eso al endpoint nuevo.

### Lo que el cliente ya te entrega (no lo recalcules)
```ts
{
  quizId: string,
  rut: string,                          // de readRut
  answers: { q: number, a: string }[],  // de report.results
  photo?: string,                       // miniatura JPEG (dataURL)
}
```

---

## Límites claros

- ✅ Crear endpoints/actions, tocar `src/app/**` (fuera de la lógica de lectura), `src/lib/**` (fuera de `omr.ts`), migraciones de BD.
- ✅ Leer/escribir `students`, `grade_records`, `papers`, `quizzes`.
- ❌ Tocar `src/tulector/**`, `src/lib/omr.ts`, `test_omr_real.ts`, el fixture.
- ❌ Cambiar la forma en que `/scan` llama al motor (`findCorners/warpSheet/gradeBubbles/readRut`).

## Checklist de cierre
- [ ] `npm run test:omr` da idéntico (motor intacto).
- [ ] `npm run build` compila.
- [ ] Un escaneo real aparece como nota de un alumno en `dashboard/results/[quizId]`.
- [ ] Re-escanear no duplica.
- [ ] RUT vacío/sin match no rompe (se guarda como "sin identificar").
