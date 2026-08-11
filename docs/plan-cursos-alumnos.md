# Cursos y Alumnos: separar módulos + listado que no cargue toda la base

## Estado (2026-08-10): IMPLEMENTADO

Construido y verde: `npx tsc`, `npx eslint` y `npm run build` (exit 0); `test:omr`
y `test:compact` sin cambios.

**Falta un paso manual del usuario**: aplicar
`supabase/migrations/20260810000000_student_directory.sql` en Supabase (SQL
Editor o `supabase db push`) — Vercel no corre migraciones. Sin ella la app
funciona igual, pero en modo degradado: el filtro "con/sin ensayos rendidos"
queda deshabilitado y no se muestran los recuentos por curso.

### Hallazgo: quedaron DOS cargas completas más, fuera de este alcance

Se arreglaron las tres del módulo de alumnos. Buscando al cierre aparecieron
otras dos del mismo tipo, en otros módulos, que **no** se tocaron:

- `src/app/dashboard/papers/[id]/page.tsx:22` — trae todos los alumnos del
  colegio para un `<select>` de asignación manual. Es el mismo patrón que tenía
  `CourseRoster`; se arregla igual, con el buscador contra `/api/search`.
- `src/app/dashboard/quizzes/[id]/page.tsx:40` — trae todos los alumnos para
  armar un mapa RUT→id y enlazar cada fila de resultados al perfil. Aquí basta
  con acotar la consulta a los RUT que aparecen en los `papers` de ese ensayo.

---

## Context

Hoy `/dashboard/students` es un módulo mixto que hace dos cosas mal a la vez:

1. **Carga la tabla `students` completa en cada entrada.** `students/page.tsx:62`
   hace `.select(...)` **sin `.limit()`, sin `.range()` y sin `.eq("school_id")`**,
   y luego renderiza en el servidor *una fila por alumno*. El costo crece con el
   colegio: es exactamente el "carga toda la base de datos" reportado.
2. **La gestión de cursos vive dentro de Alumnos.** Crear, editar, archivar y
   restaurar cursos, el roster y la importación masiva están en la barra lateral
   de la página de alumnos (`students/page.tsx:95-155`), mientras que
   `/dashboard/courses` es solo una lista de lectura (`courses/page.tsx:13`) que
   ni siquiera aparece en el menú.

Resultado buscado: **Cursos** pasa a ser el hogar de los cursos (creación,
edición, archivo e importación masiva de alumnos) y **Alumnos** queda solo con
estudiantes, con un buscador potente y paginación que trae 50 filas, no todas.

## Diagnóstico: hay tres cargas completas, no una

| Dónde | Qué hace hoy |
|---|---|
| `src/app/dashboard/students/page.tsx:62` | Trae **todos** los alumnos y renderiza todas las filas. |
| `src/components/dashboard/CourseRoster.tsx:57-63` | `<select>` con **todos** los alumnos que no están en el curso, como `<option>`. |
| `src/app/app/students/page.tsx:18` | Trae **todos** y filtra en el cliente (`StudentsScreen.tsx:20-23`, `useMemo`). |

Las tres se arreglan con el mismo mecanismo: búsqueda y paginación en el servidor.

## Decisiones ya tomadas con el usuario

- El **alta individual de alumno se queda en Alumnos**. A Cursos se va la
  importación masiva CSV (que ya crea cursos sola vía `findOrCreateCourse`) y
  toda la gestión de cursos.
- **Filtros**: texto libre (nombre/RUT/ID) + curso + sin curso asignado + nivel
  (`grade`) + con/sin ensayos rendidos.
- La app móvil `/app/students` entra **en esta misma tanda**.

## Arquitectura

### 1. Migración SQL (nueva)

`supabase/migrations/20260810000000_student_directory.sql`

- `CREATE INDEX idx_students_school_name ON students (school_id, name)` — el
  orden por defecto del listado; hoy solo existe `idx_students_school`.
- `CREATE INDEX idx_students_school_grade ON students (school_id, grade)`.
- **Función `search_students(...)`** (`LANGUAGE sql STABLE`, **SECURITY INVOKER**
  — el default, así RLS sigue aplicando; *no* usar una vista, que con
  `security_invoker` mal soportado podría saltarse RLS entre colegios).
  Recibe school, texto, curso, sin_curso, nivel, con_ensayos, limit y offset;
  devuelve las filas de la página **más `total_count`** en una sola ida.
  El filtro "con/sin ensayos" es el único que necesita SQL propio: cruza
  `papers.student_rut_norm` con `students.rut_normalized` y ya tiene índice
  (`idx_papers_school_student_rut_norm`, migración `20260703120000`).
- **Función `course_student_counts(p_school uuid)`** → `course_id, student_count`.
  Cuenta igual que `isStudentInCourse` (`students/page.tsx:277-279`):
  por `course_id`, o por nombre cuando `course_id` es nulo (filas sin migrar).

