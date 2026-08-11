import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { resolveNationalId } from "@/lib/national_id";
import { isMissingColumnError } from "@/lib/supabase_errors";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 60;

/** Quita lo que rompe la sintaxis de PostgREST y colapsa espacios. */
function sanitize(raw: string): string {
  return raw.replace(/[,%()*"']/g, " ").replace(/\s+/g, " ").trim();
}

/** ¿El texto parece un ID nacional / código de alumno y no un nombre? */
function looksLikeId(raw: string): boolean {
  return /\d/.test(raw);
}

type StudentRow = {
  id: string;
  name: string | null;
  rut: string | null;
  student_id: string | null;
  course: string | null;
  course_id: string | null;
};

const COLUMNS = "id,name,rut,student_id,course,course_id";
const COLUMNS_LEGACY = "id,name,rut,student_id,course";

/**
 * Buscador de alumnos para asignar un escaneo a mano (StudentPicker).
 *
 * Busca por PALABRAS, no por la frase completa: "juan perez" encuentra a
 * "PEREZ SOTO JUAN CARLOS". La búsqueda anterior hacía un solo ILIKE con todo
 * el texto, así que solo servía si el profesor escribía el nombre exactamente
 * en el orden en que está guardado — inservible con listas en formato
 * "APELLIDO APELLIDO NOMBRE".
 *
 * El filtro por curso acepta las dos formas en que un alumno puede tenerlo:
 * `course_id` (normalizado) y `course` (texto libre de las cargas antiguas).
 * Antes solo miraba `course_id` y por eso un curso podía aparecer vacío.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("q") ?? "").trim();
  const courseId = searchParams.get("course") || null;
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : 40;

  try {
    const { supabase, school } = await getDashboardContext();

    const { data: courseRows } = await supabase
      .from("courses")
      .select("id,name")
      .eq("school_id", school.id)
      .is("archived_at", null)
      .order("name");
    const courses = (courseRows ?? []) as { id: string; name: string }[];
    const courseNameById = new Map(courses.map((c) => [c.id, c.name]));
    const courseName = courseId ? courseNameById.get(courseId) ?? null : null;

    // Una consulta base con el filtro de curso ya aplicado (por id o por texto).
    const base = (columns: string) => {
      let query = supabase.from("students").select(columns, { count: "exact" }).eq("school_id", school.id);
      if (courseId) {
        const byName = courseName ? `,course.eq.${sanitize(courseName)}` : "";
        query = query.or(`course_id.eq.${courseId}${byName}`);
      }
      return query;
    };

    const q = sanitize(raw);
    const tokens = q ? q.split(" ").filter((t) => t.length >= 2) : [];

    const run = async (build: (columns: string) => unknown) => {
      let result = await (build(COLUMNS) as Promise<{ data: unknown; error: unknown; count: number | null }>);
      if (result.error && isMissingColumnError(result.error, "course_id")) {
        result = await (build(COLUMNS_LEGACY) as Promise<{ data: unknown; error: unknown; count: number | null }>);
      }
      return {
        rows: ((result.data ?? []) as unknown as StudentRow[]) ?? [],
        count: result.count ?? 0,
      };
    };

    // 1) Por nombre: TODAS las palabras deben aparecer, en cualquier orden.
    const byName = await run((columns) => {
      let query = base(columns);
      for (const token of tokens) query = query.ilike("name", `%${token}%`);
      return query.order("name").limit(limit);
    });

    // 2) Por identificador, solo si el texto trae dígitos. Se busca también por
    //    el ID canónico, para que pegar un RUT con puntos y guion encuentre al
    //    alumno igual que escribirlo pelado.
    let byId: { rows: StudentRow[]; count: number } = { rows: [], count: 0 };
    if (q && looksLikeId(q)) {
      const canonical = resolveNationalId(raw, school.country_code ?? "CL").canonical;
      byId = await run((columns) => {
        const filters = [`rut.ilike.%${q}%`, `student_id.ilike.%${q}%`];
        if (canonical) filters.push(`rut_normalized.eq.${canonical}`);
        return base(columns).or(filters.join(",")).order("name").limit(limit);
      });
    }

    const merged = new Map<string, StudentRow>();
    for (const row of [...byName.rows, ...byId.rows]) merged.set(row.id, row);

    // Relevancia: primero los que EMPIEZAN con lo escrito (lo que uno espera al
    // teclear un apellido), después el resto, siempre alfabético dentro de cada grupo.
    const first = tokens[0] ?? "";
    const starts = (s: StudentRow) =>
      first && (s.name ?? "").toLowerCase().split(/\s+/).some((w) => w.startsWith(first.toLowerCase())) ? 0 : 1;
    const students = [...merged.values()]
      .sort((a, b) => starts(a) - starts(b) || (a.name ?? "").localeCompare(b.name ?? "", "es"))
      .slice(0, limit);

    return NextResponse.json({
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        rut: s.rut ?? s.student_id ?? null,
        course: (s.course_id ? courseNameById.get(s.course_id) : null) ?? s.course ?? null,
        courseId: s.course_id ?? null,
      })),
      // Total de coincidencias, para que la UI diga "mostrando 40 de 213" en vez
      // de dejar creer que no hay más.
      total: Math.max(byName.count, byId.count, students.length),
      courses,
    });
  } catch {
    return NextResponse.json({ error: "No autenticado o sin colegio" }, { status: 401 });
  }
}
