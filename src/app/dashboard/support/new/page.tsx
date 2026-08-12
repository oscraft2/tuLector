import { getDashboardContext } from "@/lib/supabase_server";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SupportForm } from "@/app/[locale]/support/SupportForm";
import { SearchHero } from "@/components/support/SearchHero";

export const dynamic = "force-dynamic";

export default async function NewTicketDashboardPage() {
  const { locale, school, user } = await getDashboardContext();

  return (
    <>
      <PageHeader title="Nuevo Ticket de Soporte" description="Envía tus consultas a nuestro equipo de ayuda." />
      <SearchHero locale={locale} />
      <div className="max-w-2xl bg-white p-6 rounded-xl shadow-sm border border-[#e5e7eb] mx-auto mt-8">
        <h2 className="text-2xl font-bold mb-4">Contactar Soporte</h2>
        <p className="text-[#4b5563] mb-6">
          Los tickets creados aquí quedarán vinculados a tu cuenta y podrás darles seguimiento desde el dashboard o vía correo.
        </p>
        
        <SupportForm locale={locale} />
      </div>
    </>
  );
}
