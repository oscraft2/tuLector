import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { LanguageSwitcher } from "@/components/dashboard/LanguageSwitcher";
import { DeleteAccountButton } from "@/components/dashboard/DeleteAccountButton";
import { SignOutButton } from "@/components/native/SignOutButton";
import { BiometricToggle } from "@/components/native/BiometricToggle";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

export default async function NativeSettingsPage() {
  const { user, school, countryProfile, member, locale } = await getDashboardContext();
  const email = user.email ?? "usuario@tulector.app";

  return (
    <main className="min-h-dvh bg-[#f5f6f8] pb-28 text-[#0b1220]">
      <header className="safe-pt bg-[#111827] px-5 pb-5 pt-5 text-white">
        <div className="flex items-center gap-3">
          <Link href="/app" aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">TuLector</p>
            <h1 className="text-lg font-black tracking-tight">Configuracion</h1>
          </div>
        </div>
      </header>

      <section className="space-y-5 px-5 py-6">
        <NativeCard title="Cuenta" description="Datos del usuario activo en esta app.">
          <div className="grid gap-3">
            <NativeRow label="Correo" value={email} />
            <NativeRow label="Rol" value={roleLabel(member.role)} />
            <div className="rounded-2xl border border-[#e6e8eb] bg-[#f8fafc] p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#64748b]">Idioma</p>
              <LanguageSwitcher locale={locale} />
            </div>
          </div>
        </NativeCard>

        <NativeCard title="Seguridad" description="Acceso rapido con biometria en este dispositivo.">
          <BiometricToggle />
        </NativeCard>

        <NativeCard title="Institucion" description="Contexto usado para ensayos, alumnos y resultados.">
          <div className="grid gap-3">
            <NativeRow label="Colegio" value={school.name} />
            <NativeRow label="Plan" value={school.plan} />
            <NativeRow label="Perfil" value={countryProfile.profileName} />
            <NativeRow label="Notas" value={countryProfile.grading.display} />
          </div>
          <Link href="/dashboard/settings" className="mt-4 block rounded-2xl border border-[#07305f] px-4 py-3 text-center text-sm font-bold text-[#07305f] active:bg-[#eef4ff]">
            Configuracion avanzada
          </Link>
        </NativeCard>

        <NativeCard title="Acceso" description="Acciones rapidas para este dispositivo.">
          <div className="grid gap-3">
            <SignOutButton className="rounded-2xl border border-[#d8dde3] bg-white px-4 py-3 text-sm font-bold text-[#07305f] active:bg-[#eef4ff]" />
            <Link href="/support" className="rounded-2xl border border-[#d8dde3] bg-white px-4 py-3 text-center text-sm font-bold text-[#07305f] active:bg-[#eef4ff]">
              Soporte
            </Link>
          </div>
        </NativeCard>

        <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <h2 className="text-base font-black text-red-950">Eliminar cuenta</h2>
          <p className="mt-2 text-sm leading-6 text-red-800">
            Elimina tu perfil y acceso a TuLector. Los datos de la institucion no se borran.
          </p>
          <DeleteAccountButton />
        </section>

        <p className="pt-1 text-center text-xs font-semibold tracking-wide text-[#9aa3af]">TuLector version {APP_VERSION}</p>
      </section>
    </main>
  );
}

function NativeCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e6e8eb] bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-[#111827]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[#5b6472]">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function NativeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e6e8eb] bg-[#f8fafc] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748b]">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-[#111827]">{value}</p>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "teacher") return "Profesor";
  if (role === "viewer") return "Observador";
  return role;
}
