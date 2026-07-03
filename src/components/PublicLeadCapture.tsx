"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { localizedHref, publicCopy, type PublicLocale } from "@/lib/public_i18n";

type SubmitState = "idle" | "loading" | "success" | "error";

type PublicLeadCaptureProps = {
  locale?: PublicLocale;
};

export function PublicLeadCapture({ locale = "es" }: PublicLeadCaptureProps) {
  const copy = publicCopy[locale].footer.newsletter;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [institutionalRut, setInstitutionalRut] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState(locale === "pt" ? "Brasil" : locale === "en" ? "International" : "Chile");
  const [consentMarketing, setConsentMarketing] = useState(true);
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");

    try {
      const response = await fetch("/api/leads/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          institution,
          institutionalRut,
          phone,
          country,
          locale,
          consentMarketing,
          website,
          source: typeof window !== "undefined" ? window.location.pathname : "/",
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || copy.error);

      setState("success");
      setEmail("");
      setName("");
      setInstitution("");
      setInstitutionalRut("");
      setPhone("");
      setMessage(copy.success);
      setModalOpen(true);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : copy.error);
      setModalOpen(true);
    }
  }

  const modalTitle = state === "success" ? copy.successTitle : copy.errorTitle;
  const modalBody = state === "success" ? copy.successBody : message || copy.error;

  return (
    <section id="contacto" className="scroll-mt-24 border-t border-[#e3e9e5] bg-[#123b5d] px-5 py-8 text-white md:px-8 md:py-14">
      <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-[0.9fr_1.1fr] md:items-center md:gap-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a9d9c4]">{copy.eyebrow}</p>
          <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight md:mt-3 md:text-4xl">{copy.title}</h2>
          <p className="mt-4 hidden max-w-2xl text-sm leading-6 text-white/75 md:block md:text-base">{copy.body}</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-white/15 bg-white/10 p-3 shadow-xl shadow-black/10 backdrop-blur md:rounded-xl md:p-4 md:shadow-2xl">
          <div className="grid gap-2 sm:grid-cols-2 md:gap-3">
            <label className="sr-only" htmlFor="lead-email">{copy.placeholder}</label>
            <input
              id="lead-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder={copy.placeholder}
              className="min-h-11 w-full rounded-md border border-white/20 bg-white px-3 text-sm font-medium text-[#111827] outline-none transition placeholder:text-[#7b8580] focus:border-[#a9d9c4] focus:ring-2 focus:ring-[#a9d9c4]/30 md:min-h-12 md:rounded-lg md:px-4"
            />
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder={copy.namePlaceholder}
              className="min-h-11 w-full rounded-md border border-white/20 bg-white px-3 text-sm font-medium text-[#111827] outline-none transition placeholder:text-[#7b8580] focus:border-[#a9d9c4] focus:ring-2 focus:ring-[#a9d9c4]/30 md:min-h-12 md:rounded-lg md:px-4"
            />
            <input
              type="text"
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
              autoComplete="organization"
              placeholder={copy.institutionPlaceholder}
              className="min-h-11 w-full rounded-md border border-white/20 bg-white px-3 text-sm font-medium text-[#111827] outline-none transition placeholder:text-[#7b8580] focus:border-[#a9d9c4] focus:ring-2 focus:ring-[#a9d9c4]/30 md:min-h-12 md:rounded-lg md:px-4"
            />
            <input
              type="text"
              value={institutionalRut}
              onChange={(event) => setInstitutionalRut(event.target.value)}
              placeholder={copy.rutPlaceholder}
              className="min-h-11 w-full rounded-md border border-white/20 bg-white px-3 text-sm font-medium text-[#111827] outline-none transition placeholder:text-[#7b8580] focus:border-[#a9d9c4] focus:ring-2 focus:ring-[#a9d9c4]/30 md:min-h-12 md:rounded-lg md:px-4"
            />
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              placeholder={copy.phonePlaceholder}
              className="min-h-11 w-full rounded-md border border-white/20 bg-white px-3 text-sm font-medium text-[#111827] outline-none transition placeholder:text-[#7b8580] focus:border-[#a9d9c4] focus:ring-2 focus:ring-[#a9d9c4]/30 md:min-h-12 md:rounded-lg md:px-4"
            />
            <input
              type="text"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              placeholder={copy.countryPlaceholder}
              className="min-h-11 w-full rounded-md border border-white/20 bg-white px-3 text-sm font-medium text-[#111827] outline-none transition placeholder:text-[#7b8580] focus:border-[#a9d9c4] focus:ring-2 focus:ring-[#a9d9c4]/30 md:min-h-12 md:rounded-lg md:px-4"
            />
            <input
              type="text"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />
          </div>

          <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-white/80">
            <input
              type="checkbox"
              checked={consentMarketing}
              onChange={(event) => setConsentMarketing(event.target.checked)}
              required
              className="mt-1 h-4 w-4 rounded border-white/40 accent-[#dff5ea]"
            />
            <span>{copy.consent}</span>
          </label>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <p className="hidden text-xs leading-5 text-white/65 sm:block">{copy.disclaimer}</p>
            <button
              type="submit"
              disabled={state === "loading"}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#dff5ea] px-4 text-sm font-bold text-[#123b5d] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.99] md:min-h-12 md:rounded-lg md:px-5"
            >
              {state === "loading" ? copy.loading : copy.button}
            </button>
          </div>
        </form>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/60 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="lead-modal-title">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/20 bg-white text-[#111827] shadow-2xl">
            <div className={state === "success" ? "border-b border-[#dfe5e2] bg-[#f8faf9] p-5" : "border-b border-[#fee2e2] bg-[#fff7f7] p-5"}>
              <div className="flex items-start gap-4">
                <div className={state === "success" ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#dff5ea] text-sm font-black text-[#123b5d]" : "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fee2e2] text-lg font-black text-[#991b1b]"}>
                  {state === "success" ? "OK" : "!"}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6f5e]">TuLector</p>
                  <h3 id="lead-modal-title" className="mt-1 text-2xl font-bold tracking-tight">{modalTitle}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5f6b66]">{modalBody}</p>
                </div>
              </div>
            </div>

            {state === "success" ? (
              <div className="p-5">
                <div className="rounded-xl border border-[#dfe5e2] bg-[#fbfcfb] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#111827]">{copy.trialTitle}</p>
                      <p className="mt-2 text-sm leading-6 text-[#5f6b66]">{copy.trialBody}</p>
                    </div>
                    <span className="inline-flex shrink-0 rounded-full bg-[#dff5ea] px-3 py-1 text-xs font-black text-[#123b5d]">{copy.trialBadge}</span>
                  </div>
                  <p className="mt-3 border-t border-[#e6e8eb] pt-3 text-xs leading-5 text-[#6b7280]">{copy.trialNote}</p>
                </div>

                <div className="mt-4 rounded-xl border border-[#dfe5e2] bg-white p-4">
                  <p className="text-sm font-bold text-[#111827]">{copy.appsTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-[#5f6b66]">{copy.appsBody}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Image
                      src="/store-badges/app-store.svg"
                      alt="Download on the App Store"
                      width={120}
                      height={40}
                      className="h-10 w-auto"
                    />
                    <Image
                      src="/store-badges/google-play.png"
                      alt="Get it on Google Play"
                      width={135}
                      height={40}
                      className="h-10 w-auto"
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Link
                    href={localizedHref("/auth?mode=register", locale)}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#123b5d] px-5 text-sm font-bold text-white transition hover:bg-[#0f2f49]"
                  >
                    {copy.primaryAction}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#cfd8d4] bg-white px-5 text-sm font-bold text-[#111827] transition hover:border-[#aebbb5] hover:bg-[#f7f8f6]"
                  >
                    {copy.close}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#123b5d] px-5 text-sm font-bold text-white transition hover:bg-[#0f2f49]"
                >
                  {copy.close}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}




