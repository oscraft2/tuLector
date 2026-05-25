import Link from "next/link";

const DEMO_QUIZZES = [
  { id: "1", title: "Examen de Matematicas", questions: 20, papers: 15, date: "2026-05-20" },
  { id: "2", title: "Prueba de Historia", questions: 15, papers: 22, date: "2026-05-18" },
  { id: "3", title: "Quiz de Ciencias", questions: 10, papers: 30, date: "2026-05-15" },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">&larr; Inicio</Link>
        <h1 className="text-lg font-bold">Mis Examenes</h1>
        <Link href="/scan" className="px-3 py-1.5 bg-green-600 rounded-lg text-sm font-semibold hover:bg-green-500">
          Nuevo
        </Link>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-4">
        {DEMO_QUIZZES.map((q) => (
          <Link
            key={q.id}
            href={`/results?id=${q.id}`}
            className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{q.title}</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {q.questions} preguntas &middot; {q.papers} hojas escaneadas
                </p>
              </div>
              <span className="text-xs text-zinc-500">{q.date}</span>
            </div>
          </Link>
        ))}

        {DEMO_QUIZZES.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <p className="text-lg mb-2">No hay examenes aun</p>
            <Link href="/scan" className="text-green-500 hover:underline">Escanear mi primer examen</Link>
          </div>
        )}
      </main>
    </div>
  );
}
