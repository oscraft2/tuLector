import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DataTable } from "@/components/dashboard/DataTable";
import { isMissingTableError } from "@/lib/supabase_errors";
import { toggleFaqPublished, deleteFaqArticle } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HelpCenterAdminPage() {
  const { admin } = await requirePlatformContext(["platform_admin", "support"]);

  const [{ data: categories, error: catError }, { data: articles, error: artError }] = await Promise.all([
    admin.from("faq_categories").select("*").order("sort_order"),
    admin.from("faq_articles").select("*").order("created_at", { ascending: false })
  ]);

  const missingTables = isMissingTableError(catError, "faq_categories") || isMissingTableError(artError, "faq_articles");

  return (
    <AdminShell active="/admin/help-center" title="Centro de Ayuda" description="Gestión de categorías y artículos del portal de soporte.">
      <div className="space-y-8">
        {missingTables && (
          <section className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Falta aplicar la migración <code className="font-mono">supabase/migrations/20260809000000_help_center.sql</code> en
            Supabase producción para poder usar el Centro de Ayuda.
          </section>
        )}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Artículos</h2>
            <Link href="/admin/help-center/articles/new" className="rounded bg-[#0a0a0a] px-3 py-1.5 text-xs font-semibold text-white">
              + Nuevo Artículo
            </Link>
          </div>
          <DataTable
            columns={["Título / Slug", "Categoría", "Idioma", "Estadísticas", "Estado", "Acciones"]}
            rows={articles ?? []}
            empty="No hay artículos."
            renderRow={(a) => {
              const cat = categories?.find(c => c.id === a.category_id);
              return (
                <tr key={a.id} className="border-b border-[#eef0f3] last:border-0 align-top text-sm">
                  <td className="px-5 py-4">
                    <p className="font-semibold">{a.title}</p>
                    <p className="mt-1 text-xs text-[#6b7280]">/{a.slug}</p>
                  </td>
                  <td className="px-5 py-4 text-[#4b5563]">{cat?.name || "???"}</td>
                  <td className="px-5 py-4 text-[#4b5563]">{a.locale}</td>
                  <td className="px-5 py-4 text-xs text-[#6b7280]">
                    Vistas: {a.view_count}<br/>
                    Útil: {a.helpful_yes} 👍 / {a.helpful_no} 👎
                  </td>
                  <td className="px-5 py-4">
                    <form action={toggleFaqPublished} className="inline-block">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="table" value="faq_articles" />
                      <input type="hidden" name="published" value={a.published ? "false" : "true"} />
                      <button className={`rounded px-2 py-1 text-xs font-semibold ${a.published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {a.published ? "Publicado" : "Borrador"}
                      </button>
                    </form>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <Link href={`/admin/help-center/articles/${a.id}`} className="text-[#2563eb] hover:underline text-xs">Editar</Link>
                      <form action={deleteFaqArticle}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="text-red-600 hover:underline text-xs" onClick={(e) => !confirm('¿Eliminar artículo?') && e.preventDefault()}>Eliminar</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            }}
          />
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Categorías</h2>
            <Link href="/admin/help-center/categories/new" className="rounded bg-[#0a0a0a] px-3 py-1.5 text-xs font-semibold text-white">
              + Nueva Categoría
            </Link>
          </div>
          <DataTable
            columns={["Nombre / Slug", "Idioma", "Orden", "Estado", "Acciones"]}
            rows={categories ?? []}
            empty="No hay categorías."
            renderRow={(c) => (
              <tr key={c.id} className="border-b border-[#eef0f3] last:border-0 align-top text-sm">
                <td className="px-5 py-4">
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-1 text-xs text-[#6b7280]">/{c.slug}</p>
                </td>
                <td className="px-5 py-4 text-[#4b5563]">{c.locale}</td>
                <td className="px-5 py-4 text-[#4b5563]">{c.sort_order}</td>
                <td className="px-5 py-4">
                  <form action={toggleFaqPublished} className="inline-block">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="table" value="faq_categories" />
                    <input type="hidden" name="published" value={c.published ? "false" : "true"} />
                    <button className={`rounded px-2 py-1 text-xs font-semibold ${c.published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {c.published ? "Publicada" : "Borrador"}
                    </button>
                  </form>
                </td>
                <td className="px-5 py-4">
                  <Link href={`/admin/help-center/categories/${c.id}`} className="text-[#2563eb] hover:underline text-xs">Editar</Link>
                </td>
              </tr>
            )}
          />
        </section>
      </div>
    </AdminShell>
  );
}
