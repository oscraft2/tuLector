import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { createStudentAndAssignPaper } from "@/app/dashboard/actions";
import { assignPaperAction, undoAssignAction } from "@/app/dashboard/papers/actions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PaperAssignPanel } from "@/components/dashboard/PaperAssignPanel";
import { isMissingColumnError } from "@/lib/supabase_errors";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function PaperIdentifyPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, school } = await getDashboardContext();

  // `prev_assignment` (20260812000000) habilita el "deshacer"; si la BD no la
  // tiene todavia, la pagina funciona igual pero sin ese boton.
  const paperQuery = (select: string) =>
    supabase.from("papers").select(select).eq("id", id).eq("school_id", school.id).maybeSingle();
  const PAPER_COLUMNS = "id,quiz_id,student_id,student_name,status,name_img_url,image_url,score,total";

  const [paperResult, { data: courses }] = await Promise.all([
    paperQuery(`${PAPER_COLUMNS},prev_assignment`),
    supabase.from("courses").select("id,name,grade").is("archived_at", null).order("name"),
  ]);
  const paperData = paperResult.error && isMissingColumnError(paperResult.error, "prev_assignment")
    ? (await paperQuery(PAPER_COLUMNS)).data
    : paperResult.data;
  const paper = paperData as unknown as {
    id: string; quiz_id: string; student_id: string | null; student_name: string | null;
    status: string | null; name_img_url: string | null; image_url: string | null;
    score: number | null; total: number | null; prev_assignment?: unknown;
  } | null;
  if (!paper) notFound();

  // Antes esta pantalla se cerraba en cuanto el escaneo tenia alumno. Ahora
  // tambien sirve para CORREGIR una asignacion equivocada (el caso real: la
  // hoja se le adjudico a otro alumno), con confirmacion explicita.
  const assigned = paper.status !== "manual_review";
  const courseList = courses ?? [];

  return (
    <>
      <PageHeader
        title={assigned ? "Revisar identificación" : "Identificar alumno"}
        description={assigned
          ? "Este escaneo ya tiene alumno asignado. Puedes reasignarlo si quedó con el alumno equivocado — se avisa antes de mover la nota."
          : "Este escaneo quedo en revision manual (RUT vacio o sin alumno coincidente). Usa el recorte del nombre para asignar el alumno correcto."}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 space-y-3">
            <h2 className="text-lg font-semibold text-[#111827]">Recorte del nombre</h2>
            {paper.name_img_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={paper.name_img_url} alt="Nombre manuscrito" className="w-full rounded border border-[#e6e8eb]" />
            ) : (
              <p className="text-sm italic text-[#9aa2af]">No se capturo recorte del nombre para este escaneo.</p>
            )}
          </div>
          {paper.image_url && (
            <div className="rounded-md border border-[#e6e8eb] bg-white p-5 space-y-3">
              <h2 className="text-lg font-semibold text-[#111827]">Foto completa</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={paper.image_url} alt="Hoja escaneada" className="w-full rounded border border-[#e6e8eb]" />
            </div>
          )}
          <div className="rounded-md border border-[#e1e5ea] bg-white p-5">
            <p className="text-sm text-[#5b6472]">Puntaje: <span className="font-semibold text-[#111827]">{paper.score ?? "-"}/{paper.total ?? "-"}</span></p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-[#111827]">
              {assigned ? "Reasignar a otro alumno" : "Asignar alumno existente"}
            </h2>
            {assigned && (
              <p className="text-sm text-[#5b6472]">
                Asignado actualmente a{" "}
                <span className="font-semibold text-[#111827]">{paper.student_name ?? paper.student_id ?? "-"}</span>.
              </p>
            )}
            <PaperAssignPanel
              paperId={paper.id}
              currentStudentName={paper.student_name ?? paper.student_id ?? null}
              assigned={assigned}
              canUndo={Boolean(paper.prev_assignment)}
              assignAction={assignPaperAction}
              undoAction={undoAssignAction}
            />
            <Link href={`/dashboard/results/${paper.quiz_id}`} className="block text-sm font-semibold text-[#07305f] underline">
              Ver resultados del ensayo
            </Link>
          </div>

          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-[#111827]">Crear alumno nuevo y asignar</h2>
            <form action={createStudentAndAssignPaper} className="space-y-3">
              <input type="hidden" name="paper_id" value={paper.id} />
              <label className="block text-xs font-semibold">
                Nombre completo
                <input name="name" required placeholder="Ej: Juan Pérez" className="mt-1 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal text-sm" />
              </label>
              <label className="block text-xs font-semibold">
                RUT Chileno
                <input name="rut" required placeholder="Ej: 12.345.678-5" className="mt-1 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal text-sm" />
              </label>
              <label className="block text-xs font-semibold">
                Curso / Grupo
                <select name="course" required className="mt-1 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal text-sm">
                  <option value="">Selecciona curso</option>
                  {courseList.map((c) => (
                    <option key={c.id} value={c.name}>{c.name} ({c.grade})</option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={courseList.length === 0} className="w-full rounded-md bg-[#111827] py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
                {courseList.length === 0 ? "Primero crea un curso" : "Crear y asignar"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
