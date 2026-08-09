import Link from "next/link";
import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusPill } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const SEARCH_SCAN_PAGES = 10; // al buscar, escanea hasta 500 usuarios (listUsers no soporta filtro por email en el servidor en esta version de @supabase/auth-js)

type PageProps = { searchParams?: Promise<{ page?: string; q?: string }> };

type UserRow = {
  id: string;
  email: string | null;
  lastSignIn: string | null;
  createdAt: string;
  platformRole: string | null;
  schools: { name: string; plan: string }[];
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { admin } = await requirePlatformContext(["platform_admin", "support"]);
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim().toLowerCase();
  const currentPage = Math.max(1, Number(sp.page) || 1);

  let rawUsers: { id: string; email: string | null; lastSignIn: string | null; createdAt: string }[] = [];
  let hasNextPage = false;
  let scannedCap = false;
  let totalUsers: number | null = null;

  if (q) {
    for (let p = 1; p <= SEARCH_SCAN_PAGES; p++) {
      const { data } = await admin.auth.admin.listUsers({ page: p, perPage: PAGE_SIZE });
      if (!data.users.length) break;
      rawUsers.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null, lastSignIn: u.last_sign_in_at ?? null, createdAt: u.created_at })));
      const nextPage = "nextPage" in data ? data.nextPage : null;
      if (nextPage === null) break;
      if (p === SEARCH_SCAN_PAGES) scannedCap = true;
    }
    rawUsers = rawUsers.filter((u) => (u.email ?? "").toLowerCase().includes(q)).slice(0, PAGE_SIZE);
  } else {
    const { data } = await admin.auth.admin.listUsers({ page: currentPage, perPage: PAGE_SIZE });
    rawUsers = data.users.map((u) => ({ id: u.id, email: u.email ?? null, lastSignIn: u.last_sign_in_at ?? null, createdAt: u.created_at }));
    hasNextPage = "nextPage" in data ? data.nextPage !== null : false;
    totalUsers = "total" in data ? data.total : null;
  }

  const ids = rawUsers.map((u) => u.id);
  const [{ data: platformRows }, { data: memberRows }] = ids.length > 0
    ? await Promise.all([
        admin.from("platform_users").select("user_id, role, revoked_at").in("user_id", ids),
        admin.from("school_members").select("user_id, role, schools(name, plan)").in("user_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const platformRoleByUser = new Map<string, string>();
  for (const row of platformRows ?? []) {
    if (!row.revoked_at) platformRoleByUser.set(row.user_id, row.role);
  }
  const schoolsByUser = new Map<string, { name: string; plan: string }[]>();
  for (const row of memberRows ?? []) {
    const joined = row.schools as unknown as { name?: string; plan?: string } | { name?: string; plan?: string }[] | null;
    const s = Array.isArray(joined) ? joined[0] : joined;
    if (!s?.name) continue;
    const list = schoolsByUser.get(row.user_id) ?? [];
    list.push({ name: s.name, plan: s.plan ?? "-" });
    schoolsByUser.set(row.user_id, list);
  }

  const users: UserRow[] = rawUsers.map((u) => ({
    ...u,
    platformRole: platformRoleByUser.get(u.id) ?? null,
    schools: schoolsByUser.get(u.id) ?? [],
  }));

  const linkCls = "rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50";
  const linkClsDisabled = "pointer-events-none rounded-md border border-[#e6e8eb] px-4 py-2 text-sm font-semibold text-[#c1c7cf]";

  return (
    <AdminShell active="/admin/users" title="Usuarios" description="Usuarios reales de Supabase Auth: rol de plataforma, colegio(s) y plan.">
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/users" method="GET">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por correo..."
          className="w-full max-w-sm rounded-md border border-[#cfd6df] px-3 py-2 text-sm outline-none focus:border-[#07305f]"
        />
        <button className="rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white">Buscar</button>
        {q ? <Link href="/admin/users" className={linkCls}>Limpiar</Link> : null}
      </form>

      {q && scannedCap ? (
        <p className="mb-3 text-xs text-[#9aa3af]">Busqueda limitada a los primeros {SEARCH_SCAN_PAGES * PAGE_SIZE} usuarios (mas antiguos primero).</p>
      ) : null}

      <DataTable
        columns={["Email", "Rol plataforma", "Colegio(s) / Plan", "Ultimo login", "Creado"]}
        rows={users}
        empty={q ? "Sin resultados para esa busqueda." : "Sin usuarios."}
        renderRow={(u) => (
          <tr key={u.id} className="border-b border-[#eef0f3] last:border-0 text-sm">
            <td className="px-5 py-4 font-semibold text-[#07305f]">
              <Link href={`/admin/users/${u.id}`} className="hover:underline">{u.email ?? "-"}</Link>
            </td>
            <td className="px-5 py-4">{u.platformRole ? <StatusPill>{u.platformRole}</StatusPill> : <span className="text-[#9aa3af]">-</span>}</td>
            <td className="px-5 py-4">
              {u.schools.length > 0 ? (
                u.schools.map((s, i) => (
                  <span key={i} className="mr-2 inline-block whitespace-nowrap">{s.name} <span className="text-[#9aa3af]">({s.plan})</span></span>
                ))
              ) : (
                <span className="text-[#9aa3af]">Sin colegio</span>
              )}
            </td>
            <td className="px-5 py-4 whitespace-nowrap">{u.lastSignIn ? new Date(u.lastSignIn).toLocaleString("es-CL") : "-"}</td>
            <td className="px-5 py-4 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString("es-CL")}</td>
          </tr>
        )}
      />

      {!q ? (
        <div className="mt-4 flex items-center justify-between">
          <Link href={`/admin/users?page=${Math.max(1, currentPage - 1)}`} className={currentPage <= 1 ? linkClsDisabled : linkCls}>Anterior</Link>
          <span className="text-sm text-[#6b7280]">Pagina {currentPage}{totalUsers !== null ? ` de ${Math.max(1, Math.ceil(totalUsers / PAGE_SIZE))} · ${totalUsers} usuarios` : ""}</span>
          <Link href={`/admin/users?page=${currentPage + 1}`} className={!hasNextPage ? linkClsDisabled : linkCls}>Siguiente</Link>
        </div>
      ) : null}
    </AdminShell>
  );
}
