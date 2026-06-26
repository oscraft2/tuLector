"use client";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#fafafa] p-8 text-[#0b1220]">
      <section className="mx-auto max-w-xl rounded-md border border-[#d8dde3] bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b45309]">Error</p>
        <h1 className="mt-2 text-2xl font-semibold">No se pudo cargar el panel</h1>
        <p className="mt-2 text-sm leading-6 text-[#5b6472]">{error.message}</p>
        <button onClick={reset} className="mt-5 rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white">Reintentar</button>
      </section>
    </main>
  );
}
