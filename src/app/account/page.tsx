const navItems = [
  "Panel",
  "Ensayos",
  "Cursos",
  "Alumnos",
  "Escanear",
  "Resultados",
  "Analisis",
  "Escalas",
  "Exportar",
  "Configuracion",
];

const sessions = [
  { device: "Android - Camara principal", location: "Santiago, CL", status: "Sincronizado hace 4 min" },
  { device: "Chrome - Windows", location: "Santiago, CL", status: "Sesion actual" },
];

const permissions = [
  "Administrar ensayos",
  "Escanear hojas",
  "Editar alumnos",
  "Exportar resultados",
  "Configurar escalas",
];

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#111827]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-[#e2e6ea] bg-white px-5 py-5 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-[#e2e6ea] pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#123a5a] text-sm font-bold text-white">
              TL
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">TuLector</p>
              <p className="text-xs text-[#6b7280]">Evaluacion y analisis</p>
            </div>
          </div>

          <nav className="mt-5 space-y-1">
            {navItems.map((item) => (
              <a
                key={item}
                href="#"
                className={`flex h-10 items-center rounded-md px-3 text-sm font-medium transition ${
                  item === "Configuracion"
                    ? "bg-[#edf4f8] text-[#123a5a]"
                    : "text-[#4b5563] hover:bg-[#f6f7f9] hover:text-[#111827]"
                }`}
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="mt-auto rounded-md border border-[#e2e6ea] bg-[#f6f7f9] p-4">
            <p className="text-sm font-semibold">Colegio Pro</p>
            <p className="mt-1 text-xs leading-5 text-[#6b7280]">
              1.240 hojas escaneadas este mes. Datos protegidos por institucion.
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-[#e2e6ea] bg-white/95 px-4 py-3 backdrop-blur md:px-8">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#123a5a] text-sm font-bold text-white lg:hidden">
                  TL
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">Institucion activa</p>
                  <button className="mt-1 rounded-md border border-[#e2e6ea] bg-white px-3 py-2 text-left text-sm font-semibold text-[#111827]">
                    Preuniversitario Los Andes
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="hidden min-w-72 rounded-md border border-[#e2e6ea] bg-[#f6f7f9] px-3 py-2 text-sm text-[#6b7280] md:block">
                  Buscar alumnos, ensayos o resultados
                </label>
                <button className="h-10 rounded-md border border-[#e2e6ea] bg-white px-3 text-sm font-semibold text-[#4b5563]">
                  Alertas
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#168a5b] text-sm font-bold text-white">
                  MP
                </div>
              </div>
            </div>
          </header>

          <div className="px-4 py-8 md:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="flex flex-col gap-4 border-b border-[#e2e6ea] pb-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#123a5a]">Configuracion</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#111827]">Cuenta de usuario</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4b5563]">
                    Administra tu perfil, seguridad, permisos institucionales y sincronizacion con la app movil de lectura.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-md border border-[#e2e6ea] bg-white px-4 py-2 text-sm font-semibold text-[#4b5563]">
                    Cancelar
                  </button>
                  <button className="rounded-md bg-[#123a5a] px-4 py-2 text-sm font-semibold text-white">
                    Guardar cambios
                  </button>
                </div>
              </div>

              <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-6">
                  <section className="rounded-md border border-[#e2e6ea] bg-white">
                    <div className="border-b border-[#e2e6ea] px-6 py-5">
                      <h2 className="text-lg font-semibold">Perfil</h2>
                      <p className="mt-1 text-sm text-[#6b7280]">Informacion visible para tu institucion y reportes administrativos.</p>
                    </div>
                    <div className="grid gap-6 p-6 md:grid-cols-[180px_minmax(0,1fr)]">
                      <div>
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#edf4f8] text-2xl font-bold text-[#123a5a]">
                          MP
                        </div>
                        <button className="mt-4 rounded-md border border-[#e2e6ea] bg-white px-3 py-2 text-sm font-semibold text-[#4b5563]">
                          Cambiar foto
                        </button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Nombre completo" value="Maria Paz Rojas" />
                        <Field label="Correo" value="maria.rojas@losandes.cl" />
                        <Field label="Telefono" value="+56 9 8421 1830" />
                        <Field label="Rol principal" value="Administradora" />
                        <Field label="Pais" value="Chile" />
                        <Field label="Idioma" value="Espanol" />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-md border border-[#e2e6ea] bg-white">
                    <div className="border-b border-[#e2e6ea] px-6 py-5">
                      <h2 className="text-lg font-semibold">Seguridad</h2>
                      <p className="mt-1 text-sm text-[#6b7280]">Control de acceso para web, app movil y exportaciones.</p>
                    </div>
                    <div className="divide-y divide-[#e2e6ea]">
                      <SecurityRow title="Contrasena" detail="Actualizada hace 23 dias" action="Cambiar" />
                      <SecurityRow title="Verificacion en dos pasos" detail="Recomendada para cuentas administrativas" action="Activar" positive />
                      <SecurityRow title="Descarga de datos" detail="Exporta resultados y auditoria de actividad" action="Solicitar" />
                    </div>
                  </section>

                  <section className="rounded-md border border-[#e2e6ea] bg-white">
                    <div className="border-b border-[#e2e6ea] px-6 py-5">
                      <h2 className="text-lg font-semibold">Sesiones activas</h2>
                      <p className="mt-1 text-sm text-[#6b7280]">Dispositivos conectados a esta cuenta.</p>
                    </div>
                    <div className="divide-y divide-[#e2e6ea]">
                      {sessions.map((session) => (
                        <div key={session.device} className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold">{session.device}</p>
                            <p className="mt-1 text-sm text-[#6b7280]">{session.location}</p>
                          </div>
                          <span className="w-fit rounded-full bg-[#eaf7f1] px-3 py-1 text-xs font-semibold text-[#168a5b]">
                            {session.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <aside className="space-y-6">
                  <section className="rounded-md border border-[#e2e6ea] bg-white p-6">
                    <h2 className="text-lg font-semibold">Institucion</h2>
                    <div className="mt-5 flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-[#b8c2cc] bg-[#f6f7f9] text-xs font-semibold text-[#6b7280]">
                        Logo
                      </div>
                      <div>
                        <p className="font-semibold">Preuniversitario Los Andes</p>
                        <p className="mt-1 text-sm text-[#6b7280]">Plan Colegio Pro</p>
                      </div>
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <Metric label="Cursos" value="18" />
                      <Metric label="Alumnos" value="742" />
                      <Metric label="Ensayos" value="46" />
                      <Metric label="Escaneos" value="8.420" />
                    </dl>
                  </section>

                  <section className="rounded-md border border-[#e2e6ea] bg-white p-6">
                    <h2 className="text-lg font-semibold">Permisos</h2>
                    <div className="mt-4 space-y-2">
                      {permissions.map((permission) => (
                        <div key={permission} className="flex items-center justify-between rounded-md border border-[#e2e6ea] px-3 py-2">
                          <span className="text-sm text-[#4b5563]">{permission}</span>
                          <span className="rounded-full bg-[#eaf7f1] px-2 py-1 text-xs font-semibold text-[#168a5b]">Activo</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-md border border-[#e2e6ea] bg-white p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold">Sincronizacion movil</h2>
                        <p className="mt-1 text-sm leading-6 text-[#6b7280]">
                          La app de lectura comparte ensayos, cursos, alumnos y resultados con esta cuenta.
                        </p>
                      </div>
                      <span className="rounded-full bg-[#eaf7f1] px-3 py-1 text-xs font-semibold text-[#168a5b]">Conectada</span>
                    </div>
                    <button className="mt-5 w-full rounded-md border border-[#c62828] bg-white px-4 py-2 text-sm font-semibold text-[#c62828]">
                      Cerrar sesion en dispositivos
                    </button>
                  </section>
                </aside>
              </div>
            </div>
          </div>

          <footer className="mt-auto border-t border-[#e2e6ea] bg-white px-4 py-5 text-sm text-[#6b7280] md:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p>TuLector - Plataforma independiente de correccion y analisis educativo.</p>
              <div className="flex flex-wrap gap-4">
                <a href="#" className="hover:text-[#123a5a]">Privacidad</a>
                <a href="#" className="hover:text-[#123a5a]">Terminos</a>
                <a href="#" className="hover:text-[#123a5a]">Soporte</a>
                <a href="#" className="hover:text-[#123a5a]">Seguridad</a>
              </div>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">{label}</span>
      <span className="mt-1 block rounded-md border border-[#e2e6ea] bg-[#fdfdfd] px-3 py-2 text-sm text-[#111827]">
        {value}
      </span>
    </label>
  );
}

function SecurityRow({ title, detail, action, positive = false }: { title: string; detail: string; action: string; positive?: boolean }) {
  return (
    <div className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm text-[#6b7280]">{detail}</p>
      </div>
      <button className={`w-fit rounded-md px-3 py-2 text-sm font-semibold ${positive ? "bg-[#123a5a] text-white" : "border border-[#e2e6ea] bg-white text-[#4b5563]"}`}>
        {action}
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e2e6ea] bg-[#f6f7f9] p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-[#111827]">{value}</dd>
    </div>
  );
}
