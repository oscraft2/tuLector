"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { completeOnboarding } from "./actions";
import { countryProfiles, resolveCountryProfile } from "@/lib/country_profiles";
import SeleccionarInstitucion from "@/components/SeleccionarInstitucion";
import { TuLectorLogo } from "@/components/TuLectorLogo";

type Result = {
  id: string; nombre: string; comuna: string | null; region: string | null;
} & ({ rbd: string } | { sigla: string | null; tipo: string | null });

type Tab = "colegio" | "superior" | "personal";

export default function OnboardingPage() {
  const initialCountry = resolveCountryProfile("CL");
  const [selected, setSelected] = useState<{ item: Result; tab: Tab } | null>(null);
  const [isManual, setIsManual] = useState(false);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [rbd, setRbd] = useState("");
  const [institucionTipo, setInstitucionTipo] = useState<Tab>("colegio");
  const formRef = useRef<HTMLFormElement>(null);

  function handleSelect(item: Result) {
    setSelected({ item, tab: institucionTipo });
    setIsManual(false);
    setName(item.nombre);
    setRegion(item.region ?? "");
    setCity(item.comuna ?? "");
    setRbd("rbd" in item ? item.rbd : "");
  }

  function handleManualMode(initialName: string = "") {
    setIsManual(true);
    setSelected(null);
    setName(initialName);
    setRegion("");
    setCity("");
    setRbd("");
  }

  function handleTabChange(newTab: Tab) {
    setInstitucionTipo(newTab);
    setSelected(null);
    setIsManual(false);
    if (newTab === "personal") {
      setName("Cuenta Personal");
      setRegion("");
      setCity("");
      setRbd("");
    } else {
      setName("");
      setRegion("");
      setCity("");
      setRbd("");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    
    const finalName = institucionTipo === "personal" ? "Cuenta Personal" : name.trim();
    fd.set("name", finalName);
    fd.set("region", region.trim());
    fd.set("city", city.trim());
    fd.set("rbd", rbd.trim());
    fd.set("institucion_tipo", institucionTipo);
    await completeOnboarding(fd);
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-5 py-10 text-[#0b1220]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <div className="mx-auto max-w-2xl">
        <TuLectorLogo href="/" size="lg" />
        <section className="mt-10 rounded-md border border-[#d8dde3] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Primer acceso</p>
          <h1 className="mt-2 text-3xl font-semibold">Configura tu perfil</h1>
          <p className="mt-2 text-sm leading-6 text-[#5b6472]">Selecciona el tipo de cuenta y país. El país determina la escala de notas y estándares de evaluación de tu perfil.</p>
          
          <form ref={formRef} onSubmit={handleSubmit} className="mt-6 grid gap-4">
            
            {/* Tipo de cuenta */}
            <div>
              <span className="text-sm font-semibold block mb-2">Tipo de cuenta</span>
              <div className="flex gap-1 rounded-lg border border-[#d8dde3] p-0.5 bg-[#f3f4f6]">
                <button
                  type="button"
                  onClick={() => handleTabChange("colegio")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${institucionTipo === "colegio" ? "bg-white text-[#07305f] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"}`}
                >
                  Colegio
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("superior")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${institucionTipo === "superior" ? "bg-white text-[#07305f] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"}`}
                >
                  Inst. Superior
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("personal")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${institucionTipo === "personal" ? "bg-white text-[#07305f] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"}`}
                >
                  Personal
                </button>
              </div>
            </div>

            {/* Buscar institución si es colegio o superior */}
            {institucionTipo !== "personal" && (
              <>
                <div className="flex justify-between items-center text-sm font-semibold mt-2">
                  <span>Buscar institución</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (isManual) {
                        setIsManual(false);
                      } else {
                        handleManualMode();
                      }
                    }}
                    className="text-xs font-semibold text-[#07305f] hover:underline cursor-pointer"
                  >
                    {isManual ? "Buscar institución..." : "Ingresar manualmente"}
                  </button>
                </div>

                {!isManual ? (
                  <SeleccionarInstitucion
                    tab={institucionTipo === "superior" ? "superior" : "colegio"}
                    onSelect={handleSelect}
                    onManualMode={handleManualMode}
                  />
                ) : (
                  <div className="text-xs text-[#5b6472] -mt-1">
                    Registrando institución de forma manual.
                  </div>
                )}

                <label className="text-sm font-semibold block mt-2">
                  Nombre de institución
                  <input
                    readOnly={!isManual}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal ${!isManual ? "bg-[#f3f4f6] text-[#6b7280]" : "bg-white text-[#0b1220]"}`}
                    placeholder={!isManual ? "Selecciona una institución arriba" : "Ej. Colegio San Francisco"}
                    tabIndex={!isManual ? -1 : undefined}
                    required={isManual}
                  />
                </label>

                {isManual && institucionTipo === "colegio" && (
                  <label className="text-sm font-semibold block mt-2">
                    RBD (Opcional)
                    <input
                      type="text"
                      value={rbd}
                      onChange={(e) => setRbd(e.target.value)}
                      className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal text-[#0b1220]"
                      placeholder="Ej. 12345"
                    />
                  </label>
                )}
              </>
            )}

            {institucionTipo === "personal" && (
              <div className="rounded-md border border-[#eef6ff] bg-[#f9fafb] p-4 text-sm text-[#5b6472] mt-2">
                Perfil de cuenta personal. No requiere vincularse a un colegio o universidad.
              </div>
            )}

            <label className="text-sm font-semibold">Subdominio<input name="subdomain" className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal" placeholder="losandes" /></label>

            <fieldset>
              <legend className="text-sm font-semibold">País de origen</legend>
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

            {/* Dirección si es colegio o superior */}
            {institucionTipo !== "personal" && (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold">
                  Región
                  <input
                    readOnly={!isManual}
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className={`mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal ${!isManual ? "bg-[#f3f4f6] text-[#6b7280]" : "bg-white text-[#0b1220]"}`}
                    placeholder={!isManual ? "Se completará automáticamente" : "Ej. Metropolitana"}
                    tabIndex={!isManual ? -1 : undefined}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Comuna / Ciudad
                  <input
                    readOnly={!isManual}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={`mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal ${!isManual ? "bg-[#f3f4f6] text-[#6b7280]" : "bg-white text-[#0b1220]"}`}
                    placeholder={!isManual ? "Se completará automáticamente" : "Ej. Santiago"}
                    tabIndex={!isManual ? -1 : undefined}
                  />
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={institucionTipo !== "personal" && !selected && (!isManual || !name.trim())}
              className="mt-2 rounded-md bg-[#07305f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Crear cuenta
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
