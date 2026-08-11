/**
 * Busqueda y paginacion de alumnos, EN EL SERVIDOR.
 *
 * Antes cada pantalla que mostraba alumnos se traia la tabla entera y filtraba
 * en memoria (dashboard, el <select> del roster y la app movil). Aca vive la
 * unica implementacion: filtros tipados desde la URL + una consulta acotada que
 * devuelve solo la pagina pedida y el total.
 *
 * Se apoya en la funcion `search_students` (supabase/migrations/
 * 20260810000000_student_directory.sql). Si esa migracion todavia no se aplico,
 * cae a una consulta PostgREST equivalente -- misma degradacion silenciosa que
 * ya usa el modulo con isMissingColumnError.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveNationalId } from "@/lib/national_id";
import { isMissingColumnError } from "@/lib/supabase_errors";

export const PAGE_SIZE = 50;

export type StudentFilters = {
  q: string;
  courseId: string | null;
  noCourse: boolean;
  grade: string | null;
  hasPapers: boolean | null;
  page: number;
};

export type StudentDirectoryRow = {
  id: string;
  student_id: string | null;
  rut: string | null;
  name: string;
  course: string | null;
  course_id: string | null;
  grade: string | null;
  created_at: string;
  papers_count: number;
};

export type StudentPage = {
  rows: StudentDirectoryRow[];
  total: number;
  page: number;
  pageCount: number;
  /** true si la BD aun no tiene la migracion y se sirvio el modo degradado. */
  degraded: boolean;
};

/**
 * Sanea el texto para PostgREST: coma y parentesis rompen la sintaxis de .or(),
 * y %/* actuarian como comodines. Es la misma limpieza que hacia /api/search.
 */
export function sanitizeQuery(raw: string): string {
  return raw.replace(/[,%()*]/g, " ").trim();
}

/**
 * Filtros `.or()` de PostgREST para buscar un alumno por texto.
 * Extraido de /api/search para que la busqueda global del header y el listado
 * del modulo se comporten igual (incluye el match exacto por ID nacional
 * canonico, que es lo que hace que pegar un RUT con puntos encuentre al alumno).
 */
export function buildStudentSearchFilters(raw: string, countryCode: string): string[] {
  const q = sanitizeQuery(raw);
  const like = `%${q}%`;
  const filters = [`name.ilike.${like}`, `rut.ilike.${like}`, `student_id.ilike.${like}`];
  const rutNorm = resolveNationalId(raw, countryCode).canonical;
  if (rutNorm) filters.push(`rut_normalized.eq.${rutNorm}`);
  return filters;
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

/** Lee los filtros desde los searchParams de la pagina. */
export function parseStudentFilters(params: RawParams | undefined): StudentFilters {
  const p = params ?? {};
  const papers = first(p.papers);
  const pageNum = Number.parseInt(first(p.page), 10);
  return {
    q: first(p.q).trim(),
    courseId: first(p.course) || null,
    noCourse: first(p.course) === "none",
    grade: first(p.grade) || null,
    hasPapers: papers === "yes" ? true : papers === "no" ? false : null,
    page: Number.isFinite(pageNum) && pageNum > 1 ? pageNum : 1,
  };
}

/** Serializa los filtros de vuelta a query string (paginacion, enlaces, export). */
export function studentFiltersToQuery(f: Partial<StudentFilters>): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.noCourse) sp.set("course", "none");
  else if (f.courseId) sp.set("course", f.courseId);
  if (f.grade) sp.set("grade", f.grade);
  if (f.hasPapers === true) sp.set("papers", "yes");
  if (f.hasPapers === false) sp.set("papers", "no");
  if (f.page && f.page > 1) sp.set("page", String(f.page));
  return sp;
}

export function hasActiveFilters(f: StudentFilters): boolean {
  return Boolean(f.q || f.courseId || f.noCourse || f.grade || f.hasPapers !== null);
}

type MinimalClient = Pick<SupabaseClient, "rpc" | "from">;

/**
 * Trae UNA pagina de alumnos. Nunca devuelve la tabla completa: `PAGE_SIZE`
 * filas mas el total, que es lo que necesita el paginador.
 */
