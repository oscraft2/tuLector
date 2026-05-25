import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">TuLector</h1>
          <p className="text-zinc-400">Auto-escaner de examenes. Solo apunta la camara.</p>
        </div>

        <div className="grid gap-4">
          <Link
            href="/scan"
            className="block w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl font-semibold text-lg transition active:scale-[0.98]"
          >
            Escanear examen
          </Link>

          <Link
            href="/sheet"
            className="block w-full py-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-semibold text-lg transition"
          >
            Descargar hoja de respuestas
          </Link>

          <Link
            href="/dashboard"
            className="block w-full py-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-semibold text-lg transition"
          >
            Mis examenes
          </Link>
        </div>

        <div className="pt-8 text-sm text-zinc-500 space-y-2">
          <p>Sin botones. Detecta, enfoca y califica automaticamente.</p>
          <p>Procesamiento 100% en el navegador. Tus datos no salen del dispositivo.</p>
        </div>
      </div>
    </div>
  );
}
