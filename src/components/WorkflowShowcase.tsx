"use client";

import Image from "next/image";
import { useState } from "react";
import type { PublicLocale } from "@/lib/public_i18n";

type WorkflowShowcaseProps = {
  locale: PublicLocale;
};

type Step = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  alt: string;
};

const copy: Record<PublicLocale, { eyebrow: string; title: string; body: string; previous: string; next: string; steps: Step[] }> = {
  es: {
    eyebrow: "Flujo completo",
    title: "Como funciona TuLector",
    body: "De la hoja impresa al resultado academico sin digitacion manual.",
    previous: "Anterior",
    next: "Siguiente",
    steps: [
      {
        key: "create",
        eyebrow: "01",
        title: "Crear evaluacion",
        body: "Configura curso, asignatura, preguntas y clave de respuestas desde una cuenta docente.",
        image: "/workflow/create-evaluation.png",
        alt: "Panel de TuLector para crear una evaluacion con clave de respuestas",
      },
      {
        key: "print",
        eyebrow: "02",
        title: "Imprimir hojas",
        body: "Genera hojas de respuesta listas para aplicar en sala, sin maquinas especiales.",
        image: "/workflow/print-sheet.png",
        alt: "Hoja de respuestas TuLector preparada para imprimir",
      },
      {
        key: "scan",
        eyebrow: "03",
        title: "Escanear con camara",
        body: "Lee cada hoja desde celular o navegador y revisa marcas dudosas antes de guardar.",
        image: "/workflow/scan-phone.png",
        alt: "Celular leyendo una hoja de respuestas con marco de deteccion",
      },
      {
        key: "results",
        eyebrow: "04",
        title: "Analizar resultados",
        body: "Consulta puntajes, notas, promedio por curso y rendimiento por pregunta para exportar.",
        image: "/workflow/results-dashboard.png",
        alt: "Panel de resultados academicos con puntajes y rendimiento por pregunta",
      },
    ],
  },
  pt: {
    eyebrow: "Fluxo completo",
    title: "Como funciona o TuLector",
    body: "Da folha impressa ao resultado academico sem digitacao manual.",
    previous: "Anterior",
    next: "Seguinte",
    steps: [
      {
        key: "create",
        eyebrow: "01",
        title: "Criar prova",
        body: "Configure turma, disciplina, perguntas e gabarito em uma conta docente.",
        image: "/workflow/create-evaluation.png",
        alt: "Painel do TuLector para criar uma prova com gabarito",
      },
      {
        key: "print",
        eyebrow: "02",
        title: "Imprimir folhas",
        body: "Gere folhas de resposta prontas para usar em sala, sem maquinas especiais.",
        image: "/workflow/print-sheet.png",
        alt: "Folha de respostas TuLector pronta para impressao",
      },
      {
        key: "scan",
        eyebrow: "03",
        title: "Escanear com camera",
        body: "Leia cada folha pelo celular ou navegador e revise marcacoes duvidosas antes de salvar.",
        image: "/workflow/scan-phone.png",
        alt: "Celular lendo uma folha de respostas com area de deteccao",
      },
      {
        key: "results",
        eyebrow: "04",
        title: "Analisar resultados",
        body: "Veja pontos, notas, media por turma e desempenho por pergunta antes de exportar.",
        image: "/workflow/results-dashboard.png",
        alt: "Painel de resultados academicos com pontuacao e desempenho por pergunta",
      },
    ],
  },
  en: {
    eyebrow: "Full workflow",
    title: "How TuLector works",
    body: "From printed sheet to academic results without manual data entry.",
    previous: "Previous",
    next: "Next",
    steps: [
      {
        key: "create",
        eyebrow: "01",
        title: "Create assessment",
        body: "Set class, subject, questions and answer key from a teacher account.",
        image: "/workflow/create-evaluation.png",
        alt: "TuLector dashboard for creating an assessment with an answer key",
      },
      {
        key: "print",
        eyebrow: "02",
        title: "Print sheets",
        body: "Generate answer sheets ready for the classroom, with no special machine required.",
        image: "/workflow/print-sheet.png",
        alt: "TuLector answer sheet ready to print",
      },
      {
        key: "scan",
        eyebrow: "03",
        title: "Scan by camera",
        body: "Read each sheet from a phone or browser and review uncertain marks before saving.",
        image: "/workflow/scan-phone.png",
        alt: "Phone reading an answer sheet with a detection frame",
      },
      {
        key: "results",
        eyebrow: "04",
        title: "Analyze results",
        body: "Review scores, grades, class averages and question performance before export.",
        image: "/workflow/results-dashboard.png",
        alt: "Academic results dashboard with scores and question performance",
      },
    ],
  },
};

