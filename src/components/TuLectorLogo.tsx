import Link from "next/link";

type TuLectorLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * Official TuLector logo: dark rounded "TL" badge + "TuLector" wordmark.
 * Use this component everywhere the brand logo appears to keep it consistent.
 */
export function TuLectorLogo({ href = "/", size = "md", className = "" }: TuLectorLogoProps) {
  const sizes = {
    sm: { badge: "h-7 w-7 text-[11px] rounded", text: "text-base" },
    md: { badge: "h-9 w-9 text-sm rounded-md", text: "text-lg" },
    lg: { badge: "h-11 w-11 text-base rounded-lg", text: "text-xl" },
  };

  const s = sizes[size];

  const content = (
    <>
      <span
        className={`flex items-center justify-center bg-[#111827] font-bold text-white ${s.badge}`}
        aria-hidden="true"
      >
        TL
      </span>
      <span className={`font-semibold tracking-tight text-[#111827] ${s.text}`}>
        TuLector
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`inline-flex items-center gap-2.5 ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {content}
    </span>
  );
}
