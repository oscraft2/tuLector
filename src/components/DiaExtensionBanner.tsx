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

    <section aria-label="Extension DIA Bot para Chile" className="mx-auto max-w-7xl px-5 py-8 md:px-8">
      <div className="border border-[#dfe5e2] bg-white rounded-lg flex flex-col md:flex-row items-center justify-between p-6 gap-6">
        
        {/* Left Side: Texto y Botones */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="bg-[#2f6f5e] text-white px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider">
              BETA
            </span>
            <span className="text-[#6b7280] text-[11px] font-bold uppercase tracking-wider">
              🇨🇱 Exclusivo Chile
            </span>
          </div>
          
          <h2 className="text-xl md:text-2xl font-bold text-[#111827] mb-2">
            Sube tu Prueba DIA Integral sin digitar a mano
          </h2>
          
          <p className="text-[#4b5563] text-sm md:text-base mb-5">
            Nuestra extensión lee las alternativas de TuLector y las ingresa automáticamente en la plataforma del <strong>Diagnóstico Integral de Aprendizajes</strong> (<a href="https://diagnosticointegral.agenciaeducacion.cl/" target="_blank" rel="noopener noreferrer" className="text-[#123b5d] font-semibold hover:underline">diagnosticointegral.agenciaeducacion.cl</a>).
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/${locale}/precios`}
              className="inline-flex items-center gap-2 border border-[#111827] bg-[#111827] px-4 py-2 text-sm font-semibold text-white rounded hover:bg-[#0a0a0a]"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                 <path d="M12.012 0C5.388 0 .012 5.376.012 12s5.376 12 12 12 12-5.376 12-12-5.376-12-12-12zm-3.666 4.708l2.96 5.127a5.578 5.578 0 011.026-.098h9.432A9.593 9.593 0 0012.012 2.396a9.636 9.636 0 00-3.666.864zM2.41 12c0-1.874.542-3.626 1.488-5.111l4.717 8.169a5.556 5.556 0 01-1.028 1.78l-4.716-8.169A9.57 9.57 0 002.41 12zm9.602 9.604a9.585 9.585 0 01-8.114-4.502l2.946-5.105a5.568 5.568 0 014.542-2.316v10.252a5.578 5.578 0 01-1.026.098c-.12 0-.238-.01-.357-.014z" />
              </svg>
              Extensión para Chrome
            </Link>
            <span className="text-xs text-[#6b7280]">
              Incluido en Plan Pro y School
            </span>
          </div>
        </div>

        {/* Right Side: Logos Visuales */}
        <div className="flex flex-col items-center border-t md:border-t-0 md:border-l border-[#dfe5e2] pt-6 md:pt-0 md:pl-6 w-full md:w-auto">
          <div className="flex items-center gap-4 bg-[#f8faf9] p-4 rounded border border-[#dfe5e2]">
            <Image
              src="/dia-bot-icon.png"
              alt="Logo DIA Bot"
              width={40}
              height={40}
              className="rounded"
            />
            <div className="text-[#a0aab8] text-xl">➔</div>
            <Image
              src="/agencia-calidad-educacion.png"
              alt="Agencia de Calidad de la Educación"
              width={80}
              height={40}
              className="object-contain"
            />
          </div>
          <p className="text-[10px] text-center text-[#6b7280] mt-3 max-w-[200px]">
            Herramienta independiente, no vinculada a la Agencia de Calidad.
          </p>
        </div>

      </div>
    </section>
  );
}
