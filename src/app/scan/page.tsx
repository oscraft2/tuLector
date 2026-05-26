"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { findCorners, warpPerspective, gradeBubbles, readStudentId, DEFAULT_CONFIG, type BubbleResult, type GradeReport } from "@/lib/omr";
import { createClient } from "@/lib/supabase";
import { SCAN_CODES, SCAN_MESSAGES, SCAN_THRESHOLDS, SCAN_PREFS } from "@/lib/scanner_config";
import { warpAsync, terminateWorker } from "@/lib/omr_worker";

type ScanPhase = "detecting" | "scanning" | "result" | "cooldown";

// ─── detector de foco (Laplacian variance, ) ─────
function isFrameSharp(imageData: ImageData): boolean {
 const { width, height, data } = imageData;
 const gray = new Float32Array(width * height);
 for (let i = 0; i < gray.length; i++) {
  gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
 }
 let sum = 0, count = 0;
 for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
   const idx = y * width + x;
   const lap = Math.abs(-4 * gray[idx] + gray[idx - width] + gray[idx + width] + gray[idx - 1] + gray[idx + 1]);
   sum += lap * lap;
   count++;
  }
 }
 return count > 0 ? (sum / count) > 40 : false;
}

export default function ScanPage() {
 const videoRef = useRef<HTMLVideoElement>(null);
 const overlayRef = useRef<HTMLCanvasElement>(null);
 const hiddenCanvas = useRef<HTMLCanvasElement>(null);

 const [phase, setPhase] = useState<ScanPhase>("detecting");
 const [results, setResults] = useState<BubbleResult[]>([]);
 const [studentId, setStudentId] = useState<string[]>([]);
 const [stream, setStream] = useState<MediaStream | null>(null);
 const [error, setError] = useState("");
 const [detected, setDetected] = useState(false);
 const [inFocus, setInFocus] = useState(false);
 const [lastScan, setLastScan] = useState(0);
 const [scanCount, setScanCount] = useState(0);
 const [debugLog, setDebugLog] = useState<string[]>([]);
 const [showDebug, setShowDebug] = useState(false);
 const badFrameCount = useRef(0);
 const goodFrameCount = useRef(0);
 const stableFrames = useRef(0);
 const lastFrameTime = useRef(0);
 const frameSkipMs = 66; // 15fps throttle ( ImageAnalysis rate)

 // Usar constantes de escaneo
 const cooldownMs = SCAN_THRESHOLDS.scanCooldownMs;
 const stableFramesNeeded = 12;
 const badFrameThreshold = SCAN_THRESHOLDS.badPaperThreshold;
 const focusThreshold = SCAN_THRESHOLDS.outOfFocusThreshold;

 // Preferencias de escaneo
 const focusReq = SCAN_PREFS.focusReq.default;
 const brightDetect = SCAN_PREFS.brightDetect.default;

 const config = DEFAULT_CONFIG;

 // Iniciar camara
 const startCamera = useCallback(async () => {
  try {
   if (stream) stream.getTracks().forEach((t) => t.stop());
   const ms = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
   });
   setStream(ms);
   if (videoRef.current) { videoRef.current.srcObject = ms; await videoRef.current.play(); }
   setError("");
  } catch { setError("Permite acceso a la camara en configuracion."); }
 }, [stream]);

 useEffect(() => { startCamera(); return () => { stream?.getTracks().forEach((t) => t.stop()); }; }, []);

 // Loop principal: deteccion continua + auto-scan
 useEffect(() => {
  if (!stream || phase === "result") return;
  let animId: number;

  const loop = () => {
   const video = videoRef.current;
   const overlay = overlayRef.current;
   if (!video || !overlay || video.readyState < 2) { animId = requestAnimationFrame(loop); return; }

   overlay.width = video.videoWidth;
   overlay.height = video.videoHeight;
   const octx = overlay.getContext("2d")!;

   // : throttle a 15fps (frameSkipMs = 66ms)
   const now = performance.now();
   if (now - lastFrameTime.current < frameSkipMs) { animId = requestAnimationFrame(loop); return; }
   lastFrameTime.current = now;

   octx.drawImage(video, 0, 0);
   const frame = octx.getImageData(0, 0, overlay.width, overlay.height);

   const corners = findCorners(frame, config);
   const sharp = isFrameSharp(frame);

   // Dibujar overlay
   octx.clearRect(0, 0, overlay.width, overlay.height);

   if (corners && sharp) {
    goodFrameCount.current++;
    badFrameCount.current = 0;
    // Validar que las esquinas formen un cuadrilatero razonable
    const [tl, tr, br, bl] = corners;
    const topW = Math.hypot(tr[0]-tl[0], tr[1]-tl[1]);
    const botW = Math.hypot(br[0]-bl[0], br[1]-bl[1]);
    const ratio = Math.max(topW, botW) / Math.max(Math.min(topW, botW), 1);
    const area = Math.abs((tr[0]-tl[0])*(br[1]-tl[1]) - (tr[1]-tl[1])*(br[0]-tl[0]));
    const valid = ratio < 2.5 && area > 10000;

    if (valid) {
     setDetected(true);
     setInFocus(true);

     // Dibujar esquinas
     for (const [cx, cy] of corners) {
     octx.strokeStyle = "#22c55e";
     octx.lineWidth = 2;
     octx.beginPath();
     octx.arc(cx, cy, 12, 0, Math.PI * 2);
     octx.stroke();
     // Lineas guia hacia el centro
     octx.strokeStyle = "rgba(34,197,94,0.25)";
     octx.beginPath();
     const midX = overlay.width / 2, midY = overlay.height / 2;
     octx.moveTo(cx, cy);
     octx.lineTo(midX + (cx - midX) * 0.7, midY + (cy - midY) * 0.7);
     octx.stroke();
    }

    stableFrames.current++;

    // Auto-disparar cuando es estable + foco + fuera de cooldown
    const now = Date.now();
    const canScan = now - lastScan > cooldownMs;
    if (stableFrames.current >= stableFramesNeeded && canScan && phase === "detecting") {
     stableFrames.current = 0;
     setPhase("scanning");
     processScan(frame, corners);
    }
    } else {
     stableFrames.current = 0;
     setDetected(false);
     setInFocus(false);
    }
   } else {
    // Procesamiento de frames: contar frames malos consecutivos
    stableFrames.current = 0;
    badFrameCount.current++;
    goodFrameCount.current = 0;
    setDetected(false);
    setInFocus(false);

    // Si 45+ frames malos seguidos, mostrar ayuda (como: "Verify answer sheet")
    if (badFrameCount.current >= badFrameThreshold && !corners) {
     setError("");
    }
    if (badFrameCount.current >= badFrameThreshold && corners && !sharp) {
     setError("");
    }
   }

   animId = requestAnimationFrame(loop);
  };

  loop();
  return () => cancelAnimationFrame(animId);
 }, [stream, phase, lastScan, config]);

 // Procesar escaneo (warp + grade)
 const processScan = async (frame: ImageData, corners: [number, number][]) => {
  const video = videoRef.current;
  const canvas = hiddenCanvas.current;
  if (!video || !canvas) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(frame, 0, 0);

  const logs: string[] = [];
  const addLog = (msg: string) => { logs.push(msg); console.log("[Scan]", msg); };

  try {
   addLog(`Frame: ${canvas.width}x${canvas.height}`);
   addLog(`Corners: TL=(${corners[0][0]},${corners[0][1]}) TR=(${corners[1][0]},${corners[1][1]}) BR=(${corners[2][0]},${corners[2][1]}) BL=(${corners[3][0]},${corners[3][1]})`);

   // : warp en Web Worker (no bloquea el UI thread)
   const srcImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
   const warped = await warpAsync(
    srcImageData, corners,
    { sheetWidth: config.sheetWidth, sheetHeight: config.sheetHeight, margin: config.margin, cornerSize: config.cornerSize }
   );
   addLog(`Warped: ${warped.width}x${warped.height}`);

   const report = gradeBubbles(warped, config, corners);
   const idRows = readStudentId(warped, config);

   // Usar codigos de error de referencia
   if (!report.valid) {
    addLog(`ERR[${SCAN_CODES.WRONG_FORMAT}]: ${report.reason}`);
    setDebugLog(logs);
    setPhase("detecting");
    setError(SCAN_MESSAGES[SCAN_CODES.WRONG_FORMAT] || report.reason || "Error");
    return;
   }

   const bubbleResults = report.results;

   // referencia: validar respuestas
   const answeredCount = bubbleResults.filter(r => r.answer !== "-" && r.answer !== "?").length;
   if (answeredCount === 0) {
    addLog(`ERR[${SCAN_CODES.OUT_OF_FOCUS}]: Sin respuestas`);
    setDebugLog(logs);
    setPhase("detecting");
    setError(SCAN_MESSAGES[SCAN_CODES.OUT_OF_FOCUS]);
    return;
   }

   const answerSet = new Set(bubbleResults.filter(r => r.answer !== "-" && r.answer !== "?").map(r => r.answer));
   if (answerSet.size === 1 && answeredCount > 3) {
    const singleAns = [...answerSet][0];
    addLog(`WARN[${SCAN_CODES.CURVE_FAIL}]: ${answeredCount} respuestas "${singleAns}"`);
    setDebugLog(logs);
    setPhase("detecting");
    setError(SCAN_MESSAGES[SCAN_CODES.CURVE_FAIL]);
    return;
   }

   addLog(`Q answer scores`);
   for (const r of bubbleResults) {
    addLog(`Q${String(r.question).padStart(2)}: ${r.answer.padEnd(5)} [${r.scores.map((s: number) => s.toFixed(2)).join(",")}]`);
   }
   addLog(`ID: [${idRows.join(",")}]`);

   setResults(bubbleResults);
   setStudentId(idRows);
   setDebugLog(logs);
   setScanCount((c) => c + 1);
   setPhase("result");

   // Enviar log a Supabase para debug remoto + datos de entrenamiento
   try {
    const supabase = createClient();
    await supabase.from("scan_logs").insert({
     user_agent: navigator.userAgent,
     log: { 
      corners, 
      scores: bubbleResults.map(r => ({ q: r.question, a: r.answer, s: r.scores })), 
      id: idRows, 
      frameW: canvas.width, frameH: canvas.height 
     }
    });
   } catch { /* silencioso */ }

   // Vibrar si disponible (feedback tactil como)
   if (navigator.vibrate) navigator.vibrate(100);

   setTimeout(() => {
    setPhase("cooldown");
    setLastScan(Date.now());
    setTimeout(() => {
     if (phase !== "result") setPhase("detecting");
    }, cooldownMs);
   }, 2000);
  } catch {
   setError("Error al procesar. Intenta de nuevo.");
   setPhase("detecting");
  }
 };

 // Empezar siguiente escaneo
 const nextScan = () => {
  setPhase("detecting");
  setLastScan(Date.now());
  setTimeout(() => { if (phase !== "result") setPhase("detecting"); }, cooldownMs);
 };

 return (
  <div className="min-h-screen bg-zinc-950 text-white">
   <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
    <Link href="/sheet" className="text-sm text-zinc-400 hover:text-white">Hoja</Link>
    <h1 className="text-lg font-bold">TuLector</h1>
    <div className="flex items-center gap-2 text-xs text-zinc-500">
     {scanCount > 0 && <span>{scanCount} escaneos</span>}
    </div>
   </header>

   {/* Camara */}
   <div className="relative max-w-lg mx-auto">
    <video ref={videoRef} playsInline muted className="w-full aspect-[3/4] object-cover bg-black" />
    <canvas ref={overlayRef} className="absolute inset-0 w-full h-full object-cover" />
    <canvas ref={hiddenCanvas} className="hidden" />

    {/* Status + indicadores */}
    <div className="absolute top-3 left-3 right-3">
     <div className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur transition-colors ${
      phase === "scanning" ? "bg-green-600/80" : "bg-black/60"
     }`}>
      <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
       phase === "scanning" ? "bg-green-300" : detected && inFocus ? "bg-green-500" : detected ? "bg-yellow-500" : "bg-red-500"
      }`} />
      <span className="text-sm font-medium">
       {phase === "scanning" && "Calificando..."}
       {phase === "detecting" && detected && inFocus && "Hoja lista - acerquese"}
       {phase === "detecting" && detected && !inFocus && "Enfocando..."}
       {phase === "detecting" && !detected && "Buscando hoja..."}
       {phase === "cooldown" && "Listo para siguiente"}
       {phase === "result" && "Calificado!"}
      </span>
     </div>
    </div>

    {error && (
     <div className="absolute bottom-24 left-3 right-3 px-3 py-2 bg-red-600/80 rounded-lg backdrop-blur text-sm">
      {error}
     </div>
    )}
   </div>

   {/* Resultado overlay */}
   <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
    {phase === "result" && (
     <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-3">
       <h2 className="font-semibold text-lg">Escaneo #{scanCount}</h2>
       <div className="flex items-center gap-2">
        <button onClick={() => setShowDebug(!showDebug)}
         className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white">
         {showDebug ? "Ocultar log" : "Ver log"}
        </button>
        <span className="text-xs text-zinc-500 font-mono">
         ID: {studentId.join(" ")}
        </span>
       </div>
      </div>

      {showDebug && debugLog.length > 0 && (
       <div className="mb-3 bg-black/50 rounded-lg p-3 max-h-48 overflow-y-auto">
        <pre className="text-[10px] text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap break-all">
         {debugLog.join("\n")}
        </pre>
       </div>
      )}

      <div className="grid grid-cols-5 gap-1">
       {results.map((r) => (
        <div key={r.question}
         className={`text-center py-1.5 rounded text-xs font-mono transition-all ${
          r.answer === "-" ? "bg-zinc-800/50 text-zinc-500" : "bg-green-900/40 text-green-400 ring-1 ring-green-900/50"
         }`}>
         <div className="text-[10px] text-zinc-500">{r.question}</div>
         <div className="font-bold">{r.answer}</div>
        </div>
       ))}
      </div>

      <button
       onClick={nextScan}
       className="w-full mt-3 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-semibold text-sm transition active:scale-[0.98]"
      >
       Siguiente hoja
      </button>
     </div>
    )}

    {(phase === "detecting" || phase === "cooldown") && (
     <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4 text-sm text-zinc-400">
      <div className="flex items-start gap-3">
       <div className="flex flex-col items-center gap-1 text-green-600">
        <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-[10px]">1</div>
        <div className="w-px h-4 bg-zinc-700" />
        <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-[10px]">2</div>
        <div className="w-px h-4 bg-zinc-700" />
        <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-[10px]">3</div>
       </div>
       <div className="space-y-4 pt-0.5">
        <p>Imprime la hoja con marcas de esquina</p>
        <p>Rellena burbujas con lapiz negro grueso</p>
        <p>Apunta la camara - <strong className="text-green-500">se escanea solo</strong></p>
       </div>
      </div>
     </div>
    )}
   </div>
  </div>
 );
}


