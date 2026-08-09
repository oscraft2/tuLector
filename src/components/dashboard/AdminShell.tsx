/**
 * El chrome (sidebar/header/footer) vive en AdminLayoutShell.tsx, montado una
 * sola vez desde src/app/admin/layout.tsx -- este componente ahora solo
 * pinta el encabezado de cada pagina (eyebrow/titulo/descripcion) y el
 * contenido. `active` ya no se usa (el nav resalta solo via usePathname en
 * el layout persistente) pero se deja en el tipo para no tener que tocar
 * los 14 call sites que todavia lo pasan.
 */
export function AdminShell({ title, description, children }: { title: string; description: string; active?: string; children: React.ReactNode }) {
  return (
    <>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">TuLector Platform</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b6472]">{description}</p>
      </div>
      {children}
    </>
  );
}
