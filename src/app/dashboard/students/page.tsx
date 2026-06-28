import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { CSVImport } from "@/components/dashboard/CSVImport";
import { DataTable } from "@/components/dashboard/DataTable";
import { importStudents, logExport } from "@/app/dashboard/actions";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const { supabase, locale, isAdmin } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const { data: students } = await supabase.from("students").select("id,student_id,rut,name,course,grade,created_at").order("name");
  return (
    <>
      <PageHeader title={t.students} description="Administra alumnos por RUT, nombre y curso. La importacion valida RUT chileno y evita duplicados por colegio." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <CSVImport action={importStudents} />
        <div className="space-y-4">
          <div className="flex justify-end">
            <form action={logExport}><input type="hidden" name="export_type" value="students_csv" /><input type="hidden" name="entity_type" value="students" /><button disabled={!isAdmin} className="rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold disabled:opacity-50">Exportar CSV</button></form>
          </div>
          <DataTable columns={["RUT/ID", "Nombre", "Curso", "Registro"]} rows={students ?? []} empty="No hay alumnos importados." renderRow={(student) => (
            <tr key={student.id} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-mono text-sm">{student.rut ?? student.student_id}</td><td className="px-5 py-4 font-semibold">{student.name}</td><td className="px-5 py-4 text-[#5b6472]">{student.course ?? student.grade ?? "-"}</td><td className="px-5 py-4 text-[#5b6472]">{new Date(student.created_at).toLocaleDateString("es-CL")}</td></tr>
          )} />
        </div>
      </div>
    </>
  );
}
