import Link from "next/link";

const groups = [
  {
    title: "Producto",
    links: [
      { href: "/#producto", label: "Ensayos" },
      { href: "/#analisis", label: "Analisis" },
      { href: "/#puntajes", label: "Puntajes equivalentes" },
      { href: "/scan", label: "Escaner" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { href: "/auth", label: "Iniciar sesion" },
      { href: "/auth?mode=register", label: "Crear cuenta" },
      { href: "/account", label: "Cuenta de usuario" },
      { href: "/settings", label: "Configuracion" },
    ],
  },
  {
    title: "Confianza",
    links: [
      { href: "/security", label: "Seguridad" },
      { href: "/privacy", label: "Privacidad" },
      { href: "/terms", label: "Terminos" },
      { href: "/support", label: "Soporte" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-[#e2e6ea] bg-white text-[#4b5563]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.35fr_repeat(3,1fr)] md:px-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#123a5a] text-sm font-bold text-white">
              TL
            </span>
            <div>
              <p className="text-lg font-semibold text-[#111827]">TuLector</p>
              <p className="text-sm text-[#6b7280]">Plataforma independiente para correccion y analisis educativo.</p>
            </div>
          </div>
          <p className="mt-5 max-w-md text-sm leading-6">
            Diseñado para profesores, colegios y preuniversitarios que necesitan leer hojas de respuesta, administrar ensayos,
            analizar resultados y convertir puntajes con trazabilidad.
          </p>
          <p className="mt-4 text-xs leading-5 text-[#6b7280]">
            TuLector no representa ni declara afiliacion oficial con organismos publicos o evaluadores externos. Las instituciones
            pueden configurar sus propios logos, escalas y reportes.
          </p>
        </div>

        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#111827]">{group.title}</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-[#123a5a]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-[#e2e6ea]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-[#6b7280] md:flex-row md:items-center md:justify-between md:px-8">
          <p>(c) 2026 TuLector. Todos los derechos reservados.</p>
          <p>Hecho para el contexto educativo chileno, preparado para LATAM y Brasil.</p>
        </div>
      </div>
    </footer>
  );
}
