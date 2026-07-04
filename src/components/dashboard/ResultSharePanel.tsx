"use client";

import { useState, useCallback } from "react";
import { privacyLabel } from "@/lib/display_name";

type ResultLink = {
  id: string;
  token: string;
  privacy_level: string;
  created_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  student_name: string | null;
  student_id: string | null;
};

type Props = {
  quizId: string;
  baseUrl: string;
};

export function ResultSharePanel({ quizId, baseUrl }: Props) {
  const [links, setLinks] = useState<ResultLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [privacyLevel, setPrivacyLevel] = useState("full_name");
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/results/links?quizId=${quizId}`);
      const data: { error?: string; links?: ResultLink[] } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al cargar enlaces");
      setLinks(data.links ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  const togglePanel = () => {
    const next = !showPanel;
    setShowPanel(next);
    if (next && links.length === 0) fetchLinks();
  };

  const generateLinks = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/results/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, allStudents: true, privacyLevel }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al generar enlaces");
      await fetchLinks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  };

  const revokeLink = async (id: string) => {
    try {
      const res = await fetch(`/api/results/links/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al revocar");
      await fetchLinks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  };

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${baseUrl}/r/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeLinks = links.filter((l) => !l.revoked_at);
  const revokedLinks = links.filter((l) => l.revoked_at);

  return (
    <div className="rounded-md border border-[#e1e5ea] bg-white">
      <button
        onClick={togglePanel}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <h2 className="text-lg font-semibold">Compartir resultados</h2>
          <p className="mt-0.5 text-sm text-[#5b6472]">
            Genera enlaces seguros para que familias y alumnos vean sus resultados sin necesidad de cuenta.
          </p>
        </div>
        <span className={`ml-3 text-xl text-[#6b7280] transition-transform ${showPanel ? "rotate-180" : ""}`}>
          <ChevronDown />
        </span>
      </button>

      {showPanel && (
        <div className="border-t border-[#e1e5ea] px-5 py-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">Privacidad del nombre</label>
              <select
                value={privacyLevel}
                onChange={(e) => setPrivacyLevel(e.target.value)}
                className="w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#07305f] focus:outline-none focus:ring-1 focus:ring-[#07305f]"
              >
                <option value="full_name">Nombre completo</option>
                <option value="initials_only">Solo iniciales (M.J.L.)</option>
                <option value="id_only">Solo ID interno</option>
              </select>
            </div>
            <button
              onClick={generateLinks}
              disabled={generating}
              className="rounded-md bg-[#07305f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a3d73] disabled:opacity-50 sm:self-end"
            >
              {generating ? "Generando..." : "Generar enlaces para todos"}
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-[#6b7280]">Cargando enlaces...</p>
          ) : links.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#6b7280]">
              No hay enlaces generados. Haz clic en &ldquo;Generar enlaces&rdquo; para empezar.
            </p>
          ) : (
            <div className="space-y-4">
              {activeLinks.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">
                    Activos ({activeLinks.length})
                  </h3>
                  <div className="overflow-x-auto rounded-md border border-[#e6e8eb]">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#e6e8eb] bg-[#fafbfc] text-[11px] uppercase tracking-[0.08em] text-[#6b7280]">
                          <th className="px-4 py-2.5 font-semibold">Alumno</th>
                          <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Privacidad</th>
                          <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Vistas</th>
                          <th className="px-4 py-2.5 font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeLinks.map((link) => (
                          <tr key={link.id} className="border-b border-[#f0f2f5] last:border-0">
                            <td className="px-4 py-3 font-medium">
                              {link.student_name ?? link.student_id ?? "Sin identificar"}
                            </td>
                            <td className="hidden px-4 py-3 text-[#5b6472] sm:table-cell">
                              {privacyLabel(link.privacy_level as "full_name" | "initials_only" | "id_only")}
                            </td>
                            <td className="hidden px-4 py-3 text-[#5b6472] sm:table-cell">{link.view_count}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => copyLink(link.token, link.id)}
                                  className="rounded-md border border-[#cfd6df] px-2.5 py-1 text-[11px] font-semibold text-[#07305f] hover:bg-[#f4f6f8]"
                                >
                                  {copiedId === link.id ? "Copiado!" : "Copiar link"}
                                </button>
                                <button
                                  onClick={() => revokeLink(link.id)}
                                  className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-[#dc2626] hover:bg-red-50"
                                >
                                  Revocar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {revokedLinks.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
                    Revocados ({revokedLinks.length})
                  </h3>
                  <div className="overflow-x-auto rounded-md border border-[#e6e8eb] opacity-60">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#e6e8eb] bg-[#fafbfc] text-[11px] uppercase tracking-[0.08em] text-[#6b7280]">
                          <th className="px-4 py-2.5 font-semibold">Alumno</th>
                          <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Revocado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revokedLinks.map((link) => (
                          <tr key={link.id} className="border-b border-[#f0f2f5] last:border-0">
                            <td className="px-4 py-3 font-medium line-through">
                              {link.student_name ?? link.student_id ?? "Sin identificar"}
                            </td>
                            <td className="hidden px-4 py-3 text-[#5b6472] sm:table-cell">
                              {new Date(link.revoked_at!).toLocaleDateString("es-CL")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronDown() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
