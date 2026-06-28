import { headers } from "next/headers";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { DashboardLayoutShell } from "@/components/dashboard/DashboardLayoutShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Read pathname from middleware header
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  // Skip the shell for the onboarding page — it has its own full-page layout.
  // Also skip if pathname is empty (fallback).
  if (pathname.includes("/onboarding") || !pathname) {
    return <>{children}</>;
  }

  // For all other dashboard pages, load context for the persistent shell.
  // Note: getDashboardContext() may call redirect() which throws and propagates
  // automatically — we don't catch it here.
  const { school, user, locale, userSchools } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const email = user.email ?? "TL";
  const userInitials = email.slice(0, 2).toUpperCase();

  const nav = [
    { href: "/dashboard", label: t.dashboard },
    { href: "/dashboard/quizzes", label: t.quizzes },
    { href: "/dashboard/students", label: t.students },
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
    >
      {children}
    </DashboardLayoutShell>
  );
}
