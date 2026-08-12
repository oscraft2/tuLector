import { createSupabaseServerClient } from "@/lib/supabase_server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { FaqVoteForm } from "./FaqVoteForm";
import { MarkdownContent } from "@/components/MarkdownContent";

export const dynamic = "force-dynamic";

export default async function HelpCenterArticlePage({ params }: { params: { locale: string, categoria: string, articulo: string } }) {
  const { locale, articulo } = params;

  if (!["es-CL", "es-MX", "es-PE", "es-AR", "pt-BR"].includes(locale)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  const { data: article } = await supabase
    .from("faq_articles")
    .select("id, title, body_md, helpful_yes, helpful_no, category_id, updated_at")
    .eq("locale", locale)
    .eq("slug", articulo)
    .eq("published", true)
    .eq("status", "published")
    .single();

  if (!article) {
    notFound();
  }

  // Registrar vista vía RPC
  await supabase.rpc("faq_view", { p_article_id: article.id });

  const { data: category } = await supabase
    .from("faq_categories")
    .select("name, slug")
    .eq("id", article.category_id)
    .single();
  if (!category || category.slug !== params.categoria) notFound();

  return (
    <>
      <PublicHeader currentLocale={locale} />
      <main className="min-h-screen bg-[#fafafa]">
        {/* Breadcrumbs & Header */}
        <div className="bg-[#0a0a0a] text-white pt-24 pb-12 px-6">
          <div className="max-w-4xl mx-auto">
            <nav className="text-sm font-medium text-gray-300 mb-6 flex items-center gap-2">
              <Link href={`/${locale}/ayuda`} className="hover:text-white transition-colors">Centro de Ayuda</Link>
              <span>/</span>
              {category && <Link href={`/${locale}/ayuda?c=${article.category_id}`} className="hover:text-white transition-colors">{category.name}</Link>}
              <span>/</span>
              <span className="text-gray-500">{article.title}</span>
            </nav>
            <h1 className="text-3xl md:text-5xl font-bold">{article.title}</h1>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 py-12">
           <article className="prose prose-lg max-w-none prose-headings:text-[#111827] prose-a:text-[#2563eb] prose-img:rounded-lg">
             <MarkdownContent value={article.body_md} />
          </article>

          <hr className="my-12 border-[#e5e7eb]" />

          {/* ¿Te fue útil? (Vote) */}
          <div className="text-center">
            <p className="text-lg font-semibold text-[#111827] mb-6">¿Te fue útil este artículo?</p>
            <FaqVoteForm articleId={article.id} locale={locale} />
          </div>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