export async function fetchStudentPage(
  supabase: MinimalClient,
  school: { id: string; country_code?: string | null },
  filters: StudentFilters,
  pageSize: number = PAGE_SIZE,
): Promise<StudentPage> {
  const offset = (filters.page - 1) * pageSize;
  const q = sanitizeQuery(filters.q);
  const rutNorm = filters.q ? resolveNationalId(filters.q, school.country_code ?? "CL").canonical : null;

  const rpc = await supabase.rpc("search_students", {
    p_school: school.id,
    p_q: q || null,
    p_rut_norm: rutNorm,
    p_course: filters.noCourse ? null : filters.courseId,
    p_no_course: filters.noCourse,
    p_grade: filters.grade,
    p_has_papers: filters.hasPapers,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (!rpc.error) {
    const raw = (rpc.data ?? []) as (StudentDirectoryRow & { total_count: number })[];
    const total = raw.length > 0 ? Number(raw[0].total_count) : 0;
    return {
      rows: raw.map(({ ...row }) => ({ ...row, papers_count: Number(row.papers_count ?? 0) })),
      total,
      page: filters.page,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      degraded: false,
    };
  }

  return fetchStudentPageFallback(supabase, school, filters, offset, pageSize);
}

/**
 * Modo degradado (BD sin la migracion aplicada): misma paginacion y los mismos
 * filtros SALVO "con/sin ensayos rendidos", que necesita el cruce con papers
 * que vive en la funcion. Lo importante se conserva: sigue sin traerse la tabla
 * completa, que es el problema que se estaba arreglando.
 */
async function fetchStudentPageFallback(
  supabase: MinimalClient,
  school: { id: string; country_code?: string | null },
  filters: StudentFilters,
  offset: number,
  pageSize: number,
): Promise<StudentPage> {
  const build = (withCourseId: boolean) => {
    let query = supabase
      .from("students")
      .select(
        withCourseId
          ? "id,student_id,rut,name,course,course_id,grade,created_at"
          : "id,student_id,rut,name,course,grade,created_at",
        { count: "exact" },
      )
      .eq("school_id", school.id);

    if (filters.q) query = query.or(buildStudentSearchFilters(filters.q, school.country_code ?? "CL").join(","));
    if (filters.noCourse) query = query.is("course_id", null);
    else if (filters.courseId && withCourseId) query = query.eq("course_id", filters.courseId);
    if (filters.grade) query = query.eq("grade", filters.grade);

    return query.order("name").range(offset, offset + pageSize - 1);
  };

  let result = await build(true);
  if (result.error && isMissingColumnError(result.error, "course_id")) result = await build(false);

  const total = result.count ?? 0;
  const rows = ((result.data ?? []) as unknown as StudentDirectoryRow[]).map((r) => ({
    ...r,
    course_id: r.course_id ?? null,
    grade: r.grade ?? null,
    papers_count: 0,
  }));

  return {
    rows,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    degraded: true,
  };
}

/** Tope de filas de una exportacion. Evita que un filtro vacio genere un CSV inmanejable. */
export const EXPORT_MAX_ROWS = 20000;

/**
 * TODOS los alumnos que calzan con los filtros, para exportar.
 *
 * Es la unica lectura que a proposito no pagina: un CSV filtrado tiene que
 * traer el conjunto completo, no la primera pagina. Igual va acotada por
 * EXPORT_MAX_ROWS y por los filtros activos.
 */
export async function fetchStudentsForExport(
  supabase: MinimalClient,
  school: { id: string; country_code?: string | null },
  filters: StudentFilters,
): Promise<StudentDirectoryRow[]> {
  // Una sola consulta con el tope como tamaño de pagina, reusando exactamente
  // los mismos filtros que el listado.
  const all = await fetchStudentPage(supabase, school, { ...filters, page: 1 }, EXPORT_MAX_ROWS);
  return all.rows;
}

/** Recuento de alumnos por curso. Devuelve un mapa vacio si falta la migracion. */
export async function fetchCourseStudentCounts(
  supabase: MinimalClient,
  schoolId: string,
): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc("course_student_counts", { p_school: schoolId });
  const counts = new Map<string, number>();
  if (error || !data) return counts;
  for (const row of data as { course_id: string; student_count: number }[]) {
    counts.set(row.course_id, Number(row.student_count ?? 0));
  }
  return counts;
}
