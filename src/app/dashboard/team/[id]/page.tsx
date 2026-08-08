import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { StatusPill } from "@/components/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DataTable } from "@/components/dashboard/DataTable";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { revokeMember } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type QuizRow = {
  id: string;
  title: string | null;
  subject: string | null;
  grade: string | null;
  created_at: string;
  archived_at: string | null;
  paperCount: number;
  lastScannedAt: string | null;
};

export default async function TeamMemberPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, school, isAdmin } = await getDashboardContext();
  if (!isAdmin) redirect("/dashboard/settings");

  const { data: member } = await supabase
    .from("school_members")
    .select("id, user_id, role, created_at")
    .eq("id", id)
    .eq("school_id", school.id)
    .maybeSingle();

  if (!member) {
    return (
      <>
        <PageHeader title="Miembro no encontrado" description="Este docente ya no pertenece a este colegio (puede que ya lo hayas quitado)." />
        <Link href="/dashboard/settings" className="inline-block rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold text-[#07305f] hover:bg-[#eef4ff]">
          Volver a Configuracion
        </Link>
      </>
    );
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabaseAdmin");
  const admin = createSupabaseAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(member.user_id);
  const email = authUser?.user?.email ?? member.user_id;
  const lastSignInAt = authUser?.user?.last_sign_in_at ?? null;

  const { data: quizRows } = await supabase
    .from("quizzes")
    .select("id,title,subject,grade,created_at,archived_at")
    .eq("school_id", school.id)
    .eq("created_by", member.user_id)
    .order("created_at", { ascending: false });

  const quizIds = (quizRows ?? []).map((q) => q.id);
  const { data: paperRows } = quizIds.length > 0
    ? await supabase.from("papers").select("quiz_id, scanned_at").in("quiz_id", quizIds)
    : { data: [] as { quiz_id: string; scanned_at: string }[] };

  const paperCountByQuiz = new Map<string, number>();
  const lastScannedByQuiz = new Map<string, string>();
  let lastActivityAt: string | null = null;
  for (const paper of paperRows ?? []) {
    paperCountByQuiz.set(paper.quiz_id, (paperCountByQuiz.get(paper.quiz_id) ?? 0) + 1);
    const current = lastScannedByQuiz.get(paper.quiz_id);
    if (!current || paper.scanned_at > current) lastScannedByQuiz.set(paper.quiz_id, paper.scanned_at);
    if (!lastActivityAt || paper.scanned_at > lastActivityAt) lastActivityAt = paper.scanned_at;
  }

  const quizzes: QuizRow[] = (quizRows ?? []).map((q) => ({
    ...q,
    paperCount: paperCountByQuiz.get(q.id) ?? 0,
    lastScannedAt: lastScannedByQuiz.get(q.id) ?? null,
  }));

  const totalPapers = quizzes.reduce((sum, q) => sum + q.paperCount, 0);

  return (
    <>
      <PageHeader title={email} description="Perfil, uso y resultados de este docente en el colegio." />
      <div className="space-y-6">
        <section className="rounded-md border border-[#d8dde3] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#111827]">Perfil</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoRow label="Correo" value={email} />
            <InfoRow label="Rol" value={<StatusPill>{roleLabel(member.role)}</StatusPill>} />
            <InfoRow label="Miembro desde" value={new Date(member.created_at).toLocaleDateString("es-CL")} />
            <InfoRow label="Ultimo inicio de sesion" value={lastSignInAt ? new Date(lastSignInAt).toLocaleString("es-CL") : "Sin registro"} />
          </div>
        </section>

        <section className="rounded-md border border-[#d8dde3] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#111827]">Uso</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <InfoRow label="Ensayos creados" value={String(quizzes.length)} />
            <InfoRow label="Hojas escaneadas" value={String(totalPapers)} />
            <InfoRow label="Ultima actividad" value={lastActivityAt ? new Date(lastActivityAt).toLocaleString("es-CL") : "Sin actividad"} />
          </div>
        </section>

        <section className="rounded-md border border-[#d8dde3] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#111827]">Resultados</h2>
          <p className="mt-1 text-sm text-[#5b6472]">Ensayos creados por este docente. Cada uno enlaza a sus resultados.</p>
          <div className="mt-4">
            <DataTable
              columns={["Ensayo", "Asignatura/Curso", "Hojas", "Ultima hoja", "Creado"]}
              rows={quizzes}
              empty="Este docente no ha creado ensayos."
              renderRow={(q) => (
                <tr key={q.id} className="border-b border-[#eef0f3] last:border-0">
                  <td className="px-5 py-4">
                    <Link href={`/dashboard/results/${q.id}`} className="font-semibold text-[#07305f] hover:underline">
                      {q.title || "Sin titulo"}
                    </Link>
                    {q.archived_at ? <span className="ml-2 text-xs text-[#9aa3af]">(archivado)</span> : null}
                  </td>
                  <td className="px-5 py-4 text-[#5b6472]">{[q.subject, q.grade].filter(Boolean).join(" · ") || "-"}</td>
                  <td className="px-5 py-4 text-[#5b6472]">{q.paperCount}</td>
                  <td className="px-5 py-4 text-[#5b6472]">{q.lastScannedAt ? new Date(q.lastScannedAt).toLocaleDateString("es-CL") : "-"}</td>
                  <td className="px-5 py-4 text-[#5b6472]">{new Date(q.created_at).toLocaleDateString("es-CL")}</td>
                </tr>
              )}
            />
          </div>
        </section>

        <section className="rounded-md border border-red-200 bg-red-50/30 p-5">
          <h2 className="text-lg font-semibold text-red-950">Zona de riesgo</h2>
          <p className="mt-2 text-sm leading-6 text-red-800">
            Quitar a este docente del colegio. Sus ensayos y resultados quedan intactos (visibles para el admin), pero pierde acceso inmediato a TuLector con este colegio.
          </p>
          <div className="mt-4">
            <ActionButton
              action={revokeMember}
              fields={{ id: member.id }}
              label="Quitar del colegio"
              pendingLabel="Quitando…"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              confirm={`¿Quitar a ${email} de este colegio? Pierde acceso inmediato; sus ensayos y resultados quedan intactos.`}
              confirmTitle="¿Quitar del colegio?"
              confirmLabel="Quitar"
              danger
            />
          </div>
        </section>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#e1e5ea] bg-[#f8fafc] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9aa3af]">{label}</p>
      <div className="mt-1 text-sm font-semibold text-[#111827]">{value}</div>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "teacher") return "Profesor";
  if (role === "viewer") return "Observador";
  return role;
}
