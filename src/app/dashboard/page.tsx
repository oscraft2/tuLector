import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages, formatNumber } from "@/locales";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { QuotaBar } from "@/components/dashboard/QuotaBar";
import { LanguageSwitcher } from "@/components/dashboard/LanguageSwitcher";
import { checkAndTriggerQuotaAlerts } from "@/lib/quota_alerts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, school, countryProfile, locale, user, userSchools } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const [{ count: quizzesCount }, { count: studentsCount }, { data: papers }, { data: quizzes }] = await Promise.all([
    supabase.from("quizzes").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("papers").select("id, score, total, status, scanned_at, quiz_id").order("scanned_at", { ascending: false }).limit(5),
    supabase.from("quizzes").select("id, title, subject, grade, created_at").is("archived_at", null).order("created_at", { ascending: false }).limit(5),
    checkAndTriggerQuotaAlerts(school.id),
  ]);
  const scansUsed = school.scans_used ?? 0;
  const scansLimit = school.scans_limit ?? 0;
  const validPapers = papers?.filter((p) => typeof p.score === "number" && typeof p.total === "number") ?? [];
  const avg = validPapers.length ? Math.round(validPapers.reduce((sum, p) => sum + ((p.score ?? 0) / Math.max(1, p.total ?? 1)) * 100, 0) / validPapers.length) : 0;

  return (
    <>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">TuLector School</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{t.dashboard}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b6472]">Consola web para administrar cursos, alumnos, ensayos, claves, resultados y exportaciones. La lectura OMR ocurre desde la app movil sincronizada.</p>
      </div>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-md border border-[#e6e8eb] bg-white p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">{school.name}</p>
            <p className="mt-1 text-sm text-[#4b5563]">Plan {school.plan} · {countryProfile.profileName}</p>
          </div>
          <LanguageSwitcher locale={locale} />
        </div>

        <section className="rounded-md border border-[#d8dde3] bg-white p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#07305f]">{countryProfile.flag} {countryProfile.profileName} activo</p>
              <h2 className="mt-2 text-xl font-semibold">Estandarizacion del lector</h2>
              <p className="mt-2 text-sm leading-6 text-[#5b6472]">{countryProfile.dashboardSummary}</p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[420px]">
              <ProfileFact label="Identificador" value={`${countryProfile.studentIdLabel} (${countryProfile.studentIdExample})`} />
              <ProfileFact label="Notas" value={countryProfile.grading.display} />
              <ProfileFact label="Evaluaciones" value={countryProfile.evaluationSystems.join(" / ")} />
              <ProfileFact label="Formato" value={countryProfile.ministryFormat} />
            </div>
          </div>
        </section>

        <KPIGrid>
          <KPI label="Ensayos activos" value={formatNumber(quizzesCount ?? 0, locale)} detail="sin archivar" />
          <KPI label="Alumnos" value={formatNumber(studentsCount ?? 0, locale)} detail="por colegio" />
          <KPI label="Lecturas app" value={formatNumber(papers?.length ?? 0, locale)} detail="ultimas sincronizadas" />
          <KPI label="Promedio reciente" value={`${avg}%`} detail="ultimas lecturas" />
        </KPIGrid>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-md border border-[#e6e8eb] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Ensayos recientes</h2>
              <Link href="/dashboard/quizzes" className="text-sm font-semibold text-[#4b5563] hover:text-[#111827]">Ver todos</Link>
            </div>
            <DataTable
              columns={["Ensayo", "Asignatura", "Curso", "Accion"]}
              rows={quizzes ?? []}
              empty="Crea tu primer ensayo para generar hojas y sincronizar la app."
              renderRow={(quiz) => (
                <tr key={quiz.id} className="border-b border-[#eef0f3] last:border-0">
                  <td className="px-5 py-4 font-semibold">{quiz.title}</td>
                  <td className="px-5 py-4 text-[#4b5563]">{quiz.subject ?? "-"}</td>
                  <td className="px-5 py-4 text-[#4b5563]">{quiz.grade ?? "-"}</td>
                  <td className="px-5 py-4"><Link href={`/dashboard/quizzes/${quiz.id}`} className="font-semibold underline">Abrir</Link></td>
                </tr>
              )}
            />
          </div>

          <div className="space-y-6">
            <div className="rounded-md border border-[#e6e8eb] bg-white p-5"><QuotaBar used={scansUsed} limit={scansLimit} /></div>
            <div className="rounded-md border border-[#e6e8eb] bg-white p-5">
              <h2 className="text-base font-semibold">Flujo correcto</h2>
              <div className="mt-4 grid gap-3 text-sm">
                <Link href="/dashboard/quizzes" className="rounded-md border border-[#e6e8eb] px-4 py-3 font-semibold">1. Crear ensayo y clave</Link>
                <Link href="/sheet" className="rounded-md border border-[#e6e8eb] px-4 py-3 font-semibold">2. Generar hoja v2</Link>
                <Link href="/scan" className="rounded-md border border-[#e6e8eb] px-4 py-3 font-semibold">3. Leer desde app movil</Link>
                <Link href="/dashboard/papers" className="rounded-md border border-[#e6e8eb] px-4 py-3 font-semibold">4. Revisar y exportar</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e6e8eb] bg-[#f8fafc] px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">{label}</p>
      <p className="mt-1 font-semibold text-[#111827]">{value}</p>
    </div>
  );
}