### 2. Lógica compartida (nuevo `src/lib/student_search.ts`)

- `buildStudentSearchFilters(raw, countryCode)` — **extraído de
  `src/app/api/search/route.ts:29-36`**, que ya resuelve bien lo difícil:
  saneado de caracteres que rompen `.or()` de PostgREST y match exacto por ID
  nacional con `resolveNationalId`. `/api/search` pasa a usar el helper (mismo
  comportamiento, una sola implementación).
- `parseStudentFilters(searchParams)` → objeto tipado desde la URL.
- `fetchStudentPage(supabase, school, filters)` → `{ rows, total }`. Llama a la
  RPC y **si la función no existe** (BD sin migrar) cae a una consulta PostgREST
  normal sin el filtro de ensayos — misma cultura de degradación silenciosa que
  ya usa `isMissingColumnError` en todo el módulo.
- `PAGE_SIZE = 50`.

Toda consulta lleva `.eq("school_id", school.id)` explícito. Hoy la página de
alumnos no lo hace y depende solo de RLS: agregarlo permite usar el índice y
además es defensa en profundidad.

### 3. Cursos: pasa a ser el módulo de cursos

**`src/app/dashboard/courses/page.tsx`** recibe lo que hoy está en la barra
lateral de Alumnos (mover, no reescribir): `CourseForm` (crear),
`CourseEditRow` (editar/archivar), el bloque de archivados con `restoreCourse`,
y `CSVImport` (importación masiva). La tabla suma la columna **N° de alumnos**
desde `course_student_counts`.

**`src/app/dashboard/courses/[id]/page.tsx`** conserva sus analíticas y suma la
gestión del roster: agregar y quitar alumnos del curso (`updateStudentCourse`).

**`src/components/dashboard/CourseRoster.tsx`** — se le quita la prop
`availableStudents` (la carga completa) y el `<select>` gigante; en su lugar un
buscador con debounce contra `/api/search`, que ya devuelve alumnos acotados al
colegio con `limit(6)`.

### 4. Alumnos: solo estudiantes

**`src/app/dashboard/students/page.tsx`** queda con: `PageHeader`, el nuevo
bloque de filtros, la tabla paginada, `StudentForm` (alta individual) y el
export CSV. Se le saca todo lo de cursos.

Componentes nuevos en `src/components/dashboard/`:
- `StudentFilters.tsx` (cliente) — texto con debounce + curso + sin curso +
  nivel + ensayos; escribe a `searchParams` con `router.replace`, igual que el
  patrón ya usado por `CourseResultsFilter.tsx`.
- `Pagination.tsx` — anterior/siguiente y "N de M" sobre `searchParams`.

`DataTable` no se toca: ya recibe `rows` y no asume nada sobre el total.

### 5. App móvil

`src/app/app/students/page.tsx` pasa a leer `searchParams` y usar
`fetchStudentPage`. `StudentsScreen.tsx` deja de filtrar en el cliente
(`useMemo`, línea 20) y su caja de búsqueda pasa a navegar por URL.

### 6. Cableado

- `src/components/dashboard/DashboardNav.tsx:31-36` — **agregar "Cursos"** al
  menú; hoy no está y el módulo es inalcanzable desde la navegación.
- `src/app/dashboard/actions.ts` — las acciones de curso/alumno hoy revalidan
  `/dashboard/students` (líneas ~1006, 1048, 1079, 1105, 1131, 1177, 1215);
  agregar `revalidatePath("/dashboard/courses")` para que la lista y los
  contadores se refresquen donde ahora viven.

## Verificación

- `npx tsc --noEmit` y `npx eslint` limpios en los archivos tocados.
- `npm run build` en verde.
- **La prueba que importa**: entrar a `/dashboard/students` con la BD real y
  confirmar en el panel de Supabase (o en el Network) que ya **no** se traen
  todas las filas sino 50 + el total. Repetir en `/app/students`.
- Recorrer a mano: crear curso, editar, archivar y restaurar desde Cursos;
  importar un CSV con 2 cursos y ver que aparecen con su recuento; agregar y
  quitar un alumno del roster; y en Alumnos probar los 5 filtros combinados y
  la paginación (incluido "sin curso", que es el que destapa datos sucios).
- Aplicar la migración en Supabase antes de probar los filtros de ensayos.
- `npm run test:omr` y `npm run test:compact` deben seguir verdes: esta tarea no
  toca el motor OMR ni el sub-motor compacto.

## Fuera de alcance

El bloque OMR compacto queda en pausa donde estaba: Fases 0/0.5/1/1.5 hechas y
verdes, pendientes Fase 2 (`quizzes.sheet_mode`) y Fase 3 (UI). Documentado en
`docs/plan-bloque-omr-compacto-ejecucion.md`.
