# Prompt para DeepSeek (multi-agente) — Scoring flexible en tuLector

> Copia desde "Eres un equipo de ingeniería…" hacia abajo. El encabezado es para el dueño.

**Confirmación clave para el dueño:** ninguna de estas tareas modifica el motor OMR
(`src/tulector/**`, `src/lib/omr.ts`). El scoring es post-lectura: el motor entrega
`{ q, a, s }` y estas tareas cambian cómo se convierte eso en nota, equivalencia y
estadísticas. Las 14 guardias (`npm run test:omr`) deben quedar idénticas.

---

## Diagnóstico del scoring actual (julio 2026)

### Lo que funciona bien
- `src/lib/latam.ts:calculateGrade()` acepta `customConfig` con `exigencia` variable.
- La equivalencia PAES (`100 + pct * 900`) y SIMCE (`100 + pct * 300`) ya es
  **independiente del N° de preguntas** (usa porcentaje, no puntaje bruto). Un ensayo
  de 30 preguntas y uno de 65 entregan la misma escala si el % de acierto es igual.
- El pipeline de escaneo (`/api/scan/result`) ya guarda `equivalent_score` en `papers`.
- Las páginas de resultados muestran puntaje PAES/SIMCE cuando el quiz tiene
  `evaluation_type = 'paes'` o `'simce'`.

### Lo que está roto o duplicado (esto hay que arreglar)

| Problema | Ubicación | Impacto |
|----------|-----------|---------|
| `exigencia` hardcodeada a 0.6 en 3 lugares distintos | `results/[quizId]/page.tsx:132`, `quizzes/[id]/page.tsx:181`, `country_profiles.ts:46` | Si cambias la exigencia del colegio, las páginas de resultados no la respetan |
| `calculateGradeFallback()` duplicada idéntica en 2 archivos | `results/[quizId]/page.tsx:129-137`, `quizzes/[id]/page.tsx:178-186` | Código repetido, no usa `latam.ts:calculateGrade()` que ya existe |
| La tabla `quizzes` NO tiene columna `exigencia` | BD | No se puede personalizar exigencia por ensayo |
| `AnswerKeyEditor` fuerza 40 preguntas para PAES/SIMCE | `AnswerKeyEditor.tsx:28-49` | Un profe no puede hacer un ensayo PAES de 25 preguntas |
| El formulario de creación de quiz no expone exigencia | `QuizCreateForm.tsx` + `actions.ts:createQuiz` | Siempre se usa la del colegio, sin opción de override |
| `schools.exigencia` existe pero no se consulta en las páginas de resultados | `results/`, `quizzes/[id]/` | Las páginas usan su propio 0.6 hardcodeado en vez de `school.exigencia` |

---

Eres un equipo de ingeniería (multi-agente) trabajando en **tuLector.cl**
(`C:\Users\usuar\Desktop\tulector`): app web Next.js 16 (App Router) + Supabase,
desplegada en Vercel. El objetivo de este trabajo es hacer el sistema de scoring
**flexible**: exigencia variable por ensayo (default 60%), equivalencia PAES/SIMCE
que funcione con cualquier número de preguntas, y eliminación de código duplicado.

## REGLAS DURAS (violarlas rompe producción — no negociables)

1. **NUNCA toques el motor OMR**: nada de `src/tulector/**` ni `src/lib/omr.ts` ni `src/lib/sheet_*.ts` ni `src/lib/scan_log.ts`. Corre `npm run test:omr` ANTES y DESPUÉS de cada tarea: deben pasar las **14 guardias idénticas**.
2. **Build verde**: `npx tsc --noEmit` limpio (ignora errores de `tests/e2e/` por playwright) y `npx next build` con exit 0 ANTES de cada commit.
3. **NO hagas push ni deploy.** Commits LOCALES, uno por tarea, mensaje en español `feat(scoring-N): ...`.
4. **No cambies la fórmula de equivalencia PAES/SIMCE** (ya es correcta: basada en porcentaje). Solo elimina las trabas que impiden usarla con cualquier N° de preguntas.
5. **No rompas quizzes existentes.** Los quizzes creados antes de este cambio deben seguir funcionando (sin columna `exigencia` → usar el default del colegio o 0.6).
6. **UI en español (es-CL).** Reusa componentes y patrones existentes.

## COORDINACIÓN MULTI-AGENTE

