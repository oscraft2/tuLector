"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { findCorners, gradeBubbles, readStudentId, DEFAULT_CONFIG, type BubbleResult } from "@/lib/omr";
import { createClient } from "@/lib/supabase";
import { SCAN_CODES, SCAN_MESSAGES, SCAN_THRESHOLDS } from "@/lib/scanner_config";
import { warpAsync } from "@/lib/omr_worker";

type ScanPhase = "detecting" | "scanning" | "result" | "cooldown";

// ─── Laplacian focus detector ─────
function isFrameSharp(imageData: ImageData): number {
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
 return count > 0 ? sum / count : 0;
}

// ─── Full per-zone diagnostic (mirrors findCorners step by step) ───
interface ZoneDiag {
 name: string;
 x0: number; y0: number; x1: number; y1: number;
 darkPixels: number;
 zonePixels: number;
 darkRatio: number;
 cx: number; cy: number;
 varX: number; varY: number;
 passedDarkCount: boolean;  // c >= 150
 passedVariance: boolean;   // varX <= 1500 && varY <= 1500
}

interface FrameDiag {
 w: number; h: number;
 totalPixels: number;
 darkPixels: number;
 darkRatio: number;
 sharpScore: number;
 sharpPassed: boolean;
 zones: ZoneDiag[];
 geometricChecks: {
  name: string; value: number; threshold: string; passed: boolean;
 }[];
 cornersFound: boolean;
 corners: [number, number][] | null;
}

