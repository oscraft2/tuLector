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
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e1e5ea] bg-white px-6 py-16 text-center">
      <span className="mb-4 text-4xl">{icon}</span>
      <h3 className="text-lg font-bold text-[#111827]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-[#5b6472]">{description}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {action && (
          <Link
            href={action.href}
            className="rounded-lg bg-[#07305f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#062447] transition"
          >
            {action.label}
          </Link>
        )}
        {secondary && (
          <Link
            href={secondary.href}
            className="rounded-lg border border-[#cfd6df] bg-white px-5 py-2.5 text-sm font-semibold text-[#5b6472] hover:bg-[#f4f6f8] transition"
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  );
}
