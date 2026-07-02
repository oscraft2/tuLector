import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { assignPaperStudent, createStudentAndAssignPaper } from "@/app/dashboard/actions";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function PaperIdentifyPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, school } = await getDashboardContext();

  const [{ data: paper }, { data: students }, { data: courses }] = await Promise.all([
    supabase
      .from("papers")
      .select("id,quiz_id,student_id,student_name,status,name_img_url,image_url,score,total")
      .eq("id", id)
      .eq("school_id", school.id)
      .single(),
    supabase.from("students").select("student_id,rut,name,course").eq("school_id", school.id).order("name"),
    supabase.from("courses").select("id,name,grade").order("name"),
  ]);
  if (!paper) notFound();

  if (paper.status !== "manual_review") {
    return (
      <>
        <PageHeader title="Paper ya identificado" description="Este escaneo ya tiene un alumno asignado." />
        <div className="rounded-md border border-[#e1e5ea] bg-white p-5">
          <p className="text-sm text-[#5b6472]">
            Alumno: <span className="font-semibold text-[#111827]">{paper.student_name ?? paper.student_id ?? "-"}</span>
          </p>
          <Link href={`/dashboard/results/${paper.quiz_id}`} className="mt-4 inline-block font-semibold underline">Ver resultado</Link>
        </div>
      </>
    );
  }

  const courseList = courses ?? [];

  return (
    <>
      <PageHeader title="Identificar alumno" description="Este escaneo quedo en revision manual (RUT vacio o sin alumno coincidente). Usa el recorte del nombre para asignar el alumno correcto." />
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
            <h2 className="text-lg font-semibold text-[#111827]">Asignar alumno existente</h2>
            <form action={assignPaperStudent} className="space-y-3">
              <input type="hidden" name="paper_id" value={paper.id} />
              <select name="student_id" required className="w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-sm">
                <option value="">Selecciona alumno</option>
                {(students ?? []).map((s) => (
                  <option key={s.student_id} value={s.rut ?? s.student_id}>{s.name} ({s.course ?? "-"})</option>
                ))}
              </select>
              <button type="submit" disabled={(students ?? []).length === 0} className="w-full rounded-md bg-[#07305f] py-2 text-sm font-semibold text-white hover:bg-[#062447] disabled:opacity-50">
                Asignar alumno
              </button>
            </form>
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
