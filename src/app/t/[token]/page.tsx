import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { TicketThread } from "./TicketThread";

export const dynamic = "force-dynamic";

export default async function PublicTicketPage({ params }: { params: { token: string } }) {
  const { token } = params;
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    notFound();
  }

  // Utilizamos el admin client (que esquiva RLS) SOLO para llamar a get_ticket_by_token 
  // que internamente filtra de manera segura (SECURITY DEFINER).
  // Nota: También se puede usar el server client anónimo porque la función está GRANT a anon,
  // pero el adminClient garantiza ejecución en el backend de forma rápida.
  const adminClient = createSupabaseAdminClient();
  const { data: ticketRows, error } = await adminClient.rpc("get_ticket_by_token", { p_token: token });

  if (error || !ticketRows || ticketRows.length === 0) {
    notFound();
  }

  // El RPC devuelve tabla con join, así que agrupamos
  const ticket = {
    id: ticketRows[0].ticket_id,
    subject: ticketRows[0].subject,
    status: ticketRows[0].status,
    locale: ticketRows[0].locale,
    created_at: ticketRows[0].created_at,
    messages: ticketRows.map((r: any) => ({
      id: r.msg_id,
      author_type: r.msg_author_type,
      body: r.msg_body,
      created_at: r.msg_created_at,
    })).filter((m: any) => m.id != null) // Filtrar nulos si no hay mensajes
  };

  const STATUS_LABELS: Record<string, string> = { open: "Abierto", pending: "En revisión", resolved: "Resuelto", closed: "Cerrado" };
  const STATUS_COLORS: Record<string, string> = {
    open: "bg-blue-100 text-blue-800",
    pending: "bg-amber-100 text-amber-800",
    resolved: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-800"
  };

  return (
    <>
      <PublicHeader currentLocale={ticket.locale} />
      <main className="min-h-screen bg-[#fafafa] py-16 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Cabecera del Ticket */}
          <div className="bg-white p-6 rounded-t-xl shadow-sm border border-[#e5e7eb] mb-px flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">{ticket.subject}</h1>
              <p className="text-sm text-[#6b7280] mt-1">Ticket creado el {new Date(ticket.created_at).toLocaleDateString(ticket.locale)}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[ticket.status] || STATUS_COLORS.open}`}>
              {STATUS_LABELS[ticket.status] || ticket.status}
            </span>
          </div>

          {/* Hilo de Mensajes */}
          <div className="bg-white p-6 shadow-sm border-x border-[#e5e7eb]">
            <TicketThread messages={ticket.messages} />
          </div>

          {/* Formulario de Respuesta (solo si no está cerrado) */}
          <div className="bg-[#f8fafc] p-6 rounded-b-xl shadow-sm border border-[#e5e7eb] border-t-0">
            {ticket.status === "closed" ? (
              <p className="text-center text-[#6b7280]">Este ticket está cerrado. Si necesitas más ayuda, abre uno nuevo.</p>
            ) : (
              <TicketThread.ReplyForm token={token} />
            )}
          </div>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
