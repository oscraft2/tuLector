/**
 * "De quien son los ensayos que estoy viendo".
 *
 * En un colegio del plan `school` conviven varios docentes. La RLS ya aisla a un
 * docente no-admin (20260808000000_teacher_isolation.sql: solo ve lo que el
 * creo), pero el ADMIN ve todo — y por defecto veia mezclados los ensayos de
 * todo el establecimiento, que no es lo que quiere al entrar a trabajar.
 *
 * Regla:
 *  - Docente no-admin: no se filtra nada aca. La RLS ya le muestra solo lo suyo
 *    y agregar un `created_by = yo` de mas podria esconderle un ensayo propio
 *    con autor nulo (filas anteriores a que se grabara created_by).
 *  - Admin de plan `school`: por defecto SOLO lo suyo, y puede cambiar el foco a
 *    todo el colegio o a un docente concreto.
 *  - Cualquier otro caso (admin de otro plan): sin selector y sin cambios — un
 *    plan sin equipo no tiene de quien separar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type TeacherScopeMode = "mine" | "all" | "one";

export type TeacherScope = {
  mode: TeacherScopeMode;
  /** Docente cuyo trabajo se esta viendo (null cuando mode === "all"). */
  userId: string | null;
  /** true si esta cuenta puede cambiar el foco (admin de plan school). */
  canSwitch: boolean;
};

/** Valor del parametro de URL. `mine` es el default y no se serializa. */
export const TEACHER_SCOPE_PARAM = "docente";

type RawParams = Record<string, string | string[] | undefined> | undefined;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTeacherScope(
  params: RawParams,
  ctx: { userId: string; isAdmin: boolean; plan?: string | null },
): TeacherScope {
  const canSwitch = ctx.isAdmin && ctx.plan === "school";
  if (!canSwitch) {
    // Sin selector NO se filtra nada desde la app: un docente ya ve solo lo suyo
    // por RLS (teacher_isolation) y un admin de otro plan sigue viendo su
    // colegio completo, igual que hasta ahora. Filtrar aqui ademas seria
    // redundante y podria esconderle a un docente un ensayo propio con autor
    // nulo (filas anteriores a que se grabara created_by).
    return { mode: "all", userId: null, canSwitch: false };
  }
  const raw = first(params?.[TEACHER_SCOPE_PARAM]).trim();
  if (raw === "all") return { mode: "all", userId: null, canSwitch: true };
  // Solo se acepta un uuid: cualquier otra cosa en la URL cae al default en vez
  // de viajar a una consulta.
  if (raw && raw !== "mine" && UUID_RE.test(raw)) return { mode: "one", userId: raw, canSwitch: true };
  return { mode: "mine", userId: ctx.userId, canSwitch: true };
}

/**
 * Con un solo docente en el colegio no hay nada que separar: se desactiva el
 * foco para no esconder, sin selector visible que lo revierta, los ensayos que
 * hubiera creado alguien que ya no es miembro.
 */
export function resolveScope(scope: TeacherScope, teacherCount: number): TeacherScope {
  if (scope.canSwitch && teacherCount < 2) return { mode: "all", userId: null, canSwitch: false };
  return scope;
}

/** Query string del scope (vacio para el default "mine"). */
export function teacherScopeParam(scope: Pick<TeacherScope, "mode" | "userId">): string {
  if (scope.mode === "all") return "all";
  if (scope.mode === "one" && scope.userId) return scope.userId;
  return "";
}

/** Enlace que conserva los demas filtros de la pagina y cambia solo el docente. */
export function teacherScopeHref(basePath: string, current: RawParams, value: string): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(current ?? {})) {
    if (k === TEACHER_SCOPE_PARAM) continue;
    const val = first(v);
    if (val) sp.set(k, val);
  }
  if (value) sp.set(TEACHER_SCOPE_PARAM, value);
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

