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
          <h2 className="text-base font-semibold text-[#111827]">Botón de WhatsApp flotante</h2>
          <p className="mt-1 text-sm text-[#5b6472] mb-4">
            Aparece en todo el sitio público (no en dashboard/admin/scan/portal). Requiere un número de WhatsApp Business real.
          </p>
          <form action={saveSiteConfig} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="key" value="whatsapp_button" />
            <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
              <input type="checkbox" name="enabled" defaultChecked={whatsapp?.enabled ?? false} /> Activar botón
            </label>
            <input
              name="phone"
              placeholder="Numero con codigo de pais, ej: 56912345678"
              defaultValue={whatsappPayload.phone ?? ""}
              className="rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none"
            />
            <select name="position" defaultValue={whatsappPayload.position ?? "bottom-right"} className="rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none">
              <option value="bottom-right">Abajo a la derecha</option>
              <option value="bottom-left">Abajo a la izquierda</option>
            </select>
            <textarea
              name="default_message"
              rows={2}
              placeholder="Mensaje predefinido"
              defaultValue={whatsappPayload.default_message ?? "Hola, quiero informacion sobre TuLector"}
              className="rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none md:col-span-2"
            />
            <button className="rounded bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b3f78] md:col-span-2">
              Guardar botón de WhatsApp
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
