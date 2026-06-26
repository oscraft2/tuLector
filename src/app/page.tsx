import Link from "next/link";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";

const productCards = [
  { title: "Ensayos y claves", text: "Crea evaluaciones, versiones, claves, preguntas anuladas y habilidades asociadas." },
  { title: "Hojas imprimibles", text: "Genera hojas OMR propias con identificacion de alumno, ensayo, curso y version." },
  { title: "Lectura movil", text: "Escanea con la app, sincroniza resultados y revisa lecturas dudosas con evidencia." },
  { title: "Reportes", text: "Analiza preguntas, distractores, cursos, alumnos, ejes y evolucion historica." },
];

const stats = [
  { label: "flujo objetivo", value: "Crear -> imprimir -> escanear -> analizar" },
  { label: "mercado inicial", value: "Chile" },
  { label: "expansion", value: "LATAM + Brasil" },
];

const seoTopics = [
  "lector de ensayos",
  "correccion de pruebas con celular",
  "puntaje equivalente",
  "analisis por distractor",
  "hojas de respuesta imprimibles",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-[#111827]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <PublicHeader />

      <section className="border-b border-[#e2e6ea] bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#123a5a]">Plataforma educacional para ensayos</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-[#111827] md:text-6xl">
              Corrige hojas de respuesta y convierte resultados en decisiones pedagogicas.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4b5563]">
              TuLector une administracion web, app movil de lectura OMR, resultados, analisis y puntajes equivalentes
              para profesores, colegios y preuniversitarios.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/auth?mode=register" className="rounded-md bg-[#123a5a] px-5 py-3 text-center text-sm font-semibold text-white hover:bg-[#0e304b]">
                Crear cuenta
              </Link>
              <Link href="/auth" className="rounded-md border border-[#d1d8df] bg-white px-5 py-3 text-center text-sm font-semibold text-[#123a5a] hover:border-[#123a5a]">
                Iniciar sesion
              </Link>
              <Link href="/account" className="rounded-md border border-[#d1d8df] bg-[#f6f7f9] px-5 py-3 text-center text-sm font-semibold text-[#4b5563] hover:text-[#123a5a]">
                Ver maqueta de cuenta
              </Link>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-md border border-[#e2e6ea] bg-[#f6f7f9] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">{stat.label}</p>
                  <p className="mt-2 text-sm font-semibold leading-5 text-[#111827]">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[#e2e6ea] bg-[#f6f7f9] p-4">
            <div className="rounded-md border border-[#e2e6ea] bg-white">
              <div className="flex items-center justify-between border-b border-[#e2e6ea] px-5 py-4">
                <div>
                  <p className="text-sm font-semibold">Ensayo Matematica M1</p>
                  <p className="mt-1 text-xs text-[#6b7280]">4 Medio A - Forma A</p>
                </div>
                <span className="rounded-full bg-[#eaf7f1] px-3 py-1 text-xs font-semibold text-[#168a5b]">Sincronizado</span>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-3">
                <Metric title="Escaneadas" value="38/42" />
                <Metric title="Promedio" value="71%" />
                <Metric title="Dudosas" value="3" />
              </div>
              <div className="border-t border-[#e2e6ea] p-5">
                <p className="text-sm font-semibold">Preguntas con mayor alerta</p>
                <div className="mt-4 space-y-3">
                  {["P12 - funcion cuadratica", "P18 - probabilidad", "P26 - geometria"].map((item, index) => (
                    <div key={item} className="flex items-center justify-between rounded-md border border-[#e2e6ea] px-3 py-3">
                      <span className="text-sm text-[#4b5563]">{item}</span>
                      <span className="text-sm font-semibold text-[#c62828]">{index === 0 ? "64%" : index === 1 ? "58%" : "51%"} error</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-[#e2e6ea] bg-[#fdfdfd] px-5 py-4">
                <p className="text-xs leading-5 text-[#6b7280]">
                  Vista conceptual: el producto final conectara ensayos, alumnos, escaneos, puntajes equivalentes y reportes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="producto" className="border-b border-[#e2e6ea] bg-[#f6f7f9] px-4 py-14 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#123a5a]">Producto</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Una web para administrar y una app para leer.</h2>
            <p className="mt-4 text-base leading-7 text-[#4b5563]">
              La cuenta del profesor vive en la web. La app movil toma lecturas, sube resultados y mantiene trazabilidad por ensayo.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {productCards.map((card) => (
              <article key={card.title} className="rounded-md border border-[#e2e6ea] bg-white p-5">
                <h3 className="text-lg font-semibold">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#4b5563]">{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="analisis" className="border-b border-[#e2e6ea] bg-white px-4 py-14 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#123a5a]">Analisis</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">No basta con corregir. Hay que explicar el resultado.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {["Por alumno", "Por curso", "Por pregunta", "Por distractor", "Por eje", "Por habilidad"].map((item) => (
              <div key={item} className="rounded-md border border-[#e2e6ea] bg-[#f6f7f9] px-4 py-3 text-sm font-semibold">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="puntajes" className="border-b border-[#e2e6ea] bg-[#f6f7f9] px-4 py-14 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#123a5a]">Puntajes</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Escalas configurables para Chile, LATAM y Brasil.</h2>
            <p className="mt-4 text-base leading-7 text-[#4b5563]">
              El motor de conversion debe soportar nota chilena, puntaje bruto, puntaje equivalente y tablas propias por institucion.
            </p>
          </div>
          <div className="rounded-md border border-[#e2e6ea] bg-white p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <Metric title="Bruto" value="54/65" />
              <Metric title="Nota" value="6.1" />
              <Metric title="Equivalente" value="742" />
            </div>
            <p className="mt-5 text-sm leading-6 text-[#6b7280]">
              Las escalas deben ser versionadas, auditables e importables. No se hardcodea una unica tabla.
            </p>
          </div>
        </div>
      </section>

      <section id="seguridad" className="bg-white px-4 py-14 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#123a5a]">Seguridad y confianza</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Datos escolares privados por diseno.</h2>
            <p className="mt-4 text-base leading-7 text-[#4b5563]">
              La arquitectura final debe usar autenticacion, roles, RLS, Storage privado, auditoria y retencion de evidencias.
            </p>
          </div>
          <div className="rounded-md border border-[#e2e6ea] bg-[#f6f7f9] p-5">
            <p className="text-sm font-semibold">SEO 2026 desde la base</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {seoTopics.map((topic) => (
                <span key={topic} className="rounded-full border border-[#d1d8df] bg-white px-3 py-1 text-xs font-semibold text-[#4b5563]">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e2e6ea] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#111827]">{value}</p>
    </div>
  );
}
