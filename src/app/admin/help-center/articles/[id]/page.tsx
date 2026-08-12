import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { upsertFaqArticle } from "../../actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleEditor } from "./ArticleEditor";

export const dynamic = "force-dynamic";

type ArticleRow = {
  id: string; title: string; slug: string; excerpt: string | null; category_id: string; locale: string;
  body_md: string; tags: string[] | null; status: string | null; seo_title: string | null;
  seo_description: string | null; featured: boolean; reading_minutes: number;
};

export default async function ArticleEditorPage({ params }: { params: { id: string } }) {
  const isNew = params.id === "new";
  const { admin } = await requirePlatformContext(["platform_admin", "support"]);

  const { data: categories } = await admin.from("faq_categories").select("id, name, locale").order("sort_order");
  
  let article: ArticleRow | null = null;
  if (!isNew) {
    const { data } = await admin.from("faq_articles").select("*").eq("id", params.id).single();
    if (!data) notFound();
    article = data as ArticleRow;
  }

  return (
    <AdminShell active="/admin/help-center" title={isNew ? "Nuevo Artículo" : "Editar Artículo"} description="Redacta el contenido de este artículo del FAQ.">
      <div className="max-w-5xl rounded-md border border-[#e5e7eb] bg-white p-6 shadow-sm">
        <ArticleEditor action={upsertFaqArticle} categories={categories ?? []} article={article} />
        <div className="pt-4"><Link href="/admin/help-center" className="text-sm font-medium text-[#4b5563] hover:text-[#07305f]">Cancelar</Link></div>
      </div>
    </AdminShell>
  );
}
