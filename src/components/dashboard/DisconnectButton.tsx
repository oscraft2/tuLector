"use client";

import { useState } from "react";
import { disconnectSchool } from "@/app/dashboard/actions";

export function DisconnectButton() {
  const [loading, setLoading] = useState(false);

  const handleDisconnect = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const confirmed = window.confirm(
      "¿Estás seguro de que deseas desvincularte de esta institución?\n\nPerderás acceso inmediato a todos sus ensayos, alumnos y reportes. Serás redirigido para seleccionar o crear un nuevo colegio."
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      // Trigger the server action
      await disconnectSchool();
    } catch (err) {
      console.error("Error disconnecting school:", err);
      alert("Ocurrió un error al intentar desvincular el colegio.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleDisconnect} className="mt-4">
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
      >
        {loading ? "Desvinculando..." : "Desvincular institución"}
      </button>
    </form>
  );
}
