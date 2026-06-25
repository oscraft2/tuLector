"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { drawSheet, type Ctx2D } from "@/lib/sheet_render";
import { SHEET_W, SHEET_H } from "@/lib/sheet_layout";

export default function SheetPage() {
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Render de vista previa (mismo codigo que la descarga y que el fixture).
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    canvas.width = SHEET_W;
    canvas.height = SHEET_H;
    const ctx = canvas.getContext("2d");
    if (ctx) drawSheet(ctx as unknown as Ctx2D);
  }, []);

  const downloadPNG = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = SHEET_W * 2;
    canvas.height = SHEET_H * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);
    drawSheet(ctx as unknown as Ctx2D);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hoja_tulector.png";
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
