import type { ReactNode } from "react";

export function PageHeader({
  eyebrow = "",
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between md:mb-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#78716c]">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-[#1c1917] sm:text-[1.75rem]">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#57534e]">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
