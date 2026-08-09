"use client";

import { useState } from "react";
import Link from "next/link";
import { faqVoteAction } from "./actions";

export function FaqVoteForm({ articleId, locale }: { articleId: string, locale: string }) {
  const [voted, setVoted] = useState<"yes" | "no" | null>(null);

  async function handleVote(helpful: boolean) {
    if (voted) return;
    setVoted(helpful ? "yes" : "no");
    await faqVoteAction(articleId, helpful);
  }

  if (voted === "yes") {
    return <p className="text-green-600 font-semibold">¡Gracias por tu opinión!</p>;
  }

  if (voted === "no") {
    return (
      <div className="bg-red-50 p-6 rounded-lg border border-red-100 inline-block text-left">
        <p className="text-red-800 font-medium mb-4">Lamentamos que el artículo no haya resuelto tu duda.</p>
        <p className="text-red-700 text-sm mb-4">Te sugerimos contactar a nuestro equipo de soporte directamente para que podamos ayudarte mejor.</p>
        <Link href={`/${locale}/support`} className="inline-block bg-red-600 text-white font-semibold px-4 py-2 rounded shadow hover:bg-red-700 transition-colors">
          Contactar Soporte
        </Link>
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-4">
      <button 
        onClick={() => handleVote(true)}
        className="flex items-center gap-2 border-2 border-green-600 text-green-700 hover:bg-green-600 hover:text-white px-6 py-2 rounded font-semibold transition-colors"
      >
        <span>👍</span> Sí, me sirvió
      </button>
      <button 
        onClick={() => handleVote(false)}
        className="flex items-center gap-2 border-2 border-gray-300 text-gray-700 hover:bg-gray-100 px-6 py-2 rounded font-semibold transition-colors"
      >
        <span>👎</span> No del todo
      </button>
    </div>
  );
}
