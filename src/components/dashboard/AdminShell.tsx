import { AppShell } from "@/components/AppShell";

const adminNav = [
  ["/admin", "Panorama"],
  ["/admin/schools", "Colegios"],
  ["/admin/users", "Usuarios"],
  ["/admin/usage", "Motor OMR"],
  ["/admin/billing", "Ingresos"],
  ["/admin/marketing", "Marketing"],
  ["/admin/support", "Soporte"],
  ["/admin/flags", "Flags"],
  ["/admin/settings", "Config. del sitio"],
  ["/admin/legal", "Legal"],
  ["/admin/observability", "Observabilidad"],
  ["/admin/dataset", "Dataset"],
] as const;

export function AdminShell({ title, description, active, children }: { title: string; description: string; active: string; children: React.ReactNode }) {
  return (
    <AppShell
      mode="admin"
      eyebrow="TuLector Platform"
      title={title}
      description={description}
      organizationName="TuLector Inc."
      userName="Staff TuLector"
      userInitials="TL"
      nav={adminNav.map(([href, label]) => ({ href, label, active: href === active }))}
    >
      {children}
    </AppShell>
  );
}
