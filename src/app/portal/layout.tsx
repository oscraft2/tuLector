import { getPortalContext } from "@/lib/supabase_server";
import { PortalHeader } from "@/components/portal/PortalHeader";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // getPortalContext() redirige a /portal/auth si no hay sesion — se llama de
  // nuevo dentro de page.tsx (cache() de React dedupe dentro del mismo request).
  const { user } = await getPortalContext();

  return (
    <div className="min-h-dvh bg-[#f5f6f8]">
      <PortalHeader email={user.email ?? ""} />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
