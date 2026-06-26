"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { completeOnboarding } from "./actions";
import { countryProfiles, resolveCountryProfile } from "@/lib/country_profiles";
import SeleccionarInstitucion from "@/components/SeleccionarInstitucion";

type Result = {
  id: string; nombre: string; comuna: string | null; region: string | null;
} & ({ rbd: string } | { sigla: string | null; tipo: string | null });

type Tab = "colegio" | "superior";

export default function OnboardingPage() {
  const initialCountry = resolveCountryProfile("CL");
  const [selected, setSelected] = useState<{ item: Result; tab: Tab } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSelect(item: Result, tab: Tab) {
    setSelected({ item, tab });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (selected) {
      fd.set("name", selected.item.nombre);
      fd.set("region", selected.item.region ?? "");
      fd.set("city", selected.item.comuna ?? "");
      const rbd = "rbd" in selected.item ? selected.item.rbd : "";
      fd.set("rbd", rbd);
      fd.set("institucion_tipo", selected.tab);
    }
    await completeOnboarding(fd);
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-5 py-10 text-[#0b1220]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-3xl font-semibold tracking-tight text-[#07305f]">TuLector</Link>
        <section className="mt-10 rounded-md border border-[#d8dde3] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Primer acceso</p>
          <h1 className="mt-2 text-3xl font-semibold">Configura tu colegio</h1>
          <p className="mt-2 text-sm leading-6 text-[#5b6472]">Busca y selecciona tu colegio o institucion superior. Por ahora TuLector opera con Perfil Chile para estandarizar resultados, escalas y reportes.</p>
          <form ref={formRef} onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <label className="text-sm font-semibold">
              Buscar institucion
              <SeleccionarInstitucion onSelect={handleSelect} />
            </label>

            <label className="text-sm font-semibold">
              Nombre de institucion
              <input readOnly
                value={selected?.item.nombre ?? ""}
                className="mt-2 w-full rounded-md border border-[#cfd6df] bg-[#f3f4f6] px-3 py-2 font-normal text-[#6b7280]"
                placeholder="Selecciona una institucion arriba"
                tabIndex={-1}
              />
            </label>

            <label className="text-sm font-semibold">Subdominio<input name="subdomain" className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal" placeholder="losandes" /></label>

            <fieldset>
              <legend className="text-sm font-semibold">Pais del colegio</legend>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {countryProfiles.map((country) => (
                  <label key={country.code} className="cursor-pointer">
                    <input className="peer sr-only" type="radio" name="country_code" value={country.code} defaultChecked={country.code === initialCountry.code} />
                    <span className="block rounded-xl border border-[#d8dde3] bg-white p-3 transition peer-checked:border-2 peer-checked:border-[#07305f] peer-checked:bg-[#eef6ff]">
                      <span className="text-2xl" aria-hidden="true">{country.flag}</span>
                      <span className="mt-2 block text-sm font-semibold text-[#111827]">{country.countryName}</span>
                      <span className="mt-0.5 block text-xs text-[#5b6472]">{country.standardsLabel}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#5b6472]">{initialCountry.onboardingHelper}</p>
            </fieldset>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold">
                Region
                <input readOnly
                  value={selected?.item.region ?? ""}
                  className="mt-2 w-full rounded-md border border-[#cfd6df] bg-[#f3f4f6] px-3 py-2 font-normal text-[#6b7280]"
                  placeholder="Se completara automaticamente"
                  tabIndex={-1}
                />
              </label>
              <label className="text-sm font-semibold">
                Comuna / Ciudad
                <input readOnly
                  value={selected?.item.comuna ?? ""}
                  className="mt-2 w-full rounded-md border border-[#cfd6df] bg-[#f3f4f6] px-3 py-2 font-normal text-[#6b7280]"
                  placeholder="Se completara automaticamente"
                  tabIndex={-1}
                />
              </label>
            </div>

            <button type="submit" disabled={!selected}
              className="mt-2 rounded-md bg-[#07305f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Crear cuenta institucional
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
