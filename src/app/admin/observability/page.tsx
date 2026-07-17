import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";

export const dynamic = "force-dynamic";

async function checkSupabaseHealth(admin: ReturnType<typeof import("@/lib/supabaseAdmin").createSupabaseAdminClient>) {
  const start = Date.now();
  const { error } = await admin.from("schools").select("id", { count: "exact", head: true }).limit(1);
  const latencyMs = Date.now() - start;
  return { ok: !error, latencyMs };
}

function isoStringHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export default async function ObservabilityPage() {
  const { admin } = await requirePlatformContext(["platform_admin", "support"]);

  const supabaseHealth = await checkSupabaseHealth(admin);

  const since24h = isoStringHoursAgo(24);
  const { data: recentOrders } = await admin
    .from("orders")
    .select("gateway")
    .not("gateway_payment_id", "is", null)
    .gte("created_at", since24h);

  const webhooksByGateway = new Map<string, number>();
  for (const o of recentOrders ?? []) {
    const key = o.gateway ?? "sin_registrar";
    webhooksByGateway.set(key, (webhooksByGateway.get(key) ?? 0) + 1);
  }
  const webhooksSummary = Array.from(webhooksByGateway.entries()).map(([gw, count]) => `${gw}: ${count}`).join(" · ") || "Sin actividad en 24h";

  const vercelConfigured = Boolean(process.env.VERCEL_API_TOKEN);
  const sentryConfigured = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);

  return (
    <AdminShell
      active="/admin/observability"
      title="Observabilidad"
      description="Estado real de Supabase, actividad de webhooks de pago, Vercel y Sentry."
    >
      <div className="space-y-6">
        <KPIGrid>
          <KPI
            label="Supabase"
            value={supabaseHealth.ok ? "OK" : "Error"}
            detail={supabaseHealth.ok ? `Latencia: ${supabaseHealth.latencyMs}ms` : "La consulta de prueba falló"}
          />
          <KPI label="Vercel" value={vercelConfigured ? "Configurado" : "Configura VERCEL_API_TOKEN"} detail={vercelConfigured ? "Token detectado" : "Sin token para consultar deployments"} />
          <KPI label="Sentry" value={sentryConfigured ? "Configurado" : "No instalado"} detail={sentryConfigured ? "DSN detectado" : "No hay @sentry/nextjs en el proyecto"} />
          <KPI label="Webhooks de pago (24h)" value={recentOrders?.length ?? 0} detail={webhooksSummary} />
        </KPIGrid>

        <section className="rounded-md border border-[#e1e5ea] bg-white p-5">
          <h2 className="text-xl font-semibold">Notas</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#5b6472]">
            <li>Supabase: chequeo real con una consulta liviana contra la tabla <code className="font-mono">schools</code>, mide latencia real.</li>
            <li>Webhooks: proxy real basado en órdenes con <code className="font-mono">gateway_payment_id</code> creadas en las últimas 24h, agrupadas por pasarela.</li>
            <li>Vercel/Sentry: no hay credenciales ni paquete instalado todavía — quedan como pendiente explícito, no como dato inventado.</li>
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
