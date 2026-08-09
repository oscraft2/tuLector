import { createSupabaseServerClient } from "@/lib/supabase_server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";

export const dynamic = "force-dynamic";

export default async function HelpCenterPage({ params, searchParams }: { params: { locale: string }, searchParams: { q?: string } }) {
  const { locale } = params;
  const q = searchParams.q ?? "";
  
  if (!["es-CL", "es-MX", "es-PE", "es-AR", "pt-BR"].includes(locale)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  // Buscar categorías publicadas para este locale
  const { data: categories } = await supabase
    .from("faq_categories")
    .select("id, slug, name")
    .eq("locale", locale)
    .eq("published", true)
    .order("sort_order");

  let searchResults = null;
  if (q) {
    const { data: articles } = await supabase
      .from("faq_articles")
      .select("id, title, slug, category_id, body_md")
      .eq("locale", locale)
      .eq("published", true)
      .textSearch("search", q, { type: "websearch" })
      .limit(10);
    searchResults = articles;
  } else {
    // Si no hay búsqueda, traer los 5 artículos más vistos globales del locale
    const { data: topArticles } = await supabase
      .from("faq_articles")
      .select("id, title, slug, category_id, body_md")
      .eq("locale", locale)
      .eq("published", true)
      .order("view_count", { ascending: false })
      .limit(5);
    searchResults = topArticles;
  }

  return (
    <>
      <PublicHeader currentLocale={locale} />
      <main className="min-h-screen bg-[#fafafa]">
        {/* Hero & Search */}
        <div className="bg-[#0a0a0a] text-white py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">¿Cómo podemos ayudarte?</h1>
            <form className="relative" method="GET" action={`/${locale}/ayuda`}>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Busca artículos, guías y soluciones..."
                className="w-full rounded-lg px-6 py-4 text-lg text-black outline-none shadow-lg focus:ring-4 focus:ring-blue-500/30"
              />
              <button type="submit" className="absolute right-3 top-3 bottom-3 rounded bg-blue-600 px-6 font-semibold hover:bg-blue-700 transition-colors">
                Buscar
              </button>
            </form>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Sidebar Categories */}
          <aside className="md:col-span-1">
            <h2 className="text-xl font-bold mb-4 border-b border-[#e5e7eb] pb-2 text-[#111827]">Categorías</h2>
            <ul className="space-y-2">
              {categories?.map(cat => (
                <li key={cat.id}>
                  <Link href={`/${locale}/ayuda?c=${cat.id}`} className="text-[#4b5563] hover:text-[#2563eb] font-medium transition-colors">
                    {cat.name}
                  </Link>
                </li>
              ))}
              {categories?.length === 0 && (
                <p className="text-sm text-[#6b7280]">No hay categorías disponibles.</p>
              )}
            </ul>
          </aside>

          {/* Results */}
          <div className="md:col-span-3">
            <h2 className="text-2xl font-bold mb-6 text-[#111827]">
              {q ? `Resultados de búsqueda para "${q}"` : "Artículos Destacados"}
            </h2>
            <div className="space-y-6">
              {searchResults?.map(art => {
                const cat = categories?.find(c => c.id === art.category_id);
                const catSlug = cat ? cat.slug : "general";
                return (
                  <Link key={art.id} href={`/${locale}/ayuda/${catSlug}/${art.slug}`} className="block p-6 bg-white rounded-lg shadow-sm border border-[#e5e7eb] hover:shadow-md hover:border-blue-300 transition-all">
                    <h3 className="text-xl font-semibold text-[#111827] mb-2">{art.title}</h3>
                    {art.body_md && (
                      <p className="text-[#6b7280] line-clamp-2">
                        {art.body_md.replace(/#|\*|_/g, "") /* Simple markdown strip for preview */}
                      </p>
                    )}
                  </Link>
                );
              })}
              {searchResults?.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg border border-[#e5e7eb]">
                  <p className="text-lg text-[#4b5563] mb-4">No encontramos resultados para tu búsqueda.</p>
                  <p className="text-[#6b7280]">Intenta con otros términos o crea un ticket de soporte.</p>
                  <Link href={`/${locale}/support`} className="mt-6 inline-block bg-[#0a0a0a] text-white px-6 py-2 rounded font-semibold">
                    Contactar Soporte
                  </Link>
                </div>
              )}
            </div>
            
            {!q && (
              <div className="mt-12 text-center">
                <p className="text-[#4b5563] mb-4">¿No encuentras lo que buscas?</p>
                <Link href={`/${locale}/support`} className="inline-block border-2 border-[#0a0a0a] text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white px-8 py-3 rounded-md font-semibold transition-colors">
                  Enviar Ticket de Soporte
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
