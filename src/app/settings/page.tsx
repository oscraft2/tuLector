"use client";

import { useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [courses, setCourses] = useState([
    { id: "1", name: "1° Medio A" },
    { id: "2", name: "2° Medio B" },
  ]);
  const [newCourse, setNewCourse] = useState("");

  const addCourse = () => {
    if (!newCourse.trim()) return;
    setCourses([...courses, { id: Date.now().toString(), name: newCourse }]);
    setNewCourse("");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">&larr; Volver</Link>
        <h1 className="text-base font-bold">Configuración</h1>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Gestión de Cursos</h2>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newCourse}
              onChange={(e) => setNewCourse(e.target.value)}
              placeholder="Nombre del nuevo curso..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <button
              onClick={addCourse}
              className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Añadir
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {courses.map((c, i) => (
              <div
                key={c.id}
                className={`flex justify-between items-center p-3 text-sm ${
                  i !== courses.length - 1 ? "border-b border-zinc-800" : ""
                }`}
              >
                <span>{c.name}</span>
                <button className="text-zinc-500 hover:text-red-400">Eliminar</button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Sistema</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">Modo Offline</p>
                <p className="text-xs text-zinc-500">Guardar escaneos localmente</p>
              </div>
              <div className="w-10 h-6 bg-green-600 rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
