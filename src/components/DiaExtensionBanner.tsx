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

    <section aria-label="Extension DIA Bot para Chile" className="mx-auto max-w-7xl px-5 py-8 md:px-8 mt-4 md:mt-8">
      <div className="relative overflow-hidden rounded-2xl border border-[#dfe5e2] bg-white shadow-sm flex flex-col lg:flex-row items-center justify-between p-6 md:p-10 gap-8">
        
        {/* Left Side: Texto y Botones */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="flex items-center gap-1.5 bg-[#f0f7f4] border border-[#2f6f5e]/30 text-[#2f6f5e] px-3 py-1 rounded-md text-xs font-black uppercase tracking-widest shadow-sm">
              <span className="relative flex h-2 w-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2f6f5e] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2f6f5e]"></span>
              </span>
              BETA
            </div>
            <div className="flex items-center gap-1.5 bg-[#f6f7f9] text-[#4b5563] border border-[#e6e8eb] px-3 py-1 rounded-md text-xs font-bold uppercase tracking-widest">
              🇨🇱 Exclusivo Chile
            </div>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#111827] mb-3">
            Sube tu Prueba DIA Integral sin digitar a mano
          </h2>
          
          <p className="text-[#4b5563] mb-6 text-base md:text-lg leading-relaxed max-w-3xl">
            Nuestra extensión gratuita lee las alternativas de TuLector y las ingresa automáticamente en la plataforma del <strong>Diagnóstico Integral de Aprendizajes</strong> (<a href="https://diagnosticointegral.agenciaeducacion.cl/" target="_blank" rel="noopener noreferrer" className="text-[#123b5d] font-semibold hover:underline">diagnosticointegral.agenciaeducacion.cl</a>).
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/${locale}/precios`}
              className="inline-flex items-center gap-3 rounded-xl bg-[#111827] px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#07305f] hover:shadow-md active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                 <path d="M12.012 0C5.388 0 .012 5.376.012 12s5.376 12 12 12 12-5.376 12-12-5.376-12-12-12zm-3.666 4.708l2.96 5.127a5.578 5.578 0 011.026-.098h9.432A9.593 9.593 0 0012.012 2.396a9.636 9.636 0 00-3.666.864zM2.41 12c0-1.874.542-3.626 1.488-5.111l4.717 8.169a5.556 5.556 0 01-1.028 1.78l-4.716-8.169A9.57 9.57 0 002.41 12zm9.602 9.604a9.585 9.585 0 01-8.114-4.502l2.946-5.105a5.568 5.568 0 014.542-2.316v10.252a5.578 5.578 0 01-1.026.098c-.12 0-.238-.01-.357-.014z" />
              </svg>
              Extensión para Chrome
            </Link>
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">
              Solo en Plan Pro y School
            </span>
          </div>
        </div>

        {/* Right Side: Logos Visuales */}
        <div className="flex flex-col items-center gap-5 lg:border-l border-[#dfe5e2] lg:pl-10 pt-6 lg:pt-0 w-full lg:w-auto">
          <div className="flex items-center justify-center gap-6 bg-[#f8faf9] px-6 py-4 rounded-xl border border-[#dfe5e2]">
            <div className="flex flex-col items-center gap-2">
              <Image
                src="/dia-bot-icon.png"
                alt="Logo DIA Bot"
                width={56}
                height={56}
                className="rounded-lg shadow-sm w-14 h-14"
              />
              <span className="text-[10px] font-bold text-[#111827]">DIA Bot</span>
            </div>
            
            <div className="text-[#a0aab8] font-light text-3xl">➔</div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="h-14 w-24 bg-white rounded-lg flex items-center justify-center border border-[#dfe5e2] p-2 shadow-sm">
                <Image
                  src="/agencia-calidad-educacion.png"
                  alt="Agencia de Calidad de la Educación"
                  width={90}
                  height={50}
                  className="object-contain w-full h-full"
                />
              </div>
              <span className="text-[10px] font-bold text-[#111827]">Agencia Calidad</span>
            </div>
          </div>
          
          <p className="text-[10px] text-center text-[#6b7280] max-w-[280px] leading-relaxed">
            Herramienta independiente, no patrocinada por la Agencia de Calidad de la Educación ni el Ministerio.
          </p>
        </div>

      </div>
    </section>
  );
}
