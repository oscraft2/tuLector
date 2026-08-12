import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { upsertFaqCategory } from "../../actions";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type CategoryRow = { id: string; name: string; slug: string; locale: string; sort_order: number; published: boolean };

export default async function CategoryEditorPage({ params }: { params: { id: string } }) {
  const isNew = params.id === "new";
  const { admin } = await requirePlatformContext(["platform_admin", "support"]);

  let category: CategoryRow | null = null;
  if (!isNew) {
    const { data } = await admin.from("faq_categories").select("*").eq("id", params.id).single();
    if (!data) notFound();
    category = data as CategoryRow;
  }

  return (
    <AdminShell active="/admin/help-center" title={isNew ? "Nueva Categoría" : "Editar Categoría"} description="Gestiona esta categoría del FAQ.">
      <div className="max-w-xl bg-white p-6 rounded-md shadow-sm border border-[#e5e7eb]">
        <form action={upsertFaqCategory} className="space-y-4">
          {category && <input type="hidden" name="id" value={category.id} />}
          
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input type="text" name="name" defaultValue={category?.name || ""} required className="w-full border rounded p-2" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Slug (URL)</label>
            <input type="text" name="slug" defaultValue={category?.slug || ""} required className="w-full border rounded p-2" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Idioma (Locale)</label>
            <select name="locale" defaultValue={category?.locale || "es-CL"} className="w-full border rounded p-2">
              <option value="es-CL">es-CL</option>
              <option value="es-MX">es-MX</option>
              <option value="es-PE">es-PE</option>
              <option value="es-AR">es-AR</option>
              <option value="pt-BR">pt-BR</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Orden (0 = primero)</label>
            <input type="number" name="sort_order" defaultValue={category?.sort_order || "0"} className="w-full border rounded p-2" />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="published" name="published" defaultChecked={category?.published ?? true} />
            <label htmlFor="published" className="text-sm font-medium">Publicado</label>
          </div>

          <div className="pt-4 flex gap-3">
            <Link href="/admin/help-center" className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
              Cancelar
            </Link>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
              Guardar Categoría
            </button>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
