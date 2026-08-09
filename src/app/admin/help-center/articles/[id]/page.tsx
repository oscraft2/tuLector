import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { upsertFaqArticle } from "../../actions";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ArticleEditorPage({ params }: { params: { id: string } }) {
  const isNew = params.id === "new";
  const { admin } = await requirePlatformContext(["platform_admin", "support"]);

  const { data: categories } = await admin.from("faq_categories").select("id, name, locale").order("sort_order");
  
  let article: any = null;
  if (!isNew) {
    const { data } = await admin.from("faq_articles").select("*").eq("id", params.id).single();
    if (!data) notFound();
    article = data;
  }

  return (
    <AdminShell active="/admin/help-center" title={isNew ? "Nuevo Artículo" : "Editar Artículo"}>
      <div className="max-w-4xl bg-white p-6 rounded-md shadow-sm border border-[#e5e7eb]">
        <form action={upsertFaqArticle} className="space-y-4 flex flex-col">
          {article && <input type="hidden" name="id" value={article.id} />}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Título</label>
              <input type="text" name="title" defaultValue={article?.title || ""} required className="w-full border rounded p-2" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Slug (URL)</label>
              <input type="text" name="slug" defaultValue={article?.slug || ""} required className="w-full border rounded p-2" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Categoría</label>
              <select name="category_id" defaultValue={article?.category_id || ""} required className="w-full border rounded p-2">
                <option value="" disabled>Selecciona una categoría...</option>
                {categories?.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.locale})</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Idioma (Locale)</label>
              <select name="locale" defaultValue={article?.locale || "es-CL"} className="w-full border rounded p-2">
                <option value="es-CL">es-CL</option>
                <option value="es-MX">es-MX</option>
                <option value="es-PE">es-PE</option>
                <option value="es-AR">es-AR</option>
                <option value="pt-BR">pt-BR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Contenido (Markdown)</label>
            <textarea name="body_md" defaultValue={article?.body_md || ""} required rows={15} className="w-full border rounded p-2 font-mono text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tags (separados por coma)</label>
            <input type="text" name="tags" defaultValue={article?.tags?.join(", ") || ""} className="w-full border rounded p-2" />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="published" name="published" defaultChecked={article?.published ?? true} />
            <label htmlFor="published" className="text-sm font-medium">Publicado</label>
          </div>

          <div className="pt-4 flex gap-3">
            <Link href="/admin/help-center" className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
              Cancelar
            </Link>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
              Guardar Artículo
            </button>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
