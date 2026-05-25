"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TEST_IMAGE_BASE64, EXPECTED_ANSWERS, EXPECTED_ID } from "./test_image";
import { findCorners, warpPerspective, gradeBubbles, readStudentId, type BubbleResult } from "@/lib/omr";

type TestStep = {
  name: string;
  status: "pending" | "pass" | "fail";
  detail: string;
};

export default function TestPage() {
  const [steps, setSteps] = useState<TestStep[]>([
    { name: "Cargar imagen de prueba", status: "pending", detail: "" },
    { name: "Deteccion de 4 esquinas", status: "pending", detail: "" },
    { name: "Analisis de burbujas (20 preguntas)", status: "pending", detail: "" },
    { name: "Lectura de ID de estudiante", status: "pending", detail: "" },
  ]);
  const [results, setResults] = useState<BubbleResult[]>([]);
  const [running, setRunning] = useState(false);

  const runTests = async () => {
    setRunning(true);
    const newSteps: TestStep[] = steps.map((s) => ({ name: s.name, status: "pending", detail: "" }));
    let idx = 0;

    try {
      // Load image
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = TEST_IMAGE_BASE64;
      });

      // Step 1: Load image
      newSteps[idx].status = "pass";
      newSteps[idx].detail = `Imagen: ${img.width}x${img.height} (natural: ${img.naturalWidth}x${img.naturalHeight})`;
      setSteps([...newSteps]); idx++;

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Quick sanity check
      let darkPx = 0;
      for (let i = 0; i < imageData.data.length; i += 4) {
        const g = imageData.data[i] * 0.299 + imageData.data[i+1] * 0.587 + imageData.data[i+2] * 0.114;
        if (g < 128) darkPx++;
      }
      const darkPct = Math.round(darkPx / (canvas.width * canvas.height) * 100);
      newSteps[0].detail += ` | Pixels oscuros: ${darkPct}%`;
      setSteps([...newSteps]);

      // Step 2: Corner detection
      const corners = findCorners(imageData);
      if (!corners || corners.length !== 4) {
        newSteps[idx].status = "fail";
        const c = corners?.length ?? 0;
        newSteps[idx].detail = `Se detectaron ${c} esquinas (necesita 4). ${darkPct}% pixeles oscuros. ${imageData.width}x${imageData.height}`;
        setSteps([...newSteps]);
        setRunning(false);
        return;
      }
      newSteps[idx].status = "pass";
      newSteps[idx].detail = `TL(${corners[0][0]},${corners[0][1]}) TR(${corners[1][0]},${corners[1][1]}) BR(${corners[2][0]},${corners[2][1]}) BL(${corners[3][0]},${corners[3][1]})`;
      setSteps([...newSteps]); idx++;

      // Step 3: Bubble analysis
      const warped = warpPerspective(ctx, corners);
      const bubbleResults = gradeBubbles(warped);
      setResults(bubbleResults);

      let correct = 0;
      for (let i = 0; i < bubbleResults.length; i++) {
        if (bubbleResults[i].answer === EXPECTED_ANSWERS[i]) correct++;
      }

      newSteps[idx].status = correct === 20 ? "pass" : "fail";
      newSteps[idx].detail = `Aciertos: ${correct}/20  |  Fallos: ${20 - correct}`;
      setSteps([...newSteps]); idx++;

      // Step 4: Student ID
      const idRows = readStudentId(warped);
      let idMatch = 0;
      for (let i = 0; i < idRows.length; i++) {
        if (idRows[i] === EXPECTED_ID[i]) idMatch++;
      }
      newSteps[idx].status = idMatch === 3 ? "pass" : "fail";
      newSteps[idx].detail = `Filas correctas: ${idMatch}/3  |  Detectado: [${idRows.join(", ")}]  |  Esperado: [${EXPECTED_ID.join(", ")}]`;
      setSteps([...newSteps]);

    } catch (e) {
      newSteps[idx].status = "fail";
      newSteps[idx].detail = String(e);
      setSteps([...newSteps]);
    }
    setRunning(false);
  };

  const allPass = steps.every((s) => s.status === "pass");

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">&larr; Inicio</Link>
        <h1 className="text-lg font-bold">Pruebas internas</h1>
        <span className="text-sm text-zinc-500">OMR Engine</span>
      </header>

      <main className="max-w-lg mx-auto w-full px-4 py-6 space-y-6">
        {!running && steps[0].status === "pending" && (
          <button
            onClick={runTests}
            className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-semibold transition active:scale-[0.98]"
          >
            Ejecutar pruebas
          </button>
        )}

        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i}
              className={`bg-zinc-900 border rounded-xl p-4 flex items-start gap-3 transition-all ${
                step.status === "pass" ? "border-green-800" :
                step.status === "fail" ? "border-red-800" :
                "border-zinc-800"
              }`}
            >
              <div className={`mt-0.5 text-lg ${
                step.status === "pass" ? "text-green-500" :
                step.status === "fail" ? "text-red-500" :
                "text-zinc-600"
              }`}>
                {step.status === "pass" ? "OK" : step.status === "fail" ? "FAIL" : "..."}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{step.name}</h3>
                {step.detail && (
                  <p className="text-xs text-zinc-400 mt-1 break-all">{step.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {allPass && results.length > 0 && (
          <div className="bg-green-900/30 border border-green-800 rounded-xl p-4 text-center">
            <p className="text-green-400 font-bold text-lg">Todas las pruebas pasaron</p>
            <p className="text-green-500/70 text-sm mt-1">El motor OMR funciona correctamente</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-2 text-sm">Resultados por pregunta</h3>
            <div className="grid grid-cols-5 gap-1">
              {results.map((r) => (
                <div key={r.question}
                  className={`text-center py-1.5 rounded text-xs ${
                    r.answer === EXPECTED_ANSWERS[r.question - 1]
                      ? "bg-green-900/40 text-green-400"
                      : "bg-red-900/40 text-red-400"
                  }`}
                >
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