Archivos de alto contacto (solo UN agente a la vez):
`src/lib/latam.ts`, `src/app/dashboard/actions.ts`, `src/app/api/scan/result/route.ts`,
`src/components/dashboard/AnswerKeyEditor.tsx`, `src/components/dashboard/QuizCreateForm.tsx`.

---

## Tarea 1 — Agregar `exigencia` a la tabla `quizzes`
**Problema:** hoy la exigencia solo existe a nivel `schools`. No se puede personalizar por ensayo.
**Qué hacer:**
1. Ejecutar esta migración SQL en Supabase (el dueño la corre):
```sql
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS exigencia numeric(3,2) DEFAULT 0.60;
COMMENT ON COLUMN quizzes.exigencia IS 'Exigencia personalizada del ensayo (0.00-1.00). NULL o default = usa la del colegio.';
```
2. No necesitas tocar código para esta tarea. Solo documentar la migración.
**Aceptación:** la columna existe en Supabase. Los quizzes viejos siguen funcionando (NULL → se toma 0.60 o la del colegio).

## Tarea 2 — Exponer exigencia en el formulario de creación de quiz
**Problema:** `QuizCreateForm` y `AnswerKeyEditor` no permiten configurar la exigencia del ensayo.
**Qué hacer:**
1. Agregar un campo `exigencia` en `QuizCreateForm.tsx`: slider o input numérico de 0% a 100%, default 60%. Con label "Exigencia" y helper text "Porcentaje de acierto mínimo para nota 4.0. 60% es el estándar chileno."
2. Agregar `<input type="hidden" name="exigencia">` o `<select>` en el formulario.
3. En `src/app/dashboard/actions.ts:createQuiz()`, leer `formData.get("exigencia")`, validar que sea número entre 0 y 1, y guardarlo en el INSERT de `quizzes`.
4. También en `duplicateQuiz()`: copiar el campo `exigencia`.
**Archivos:** `QuizCreateForm.tsx`, `actions.ts`. **No toca motor.**
**Aceptación:** al crear un quiz, se puede elegir la exigencia. Si no se elige, queda en 0.60.

## Tarea 3 — Permitir cualquier N° de preguntas en PAES/SIMCE
**Problema:** `AnswerKeyEditor` auto-configura 40 preguntas para PAES/SIMCE y bloquea los campos. Un profesor que quiere un ensayo PAES de 30 preguntas no puede.
**Qué hacer:**
1. En `AnswerKeyEditor.tsx`, eliminar el `useEffect` que fuerza `questionCount` y `optionCount` al cambiar `evalType`/`evalVariant`.
2. En su lugar, mostrar un helper text INFORMATIVO (no bloqueante): "El ensayo PAES real tiene 65 preguntas (M1: 65, M2: 55, Lectora: 65). Puedes usar menos para un ensayo de práctica."
3. Los campos `num_questions` y `options_per_question` deben ser siempre editables, incluso en PAES/SIMCE. El `evalVariant` solo sirve como metadata descriptiva y para etiquetar resultados.
4. Mantener el pre-fill de `questionCount` y `optionCount` como sugerencia (valor inicial), pero no bloquear los inputs. Esto significa: el `useEffect` debe correr solo una vez al montar (o al cambiar `evalType`/`evalVariant`), pero los inputs deben ser editables después.
5. El helper text azul actual debe indicar "Sugerencia" en vez de "Configuración automática" y mostrar los inputs activos.
**Archivos:** `AnswerKeyEditor.tsx`. **No toca motor.**
**Aceptación:** elegir PAES M1 → sugiere 40 preguntas y 5 opciones, pero se puede cambiar a 25. La clave de respuestas se valida contra el N° de preguntas elegido.

## Tarea 4 — Unificar cálculo de nota: eliminar `calculateGradeFallback`
**Problema:** hay 2 copias idénticas de `calculateGradeFallback()` que hardcodean `exigencia = 0.6`. Ya existe `latam.ts:calculateGrade()` que es superior (acepta `customConfig` con exigencia variable, escala configurable, label cualitativo).
**Qué hacer:**
1. En `results/[quizId]/page.tsx`: reemplazar `calculateGradeFallback(score, total)` por:
   ```ts
   import { calculateGrade } from "@/lib/latam";
   // ...
   const grade = calculateGrade(score, total, school.country_code ?? "CL", {
     exigencia: quiz.exigencia ?? school.exigencia ?? 0.60,
   });
   ```
   La página ya carga `quiz` y tiene acceso a `school` via `getDashboardContext()`.