function diagnoseFrame(imageData: ImageData): FrameDiag {
 const w = imageData.width, h = imageData.height;
 const gray = new Uint8Array(w * h);
 for (let i = 0; i < gray.length; i++) {
  const j = i * 4;
  gray[i] = Math.round(imageData.data[j] * 0.299 + imageData.data[j + 1] * 0.587 + imageData.data[j + 2] * 0.114);
 }

 const zoneDefs: { name: string; x0: number; y0: number; x1: number; y1: number }[] = [
  { name: "TL", x0: 0, y0: 0, x1: Math.floor(w * 0.35), y1: Math.floor(h * 0.30) },
  { name: "TR", x0: Math.floor(w * 0.65), y0: 0, x1: w, y1: Math.floor(h * 0.30) },
  { name: "BR", x0: Math.floor(w * 0.65), y0: Math.floor(h * 0.70), x1: w, y1: h },
  { name: "BL", x0: 0, y0: Math.floor(h * 0.70), x1: Math.floor(w * 0.35), y1: h },
 ];

 // Overall dark pixel count
 let totalDark = 0;
 for (let i = 0; i < gray.length; i++) { if (gray[i] < 80) totalDark++; }

 const zones: ZoneDiag[] = [];
 const rawCorners: { cx: number; cy: number }[] = [];

 for (const zd of zoneDefs) {
  let sx = 0, sy = 0, c = 0, sxx = 0, syy = 0;
  let totalInZone = 0;
  for (let y = zd.y0; y < zd.y1; y++) {
   for (let x = zd.x0; x < zd.x1; x++) {
    totalInZone++;
    if (gray[y * w + x] < 80) { sx += x; sy += y; c++; sxx += x * x; syy += y * y; }
   }
  }
  const cx = c > 0 ? Math.round(sx / c) : 0;
  const cy = c > 0 ? Math.round(sy / c) : 0;
  const varX = c > 0 ? sxx / c - cx * cx : 1e9;
  const varY = c > 0 ? syy / c - cy * cy : 1e9;
  const passedDark = c >= 150;
  const passedVar = varX <= 1500 && varY <= 1500;
  zones.push({
   name: zd.name, x0: zd.x0, y0: zd.y0, x1: zd.x1, y1: zd.y1,
   darkPixels: c, zonePixels: totalInZone,
   darkRatio: totalInZone > 0 ? c / totalInZone : 0,
   cx, cy, varX, varY,
   passedDarkCount: passedDark, passedVariance: passedVar,
  });
  if (passedDark && passedVar) rawCorners.push({ cx, cy });
 }

 // Geometric checks (only if all 4 zones passed)
 const geomChecks: { name: string; value: number; threshold: string; passed: boolean }[] = [];
 let cornersFound = false;
 let finalCorners: [number, number][] | null = null;

 if (rawCorners.length === 4) {
  const [tl, tr, br, bl] = rawCorners;

  const topYdelta = Math.abs(tl.cy - tr.cy);
  geomChecks.push({ name: "top Y delta", value: topYdelta, threshold: `< ${(h * 0.05).toFixed(0)}`, passed: topYdelta <= h * 0.05 });

  const botYdelta = Math.abs(bl.cy - br.cy);
  geomChecks.push({ name: "bottom Y delta", value: botYdelta, threshold: `< ${(h * 0.05).toFixed(0)}`, passed: botYdelta <= h * 0.05 });

  const leftXdelta = Math.abs(tl.cx - bl.cx);
  geomChecks.push({ name: "left X delta", value: leftXdelta, threshold: `< ${(w * 0.05).toFixed(0)}`, passed: leftXdelta <= w * 0.05 });

  const rightXdelta = Math.abs(tr.cx - br.cx);
  geomChecks.push({ name: "right X delta", value: rightXdelta, threshold: `< ${(w * 0.05).toFixed(0)}`, passed: rightXdelta <= w * 0.05 });

  const topW = Math.hypot(tr.cx - tl.cx, tr.cy - tl.cy);
  const botW = Math.hypot(br.cx - bl.cx, br.cy - bl.cy);
  const leftH = Math.hypot(bl.cx - tl.cx, bl.cy - tl.cy);
  const rightH = Math.hypot(br.cx - tr.cx, br.cy - tr.cy);
  const avgW = (topW + botW) / 2;
  const avgH = (leftH + rightH) / 2;
  const aspect = avgW / Math.max(avgH, 1);
  geomChecks.push({ name: "aspect ratio", value: aspect, threshold: "0.5 - 2.0", passed: aspect >= 0.5 && aspect <= 2.0 });

  const hRatio = Math.max(topW, botW) / Math.max(Math.min(topW, botW), 1);
  geomChecks.push({ name: "horizontal symmetry", value: hRatio, threshold: ">= 0.5 both ways", passed: topW / Math.max(botW, 1) >= 0.5 && botW / Math.max(topW, 1) >= 0.5 });

  const vRatio = Math.max(leftH, rightH) / Math.max(Math.min(leftH, rightH), 1);
  geomChecks.push({ name: "vertical symmetry", value: vRatio, threshold: ">= 0.5 both ways", passed: leftH / Math.max(rightH, 1) >= 0.5 && rightH / Math.max(leftH, 1) >= 0.5 });

  const area = Math.abs((tr.cx - tl.cx) * (br.cy - tl.cy) - (tr.cy - tl.cy) * (br.cx - tl.cx));
  geomChecks.push({ name: "area", value: area, threshold: ">= 50000", passed: area >= 50000 });

  cornersFound = geomChecks.every(g => g.passed);
  if (cornersFound) {
   finalCorners = [[tl.cx, tl.cy], [tr.cx, tr.cy], [br.cx, br.cy], [bl.cx, bl.cy]];
  }
 }

 const sharp = isFrameSharp(imageData);

 return {
  w, h, totalPixels: gray.length,
  darkPixels: totalDark,
  darkRatio: gray.length > 0 ? totalDark / gray.length : 0,
  sharpScore: sharp,
  sharpPassed: sharp > 40,
  zones,
  geometricChecks: geomChecks,
  cornersFound,
  corners: finalCorners,
 };
}

