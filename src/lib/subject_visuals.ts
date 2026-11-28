export type SubjectVisual = {
  emoji: string;
  badgeClass: string;
};

const SUBJECT_RULES: ReadonlyArray<{ keywords: readonly string[]; visual: SubjectVisual }> = [
  {
    keywords: ["matem", "álgebra", "algebra", "geometr", "cálculo", "calculo"],
    visual: { emoji: "📐", badgeClass: "bg-[#eef4ff] text-[#07305f]" },
  },
  {
    keywords: ["lengua", "lectura", "literatura", "comunicación", "comunicacion", "castellano"],
    visual: { emoji: "📖", badgeClass: "bg-[#fef3c7] text-[#92400e]" },
  },
  {
    keywords: ["historia", "geograf", "sociales", "cívica", "civica"],
    visual: { emoji: "🏛️", badgeClass: "bg-[#ffedd5] text-[#9a3412]" },
  },
  {
    keywords: ["ciencia", "biolog", "física", "fisica", "quím", "quim", "naturales"],
    visual: { emoji: "🔬", badgeClass: "bg-[#dcfce7] text-[#166534]" },
  },
  {
    keywords: ["inglés", "ingles", "english", "idioma", "francés", "frances", "portugu"],
    visual: { emoji: "🌍", badgeClass: "bg-[#e0f2fe] text-[#075985]" },
  },
  {
    keywords: ["música", "musica"],
    visual: { emoji: "🎵", badgeClass: "bg-[#ede9fe] text-[#5b21b6]" },
  },
  {
    keywords: ["arte", "visuales", "dibujo"],
    visual: { emoji: "🎨", badgeClass: "bg-[#fce7f3] text-[#9d174d]" },
  },
  {
    keywords: ["educación física", "educacion fisica", "deporte", "salud"],
    visual: { emoji: "⚽", badgeClass: "bg-[#ecfccb] text-[#3f6212]" },
  },
  {
    keywords: ["tecnolog", "informát", "informat", "comput"],
    visual: { emoji: "💻", badgeClass: "bg-[#f1f5f9] text-[#334155]" },
  },
];

const DEFAULT_SUBJECT_VISUAL: SubjectVisual = {
  emoji: "📝",
  badgeClass: "bg-[#f4f3ee] text-[#44403c]",
};

/** Devuelve emoji y tono pastel cálido asociado a la asignatura del ensayo. */
export function getSubjectVisual(subject?: string | null): SubjectVisual {
  const s = (subject ?? "").trim().toLowerCase();
  if (!s) return DEFAULT_SUBJECT_VISUAL;
  for (const rule of SUBJECT_RULES) {
    if (rule.keywords.some((kw) => s.includes(kw))) return rule.visual;
  }
  return DEFAULT_SUBJECT_VISUAL;
}

export type PaperStatusVisual = {
  label: string;
  className: string;
};

/** Etiqueta legible en español y estilo semántico para el estado de una hoja. */
export function getPaperStatusVisual(status?: string | null): PaperStatusVisual {
  if (status === "manual_review") {
    return { label: "Por identificar", className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" };
  }
  if (status === "corrected") {
    return { label: "Corregida", className: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" };
  }
  if (status === "void") {
    return { label: "Anulada", className: "bg-stone-100 text-stone-600 ring-1 ring-stone-200" };
  }
  return { label: "Registrada", className: "bg-[#eef4ff] text-[#07305f] ring-1 ring-[#d5e3fb]" };
}
