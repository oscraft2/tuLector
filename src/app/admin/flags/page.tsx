import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DataTable } from "@/components/dashboard/DataTable";
import { toggleFeatureFlag } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const { admin } = await requirePlatformContext(["platform_admin"]);
  const { data: flags } = await admin.from("feature_flags").select("key,description,enabled,min_plan,version,updated_at").order("key");
  return <AdminShell active="/admin/flags" title="Feature flags" description="Publica capacidades por plan y versiones del clasificador OMR sin redeploy."><DataTable columns={["Flag", "Plan", "Version", "Estado", "Accion"]} rows={flags ?? []} empty="Sin flags." renderRow={(flag) => <tr key={flag.key} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4"><p className="font-semibold">{flag.key}</p><p className="text-sm text-[#5b6472]">{flag.description}</p></td><td className="px-5 py-4">{flag.min_plan}</td><td className="px-5 py-4">{flag.version}</td><td className="px-5 py-4">{flag.enabled ? "Activa" : "Inactiva"}</td><td className="px-5 py-4"><form action={toggleFeatureFlag}><input type="hidden" name="key" value={flag.key} /><label className="flex items-center gap-2 text-sm"><input name="enabled" type="checkbox" defaultChecked={flag.enabled} /> Activar</label><button className="mt-2 rounded border border-[#cfd6df] px-2 py-1 text-xs font-semibold">Guardar</button></form></td></tr>} /></AdminShell>;
}