2. En `quizzes/[id]/page.tsx`: mismo reemplazo.
3. **Eliminar las 2 funciones `calculateGradeFallback`** (líneas 129-137 y 178-186 de sus respectivos archivos).
4. Verificar que el `grade` que viene de `papers.grade` (guardado por `/api/scan/result`) se muestre cuando existe, y `calculateGrade` sea solo fallback para papers viejos sin `grade`.
**Archivos:** `results/[quizId]/page.tsx`, `quizzes/[id]/page.tsx`. **No toca motor.**
**Aceptación:** las páginas de resultados muestran notas calculadas con la exigencia correcta (la del quiz si existe, sino la del colegio, sino 0.60). Sin código duplicado.

## Tarea 5 — Usar exigencia del quiz en el pipeline de escaneo
**Problema:** `/api/scan/result` llama a `calculateGrade()` con `customConfig` que viene de `school.exigencia`. No considera `quiz.exigencia`.
**Qué hacer:**
1. En `scan/result/route.ts`, después de cargar el quiz, leer `quiz.exigencia`.
2. Pasar `quiz.exigencia ?? school.exigencia ?? 0.60` como `exigencia` en el `customConfig` de `calculateGrade()`.
3. Guardar el `grade` resultante en `papers.grade` (ya se hace, solo cambia el valor).
4. Asegurar que `equivalentScore()` siga funcionando igual (no necesita cambios: ya es `100 + pct * 900` basado en porcentaje).
**Archivos:** `api/scan/result/route.ts`. **No toca motor.**
**Aceptación:** escanear una hoja contra un quiz con exigencia 50% produce nota más alta que el mismo puntaje contra un quiz con exigencia 70%. El `equivalent_score` PAES/SIMCE no cambia (depende solo del % de acierto, no de la exigencia).

## Tarea 6 — Mostrar equivalencia PAES/SIMCE incluso con preguntas ≠ oficial
**Problema:** el `AnswerKeyEditor` muestra el mensaje "La hoja real tiene más preguntas, pero se reduce a 40 para el lector móvil". Esto confunde: sugiere que con menos preguntas no hay equivalencia válida.
**Qué hacer:**
1. Cambiar el texto del helper en `AnswerKeyEditor.tsx` cuando `evalType !== 'custom'`:
   ```
   "Equivalencia PAES: el puntaje se calcula como 100 + (aciertos / total) × 900,
    independiente del número de preguntas. Un 80% de acierto en 30 preguntas equivale
    al mismo puntaje PAES que un 80% en 65."
   ```
   (Análogo para SIMCE: 100 + pct × 300, escala 100-400.)
2. En las tablas de resultados (`results/[quizId]`, `quizzes/[id]`), cuando un quiz es PAES/SIMCE, mostrar la columna de puntaje equivalente usando `papers.equivalent_score` (ya guardado en BD) o calculado al vuelo como fallback.
3. Si `equivalent_score` es null (paper viejo), calcular: `Math.round(100 + (score/total) * (evalType === 'paes' ? 900 : 300))`.
**Archivos:** `AnswerKeyEditor.tsx`, `results/[quizId]/page.tsx`, `quizzes/[id]/page.tsx`. **No toca motor.**
**Aceptación:** un ensayo PAES de 25 preguntas muestra puntaje PAES (100-1000) en resultados. El helper text explica que la equivalencia es válida con cualquier N° de preguntas.

---

## LO QUE NO DEBES HACER
- No cambiar la fórmula `100 + pct * 900` (PAES) ni `100 + pct * 300` (SIMCE).
- No tocar el motor OMR.
- No modificar `country_profiles.ts` (la exigencia por defecto del país se mantiene en 0.60).
- No romper la vista de estudiante (`students/[id]`) que también muestra notas.
- No crear una nueva tabla. Solo se agrega 1 columna a `quizzes`.

## ENTREGABLE
1. Commits atómicos por tarea (local, sin push), con `test:omr` idéntico y build verde.
2. Para la Tarea 1: incluir el SQL exacto en el commit message y en este resumen.
3. Resumen final: qué cambió en la UX de creación de quizzes, qué columnas nuevas existen, y cómo verificar que la exigencia variable funciona (crear quiz con 50% vs 70% → mismo puntaje bruto produce notas distintas).
