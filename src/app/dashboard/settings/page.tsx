import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { DashboardShell } from "@/components/dashboard/DashboardNav";
import { StatusPill } from "@/components/AppShell";
import { updateSchoolSettings } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { school, member, user, locale, isAdmin } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const email = user.email ?? "usuario@tulector.cl";
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <DashboardShell locale={locale} title="Cuenta de usuario" description="Administra tu perfil, seguridad y preferencias" organizationName={school.name} userInitials={initials}>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="rounded-md border border-[#d8dde3] bg-white p-5">
            <div className="mb-6 flex items-start justify-between"><h2 className="text-xl font-semibold">Perfil</h2><button className="rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold text-[#07305f]">Editar perfil</button></div>
            <div className="flex items-center gap-5 border-b border-[#e1e5ea] pb-5"><div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#07305f] text-4xl font-semibold text-white">{initials}</div><div><p className="text-xl font-semibold">{email.split("@")[0]}</p><p className="mt-1 text-[#5b6472]">{email}</p><StatusPill>{member.role === "admin" ? "Administradora" : member.role}</StatusPill></div></div>
            <div className="mt-5 grid gap-3"><Field label="Correo electronico" value={email} /><Field label="Pais" value={school.country_code ?? "CL"} /><Field label="Idioma" value={locale} /></div>
          </section>
          <section className="rounded-md border border-[#d8dde3] bg-white p-5"><h2 className="text-xl font-semibold">Seguridad</h2><div className="mt-4 divide-y divide-[#e1e5ea]"><Row label="Contrasena" value="••••••••••••••" action="Cambiar contrasena" /><Row label="Autenticacion en dos pasos (2FA)" value="Pendiente" action="Configurar" /><Row label="Sesiones activas" value="Gestiona dispositivos conectados" action="Ver sesiones" /></div></section>
        </div>
        <div className="space-y-6">
          <section className="rounded-md border border-[#d8dde3] bg-white p-5"><h2 className="text-xl font-semibold">Institucion</h2><form action={updateSchoolSettings} className="mt-5 grid gap-3"><FieldInput name="name" label="Nombre" defaultValue={school.name} disabled={!isAdmin} /><FieldInput name="subdomain" label="Subdominio" defaultValue={school.subdomain ?? ""} disabled={!isAdmin} /><FieldInput name="region" label="Region" defaultValue={school.region ?? ""} disabled={!isAdmin} /><FieldInput name="city" label="Ciudad" defaultValue={school.city ?? ""} disabled={!isAdmin} /><label className="text-sm font-semibold">Pais<select name="country_code" defaultValue={school.country_code ?? "CL"} disabled={!isAdmin} className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal"><option value="CL">Chile</option><option value="BR">Brasil</option><option value="US">Internacional</option></select></label><input type="hidden" name="branding_primary_color" value={school.branding_primary_color ?? "#111827"} /><input type="hidden" name="timezone" value={school.timezone ?? "America/Santiago"} /><button disabled={!isAdmin} className="rounded-md border border-[#07305f] px-4 py-2 text-sm font-semibold text-[#07305f] disabled:opacity-50">Ver configuracion de la institucion</button></form></section>
          <section className="rounded-md border border-[#d8dde3] bg-white p-5"><h2 className="text-xl font-semibold">Permisos</h2><div className="mt-4 space-y-4"><p>Rol principal <StatusPill>{member.role}</StatusPill></p><button className="w-full rounded-md border border-[#07305f] px-4 py-2 text-sm font-semibold text-[#07305f]">Gestionar roles y permisos</button></div></section>
          <section className="rounded-md border border-[#d8dde3] bg-white p-5"><h2 className="text-xl font-semibold">Sincronizacion movil</h2><div className="mt-4 flex gap-4"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#22a05a] text-white">✓</span><div><p className="font-semibold text-[#087a36]">Conectado a la app TuLector</p><p className="mt-2 text-sm text-[#5b6472]">Ultima sincronizacion: pendiente de evento real</p></div></div><button className="mt-6 w-full rounded-md border border-[#ef4444] px-4 py-2 text-sm font-semibold text-[#dc2626]">Cerrar sesion en dispositivos</button></section>
        </div>
      </div>
    </DashboardShell>
  );
}

function Field({ label, value }: { label: string; value: string }) { return <div className="grid gap-2 md:grid-cols-[180px_1fr]"><span className="text-sm">{label}</span><div className="rounded-md border border-[#cfd6df] px-3 py-2 text-sm">{value}</div></div>; }
function FieldInput({ name, label, defaultValue, disabled }: { name: string; label: string; defaultValue: string; disabled: boolean }) { return <label className="text-sm font-semibold">{label}<input name={name} defaultValue={defaultValue} disabled={disabled} className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal disabled:bg-[#f4f6f8]" /></label>; }
function Row({ label, value, action }: { label: string; value: string; action: string }) { return <div className="flex items-center justify-between gap-3 py-4"><div><p className="text-sm font-medium">{label}</p><p className="mt-1 text-sm text-[#5b6472]">{value}</p></div><button className="rounded-md border border-[#9aa8ba] px-4 py-2 text-sm font-semibold text-[#07305f]">{action}</button></div>; }