type Filterable = {
  eq: (column: string, value: unknown) => Filterable;
  or: (filters: string) => Filterable;
};

/**
 * Aplica el scope a una consulta sobre `quizzes`.
 *
 * En modo "mine" tambien entran los ensayos SIN autor (`created_by` nulo): son
 * filas anteriores a que se grabara el autor y, si se excluyeran, el admin
 * perderia de vista ensayos historicos sin darse cuenta. En "all" no se toca la
 * consulta y en "one" se filtra por ese docente exacto.
 */
export function applyTeacherScope<T>(query: T, scope: TeacherScope): T {
  if (scope.mode === "all" || !scope.userId) return query;
  // `eq`/`or` devuelven el MISMO builder, asi que el tipo original se conserva:
  // el generico va suelto (y no atado a Filterable) para no borrar el tipado de
  // las filas que infiere el cliente de Supabase en cada pantalla.
  const q = query as unknown as Filterable;
  if (scope.mode === "one") return q.eq("created_by", scope.userId) as unknown as T;
  return q.or(`created_by.eq.${scope.userId},created_by.is.null`) as unknown as T;
}

/**
 * Ids de los ensayos dentro del scope. Lo usan las pantallas que listan
 * `papers`, que no tienen autor propio: una hoja pertenece al docente dueño de
 * su ensayo (el mismo criterio que usa la RLS de papers).
 *
 * Devuelve `null` cuando no hay que filtrar (scope "all") para que el llamador
 * no pague una consulta ni arme un `.in()` innecesario.
 */
export async function quizIdsInScope(
  supabase: Pick<SupabaseClient, "from">,
  schoolId: string,
  scope: TeacherScope,
): Promise<string[] | null> {
  if (scope.mode === "all" || !scope.userId) return null;
  // La lista viaja despues en un `.in("quiz_id", ids)`. Es simple y suficiente
  // para el tamaño real de un colegio (decenas de ensayos por docente); si algun
  // dia un solo docente tuviera cientos, conviene cambiarlo por un filtro sobre
  // la tabla relacionada (quizzes!inner) para no armar una URL gigante.
  const { data, error } = await applyTeacherScope(
    supabase.from("quizzes").select("id").eq("school_id", schoolId),
    scope,
  );
  if (error) return null;
  return ((data ?? []) as { id: string }[]).map((q) => q.id);
}

export type TeacherOption = { userId: string; label: string; isSelf: boolean };

/**
 * Docentes del colegio para el selector. El correo vive en `auth.users`, que
 * solo se puede leer con service role — el mismo camino que ya usa la seccion
 * de equipo en Configuracion. Si algo falla, se cae al id recortado en vez de
 * romper la pagina (el selector es una comodidad, no el contenido).
 */
export async function fetchTeacherOptions(
  supabase: Pick<SupabaseClient, "from">,
  schoolId: string,
  selfUserId: string,
): Promise<TeacherOption[]> {
  const { data: members } = await supabase
    .from("school_members")
    .select("user_id,role")
    .eq("school_id", schoolId)
    .order("created_at");
  const rows = (members ?? []) as { user_id: string; role: string | null }[];
  if (rows.length === 0) return [];

  const emailByUser = new Map<string, string>();
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabaseAdmin");
    const admin = createSupabaseAdminClient();
    await Promise.all(
      rows.map(async (m) => {
        try {
          const { data } = await admin.auth.admin.getUserById(m.user_id);
          if (data?.user?.email) emailByUser.set(m.user_id, data.user.email);
        } catch { /* usuario borrado en auth: se muestra el id */ }
      }),
    );
  } catch { /* sin service role configurado: se muestran los ids */ }

  return rows.map((m) => ({
    userId: m.user_id,
    label: m.user_id === selfUserId ? "Yo" : emailByUser.get(m.user_id) ?? `${m.user_id.slice(0, 8)}…`,
    isSelf: m.user_id === selfUserId,
  }));
}
