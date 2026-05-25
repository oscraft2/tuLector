"use client";

import { useRef } from "react";
import Link from "next/link";

const NUM_Q = 20;
const OPTIONS = 5;
const LABELS = ["A", "B", "C", "D", "E"];
const ID_ROWS = 3;
const ID_COLS = 10;

export default function SheetPage() {
  const sheetRef = useRef<HTMLDivElement>(null);

  const downloadPNG = async () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const scale = 2;
    canvas.width = 1200 * scale;
    canvas.height = 1650 * scale;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1200, 1650);

    const drawCorner = (x: number, y: number) => {
      ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 50, 50);
      ctx.lineWidth = 1; ctx.strokeRect(x + 8, y + 8, 34, 34);
    };
    drawCorner(40, 40); drawCorner(1110, 40);
    drawCorner(40, 1560); drawCorner(1110, 1560);

    ctx.font = "bold 18px sans-serif"; ctx.fillStyle = "#000";
    ctx.fillText("STUDENT NAME:", 50, 90);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
    ctx.strokeRect(50, 70, 400, 30);

    ctx.font = "14px sans-serif";
    for (let row = 0; row < ID_ROWS; row++) {
      const y = 130 + row * 28;
      ctx.fillText(String(row), 42, y + 5);
      for (let col = 0; col < ID_COLS; col++) {
        ctx.beginPath();
        ctx.arc(70 + col * 28, y, 8, 0, Math.PI * 2);
        ctx.lineWidth = 1; ctx.stroke();
      }
    }

    const qTop = 130 + ID_ROWS * 28 + 30;
    for (let q = 0; q < NUM_Q; q++) {
      const qy = qTop + q * 42;
      ctx.font = "16px sans-serif";
      ctx.fillText(`${q + 1}.`, 50, qy + 20);
      for (let o = 0; o < OPTIONS; o++) {
        const ox = 90 + o * 50;
        ctx.beginPath(); ctx.arc(ox, qy + 16, 12, 0, Math.PI * 2);
        ctx.lineWidth = 1; ctx.stroke();
        ctx.font = "12px sans-serif"; ctx.fillText(LABELS[o], ox + 20, qy + 21);
      }
    }

    const keyX = 1000;
    ctx.strokeRect(keyX, 40, 180, NUM_Q * 42 + 20);
    ctx.font = "bold 14px sans-serif"; ctx.fillText("KEY", keyX + 15, 65);
    for (let q = 0; q < NUM_Q; q++) {
      ctx.font = "12px sans-serif";
      ctx.fillText(`${q + 1}: __`, keyX + 10, 75 + q * 42 + 12);
    }

    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "hoja_respuestas_tulector.png";
    a.click(); URL.revokeObjectURL(url);
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
        <div className="bg-white rounded-xl overflow-hidden shadow-2xl" ref={sheetRef}>
          <div className="bg-white text-black p-[3.33%]" style={{ aspectRatio: "1200/1650" }}>
            <svg viewBox="0 0 1200 1650" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <rect x="40" y="40" width="50" height="50" fill="none" stroke="black" strokeWidth="3" />
              <rect x="48" y="48" width="34" height="34" fill="none" stroke="black" strokeWidth="1" />
              <rect x="1110" y="40" width="50" height="50" fill="none" stroke="black" strokeWidth="3" />
              <rect x="1118" y="48" width="34" height="34" fill="none" stroke="black" strokeWidth="1" />
              <rect x="40" y="1560" width="50" height="50" fill="none" stroke="black" strokeWidth="3" />
              <rect x="48" y="1568" width="34" height="34" fill="none" stroke="black" strokeWidth="1" />
              <rect x="1110" y="1560" width="50" height="50" fill="none" stroke="black" strokeWidth="3" />
              <rect x="1118" y="1568" width="34" height="34" fill="none" stroke="black" strokeWidth="1" />
              <rect x="50" y="70" width="400" height="30" fill="none" stroke="black" strokeWidth="2" />
              <text x="55" y="90" fontFamily="sans-serif" fontSize="18" fontWeight="bold" fill="black">STUDENT NAME:</text>
              {Array.from({ length: ID_ROWS }, (_, row) =>
                Array.from({ length: ID_COLS }, (_, col) => (
                  <g key={`id${row}${col}`}>
                    <circle cx={70 + col * 28} cy={130 + row * 28} r="8" fill="none" stroke="black" />
                    {col === 0 && <text x="42" y={135 + row * 28} fontFamily="sans-serif" fontSize="14" fill="black">{row}</text>}
                  </g>
                ))
              )}
              {Array.from({ length: NUM_Q }, (_, q) => {
                const qy = 130 + ID_ROWS * 28 + 30 + q * 42;
                return (
                  <g key={`q${q}`}>
                    <text x="50" y={qy + 20} fontFamily="sans-serif" fontSize="16" fill="black">{q + 1}.</text>
                    {Array.from({ length: OPTIONS }, (_, o) => (
                      <g key={`q${q}o${o}`}>
                        <circle cx={90 + o * 50} cy={qy + 16} r="12" fill="none" stroke="black" />
                        <text x={110 + o * 50} y={qy + 21} fontFamily="sans-serif" fontSize="12" fill="black">{LABELS[o]}</text>
                      </g>
                    ))}
                  </g>
                );
              })}
              <rect x="1000" y="40" width="180" height={NUM_Q * 42 + 20} fill="none" stroke="black" />
              <text x="1015" y="65" fontFamily="sans-serif" fontSize="14" fontWeight="bold" fill="black">KEY</text>
              {Array.from({ length: NUM_Q }, (_, q) => (
                <text key={`k${q}`} x="1010" y={75 + q * 42 + 12} fontFamily="sans-serif" fontSize="12" fill="black">{q + 1}: __</text>
              ))}
            </svg>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2 text-sm text-zinc-400">
          <h3 className="text-white font-semibold">Instrucciones</h3>
          <p>1. Descarga el PNG o imprime (Ctrl+P)</p>
          <p>2. Rellena burbujas con <strong className="text-white">lapiz negro grueso</strong></p>
          <p>3. Las 4 esquinas deben ser visibles</p>
          <p>4. Escaneo <strong className="text-green-400">automatico</strong> al apuntar la camara</p>
        </div>
      </main>
    </div>
  );
}
