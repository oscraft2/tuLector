import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { isMissingTableError } from "@/lib/supabase_errors";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { saveSiteConfig } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

type SiteConfigRow = { key: string; enabled: boolean; payload: Record<string, unknown> };

export default async function SiteConfigPage() {
  const { admin } = await requirePlatformContext(["platform_admin"]);
  const { data, error } = await admin.from("site_config").select("key, enabled, payload");
  const migrationPending = isMissingTableError(error, "site_config");
  const rows = new Map<string, SiteConfigRow>((data ?? []).map((r) => [r.key, r as SiteConfigRow]));

  const whatsapp = rows.get("whatsapp_button");
  const whatsappPayload = (whatsapp?.payload ?? {}) as { phone?: string; default_message?: string; position?: string };
  const banner = rows.get("banner_home");
  const bannerPayload = (banner?.payload ?? {}) as { text?: string; link_url?: string; link_label?: string; variant?: string };

  return (
    <AdminShell
      active="/admin/settings"
      title="Configuración del sitio"
      description="Banners y botón de WhatsApp del sitio público, editables sin deploy."
    >
      <div className="space-y-6">
        {migrationPending && (
          <section className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Falta aplicar la migración <code className="font-mono">supabase/migrations/20260717000000_site_config.sql</code> en
            Supabase producción. Mientras tanto, esta página no puede leer ni guardar configuración.
          </section>
        )}

        <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-[#111827]">Botón de WhatsApp</h2>
              {whatsapp?.enabled && whatsappPayload.phone ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                  ● Activo en el sitio público
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 border border-gray-200">
                  ○ Inactivo
                </span>
              )}
            </div>
            {whatsappPayload.phone && (
              <a
                href={`https://wa.me/${whatsappPayload.phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(whatsappPayload.default_message || "Hola, quiero informacion sobre TuLector")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#128C4A] hover:underline"
              >
                Probar enlace en WhatsApp ↗
              </a>
            )}
          </div>
          <p className="mt-1 text-sm text-[#5b6472] mb-4">
            Al activarse, se muestra el botón flotante en la esquina inferior y el enlace en el encabezado del sitio web público (no en el dashboard ni en el APK nativo).
          </p>
          <form action={saveSiteConfig} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="key" value="whatsapp_button" />
            <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2 cursor-pointer select-none">
              <input type="checkbox" name="enabled" defaultChecked={whatsapp?.enabled ?? false} className="h-4 w-4 rounded border-gray-300 text-[#07305f] focus:ring-[#07305f]" />
              Activar botón de WhatsApp en el sitio público
            </label>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Número de teléfono (con código de país)
              </label>
              <input
                name="phone"
                placeholder="Ej. Chile: 56912345678"
                defaultValue={whatsappPayload.phone ?? ""}
                className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none focus:border-[#07305f] focus:ring-1 focus:ring-[#07305f]"
              />
              <p className="mt-1 text-[11px] text-[#858b94]">Sin &quot;+&quot; ni espacios ni guiones. Chile: 569XXXXXXXX, México: 521XXXXXXXXXX.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Posición en pantalla
              </label>
              <select name="position" defaultValue={whatsappPayload.position ?? "bottom-right"} className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none focus:border-[#07305f] focus:ring-1 focus:ring-[#07305f]">
                <option value="bottom-right">Abajo a la derecha (recomendado)</option>
                <option value="bottom-left">Abajo a la izquierda</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Mensaje predefinido al iniciar chat
              </label>
              <textarea
                name="default_message"
                rows={2}
                placeholder="Mensaje predefinido"
                defaultValue={whatsappPayload.default_message ?? "Hola, quiero informacion sobre TuLector"}
                className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none focus:border-[#07305f] focus:ring-1 focus:ring-[#07305f]"
              />
            </div>
            <button className="rounded bg-[#07305f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0b3f78] md:col-span-2 transition">
              Guardar configuración de WhatsApp
            </button>
          </form>
        </div>

        <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
          <h2 className="text-base font-semibold text-[#111827]">Banner del sitio</h2>
          <p className="mt-1 text-sm text-[#5b6472] mb-4">Aviso destacado en la página de inicio pública.</p>
          <form action={saveSiteConfig} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="key" value="banner_home" />
            <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
              <input type="checkbox" name="enabled" defaultChecked={banner?.enabled ?? false} /> Activar banner
            </label>
            <textarea
              name="text"
              rows={2}
              placeholder="Texto del banner"
              defaultValue={bannerPayload.text ?? ""}
              className="rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none md:col-span-2"
            />
            <input
              name="link_url"
              placeholder="URL del enlace (opcional)"
              defaultValue={bannerPayload.link_url ?? ""}
              className="rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none"
            />
            <input
              name="link_label"
              placeholder="Texto del enlace (opcional)"
              defaultValue={bannerPayload.link_label ?? ""}
              className="rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none"
            />
            <select name="variant" defaultValue={bannerPayload.variant ?? "info"} className="rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none md:col-span-2">
              <option value="info">Informativo</option>
              <option value="warning">Advertencia</option>
              <option value="promo">Promoción</option>
            </select>
            <button className="rounded bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b3f78] md:col-span-2">
              Guardar banner
            </button>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
