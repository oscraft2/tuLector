"use client";

import { useRef } from "react";
import Link from "next/link";

/* ─── Layout (debe coincidir con lib/omr.ts getLayout) ─── */
const M = 40, CS = 50;
const NAME_TOP = M + CS + 10;        // 100
const NAME_H = 35;
const NAME_BOTTOM = NAME_TOP + NAME_H; // 135
const ID_START = NAME_BOTTOM + 15;     // 150
const Q_TOP = ID_START + 3 * 28 + 30;  // 264
const Q_H = 42;

const NUM_Q = 20;
const OPTIONS = 5;
const LABELS = ["A","B","C","D","E"];
const ID_ROWS = 3, ID_COLS = 10;

/* ─── Canvas draw helpers ─── */
function drawSheet(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1200, 1650);

  // esquinas
  ctx.strokeStyle = "#000";
  const drawC = (x: number, y: number) => {
    ctx.lineWidth = 3; ctx.strokeRect(x, y, CS, CS);
    ctx.lineWidth = 1; ctx.strokeRect(x + 8, y + 8, CS - 16, CS - 16);
  };
  drawC(M, M); drawC(1200 - M - CS, M);
  drawC(M, 1650 - M - CS); drawC(1200 - M - CS, 1650 - M - CS);

  // nombre (debajo de la esquina TL, sin solapar)
  ctx.lineWidth = 2; ctx.strokeStyle = "#000";
  ctx.strokeRect(50, NAME_TOP, 400, NAME_H);
  ctx.font = "bold 18px sans-serif"; ctx.fillStyle = "#000";
  ctx.fillText("STUDENT NAME:", 55, NAME_TOP + 23);

  // ID bubbles
  ctx.font = "14px sans-serif";
  for (let row = 0; row < ID_ROWS; row++) {
    const y = ID_START + 10 + row * 28;
    ctx.fillText(String(row), 42, y + 5);
    for (let col = 0; col < ID_COLS; col++) {
      ctx.beginPath(); ctx.arc(70 + col * 28, y, 8, 0, Math.PI * 2);
      ctx.lineWidth = 1; ctx.stroke();
    }
  }

  // preguntas
  for (let q = 0; q < NUM_Q; q++) {
    const qy = Q_TOP + q * Q_H;
    ctx.font = "16px sans-serif"; ctx.fillText(`${q+1}.`, 50, qy + 20);
    for (let o = 0; o < OPTIONS; o++) {
      const ox = 90 + o * 50;
      ctx.beginPath(); ctx.arc(ox, qy + 16, 12, 0, Math.PI * 2);
      ctx.lineWidth = 1; ctx.stroke();
      ctx.font = "12px sans-serif"; ctx.fillText(LABELS[o], ox + 20, qy + 21);
    }
  }

  // key box (derecha)
  const keyX = 1000;
  ctx.strokeRect(keyX, 40, 180, NUM_Q * Q_H + 20);
  ctx.font = "bold 14px sans-serif"; ctx.fillText("KEY", keyX + 15, 65);
  for (let q = 0; q < NUM_Q; q++) {
    ctx.font = "12px sans-serif";
    ctx.fillText(`${q+1}: __`, keyX + 10, 75 + q * Q_H + 12);
  }
}

