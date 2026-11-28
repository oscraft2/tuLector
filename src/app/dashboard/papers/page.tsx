import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { DataTable } from "@/components/dashboard/DataTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StudentAvatar } from "@/components/dashboard/StudentAvatar";
import { getPaperStatusVisual } from "@/lib/subject_visuals";
import { isMissingColumnError } from "@/lib/supabase_errors";
import { fetchTeacherOptions, parseTeacherScope, quizIdsInScope, resolveScope } from "@/lib/teacher_scope";
import { sharedQuizIdsFor } from "@/lib/quiz_shares";
import { TeacherScopeFilter } from "@/components/dashboard/TeacherScopeFilter";

export const dynamic = "force-dynamic";

type PaperRow = {
  id: string;
  quiz_id: string;
  student_name: string | null;
  student_id: string | null;
  score: number | null;
  total: number | null;
  status: string | null;
  image_url: string | null;
  storage_path: string | null;
  scanned_at: string;
  sheet_code_read?: number | null;
  quizzes?: { sheet_code: number | null } | Array<{ sheet_code: number | null }> | null;
};

export default async function PapersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user, school, locale, isAdmin } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const sp = (await searchParams) ?? {};

  const requested = parseTeacherScope(sp, { userId: user.id, isAdmin, plan: school.plan });
  const [teachers, sharedQuizIds] = await Promise.all([
    requested.canSwitch ? fetchTeacherOptions(supabase, school.id, user.id) : Promise.resolve([]),
    sharedQuizIdsFor(supabase, school.id, user.id),
  ]);
  const scope = resolveScope(requested, teachers.length);
  const quizIds = await quizIdsInScope(supabase, school.id, scope, sharedQuizIds);

  const papersQuery = (columns: string) => {
    const q = supabase
      .from("papers")
      .select(columns)
      .neq("status", "void")
      .order("scanned_at", { ascending: false })
      .limit(100);
    return quizIds === null ? q : q.in("quiz_id", quizIds);
  };

  const papersResult =
    quizIds !== null && quizIds.length === 0
      ? { data: [], error: null }
      : await papersQuery(
          "id,quiz_id,student_name,student_id,score,total,status,image_url,storage_path,scanned_at,sheet_code_read,quizzes(sheet_code)",
        );
  let papersData: unknown = papersResult.data;
  if (papersResult.error && isMissingColumnError(papersResult.error, "sheet_code_read")) {
    const fallbackResult = await papersQuery(
      "id,quiz_id,student_name,student_id,score,total,status,image_url,storage_path,scanned_at,quizzes(sheet_code)",
    );
    papersData = fallbackResult.data;
  }
  const papers = (papersData ?? []) as unknown as PaperRow[];

  return (
    <>
      <PageHeader
        title={t.papers}
        description="Lecturas sincronizadas desde la app móvil. Desde aquí se auditan, identifican y corrigen manualmente."
      />
      <TeacherScopeFilter scope={scope} teachers={teachers} basePath="/dashboard/papers" searchParams={sp} />
      {papers.length === 0 ? (
        <EmptyState
          icon="📄"
          title="Sin hojas escaneadas"
          description="Escanea hojas de respuesta desde la app móvil (APK). Los resultados aparecerán aquí automáticamente al sincronizar."
          action={{ label: "Ir a Ensayos", href: "/dashboard/quizzes" }}
          secondary={{ label: "Gestionar alumnos", href: "/dashboard/students" }}
        />
      ) : (
        <DataTable
          columns={["Alumno", "Puntaje", "Estado", "Foto", "Fecha", "Acción"]}
          rows={papers}
          empty="La app todavía no ha sincronizado lecturas."
          renderRow={(paper) => {
            const unknown = paper.status === "manual_review" || (!paper.student_name && !paper.student_id);
            const label = paper.student_name ?? paper.student_id ?? "Sin identificar";
            const seed = paper.student_id ?? paper.student_name ?? paper.id;
            const statusVis = getPaperStatusVisual(paper.status);
            return (
              <tr key={paper.id} className="border-b border-[#efede8] last:border-0">
                <td className="px-5 py-3.5 font-semibold">
                  <div className="flex items-center gap-2.5">
                    <StudentAvatar seed={seed} name={label} unknown={unknown} size="sm" />
                    <Link href={`/dashboard/papers/${paper.id}`} className="text-[#1c1917] hover:text-[#07305f] hover:underline">
                      {label}
                    </Link>
                  </div>
                </td>
                <td className="tnum px-5 py-3.5 text-[#44403c]">
                  {paper.score ?? "-"}/{paper.total ?? "-"}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusVis.className}`}>
                      {statusVis.label}
                    </span>
                    {hasSheetMismatch(paper) ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        Hoja de otro ensayo
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-[#57534e]">{paper.storage_path || paper.image_url ? "Privada" : "-"}</td>
                <td className="tnum px-5 py-3.5 text-xs text-[#78716c]">
                  {new Date(paper.scanned_at).toLocaleString("es-CL")}
                </td>
                <td className="px-5 py-3.5 space-x-3">
                  <Link href={`/dashboard/quizzes/${paper.quiz_id}`} className="font-semibold text-[#07305f] hover:underline">
                    Ver ensayo
                  </Link>
                  {paper.status === "manual_review" && (
                    <Link href={`/dashboard/papers/${paper.id}`} className="font-semibold text-amber-700 underline">
                      Identificar alumno
                    </Link>
                  )}
                </td>
              </tr>
            );
          }}
          renderMobileRow={(paper) => {
            const unknown = paper.status === "manual_review" || (!paper.student_name && !paper.student_id);
            const label = paper.student_name ?? paper.student_id ?? "Sin identificar";
            const seed = paper.student_id ?? paper.student_name ?? paper.id;
            const statusVis = getPaperStatusVisual(paper.status);
            return (
              <article key={paper.id} className="rounded-xl border border-[#e7e5df] bg-white p-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <StudentAvatar seed={seed} name={label} unknown={unknown} size="sm" />
                    <div className="min-w-0">
                      <Link href={`/dashboard/papers/${paper.id}`} className="block truncate text-base font-semibold text-[#1c1917] hover:text-[#07305f]">
                        {label}
                      </Link>
                      <p className="tnum mt-0.5 text-sm text-[#57534e]">
                        Puntaje: <span className="font-semibold text-[#1c1917]">{paper.score ?? "-"}/{paper.total ?? "-"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusVis.className}`}>
                      {statusVis.label}
                    </span>
                    {hasSheetMismatch(paper) ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        Hoja de otro ensayo
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-[#57534e]">
                  <p>Foto: {paper.storage_path || paper.image_url ? "Privada" : "-"}</p>
                  <p className="tnum">Fecha: {new Date(paper.scanned_at).toLocaleString("es-CL")}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <Link href={`/dashboard/quizzes/${paper.quiz_id}`} className="font-semibold text-[#07305f] underline">
                    Ver ensayo
                  </Link>
                  {paper.status === "manual_review" && (
                    <Link href={`/dashboard/papers/${paper.id}`} className="font-semibold text-amber-700 underline">
                      Identificar alumno
                    </Link>
                  )}
                </div>
              </article>
            );
          }}
        />
      )}
    </>
  );
}

function hasSheetMismatch(paper: PaperRow) {
  if (paper.status !== "manual_review") return false;
  if (typeof paper.sheet_code_read !== "number") return false;
  const quiz = Array.isArray(paper.quizzes) ? paper.quizzes[0] : paper.quizzes;
  const expected = quiz?.sheet_code;
  return typeof expected === "number" && paper.sheet_code_read !== expected;
}
