"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { EVALUATION_TYPES } from "@/lib/evaluation_types";

type QuizOption = { id: string; title: string; evaluation_type: string | null };

const FILTER_KEYS = ["evalType", "quizId", "from", "to", "scoreMin", "scoreMax"] as const;

export function CourseResultsFilter({ quizzes }: { quizzes: QuizOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [evalType, setEvalType] = useState(searchParams.get("evalType") ?? "");
  const [quizId, setQuizId] = useState(searchParams.get("quizId") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [scoreMin, setScoreMin] = useState(searchParams.get("scoreMin") ?? "");
  const [scoreMax, setScoreMax] = useState(searchParams.get("scoreMax") ?? "");

  useEffect(() => {
    setEvalType(searchParams.get("evalType") ?? "");
    setQuizId(searchParams.get("quizId") ?? "");
    setFrom(searchParams.get("from") ?? "");
    setTo(searchParams.get("to") ?? "");
    setScoreMin(searchParams.get("scoreMin") ?? "");
    setScoreMax(searchParams.get("scoreMax") ?? "");
  }, [searchParams]);

  const apply = () => {
    const params = new URLSearchParams(searchParams.toString());
    const values: Record<string, string> = { evalType, quizId, from, to, scoreMin, scoreMax };
    for (const key of FILTER_KEYS) {
      if (values[key]) params.set(key, values[key]);
      else params.delete(key);
    }
    router.replace(`?${params.toString()}`);
  };

  const clear = () => {
    setEvalType("");
    setQuizId("");
    setFrom("");
    setTo("");
    setScoreMin("");
    setScoreMax("");
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) params.delete(key);
    router.replace(`?${params.toString()}`);
  };

  const hasFilter = FILTER_KEYS.some((key) => searchParams.get(key));
  const filteredQuizzes = evalType ? quizzes.filter((q) => (q.evaluation_type ?? "custom") === evalType) : quizzes;

  return (
    <div className="rounded-md border border-[#e1e5ea] bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-[#5b6472]">
          Tipo de evaluacion
          <select
            value={evalType}
            onChange={(e) => { setEvalType(e.target.value); setQuizId(""); }}
            className="mt-1 block rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-xs font-normal"
          >
            <option value="">Todos</option>
            {Object.entries(EVALUATION_TYPES).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-[#5b6472]">
          Ensayo
          <select
            value={quizId}
            onChange={(e) => setQuizId(e.target.value)}
            className="mt-1 block max-w-[220px] rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-xs font-normal"
          >
            <option value="">Todos</option>
            {filteredQuizzes.map((q) => (
              <option key={q.id} value={q.id}>{q.title}</option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-[#5b6472]">
          Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-xs font-normal" />
        </label>
        <label className="text-xs font-semibold text-[#5b6472]">
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-xs font-normal" />
        </label>

        <label className="text-xs font-semibold text-[#5b6472]">
          Puntaje min.
          <input type="number" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} placeholder="0" className="mt-1 block w-20 rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-xs font-normal" />
        </label>
        <label className="text-xs font-semibold text-[#5b6472]">
          Puntaje max.
          <input type="number" value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} placeholder="100" className="mt-1 block w-20 rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-xs font-normal" />
        </label>

        <button onClick={apply} className="rounded-md bg-[#07305f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#062447]">
          Aplicar
        </button>
        {hasFilter && (
          <button onClick={clear} className="rounded-md border border-[#cfd6df] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b6472] hover:bg-[#f4f6f8]">
            Limpiar
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-[#8b93a1]">
        Puntaje min./max.: interpretado en % para ensayos personalizados, o en la escala propia del tipo de evaluacion (ej. 100-1000 PAES, 100-400 SIMCE).
      </p>
    </div>
  );
}
