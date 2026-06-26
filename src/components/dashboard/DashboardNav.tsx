import { AppShell } from "@/components/AppShell";
import { getDashboardMessages, type DashboardLocale } from "@/locales";

export function DashboardShell({
  locale,
  title,
  description,
  children,
  organizationName,
  userInitials,
}: {
  locale: DashboardLocale;
  title: string;
  description: string;
  children: React.ReactNode;
  organizationName?: string;
  userInitials?: string;
}) {
  const t = getDashboardMessages(locale);
  const nav = [
    { href: "/dashboard", label: t.dashboard, active: title === t.dashboard },
    { href: "/dashboard/quizzes", label: t.quizzes, active: title === t.quizzes },
    { href: "/dashboard/students", label: t.students, active: title === t.students },
    { href: "/dashboard/papers", label: t.papers, active: title === t.papers },
    { href: "/dashboard/team", label: t.team, active: title === t.team },
    { href: "/dashboard/billing", label: t.billing, active: title === t.billing },
    { href: "/dashboard/settings", label: t.settings, active: title === t.settings },
  ];

  return (
    <AppShell
      mode="client"
      eyebrow="TuLector School"
      title={title}
      description={description}
      nav={nav}
      organizationName={organizationName}
      userInitials={userInitials}
    >
      {children}
    </AppShell>
  );
}
