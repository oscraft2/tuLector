import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { DashboardLayoutShell } from "@/components/dashboard/DashboardLayoutShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Read pathname from middleware header
  const headersList = await headers();

  // App nativa (Capacitor): la mayoria del dashboard web no aplica → al menú
  // /app. Se detecta por el token del User-Agent (appendUserAgent) en el
  // SERVIDOR → sin flash ni cargar el dashboard. EXCEPCIONES explicitas:
  //  - /dashboard/quizzes: paso intermedio de "Lector Prueba" (elegir ensayo →
  //    boton Escanear → /scan). Sin esto el boton del menu nativo no lleva a
  //    ningun lado (redirige de vuelta a /app).
  //  - /dashboard/billing: se permite, pero la propia pagina renderiza una
  //    vista de solo lectura en nativo (sin el checkout de Flow) — ver
  //    docs/apk-plan.md sobre por que el pago NUNCA se hace dentro del APK
  //    (reglas de Apple/Google sobre compras de contenido digital in-app).
  const ua = headersList.get("user-agent") ?? "";
  const pathname = headersList.get("x-pathname") ?? "";
  const nativeAllowedPrefixes = ["/dashboard/quizzes", "/dashboard/billing"];
  if (/TuLectorApp/i.test(ua) && !nativeAllowedPrefixes.some((p) => pathname.startsWith(p))) {
    redirect("/app");
  }

  // Skip the shell for the onboarding page — it has its own full-page layout.
  // Also skip if pathname is empty (fallback).
  if (pathname.includes("/onboarding") || !pathname) {
    return <>{children}</>;
  }

  // For all other dashboard pages, load context for the persistent shell.
  // Note: getDashboardContext() may call redirect() which throws and propagates
  // automatically — we don't catch it here.
  const { school, user, locale, userSchools, supabase } = await getDashboardContext();
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
    { href: "/dashboard/team", label: t.team },
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
      {children}
    </DashboardLayoutShell>
  );
}