export function WorkflowShowcase({ locale }: WorkflowShowcaseProps) {
  const section = copy[locale];
  const [activeKey, setActiveKey] = useState(section.steps[0].key);
  const activeIndex = Math.max(0, section.steps.findIndex((step) => step.key === activeKey));
  const active = section.steps[activeIndex] ?? section.steps[0];

  function move(delta: number) {
    const nextIndex = (activeIndex + delta + section.steps.length) % section.steps.length;
    setActiveKey(section.steps[nextIndex].key);
  }

  return (
    <section id="workflow" className="scroll-mt-24 border-y border-[#e6e8eb] bg-[#f8faf9] px-5 py-14 md:px-8 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">{section.eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#111827] md:text-5xl">{section.title}</h2>
          <p className="mt-4 text-base leading-7 text-[#5f6b66] md:text-lg">{section.body}</p>
        </div>

        <div className="mt-9 lg:grid lg:grid-cols-[0.78fr_1.22fr] lg:items-stretch lg:gap-6">
          <div className="hidden min-w-0 lg:block">
            <div className="grid gap-2" role="tablist" aria-label={section.title}>
              {section.steps.map((step) => {
                const selected = step.key === active.key;
                return (
                  <button
                    key={step.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveKey(step.key)}
                    className={selected
                      ? "rounded-lg border border-[#123b5d] bg-white p-4 text-left shadow-sm ring-1 ring-[#123b5d]/10"
                      : "rounded-lg border border-[#dfe5e2] bg-white/70 p-4 text-left transition hover:border-[#b8c4be] hover:bg-white"}
                  >
                    <span className={selected ? "text-xs font-bold text-[#123b5d]" : "text-xs font-bold text-[#7b8580]"}>{step.eyebrow}</span>
                    <span className="mt-2 block text-base font-bold text-[#111827]">{step.title}</span>
                    <span className="mt-2 block text-sm leading-6 text-[#5f6b66]">{step.body}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:hidden">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.12em] text-[#6b7280]">
              <span>{String(activeIndex + 1).padStart(2, "0")} / {String(section.steps.length).padStart(2, "0")}</span>
              <span>{active.title}</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#dfe5e2] bg-white shadow-lg shadow-black/5">
              <Image
                key={active.image}
                src={active.image}
                alt={active.alt}
                width={1200}
                height={780}
                sizes="100vw"
                className="h-auto w-full object-cover"
              />
            </div>

            <div className="rounded-lg border border-[#dfe5e2] bg-white p-4">
              <p className="text-sm font-bold text-[#123b5d]">{active.eyebrow}</p>
              <h3 className="mt-2 text-lg font-bold tracking-tight text-[#111827]">{active.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#5f6b66]">{active.body}</p>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => move(-1)}
                className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-[#cfd8d4] bg-white px-4 text-sm font-bold text-[#111827] shadow-sm active:scale-[0.98]"
                aria-label={section.previous}
              >
                &lt;
              </button>
              <div className="flex items-center gap-2" aria-label={`${activeIndex + 1} de ${section.steps.length}`}>
                {section.steps.map((step, index) => (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => setActiveKey(step.key)}
                    className={index === activeIndex ? "h-2.5 w-6 rounded-full bg-[#123b5d]" : "h-2.5 w-2.5 rounded-full bg-[#cfd8d4]"}
                    aria-label={step.title}
                    aria-current={index === activeIndex ? "step" : undefined}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => move(1)}
                className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-[#cfd8d4] bg-white px-4 text-sm font-bold text-[#111827] shadow-sm active:scale-[0.98]"
                aria-label={section.next}
              >
                &gt;
              </button>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-[#dfe5e2] bg-white shadow-lg shadow-black/5 lg:block">
            <Image
              key={active.image}
              src={active.image}
              alt={active.alt}
              width={1200}
              height={780}
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
