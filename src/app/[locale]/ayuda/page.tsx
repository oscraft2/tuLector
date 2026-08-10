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
    <div className="min-h-screen bg-[#f8fafc] font-sans selection:bg-blue-200">
      <PublicHeader currentLocale={validLocale} />
      
      {/* Hero Section Premium */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#071625] via-[#102b42] to-[#071625] py-28 px-6 text-white">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-500/20 blur-[100px] pointer-events-none"></div>
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-teal-500/20 blur-[100px] pointer-events-none"></div>
        
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="mb-6 text-5xl font-extrabold tracking-tight md:text-6xl lg:text-7xl">
            ¿Cómo podemos <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">ayudarte?</span>
          </h1>
          <p className="mb-10 text-lg text-blue-100/80 md:text-xl font-medium max-w-2xl mx-auto">
            Explora nuestros artículos, guías paso a paso o contacta con nuestro equipo para sacarle el máximo provecho a TuLector.
          </p>
          
          <form className="relative mx-auto max-w-3xl group shadow-2xl rounded-2xl" method="GET" action={`/${validLocale}/ayuda`}>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-teal-400 rounded-2xl blur-md opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative flex items-center bg-white rounded-2xl overflow-hidden border border-white/20 p-2">
              <svg className="h-6 w-6 text-gray-400 ml-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Ej: ¿Cómo escaneo las hojas?"
                className="w-full bg-transparent px-4 py-4 text-lg text-gray-900 placeholder-gray-500 outline-none"
              />
              <button type="submit" className="shrink-0 bg-[#0f2f49] hover:bg-[#071625] text-white px-8 py-4 rounded-xl font-bold transition-all duration-300 shadow-md transform hover:scale-105 active:scale-95">
                Buscar
              </button>
            </div>
          </form>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-4">
          
          {/* Navigation Sidebar */}
          <aside className="sticky top-32 hidden lg:block rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">Categorías</h2>
            <nav className="flex flex-col space-y-1">
              <Link href={`/${validLocale}/ayuda`} className={`px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${!searchParams.c && !q ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                Todos los artículos
              </Link>
              {categories?.map(cat => (
                <Link key={cat.id} href={`/${validLocale}/ayuda?c=${cat.id}`} className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${searchParams.c === cat.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                  {cat.name}
                </Link>
              ))}
              {categories?.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-400">Sin categorías creadas.</p>
              )}
            </nav>
          </aside>

          {/* Mobile Categories (Dropdown) */}
          <div className="lg:hidden mb-8">
             <h2 className="mb-3 text-sm font-bold text-gray-900">Explorar por categoría</h2>
             <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 snap-x">
               <Link href={`/${validLocale}/ayuda`} className="snap-start shrink-0 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 shadow-sm">
                 Todos
               </Link>
               {categories?.map(cat => (
                 <Link key={cat.id} href={`/${validLocale}/ayuda?c=${cat.id}`} className="snap-start shrink-0 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 shadow-sm hover:border-gray-300">
                   {cat.name}
                 </Link>
               ))}
             </div>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-3">
            <div className="mb-8 flex items-end justify-between border-b border-gray-200 pb-4">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                {q ? `Resultados para "${q}"` : "Artículos destacados"}
              </h2>
              {searchResults?.length ? (
                <span className="text-sm font-medium text-gray-500">{searchResults.length} resultados</span>
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
                    className="group flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                          {cat?.name || "General"}
                        </span>
                      </div>
                      <h3 className="mb-3 text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{art.title}</h3>
                      {art.body_md && (
                        <p className="text-sm leading-relaxed text-gray-600 line-clamp-3">
                          {art.body_md.replace(/#|\*|_/g, "")}
                        </p>
                      )}
                    </div>
                    <div className="mt-6 flex items-center font-semibold text-blue-600 text-sm">
                      Leer artículo 
                      <svg className="ml-1 h-4 w-4 transform transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>

            {searchResults?.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-gray-50 py-24 px-6 text-center">
                <div className="mb-4 rounded-full bg-gray-200 p-4">
                  <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">No hay resultados</h3>
                <p className="max-w-md text-gray-500">
                  No pudimos encontrar ningún artículo que coincida con tu búsqueda. Intenta con otras palabras clave o contáctanos directamente.
                </p>
                <Link href={`/${validLocale}/support`} className="mt-8 rounded-xl bg-gray-900 px-6 py-3 font-semibold text-white shadow hover:bg-gray-800 transition">
                  Crear un ticket de soporte
                </Link>
              </div>
            )}
            
            {!q && searchResults && searchResults.length > 0 && (
              <div className="mt-16 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-10 text-center border border-blue-100">
                <h3 className="mb-3 text-2xl font-bold text-gray-900">¿Aún necesitas ayuda?</h3>
                <p className="mb-8 max-w-lg text-gray-600">
                  Nuestro equipo de expertos está listo para resolver tus dudas. Accede a soporte prioritario registrando tu consulta.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Link href={`/auth?mode=register&next=/dashboard/support/new`} className="rounded-xl bg-blue-600 px-8 py-3.5 font-bold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all transform hover:-translate-y-0.5">
                    Crear Cuenta y Consultar
                  </Link>
                  <Link href={`/${validLocale}/support`} className="rounded-xl bg-white border border-gray-200 px-8 py-3.5 font-bold text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all">
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
