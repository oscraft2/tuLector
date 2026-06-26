import Link from "next/link";
import { completeOnboarding } from "./actions";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[#fafafa] px-5 py-10 text-[#0b1220]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-3xl font-semibold tracking-tight text-[#07305f]">TuLector</Link>
        <section className="mt-10 rounded-md border border-[#d8dde3] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Primer acceso</p>
          <h1 className="mt-2 text-3xl font-semibold">Configura tu colegio</h1>
          <p className="mt-2 text-sm leading-6 text-[#5b6472]">Verifica la institucion, pais y escala de calificacion. Chile usa escala 1.0-7.0 y exigencia 60% por defecto.</p>
          <form action={completeOnboarding} className="mt-6 grid gap-4">
            <label className="text-sm font-semibold">Nombre de institucion<input name="name" required className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal" placeholder="Preuniversitario Los Andes" /></label>
            <label className="text-sm font-semibold">Subdominio<input name="subdomain" className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal" placeholder="losandes" /></label>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-sm font-semibold">Pais<select name="country_code" defaultValue="CL" className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal"><option value="CL">Chile</option><option value="BR">Brasil</option><option value="US">Internacional</option></select></label>
              <label className="text-sm font-semibold">Region<input name="region" className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal" /></label>
              <label className="text-sm font-semibold">Ciudad<input name="city" className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal" /></label>
            </div>
            <button className="mt-2 rounded-md bg-[#07305f] px-4 py-3 text-sm font-semibold text-white">Crear cuenta institucional</button>
          </form>
        </section>
      </div>
    </main>
  );
}
