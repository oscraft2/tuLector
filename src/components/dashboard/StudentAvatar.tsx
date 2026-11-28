const AVATAR_EMOJIS = [
  "🦊",
  "🦉",
  "🐢",
  "🦋",
  "🐬",
  "🐼",
  "🦁",
  "🐧",
  "🐝",
  "🐙",
  "🌿",
  "🚀",
  "🎨",
  "📚",
  "🧭",
  "⭐",
] as const;

const AVATAR_TONES = [
  "bg-[#fef3c7] ring-[#fde68a]",
  "bg-[#dcfce7] ring-[#bbf7d0]",
  "bg-[#e0f2fe] ring-[#bae6fd]",
  "bg-[#fce7f3] ring-[#fbcfe8]",
  "bg-[#ede9fe] ring-[#ddd6fe]",
  "bg-[#ffedd5] ring-[#fed7aa]",
  "bg-[#ecfccb] ring-[#d9f99d]",
  "bg-[#f1f5f9] ring-[#cbd5e1]",
] as const;

const SIZES = {
  xs: "h-7 w-7 text-sm",
  sm: "h-8 w-8 text-base",
  md: "h-10 w-10 text-lg",
  lg: "h-14 w-14 text-2xl",
} as const;

function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getStudentEmoji(seed: string, unknown = false): string {
  if (unknown) return "📝";
  const h = hashSeed(seed || "tulector");
  return AVATAR_EMOJIS[h % AVATAR_EMOJIS.length];
}

/**
 * Avatar ilustrado (sin fotos) determinístico por alumno para dar calidez
 * visual en listados, buscador y perfil sin depender de archivos externos.
 */
export function StudentAvatar({
  seed,
  name,
  size = "sm",
  unknown = false,
  className = "",
}: {
  seed: string;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  unknown?: boolean;
  className?: string;
}) {
  const safeSeed = seed || name || "tulector";
  const h = hashSeed(safeSeed);
  const emoji = unknown ? "📝" : AVATAR_EMOJIS[h % AVATAR_EMOJIS.length];
  const tone = unknown
    ? "bg-amber-50 ring-amber-200 text-amber-800"
    : AVATAR_TONES[(h >>> 4) % AVATAR_TONES.length];

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 select-none place-items-center rounded-full ring-1 ${SIZES[size]} ${tone} ${className}`}
    >
      {emoji}
    </span>
  );
}
