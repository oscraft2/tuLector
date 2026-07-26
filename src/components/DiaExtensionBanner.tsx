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
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      ),
    },
    {
      title: "Abre la plataforma DIA",
      body: "La extension detecta el curso y el instrumento usando tu propia sesion. Nunca te pide la clave.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18v3h3l5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z" />
        </svg>
      ),
    },
    {
      title: "Simula y guarda",
      body: "Revisa el resumen antes de escribir nada: cuantos quedan ok, sin match o con error. Tu confirmas.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <section aria-label="Extension DIA Bot para Chile" className="relative overflow-hidden bg-[#0b2440] text-white">
      {/* Decoracion de fondo */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#2f6f5e]/40 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-[#2f6f5e]/30 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 md:px-8 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-emerald-200">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
              </svg>
              Nuevo · Exclusivo Chile
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80">
              Extension gratuita de Chrome
            </span>
          </div>

          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
            Del papel a la plataforma DIA,{" "}
            <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
              sin digitar una sola respuesta
            </span>
          </h2>

          <p className="mt-4 max-w-xl text-base leading-7 text-white/70 md:text-lg md:leading-8">
            DIA Bot ingresa en la plataforma DIA de la Agencia de Calidad de la Educacion las
            alternativas que TuLector ya leyo en papel: curso completo, en minutos, usando tu
            propia sesion del navegador. Olvidate de transcribir alumno por alumno, pregunta
            por pregunta.
          </p>

          <ul className="mt-8 space-y-4">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
                  {step.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white md:text-base">
                    <span className="mr-2 text-emerald-300/80">{String(i + 1).padStart(2, "0")}</span>
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/60">{step.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={`/${locale}/precios`}
              className="rounded-lg bg-emerald-400 px-6 py-3.5 text-center text-sm font-bold text-[#0b2440] shadow-lg shadow-emerald-400/20 transition-all hover:bg-emerald-300 hover:shadow-emerald-300/30 active:scale-[0.98]"
            >
              Ver planes con sync DIA
            </Link>
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50">
              Disponible en Plan Pro y School
            </span>
          </div>
        </div>

        {/* Mock visual del resumen de la extension */}
        <div className="relative">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/40 backdrop-blur-sm">
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-2 truncate rounded-md bg-white/10 px-3 py-1 text-[11px] font-medium text-white/60">
                dia.agenciaeducacion.cl — Ingreso de respuestas
              </span>
            </div>
            <div className="p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                      <path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18v3h3l5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">DIA Bot</p>
                    <p className="text-xs text-white/50">Ingreso de respuestas desde TuLector</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-300">
                  Curso detectado
                </span>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-[#0b2440]/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50">Resumen de simulacion</p>
                <p className="mt-1 text-sm font-semibold text-white">6° Básico B · Lectura · Ensayo 2</p>
                <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div className="w-[86%] bg-emerald-400" />
                  <div className="w-[10%] bg-amber-300" />
                  <div className="w-[4%] bg-white/20" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-emerald-400/10 px-2 py-2">
                    <p className="text-lg font-bold text-emerald-300">38</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">ok</p>
                  </div>
                  <div className="rounded-lg bg-amber-300/10 px-2 py-2">
                    <p className="text-lg font-bold text-amber-300">2</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">sin match</p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-2 py-2">
                    <p className="text-lg font-bold text-white/70">0</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">errores</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-white/50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-emerald-300" aria-hidden="true">
                  <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Z" />
                </svg>
                No guarda tu clave: trabaja con la sesion que ya tienes abierta.
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
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
