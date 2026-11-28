import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { DashboardLayoutShell } from "@/components/dashboard/DashboardLayoutShell";
import { stopImpersonation } from "@/app/admin/actions";
import { isNativeAllowedDashboardPath } from "@/lib/native/routes";
import { NativeDashboardGuard } from "@/components/native/NativeDashboardGuard";
import { DiaCierreNotice, type DiaNoticePreset } from "@/components/dashboard/DiaCierreNotice";
import { DIA_PRESETS } from "@/lib/dia_presets";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();

  // App nativa (Capacitor): el dashboard de escritorio (menu/tablas densas) no
  // aplica → al menu propio /app, salvo las rutas explicitas permitidas.
  const ua = headersList.get("user-agent") ?? "";
  const pathname = headersList.get("x-pathname") ?? "";
  if (/TuLectorApp/i.test(ua) && !isNativeAllowedDashboardPath(pathname)) {
    redirect("/app");
  }

  if (pathname.includes("/onboarding") || !pathname) {
    return (
      <>
        <NativeDashboardGuard />
        {children}
      </>
    );
  }

  const { school, user, member, locale, userSchools, isImpersonating } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const email = user.email ?? "TL";
  const userInitials = email.slice(0, 2).toUpperCase();
  const isChile = (school.country_code ?? "CL") === "CL";
  const cierrePresets: DiaNoticePreset[] = isChile
    ? DIA_PRESETS.filter((p) => p.stage === "cierre").map(({ id, label, numQuestions, pdfUrl, fichaUrl }) => ({
        id,
        label,
        numQuestions,
        pdfUrl,
        fichaUrl,
      }))
    : [];

  const nav = [
    { href: "/dashboard", label: "Resumen" },
    { href: "/dashboard/students", label: "Gestión de alumnos" },
    { href: "/dashboard/courses", label: "Cursos" },
    { href: "/dashboard/quizzes", label: "Ensayos" },
    ...(school.plan === "school" ? [{ href: "/dashboard/quizzes/compartidos", label: "Compartidos" }] : []),
    { href: "/dashboard/papers", label: t.papers },
    { href: "/dashboard/billing", label: t.billing },
    { href: "/dashboard/settings", label: t.settings },
    { href: "/dashboard/support", label: "Soporte" },
  ];

  return (
    <DashboardLayoutShell
      nav={nav}
      organizationName={school.name}
      userInitials={userInitials}
      userName={email.split("@")[0]}
      userRole={member.role}
      userSchools={userSchools}
      activeSchoolId={school.id}
    >
      <NativeDashboardGuard />
      {isImpersonating ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <span>
            Estás viendo <strong>{school.name}</strong> como staff (impersonación). Los datos que ves no son de tu colegio.
          </span>
          <form action={stopImpersonation}>
            <button type="submit" className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1 font-medium text-amber-900 hover:bg-amber-100">
              Salir
            </button>
          </form>
        </div>
      ) : null}
      {isChile && cierrePresets.length > 0 ? <DiaCierreNotice presets={cierrePresets} /> : null}
      {children}
    </DashboardLayoutShell>
  );
}
