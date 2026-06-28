import Link from "next/link";
import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DataTable } from "@/components/dashboard/DataTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { admin } = await requirePlatformContext(["platform_admin", "support"]);
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
  const users = data.users.map((u) => ({ id: u.id, email: u.email ?? "-", role: String(u.app_metadata?.role ?? "school_user"), lastSignIn: u.last_sign_in_at ?? null, createdAt: u.created_at }));
  return (
    <AdminShell active="/admin/users" title="Usuarios" description="Usuarios Auth, roles app_metadata, último login y búsqueda operacional.">
      <DataTable
        columns={["Email", "Rol", "Último login", "Creado"]}
        rows={users}
        empty="Sin usuarios."
        renderRow={(u) => (
          <tr key={u.id} className="border-b border-[#eef0f3] last:border-0 text-sm">
            <td className="px-5 py-4 font-semibold text-[#07305f]">
              <Link href={`/admin/users/${u.id}`} className="hover:underline">{u.email}</Link>
            </td>
            <td className="px-5 py-4">{u.role}</td>
            <td className="px-5 py-4">{u.lastSignIn ? new Date(u.lastSignIn).toLocaleString("es-CL") : "-"}</td>
            <td className="px-5 py-4">{new Date(u.createdAt).toLocaleDateString("es-CL")}</td>
          </tr>
        )}
      />
    </AdminShell>
  );
}
