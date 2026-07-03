import { requirePlatformContext } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const { admin } = await requirePlatformContext(["platform_admin", "marketing"]);
  const { data, error } = await admin
    .from("contact_leads")
    .select("email,name,institution,institutional_rut,role,phone,country,locale,source,status,consent_marketing,created_at,contacted_at,internal_note")
    .order("created_at", { ascending: false });

  if (error) {
    return new Response("No se pudo exportar leads", { status: 500 });
  }

  const headers = ["email", "name", "institution", "institutional_rut", "role", "phone", "country", "locale", "source", "status", "consent_marketing", "created_at", "contacted_at", "internal_note"];
  const rows = [headers.join(",")].concat(
    (data ?? []).map((lead) => headers.map((key) => csvCell(lead[key as keyof typeof lead])).join(","))
  );

  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tulector-contact-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
