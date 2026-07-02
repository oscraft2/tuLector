import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusPill } from "@/components/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const dynamic = "force-dynamic";

export default async function PapersPage() {
  const { supabase, locale } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const { data: papers } = await supabase.from("papers").select("id,quiz_id,student_name,student_id,score,total,status,image_url,storage_path,scanned_at").order("scanned_at", { ascending: false }).limit(100);
  return (
    <>
      <PageHeader title={t.papers} description="Lecturas sincronizadas desde la app movil. Desde aqui se auditan, anulan, corrigen manualmente y alimentan ground truth para entrenamiento." />
      <DataTable columns={["Alumno", "Puntaje", "Estado", "Foto", "Fecha", "Accion"]} rows={papers ?? []} empty="La app todavia no ha sincronizado lecturas." renderRow={(paper) => (
        <tr key={paper.id} className="border-b border-[#eef0f3] last:border-0">
          <td className="px-5 py-4 font-semibold">{paper.student_name ?? paper.student_id ?? "Sin identificar"}</td>
          <td className="px-5 py-4">{paper.score ?? "-"}/{paper.total ?? "-"}</td>
          <td className="px-5 py-4"><StatusPill>{paper.status ?? "active"}</StatusPill></td>
          <td className="px-5 py-4 text-[#5b6472]">{paper.storage_path || paper.image_url ? "Privada" : "-"}</td>
          <td className="px-5 py-4 text-[#5b6472]">{new Date(paper.scanned_at).toLocaleString("es-CL")}</td>
          <td className="px-5 py-4 space-x-3">
            <Link href={`/dashboard/results/${paper.quiz_id}`} className="font-semibold underline">Resultado</Link>
            {paper.status === "manual_review" && (
              <Link href={`/dashboard/papers/${paper.id}`} className="font-semibold text-amber-700 underline">Identificar alumno</Link>
            )}
          </td>
        </tr>
      )} />
    </>
  );
}
