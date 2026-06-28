import Link from "next/link";
import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { saveEmailTemplate, sendTestEmail } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    key?: string;
    tab?: string;
    test?: string;
  }>;
};

export default async function MarketingAdminPage({ searchParams }: PageProps) {
  const { admin } = await requirePlatformContext(["platform_admin", "marketing"]);
  const resolvedParams = await searchParams;
  const activeTab = resolvedParams.tab || "templates";
  const editKey = resolvedParams.key;

  const [{ data: templates }, { data: campaigns }] = await Promise.all([
    admin.from("email_templates").select("*").order("key"),
    admin.from("email_campaigns").select("*").order("created_at", { ascending: false }),
  ]);

  const editTemplate = editKey ? templates?.find((t) => t.key === editKey) : null;
  const isResendConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_...");

  return (
    <AdminShell
      active="/admin/marketing"
      title="Correo & Marketing"
      description="Crea plantillas dinámicas, realiza envíos de prueba y administra campañas de comunicación por correo."
    >
      <div className="space-y-6">
        {/* KPI Grid */}
        <KPIGrid>
          <KPI label="Plantillas" value={templates?.length ?? 0} />
          <KPI label="Campañas" value={campaigns?.length ?? 0} />
          <KPI label="Proveedor" value={isResendConfigured ? "Resend Activo" : "Log local (Dev)"} />
          <KPI label="Correo Remitente" value={process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"} />
        </KPIGrid>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#e5e7eb]">
          <Link
            href="/admin/marketing?tab=templates"
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "templates"
                ? "border-[#07305f] text-[#07305f]"
                : "border-transparent text-[#6b7280] hover:text-[#111827]"
            }`}
          >
            Plantillas HTML
          </Link>
          <Link
            href="/admin/marketing?tab=campaigns"
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "campaigns"
                ? "border-[#07305f] text-[#07305f]"
                : "border-transparent text-[#6b7280] hover:text-[#111827]"
            }`}
          >
            Campañas enviadas
          </Link>
        </div>

        {activeTab === "templates" && (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            {/* List of Templates */}
            <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
              <h2 className="text-base font-semibold mb-4">Plantillas registradas</h2>
              <DataTable
                columns={["Llave / Idioma", "Asunto", "Último cambio", "Acciones"]}
                rows={templates ?? []}
                empty="No hay plantillas personalizadas creadas aún. El sistema está usando los fallbacks estáticos predefinidos."
                renderRow={(t) => (
                  <tr key={t.id} className="border-b border-[#eef0f3] last:border-0 text-sm">
                    <td className="px-5 py-4">
                      <span className="font-mono font-semibold text-[#07305f]">{t.key}</span>
                      <span className="ml-2 rounded bg-[#f3f4f6] px-1.5 py-0.5 text-xs text-[#4b5563]">{t.locale}</span>
                    </td>
                    <td className="px-5 py-4 text-[#4b5563] font-medium">{t.subject}</td>
                    <td className="px-5 py-4 text-[#6b7280] text-xs">
                      {t.updated_at ? new Date(t.updated_at).toLocaleString("es-CL") : new Date(t.created_at).toLocaleString("es-CL")}
                    </td>
                    <td className="px-5 py-4 flex gap-2">
                      <Link
                        href={`/admin/marketing?tab=templates&key=${t.key}`}
                        className="text-xs font-semibold text-[#2563eb] hover:underline"
                      >
                        Editar
                      </Link>
                      <span className="text-[#d1d5db]">|</span>
                      <Link
                        href={`/admin/marketing?tab=templates&key=${t.key}&test=true`}
                        className="text-xs font-semibold text-[#10b981] hover:underline"
                      >
                        Probar
                      </Link>
                    </td>
                  </tr>
                )}
              />
            </div>

            {/* Editor or Test Send Form */}
            <div className="space-y-6">
              {resolvedParams.key && resolvedParams.test === "true" ? (
                /* Send Test Form */
                <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-[#10b981]">Prueba de correo</h2>
                    <Link href="/admin/marketing?tab=templates" className="text-xs font-semibold text-[#4b5563] hover:underline">
                      Volver
                    </Link>
                  </div>
                  <form action={sendTestEmail} className="space-y-4 text-sm">
                    <input type="hidden" name="key" value={editKey} />
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Llave seleccionada</label>
                      <input
                        type="text"
                        disabled
                        value={editKey}
                        className="w-full rounded border border-[#cfd6df] bg-[#f8fafc] px-3 py-2 text-sm font-mono text-[#07305f]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Idioma / Región</label>
                      <select
                        name="locale"
                        defaultValue={editTemplate?.locale || "es-CL"}
                        className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none"
                      >
                        <option value="es-CL">es-CL (Español)</option>
                        <option value="en">en (Inglés)</option>
                        <option value="pt-BR">pt-BR (Portugués)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Destinatario de prueba</label>
                      <input
                        type="email"
                        name="test_email"
                        required
                        placeholder="profesor@ejemplo.com"
                        className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Variables simuladas (JSON)</label>
                      <textarea
                        name="variables_json"
                        rows={6}
                        defaultValue={JSON.stringify(
                          editKey === "invitation"
                            ? {
                                invited_by_email: "director@colegio.cl",
                                school_name: "Liceo de Prueba",
                                role: "Profesor",
                                invite_link: "http://localhost:3000/auth?mode=register&invite_id=123",
                              }
                            : editKey?.startsWith("quota_alert")
                            ? {
                                school_name: "Liceo de Prueba",
                                scans_used: 90,
                                scans_limit: 100,
                                billing_link: "http://localhost:3000/dashboard/billing",
                              }
                            : {
                                school_name: "Liceo de Prueba",
                                plan_or_pack: "Plan Pro Anual",
                                amount: "$150.000 CLP",
                                transaction_id: "fl_1294812",
                                payment_method: "Webpay (Flow)",
                                dashboard_link: "http://localhost:3000/dashboard",
                              },
                          null,
                          2
                        )}
                        className="w-full rounded border border-[#cfd6df] px-3 py-2 text-xs font-mono outline-none"
                      />
                    </div>
                    <button className="w-full rounded bg-[#10b981] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#059669] transition-colors">
                      Enviar correo de prueba
                    </button>
                  </form>
                </div>
              ) : (
                /* Edit/Create Template Form */
                <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold">
                      {editTemplate ? `Editar plantilla: ${editTemplate.key}` : "Nueva plantilla"}
                    </h2>
                    {editTemplate && (
                      <Link href="/admin/marketing?tab=templates" className="text-xs font-semibold text-[#4b5563] hover:underline">
                        Limpiar formulario
                      </Link>
                    )}
                  </div>
                  <form action={saveEmailTemplate} className="space-y-4 text-sm">
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Llave única de la plantilla</label>
                      <input
                        type="text"
                        name="key"
                        required
                        placeholder="ej: invitation"
                        defaultValue={editTemplate?.key || ""}
                        className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Idioma / Región</label>
                      <select
                        name="locale"
                        defaultValue={editTemplate?.locale || "es-CL"}
                        className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none"
                      >
                        <option value="es-CL">es-CL (Español)</option>
                        <option value="en">en (Inglés)</option>
                        <option value="pt-BR">pt-BR (Portugués)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Asunto del correo</label>
                      <input
                        type="text"
                        name="subject"
                        required
                        placeholder="ej: Has sido invitado a colaborar"
                        defaultValue={editTemplate?.subject || ""}
                        className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Contenido HTML</label>
                      <textarea
                        name="html"
                        required
                        rows={10}
                        placeholder="<div>Usa {{variable_name}} para marcadores...</div>"
                        defaultValue={editTemplate?.html || ""}
                        className="w-full rounded border border-[#cfd6df] px-3 py-2 text-xs font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Texto alternativo (Text fallback)</label>
                      <textarea
                        name="text"
                        rows={4}
                        placeholder="Texto plano alternativo si el HTML falla..."
                        defaultValue={editTemplate?.text || ""}
                        className="w-full rounded border border-[#cfd6df] px-3 py-2 text-xs font-mono outline-none"
                      />
                    </div>
                    <button className="w-full rounded bg-[#07305f] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#0b3f78] transition-colors">
                      {editTemplate ? "Actualizar plantilla" : "Crear plantilla"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "campaigns" && (
          <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
            <h2 className="text-base font-semibold mb-4">Campañas registradas</h2>
            <DataTable
              columns={["Nombre de Campaña", "ID Plantilla", "Segmento", "Estado", "Fecha"]}
              rows={campaigns ?? []}
              empty="No se han registrado campañas de marketing masivas."
              renderRow={(c) => (
                <tr key={c.id} className="border-b border-[#eef0f3] last:border-0 text-sm">
                  <td className="px-5 py-4 font-semibold">{c.name}</td>
                  <td className="px-5 py-4 font-mono text-xs">{c.template_id ?? "-"}</td>
                  <td className="px-5 py-4 text-xs font-mono">{JSON.stringify(c.segment ?? {})}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                        c.status === "sent"
                          ? "bg-green-100 text-green-800"
                          : c.status === "sending"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#6b7280]">
                    {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString("es-CL") : "-"}
                  </td>
                </tr>
              )}
            />
          </div>
        )}
      </div>
    </AdminShell>
  );
}
