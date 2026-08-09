import Link from "next/link";
import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DataTable } from "@/components/dashboard/DataTable";
import { updateSchoolPlan } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type PageProps = { searchParams?: Promise<{ page?: string; q?: string }> };

export default async function AdminSchoolsPage({ searchParams }: PageProps) {
  const { admin } = await requirePlatformContext(["platform_admin", "support", "finance"]);
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const currentPage = Math.max(1, Number(sp.page) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("schools")
    .select("id,name,country_code,plan,status,scans_used,scans_limit,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data: schools, count } = await query;

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const linkCls = "rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50";
  const linkClsDisabled = "pointer-events-none rounded-md border border-[#e6e8eb] px-4 py-2 text-sm font-semibold text-[#c1c7cf]";

  return (
    <AdminShell active="/admin/schools" title="Colegios" description="Tenants multi-tenant: estado, plan, cuota, miembros y acciones con auditoria.">
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/schools" method="GET">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre de colegio..."
          className="w-full max-w-sm rounded-md border border-[#cfd6df] px-3 py-2 text-sm outline-none focus:border-[#07305f]"
        />
        <button className="rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white">Buscar</button>
        {q ? <Link href="/admin/schools" className={linkCls}>Limpiar</Link> : null}
      </form>

      <DataTable columns={["Colegio", "Pais", "Plan", "Cuota", "Estado", "Acciones"]} rows={schools ?? []} empty={q ? "Sin resultados para esa busqueda." : "No hay tenants."} renderRow={(school) => (
        <tr key={school.id} className="border-b border-[#eef0f3] last:border-0">
          <td className="px-5 py-4 font-semibold"><Link href={`/admin/schools/${school.id}`} className="hover:underline">{school.name}</Link></td><td className="px-5 py-4">{school.country_code}</td><td className="px-5 py-4">{school.plan}</td><td className="px-5 py-4">{school.scans_used}/{school.scans_limit}</td><td className="px-5 py-4">{school.status ?? "active"}</td>
          <td className="px-5 py-4"><form action={updateSchoolPlan} className="flex gap-2"><input type="hidden" name="school_id" value={school.id} /><input type="hidden" name="reason" value="Ajuste manual desde admin" /><select name="plan" defaultValue={school.plan} className="rounded border border-[#cfd6df] px-2 py-1 text-xs"><option value="starter">gratis</option><option value="pro">pro</option><option value="school">school</option></select><button className="rounded border border-[#cfd6df] px-2 py-1 text-xs font-semibold">Guardar</button></form></td>
        </tr>
      )} />

      <div className="mt-4 flex items-center justify-between">
        <Link href={`/admin/schools?${new URLSearchParams({ ...(q ? { q } : {}), page: String(Math.max(1, currentPage - 1)) })}`} className={currentPage <= 1 ? linkClsDisabled : linkCls}>Anterior</Link>
        <span className="text-sm text-[#6b7280]">Pagina {currentPage} de {totalPages} · {count ?? 0} colegios</span>
        <Link href={`/admin/schools?${new URLSearchParams({ ...(q ? { q } : {}), page: String(currentPage + 1) })}`} className={currentPage >= totalPages ? linkClsDisabled : linkCls}>Siguiente</Link>
      </div>
    </AdminShell>
  );
}
