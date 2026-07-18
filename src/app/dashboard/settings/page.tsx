import Link from "next/link";
import { headers } from "next/headers";
import { getDashboardContext } from "@/lib/supabase_server";
import { StatusPill } from "@/components/AppShell";
import { updateSchoolSettings } from "@/app/dashboard/actions";
import { countryProfiles } from "@/lib/country_profiles";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DisconnectButton } from "@/components/dashboard/DisconnectButton";
import { DeleteAccountButton } from "@/components/dashboard/DeleteAccountButton";
import { LanguageSwitcher } from "@/components/dashboard/LanguageSwitcher";
import { BiometricToggle } from "@/components/native/BiometricToggle";
import { PortalLinkCard } from "@/components/dashboard/PortalLinkCard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { school, countryProfile, member, user, locale, isAdmin } = await getDashboardContext();
  const email = user.email ?? "usuario@tulector.app";
  const initials = email.slice(0, 2).toUpperCase();
  const isOfficialSchool = !!school.rbd;
  const location = [school.city, school.region].filter(Boolean).join(", ") || "Sin ubicacion registrada";

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  return (
    <>
      <PageHeader title="Configuracion" description="Administra cuenta, institucion y accesos desde un panel simple y funcional." />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <SectionCard title="Cuenta" description="Datos basicos del usuario activo.">
            <div className="flex flex-col gap-4 border-b border-[#e1e5ea] pb-5 sm:flex-row sm:items-center sm:gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#07305f] text-3xl font-semibold text-white sm:h-24 sm:w-24 sm:text-4xl">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold">{email.split("@")[0]}</p>
                <p className="mt-1 break-all text-[#5b6472]">{email}</p>
                <StatusPill>{roleLabel(member.role)}</StatusPill>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <Field label="Correo electronico" value={email} />
              <Field label="Rol en institucion" value={roleLabel(member.role)} />
              <div className="grid gap-2 md:grid-cols-[180px_1fr] md:items-center">
                <span className="text-sm font-semibold text-[#4b5563]">Idioma de cuenta</span>
                <div className="rounded-md border border-[#cfd6df] bg-[#f8fafc] p-3">
                  <LanguageSwitcher locale={locale} />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Institucion" description="Datos que determinan escala de notas, formato local y contexto de trabajo.">
            {isOfficialSchool ? (
              <p className="mb-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-[#1e3a8a]">
                Esta institucion esta vinculada a un registro oficial RBD {school.rbd}. Los datos base quedan bloqueados para evitar desajustes.
              </p>
            ) : null}

            <form action={updateSchoolSettings} className="grid gap-3">
              <FieldInput name="name" label="Nombre" defaultValue={school.name} readOnly={isOfficialSchool || !isAdmin} />
              <FieldInput name="subdomain" label="Subdominio" defaultValue={school.subdomain ?? ""} readOnly={!isAdmin} />
              {countryProfile.code === "CL" && (
                <FieldInput name="rbd" label="RBD" defaultValue={school.rbd ?? ""} readOnly={isOfficialSchool || !isAdmin} />
              )}
              {isOfficialSchool || !isAdmin ? (
                <FieldInput name="region" label={countryProfile.adminDivisionLabel} defaultValue={school.region ?? ""} readOnly />
              ) : (
                <FieldSelect name="region" label={countryProfile.adminDivisionLabel} defaultValue={school.region ?? ""} options={countryProfile.adminDivisions} />
              )}
              <FieldInput name="city" label={countryProfile.localityLabel} defaultValue={school.city ?? ""} readOnly={isOfficialSchool || !isAdmin} />

              <label className="text-sm font-semibold">
                Pais / perfil
                <select
                  name="country_code"
                  defaultValue={countryProfile.code}
                  disabled={isOfficialSchool || !isAdmin}
                  className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal disabled:bg-[#f4f6f8] disabled:text-[#5b6472]"
                >
                  {countryProfiles.map((profile) => (
                    <option key={profile.code} value={profile.code}>
                      {profile.countryName} - {profile.profileName}
                    </option>
                  ))}
                </select>
              </label>

              <ProfileBox profileName={countryProfile.profileName} summary={countryProfile.dashboardSummary} grading={countryProfile.grading.display} />
              <input type="hidden" name="branding_primary_color" value={school.branding_primary_color ?? "#111827"} />
              <input type="hidden" name="timezone" value={school.timezone ?? countryProfile.timezone} />
              <button
                disabled={!isAdmin}
                className="rounded-md border border-[#07305f] px-4 py-2 text-sm font-semibold text-[#07305f] hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAdmin ? "Guardar institucion" : "Solo administradores pueden guardar"}
              </button>
            </form>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Resumen operativo" description="Accesos rapidos a las areas que ya existen en TuLector.">
            <div className="grid gap-3">
              <SummaryRow label="Colegio activo" value={school.name} />
              <SummaryRow label="Ubicacion" value={location} />
              <SummaryRow label="Plan" value={school.plan} />
              <SummaryRow label="Perfil pais" value={countryProfile.profileName} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {school.plan === "school" ? <ActionLink href="/dashboard/team" label="Gestionar equipo" description={isAdmin ? "Roles e invitaciones" : "Ver equipo"} /> : null}
              <ActionLink href="/dashboard/billing" label="Plan y compras" description="Cuota e historial" />
              <ActionLink href="/app" label="Abrir app movil" description="Escanear y revisar" />
              <ActionLink href="/support" label="Soporte" description="Ayuda y contacto" />
            </div>
          </SectionCard>

          <SectionCard title="Portal de apoderados" description="Las familias pueden crear su propio acceso para ver el historial completo de resultados.">
            <PortalLinkCard baseUrl={baseUrl} />
          </SectionCard>

          <SectionCard title="Seguridad" description="Acciones disponibles hoy para controlar acceso y cuenta.">
            <div className="grid gap-3">
              <div className="rounded-md border border-[#e1e5ea] bg-[#f8fafc] p-3">
                <BiometricToggle />
              </div>
              <InfoPanel title="Acceso" body="La autenticacion se gestiona con Supabase Auth. Usa cerrar sesion desde el menu de usuario o desde la app movil cuando cambies de dispositivo." />
              <InfoPanel title="Proximas mejoras" body="2FA y administracion de sesiones deben implementarse solo cuando exista backend real para evitar botones decorativos." />
            </div>
          </SectionCard>

          <DangerCard title="Desvincular o cambiar colegio" body="Perderas acceso inmediato a los ensayos, alumnos y reportes de esta institucion. Podras seleccionar o crear otro colegio despues.">
            <DisconnectButton />
          </DangerCard>

          <DangerCard title="Eliminar cuenta" body="Elimina tu perfil y acceso a TuLector de forma permanente. Los datos del colegio no se borran.">
            <DeleteAccountButton />
          </DangerCard>
        </div>
      </div>
    </>
  );
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-[#d8dde3] bg-white p-5">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-[#111827]">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-[#5b6472]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DangerCard({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-red-200 bg-red-50/30 p-5">
      <h2 className="text-xl font-semibold text-red-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-red-800">{body}</p>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 md:grid-cols-[180px_1fr] md:items-center">
      <span className="text-sm font-semibold text-[#4b5563]">{label}</span>
      <div className="rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-sm">{value}</div>
    </div>
  );
}

