# Filtro avanzado de resultados en el módulo Cursos (tuLector)

**Estado: implementado** (2026-07-21). Ver "Resultado" al final para el detalle de qué se construyó.

## Contexto

En `courses/[id]` (detalle de curso) hoy se ven KPIs generales, una tabla de
"ensayos rendidos" y una tabla de alumnos, pero **sin ningún filtro**: siempre
se muestran todos los papers de todos los ensayos, mezclados. El pedido es
agregar un filtro potente por tipo de prueba, que la tabla de equivalencia
PAES/SIMCE se vea siempre (independiente del ensayo de origen), exportación, y
dejar la puerta abierta a informes.

Decisiones ya tomadas con el usuario:
- Vive **solo** en `courses/[id]` (no se crea vista cruzada a nivel colegio).
- Equivalencias: **Chile ahora** (PAES/SIMCE), pero sin hardcodear strings en
  JSX — se centralizan en una config reutilizable para no repetir el patrón
  `evType === "paes" ? "PAES" : ...` que estaba duplicado en
  `courses/[id]/page.tsx:147` y `results/[quizId]/page.tsx:60-71,79-95`. No se
  conecta el modelo SQL huérfano (`evaluation_systems`/`performance_levels`) en
  esta iteración — es más alcance/riesgo del que se pidió.
- Exportación: **CSV + XLSX**, filtrados según la vista.

Restricción de negocio preservada (ya documentada en el código original,
líneas 70-73 y 98-100 de `courses/[id]/page.tsx`): nunca promediar "nota"
(ensayo personalizado, %) junto con puntaje PAES (100-1000) o SIMCE (100-400).
El filtro filtra el conjunto, no rompe esta segmentación.

## Resultado (lo que se construyó)

Archivos nuevos:
- `src/lib/evaluation_types.ts` — config centralizada de tipos de evaluación
  (`EVALUATION_TYPES`, `isNotaType`, `evaluationLabel`, `scoreDisplay`,
  `EVALUATION_VARIANT_LABELS`, `evaluationVariantLabel`).
- `src/lib/course_report.ts` — `buildCourseReportData(supabase, courseId, filters)`
  trae `course`, `studentList`, `allPapers` (sin filtrar) y `filteredPapers`
  (con los filtros de la UI aplicados en memoria); `latestEquivalentByStudent()`
  calcula el último equivalente PAES/SIMCE por alumno desde `allPapers`, para
  que la tabla de equivalencia no dependa del filtro activo. Reutilizada tanto
  por la página como por el endpoint de export.
- `src/components/dashboard/CourseResultsFilter.tsx` — Client Component (mismo
  patrón que `DateRangeFilter.tsx`) con selects de tipo de evaluación, ensayo,
  rango de fechas y rango de puntaje, todo vía querystring
  (`evalType`, `quizId`, `from`, `to`, `scoreMin`, `scoreMax`).
- `src/app/api/export/course/[id]/route.ts` — export CSV/XLSX
  (`?format=csv|xlsx`) que respeta los mismos filtros que la página, solo
  admin, registra en `export_logs` (`course_results_csv`/`course_results_xlsx`).

Archivos modificados:
- `src/app/dashboard/courses/[id]/page.tsx` — lee `searchParams`, usa
  `buildCourseReportData`, agrega `<CourseResultsFilter>`, una tabla nueva
  "Equivalencia PAES / SIMCE" (siempre visible, independiente del filtro) y
  los botones de exportación CSV/XLSX.
- `src/app/dashboard/results/[quizId]/page.tsx` — refactor menor: usa
  `evaluationVariantLabel()` en vez del diccionario de variantes duplicado
  inline.

Pendiente para una fase futura (fuera de este alcance, dejado como gancho):
- Generador de informes en PDF — no hay precedente en el proyecto (`jsPDF`
  solo genera la hoja OMR en blanco). `buildCourseReportData` ya deja el
  dataset filtrado listo para que un futuro botón "Generar informe" lo
  consuma sin duplicar lógica de filtrado.
- Conectar el modelo multi-país (`evaluation_systems`/`performance_levels`,
  hoy huérfano en SQL) si se decide soportar PLANEA/Saber/etc. con el mismo
  patrón de equivalencia.

## Verificación pendiente (manual, en un curso con datos reales)

1. `npm run build` / `next dev` — ya se corrió `tsc --noEmit` y `eslint` sobre
   los archivos nuevos/modificados sin errores nuevos.
2. En `/dashboard/courses/[id]` de un curso con papers mixtos (custom + paes +
   simce): probar cada combinación de filtro y confirmar que las tablas se
   actualizan vía querystring sin perder otros filtros activos.
3. Confirmar que la tabla "Equivalencia PAES / SIMCE" se sigue viendo aunque
   el filtro activo sea, por ejemplo, "Personalizado" o un `quizId` de tipo
   `custom`.
4. Descargar CSV y XLSX con distintos filtros activos y verificar que las
   filas coinciden con lo mostrado en pantalla, y que aparece el registro en
   `export_logs`.
5. Confirmar que un usuario no-admin no puede accionar los botones de export.
