"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { drawSheet, type Ctx2D } from "@/lib/sheet_render";
import { SHEET_W, SHEET_H } from "@/lib/sheet_layout";
import { SHEET_CODE_VERSION, type SheetCodeData } from "@/lib/sheet_code";

// RUT de prueba con DV valido (modulo 11): 12.345.678-5. Sirve para imprimir una
// hoja patron perfecta y verificar el lector de RUT sin depender del marcado a mano.
const DEFAULT_TEST_RUT = "12345678-5";

// Código demo para la hoja genérica de /sheet (sin prueba asociada). Cuando se
// genere desde una prueba real, el sheetId vendrá del id del paper/quiz.
const DEMO_CODE: SheetCodeData = { version: SHEET_CODE_VERSION, sheetId: 1, page: 1, pagesTotal: 1 };

export default function SheetPage() {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [fillRut, setFillRut] = useState(false);
  const [rut, setRut] = useState(DEFAULT_TEST_RUT);

  const marks = fillRut ? { rut, filled: true, code: DEMO_CODE } : { code: DEMO_CODE };

  // Render de vista previa (mismo codigo que la descarga y que el fixture).
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    canvas.width = SHEET_W;
    canvas.height = SHEET_H;
    const ctx = canvas.getContext("2d");
    if (ctx) drawSheet(ctx as unknown as Ctx2D, marks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillRut, rut]);

  const downloadPNG = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = SHEET_W * 2;
    canvas.height = SHEET_H * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);
    drawSheet(ctx as unknown as Ctx2D, marks);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fillRut ? `hoja_tulector_rut_${rut}.png` : "hoja_tulector.png";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">&larr; Inicio</Link>
        <h1 className="text-lg font-bold">Hoja de respuestas</h1>
        <button onClick={downloadPNG} className="px-3 py-1.5 bg-green-600 rounded-lg text-sm font-semibold hover:bg-green-500">
          Descargar PNG
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-xl overflow-hidden shadow-2xl">
          <canvas ref={previewRef} className="w-full h-auto block" style={{ aspectRatio: `${SHEET_W}/${SHEET_H}` }} />
        </div>

        {/* Hoja patron de RUT (DV valido) para probar el lector sin marcado a mano */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 text-sm">
          <label className="flex items-center gap-2 text-white font-semibold">
            <input type="checkbox" checked={fillRut} onChange={(e) => setFillRut(e.target.checked)} />
            Rellenar RUT de referencia (DV valido)
          </label>
          {fillRut && (
            <input
              value={rut}
              onChange={(e) => setRut(e.target.value.toUpperCase())}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 font-mono text-white"
              placeholder="12345678-5"
            />
          )}
          <p className="text-zinc-400">
            Imprime esta hoja con el RUT ya marcado para verificar el lector: si lo lee bien, la
            geometria esta correcta. Por defecto <strong className="text-white">12.345.678-5</strong> (DV 5 valido).
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2 text-sm text-zinc-400">
          <h3 className="text-white font-semibold">Instrucciones</h3>
          <p>1. Descarga el PNG o imprime (Ctrl+P)</p>
          <p>2. Rellena la burbuja completa con <strong className="text-white">lápiz negro grueso</strong></p>
          <p>3. Las 4 esquinas negras y las marcas del margen deben verse completas y sin tapar</p>
          <p>4. Escaneo <strong className="text-green-400">automático</strong> al apuntar la cámara</p>
        </div>
      </main>
    </div>
  );
}
