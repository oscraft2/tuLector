"use client";

import { useState, useRef, FormEvent } from "react";
import Link from "next/link";

type ResultItem = {
  token: string;
  display_name: string;
  score: number;
  total: number;
  grade: number | null;
  equivalent_score: number | null;
  quiz_title: string;
  quiz_subject: string | null;
  evaluation_type: string;
  scanned_at: string | null;
  num_questions: number;
};

export default function ConsultaPage() {
  const [rut, setRut] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatRut = (value: string) => {
    const raw = value.replace(/[^0-9kK]/g, "");
    if (raw.length <= 1) return raw;
    const body = raw.slice(0, -1);
    const dv = raw.slice(-1);
    const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formatted}-${dv}`;
  };

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRut(formatRut(e.target.value));
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    const cleanRut = rut.replace(/\./g, "").trim();
    if (!cleanRut) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch(`/api/consulta?rut=${encodeURIComponent(cleanRut)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al buscar");
      setResults(data.results ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#111827] font-sans">
      <header className="border-b border-[#e6eaf0] bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#07305f]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[#07305f]">TuLector</p>
            <p className="text-[11px] leading-tight text-[#6b7280]">Portal de resultados</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8 sm:py-12 sm:px-6">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Consulta tus resultados</h1>
          <p className="mt-2 text-sm text-[#5b6472]">
            Ingresa el RUT del estudiante para ver los resultados que tu colegio ha publicado.
          </p>
        </div>

        <form onSubmit={search} className="mb-8 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={rut}
            onChange={handleRutChange}
            placeholder="12.345.678-9"
            maxLength={12}
            className="flex-1 rounded-lg border border-[#cfd6df] bg-white px-4 py-3 text-base text-[#111827] placeholder:text-[#9ca3af] focus:border-[#07305f] focus:outline-none focus:ring-2 focus:ring-[#07305f]/20"
          />
          <button
            type="submit"
            disabled={loading || rut.length < 3}
            className="rounded-lg bg-[#07305f] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0a3d73] disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              "Buscar"
            )}
          </button>
        </form>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {searched && !loading && !error && (
          <>
            {results.length === 0 ? (
              <div className="rounded-xl border border-[#e6e8eb] bg-white p-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f3f4f6] text-xl">
                  &#128269;
                </div>
                <p className="text-sm font-semibold text-[#111827]">Sin resultados</p>
                <p className="mt-1 text-sm text-[#6b7280]">
                  No encontramos resultados publicados para este RUT. Consulta con tu colegio si ya estan disponibles.
                </p>
              </div>
            ) : (
              <div>
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
                  {results.length} resultado{results.length !== 1 ? "s" : ""} encontrado{results.length !== 1 ? "s" : ""}
                  {results.length > 0 && results[0].display_name ? ` para ${results[0].display_name}` : ""}
                </p>
                <div className="space-y-3">
                  {results.map((item) => (
                    <Link
                      key={item.token}
                      href={`/r/${item.token}`}
                      className="group block rounded-xl border border-[#e6e8eb] bg-white p-5 transition-shadow hover:shadow-md hover:border-[#07305f]/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-[#111827] group-hover:text-[#07305f]">
                            {item.quiz_title}
                          </h3>
                          <p className="mt-0.5 text-xs text-[#6b7280]">
                            {item.quiz_subject ?? "Evaluacion"}
                            {item.scanned_at ? ` · ${new Date(item.scanned_at).toLocaleDateString("es-CL")}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-bold text-[#111827]">
                            {item.total > 0 ? Math.round((item.score / item.total) * 100) : 0}%
                          </p>
                          <p className="text-[11px] text-[#6b7280]">
                            {item.score}/{item.total}
                            {item.grade !== null && item.grade !== undefined
                              ? ` · Nota ${item.grade % 1 === 0 ? item.grade.toFixed(1) : item.grade}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[#07305f]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        Ver resultado completo
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!searched && (
          <div className="rounded-xl border border-[#e6e8eb] bg-white p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eef4ff] text-xl">
              &#128218;
            </div>
            <p className="text-sm text-[#5b6472]">
              Los resultados de tus ensayos y evaluaciones apareceran aqui una vez que tu colegio los publique.
            </p>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-[#e6eaf0] bg-white py-5">
        <div className="mx-auto max-w-lg px-4 text-center sm:px-6">
          <p className="text-[11px] text-[#9ca3af]">
            TuLector · Resultados seguros para familias y alumnos
          </p>
          <p className="mt-2 text-xs text-[#6b7280]">
            ¿Prefieres no buscar cada vez? <Link href="/portal/auth" className="font-semibold text-[#07305f] hover:underline">Crea tu acceso de apoderado</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
