import Image from "next/image";
import Link from "next/link";

/**
 * Banner promocional de la extension DIA Bot (Chrome) que sube los resultados
 * escaneados por TuLector directo a la plataforma DIA de la Agencia de Calidad
 * de la Educacion. Se muestra solo en el locale es-CL (las pruebas DIA son
 * exclusivas de Chile).
 */
export function DiaExtensionBanner({ locale }: { locale: string }) {
  const steps = [
    {
      title: "Escanea con TuLector",
      body: "Lee las hojas DIA con la camara del celular y exporta el formato Pruebas DIA con un clic.",
    },
    {
      title: "Abre la plataforma DIA",
      body: "La extension detecta el curso y el instrumento usando tu propia sesion. Nunca te pide la clave.",
    },
    {
      title: "Simula y guarda",
      body: "Revisa el resumen antes de escribir nada: cuantos quedan ok, sin match o con error. Tu confirmas.",
    },
  ];

  return (
    <section aria-label="Extension DIA Bot para Chile" className="bg-[#111827] text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 md:px-8 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white/85">
              Nuevo · Exclusivo Chile
            </span>
            <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white/85">
              Extension gratuita de Chrome
            </span>
          </div>

          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
            Del papel a la plataforma DIA, sin digitar una sola respuesta
          </h2>

          <p className="mt-4 max-w-xl text-base leading-7 text-white/70 md:text-lg md:leading-8">
            DIA Bot ingresa en la plataforma DIA de la Agencia de Calidad de la Educacion las
            alternativas que TuLector ya leyo en papel: curso completo, en minutos, usando tu
            propia sesion del navegador. Olvidate de transcribir alumno por alumno, pregunta
            por pregunta.
          </p>

          <ol className="mt-8 space-y-5">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-sm font-bold text-white/85">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white md:text-base">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/60">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={`/${locale}/precios`}
              className="rounded-lg bg-white px-6 py-3.5 text-center text-sm font-semibold text-[#111827] transition-all hover:bg-[#f0f7f4] active:scale-[0.98]"
            >
              Ver planes con sync DIA
            </Link>
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50">
              Disponible en Plan Pro y School
            </span>
          </div>
        </div>

        {/* Tarjeta con el resumen que muestra la extension */}
        <div>
          <div className="rounded-xl border border-[#e6e8eb] bg-white p-5 text-[#111827] shadow-lg shadow-black/20 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/dia-bot-icon.png"
                  alt="Logo de DIA Bot"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-md"
                />
                <div>
                  <p className="text-sm font-semibold">DIA Bot</p>
                  <p className="text-xs text-[#6b7280]">Ingreso de respuestas desde TuLector</p>
                </div>
              </div>
              <span className="rounded-full border border-[#2f6f5e]/30 bg-[#f0f7f4] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#2f6f5e]">
                Curso detectado
              </span>
            </div>

            <div className="mt-4 rounded-lg border border-[#e6e8eb] bg-[#f6f7f9] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Resumen de simulacion</p>
              <p className="mt-1 text-sm font-semibold">6° Básico B · Lectura · Ensayo 2</p>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#e6e8eb]">
                <div className="w-[86%] bg-[#2f6f5e]" />
                <div className="w-[10%] bg-[#d9a62e]" />
                <div className="w-[4%] bg-[#c3cad2]" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-white px-2 py-2">
                  <p className="text-lg font-semibold text-[#2f6f5e]">38</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b7280]">ok</p>
                </div>
                <div className="rounded-md bg-white px-2 py-2">
                  <p className="text-lg font-semibold text-[#b8860b]">2</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b7280]">sin match</p>
                </div>
                <div className="rounded-md bg-white px-2 py-2">
                  <p className="text-lg font-semibold text-[#6b7280]">0</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b7280]">errores</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-[#6b7280]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-[#2f6f5e]" aria-hidden="true">
                <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              No guarda tu clave: trabaja con la sesion que ya tienes abierta.
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/10 p-4">
            <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-white p-2">
              <Image
                src="/agencia-calidad-educacion.png"
                alt="Agencia de Calidad de la Educacion"
                width={200}
                height={130}
                className="h-full w-full object-contain"
              />
            </div>
            <p className="text-xs leading-5 text-white/50">
              Herramienta independiente de TuLector. No afiliada ni patrocinada por la Agencia de
              Calidad de la Educacion.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
