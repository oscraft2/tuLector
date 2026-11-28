import Link from "next/link";

type Props = {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
  secondary?: { label: string; href: string };
};

export function EmptyState({ icon, title, description, action, secondary }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[#e7e5df] bg-[#fffefb] px-6 py-14 text-center shadow-xs">
      <span
        aria-hidden="true"
        className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#f4f2ec] text-2xl ring-1 ring-[#e7e5df]"
      >
        {icon}
      </span>
      <h3 className="text-lg font-bold text-[#1c1917]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#57534e]">{description}</p>
      {(action || secondary) && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {action && (
            <Link
              href={action.href}
              className="rounded-lg bg-[#07305f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#062447]"
            >
              {action.label}
            </Link>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className="rounded-lg border border-[#d6d3cb] bg-white px-5 py-2.5 text-sm font-semibold text-[#44403c] transition hover:bg-[#f7f6f2]"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
