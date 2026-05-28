"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const DEMO_RESULTS = {
  title: "Examen de Matemáticas",
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
  const data = DEMO_RESULTS;
  const avg = Math.round(data.papers.reduce((s, p) => s + p.score, 0) / data.papers.length);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
        <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-white transition flex items-center gap-1">
          <ArrowLeftIcon /> Paneles
        </Link>
        <h1 className="text-sm font-bold truncate max-w-[150px]">{data.title}</h1>
        <Link href="/scan" className="text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded transition">
          RE-ESCANEAR
        </Link>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Escaneados" value={data.papers.length} />
          <StatCard label="Promedio" value={`${avg}/20`} />
          <StatCard label="Aprobados" value={data.papers.filter((p) => p.score >= 14).length} color="text-green-400" />
        </div>

        <div>
          <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Listado de Alumnos</h2>
          <div className="space-y-1.5">
            {data.papers.map((paper, i) => (
              <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3 flex justify-between items-center group hover:border-zinc-700 transition">
                <div>
                  <p className="font-semibold text-xs text-zinc-200">{paper.student}</p>
                  <p className="text-[10px] text-zinc-500 font-mono">ID: {paper.id}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${paper.score >= 14 ? "text-green-400" : "text-red-400"}`}>
                    {paper.score}/{paper.total}
                  </p>
                  <p className="text-[9px] text-zinc-600 font-bold">
                    {Math.round((paper.score / paper.total) * 100)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Análisis por Pregunta</h2>
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3">
            <div className="grid grid-cols-5 gap-y-3">
              {Array.from({ length: 20 }, (_, i) => {
                const correct = data.papers.filter((p) => {
                  const ans = p.answers.split(",")[i];
                  const key = data.answerKey.split(",")[i];
                  return ans === key;
                }).length;
                const pct = Math.round((correct / data.papers.length) * 100);
                const color = pct >= 80 ? "text-green-400" : pct >= 50 ? "text-yellow-500" : "text-red-400";
                return (
                  <div key={i} className="text-center">
                    <div className="text-[9px] text-zinc-600 font-bold mb-0.5">{i + 1}</div>
                    <div className={`text-[11px] font-mono font-bold ${color}`}>{pct}%</div>
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

function StatCard({ label, value, color = "text-white" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3 text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-tight">{label}</div>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6"/>
    </svg>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-600 text-xs font-bold animate-pulse">CARGANDO...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
