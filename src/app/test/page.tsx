"use client";

import { useState } from "react";
import Link from "next/link";
import { TEST_IMAGE_BASE64, EXPECTED_ANSWERS, EXPECTED_ID } from "./test_image";
import { findCorners, warpPerspective, gradeBubbles, readStudentId, type BubbleResult } from "@/lib/omr";

export default function TestPage() {
  const [log, setLog] = useState<string[]>([]);
  const [results, setResults] = useState<BubbleResult[]>([]);
  const [running, setRunning] = useState(false);
  const [passed, setPassed] = useState(false);

  const addLog = (msg: string) => setLog((p) => [...p, msg]);

  const runTests = async () => {
    setRunning(true);
    setLog([]);
    setPassed(false);
    setResults([]);

    try {
      // ─── Cargar imagen ───
      const img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = TEST_IMAGE_BASE64; });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const d = imageData.data;
      addLog(`[IMG] ${canvas.width}x${canvas.height}  data.length=${d.length}  channels=${d.length / (canvas.width * canvas.height)}`);

      // Stats de pixeles
      let darkPx = 0, minV = 255, maxV = 0;
      const grayArr = new Uint8Array(canvas.width * canvas.height);
      for (let i = 0; i < grayArr.length; i++) {
        const j = i * 4;
        const v = Math.round(d[j] * 0.299 + d[j+1] * 0.587 + d[j+2] * 0.114);
        grayArr[i] = v;
        if (v < 128) darkPx++;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
      addLog(`[GRAY] min=${minV} max=${maxV}  dark(<128)=${darkPx} (${(darkPx/grayArr.length*100).toFixed(1)}%)`);

      // Muestrear pixeles en posiciones clave
      const sampleAt = (x: number, y: number) => {
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
          const g = grayArr[y * canvas.width + x];
          return `${(x+","+y).padEnd(10)} gray=${g}`;
        }
        return `${(x+","+y).padEnd(10)} OOB`;
      };
      addLog(`[SAMPLE] TL corner area:   ${sampleAt(65, 65)}`);
      addLog(`[SAMPLE] TL corner area:   ${sampleAt(40, 40)}  ${sampleAt(90, 40)}`);
      addLog(`[SAMPLE] TL corner area:   ${sampleAt(40, 90)}  ${sampleAt(90, 90)}`);
      addLog(`[SAMPLE] TR corner area:   ${sampleAt(1135, 65)}  ${sampleAt(1110, 65)}`);
      addLog(`[SAMPLE] Q1 bubble A:      ${sampleAt(90, 264+16)}`);
      addLog(`[SAMPLE] Q1 bubble B:      ${sampleAt(140, 264+16)}`);

      // ─── Esquinas ───
      const corners = findCorners(imageData);
      if (!corners) { addLog("[CORNERS] NULL - no detectadas"); setRunning(false); return; }
      addLog(`[CORNERS] TL=(${corners[0][0]},${corners[0][1]})  TR=(${corners[1][0]},${corners[1][1]})  BR=(${corners[2][0]},${corners[2][1]})  BL=(${corners[3][0]},${corners[3][1]})`);
      addLog(`[CORNERS] Esperado: TL=(65,65) TR=(1135,65) BR=(1135,1585) BL=(65,1585)`);

      // ─── Warp ───
      const warped = warpPerspective(ctx, corners);
      addLog(`[WARP] ${warped.width}x${warped.height}  length=${warped.data.length}`);
      // Check dark pixels in warped
      let wDark = 0;
      for (let i = 0; i < warped.width * warped.height; i++) {
        const j = i * 4;
        const v = Math.round(warped.data[j] * 0.299 + warped.data[j+1] * 0.587 + warped.data[j+2] * 0.114);
        if (v < 128) wDark++;
      }
      addLog(`[WARP] pixeles oscuros: ${wDark} (${(wDark/(warped.width*warped.height)*100).toFixed(1)}%)`);

      // ─── Burbujas ───
      const report = gradeBubbles(warped);
      const bubbleResults = report.results;
      setResults(bubbleResults);
      addLog(`[BUBBLES] valid=${report.valid} ${report.reason || ""}`);

      let correct = 0;
      addLog(`[BUBBLES] Q   ans  esp  scores (top 5)`);
      for (let i = 0; i < bubbleResults.length; i++) {
        const r = bubbleResults[i];
        const ok = r.answer === EXPECTED_ANSWERS[i];
        if (ok) correct++;
        const topScores = r.scores
          .map((s: number, idx: number) => ({ s, idx }))
          .sort((a: {s:number}, b: {s:number}) => b.s - a.s)
          .slice(0, 3)
          .map((x: {s:number, idx:number}) => `[${"ABCDE"[x.idx]}]=${x.s.toFixed(3)}`)
          .join(" ");
        addLog(`[BUBBLES] Q${String(i+1).padStart(2)}: ${r.answer.padEnd(5)} ${EXPECTED_ANSWERS[i].padEnd(3)} ${ok ? "OK" : "FAIL"}  ${topScores}`);
      }
      addLog(`[BUBBLES] RESULT: ${correct}/20 correctas`);

      // ─── ID ───
      const idRows = readStudentId(warped);
      let idMatch = 0;
      for (let i = 0; i < idRows.length; i++) {
        const ok = idRows[i] === EXPECTED_ID[i];
        if (ok) idMatch++;
        addLog(`[ID] fila${i}: detectado=${idRows[i]}  esperado=${EXPECTED_ID[i]}  ${ok ? "OK" : "FAIL"}`);
      }
      addLog(`[ID] RESULT: ${idMatch}/3 correctas`);

      addLog(`\n[FINAL] ${correct === 20 && idMatch === 3 ? "TODAS LAS PRUEBAS PASARON" : "HAY FALLOS - revisar log arriba"}`);
      if (correct === 20 && idMatch === 3) setPassed(true);

    } catch (e) {
      addLog(`[ERROR] ${e}`);
    }
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">&larr; Inicio</Link>
        <h1 className="text-lg font-bold">Pruebas OMR</h1>
        <span className="text-xs text-zinc-500">v2</span>
      </header>

      <main className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
        <button
          onClick={runTests}
          disabled={running}
          className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl font-semibold transition active:scale-[0.98]"
        >
          {running ? "Ejecutando..." : "Ejecutar pruebas con log"}
        </button>

        {/* Log */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-2">Log detallado</h3>
          <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap break-all max-h-[60vh] overflow-y-auto leading-relaxed">
            {log.length === 0 && "Presiona 'Ejecutar pruebas' para ver el log..."}
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </pre>
        </div>

        {passed && (
          <div className="bg-green-900/30 border border-green-800 rounded-xl p-4 text-center">
            <p className="text-green-400 font-bold text-lg">Todas las pruebas pasaron</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-2 text-sm">Resultados</h3>
            <div className="grid grid-cols-5 gap-1">
              {results.map((r) => (
                <div key={r.question}
                  className={`text-center py-1.5 rounded text-xs ${
                    r.answer === EXPECTED_ANSWERS[r.question - 1]
                      ? "bg-green-900/40 text-green-400"
                      : "bg-red-900/40 text-red-400"
                  }`}>
                  <div className="text-[10px] opacity-60">{r.question}</div>
                  <div className="font-mono font-bold">{r.answer}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
