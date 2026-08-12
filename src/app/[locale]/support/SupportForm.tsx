"use client";

import { useState } from "react";
import { createAuthenticatedTicketAction, createTicketAction } from "./actions";

type SupportFormProps = {
  locale: string;
  mode?: "public" | "dashboard";
  defaultName?: string;
  defaultEmail?: string;
};

export function SupportForm({ locale, mode = "public", defaultName = "", defaultEmail = "" }: SupportFormProps) {
  const [loading, setLoading] = useState(false);
  const [successLink, setSuccessLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.append("locale", locale);

    try {
       const action = mode === "dashboard" ? createAuthenticatedTicketAction : createTicketAction;
       const token = await action(formData);
       setSuccessLink(`/t/${token}`);
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  if (successLink) {
    return (
      <div className="bg-green-50 p-6 rounded-lg border border-green-100">
        <h2 className="text-green-800 font-bold text-xl mb-2">¡Ticket creado exitosamente!</h2>
        <p className="text-green-700 mb-6">Hemos enviado un correo con el acceso a tu ticket. También puedes verlo directamente aquí:</p>
        <a href={successLink} className="inline-block bg-green-600 text-white font-semibold px-6 py-3 rounded-lg shadow hover:bg-green-700 transition-colors">
          Ver mi ticket
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 text-red-700 p-4 rounded-md text-sm">{error}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
           <input type="text" id="name" name="name" defaultValue={defaultName} maxLength={120} required className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
           <input type="email" id="email" name="email" defaultValue={defaultEmail} maxLength={320} required className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
         <input type="text" id="subject" name="subject" maxLength={160} required className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
         <textarea id="message" name="message" rows={5} maxLength={10000} required className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
      </div>

      <button disabled={loading} type="submit" className="w-full bg-[#0a0a0a] text-white font-semibold rounded py-3 hover:bg-[#111] transition-colors disabled:opacity-50">
        {loading ? "Enviando..." : "Enviar Solicitud"}
      </button>
    </form>
  );
}
