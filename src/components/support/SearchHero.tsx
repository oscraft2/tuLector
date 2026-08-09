"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SearchHero({ locale }: { locale: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/${locale}/ayuda?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className="bg-[#0a0a0a] text-white py-16 px-6 mb-12 rounded-xl text-center">
      <h2 className="text-3xl font-bold mb-4">¿En qué podemos ayudarte?</h2>
      <p className="text-gray-300 mb-8 max-w-xl mx-auto">
        Busca en nuestro Centro de Ayuda antes de crear un ticket. Es probable que tu duda ya esté resuelta allí.
      </p>
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto relative text-black">
        <input 
          type="text" 
          placeholder="Ej: ¿Cómo escaneo las hojas?" 
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-full py-4 pl-6 pr-32 focus:outline-none focus:ring-4 focus:ring-blue-500/30 text-lg shadow-lg"
        />
        <button 
          type="submit" 
          className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white font-bold px-6 rounded-full hover:bg-blue-700 transition-colors"
        >
          Buscar
        </button>
      </form>
    </div>
  );
}
