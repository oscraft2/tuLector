import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { createStudentAndAssignPaper } from "@/app/dashboard/actions";
import { assignPaperAction, undoAssignAction, voidPaperAction, updatePaperAnswerAction } from "@/app/dashboard/papers/actions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PaperAssignPanel } from "@/components/dashboard/PaperAssignPanel";
import { PaperAnswerCorrectionPanel, type BreakdownRow } from "@/components/dashboard/PaperAnswerCorrectionPanel";
import { isMissingColumnError } from "@/lib/supabase_errors";
import { buildPaperQuestionBreakdown } from "@/lib/item_analysis";
import { parseOptionOverrides, optionLabelsFor } from "@/lib/quiz_constraints";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function PaperIdentifyPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, school } = await getDashboardContext();

  // `prev_assignment` (20260812000000) habilita el "deshacer"; si la BD no la
  // tiene todavia, la pagina funciona igual pero sin ese boton. Lo mismo para
  // `answers/points/points_total/grade/corrected_*` (migraciones quiz_points y
  // dashboard_platform): sin ellas se degrada a no mostrar el detalle por
  // pregunta, en vez de romper la pantalla entera.
  const paperQuery = (select: string) =>
    supabase.from("papers").select(select).eq("id", id).eq("school_id", school.id).maybeSingle();
  const PAPER_COLUMNS = "id,quiz_id,student_id,student_name,status,name_img_url,image_url,score,total";
  const PAPER_COLUMNS_FULL = `${PAPER_COLUMNS},prev_assignment,answers,points,points_total,grade`;

  const [paperResult, { data: courses }] = await Promise.all([
    paperQuery(PAPER_COLUMNS_FULL),
    supabase.from("courses").select("id,name,grade").is("archived_at", null).order("name"),
  ]);
  let paperData = paperResult.data;
  if (paperResult.error) {
    paperData = (await paperQuery(`${PAPER_COLUMNS},prev_assignment`)).data
      ?? (await paperQuery(PAPER_COLUMNS)).data;
  }
  const paper = paperData as unknown as {
    id: string; quiz_id: string; student_id: string | null; student_name: string | null;
    status: string | null; name_img_url: string | null; image_url: string | null;
    score: number | null; total: number | null; prev_assignment?: unknown;
    answers?: unknown; points?: number | null; points_total?: number | null; grade?: number | null;
  } | null;
  if (!paper) notFound();

  // Antes esta pantalla se cerraba en cuanto el escaneo tenia alumno. Ahora
  // tambien sirve para CORREGIR una asignacion equivocada (el caso real: la
  // hoja se le adjudico a otro alumno), con confirmacion explicita.
  const assigned = paper.status !== "manual_review";
  const courseList = courses ?? [];

  // Detalle por pregunta: solo tiene sentido con una hoja ya identificada y
  // que trajo `answers` (columna de la migracion quiz_points; si no existe,
  // paperResult.error ya degrado el fetch y aqui simplemente no hay nada que mostrar).
  let breakdownRows: BreakdownRow[] = [];
  if (assigned && paper.answers !== undefined) {
    const { data: quiz } = await supabase
      .from("quizzes")
      .select("id,answer_key,num_questions,options_per_question,option_overrides,open_questions,multi_select_questions")
      .eq("id", paper.quiz_id)
      .eq("school_id", school.id)
      .maybeSingle();
    if (quiz) {
      const { data: metadataRaw } = await supabase
        .from("question_metadata")
        .select("question_number,axis_name,skill_name")
        .eq("quiz_id", paper.quiz_id);
      const rows = buildPaperQuestionBreakdown(
        { answers: paper.answers },
        quiz,
        (metadataRaw ?? []) as { question_number: number; axis_name: string | null; skill_name: string | null }[],
      );
      const numQ = Number(quiz.num_questions ?? rows.length);
      const overridesByQ = parseOptionOverrides(quiz.option_overrides ?? "", numQ);
      breakdownRows = rows.map((row) => ({
        ...row,
        options: optionLabelsFor(overridesByQ[row.q] ?? (Number(quiz.options_per_question) || 5)).split(""),
      }));
    }
  }

  return (
    <>
      {/* Salida siempre a la vista: se llega aquí desde el ensayo y lo normal es
          volver a él para seguir con la próxima hoja. */}
      <Link href={`/dashboard/quizzes/${paper.quiz_id}`} className="mb-3 inline-block text-sm font-semibold text-[#07305f] hover:underline">
        ← Volver al ensayo
      </Link>
      <PageHeader
        title={assigned ? (breakdownRows.length > 0 ? "Detalle de la hoja" : "Revisar identificación") : "Identificar alumno"}
        description={assigned
          ? "Respuesta del alumno vs. la clave del ensayo, y opción de reasignar si quedó con el alumno equivocado — se avisa antes de mover la nota."
          : "Este escaneo quedo en revision manual (RUT vacio o sin alumno coincidente). Usa el recorte del nombre para asignar el alumno correcto."}
      />

      {breakdownRows.length > 0 && (
        <div className="mb-6">
          <PaperAnswerCorrectionPanel
            paperId={paper.id}
            quizId={paper.quiz_id}
            rows={breakdownRows}
            action={updatePaperAnswerAction}
          />
        </div>
      )}

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
          <div className="rounded-md border border-[#e1e5ea] bg-white p-5 space-y-1">
            <p className="text-sm text-[#5b6472]">Correctas: <span className="font-semibold text-[#111827]">{paper.score ?? "-"}/{paper.total ?? "-"}</span></p>
            {paper.points != null && paper.points_total != null && (
              <p className="text-sm text-[#5b6472]">Puntaje: <span className="font-semibold text-[#111827]">{paper.points}/{paper.points_total}</span></p>
            )}
            {paper.grade != null && (
              <p className="text-sm text-[#5b6472]">Nota: <span className="font-semibold text-[#111827]">{paper.grade}</span></p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-[#111827]">
              {assigned ? "Corregir identificación" : "Asignar alumno existente"}
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
              voidAction={voidPaperAction}
              quizId={paper.quiz_id}
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
