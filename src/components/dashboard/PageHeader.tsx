export function PageHeader({ eyebrow = "TuLector School", title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <div className="mb-5 md:mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b6472]">{description}</p>
    </div>
  );
}
