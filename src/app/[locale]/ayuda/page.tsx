import { createSupabaseServerClient } from "@/lib/supabase_server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { locales, type Locale, defaultLocale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function HelpCenterPage({ params, searchParams }: { params: { locale: string }, searchParams: { q?: string, c?: string } }) {
  const { locale } = params;
  const q = searchParams.q ?? "";
  
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;

  const supabase = await createSupabaseServerClient();

  // Buscar categorías publicadas para este locale
  const { data: categories } = await supabase
    .from("faq_categories")
    .select("id, slug, name")
    .eq("locale", validLocale)
    .eq("published", true)
    .order("sort_order");

  let searchResults = null;
  if (q) {
    const { data: articles } = await supabase
      .from("faq_articles")
      .select("id, title, slug, category_id, body_md")
      .eq("locale", validLocale)
      .eq("published", true)
      .textSearch("search", q, { type: "websearch" })
      .limit(10);
    searchResults = articles;
  } else {
    const { data: topArticles } = await supabase
      .from("faq_articles")
      .select("id, title, slug, category_id, body_md")
      .eq("locale", validLocale)
      .eq("published", true)
      .order("view_count", { ascending: false })
      .limit(6);
    searchResults = topArticles;
  }

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-blue-200">
      <PublicHeader currentLocale={validLocale} />
      
      {/* Hero Section */}
      <section className="bg-[#0a0a0a] py-20 px-6 text-white border-b border-[#e5e7eb]">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-6 text-4xl md:text-5xl font-bold tracking-tight">
            ¿Cómo podemos ayudarte?
          </h1>
          <p className="mb-10 text-lg text-gray-300 max-w-2xl mx-auto">
            Explora nuestros artículos, guías paso a paso o contacta con nuestro equipo para sacarle el máximo provecho a TuLector.
          </p>
          
          <form className="relative mx-auto max-w-3xl" method="GET" action={`/${validLocale}/ayuda`}>
            <div className="relative flex items-center bg-white rounded-lg overflow-hidden border border-[#d1d5db]">
              <svg className="h-6 w-6 text-gray-400 ml-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Ej: ¿Cómo escaneo las hojas?"
                className="w-full bg-white px-4 py-4 text-lg text-[#111827] placeholder-gray-500 outline-none"
              />
              <button type="submit" className="shrink-0 bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-8 py-4 font-bold transition-colors border-l border-[#d1d5db]">
                Buscar
              </button>
            </div>
          </form>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-4">
          
          {/* Navigation Sidebar */}
          <aside className="sticky top-24 hidden lg:block rounded-lg bg-white p-6 shadow-sm border border-[#e5e7eb]">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[#4b5563]">Categorías</h2>
            <nav className="flex flex-col space-y-1">
              <Link href={`/${validLocale}/ayuda`} className={`px-4 py-2.5 rounded text-sm font-medium transition-colors ${!searchParams.c && !q ? 'bg-[#f3f4f6] text-[#111827] font-semibold' : 'text-[#4b5563] hover:bg-[#f9fafb] hover:text-[#111827]'}`}>
                Todos los artículos
              </Link>
              {categories?.map(cat => (
                <Link key={cat.id} href={`/${validLocale}/ayuda?c=${cat.id}`} className={`px-4 py-2.5 rounded text-sm font-medium transition-colors ${searchParams.c === cat.id ? 'bg-[#f3f4f6] text-[#111827] font-semibold' : 'text-[#4b5563] hover:bg-[#f9fafb] hover:text-[#111827]'}`}>
                  {cat.name}
                </Link>
              ))}
              {categories?.length === 0 && (
                <p className="px-4 py-3 text-sm text-[#9ca3af]">Sin categorías creadas.</p>
              )}
            </nav>
          </aside>

          {/* Mobile Categories (Dropdown) */}
          <div className="lg:hidden mb-8">
             <h2 className="mb-3 text-sm font-bold text-[#111827]">Explorar por categoría</h2>
             <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 snap-x">
               <Link href={`/${validLocale}/ayuda`} className="snap-start shrink-0 rounded border border-[#e5e7eb] bg-white px-5 py-2 text-sm font-semibold text-[#111827] shadow-sm">
                 Todos
               </Link>
               {categories?.map(cat => (
                 <Link key={cat.id} href={`/${validLocale}/ayuda?c=${cat.id}`} className="snap-start shrink-0 rounded border border-[#e5e7eb] bg-white px-5 py-2 text-sm font-medium text-[#4b5563] shadow-sm hover:border-[#d1d5db]">
                   {cat.name}
                 </Link>
               ))}
             </div>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-3">
            <div className="mb-8 flex items-end justify-between border-b border-[#e5e7eb] pb-4">
              <h2 className="text-2xl font-bold text-[#111827]">
                {q ? `Resultados para "${q}"` : "Artículos destacados"}
              </h2>
              {searchResults?.length ? (
                <span className="text-sm font-medium text-[#6b7280]">{searchResults.length} resultados</span>
              ) : null}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {searchResults?.map(art => {
                const cat = categories?.find(c => c.id === art.category_id);
                const catSlug = cat ? cat.slug : "general";
                return (
                  <Link 
                    key={art.id} 
                    href={`/${validLocale}/ayuda/${catSlug}/${art.slug}`} 
                    className="group flex flex-col justify-between rounded-lg bg-white p-6 shadow-sm border border-[#e5e7eb] hover:border-[#93c5fd] transition-colors"
                  >
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center rounded bg-[#eff6ff] px-2.5 py-1 text-xs font-medium text-[#1d4ed8]">
                          {cat?.name || "General"}
                        </span>
                      </div>
                      <h3 className="mb-2 text-lg font-bold text-[#111827] group-hover:text-[#2563eb] transition-colors">{art.title}</h3>
                      {art.body_md && (
                        <p className="text-sm leading-relaxed text-[#4b5563] line-clamp-3">
                          {art.body_md.replace(/#|\*|_/g, "")}
                        </p>
                      )}
                    </div>
                    <div className="mt-5 flex items-center font-semibold text-[#2563eb] text-sm">
                      Leer artículo 
                      <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>

            {searchResults?.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#d1d5db] bg-white py-20 px-6 text-center">
                <div className="mb-4 rounded bg-[#f3f4f6] p-4">
                  <svg className="h-8 w-8 text-[#6b7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-bold text-[#111827]">No hay resultados</h3>
                <p className="max-w-md text-[#4b5563]">
                  No pudimos encontrar ningún artículo que coincida con tu búsqueda. Intenta con otras palabras clave o contáctanos directamente.
                </p>
                <Link href={`/${validLocale}/support`} className="mt-6 rounded bg-[#111827] px-6 py-2.5 font-semibold text-white hover:bg-[#374151] transition-colors">
                  Crear un ticket de soporte
                </Link>
              </div>
            )}
            
            {!q && searchResults && searchResults.length > 0 && (
              <div className="mt-16 flex flex-col items-center justify-center rounded-lg bg-white p-10 text-center border border-[#e5e7eb] shadow-sm">
                <h3 className="mb-2 text-2xl font-bold text-[#111827]">¿Aún necesitas ayuda?</h3>
                <p className="mb-8 max-w-lg text-[#4b5563]">
                  Nuestro equipo de expertos está listo para resolver tus dudas. Accede a soporte prioritario registrando tu consulta.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Link href={`/auth?mode=register&next=/dashboard/support/new`} className="rounded bg-[#2563eb] px-6 py-3 font-bold text-white hover:bg-[#1d4ed8] transition-colors">
                    Crear Cuenta y Consultar
                  </Link>
                  <Link href={`/${validLocale}/support`} className="rounded bg-white border border-[#d1d5db] px-6 py-3 font-bold text-[#374151] hover:bg-[#f9fafb] transition-colors">
                    Continuar como Invitado
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
