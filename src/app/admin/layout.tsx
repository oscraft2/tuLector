import { AdminLayoutShell } from "@/components/dashboard/AdminLayoutShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
