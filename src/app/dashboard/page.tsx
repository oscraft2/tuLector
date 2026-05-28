import Link from "next/link";

const DEMO_QUIZZES = [
  { id: "1", title: "Examen de Matemáticas", questions: 20, papers: 15, date: "20 May" },
  { id: "2", title: "Prueba de Historia", questions: 15, papers: 22, date: "18 May" },
  { id: "3", title: "Quiz de Ciencias", questions: 10, papers: 30, date: "15 May" },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
        <h1 className="text-base font-bold text-zinc-200">Mis Exámenes</h1>
        <div className="flex items-center gap-3">
          <Link href="/settings" className="p-2 text-zinc-500 hover:text-white transition">
            <SettingsIcon />
          </Link>
          <Link href="/scan" className="bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-lg text-xs font-bold transition">
            NUEVO
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-3">
        {DEMO_QUIZZES.map((q) => (
          <Link
            key={q.id}
            href={`/results?id=${q.id}`}
            className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/50 p-4 rounded-xl hover:bg-zinc-900 hover:border-zinc-700 transition group"
          >
            <div>
              <h3 className="font-semibold text-sm group-hover:text-green-400 transition">{q.title}</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {q.questions} preguntas · {q.papers} hojas
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-tighter">{q.date}</span>
            </div>
          </Link>
        ))}

        {DEMO_QUIZZES.length === 0 && (
          <div className="text-center py-20 text-zinc-600">
            <p className="text-sm mb-4">No hay exámenes registrados</p>
            <Link href="/scan" className="text-green-500 text-xs font-bold hover:underline">EMPEZAR A ESCANEAR</Link>
          </div>
        )}
      </main>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
