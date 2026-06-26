"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

type Tab = "colegio" | "superior";

type SchoolResult = {
  id: string;
  rbd: string;
  nombre: string;
  comuna: string | null;
  region: string | null;
  dependencia: string | null;
};

type InstitutionResult = {
  id: string;
  nombre: string;
  sigla: string | null;
  tipo: string | null;
  region: string | null;
  comuna: string | null;
};

type Result = SchoolResult | InstitutionResult;

interface Props {
  onSelect: (item: Result, tab: Tab) => void;
  defaultValue?: string;
}

export default function SeleccionarInstitucion({ onSelect, defaultValue }: Props) {
  const [tab, setTab] = useState<Tab>("colegio");
  const [query, setQuery] = useState(defaultValue ?? "");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback(async (q: string, t: Tab) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    const supabase = createClient();
    try {
      if (t === "colegio") {
        const { data } = await supabase.rpc("buscar_escuelas", {
          search_term: q,
          limit_results: 20,
        });
        setResults((data ?? []) as SchoolResult[]);
      } else {
        const { data } = await supabase
          .from("instituciones_superiores")
          .select("id, nombre, sigla, tipo, region, comuna")
          .ilike("nombre", `%${q}%`)
          .limit(20);
        setResults((data ?? []) as InstitutionResult[]);
      }
    } finally {
      setLoading(false);
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query, tab), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, tab, search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(item: Result) {
    setQuery("nombre" in item ? item.nombre : "");
    setOpen(false);
    onSelect(item, tab);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="mb-2 flex gap-1 rounded-lg border border-[#d8dde3] p-0.5 bg-[#f3f4f6]">
        <button
          type="button"
          onClick={() => { setTab("colegio"); setQuery(""); setResults([]); setOpen(false); }}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === "colegio" ? "bg-white text-[#07305f] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"}`}
        >
          Colegio
        </button>
        <button
          type="button"
          onClick={() => { setTab("superior"); setQuery(""); setResults([]); setOpen(false); }}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === "superior" ? "bg-white text-[#07305f] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"}`}
        >
          Inst. Superior
        </button>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal"
        placeholder={tab === "colegio" ? "Busca por nombre, RBD o comuna..." : "Busca por nombre o sigla..."}
        autoComplete="off"
      />

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[#d8dde3] bg-white shadow-lg">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-[#eef6ff] transition"
              >
                {"rbd" in item ? (
                  <>
                    <span className="font-medium">{item.nombre}</span>
                    <span className="text-xs text-[#6b7280]">
                      RBD {item.rbd} &middot; {item.comuna ?? ""}{item.region ? `, ${item.region}` : ""}
                      {item.dependencia ? ` · ${item.dependencia}` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">{item.nombre}{item.sigla ? ` (${item.sigla})` : ""}</span>
                    <span className="text-xs text-[#6b7280]">
                      {item.tipo ?? ""}{item.comuna ? ` · ${item.comuna}` : ""}{item.region ? `, ${item.region}` : ""}
                    </span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && loading && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-[#d8dde3] bg-white px-3 py-2 text-sm text-[#6b7280] shadow-lg">
          Buscando...
        </div>
      )}

      {open && !loading && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-[#d8dde3] bg-white px-3 py-2 text-sm text-[#6b7280] shadow-lg">
          Sin resultados. Puedes escribir el nombre manualmente.
        </div>
      )}
    </div>
  );
}
