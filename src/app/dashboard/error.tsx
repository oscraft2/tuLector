"use client";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-12 text-[#1c1917]">
      <section className="mx-auto max-w-xl rounded-xl border border-[#e7e5df] bg-white p-6 shadow-xs">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b45309]">Error</p>
        <h1 className="mt-2 text-2xl font-bold">No se pudo cargar el panel</h1>
        <p className="mt-2 text-sm leading-6 text-[#57534e]">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-lg bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#062447]"
        >
          Reintentar
        </button>
      </section>
    </div>
  );
}
