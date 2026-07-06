import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { SignOutButton } from "@/components/native/SignOutButton";
import { BiometricToggle } from "@/components/native/BiometricToggle";
import { LanguageSwitcher } from "@/components/dashboard/LanguageSwitcher";
import { DisconnectButton } from "@/components/dashboard/DisconnectButton";
import { DeleteAccountButton } from "@/components/dashboard/DeleteAccountButton";
import { APP_VERSION } from "@/lib/version";

/**
 * Configuración nativa del APK (no la del dashboard web /dashboard/settings).
 * Solo lo que tiene sentido dentro de la app: seguridad (huella), idioma,
 * cerrar sesion, version, y las acciones de cuenta que exigen Apple/Google
 * (desvincular / eliminar cuenta) para que sigan accesibles desde el APK.
 */
export default async function NativeSettingsPage() {
  const { user, school, member, locale } = await getDashboardContext();

  return (
    <main className="min-h-dvh bg-[#f5f6f8] pb-24 text-[#0b1220]">
      <header className="safe-pt flex items-center gap-3 bg-[#111827] px-5 pb-5 pt-5 text-white">
        <Link href="/app" aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <h1 className="text-lg font-black tracking-tight">Configuración</h1>
      </header>

      <section className="space-y-4 px-5 py-6">
        <div className="rounded-2xl border border-[#e6e8eb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Cuenta</p>
          <p className="mt-2 text-sm font-semibold text-[#111827]">{user.email}</p>
          <p className="mt-0.5 text-xs text-[#5b6472]">
            Rol {member.role === "admin" ? "administradora" : member.role} · {school.name}
          </p>
          <div className="mt-4 border-t border-[#e6e8eb] pt-4">
            <LanguageSwitcher locale={locale} />
          </div>
          <div className="mt-4 border-t border-[#e6e8eb] pt-4">
            <SignOutButton className="text-sm font-semibold text-[#07305f]" />
          </div>
        </div>

        <div className="rounded-2xl border border-[#e6e8eb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Seguridad</p>
          <div className="mt-3">
            <BiometricToggle />
          </div>
        </div>

        <div className="rounded-2xl border border-[#e6e8eb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Suscripción</p>
          <p className="mt-2 text-sm text-[#111827]">Plan {school.plan}</p>
          <Link href="/dashboard/billing" className="mt-2 inline-block text-sm font-semibold text-[#07305f]">
            Gestionar desde un navegador →
          </Link>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700">Zona de riesgo</p>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-red-950">Desvincular colegio</p>
              <p className="mt-1 text-xs leading-relaxed text-red-800">Pierdes el acceso inmediato a los ensayos y alumnos de esta institución.</p>
              <div className="mt-2"><DisconnectButton /></div>
            </div>
            <div className="border-t border-red-200 pt-3">
              <p className="text-sm font-semibold text-red-950">Eliminar cuenta</p>
              <p className="mt-1 text-xs leading-relaxed text-red-800">Elimina tu perfil de forma permanente. Los datos del colegio no se borran.</p>
              <div className="mt-2"><DeleteAccountButton /></div>
            </div>
          </div>
        </div>

        <p className="pt-2 text-center text-xs font-semibold tracking-wide text-[#9aa3af]">TuLector · versión {APP_VERSION}</p>
      </section>
    </main>
  );
}
