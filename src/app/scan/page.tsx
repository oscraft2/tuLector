"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { findCorners, gradeBubbles, readRut, warpImageData, DEFAULT_CONFIG, type BubbleResult } from "@/lib/omr";
import { SCAN_CODES, SCAN_MESSAGES, SCAN_THRESHOLDS } from "@/lib/scanner_config";
import { optX, rowCY, BUBBLE_R, SHEET_W, SHEET_H } from "@/lib/sheet_layout";
import { saveScanLog, SCAN_LOG_VERSION, imageDataToThumb, downscaleCanvas } from "@/lib/scan_log";

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

// ─── Simplified diagnostic wrapper around findCorners ───
interface ZoneDiag {
 name: string;
 bestX: number; bestY: number;
 bestDensity: number;
 bestDarkCount: number;
 winSize: number;
 totalWindows: number;
 passed: boolean;
}

interface FrameDiag {
 w: number; h: number;
 totalPixels: number;
 darkPixels: number;
 darkRatio: number;
 sharpScore: number;
 sharpPassed: boolean;
 zones: ZoneDiag[];
 cornersFound: boolean;
 corners: [number, number][] | null;
}

function diagnoseFrame(imageData: ImageData): FrameDiag {
 const w = imageData.width, h = imageData.height;

 // Overall dark pixel count
 const data = imageData.data;
 let totalDark = 0;
 for (let i = 0; i < data.length; i += 4) {
  const g = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  if (g < 80) totalDark++;
 }

 const sharp = isFrameSharp(imageData);
 const corners = findCorners(imageData);

 return {
  w, h, totalPixels: w * h,
  darkPixels: totalDark,
  darkRatio: (w * h) > 0 ? totalDark / (w * h) : 0,
  sharpScore: sharp,
  sharpPassed: sharp > 40,
  zones: corners ? [
   { name: "TL", bestX: corners[0][0], bestY: corners[0][1], bestDensity: 0, bestDarkCount: 0, winSize: 0, totalWindows: 0, passed: true },
   { name: "TR", bestX: corners[1][0], bestY: corners[1][1], bestDensity: 0, bestDarkCount: 0, winSize: 0, totalWindows: 0, passed: true },
   { name: "BR", bestX: corners[2][0], bestY: corners[2][1], bestDensity: 0, bestDarkCount: 0, winSize: 0, totalWindows: 0, passed: true },
   { name: "BL", bestX: corners[3][0], bestY: corners[3][1], bestDensity: 0, bestDarkCount: 0, winSize: 0, totalWindows: 0, passed: true },
  ] : [],
  cornersFound: corners !== null,
  corners,
 };
}

interface FrameDiag {
 w: number; h: number;
 totalPixels: number;
 darkPixels: number;
  darkRatio: number;
  sharpScore: number;
  sharpPassed: boolean;
  zones: ZoneDiag[];
  cornersFound: boolean;
  corners: [number, number][] | null;
}

// ─── Convert canvas to data URL for frame saving ───
function canvasToDataUrl(canvas: HTMLCanvasElement): string {
 return canvas.toDataURL("image/jpeg", 0.85);
}

// Clave por defecto (demo/fallback offline). La clave real se carga desde la
// URL (?key=CBBBC... o ?quiz=<id> via Supabase) en tiempo de ejecucion.
const DEFAULT_ANSWER_KEY = ["C","B","B","B","C","E","E","D","C","B","A","B","C","D","E","E","D","C","B","A"];