// ─── Convert canvas to data URL for frame saving ───
function canvasToDataUrl(canvas: HTMLCanvasElement): string {
 return canvas.toDataURL("image/jpeg", 0.85);
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
 const [error, setError] = useState("");
 const [detected, setDetected] = useState(false);
 const [inFocus, setInFocus] = useState(false);
 const [lastScan, setLastScan] = useState(0);
 const [scanCount, setScanCount] = useState(0);
 const [debugLog, setDebugLog] = useState<string[]>([]);
 const [showDebug, setShowDebug] = useState(false);
 const [lastDiag, setLastDiag] = useState<FrameDiag | null>(null);
 const [capturing, setCapturing] = useState(false);
 const badFrameCount = useRef(0);
 const goodFrameCount = useRef(0);
 const stableFrames = useRef(0);
 const lastFrameTime = useRef(0);
 const frameSkipMs = 66;

 const cooldownMs = SCAN_THRESHOLDS.scanCooldownMs;
 const stableFramesNeeded = 12;
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

 // Process scan (warp + grade)
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
     log: { corners, scores: bubbleResults.map(r => ({ q: r.question, a: r.answer, s: r.scores })), id: idRows, frameW: canvas.width, frameH: canvas.height }
    });
   } catch { /* silencioso */ }

   if (navigator.vibrate) navigator.vibrate(100);

   setTimeout(() => {
    setPhase((prev) => prev === "result" ? "cooldown" : prev);
    setLastScan(Date.now());
    setTimeout(() => { setPhase("detecting"); }, cooldownMs);
   }, 2000);
  } catch {
   setError("Error al procesar. Intenta de nuevo.");
   setPhase("detecting");
  }
 };

 // ─── MANUAL SHUTTER: capture frame, run diagnostics, try to scan ───
 const captureFrame = async () => {
  const video = videoRef.current;
  const overlay = overlayRef.current;
  if (!video || !overlay || video.readyState < 2) return;

  setCapturing(true);
  setShowDebug(true);

  // Capture current frame
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
  const octx = overlay.getContext("2d")!;
  octx.drawImage(video, 0, 0);
  const frame = octx.getImageData(0, 0, overlay.width, overlay.height);

  // Save thumbnail for reference
  const thumbUrl = canvasToDataUrl(overlay);
  console.log("[CAPTURE] Frame saved:", thumbUrl.substring(0, 80) + "...");

  // Run full diagnostics
  const diag = diagnoseFrame(frame);
  setLastDiag(diag);

  // Build diagnostic log
  const logs: string[] = [];
  logs.push(`=== CAPTURA MANUAL ===`);
  logs.push(`Frame: ${diag.w}x${diag.h} | Total px: ${diag.totalPixels} | Dark px: ${diag.darkPixels} (${(diag.darkRatio * 100).toFixed(1)}%)`);
  logs.push(`Sharpness: ${diag.sharpScore.toFixed(1)} (min 40) → ${diag.sharpPassed ? "OK" : "FAIL"}`);
  logs.push(``);

  // Zone diagnostics
  logs.push(`--- DIAGNOSTICO POR ZONA ---`);
  for (const z of diag.zones) {
   const darkOk = z.passedDarkCount ? "OK" : "FAIL";
   const varOk = z.passedVariance ? "OK" : "FAIL";
   logs.push(`Zone ${z.name} [${z.x0}-${z.x1}, ${z.y0}-${z.y1}]: dark=${z.darkPixels}(${darkOk}, >=150) | center=(${z.cx},${z.cy}) | varX=${z.varX.toFixed(0)} varY=${z.varY.toFixed(0)}(${varOk}, <=1500)`);
  }

  // Geometric checks
  if (diag.geometricChecks.length > 0) {
   logs.push(``);
   logs.push(`--- CHECKS GEOMETRICOS ---`);
   for (const g of diag.geometricChecks) {
    logs.push(`  ${g.name}: ${typeof g.value === "number" ? g.value.toFixed(1) : g.value} ${g.threshold} → ${g.passed ? "OK" : "FAIL"}`);
   }
  }

  logs.push(``);
  logs.push(`cornersFound: ${diag.cornersFound}`);
  if (diag.corners) {
   logs.push(`Corners: TL=(${diag.corners[0][0]},${diag.corners[0][1]}) TR=(${diag.corners[1][0]},${diag.corners[1][1]}) BR=(${diag.corners[2][0]},${diag.corners[2][1]}) BL=(${diag.corners[3][0]},${diag.corners[3][1]})`);
  }

  // Intenta escanear si hay esquinas
  if (diag.cornersFound && diag.corners) {
   logs.push(``);
   logs.push(`>>> Intentando escaneo automatico...`);
   setPhase("scanning");
   // Process in the overlay canvas context
   const hCanvas = hiddenCanvas.current;
   if (hCanvas) {
    hCanvas.width = overlay.width;
    hCanvas.height = overlay.height;
    const hCtx = hCanvas.getContext("2d")!;
    octx.drawImage(video, 0, 0);
    hCtx.putImageData(octx.getImageData(0, 0, overlay.width, overlay.height), 0, 0);
   }
   setDebugLog(logs);
   setCapturing(false);
   await processScan(frame, diag.corners);
   return;
  }

  // Fallback: try with relaxed thresholds
  logs.push(``);
  logs.push(`>>> Fallback: probando con umbral relajado (dark<128)...`);
  const relaxed = tryRelaxedCorners(frame);
  if (relaxed) {
   logs.push(`Relaxed corners found! Trying scan...`);
   setPhase("scanning");
   setDebugLog(logs);
   setCapturing(false);
   await processScan(frame, relaxed);
   return;
  }
  logs.push(`Relaxed fallback tambien fallo.`);

  setDebugLog(logs);
  setCapturing(false);
 };

 // Fallback corner finder with relaxed thresholds
 function tryRelaxedCorners(imageData: ImageData): [number, number][] | null {
  const w = imageData.width, h = imageData.height;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) {
   const j = i * 4;
   gray[i] = Math.round(imageData.data[j] * 0.299 + imageData.data[j + 1] * 0.587 + imageData.data[j + 2] * 0.114);
  }

  const zoneDefs = [
   { x0: 0, y0: 0, x1: Math.floor(w * 0.40), y1: Math.floor(h * 0.35) },
   { x0: Math.floor(w * 0.60), y0: 0, x1: w, y1: Math.floor(h * 0.35) },
   { x0: Math.floor(w * 0.60), y0: Math.floor(h * 0.65), x1: w, y1: h },
   { x0: 0, y0: Math.floor(h * 0.65), x1: Math.floor(w * 0.40), y1: h },
  ];

  const pts: { cx: number; cy: number }[] = [];
  for (const z of zoneDefs) {
   let sx = 0, sy = 0, c = 0;
   for (let y = z.y0; y < z.y1; y++) {
    for (let x = z.x0; x < z.x1; x++) {
     if (gray[y * w + x] < 128) { sx += x; sy += y; c++; }
    }
   }
   if (c < 80) return null; // More relaxed min
   pts.push({ cx: Math.round(sx / c), cy: Math.round(sy / c) });
  }

  // Minimal geometric validation
  const [tl, tr, br, bl] = pts;
  if (Math.abs(tl.cy - tr.cy) > h * 0.10) return null;
  if (Math.abs(bl.cy - br.cy) > h * 0.10) return null;
  if (Math.abs(tl.cx - bl.cx) > w * 0.10) return null;
  if (Math.abs(tr.cx - br.cx) > w * 0.10) return null;

  const area = Math.abs((tr.cx - tl.cx) * (br.cy - tl.cy) - (tr.cy - tl.cy) * (br.cx - tl.cx));
  if (area < 20000) return null;

  return [[tl.cx, tl.cy], [tr.cx, tr.cy], [br.cx, br.cy], [bl.cx, bl.cy]];
 }

 // Live detection loop (for corner overlay display)
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

   const now = performance.now();
   if (now - lastFrameTime.current < frameSkipMs) { animId = requestAnimationFrame(loop); return; }
   lastFrameTime.current = now;

   octx.drawImage(video, 0, 0);
   const frame = octx.getImageData(0, 0, overlay.width, overlay.height);

   const corners = findCorners(frame, config);
   const sharpScore = isFrameSharp(frame);
   const sharp = sharpScore > 40;

   octx.clearRect(0, 0, overlay.width, overlay.height);

   if (corners && sharp) {
    goodFrameCount.current++;
    badFrameCount.current = 0;
    const [tl, tr, br, bl] = corners;
    const topW = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
    const botW = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
    const ratio = Math.max(topW, botW) / Math.max(Math.min(topW, botW), 1);
    const area = Math.abs((tr[0] - tl[0]) * (br[1] - tl[1]) - (tr[1] - tl[1]) * (br[0] - tl[0]));
    const valid = ratio < 2.5 && area > 10000;

    if (valid) {
     setDetected(true);
     setInFocus(true);

     for (const [cx, cy] of corners) {
      octx.strokeStyle = "#22c55e";
      octx.lineWidth = 2;
      octx.beginPath();
      octx.arc(cx, cy, 12, 0, Math.PI * 2);
      octx.stroke();
      octx.strokeStyle = "rgba(34,197,94,0.25)";
      octx.beginPath();
      const midX = overlay.width / 2, midY = overlay.height / 2;
      octx.moveTo(cx, cy);
      octx.lineTo(midX + (cx - midX) * 0.7, midY + (cy - midY) * 0.7);
      octx.stroke();
     }

     stableFrames.current++;
     const canScan = Date.now() - lastScan > cooldownMs;
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
    stableFrames.current = 0;
    badFrameCount.current++;
    goodFrameCount.current = 0;
    setDetected(false);
    setInFocus(false);
   }

   animId = requestAnimationFrame(loop);
  };

  loop();
  return () => cancelAnimationFrame(animId);
 }, [stream, phase, lastScan, config]);

 const nextScan = () => {
  setPhase("detecting");
  setLastScan(Date.now());
  setLastDiag(null);
  setDebugLog([]);
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
    <button onClick={() => setShowDebug(!showDebug)} className="text-[10px] text-zinc-400 font-bold px-2 py-1">
     {showDebug ? "Ocultar" : "Diagnostico"}
    </button>
   </header>

   {/* Visor de Camara */}
   <div className="relative flex-1 bg-black">
    <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
    <canvas ref={overlayRef} className="absolute inset-0 w-full h-full object-cover z-10" />
    <canvas ref={hiddenCanvas} className="hidden" />

    {/* Status overlay */}
    <div className="absolute top-4 left-0 right-0 flex justify-center z-20 pointer-events-none">
     <div className={`px-4 py-1.5 rounded-full backdrop-blur-lg border transition-all flex items-center gap-2 ${phase === "scanning" ? "bg-green-600/20 border-green-500/50" : "bg-black/40 border-zinc-800/50"}`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${phase === "scanning" ? "bg-green-400" : detected && inFocus ? "bg-green-500" : "bg-zinc-600"}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-200">
       {phase === "scanning" ? "Procesando..." : detected && inFocus ? "Detectado" : "Buscando hoja"}
      </span>
     </div>
    </div>

    {error && (
     <div className="absolute bottom-32 left-6 right-6 p-3 bg-red-950/80 border border-red-900/50 rounded-xl backdrop-blur-md text-[10px] font-bold text-red-200 z-30">
      {error}
     </div>
    )}

    {/* ─── SHUTTER BUTTON ─── */}
    <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20">
     <button
      onClick={captureFrame}
      disabled={capturing || !stream}
      className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-90 ${capturing ? "opacity-50 scale-75" : "hover:scale-105"}`}
     >
      <div className={`w-16 h-16 rounded-full ${capturing ? "bg-zinc-500" : "bg-white"}`} />
     </button>
    </div>

    {/* ─── DEBUG PANEL ─── */}
    {showDebug && (
     <div className="absolute inset-0 z-50 bg-black/90 overflow-y-auto p-4">
      <div className="flex justify-between items-center mb-3">
       <span className="text-xs font-bold text-green-400">DIAGNOSTICO</span>
       <button onClick={() => setShowDebug(false)} className="text-xs text-zinc-500 font-bold">CERRAR</button>
      </div>

      {lastDiag && (
       <div className="mb-4 bg-zinc-900 rounded-xl p-3 border border-zinc-800 text-[10px] font-mono text-zinc-400 space-y-1">
        <div className="text-green-400 font-bold text-xs mb-2">ULTIMA CAPTURA</div>
        <div>Frame: {lastDiag.w}x{lastDiag.h} | Dark: {(lastDiag.darkRatio * 100).toFixed(1)}%</div>
        <div>Sharpness: {lastDiag.sharpScore.toFixed(1)} (min 40) → <span className={lastDiag.sharpPassed ? "text-green-400" : "text-red-400"}>{lastDiag.sharpPassed ? "OK" : "FAIL"}</span></div>

        <div className="text-green-400 font-bold text-xs mt-2 mb-1">ZONAS</div>
        <table className="w-full border-collapse text-[9px]">
         <thead>
          <tr className="text-zinc-500">
           <th className="text-left pr-2">Z</th>
           <th className="text-right px-1">Dark</th>
           <th className="text-right px-1">VarX</th>
           <th className="text-right px-1">VarY</th>
           <th className="text-right px-1">CtrX</th>
           <th className="text-right px-1">CtrY</th>
           <th className="text-center">Status</th>
          </tr>
         </thead>
         <tbody>
          {lastDiag.zones.map((z, i) => (
           <tr key={i} className="border-t border-zinc-800">
            <td className="text-left pr-2 text-zinc-500">{z.name}</td>
            <td className={`text-right px-1 ${z.passedDarkCount ? "text-green-400" : "text-red-400"}`}>{z.darkPixels}</td>
            <td className={`text-right px-1 ${z.passedVariance ? "text-zinc-400" : "text-red-400"}`}>{z.varX.toFixed(0)}</td>
            <td className={`text-right px-1 ${z.passedVariance ? "text-zinc-400" : "text-red-400"}`}>{z.varY.toFixed(0)}</td>
            <td className="text-right px-1">{z.cx}</td>
            <td className="text-right px-1">{z.cy}</td>
            <td className={`text-center ${z.passedDarkCount && z.passedVariance ? "text-green-400" : "text-red-400"}`}>
             {z.passedDarkCount && z.passedVariance ? "OK" : "X"}
            </td>
           </tr>
          ))}
         </tbody>
        </table>

        {lastDiag.geometricChecks.length > 0 && (
         <>
          <div className="text-green-400 font-bold text-xs mt-2 mb-1">GEOMETRIA</div>
          {lastDiag.geometricChecks.map((g, i) => (
           <div key={i} className={g.passed ? "text-green-400" : "text-red-400"}>
            {g.name}: {typeof g.value === "number" ? g.value.toFixed(1) : g.value} {g.threshold} → {g.passed ? "OK" : "FAIL"}
           </div>
          ))}
         </>
        )}

        <div className={`font-bold text-xs mt-2 ${lastDiag.cornersFound ? "text-green-400" : "text-red-400"}`}>
         Corners detectados: {lastDiag.cornersFound ? "SI" : "NO"}
        </div>
       </div>
      )}

      {debugLog.length > 0 && (
       <div className="bg-black/60 rounded-xl p-3 border border-zinc-800 max-h-48 overflow-y-auto">
        <pre className="text-[8px] text-zinc-500 font-mono leading-tight whitespace-pre-wrap break-all">
         {debugLog.join("\n")}
        </pre>
       </div>
      )}

      {!lastDiag && debugLog.length === 0 && (
       <div className="text-center text-zinc-600 text-xs mt-8">
        Presiona el boton blanco para capturar y diagnosticar
       </div>
      )}
     </div>
    )}

    {/* Result Modal */}
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
         <div key={r.question} className={`h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${r.answer === "-" ? "bg-zinc-800 text-zinc-600" : "bg-green-500/20 text-green-400 border border-green-500/20"}`}>
          {r.answer !== "-" ? r.answer : ""}
         </div>
        ))}
       </div>

       <button onClick={nextScan} className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition">
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
