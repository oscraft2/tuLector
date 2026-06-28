import Link from "next/link";
import { localizedHref, publicCopy, type PublicLocale } from "@/lib/public_i18n";
import { TuLectorLogo } from "@/components/TuLectorLogo";

type PublicHeaderProps = {
  locale?: PublicLocale;
};

export function PublicHeader({ locale = "es" }: PublicHeaderProps) {
  const copy = publicCopy[locale].nav;

  return (
    <header className="sticky top-0 z-30 border-b border-[#e6e8eb] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        <TuLectorLogo href={localizedHref("/", locale)} />
        <nav className="hidden items-center gap-7 text-sm font-semibold text-[#4b5563] md:flex">
          <Link href={localizedHref("/scan", locale)} className="hover:text-[#111827]">{copy.scan}</Link>
          <Link href={localizedHref("/sheet", locale)} className="hover:text-[#111827]">{copy.sheet}</Link>
          <Link href={localizedHref("/dashboard", locale)} className="hover:text-[#111827]">{copy.account}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href={localizedHref("/auth", locale)} className="rounded-md px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#f4f5f6]">{copy.login}</Link>
          <Link href={localizedHref("/auth?mode=register", locale)} className="rounded-md bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f2937]">{copy.register}</Link>
        </div>
      </div>
    </header>
  );
}

