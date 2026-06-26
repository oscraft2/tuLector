import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";

const sections = [
  {
    title: "Informacion que administra TuLector",
    body: "La plataforma puede tratar datos de cuenta, institucion, cursos, alumnos, ensayos, respuestas, puntajes, reportes, imagenes de hojas y registros tecnicos de escaneo.",
  },
  {
    title: "Finalidad",
    body: "Los datos se usan para autenticar usuarios, sincronizar la app movil, corregir ensayos, generar reportes, exportar resultados, mejorar la calidad OMR y mantener auditoria operacional.",
  },
  {
    title: "Datos de estudiantes",
    body: "Los datos de alumnos deben manejarse con minimo acceso necesario. La arquitectura de produccion debe separar datos por usuario, rol e institucion mediante politicas de seguridad estrictas.",
  },
  {
    title: "Imagenes y evidencias",
    body: "Las fotos de hojas y warps de escaneo deben almacenarse en espacios privados, con retencion limitada y acceso restringido a usuarios autorizados de la institucion.",
  },
  {
    title: "Revision pendiente",
    body: "Esta politica es una base inicial y requiere revision legal antes del lanzamiento comercial, especialmente para cumplimiento aplicable en Chile, LATAM y Brasil.",
  },
];

export default function PrivacyPage() {
  return <LegalPage eyebrow="Privacidad" title="Politica de privacidad" intro="Base de privacidad para una plataforma que trabaja con informacion escolar, resultados academicos y evidencias de escaneo." sections={sections} />;
}

function LegalPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: { title: string; body: string }[] }) {
  return (
    <main className="min-h-screen bg-white text-[#111827]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <PublicHeader />
      <section className="border-b border-[#e2e6ea] bg-[#f6f7f9] px-4 py-12 md:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#123a5a]">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#4b5563]">{intro}</p>
        </div>
      </section>
      <section className="px-4 py-10 md:px-8">
        <div className="mx-auto max-w-4xl space-y-4">
          {sections.map((section) => (
            <article key={section.title} className="rounded-md border border-[#e2e6ea] bg-white p-6">
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#4b5563]">{section.body}</p>
            </article>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
