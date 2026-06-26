import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { DashboardShell } from "@/components/dashboard/DashboardNav";
import { InviteForm } from "@/components/dashboard/InviteForm";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusPill } from "@/components/AppShell";
import { inviteMember, revokeMember } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { supabase, locale, isAdmin, user } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase.from("school_members").select("id,user_id,role,created_at").order("created_at"),
    supabase.from("invitations").select("id,email,role,status,created_at").order("created_at", { ascending: false }),
  ]);
  return (
    <DashboardShell locale={locale} title={t.team} description="Administra miembros del colegio. Solo admin puede invitar, cambiar roles o revocar accesos.">
      <div className="space-y-6">
        {isAdmin ? <InviteForm action={inviteMember} /> : <div className="rounded-md border border-[#e1e5ea] bg-white p-5 text-sm text-[#5b6472]">Tu rol no permite invitar miembros.</div>}
        <DataTable columns={["Usuario", "Rol", "Creado", "Accion"]} rows={members ?? []} empty="No hay miembros visibles." renderRow={(member) => (
          <tr key={member.id} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-mono text-xs">{member.user_id}</td><td className="px-5 py-4"><StatusPill>{member.role}</StatusPill></td><td className="px-5 py-4 text-[#5b6472]">{new Date(member.created_at).toLocaleDateString("es-CL")}</td><td className="px-5 py-4">{isAdmin && member.user_id !== user.id ? <form action={revokeMember}><input type="hidden" name="id" value={member.id} /><button className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold">Revocar</button></form> : "-"}</td></tr>
        )} />
        <DataTable columns={["Email", "Rol", "Estado", "Fecha"]} rows={invitations ?? []} empty="No hay invitaciones pendientes." renderRow={(invite) => (
          <tr key={invite.id} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{invite.email}</td><td className="px-5 py-4">{invite.role}</td><td className="px-5 py-4"><StatusPill>{invite.status}</StatusPill></td><td className="px-5 py-4 text-[#5b6472]">{new Date(invite.created_at).toLocaleDateString("es-CL")}</td></tr>
        )} />
      </div>
    </DashboardShell>
  );
}
