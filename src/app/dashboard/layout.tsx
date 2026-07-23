import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { DashboardLayoutShell } from "@/components/dashboard/DashboardLayoutShell";
import { stopImpersonation } from "@/app/admin/actions";
import { isNativeAllowedDashboardPath } from "@/lib/native/routes";
import { NativeDashboardGuard } from "@/components/native/NativeDashboardGuard";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Read pathname from middleware header
  const headersList = await headers();

  // App nativa (Capacitor): el dashboard de escritorio (menu/tablas densas) no
  // aplica → al menu propio /app (Escanear, Resultados, Alumnos, Mi plan; ver
  // /app/scan, /app/results, /app/students). Se detecta por el token del
  // User-Agent (appendUserAgent) en el SERVIDOR → sin flash. EXCEPCIONES
  // explicitas — paginas de escritorio a las que SI se permite entrar como
  // fallback de acciones avanzadas que las pantallas nativas no cubren:
  //  - /dashboard/quizzes: editar/duplicar/archivar ensayos (no hay UI nativa
  //    para eso todavia).
  //  - /dashboard/students: crear/editar cursos e importar CSV (la pantalla
  //    nativa /app/students solo busca y agrega un alumno rapido).
  //  - /dashboard/settings: configuracion avanzada, enlazada desde
  //    /app/configuracion cuando el usuario necesita editar datos completos.
  //  - /dashboard/billing: la propia pagina renderiza una vista de solo
  //    lectura en nativo (sin el checkout de Flow) — ver docs/apk-plan.md
  //    sobre por que el pago NUNCA se hace dentro del APK (reglas de
  //    Apple/Google sobre compras de contenido digital in-app).
  //  - /dashboard/onboarding: usuario nativo sin colegio aun (recien
  //    registrado desde el APK). getDashboardContext() SIEMPRE redirige aca
  //    cuando falta membership; si esta ruta no esta permitida, el usuario
  //    rebota /app -> onboarding -> /app en loop infinito y ve pantalla en
  //    blanco para siempre (no hay forma de completar el registro nativo).
  const ua = headersList.get("user-agent") ?? "";
  const pathname = headersList.get("x-pathname") ?? "";
  if (/TuLectorApp/i.test(ua) && !isNativeAllowedDashboardPath(pathname)) {
    redirect("/app");
  }

  // Skip the shell for the onboarding page — it has its own full-page layout.
  // Also skip if pathname is empty (fallback).
  if (pathname.includes("/onboarding") || !pathname) {
    // NativeDashboardGuard: cinturon client-side para APK viejos que no
    // mandan el token TuLectorApp en el User-Agent (ver componente). En web
    // es no-op (isNativeApp() da false); no afecta a nadie mas.
    return (
      <>
        <NativeDashboardGuard />
        {children}
      </>
    );
  }

  // For all other dashboard pages, load context for the persistent shell.
  // Note: getDashboardContext() may call redirect() which throws and propagates
  // automatically — we don't catch it here.
  const { school, user, locale, userSchools, supabase, isImpersonating } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const email = user.email ?? "TL";
  const userInitials = email.slice(0, 2).toUpperCase();

  // Notificaciones reales: hojas escaneadas que quedaron para revisión manual.
  const { count: pendingReview } = await supabase
    .from("papers")
    .select("id", { count: "exact", head: true })
    .eq("school_id", school.id)
    .eq("status", "manual_review");

  const nav = [
    { href: "/dashboard", label: "Resumen" },
    { href: "/dashboard/students", label: "Gestión de alumnos" },
    { href: "/dashboard/courses", label: "Cursos" },
    { href: "/dashboard/quizzes", label: "Ensayos" },
    { href: "/dashboard/papers", label: t.papers },
    ...(school.plan === "school" ? [{ href: "/dashboard/team", label: t.team }] : []),
    { href: "/dashboard/billing", label: t.billing },
    { href: "/dashboard/settings", label: t.settings },
  ];

  return (
    <DashboardLayoutShell
      nav={nav}
      organizationName={school.name}
      userInitials={userInitials}
      userName={email.split("@")[0]}
      userSchools={userSchools}
      activeSchoolId={school.id}
      notifCount={pendingReview ?? 0}
    >
      <NativeDashboardGuard />
      {isImpersonating ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <span>
            Estás viendo <strong>{school.name}</strong> como staff (impersonación). Los datos que ves no son de tu colegio.
          </span>
          <form action={stopImpersonation}>
            <button type="submit" className="shrink-0 rounded-md border border-amber-400 bg-white px-3 py-1 font-medium text-amber-900 hover:bg-amber-100">
              Salir
            </button>
          </form>
        </div>
      ) : null}
      {children}
    </DashboardLayoutShell>
  );
}
