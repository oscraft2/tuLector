import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";

const sections = [
  {
    title: "Uso del servicio",
    body: "TuLector entrega herramientas para crear ensayos, generar hojas de respuesta, leer resultados, administrar alumnos y analizar informacion educativa. El usuario es responsable de configurar correctamente claves, escalas, cursos y permisos.",
  },
  {
    title: "Cuentas e instituciones",
    body: "Cada cuenta puede pertenecer a una institucion, colegio, preuniversitario o uso profesional independiente. Los roles y accesos deben asignarse solo a personas autorizadas para trabajar con datos academicos.",
  },
  {
    title: "Datos escolares",
    body: "Los resultados, imagenes de hojas, identificadores de alumnos y reportes deben tratarse como informacion sensible. TuLector debe operar con autenticacion, control de permisos y almacenamiento privado.",
  },
  {
    title: "Independencia institucional",
    body: "TuLector es una plataforma independiente. No declara afiliacion, patrocinio ni certificacion de organismos publicos o evaluadores externos, salvo que exista autorizacion expresa y documentada.",
  },
  {
    title: "Cambios futuros",
    body: "Estos terminos son una base preliminar de producto y deberan ser revisados juridicamente antes de uso comercial definitivo, especialmente por el tratamiento de datos de estudiantes y menores de edad.",
  },
];

export default function TermsPage() {
  return <LegalPage eyebrow="Terminos" title="Terminos y condiciones" intro="Condiciones base para usar TuLector como plataforma de correccion, lectura OMR, analisis y reportes educativos." sections={sections} />;
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
