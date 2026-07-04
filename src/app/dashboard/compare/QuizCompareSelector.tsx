"use client";

import { useRouter } from "next/navigation";

type QuizInfo = { id: string; title: string; evaluation_type: string | null };

export function QuizCompareSelector({
  quizzes,
  q1,
  q2,
}: {
  quizzes: QuizInfo[];
  q1: string | null;
  q2: string | null;
}) {
  const router = useRouter();

  const go = (id1: string | null, id2: string | null) => {
    const params = new URLSearchParams();
    if (id1) params.set("q1", id1);
    if (id2) params.set("q2", id2);
    router.replace(`/dashboard/compare?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-[#e1e5ea] bg-white p-4">
      <label className="text-xs font-semibold text-[#5b6472]">
        Ensayo A
        <select
          value={q1 ?? ""}
          onChange={(e) => go(e.target.value || null, q2)}
          className="mt-1 block w-full min-w-[200px] rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-xs font-normal"
        >
          <option value="">Selecciona ensayo</option>
          {quizzes.map((q) => (
            <option key={q.id} value={q.id} disabled={q.id === q2}>
              {q.title} {q.evaluation_type === "paes" ? "(PAES)" : q.evaluation_type === "simce" ? "(SIMCE)" : ""}
            </option>
          ))}
        </select>
      </label>
      <span className="pb-1 text-sm font-bold text-[#5b6472]">vs</span>
      <label className="text-xs font-semibold text-[#5b6472]">
        Ensayo B
        <select
          value={q2 ?? ""}
          onChange={(e) => go(q1, e.target.value || null)}
          className="mt-1 block w-full min-w-[200px] rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-xs font-normal"
        >
          <option value="">Selecciona ensayo</option>
          {quizzes.map((q) => (
            <option key={q.id} value={q.id} disabled={q.id === q1}>
              {q.title} {q.evaluation_type === "paes" ? "(PAES)" : q.evaluation_type === "simce" ? "(SIMCE)" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
