import Link from "next/link";
import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { saveEmailTemplate, sendTestEmail, updateContactLead } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    key?: string;
    tab?: string;
    test?: string;
    status?: string;
  }>;
};

const leadStatuses = ["new", "contacted", "qualified", "discarded", "blocked"] as const;

const leadStatusLabels: Record<string, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Calificado",
  discarded: "Descartado",
  blocked: "Bloqueado",
};

export default async function MarketingAdminPage({ searchParams }: PageProps) {
  const { admin } = await requirePlatformContext(["platform_admin", "marketing"]);
  const resolvedParams = await searchParams;
  const activeTab = resolvedParams.tab || "leads";
  const editKey = resolvedParams.key;
  const statusFilter = resolvedParams.status || "all";

  let leadsQuery = admin.from("contact_leads").select("*").order("created_at", { ascending: false }).limit(200);
  if (statusFilter !== "all" && leadStatuses.includes(statusFilter as typeof leadStatuses[number])) {
    leadsQuery = leadsQuery.eq("status", statusFilter);
  }

  const [{ data: templates }, { data: campaigns }, { data: leads }, { count: totalLeads }, { count: newLeads }, { count: contactedLeads }, { count: qualifiedLeads }] = await Promise.all([
    admin.from("email_templates").select("*").order("key"),
    admin.from("email_campaigns").select("*").order("created_at", { ascending: false }),
    leadsQuery,
    admin.from("contact_leads").select("id", { count: "exact", head: true }),
    admin.from("contact_leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin.from("contact_leads").select("id", { count: "exact", head: true }).eq("status", "contacted"),
    admin.from("contact_leads").select("id", { count: "exact", head: true }).eq("status", "qualified"),
  ]);

  const editTemplate = editKey ? templates?.find((t) => t.key === editKey) : null;
  const isResendConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_...");

  return (
    <AdminShell
      active="/admin/marketing"
      title="Correo & Marketing"
      description="Administra leads comerciales, plantillas de correo y futuras campanas institucionales."
    >
      <div className="space-y-6">
        <KPIGrid>
          <KPI label="Leads totales" value={totalLeads ?? 0} />
          <KPI label="Nuevos" value={newLeads ?? 0} />
          <KPI label="Contactados" value={contactedLeads ?? 0} />
          <KPI label="Calificados" value={qualifiedLeads ?? 0} />
        </KPIGrid>

        <div className="flex flex-wrap gap-2 border-b border-[#e5e7eb]">
          <TabLink href="/admin/marketing?tab=leads" active={activeTab === "leads"}>Leads comerciales</TabLink>
          <TabLink href="/admin/marketing?tab=templates" active={activeTab === "templates"}>Plantillas HTML</TabLink>
          <TabLink href="/admin/marketing?tab=campaigns" active={activeTab === "campaigns"}>Campanas enviadas</TabLink>
        </div>

        {activeTab === "leads" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-md border border-[#e5e7eb] bg-white p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#111827]">Solicitudes recibidas</h2>
                <p className="mt-1 text-sm text-[#5b6472]">Contactos capturados desde el formulario publico. Incluye consentimiento, fuente y datos institucionales.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin/marketing?tab=leads" className={statusFilter === "all" ? activeFilterClass : filterClass}>Todos</Link>
                {leadStatuses.map((status) => (
                  <Link key={status} href={`/admin/marketing?tab=leads&status=${status}`} className={statusFilter === status ? activeFilterClass : filterClass}>
                    {leadStatusLabels[status]}
                  </Link>
                ))}
                <Link href="/admin/marketing/leads.csv" className="rounded-md bg-[#07305f] px-3 py-2 text-xs font-bold text-white hover:bg-[#0b3f78]">
                  Exportar CSV
                </Link>
              </div>
            </div>

            <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
              <DataTable
                columns={["Contacto", "Institucion", "Origen", "Estado", "Gestion"]}
                rows={leads ?? []}
                empty="Aun no hay solicitudes comerciales registradas."
                renderRow={(lead) => (
                  <tr key={lead.id} className="border-b border-[#eef0f3] align-top text-sm last:border-0">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#111827]">{lead.name || "Sin nombre"}</p>
                      <a href={`mailto:${lead.email}`} className="mt-1 block font-mono text-xs font-semibold text-[#07305f] hover:underline">{lead.email}</a>
                      {lead.phone ? <p className="mt-1 text-xs text-[#5b6472]">{lead.phone}</p> : null}
                    </td>
                    <td className="px-5 py-4 text-[#4b5563]">
                      <p className="font-semibold text-[#111827]">{lead.institution || "Sin institucion"}</p>
                      <p className="mt-1 text-xs">{lead.institutional_rut || "RUT no informado"}</p>
                      <p className="mt-1 text-xs">{lead.country || "-"} · {lead.locale}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-[#5b6472]">
                      <p>{lead.source || "/"}</p>
                      <p className="mt-1">{new Date(lead.created_at).toLocaleString("es-CL")}</p>
                      <p className="mt-1">Consentimiento: {lead.consent_marketing ? "si" : "no"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-bold text-[#07305f]">
                        {leadStatusLabels[lead.status] ?? lead.status}
                      </span>
                      {lead.contacted_at ? <p className="mt-2 text-xs text-[#5b6472]">Contactado: {new Date(lead.contacted_at).toLocaleDateString("es-CL")}</p> : null}
                    </td>
                    <td className="px-5 py-4">
                      <form action={updateContactLead} className="grid min-w-[240px] gap-2">
                        <input type="hidden" name="lead_id" value={lead.id} />
                        <select name="status" defaultValue={lead.status} className="rounded border border-[#cfd6df] px-3 py-2 text-xs font-semibold outline-none">
                          {leadStatuses.map((status) => <option key={status} value={status}>{leadStatusLabels[status]}</option>)}
                        </select>
                        <textarea name="internal_note" defaultValue={lead.internal_note ?? ""} rows={2} placeholder="Nota interna" className="rounded border border-[#cfd6df] px-3 py-2 text-xs outline-none" />
                        <button className="rounded bg-[#111827] px-3 py-2 text-xs font-bold text-white hover:bg-[#07305f]">Guardar</button>
                      </form>
                    </td>
                  </tr>
                )}
              />
            </div>
          </div>
        )}

        {activeTab === "templates" && (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Plantillas registradas</h2>
                <span className="text-xs font-semibold text-[#5b6472]">Proveedor: {isResendConfigured ? "Resend activo" : "Log local"}</span>
              </div>
              <DataTable
                columns={["Llave / Idioma", "Asunto", "Ultimo cambio", "Acciones"]}
                rows={templates ?? []}
                empty="No hay plantillas personalizadas creadas aun."
                renderRow={(t) => (
                  <tr key={t.id} className="border-b border-[#eef0f3] text-sm last:border-0">
                    <td className="px-5 py-4"><span className="font-mono font-semibold text-[#07305f]">{t.key}</span><span className="ml-2 rounded bg-[#f3f4f6] px-1.5 py-0.5 text-xs text-[#4b5563]">{t.locale}</span></td>
                    <td className="px-5 py-4 font-medium text-[#4b5563]">{t.subject}</td>
                    <td className="px-5 py-4 text-xs text-[#6b7280]">{t.updated_at ? new Date(t.updated_at).toLocaleString("es-CL") : new Date(t.created_at).toLocaleString("es-CL")}</td>
                    <td className="flex gap-2 px-5 py-4"><Link href={`/admin/marketing?tab=templates&key=${t.key}`} className="text-xs font-semibold text-[#2563eb] hover:underline">Editar</Link><span className="text-[#d1d5db]">|</span><Link href={`/admin/marketing?tab=templates&key=${t.key}&test=true`} className="text-xs font-semibold text-[#10b981] hover:underline">Probar</Link></td>
                  </tr>
                )}
              />
            </div>

            <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
              {resolvedParams.key && resolvedParams.test === "true" ? (
                <TestEmailForm editKey={editKey} editTemplate={editTemplate} />
              ) : (
                <TemplateForm editTemplate={editTemplate} />
              )}
            </div>
          </div>
        )}

        {activeTab === "campaigns" && (
          <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
            <h2 className="mb-4 text-base font-semibold">Campanas registradas</h2>
            <DataTable
              columns={["Nombre", "Plantilla", "Segmento", "Estado", "Fecha"]}
              rows={campaigns ?? []}
              empty="No se han registrado campanas de marketing masivas."
              renderRow={(c) => (
                <tr key={c.id} className="border-b border-[#eef0f3] text-sm last:border-0">
                  <td className="px-5 py-4 font-semibold">{c.name}</td>
                  <td className="px-5 py-4 font-mono text-xs">{c.template_id ?? "-"}</td>
                  <td className="px-5 py-4 font-mono text-xs">{JSON.stringify(c.segment ?? {})}</td>
                  <td className="px-5 py-4"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800">{c.status}</span></td>
                  <td className="px-5 py-4 text-xs text-[#6b7280]">{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString("es-CL") : "-"}</td>
                </tr>
              )}
            />
          </div>
        )}
      </div>
    </AdminShell>
  );
}

const filterClass = "rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-xs font-bold text-[#4b5563] hover:border-[#9aa4ae] hover:text-[#111827]";
const activeFilterClass = "rounded-md bg-[#111827] px-3 py-2 text-xs font-bold text-white";

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${active ? "border-[#07305f] text-[#07305f]" : "border-transparent text-[#6b7280] hover:text-[#111827]"}`}>{children}</Link>;
}

function TemplateForm({ editTemplate }: { editTemplate: any }) {
  return (
    <form action={saveEmailTemplate} className="space-y-4 text-sm">
      <h2 className="text-base font-semibold">{editTemplate ? `Editar plantilla: ${editTemplate.key}` : "Nueva plantilla"}</h2>
      <input name="key" required placeholder="llave" defaultValue={editTemplate?.key || ""} className="w-full rounded border border-[#cfd6df] px-3 py-2 font-mono text-sm outline-none" />
      <select name="locale" defaultValue={editTemplate?.locale || "es-CL"} className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none"><option value="es-CL">es-CL</option><option value="en">en</option><option value="pt-BR">pt-BR</option></select>
      <input name="subject" required placeholder="Asunto" defaultValue={editTemplate?.subject || ""} className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none" />
      <textarea name="html" required rows={10} placeholder="HTML" defaultValue={editTemplate?.html || ""} className="w-full rounded border border-[#cfd6df] px-3 py-2 font-mono text-xs outline-none" />
      <textarea name="text" rows={4} placeholder="Texto plano" defaultValue={editTemplate?.text || ""} className="w-full rounded border border-[#cfd6df] px-3 py-2 font-mono text-xs outline-none" />
      <button className="w-full rounded bg-[#07305f] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#0b3f78]">{editTemplate ? "Actualizar plantilla" : "Crear plantilla"}</button>
    </form>
  );
}

function TestEmailForm({ editKey, editTemplate }: { editKey?: string; editTemplate: any }) {
  return (
    <form action={sendTestEmail} className="space-y-4 text-sm">
      <h2 className="text-base font-semibold text-[#10b981]">Prueba de correo</h2>
      <input type="hidden" name="key" value={editKey} />
      <input disabled value={editKey} className="w-full rounded border border-[#cfd6df] bg-[#f8fafc] px-3 py-2 font-mono text-sm text-[#07305f]" />
      <select name="locale" defaultValue={editTemplate?.locale || "es-CL"} className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none"><option value="es-CL">es-CL</option><option value="en">en</option><option value="pt-BR">pt-BR</option></select>
      <input type="email" name="test_email" required placeholder="profesor@ejemplo.com" className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none" />
      <textarea name="variables_json" rows={6} defaultValue={JSON.stringify({ school_name: "Liceo de Prueba", dashboard_link: "https://tulector.vercel.app/dashboard" }, null, 2)} className="w-full rounded border border-[#cfd6df] px-3 py-2 font-mono text-xs outline-none" />
      <button className="w-full rounded bg-[#10b981] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#059669]">Enviar correo de prueba</button>
    </form>
  );
}