function FieldInput({ name, label, defaultValue, readOnly }: { name: string; label: string; defaultValue: string; readOnly: boolean }) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        readOnly={readOnly}
        className={`mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal ${readOnly ? "cursor-not-allowed bg-[#f4f6f8] text-[#5b6472]" : "bg-white text-[#0b1220]"}`}
      />
    </label>
  );
}

function FieldSelect({ name, label, defaultValue, options }: { name: string; label: string; defaultValue: string; options: readonly string[] }) {
  // Si el valor ya guardado (ej. via el buscador de colegios de Chile, con
  // el nombre oficial exacto de la tabla comunas) no calza con ninguna
  // opcion de la lista fija, se agrega como opcion extra -- evita que el
  // select "pierda" silenciosamente un valor real ya guardado.
  const hasUnknownValue = Boolean(defaultValue) && !options.includes(defaultValue);
  return (
    <label className="text-sm font-semibold">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal text-[#0b1220]"
      >
        <option value="">Selecciona {label.toLowerCase()}</option>
        {hasUnknownValue && <option value={defaultValue}>{defaultValue}</option>}
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ProfileBox({ profileName, summary, grading }: { profileName: string; summary: string; grading: string }) {
  return (
    <div className="rounded-md border border-[#e1e5ea] bg-[#f8fafc] p-3 text-sm">
      <p className="font-semibold text-[#111827]">{profileName}</p>
      <p className="mt-1 leading-5 text-[#5b6472]">{summary}</p>
      <p className="mt-2 font-semibold text-[#07305f]">{grading}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-[#e1e5ea] bg-[#f8fafc] p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-[#4b5563]">{label}</span>
      <span className="text-sm font-semibold text-[#111827]">{value}</span>
    </div>
  );
}

function ActionLink({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link href={href} className="rounded-md border border-[#d8dde3] bg-white p-3 transition hover:border-[#07305f] hover:bg-[#eef4ff]">
      <span className="block text-sm font-semibold text-[#07305f]">{label}</span>
      <span className="mt-1 block text-xs text-[#5b6472]">{description}</span>
    </Link>
  );
}

function InfoPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-[#e1e5ea] bg-[#f8fafc] p-3">
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[#5b6472]">{body}</p>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "teacher") return "Profesor";
  if (role === "viewer") return "Observador";
  return role;
}
