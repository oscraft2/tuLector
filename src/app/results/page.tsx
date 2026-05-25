"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const DEMO_RESULTS = {
  title: "Examen de Matematicas",
  answerKey: "A,C,B,E,D,A,B,C,D,E,A,C,B,E,D,A,B,C,D,E",
  papers: [
    { student: "Juan Perez", id: "10101", score: 18, total: 20, answers: "A,C,B,E,D,A,B,C,D,E,A,C,B,E,D,B,B,C,D,E" },
    { student: "Maria Lopez", id: "20202", score: 15, total: 20, answers: "A,A,B,E,D,A,B,C,D,E,A,C,B,E,D,A,B,C,D,E" },
    { student: "Carlos Ruiz", id: "30303", score: 20, total: 20, answers: "A,C,B,E,D,A,B,C,D,E,A,C,B,E,D,A,B,C,D,E" },
    { student: "Ana Garcia", id: "40404", score: 12, total: 20, answers: "A,C,C,E,D,A,C,C,D,E,A,C,B,E,D,A,C,C,D,E" },
    { student: "Pedro Diaz", id: "50505", score: 10, total: 20, answers: "E,C,B,D,A,D,B,C,D,E,C,A,B,E,D,A,B,C,D,E" },
  ],
};

function ResultsContent() {
  const params = useSearchParams();
  const data = DEMO_RESULTS;
  const avg = Math.round(data.papers.reduce((s, p) => s + p.score, 0) / data.papers.length);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">&larr; Examenes</Link>
        <h1 className="text-lg font-bold truncate">{data.title}</h1>
        <Link href="/scan" className="px-3 py-1.5 bg-green-600 rounded-lg text-sm font-semibold hover:bg-green-500">
          Escanear
        </Link>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold">{data.papers.length}</div>
            <div className="text-xs text-zinc-400">Escaneados</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold">{avg}/20</div>
            <div className="text-xs text-zinc-400">Promedio</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold">
              {data.papers.filter((p) => p.score >= 14).length}
            </div>
            <div className="text-xs text-zinc-400">Aprobados</div>
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-3">Hojas escaneadas</h2>
          <div className="space-y-2">
            {data.papers.map((paper, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-sm">{paper.student}</p>
                    <p className="text-xs text-zinc-500">ID: {paper.id}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${paper.score >= 14 ? "text-green-400" : "text-red-400"}`}>
                      {paper.score}/{paper.total}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {Math.round((paper.score / paper.total) * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-3">Analisis por pregunta</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 20 }, (_, i) => {
                const correct = data.papers.filter((p) => {
                  const ans = p.answers.split(",")[i];
                  const key = data.answerKey.split(",")[i];
                  return ans === key;
                }).length;
                const pct = Math.round((correct / data.papers.length) * 100);
                const color = pct >= 80 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : "text-red-400";
                return (
                  <div key={i} className="text-center py-1 text-xs">
                    <div className="text-zinc-500">{i + 1}</div>
                    <div className={color}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-zinc-400">Cargando...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
