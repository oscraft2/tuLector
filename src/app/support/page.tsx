import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";

const topics = [
  { title: "Implementacion", text: "Ayuda para configurar instituciones, cursos, alumnos, ensayos y hojas imprimibles." },
  { title: "Escaneo", text: "Revision de problemas de lectura, foco, iluminacion, anclas, timing y respuestas dudosas." },
  { title: "Resultados", text: "Soporte para reportes, exportaciones, escalas, notas y puntajes equivalentes." },
  { title: "Seguridad", text: "Solicitudes sobre accesos, roles, privacidad, retencion de imagenes y auditoria." },
];

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-white text-[#111827]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <PublicHeader />
      <section className="border-b border-[#e2e6ea] bg-[#f6f7f9] px-4 py-12 md:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#123a5a]">Soporte</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Acompanamiento para equipos educativos</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#4b5563]">
            Canal inicial para colegios, preuniversitarios y profesores que necesitan configurar TuLector o revisar lecturas.
          </p>
        </div>
      </section>
      <section className="px-4 py-10 md:px-8">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
          {topics.map((topic) => (
            <article key={topic.title} className="rounded-md border border-[#e2e6ea] bg-white p-6">
              <h2 className="text-xl font-semibold">{topic.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#4b5563]">{topic.text}</p>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-6 max-w-5xl rounded-md border border-[#e2e6ea] bg-[#f6f7f9] p-6">
          <p className="text-sm font-semibold text-[#111827]">Contacto comercial y soporte</p>
          <p className="mt-2 text-sm leading-6 text-[#4b5563]">
            En produccion esta seccion debe conectarse a un formulario, mesa de ayuda o correo institucional verificado.
          </p>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