// ─── Captura por votacion multi-frame (estabiliza el resultado) ───
const VOTE_TARGET = 3;        // frames validos a juntar antes de votar (mas rapido)
const VOTE_TIMEOUT_MS = 1800; // tiempo maximo de captura
const VOTE_MAX_ATTEMPTS = 30; // tope de frames inspeccionados
const VOTE_FOCUS_MIN = 35;    // gate de foco (Laplaciano), un poco mas permisivo
const VOTE_MARKS_REQUIRED = 20; // solo frames con la pista de temporizacion completa

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Voto por mayoria de un campo (respuesta de pregunta o fila de ID). */
function voteField(values: string[]): string {
 const counts: Record<string, number> = {};
 for (const v of values) counts[v] = (counts[v] || 0) + 1;
 let best = values[0] ?? "-", bestN = 0;
 for (const [k, n] of Object.entries(counts)) if (n > bestN) { bestN = n; best = k; }
 return best;
}

export default function ScanPage() {
 const videoRef = useRef<HTMLVideoElement>(null);
 const overlayRef = useRef<HTMLCanvasElement>(null);
 const hiddenCanvas = useRef<HTMLCanvasElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

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
 const [warpedThumb, setWarpedThumb] = useState<string | null>(null);
 const [capturing, setCapturing] = useState(false);
 const [answerKey, setAnswerKey] = useState<string[]>(DEFAULT_ANSWER_KEY);

 // Cargar la clave de respuestas desde una sesion autenticada de escaneo.
 useEffect(() => {
  const parseKey = (raw: string) => raw.toUpperCase().split("").filter((c) => "ABCDE".includes(c));
  (async () => {
   try {
    const res = await fetch("/api/scan/active-quiz", { credentials: "include", cache: "no-store" });
    if (!res.ok) {
     setError("Selecciona un ensayo desde el dashboard antes de escanear.");
     return;
    }
    const data = await res.json() as { answer_key?: string; title?: string };
    if (data.answer_key) {
     const arr = parseKey(String(data.answer_key));
     if (arr.length > 0) setAnswerKey(arr);
    }
   } catch {
    setError("No se pudo cargar el ensayo activo. Se mantiene clave offline de prueba.");
   }
  })();
 }, []);
 const badFrameCount = useRef(0);
 const goodFrameCount = useRef(0);
 const stableFrames = useRef(0);
 const lastFrameTime = useRef(0);
 const lastCornersRef = useRef<[number, number][] | null>(null);
 const frameSkipMs = 66;

 const cooldownMs = SCAN_THRESHOLDS.scanCooldownMs;
 const stableFramesNeeded = 5;
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
 const processScan = async (frame: ImageData, corners: [number, number][], source: "camera" | "upload" = "camera") => {
  const canvas = hiddenCanvas.current;
  if (!canvas) return;

  // Dimensionar el canvas al frame (sirve para video EN VIVO y para foto subida).
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(frame, 0, 0);

  const logs: string[] = [];
  const addLog = (msg: string) => { logs.push(msg); console.log("[Scan]", msg); };

  try {
   addLog(`Frame: ${canvas.width}x${canvas.height}`);
   addLog(`Corners: TL=(${corners[0][0]},${corners[0][1]}) TR=(${corners[1][0]},${corners[1][1]}) BR=(${corners[2][0]},${corners[2][1]}) BL=(${corners[3][0]},${corners[3][1]})`);

   const srcImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
   // Warp directo (mismo motor que el test). Antes via Web Worker duplicado que
   // se colgaba si solve8x8 fallaba y dejaba borde negro (auditorias P1-3/P1-4).
   const warped = warpImageData(srcImageData, corners, config);
   addLog(`Warped: ${warped.width}x${warped.height}`);

   // Thumbnails: foto original + warp (para diagnostico y dataset).
   const photoThumb = imageDataToThumb(frame, 480, 0.6);
   let warpThumb: string | null = null;
   try {
    const fullC = document.createElement("canvas"); fullC.width = warped.width; fullC.height = warped.height;
    fullC.getContext("2d")!.putImageData(warped, 0, 0);
    warpThumb = downscaleCanvas(fullC, 360, 0.7);
    setWarpedThumb(warpThumb);
   } catch { /* no crítico */ }

   const report = gradeBubbles(warped, config, corners);
   const rutR = readRut(warped, config);
   const idRows = rutR.rut ? [rutR.rut] : [];
   const scores = (report.results ?? []).map(r => ({ q: r.question, a: r.answer, s: r.scores }));

   const save = (type: "scan" | "scan_fail", code: number | undefined, valid: boolean) =>
    saveScanLog({
     v: SCAN_LOG_VERSION, type, source, sheet: "v2", ts: new Date().toISOString(),
     frame: { w: canvas.width, h: canvas.height },
     diag: report.diag as unknown as Record<string, unknown>,
     corners, result: { valid, code, reason: report.reason },
     answers: scores, id: idRows, rut: rutR.rut, dvOk: rutR.dvOk, photo: photoThumb, warp: warpThumb,
    });

   if (report.diag) addLog(`Registro: ${report.diag.usedTiming ? `temporizacion (${report.diag.timingRows} marcas)` : "offset software"}, dx=${report.diag.gridDx}`);

   if (!report.valid) {
    addLog(`ERR[${SCAN_CODES.WRONG_FORMAT}]: ${report.reason}`);
    setDebugLog(logs);
    setShowDebug(true);
    setPhase("detecting");
    // Mostrar la razon REAL (ancla, timing, curva, warp) en vez del generico.
    setError(report.reason || SCAN_MESSAGES[SCAN_CODES.WRONG_FORMAT] || "Error");
    await save("scan_fail", SCAN_CODES.WRONG_FORMAT, false);
    return;
   }

   const bubbleResults = report.results;

   const answeredCount = bubbleResults.filter(r => r.answer !== "-" && r.answer !== "?").length;
   if (answeredCount === 0) {
    addLog(`ERR[${SCAN_CODES.OUT_OF_FOCUS}]: Sin respuestas`);
    setDebugLog(logs);
    setPhase("detecting");
    setError(SCAN_MESSAGES[SCAN_CODES.OUT_OF_FOCUS]);
    await save("scan_fail", SCAN_CODES.OUT_OF_FOCUS, false);
    return;
   }

   const answerSet = new Set(bubbleResults.filter(r => r.answer !== "-" && r.answer !== "?").map(r => r.answer));
   if (answerSet.size === 1 && answeredCount > 3) {
    const singleAns = [...answerSet][0];
    addLog(`WARN[${SCAN_CODES.CURVE_FAIL}]: ${answeredCount} respuestas "${singleAns}"`);
    setDebugLog(logs);
    setPhase("detecting");
    setError(SCAN_MESSAGES[SCAN_CODES.CURVE_FAIL]);
    await save("scan_fail", SCAN_CODES.CURVE_FAIL, false);
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

   const saved = await save("scan", SCAN_CODES.GRADED, true);
   addLog(saved ? "Guardado en Supabase OK" : "No se pudo guardar (ver consola)");
   setDebugLog([...logs]);

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

 // ─── CAPTURA POR VOTACION MULTI-FRAME (auto-scan en vivo) ───
 // Junta varios frames VALIDOS (gate de foco + formato + 20 marcas), descarta
 // los borrosos/incompletos, y vota por mayoria cada respuesta. La data real
 // mostro que el consenso entre frames es 20/20 aunque frames sueltos fallen.
 const runVotingScan = async () => {
  const video = videoRef.current;
  const canvas = hiddenCanvas.current;
  if (!video || !canvas) return;

  setPhase("scanning");
  setCapturing(true);
  setError("");

  const ctx = canvas.getContext("2d")!;
  const sessions: { answers: string[]; rut: string; dvOk: boolean; scores: number[][] }[] = [];
  const frameReads: string[] = [];   // lectura de cada frame valido (para diagnostico)
  let lastFrame: ImageData | null = null;
  let lastCorners: [number, number][] | null = null;
  let lastWarp: ImageData | null = null;
  let lastTiming: number | null = null;
  let rejFocus = 0, rejCorners = 0, rejInvalid = 0;
  const start = Date.now();
  let attempts = 0;

  while (sessions.length < VOTE_TARGET && Date.now() - start < VOTE_TIMEOUT_MS && attempts < VOTE_MAX_ATTEMPTS) {
   attempts++;
   if (video.readyState < 2) { await sleep(50); continue; }
   canvas.width = video.videoWidth;
   canvas.height = video.videoHeight;
   ctx.drawImage(video, 0, 0);
   const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

   if (isFrameSharp(frame) <= VOTE_FOCUS_MIN) { rejFocus++; await sleep(40); continue; }
   const corners = findCorners(frame, config);
   if (!corners) { rejCorners++; await sleep(40); continue; }
   const warped = warpImageData(frame, corners, config);
   const report = gradeBubbles(warped, config, corners);
   if (!report.valid || report.diag?.timingRows !== VOTE_MARKS_REQUIRED) { rejInvalid++; await sleep(40); continue; }
   const rutR = readRut(warped, config);
   const reads = report.results.map((r) => r.answer);
   sessions.push({ answers: reads, rut: rutR.rut, dvOk: rutR.dvOk, scores: report.results.map((r) => r.scores) });
   frameReads.push(reads.join(","));
   lastFrame = frame; lastCorners = corners; lastWarp = warped;
   lastTiming = report.diag?.timingRows ?? null;
   // Salida temprana: 2 frames validos identicos = suficiente (rapido en buenas condiciones)
   if (sessions.length >= 2 && frameReads[frameReads.length - 1] === frameReads[frameReads.length - 2]) break;
   await sleep(40);
  }

  const rejected = rejFocus + rejCorners + rejInvalid;
  setCapturing(false);

  if (sessions.length === 0 || !lastFrame || !lastCorners || !lastWarp) {
   setError("No se logró un frame estable. Acerca, enfoca y mantén firme.");
   setPhase("detecting");
   return;
  }

  // Votar por pregunta y el RUT
  const votedAnswers = Array.from({ length: config.numQuestions }, (_, q) =>
   voteField(sessions.map((s) => s.answers[q] ?? "-"))
  );
  const votedRut = voteField(sessions.map((s) => s.rut));
  const votedDvOk = sessions.find((s) => s.rut === votedRut)?.dvOk ?? false;
  const repScores = sessions[sessions.length - 1].scores;
  const bubbleResults: BubbleResult[] = votedAnswers.map((a, i) => ({
   question: i + 1, answer: a, scores: repScores[i] ?? [], correct: null,
  }));

  // Thumbnails del último frame válido
  const photoThumb = imageDataToThumb(lastFrame, 480, 0.6);
  let warpThumb: string | null = null;
  try {
   const fc = document.createElement("canvas"); fc.width = lastWarp.width; fc.height = lastWarp.height;
   fc.getContext("2d")!.putImageData(lastWarp, 0, 0);
   warpThumb = downscaleCanvas(fc, 360, 0.7);
   setWarpedThumb(warpThumb);
  } catch { /* no crítico */ }

  setResults(bubbleResults);
  setStudentId(votedRut ? [votedRut] : []);
  setScanCount((c) => c + 1);
  setDebugLog([
   `Votación: ${sessions.length} frames válidos, ${rejected} descartados (foco:${rejFocus} esquinas:${rejCorners} inválido:${rejInvalid})`,
   ...frameReads.map((r, i) => `  frame ${i + 1}: ${r}`),
  ]);
  setPhase("result");

  await saveScanLog({
   v: SCAN_LOG_VERSION, type: "scan", source: "camera", sheet: "v2", ts: new Date().toISOString(),
   frame: { w: lastFrame.width, h: lastFrame.height },
   diag: {
    voted: true, frames: sessions.length, rejected,
    rejFocus, rejCorners, rejInvalid, timingRows: lastTiming,
    reads: frameReads,
   },
   corners: lastCorners,
   result: { valid: true, code: SCAN_CODES.GRADED },
   answers: bubbleResults.map((r) => ({ q: r.question, a: r.answer, s: r.scores })),
   id: votedRut ? [votedRut] : [], rut: votedRut, dvOk: votedDvOk, photo: photoThumb, warp: warpThumb,
  });

  if (navigator.vibrate) navigator.vibrate(100);
  setTimeout(() => {
   setPhase((prev) => (prev === "result" ? "cooldown" : prev));
   setLastScan(Date.now());
   setTimeout(() => setPhase("detecting"), cooldownMs);
  }, 2000);
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

  // Diagnostico ruteado por saveScanLog (sin insert directo, Fase 1.1).
  const sendDiag = () => {
   void saveScanLog({
    v: SCAN_LOG_VERSION, type: "diagnostic", source: "camera", sheet: "v2",
    ts: new Date().toISOString(),
    frame: { w: diag.w, h: diag.h },
    diag: {
     darkRatio: Math.round(diag.darkRatio * 10000) / 100,
     sharpScore: Math.round(diag.sharpScore * 10) / 10,
     sharpPassed: diag.sharpPassed,
     cornersFound: diag.cornersFound,
    },
    corners: diag.corners,
   });
  };
  logs.push(`Frame: ${diag.w}x${diag.h} | Total px: ${diag.totalPixels} | Dark px: ${diag.darkPixels} (${(diag.darkRatio * 100).toFixed(1)}%)`);
  logs.push(`Sharpness: ${diag.sharpScore.toFixed(1)} (min 40) → ${diag.sharpPassed ? "OK" : "FAIL"}`);
  logs.push(``);

  // Zone diagnostics
  logs.push(`--- DIAGNOSTICO POR ZONA (ventana deslizante ${diag.zones[0]?.winSize}x${diag.zones[0]?.winSize}) ---`);
  for (const z of diag.zones) {
   logs.push(`Zone ${z.name}: best=(${z.bestX},${z.bestY}) | density=${(z.bestDensity*100).toFixed(0)}%(${z.bestDarkCount}/${z.winSize*z.winSize}) | ${z.passed ? "OK" : "FAIL (min 35%)"}`);
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
   sendDiag();
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
   sendDiag();
   setCapturing(false);
   await processScan(frame, relaxed);
   return;
  }
  logs.push(`Relaxed fallback tambien fallo.`);

  setDebugLog(logs);
  sendDiag();
  setCapturing(false);
 };

 // ─── SUBIR FOTO: procesa una imagen del telefono con el mismo motor ───
 const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setCapturing(true);
  setShowDebug(true);
  setError("");

  try {
   const url = URL.createObjectURL(file);
   const img = new Image();
   await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("img")); img.src = url; });

   const canvas = hiddenCanvas.current ?? document.createElement("canvas");
   canvas.width = img.naturalWidth;
   canvas.height = img.naturalHeight;
   const ctx = canvas.getContext("2d")!;
   ctx.drawImage(img, 0, 0);
   const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
   URL.revokeObjectURL(url);

   const diag = diagnoseFrame(frame);
   setLastDiag(diag);
   const logs: string[] = [
    `Foto: ${diag.w}x${diag.h} | Oscuro ${(diag.darkRatio * 100).toFixed(1)}% | Nitidez ${diag.sharpScore.toFixed(0)}`,
   ];

   if (diag.cornersFound && diag.corners) {
    logs.push(">>> Esquinas detectadas, calificando...");
    setDebugLog(logs);
    setCapturing(false);
    await processScan(frame, diag.corners, "upload");
   } else {
    const relaxed = tryRelaxedCorners(frame);
    if (relaxed) {
     logs.push(">>> Esquinas (umbral relajado), calificando...");
     setDebugLog(logs);
     setCapturing(false);
     await processScan(frame, relaxed, "upload");
    } else {
     logs.push("No se detectaron las 4 anclas. Revisa que se vean completas y con buen foco.");
     setDebugLog(logs);
     setError("No se detectaron las 4 esquinas en la foto");
     setCapturing(false);
    }
   }
  } catch {
   setError("No se pudo leer la imagen");
   setCapturing(false);
  } finally {
   e.target.value = "";
  }
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

     // Solo contar frames estables si las corners no se movieron >25px respecto al frame anterior
     const prev = lastCornersRef.current;
     const cornersStable = prev !== null && corners.every((c, i) =>
       Math.hypot(c[0] - prev[i][0], c[1] - prev[i][1]) < 25
     );
     lastCornersRef.current = corners;
     if (cornersStable) stableFrames.current++;
     else stableFrames.current = 0;

     const canScan = Date.now() - lastScan > cooldownMs;
     if (stableFrames.current >= stableFramesNeeded && canScan && phase === "detecting") {
      stableFrames.current = 0;
      setPhase("scanning");
      runVotingScan();
     }
    } else {
     stableFrames.current = 0;
     lastCornersRef.current = null;
     setDetected(false);
     setInFocus(false);
    }
   } else {
    stableFrames.current = 0;
    lastCornersRef.current = null;
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
  setWarpedThumb(null);
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

    {/* ─── SHUTTER + SUBIR FOTO ─── */}
    <input
     ref={fileInputRef}
     type="file"
     accept="image/*"
     onChange={onPickFile}
     className="hidden"
    />
    <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-8 z-20">
     <button
      onClick={captureFrame}
      disabled={capturing || !stream}
      className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-90 ${capturing ? "opacity-50 scale-75" : "hover:scale-105"}`}
     >
      <div className={`w-16 h-16 rounded-full ${capturing ? "bg-zinc-500" : "bg-white"}`} />
     </button>
     <button
      onClick={() => fileInputRef.current?.click()}
      disabled={capturing}
      className="absolute right-8 flex flex-col items-center gap-1 text-white/80 hover:text-white disabled:opacity-40 transition"
     >
      <span className="w-12 h-12 rounded-2xl border border-white/40 bg-black/40 backdrop-blur flex items-center justify-center">
       <ImageIcon />
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wider">Subir foto</span>
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

        <div className="text-green-400 font-bold text-xs mt-2 mb-1">SLIDING WINDOW (win={lastDiag.zones[0]?.winSize}px, min 35% dark)</div>
        <table className="w-full border-collapse text-[9px]">
         <thead>
          <tr className="text-zinc-500">
           <th className="text-left pr-2">Z</th>
           <th className="text-right px-1">X</th>
           <th className="text-right px-1">Y</th>
           <th className="text-right px-1">Dark</th>
           <th className="text-right px-1">Dens%</th>
           <th className="text-center">Ok</th>
          </tr>
         </thead>
         <tbody>
          {lastDiag.zones.map((z, i) => (
           <tr key={i} className="border-t border-zinc-800">
            <td className="text-left pr-2 text-zinc-500">{z.name}</td>
            <td className={`text-right px-1 ${z.passed ? "text-green-400" : "text-zinc-400"}`}>{z.bestX}</td>
            <td className={`text-right px-1 ${z.passed ? "text-green-400" : "text-zinc-400"}`}>{z.bestY}</td>
            <td className={`text-right px-1 ${z.passed ? "text-green-400" : "text-red-400"}`}>{z.bestDarkCount}</td>
            <td className={`text-right px-1 ${z.passed ? "text-green-400" : "text-red-400"}`}>{z.bestDensity}</td>
            <td className={`text-center ${z.passed ? "text-green-400" : "text-red-400"}`}>
             {z.passed ? "OK" : "X"}
            </td>
           </tr>
          ))}
         </tbody>
        </table>

        <div className={`font-bold text-xs mt-2 ${lastDiag.cornersFound ? "text-green-400" : "text-red-400"}`}>
         Corners detectados: {lastDiag.cornersFound ? "SI" : "NO"}
        </div>
       </div>
      )}

      {/* ─── WARP PREVIEW ─── */}
      {warpedThumb && (
       <div className="mb-4">
        <div className="text-green-400 font-bold text-xs mb-2">IMAGEN WARPEADA (lo que ve el clasificador)</div>
        <div className="relative inline-block border border-zinc-700 rounded-lg overflow-hidden">
         <img src={warpedThumb} alt="warp" className="block" style={{ width: 150, height: "auto" }} />
         {/* Grid de burbujas superpuesto */}
         <svg className="absolute inset-0" style={{ width: 150, height: "auto", aspectRatio: `${SHEET_W}/${SHEET_H}` }}
              viewBox={`0 0 ${SHEET_W} ${SHEET_H}`} preserveAspectRatio="xMidYMid meet">
          {/* Posiciones canonicas desde sheet_layout (misma fuente que la hoja). */}
          {Array.from({ length: 20 }, (_, q) => {
           const cy = rowCY(q);
           return [0, 1, 2, 3, 4].map((o) => (
            <circle key={`${q}-${o}`} cx={optX(o)} cy={cy} r={BUBBLE_R}
             fill="none" stroke={["#ef4444","#f97316","#facc15","#22c55e","#3b82f6"][o]} strokeWidth="3" opacity="0.8" />
           ));
          })}
         </svg>
        </div>
        <p className="text-[9px] text-zinc-500 mt-1">A=rojo B=naranja C=amarillo D=verde E=azul · posiciones de sheet_layout</p>
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
       {(() => {
        const correct = results.filter((r, i) => r.answer !== "-" && r.answer === answerKey[i]).length;
        const answered = results.filter(r => r.answer !== "-").length;
        return (
         <>
          <div className="flex justify-between items-start mb-4">
           <div>
            <h2 className="text-2xl font-black text-white">{correct}<span className="text-zinc-500 text-lg font-bold">/20</span></h2>
            <p className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Escaneo #{scanCount} · {answered} respondidas</p>
           </div>
           <div className="flex flex-col items-end gap-1">
            <div className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[10px] font-black border border-green-500/20">
             RUT: {studentId.join("") || "???"}
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

          <div className="grid grid-cols-5 gap-1.5 mb-2">
           {results.map((r, i) => {
            const expected = answerKey[i];
            const isCorrect = r.answer !== "-" && r.answer === expected;
            const isWrong = r.answer !== "-" && r.answer !== expected;
            return (
             <div key={r.question} className={`rounded-lg flex flex-col items-center justify-center py-1 text-[9px] font-bold gap-0.5
              ${isCorrect ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : isWrong ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-zinc-800 text-zinc-600"}`}>
              <span className="text-[10px]">{r.answer !== "-" ? r.answer : "–"}</span>
              <span className="text-[8px] opacity-60">{isWrong ? expected : ""}</span>
             </div>
            );
           })}
          </div>
          <div className="flex gap-1 mb-6">
           <div className="flex items-center gap-1 text-[8px] text-green-500"><span className="w-2 h-2 rounded-sm bg-green-500/30 border border-green-500/40 inline-block"/>{results.filter((r,i)=>r.answer===answerKey[i]).length} correctas</div>
           <div className="flex items-center gap-1 text-[8px] text-red-400 ml-2"><span className="w-2 h-2 rounded-sm bg-red-500/30 border border-red-500/40 inline-block"/>{results.filter((r,i)=>r.answer!=="-"&&r.answer!==answerKey[i]).length} incorrectas</div>
          </div>
         </>
        );
       })()}

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

function ImageIcon() {
 return (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
   <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
   <circle cx="9" cy="9" r="2"/>
   <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </svg>
 );
}


