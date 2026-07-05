/**
 * Esqueleto de carga para las pantallas nativas. Lo renderiza el loading.tsx de
 * cada ruta: aparece AL INSTANTE al navegar (Next lo streamea antes de que el
 * server component termine sus queries), en vez de dejar la pantalla congelada.
 */
export function NativeLoading({ title, cards = 4 }: { title: string; cards?: number }) {
  return (
    <main className="min-h-dvh bg-[#f5f6f8]">
      <header className="safe-pt flex items-center gap-3 bg-[#111827] px-5 pb-5 pt-5 text-white">
        <div className="h-9 w-9 rounded-full bg-white/10" />
        <h1 className="text-lg font-black tracking-tight">{title}</h1>
      </header>
      <section className="space-y-3 px-5 py-6">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-[#e6e8eb] bg-white" />
        ))}
      </section>
    </main>
  );
}
