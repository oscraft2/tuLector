"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { findCorners, gradeBubbles, readStudentId, DEFAULT_CONFIG, type BubbleResult } from "@/lib/omr";
import { createClient } from "@/lib/supabase";
import { SCAN_CODES, SCAN_MESSAGES, SCAN_THRESHOLDS, SCAN_PREFS } from "@/lib/scanner_config";
import { warpAsync } from "@/lib/omr_worker";

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
  const streamRef = useRef<MediaStream | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
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
  useEffect(() => {
   let cancelled = false;
   (async () => {
    try {
     if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
     const ms = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
     });
     if (cancelled) { ms.getTracks().forEach((t) => t.stop()); return; }
     streamRef.current = ms;
     setStream(ms);
     if (videoRef.current) { videoRef.current.srcObject = ms; await videoRef.current.play(); }
     setError("");
    } catch { if (!cancelled) setError("Permite acceso a la camara en configuracion."); }
   })();
   return () => {
    cancelled = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
   };
  }, []);

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

   const srcImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
   const warped = await warpAsync(
    srcImageData, corners,
    { sheetWidth: config.sheetWidth, sheetHeight: config.sheetHeight, margin: config.margin, cornerSize: config.cornerSize }
   );
   addLog(`Warped: ${warped.width}x${warped.height}`);

   const report = gradeBubbles(warped, config, corners);
   const idRows = readStudentId(warped, config);

   if (!report.valid) {
    addLog(`ERR[${SCAN_CODES.WRONG_FORMAT}]: ${report.reason}`);
    setDebugLog(logs);
    setPhase("detecting");
    setError(SCAN_MESSAGES[SCAN_CODES.WRONG_FORMAT] || report.reason || "Error");
    return;
   }

   const bubbleResults = report.results;

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

   if (navigator.vibrate) navigator.vibrate(100);

    setTimeout(() => {
     setPhase((prev) => prev === "result" ? "cooldown" : prev);
     setLastScan(Date.now());
     setTimeout(() => {
      setPhase("detecting");
     }, cooldownMs);
    }, 2000);
  } catch {
   setError("Error al procesar. Intenta de nuevo.");
   setPhase("detecting");
  }
 };

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

  // Empezar siguiente escaneo
  const nextScan = () => {
   setPhase("detecting");
   setLastScan(Date.now());
  };

 return (
  <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden font-sans">
   <header className="flex items-center justify-between px-4 py-2 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 z-20">
    <Link href="/dashboard" className="p-2 -ml-2 text-zinc-500 hover:text-white transition">
     <ArrowLeftIcon />
    </Link>
    <div className="flex flex-col items-center">
     <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Escaneando</span>
     <span className="text-xs font-bold">{scanCount} hojas</span>
    </div>
    <div className="w-8" />
   </header>

   {/* Visor de Cámara */}
   <div className="relative flex-1 bg-black">
    <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
    <canvas ref={overlayRef} className="absolute inset-0 w-full h-full object-cover z-10" />
    <canvas ref={hiddenCanvas} className="hidden" />

    {/* Overlay de Estado Minimalista */}
    <div className="absolute top-4 left-0 right-0 flex justify-center z-20 pointer-events-none">
     <div className={`px-4 py-1.5 rounded-full backdrop-blur-lg border transition-all flex items-center gap-2 ${
      phase === "scanning" ? "bg-green-600/20 border-green-500/50" : "bg-black/40 border-zinc-800/50"
     }`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
       phase === "scanning" ? "bg-green-400" : detected && inFocus ? "bg-green-500" : "bg-zinc-600"
      }`} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-200">
       {phase === "scanning" ? "Procesando..." : detected && inFocus ? "Capturando" : "Buscando hoja"}
      </span>
     </div>
    </div>

    {error && (
     <div className="absolute bottom-6 left-6 right-6 p-3 bg-red-950/80 border border-red-900/50 rounded-xl backdrop-blur-md text-[10px] font-bold text-red-200 z-30">
      {error}
     </div>
    )}

    {/* Modal de Resultado Rápido */}
    {phase === "result" && (
     <div className="absolute inset-0 flex items-center justify-center p-6 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
      <div className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
       <div className="flex justify-between items-start mb-6">
        <div>
         <h2 className="text-2xl font-black text-white">LISTO</h2>
         <p className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Escaneo #{scanCount}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
         <div className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[10px] font-black border border-green-500/20">
          ID: {studentId.join("") || "???"}
         </div>
         <button onClick={() => setShowDebug(!showDebug)} className="text-[9px] text-zinc-600 underline font-bold">
           {showDebug ? "Ocultar Log" : "Ver Log"}
         </button>
        </div>
       </div>

       {showDebug && debugLog.length > 0 && (
         <div className="mb-4 bg-black/40 rounded-xl p-3 max-h-32 overflow-y-auto border border-zinc-800">
          <pre className="text-[8px] text-zinc-500 font-mono leading-tight whitespace-pre-wrap break-all">
           {debugLog.join("\n")}
          </pre>
         </div>
       )}

       <div className="grid grid-cols-5 gap-1.5 mb-8">
        {results.map((r) => (
         <div key={r.question} className={`h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${
          r.answer === "-" ? "bg-zinc-800 text-zinc-600" : "bg-green-500/20 text-green-400 border border-green-500/20"
         }`}>
          {r.answer !== "-" ? r.answer : ""}
         </div>
        ))}
       </div>

       <button
        onClick={nextScan}
        className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition"
       >
        Siguiente
       </button>
      </div>
     </div>
    )}
   </div>
  </div>
 );
}

function ArrowLeftIcon() {
 return (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
   <path d="m15 18-6-6 6-6"/>
  </svg>
 );
}


