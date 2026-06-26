import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";

const controls = [
  "Autenticacion con sesiones web y moviles",
  "Roles por institucion: owner, admin, profesor, asistente y lector",
  "RLS por usuario, organizacion y curso",
  "Storage privado para fotos, warps y evidencias",
  "Auditoria de escaneos, exportaciones y cambios de clave",
  "Retencion configurable para evidencias sensibles",
];

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-white text-[#111827]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <PublicHeader />
      <section className="border-b border-[#e2e6ea] bg-[#f6f7f9] px-4 py-12 md:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#123a5a]">Seguridad</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Seguridad para datos escolares</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#4b5563]">
            TuLector debe proteger resultados, identificadores de alumnos, imagenes de hojas y analitica institucional desde el diseno.
          </p>
        </div>
      </section>
      <section className="px-4 py-10 md:px-8">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
          {controls.map((control) => (
            <div key={control} className="rounded-md border border-[#e2e6ea] bg-white p-5 text-sm font-semibold text-[#111827]">
              <span className="mr-3 inline-block h-2 w-2 rounded-full bg-[#168a5b]" />
              {control}
            </div>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
