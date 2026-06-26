import Link from "next/link";

const nav = [
  { href: "/#producto", label: "Producto" },
  { href: "/#analisis", label: "Analisis" },
  { href: "/#puntajes", label: "Puntajes" },
  { href: "/#seguridad", label: "Seguridad" },
];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#e2e6ea] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#123a5a] text-sm font-bold text-white">
            TL
          </span>
          <span>
            <span className="block text-lg font-semibold tracking-tight text-[#111827]">TuLector</span>
            <span className="hidden text-xs text-[#6b7280] sm:block">Correccion y analisis educativo</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-[#4b5563] lg:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[#123a5a]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/auth"
            className="hidden rounded-md border border-[#e2e6ea] bg-white px-4 py-2 text-sm font-semibold text-[#4b5563] hover:border-[#123a5a] hover:text-[#123a5a] sm:inline-flex"
          >
            Iniciar sesion
          </Link>
          <Link
            href="/auth?mode=register"
            className="rounded-md bg-[#123a5a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e304b]"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}