export default function SheetPage() {
  const sheetRef = useRef<HTMLDivElement>(null);

  const downloadPNG = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200 * 2; canvas.height = 1650 * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);
    drawSheet(ctx);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "hoja_tulector.png";
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
        {/* Preview SVG */}
        <div className="bg-white rounded-xl overflow-hidden shadow-2xl" ref={sheetRef}>
          <div className="bg-white text-black p-[3.33%]" style={{ aspectRatio: "1200/1650" }}>
            <svg viewBox="0 0 1200 1650" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="cornerTL" x="40" y="40" width="50" height="50" patternUnits="userSpaceOnUse">
                  <rect width="50" height="50" fill="none" stroke="black" strokeWidth="3"/>
                  <rect x="8" y="8" width="34" height="34" fill="none" stroke="black" strokeWidth="1"/>
                </pattern>
                <pattern id="cornerTR" x="0" y="0" width="1" height="1" patternUnits="userSpaceOnUse">
                  <rect x="1110" y="40" width="50" height="50" fill="none" stroke="black" strokeWidth="3"/>
                  <rect x="1118" y="48" width="34" height="34" fill="none" stroke="black" strokeWidth="1"/>
                </pattern>
                <pattern id="cornerBL" x="0" y="0" width="1" height="1" patternUnits="userSpaceOnUse">
                  <rect x="40" y="1560" width="50" height="50" fill="none" stroke="black" strokeWidth="3"/>
                  <rect x="48" y="1568" width="34" height="34" fill="none" stroke="black" strokeWidth="1"/>
                </pattern>
                <pattern id="cornerBR" x="0" y="0" width="1" height="1" patternUnits="userSpaceOnUse">
                  <rect x="1110" y="1560" width="50" height="50" fill="none" stroke="black" strokeWidth="3"/>
                  <rect x="1118" y="1568" width="34" height="34" fill="none" stroke="black" strokeWidth="1"/>
                </pattern>
              </defs>
              {/* Esquinas (usando rect directo, mas simple) */}
              <rect x="40" y="40" width="50" height="50" fill="none" stroke="black" strokeWidth="3"/>
              <rect x="48" y="48" width="34" height="34" fill="none" stroke="black" strokeWidth="1"/>
              <rect x="1110" y="40" width="50" height="50" fill="none" stroke="black" strokeWidth="3"/>
              <rect x="1118" y="48" width="34" height="34" fill="none" stroke="black" strokeWidth="1"/>
              <rect x="40" y="1560" width="50" height="50" fill="none" stroke="black" strokeWidth="3"/>
              <rect x="48" y="1568" width="34" height="34" fill="none" stroke="black" strokeWidth="1"/>
              <rect x="1110" y="1560" width="50" height="50" fill="none" stroke="black" strokeWidth="3"/>
              <rect x="1118" y="1568" width="34" height="34" fill="none" stroke="black" strokeWidth="1"/>

              {/* Nombre (debajo de esquina TL, sin solapar) */}
              <rect x="50" y={NAME_TOP} width="400" height={NAME_H} fill="none" stroke="black" strokeWidth="2"/>
              <text x="55" y={NAME_TOP + 23} fontFamily="sans-serif" fontSize="18" fontWeight="bold" fill="black">STUDENT NAME:</text>

              {/* ID bubbles */}
              {Array.from({ length: ID_ROWS }, (_, row) =>
                Array.from({ length: ID_COLS }, (_, col) => (
                  <g key={`id${row}${col}`}>
                    <circle cx={70 + col * 28} cy={ID_START + 10 + row * 28} r="8" fill="none" stroke="black"/>
                    {col === 0 && <text x="42" y={ID_START + 15 + row * 28} fontFamily="sans-serif" fontSize="14" fill="black">{row}</text>}
                  </g>
                ))
              )}

              {/* Preguntas */}
              {Array.from({ length: NUM_Q }, (_, q) => {
                const qy = Q_TOP + q * Q_H;
                return (
                  <g key={`q${q}`}>
                    <text x="50" y={qy + 20} fontFamily="sans-serif" fontSize="16" fill="black">{q + 1}.</text>
                    {Array.from({ length: OPTIONS }, (_, o) => (
                      <g key={`q${q}o${o}`}>
                        <circle cx={90 + o * 50} cy={qy + 16} r="12" fill="none" stroke="black"/>
                        <text x={110 + o * 50} y={qy + 21} fontFamily="sans-serif" fontSize="12" fill="black">{LABELS[o]}</text>
                      </g>
                    ))}
                  </g>
                );
              })}

              {/* Key box */}
              <rect x="1000" y="40" width="180" height={NUM_Q * Q_H + 20} fill="none" stroke="black"/>
              <text x="1015" y="65" fontFamily="sans-serif" fontSize="14" fontWeight="bold" fill="black">KEY</text>
              {Array.from({ length: NUM_Q }, (_, q) => (
                <text key={`k${q}`} x="1010" y={75 + q * Q_H + 12} fontFamily="sans-serif" fontSize="12" fill="black">{q + 1}: __</text>
              ))}
            </svg>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2 text-sm text-zinc-400">
          <h3 className="text-white font-semibold">Instrucciones</h3>
          <p>1. Descarga el PNG o imprime (Ctrl+P)</p>
          <p>2. Rellena burbujas con <strong className="text-white">lapiz negro grueso</strong></p>
          <p>3. Las 4 esquinas deben ser visibles y sin obstruir</p>
          <p>4. Escaneo <strong className="text-green-400">automatico</strong> al apuntar la camara</p>
        </div>
      </main>
    </div>
  );
}
