"use client";

import { useState } from "react";
import { replyTicketAction } from "./actions";

export function TicketThread({ messages }: { messages: any[] }) {
  if (!messages || messages.length === 0) {
    return <p className="text-gray-500 italic">No hay mensajes en este hilo.</p>;
  }

  return (
    <div className="space-y-6">
      {messages.map((m, idx) => {
        const isStaff = m.author_type === "staff";
        return (
          <div key={m.id || idx} className={`flex flex-col ${isStaff ? "items-start" : "items-end"}`}>
            <div className={`max-w-[85%] rounded-2xl px-5 py-3 ${isStaff ? "bg-[#eef4ff] text-[#07305f] rounded-tl-sm" : "bg-[#111827] text-white rounded-tr-sm"}`}>
              <p className="text-xs font-semibold mb-1 opacity-70">
                {isStaff ? "Equipo TuLector" : "Tú"} • {new Date(m.created_at).toLocaleString()}
              </p>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {m.body}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

TicketThread.ReplyForm = function ReplyForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.append("token", token);

    try {
      await replyTicketAction(formData);
      (e.target as HTMLFormElement).reset();
      // Refrescar página para ver el mensaje nuevo
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "No se pudo enviar la respuesta.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <textarea 
        name="body" 
        rows={3} 
        placeholder="Escribe tu respuesta aquí..." 
        required 
        className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex justify-end">
        <button 
          disabled={loading} 
          className="bg-[#0a0a0a] text-white px-6 py-2 rounded-md font-semibold text-sm hover:bg-[#111] transition-colors disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar Respuesta"}
        </button>
      </div>
    </form>
  );
}
