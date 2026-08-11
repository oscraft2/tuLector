"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { findCorners, gradeBubbles, readRut, readSheetCode, warpSheet, cropNameBox, DEFAULT_CONFIG, type BubbleResult } from "@/lib/omr";
import { isNativeApp, captureNativePhoto, toggleTorch } from "@/lib/native/capacitor";
import { enqueueScan, getQueueSize } from "@/lib/offline_queue";
import {
  saveQuizPack, loadQuizPack, saveQuizLibrary, loadQuizLibrary, normalizeQuizPack,
  type CachedQuiz, type RawQuizPack,
} from "@/lib/quiz_cache";
import { SCAN_CODES, SCAN_MESSAGES, SCAN_THRESHOLDS } from "@/lib/scanner_config";
import { optX, rowCY, BUBBLE_R, SHEET_W, SHEET_H, rutColX, rutRowY, RUT_COLS, RUT_ROWS, RUT_R, questionLayout } from "@/lib/sheet_layout";
import { saveScanLog, SCAN_LOG_VERSION, imageDataToThumb, downscaleCanvas } from "@/lib/scan_log";
import { APP_VERSION } from "@/lib/version";
import { safeColumns, allowedColumns, LEGACY_OPEN_BOXES_PER_PAGE } from "@/lib/sheet_generator";
import { resolveIdReadConfig } from "@/lib/country_id_blocks";
import { QUIZ_MAX_QUESTIONS, parseOpenQuestions, parseOptionOverrides, parseMultiSelectQuestions } from "@/lib/quiz_constraints";
import { useSensoryFeedback, loadSensoryPrefs, saveSensoryPrefs, type SensoryStoredPrefs } from "@/lib/hooks/useSensoryFeedback";

// "hud" = resultado NO bloqueante (caso feliz o error en modo ráfaga), auto-avanza solo.
// "review" = modal bloqueante clásico (modo ráfaga apagado).
// "clearing" = tras el HUD, esperando que la hoja salga de cuadro antes de rearmar el disparo automático.
type ScanPhase = "detecting" | "scanning" | "hud" | "review" | "clearing";
type ScanSyncState = "idle" | "saving" | "saved" | "review" | "error" | "queued" | "partial";
type HudKind = "success" | "warning" | "error";

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

// Antes aca vivia DEFAULT_ANSWER_KEY, una clave de demo hardcodeada que se
// usaba como "fallback offline". Era peligrosa: sin red la carga del ensayo
// falla, se quedaba esa clave falsa, y el profesor veia "18/20 correctas" con
// toda naturalidad sobre un numero que no significaba nada. Ahora, sin clave
// real no se muestra puntaje: se muestran las respuestas leidas y se dice que
// falta la pauta.
const NO_ANSWER_KEY: string[] = [];

/** Ensayo activo cacheado para poder corregir SIN RED (ver quiz_cache.ts). */
const QUIZ_PACK_KEY = "tulector_active_quiz_pack";

// ─── Captura por votacion multi-frame (estabiliza el resultado) ───
const VOTE_TARGET = 3;        // frames validos a votar (3 = RUT robusto, como cuando leia 4/4)
const VOTE_TIMEOUT_MS = 4000; // tiempo maximo de captura (mas margen para agarrar frames NITIDOS)
const VOTE_MAX_ATTEMPTS = 45; // tope de frames inspeccionados
const VOTE_FOCUS_MIN = 35;    // gate de foco: EXIGENTE — el RUT (burbujas chicas) necesita nitidez
const BUILD_TAG = APP_VERSION; // versión visible (compartida con el menú)

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
 const router = useRouter();
 const videoRef = useRef<HTMLVideoElement>(null);
 const overlayRef = useRef<HTMLCanvasElement>(null);
 const hiddenCanvas = useRef<HTMLCanvasElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const [phase, setPhase] = useState<ScanPhase>("detecting");
 const [results, setResults] = useState<BubbleResult[]>([]);
 const [studentId, setStudentId] = useState<string[]>([]);
 const [studentName, setStudentName] = useState<string | null>(null);
 // Ultimo paper guardado con exito: habilita el acceso MANUAL al reverso desde
 // el HUD (ver sensoryPrefs.autoReverso -- el salto automatico esta apagado).
 const [lastPaperId, setLastPaperId] = useState<string | null>(null);
 // Aviso SUAVE de curso cruzado: el alumno es de otro curso que el ensayo (un
 // curso rindiendo con la hoja de otro). No bloquea nada -- la nota se guarda
 // igual y queda bajo el curso del ALUMNO.
 const [courseNote, setCourseNote] = useState<string | null>(null);
 const [stream, setStream] = useState<MediaStream | null>(null);
 const streamRef = useRef<MediaStream | null>(null);
 const [error, setError] = useState("");
 const [detected, setDetected] = useState(false);
 const [inFocus, setInFocus] = useState(false);
 const [lastScan, setLastScan] = useState(0);
 const [scanCount, setScanCount] = useState(0);
 // Modo ráfaga (docs/plan-mejora-scan-zipgrade.md): HUD no bloqueante + auto-avance.
 const [sensoryPrefs, setSensoryPrefs] = useState<SensoryStoredPrefs>({ sound: true, vibration: true, burstMode: true, autoReverso: false });
 useEffect(() => {
  let alive = true;
  Promise.resolve().then(() => { if (alive) setSensoryPrefs(loadSensoryPrefs()); });
  return () => { alive = false; };
 }, []);
 const { fire: fireSensory, unlock: unlockSensory } = useSensoryFeedback(sensoryPrefs);
 const [hudKind, setHudKind] = useState<HudKind>("success");
 const [hudMessage, setHudMessage] = useState<string | null>(null);
 const [pendingReviewCount, setPendingReviewCount] = useState(0);
 const [showSettings, setShowSettings] = useState(false);
 const [voteProgress, setVoteProgress] = useState(0);
 const [sharpDisplay, setSharpDisplay] = useState(0);
 // Mirrors en ref del phase/lastScan de estado -- el loop RAF los lee sin
 // tenerlos en su dependencia (evita remount del loop en cada transición de fase).
 const phaseRef = useRef<ScanPhase>("detecting");
 const lastScanRef = useRef(0);
 // Esquinas al momento del HUD, para detectar en "clearing" que la hoja salió
 // de cuadro (distinto de lastCornersRef, que se muta cada frame para estabilidad).
 const capturedCornersRef = useRef<[number, number][] | null>(null);
 const clearingStartRef = useRef(0);
 const wasDetectedRef = useRef(false);
 const [debugLog, setDebugLog] = useState<string[]>([]);
 const [showDebug, setShowDebug] = useState(false);
 const [lastDiag, setLastDiag] = useState<FrameDiag | null>(null);
 const [warpedThumb, setWarpedThumb] = useState<string | null>(null);
 const [capturing, setCapturing] = useState(false);
 const [answerKey, setAnswerKey] = useState<string[]>(NO_ANSWER_KEY);
 // Sin pauta real no se muestra puntaje (ver NO_ANSWER_KEY).
 const hasAnswerKey = answerKey.length > 0;
 // Lecturas esperando red. Se muestra siempre que haya alguna, para que el
 // profesor sepa que tiene trabajo sin subir antes de cerrar la app.
 const [queuedCount, setQueuedCount] = useState(0);
 const [isOnline, setIsOnline] = useState(true);
 // Ensayos descargados para poder cambiar de uno a otro SIN RED (la pantalla
 // que normalmente los lista, /app/scan, es de servidor y offline no responde).
 const [library, setLibrary] = useState<CachedQuiz[]>([]);
 const [showLibrary, setShowLibrary] = useState(false);
 const [activeQuizTitle, setActiveQuizTitle] = useState<string | null>(null);
 const [native, setNative] = useState(false);
 // Config de lectura sincronizada con el generador (/sheet la guarda en localStorage).
 const [scanCfg, setScanCfg] = useState({
  numQuestions: 20, numOptions: 5, numColumns: 1, optionLabels: "ABCDE", openQuestions: [] as number[],
  optionOverrides: {} as Record<number, number>, multiSelectQuestions: [] as number[],
  // Regla de reparto de reverso EFECTIVA del ensayo activo (ver quizInfo.openBoxesPerPage
  // en /sheet) -- default legacy hasta que se cargue el ensayo real.
  openBoxesPerPage: LEGACY_OPEN_BOXES_PER_PAGE,
 });
 useEffect(() => {
  let alive = true;
  Promise.resolve().then(() => {
   if (!alive) return;
   try {
    const raw = localStorage.getItem("tulector_scan_config");
    if (raw) {
     const c = JSON.parse(raw);
     const nq = c.numQuestions || 20;
     setScanCfg({
      numQuestions: nq, numOptions: c.numOptions || 5, numColumns: c.numColumns || 1, optionLabels: c.optionLabels || "ABCDE",
      openQuestions: Array.isArray(c.openQuestions) ? parseOpenQuestions(c.openQuestions.join(","), nq) : [],
      optionOverrides: c.optionOverrides && typeof c.optionOverrides === "object" ? c.optionOverrides : {},
      multiSelectQuestions: Array.isArray(c.multiSelectQuestions) ? parseOpenQuestions(c.multiSelectQuestions.join(","), nq) : [],
      // Cache local sin este campo (versiones anteriores) -> legacy; se
      // sobreescribe enseguida con el valor real al resolver /api/scan/active-quiz.
      openBoxesPerPage: typeof c.openBoxesPerPage === "number" ? c.openBoxesPerPage : LEGACY_OPEN_BOXES_PER_PAGE,
     });
    }
   } catch { /* sin config guardada → default */ }
  });
  return () => { alive = false; };
 }, []);
 const [labeled, setLabeled] = useState(false);
 const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
 const [activeSheetCode, setActiveSheetCode] = useState<number | null>(null);
 // Pais del colegio del ensayo activo: decide con que bloque de ID nacional se
 // lee el RUT/DNI/CPF/... (Fase 0/1, plan-multipais-motor.md). Default CL.
 const [activeCountryCode, setActiveCountryCode] = useState<string>("CL");
 const idReadCfg = useMemo(() => resolveIdReadConfig(activeCountryCode), [activeCountryCode]);
 const [sheetWarn, setSheetWarn] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<ScanSyncState>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [torchOn, setTorchOn] = useState(false);

 useEffect(() => { let a = true; Promise.resolve().then(() => { if (a) setNative(isNativeApp()); }); return () => { a = false; }; }, []);
 useEffect(() => { phaseRef.current = phase; }, [phase]);
 useEffect(() => { lastScanRef.current = lastScan; }, [lastScan]);
 // AudioContext queda "suspended" hasta un gesto real del usuario (iOS/Chrome).
 // Se desbloquea con el primer toque en cualquier control de la pantalla.
 useEffect(() => {
  const unlock = () => unlockSensory();
  window.addEventListener("pointerdown", unlock, { once: true });
  return () => window.removeEventListener("pointerdown", unlock);
 }, [unlockSensory]);
 // Auto-dismiss del HUD: tras mostrarlo, pasa a "clearing" (espera a que la
 // hoja salga de cuadro antes de rearmar el disparo automático).
 useEffect(() => {
  if (phase !== "hud" || !sensoryPrefs.burstMode) return;
  const duration = hudKind === "error" ? 3000 : hudKind === "warning" ? 2200 : 1500;
  const t = setTimeout(() => setPhase("clearing"), duration);
  return () => clearTimeout(t);
 }, [phase, hudKind, sensoryPrefs.burstMode]);

 // FASE 3 (dataset): el profe confirma que la lectura es correcta → guarda un
 // ejemplo ETIQUETADO (ground truth) para entrenar el clasificador. NO toca la captura.
 const confirmRead = async () => {
  setLabeled(true);
  await saveScanLog({
   v: SCAN_LOG_VERSION, type: "label", source: "camera", sheet: "v2", ts: new Date().toISOString(),
   answers: results.map((r) => ({ q: r.question, a: r.answer, s: r.scores, f: r.features })),
   corrected: results.map((r) => ({ q: r.question, a: r.answer })),
   rut: studentId[0], rutTrue: studentId[0], verified: true,
   countryCode: "CL", // hoy todo el trafico real es CL; ver Fase 2 en plan-multipais-motor.md
  });
 };

 // Aviso SUAVE: compara el codigo leido de la hoja con el sheet_code del ensayo
 // activo. Solo advierte (no bloquea) y solo si ambos existen (hoja vieja sin
 // codigo o ensayo sin codigo -> no molesta).
 const checkSheetCode = (codeR: { sheetId: number } | null): string | null => {
  if (activeSheetCode == null || !codeR) return null;
  if (codeR.sheetId !== activeSheetCode) {
   return `Esta hoja parece de OTRO ensayo (codigo ${codeR.sheetId}, esperado ${activeSheetCode}). Verifica que sea la hoja correcta.`;
  }
  return null;
 };

 // RUT esperado completo (cuerpo + digitos verificadores) segun el pais activo.
 const expectedRutLength = useMemo(() => idReadCfg.block.idDigits + idReadCfg.block.checkDigits, [idReadCfg]);

 // Entra al resultado de una hoja ya calificada (kind "success"/"warning") o a
 // un fallo de grading (kind "error"). Modo ráfaga ON -> HUD no bloqueante para
 // TODO, con auto-avance via "clearing" (exige que la hoja salga de cuadro).
 // Modo ráfaga OFF -> preserva el comportamiento clásico: error = banner no
 // bloqueante + vuelta directa a "detecting" (como siempre fue); success/warning
 // = modal "review" bloqueante con tap "Siguiente" (como el modal de toda la vida).
 const enterResult = (kind: HudKind, message: string | null, corners: [number, number][] | null) => {
  fireSensory(kind);
  if (!sensoryPrefs.burstMode) {
   if (kind === "error") {
    setPhase("detecting");
    setError(message || "");
   } else {
    setHudKind(kind);
    setHudMessage(message);
    setPhase("review");
   }
   return;
  }
  setLastScan(Date.now());
  capturedCornersRef.current = corners;
  clearingStartRef.current = Date.now();
  setHudKind(kind);
  setHudMessage(message);
  setPhase("hud");
 };

 // Cargar la clave y formato desde una sesion autenticada de escaneo.
 useEffect(() => {
  const parseKey = (raw: string) => raw.toUpperCase().split("").filter((c) => "ABCDE".includes(c));
  const parseLabels = (raw?: string) => {
   const labels = String(raw || "ABCDE").toUpperCase().replace(/[^A-Z]/g, "");
   return labels || "ABCDE";
  };
  /** Rehidrata el ensayo cacheado. Devuelve true si habia uno usable. */
  const hydrateFromCache = () => {
   const pack = loadQuizPack(QUIZ_PACK_KEY);
   if (!pack) return false;
   setActiveQuizId(pack.quizId);
   setActiveSheetCode(pack.sheetCode);
   setActiveCountryCode(pack.countryCode || "CL");
   if (pack.answerKey.length > 0) setAnswerKey(pack.answerKey);
   setScanCfg(pack.cfg);
   setActiveQuizTitle(pack.title ?? null);
   return true;
  };

  (async () => {
   try {
    // Sin red no se intenta la llamada: se va directo al ensayo cacheado. Asi
    // el arranque offline no queda esperando un fetch que va a fallar.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
     if (hydrateFromCache()) setError("Sin conexion. Se usa el ultimo ensayo descargado; las lecturas se sincronizaran despues.");
     else setError("Sin conexion y sin ensayo descargado. Conectate una vez para poder corregir sin red.");
     return;
    }
    const res = await fetch("/api/scan/active-quiz", { credentials: "include", cache: "no-store" });
    if (!res.ok) {
     setError("Selecciona un ensayo desde el dashboard antes de escanear.");
     return;
    }
    const data = await res.json() as { id?: string; answer_key?: string; title?: string; num_questions?: number; options_per_question?: number; option_labels?: string; num_columns?: number; sheet_code?: number | null; open_questions?: string | null; option_overrides?: string | null; multi_select_questions?: string | null; open_boxes_per_page?: number | null; country_code?: string };
    if (data.id) setActiveQuizId(String(data.id));
    if (data.title) setActiveQuizTitle(String(data.title));
    setActiveSheetCode(typeof data.sheet_code === "number" ? data.sheet_code : null);
    if (data.country_code) setActiveCountryCode(data.country_code);
    if (data.answer_key) {
     const arr = parseKey(String(data.answer_key));
     if (arr.length > 0) setAnswerKey(arr);
    }
    // Multipagina (Fase 1): el grid de lectura es SIEMPRE de 1 pagina (max
    // MAX_QUESTIONS_PER_PAGE) -- /scan usa una config estatica para todo el
    // ensayo, no sabe que pagina tiene delante hasta leer el codigo de hoja
    // (que se decodifica DESPUES de aplicar la grilla). Un ensayo de 250
    // preguntas se lee igual que uno de 100: cada hoja fisica trae come mucho
    // MAX_QUESTIONS_PER_PAGE filas. Ver docs/plan-multipagina-fase1.md.
    const nextQuestions = Math.min(Number(data.num_questions || 20), QUIZ_MAX_QUESTIONS);
    const nextOptions = Number(data.options_per_question || 5);
    // Nº de columnas del ENSAYO (Fase 2); si no viene, cae a la heuristica de antes.
    const nextColumns = safeColumns(nextQuestions, Number(data.num_columns) || (nextQuestions > 30 ? 2 : 1));
    const nextLabels = parseLabels(data.option_labels).slice(0, nextOptions);
    // Abiertas SOLO si el ensayo cabe en 1 hoja: en multipagina la numeracion
    // local por pagina no se conoce hasta decodificar el codigo de hoja
    // (limitacion documentada; sin burbujas igual se lee "-" y el servidor
    // excluye las abiertas del puntaje).
    const totalQuestions = Number(data.num_questions || 20);
    const fitsOnePage = totalQuestions <= QUIZ_MAX_QUESTIONS;
    const nextOpen = fitsOnePage ? parseOpenQuestions(data.open_questions ?? "", nextQuestions) : [];
    // Mismo motivo que las abiertas (limitacion documentada, multipagina): la
    // numeracion local por pagina no se conoce hasta decodificar el codigo de
    // hoja, asi que overrides/multiSelect solo se aplican si cabe en 1 hoja.
    const nextOptionOverrides = fitsOnePage ? parseOptionOverrides(data.option_overrides ?? "", nextQuestions) : {};
    const nextMultiSelect = fitsOnePage ? parseMultiSelectQuestions(data.multi_select_questions ?? "", nextQuestions) : [];
    // Regla de reparto de reverso EFECTIVA del ensayo activo (ver
    // quizInfo.openBoxesPerPage/LEGACY_OPEN_BOXES_PER_PAGE en /sheet): NULL =
    // ensayo creado antes de la migracion open_boxes_per_page -> legacy.
    const nextOpenBoxesPerPage = typeof data.open_boxes_per_page === "number" ? data.open_boxes_per_page : LEGACY_OPEN_BOXES_PER_PAGE;
    const nextCfg = {
     numQuestions: nextQuestions, numOptions: nextOptions, numColumns: nextColumns, optionLabels: nextLabels, openQuestions: nextOpen,
     optionOverrides: nextOptionOverrides, multiSelectQuestions: nextMultiSelect, openBoxesPerPage: nextOpenBoxesPerPage,
    };
    setScanCfg(nextCfg);
    try { localStorage.setItem("tulector_scan_config", JSON.stringify(nextCfg)); } catch { /* sin storage */ }

    // Deja el ensayo listo para corregir sin red la proxima vez.
    if (data.id) {
     saveQuizPack(QUIZ_PACK_KEY, {
      quizId: String(data.id),
      answerKey: data.answer_key ? parseKey(String(data.answer_key)) : [],
      sheetCode: typeof data.sheet_code === "number" ? data.sheet_code : null,
      countryCode: data.country_code ?? "CL",
      cfg: nextCfg,
      title: data.title,
      savedAt: Date.now(),
     });
    }
   } catch {
    // La red se cayo a mitad de camino: mismo camino que el arranque offline.
    if (hydrateFromCache()) setError("Sin conexion. Se usa el ultimo ensayo descargado; las lecturas se sincronizaran despues.");
    else setError("No se pudo cargar el ensayo activo y no hay uno descargado. Sin pauta no se calcula puntaje.");
   }
  })();
 }, []);

 // Biblioteca de ensayos: se muestra al instante lo ya descargado y, si hay
 // red, se refresca en segundo plano. Nunca bloquea el escaneo.
 useEffect(() => {
  (async () => {
   // Lo ya descargado primero (dentro del async: setState sincrono en el cuerpo
   // del efecto encadena renders de mas).
   setLibrary(loadQuizLibrary());
   if (typeof navigator !== "undefined" && !navigator.onLine) return;
   try {
    const res = await fetch("/api/scan/quiz-packs", { credentials: "include", cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json() as { country_code?: string; quizzes?: RawQuizPack[] };
    const packs = (data.quizzes ?? []).map((q) => normalizeQuizPack(q, data.country_code ?? "CL"));
    if (packs.length === 0) return;
    saveQuizLibrary(packs);
    setLibrary(packs);
   } catch {
    // Sin red o error: queda la biblioteca previa, que es justamente el punto.
   }
  })();
 }, []);

 /** Cambia el ensayo activo usando SOLO datos locales (sirve sin conexion). */
 const selectCachedQuiz = (pack: CachedQuiz) => {
  setActiveQuizId(pack.quizId);
  setActiveSheetCode(pack.sheetCode);
  setActiveCountryCode(pack.countryCode || "CL");
  setAnswerKey(pack.answerKey);
  setScanCfg(pack.cfg);
  setActiveQuizTitle(pack.title ?? null);
  saveQuizPack(QUIZ_PACK_KEY, pack);
  try { localStorage.setItem("tulector_scan_config", JSON.stringify(pack.cfg)); } catch { /* sin storage */ }
  setShowLibrary(false);
  setError(pack.answerKey.length > 0 ? "" : "Este ensayo no tiene pauta cargada: no se calculara puntaje.");
 };

 // Estado de red + cola pendiente. La cola tambien la vacia NativeBootstrap al
 // volver la conexion, asi que se relee al reconectar para reflejarlo.
 useEffect(() => {
  let alive = true;
  // El estado inicial se resuelve DENTRO de refresh (no en el cuerpo del
  // efecto): asi no hay setState sincrono ni riesgo de desajuste de hidratacion,
  // porque el HTML del servidor siempre se renderiza como "en linea".
  const refresh = async () => {
   const size = await getQueueSize().catch(() => 0);
   if (!alive) return;
   setQueuedCount(size);
   setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
  };
  const onOnline = () => { setIsOnline(true); setTimeout(refresh, 2000); };
  const onOffline = () => setIsOnline(false);
  refresh();
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  return () => {
   alive = false;
   window.removeEventListener("online", onOnline);
   window.removeEventListener("offline", onOffline);
  };
 }, []);

 const badFrameCount = useRef(0);
 const goodFrameCount = useRef(0);
 const stableFrames = useRef(0);
 const lastFrameTime = useRef(0);
 const lastCornersRef = useRef<[number, number][] | null>(null);
 // 33ms (~30fps) en vez de 66ms, y 3 frames estables en vez de 5: la votación de
 // 3 frames YA es la red de seguridad de precisión -- más frames de "espera"
 // antes del disparo solo agregaban latencia (docs/plan-mejora-scan-zipgrade.md P0-D).
 const frameSkipMs = 33;

 const cooldownMs = SCAN_THRESHOLDS.scanCooldownMs;
 const stableFramesNeeded = 3;
 // Canvas de deteccion a mitad de resolucion: findCorners/isFrameSharp corren
 // sobre ~4x menos pixeles (el warp/grade real sigue a resolucion completa, solo
 // la detección de esquinas en vivo se reduce). Las anclas son grandes y deberian
 // seguir detectandose bien; si la tasa de deteccion baja en dispositivos reales,
 // subir DETECT_SCALE hacia 1 (ver riesgo #11 del plan).
 const DETECT_SCALE = 0.5;
 const detectCanvasRef = useRef<HTMLCanvasElement | null>(null);
 // Config del lector = la del generador (nº preguntas/opciones/columnas). Esto
 // sincroniza el motor con la hoja impresa (antes estaba fijo en 20/5/1 columna).
 // useMemo: identidad estable → no re-dispara el loop de cámara (que depende de config).
 const config = useMemo(() => ({
  ...DEFAULT_CONFIG, numQuestions: scanCfg.numQuestions, numOptions: scanCfg.numOptions,
  optionLabels: scanCfg.optionLabels.slice(0, scanCfg.numOptions), numColumns: scanCfg.numColumns,
  openQuestions: scanCfg.openQuestions, optionOverrides: scanCfg.optionOverrides, multiSelectQuestions: scanCfg.multiSelectQuestions,
 }), [scanCfg]);
 // Marcas de temporización requeridas = filas por columna (no el nº de preguntas).
 const marksRequired = useMemo(() => questionLayout(config).rowsPerCol, [config]);
 // Cambiar la config del lector desde el teléfono (debe coincidir con la hoja).
 const updateCfg = (patch: Partial<typeof scanCfg>) => {
  const next = { ...scanCfg, ...patch };
  next.optionLabels = Array.from(new Set(`${next.optionLabels || ""}ABCDE`.split(""))).join("").slice(0, next.numOptions);
  setScanCfg(next);
  try { localStorage.setItem("tulector_scan_config", JSON.stringify(next)); } catch { /* sin storage */ }
 };

  /** URL del reverso de un paper ya guardado. Los parametros deben calzar con
   *  la hoja IMPRESA: `obpp` es la regla de reparto del ensayo (no la constante
   *  vigente), ver LEGACY_OPEN_BOXES_PER_PAGE en sheet_generator.ts. */
  const reversoHref = (paperId: string) => {
   const params = new URLSearchParams({
    paper: paperId,
    open: scanCfg.openQuestions.join(","),
    nq: String(scanCfg.numQuestions),
    obpp: String(scanCfg.openBoxesPerPage),
   });
   return `/scan/reverso?${params.toString()}`;
  };

  const syncResult = async ({ rut, answers, photo, warp, source, dvOk, code, nameImg }: { rut: string; answers: BubbleResult[]; photo?: string | null; warp?: string | null; source: "camera" | "upload"; dvOk?: boolean; code?: unknown; nameImg?: string | null }) => {
   // El acceso al reverso siempre apunta a la hoja RECIEN guardada: si esta no
   // llega a guardarse (offline, revision manual, error), el boton no debe
   // quedar apuntando al alumno anterior. Idem el aviso de curso.
   setLastPaperId(null);
   setCourseNote(null);
   // Sin red: se encola de una y NO se intenta el POST. Antes esto caia al
   // early-return de abajo cuando el arranque habia sido offline (activeQuizId
   // quedaba null porque la carga del ensayo fallaba) y la lectura se PERDIA.
   // Con el ensayo cacheado, activeQuizId si esta y la lectura se conserva.
   if (activeQuizId && typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueScan({
     quizId: activeQuizId,
     rut,
     answers: answers.map((r) => ({ q: r.question, a: r.answer, s: r.scores })),
     source,
     dvOk,
     code,
    });
    setQueuedCount(await getQueueSize());
    setSyncState("queued");
    setSyncMessage("Sin conexion. Guardado localmente. Se sincronizara al recuperar red.");
    return;
   }
   if (!activeQuizId) {
    setSyncState("error");
    setSyncMessage("Sin ensayo activo. Conectate una vez para descargarlo y poder corregir sin red.");
    return;
   }
   setSyncState("saving");
   setSyncMessage("Sincronizando con dashboard...");
   try {
    const response = await fetch("/api/scan/result", {
     method: "POST",
     credentials: "include",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
      quizId: activeQuizId,
      rut,
      answers: answers.map((r) => ({ q: r.question, a: r.answer, s: r.scores })),
      photo,
      warp,
      source,
      dvOk,
      code,
      nameImg,
     }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "No se pudo guardar");
    // Se setea ANTES de los early-return de abajo: la ruta devuelve studentName
    // también en manual_review/multipágina, y el HUD lo quiere mostrar igual.
    setStudentName(payload.studentName ?? null);
    // Curso cruzado: el alumno pertenece a otro curso que el ensayo. Aviso, no
    // error -- la nota queda guardada y categorizada por el curso del alumno.
    const cm = payload.courseMismatch as { studentCourse?: string | null; quizCourse?: string | null } | undefined;
    setCourseNote(cm ? `${cm.studentCourse ?? "otro curso"} · ensayo de ${cm.quizCourse ?? "otro curso"}` : null);
    const scoreLabel = `${payload.score ?? "-"}/${payload.total ?? config.numQuestions}`;
    const quotaNote = payload.quota?.warning ? ` ⚠ ${payload.quota.warning}` : "";
    const multipage = payload.multipage as { complete: boolean; page?: number; pagesTotal?: number; missingPages?: number[]; reason?: string } | undefined;
    // Multipagina (Fase 1): esta pagina no se pudo procesar -- nada se
    // guardo, a revision manual. reason="tabla_pendiente" = degradacion
    // elegante si la migracion de paper_pages aun no se aplico en produccion.
    if (multipage?.reason) {
     setSyncState("review");
     setSyncMessage(
      multipage.reason === "sin_id" ? "No se detecto el ID del alumno en esta hoja -> no se pudo ubicar la pagina del ensayo."
      : multipage.reason === "sin_codigo_hoja" ? "No se pudo leer el codigo de la hoja -> no se pudo ubicar la pagina del ensayo."
      : "El ensayo multipágina aún no está habilitado en el servidor. Avisa al administrador."
     );
     // Sorpresa tardía del servidor: el HUD ya pudo haberse cerrado. No se
     // reabre nada, solo se suma al contador de revisión pendiente.
     setPendingReviewCount((c) => c + 1);
     return;
    }
    // Pagina guardada, esperando el resto del ensayo multipagina.
    if (multipage && !multipage.complete) {
     setSyncState("partial");
     const missing = Array.isArray(multipage.missingPages) && multipage.missingPages.length ? multipage.missingPages.join(", ") : "-";
     setSyncMessage(`Página ${multipage.page} de ${multipage.pagesTotal} guardada. Faltan páginas: ${missing}.${quotaNote}`);
     return;
    }
    const multipageNote = multipage?.complete ? ` (ensayo completo, ${multipage.pagesTotal} páginas)` : "";
    const sheetMismatch = payload.sheetMismatch;
    if (sheetMismatch && typeof sheetMismatch.read === "number" && typeof sheetMismatch.expected === "number") {
     setSyncState("review");
     setSyncMessage(`Hoja de otro ensayo (codigo ${sheetMismatch.read}, esperado ${sheetMismatch.expected}) -> guardado para revision (${scoreLabel}).${quotaNote}`);
     setPendingReviewCount((c) => c + 1);
     return;
    }
    if (payload.status === "manual_review") {
     setSyncState("review");
     setSyncMessage(`Guardado para revision (${scoreLabel})${multipageNote}. ${payload.studentCode ? "Alumno sin identificar." : "RUT no detectado."}${quotaNote}`);
     setPendingReviewCount((c) => c + 1);
    } else {
     setSyncState("saved");
     setSyncMessage(`Sincronizado en dashboard (${scoreLabel})${multipageNote}.${quotaNote}`);
     // Fase 1 de correccion IA (docs/plan-correccion-ia-abiertas.md): con
     // preguntas de desarrollo, el reverso de ESTE alumno se puede escanear sin
     // ambiguedad de identidad (el paper_id ya es conocido -- "pairing por
     // flujo de escaneo"). Se guarda el id para el boton "Reverso" del HUD.
     //
     // El salto AUTOMATICO quedo detras de la preferencia `autoReverso`, apagada
     // por defecto: sacaba de la camara entre hoja y hoja (rompe la rafaga) y
     // hoy la deteccion del reverso no es confiable. Escanear corrido el frente
     // de todo el curso es el flujo que se usa en terreno.
     if (payload.paperId && scanCfg.openQuestions.length > 0) {
      setLastPaperId(String(payload.paperId));
      if (sensoryPrefs.autoReverso) {
       router.push(reversoHref(String(payload.paperId)));
       return;
      }
     }
    }
   } catch (err) {
    // Si el error es de red (no conectado), encolar para sincronizar después
    if (!navigator.onLine || (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("network")))) {
     await enqueueScan({
      quizId: activeQuizId,
      rut,
      answers: answers.map((r) => ({ q: r.question, a: r.answer, s: r.scores })),
      source,
      dvOk,
      code,
     });
     setQueuedCount(await getQueueSize());
     setSyncState("queued");
     setSyncMessage("Sin conexion. Guardado localmente. Se sincronizara al recuperar red.");
    } else {
     setSyncState("error");
     setSyncMessage(err instanceof Error ? err.message : "No se pudo sincronizar con dashboard.");
    }
   }
  };

 // Iniciar camara
 useEffect(() => {
  let cancelled = false;
  (async () => {
   try {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    // 1080p: balance fluidez/nitidez. (Probamos 4K y solo metio lag: el problema
    // del RUT por camara NO es resolucion sino el angulo → el warp se desajusta
    // arriba. La solucion real es registro local del bloque RUT, no mas pixeles.)
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
   const warped = warpSheet(srcImageData, corners, config);
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
   const rutR = readRut(warped, config, idReadCfg);
   const codeR = readSheetCode(warped);
   const warn = checkSheetCode(codeR);
   setSheetWarn(warn);
   const idRows = rutR.rut ? [rutR.rut] : [];
   const scores = (report.results ?? []).map(r => ({ q: r.question, a: r.answer, s: r.scores }));
   const nameCrop = cropNameBox(warped);
   const nameImg = nameCrop ? imageDataToThumb(nameCrop, 480, 0.7) : null;

   const save = (type: "scan" | "scan_fail", code: number | undefined, valid: boolean) =>
    saveScanLog({
     v: SCAN_LOG_VERSION, type, source, sheet: "v2", ts: new Date().toISOString(),
     frame: { w: canvas.width, h: canvas.height },
     diag: { ...report.diag, rut: rutR.diag, code: codeR } as unknown as Record<string, unknown>,
     corners, result: { valid, code, reason: report.reason },
     answers: scores, id: idRows, rut: rutR.rut, dvOk: rutR.dvOk, photo: photoThumb, warp: warpThumb, nameImg,
    });

   if (report.diag) addLog(`Registro: ${report.diag.usedTiming ? `temporizacion (${report.diag.timingRows} marcas)` : "offset software"}, dx=${report.diag.gridDx}`);
   if (rutR.diag) addLog(`RUT: offset dx=${rutR.diag.dx} dy=${rutR.diag.dy} → ${rutR.rut || "—"} DV=${rutR.dvOk ? "OK" : rutR.dvComputed ? "calc" : "—"}`);
   addLog(`Código hoja: ${codeR ? `id=${codeR.sheetId} v${codeR.version} p${codeR.page}/${codeR.pagesTotal}` : "no detectado"}`);

   if (!report.valid) {
    addLog(`ERR[${SCAN_CODES.WRONG_FORMAT}]: ${report.reason}`);
    setDebugLog(logs);
    if (!sensoryPrefs.burstMode) setShowDebug(true); // panel de debug solo estorba en modo rafaga
    await save("scan_fail", SCAN_CODES.WRONG_FORMAT, false);
    // Mostrar la razon REAL (ancla, timing, curva, warp) en vez del generico.
    enterResult("error", report.reason || SCAN_MESSAGES[SCAN_CODES.WRONG_FORMAT] || "Error", corners);
    return;
   }

   const bubbleResults = report.results;

   const answeredCount = bubbleResults.filter(r => r.answer !== "-" && r.answer !== "?").length;
   if (answeredCount === 0) {
    addLog(`ERR[${SCAN_CODES.OUT_OF_FOCUS}]: Sin respuestas`);
    setDebugLog(logs);
    await save("scan_fail", SCAN_CODES.OUT_OF_FOCUS, false);
    enterResult("error", SCAN_MESSAGES[SCAN_CODES.OUT_OF_FOCUS], corners);
    return;
   }

   const answerSet = new Set(bubbleResults.filter(r => r.answer !== "-" && r.answer !== "?").map(r => r.answer));
   if (answerSet.size === 1 && answeredCount > 3) {
    const singleAns = [...answerSet][0];
    addLog(`WARN[${SCAN_CODES.CURVE_FAIL}]: ${answeredCount} respuestas "${singleAns}"`);
    setDebugLog(logs);
    await save("scan_fail", SCAN_CODES.CURVE_FAIL, false);
    enterResult("error", SCAN_MESSAGES[SCAN_CODES.CURVE_FAIL], corners);
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

   const saved = await save("scan", SCAN_CODES.GRADED, true);
   addLog(saved ? "Diagnostico guardado OK" : "No se pudo guardar diagnostico (ver consola)");
   setDebugLog([...logs]);
   void syncResult({ rut: rutR.rut, answers: bubbleResults, photo: photoThumb, warp: warpThumb, source, dvOk: rutR.dvOk, code: codeR, nameImg });

   const isHappy = idRows[0]?.length === expectedRutLength && rutR.dvOk === true && warn === null;
   enterResult(isHappy ? "success" : "warning", warn, corners);
  } catch {
   enterResult("error", "Error al procesar. Intenta de nuevo.", corners);
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
  setVoteProgress(0);

  const ctx = canvas.getContext("2d")!;
  const sessions: { answers: string[]; rut: string; dvOk: boolean; scores: number[][]; features: (number[][] | undefined)[]; rutDiag: ReturnType<typeof readRut>["diag"] }[] = [];
  // Lectura de cada frame valido: respuestas + RUT (para diagnostico Y para la
  // salida temprana de abajo -- ver nota). Formato: "A,B,C...|<rut>".
  const frameReads: string[] = [];
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
   const warped = warpSheet(frame, corners, config);
   const report = gradeBubbles(warped, config, corners);
   if (!report.valid || report.diag?.timingRows !== marksRequired) { rejInvalid++; await sleep(40); continue; }
   const rutR = readRut(warped, config, idReadCfg);
   const reads = report.results.map((r) => r.answer);
   sessions.push({ answers: reads, rut: rutR.rut, dvOk: rutR.dvOk, scores: report.results.map((r) => r.scores), features: report.results.map((r) => r.features), rutDiag: rutR.diag });
   // Incluye el RUT en la clave: dos frames con las mismas respuestas pero RUT
   // distinto (digito ambiguo) YA NO cortan el loop -- antes desempataba al azar.
   frameReads.push(`${reads.join(",")}|${rutR.rut}`);
   setVoteProgress(sessions.length);
   lastFrame = frame; lastCorners = corners; lastWarp = warped;
   lastTiming = report.diag?.timingRows ?? null;
   // Salida temprana: 2 frames validos identicos (respuestas Y rut) = suficiente.
   if (sessions.length >= 2 && frameReads[frameReads.length - 1] === frameReads[frameReads.length - 2]) break;
   // 16ms (~1 frame a 60fps) en vez de 40ms: el sleep largo era tiempo muerto,
   // pero CERO sleep arriesga leer el MISMO frame de video dos veces seguidas
   // (drawImage no avanza solo porque el JS itera) y falsear el consenso.
   await sleep(16);
  }

  const rejected = rejFocus + rejCorners + rejInvalid;
  setCapturing(false);

  if (sessions.length === 0 || !lastFrame || !lastCorners || !lastWarp) {
   enterResult("error", "No se logró un frame estable. Acerca, enfoca y mantén firme.", lastCorners);
   return;
  }

  // Votar por pregunta y el RUT
  const votedAnswers = Array.from({ length: config.numQuestions }, (_, q) =>
   voteField(sessions.map((s) => s.answers[q] ?? "-"))
  );
  const votedRut = voteField(sessions.map((s) => s.rut));
  const repRutSession = sessions.find((s) => s.rut === votedRut) ?? sessions[sessions.length - 1];
  const votedDvOk = repRutSession.dvOk;
  const repScores = sessions[sessions.length - 1].scores;
  const repFeatures = sessions[sessions.length - 1].features;
  const bubbleResults: BubbleResult[] = votedAnswers.map((a, i) => ({
   question: i + 1, answer: a, scores: repScores[i] ?? [], correct: null, features: repFeatures[i],
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

  // Codigo de hoja / aviso de "otro ensayo" ANTES de decidir la fase (no
  // despues): el gate feliz/no-feliz necesita el warning para elegir HUD.
  const codeR = readSheetCode(lastWarp);
  const warn = checkSheetCode(codeR);
  setSheetWarn(warn);
  // Recorte del nombre (identidad sin RUT): se guarda para identificar al alumno.
  const nameCropV = cropNameBox(lastWarp);
  const nameImgV = nameCropV ? imageDataToThumb(nameCropV, 480, 0.7) : null;

  await saveScanLog({
   v: SCAN_LOG_VERSION, type: "scan", source: "camera", sheet: "v2", ts: new Date().toISOString(),
   frame: { w: lastFrame.width, h: lastFrame.height },
   diag: {
    voted: true, frames: sessions.length, rejected,
    rejFocus, rejCorners, rejInvalid, timingRows: lastTiming,
    reads: frameReads, rut: repRutSession.rutDiag, code: codeR,
   },
   corners: lastCorners,
   result: { valid: true, code: SCAN_CODES.GRADED },
   answers: bubbleResults.map((r) => ({ q: r.question, a: r.answer, s: r.scores })),
   id: votedRut ? [votedRut] : [], rut: votedRut, dvOk: votedDvOk, photo: photoThumb, warp: warpThumb, nameImg: nameImgV,
  });
  void syncResult({ rut: votedRut, answers: bubbleResults, photo: photoThumb, warp: warpThumb, source: "camera", dvOk: votedDvOk, code: codeR, nameImg: nameImgV });

  const isHappy = votedRut.length === expectedRutLength && votedDvOk === true && warn === null;
  enterResult(isHappy ? "success" : "warning", warn, lastCorners);
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

 // ─── FOTO (upload o cámara nativa): mismo motor de alta resolución ───
 // Procesa una imagen (objectURL o dataURL) con el pipeline que YA lee el RUT
 // perfecto. La cámara nativa (APK) entrega aquí su foto de alta resolución.
 const processImageSrc = async (src: string) => {
  setCapturing(true);
  setShowDebug(true);
  setError("");
  try {
   const img = new Image();
   await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("img")); img.src = src; });

   const canvas = hiddenCanvas.current ?? document.createElement("canvas");
   canvas.width = img.naturalWidth;
   canvas.height = img.naturalHeight;
   const ctx = canvas.getContext("2d")!;
   ctx.drawImage(img, 0, 0);
   const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

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
  }
 };

 // Subir foto desde galería/archivos (web y app).
 const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  try { await processImageSrc(url); } finally { URL.revokeObjectURL(url); e.target.value = ""; }
 };

 // Cámara NATIVA (APK): foto de alta resolución → mismo pipeline.
  const onNativeCapture = async () => {
   const dataUrl = await captureNativePhoto();
   if (dataUrl) await processImageSrc(dataUrl);
  };

  const handleTorchToggle = async () => {
   const next = await toggleTorch(stream, torchOn);
   setTorchOn(next);
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

 // Reset completo hacia la próxima hoja. Lo usan tanto el botón "Siguiente" del
 // modal clásico (ráfaga apagada) como el auto-avance de "clearing" (ráfaga on).
 // Declarado ANTES del loop RAF (lo llama desde dentro) para que el linter/
 // compilador de React lo trate como una dependencia estable, no un forward-ref.
 const resetForNextScan = () => {
  setPhase("detecting");
  setLastScan(Date.now());
  setLastDiag(null);
  setDebugLog([]);
  setWarpedThumb(null);
  setLabeled(false);
  setSyncState("idle");
  setSyncMessage("");
  setStudentName(null);
  setHudMessage(null);
  setSheetWarn(null);
  setVoteProgress(0);
  stableFrames.current = 0;
  lastCornersRef.current = null;
  capturedCornersRef.current = null;
 };
 const nextScan = resetForNextScan; // alias: botón "Siguiente" del modal clásico

 // Live detection loop (overlay + disparo automático + "clearing" tras el HUD).
 // Deps solo [stream, config]: phase/lastScan se leen de refs (phaseRef/
 // lastScanRef) para que el loop NO se remonte en cada transición de fase --
 // con 5 fases en modo ráfaga, remontar en cada una arriesgaba perder frames.
 useEffect(() => {
  if (!stream) return;
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

   // Modal clásico bloqueante (ráfaga apagada): tapa toda la pantalla, no hay
   // nada que dibujar ni detectar debajo -- mismo ahorro que el "result" original.
   if (phaseRef.current === "review") { animId = requestAnimationFrame(loop); return; }

   // Detección en canvas reducido (~4x menos píxeles): el warp/calificación real
   // (runVotingScan/processScan) sigue leyendo el video a resolución completa
   // por su cuenta -- esto solo acelera el preview en vivo.
   const dCanvas = detectCanvasRef.current ?? (detectCanvasRef.current = document.createElement("canvas"));
   const dw = Math.max(1, Math.round(overlay.width * DETECT_SCALE));
   const dh = Math.max(1, Math.round(overlay.height * DETECT_SCALE));
   dCanvas.width = dw; dCanvas.height = dh;
   const dctx = dCanvas.getContext("2d")!;
   dctx.drawImage(video, 0, 0, dw, dh);
   const smallFrame = dctx.getImageData(0, 0, dw, dh);

   const smallCorners = findCorners(smallFrame, config);
   const invScale = 1 / DETECT_SCALE;
   const corners: [number, number][] | null = smallCorners
    ? (smallCorners.map(([x, y]) => [x * invScale, y * invScale]) as [number, number][])
    : null;
   // Nitidez solo si ya hay esquinas: evita el Laplaciano en la mayoría de
   // frames (durante el cambio de hoja no hay nada que enfocar todavía).
   const sharpScore = smallCorners ? isFrameSharp(smallFrame) : 0;
   const sharp = sharpScore > 40;
   setSharpDisplay(Math.round(sharpScore));

   octx.clearRect(0, 0, overlay.width, overlay.height);

   // Guía de encuadre (siempre visible, orienta al usuario)
   const guideRatio = SHEET_W / SHEET_H;
   const guideW = overlay.width * 0.82;
   const guideH = guideW / guideRatio;
   const guideX = (overlay.width - guideW) / 2;
   const guideY = (overlay.height - guideH) / 2;
   octx.strokeStyle = "rgba(255,255,255,0.12)";
   octx.lineWidth = 1;
   octx.setLineDash([6, 4]);
   octx.strokeRect(guideX, guideY, guideW, guideH);
   octx.setLineDash([]);
   // Esquinas decorativas del encuadre
   const cl = 24;
   octx.strokeStyle = "rgba(255,255,255,0.2)";
   octx.lineWidth = 2;
   for (const [cx, cy] of [[guideX, guideY], [guideX + guideW, guideY], [guideX + guideW, guideY + guideH], [guideX, guideY + guideH]]) {
    const dx = cx === guideX ? 1 : -1;
    const dy = cy === guideY ? 1 : -1;
    octx.beginPath();
    octx.moveTo(cx, cy + dy * cl);
    octx.lineTo(cx, cy);
    octx.lineTo(cx + dx * cl, cy);
    octx.stroke();
   }

   let quadValid = false;
   if (corners) {
    goodFrameCount.current++;
    badFrameCount.current = 0;
    const [tl, tr, br, bl] = corners;
    const topW = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
    const botW = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
    const ratio = Math.max(topW, botW) / Math.max(Math.min(topW, botW), 1);
    const area = Math.abs((tr[0] - tl[0]) * (br[1] - tl[1]) - (tr[1] - tl[1]) * (br[0] - tl[0]));
    quadValid = ratio < 2.5 && area > 10000;

    // Contorno completo de la hoja (antes: solo 4 puntos sueltos). Amarillo =
    // detectado pero mal alineado/fuera de foco; verde = listo para disparar.
    const color = quadValid && sharp ? "#22c55e" : "#eab308";
    octx.strokeStyle = color;
    octx.lineWidth = 2;
    octx.beginPath();
    octx.moveTo(tl[0], tl[1]);
    octx.lineTo(tr[0], tr[1]);
    octx.lineTo(br[0], br[1]);
    octx.lineTo(bl[0], bl[1]);
    octx.closePath();
    octx.stroke();
    for (const [cx, cy] of corners) {
     octx.fillStyle = color;
     octx.beginPath();
     octx.arc(cx, cy, 5, 0, Math.PI * 2);
     octx.fill();
    }
   } else {
    badFrameCount.current++;
    goodFrameCount.current = 0;
   }

   if (corners && quadValid && sharp) {
    setDetected(true);
    setInFocus(true);
    // Bip de "enganchado" solo en el flanco no-detectado -> detectado, y solo
    // mientras se busca una hoja nueva (evita re-bipear la MISMA hoja que
    // sigue en cuadro durante el HUD/clearing del escaneo anterior).
    if (!wasDetectedRef.current && phaseRef.current === "detecting") fireSensory("lock");
    wasDetectedRef.current = true;

    // Solo contar frames estables si las corners no se movieron >25px respecto al frame anterior
    const prev = lastCornersRef.current;
    const cornersStable = prev !== null && corners.every((c, i) =>
      Math.hypot(c[0] - prev[i][0], c[1] - prev[i][1]) < 25
    );
    lastCornersRef.current = corners;
    if (cornersStable) stableFrames.current++;
    else stableFrames.current = 0;

    const canScan = Date.now() - lastScanRef.current > cooldownMs;
    if (stableFrames.current >= stableFramesNeeded && canScan && phaseRef.current === "detecting") {
     stableFrames.current = 0;
     fireSensory("captureStart");
     setPhase("scanning");
     runVotingScan();
    }
   } else {
    stableFrames.current = 0;
    lastCornersRef.current = null;
    setDetected(false);
    setInFocus(false);
    wasDetectedRef.current = false;
   }

   // "clearing": tras el HUD, exige que la hoja salga de cuadro (o un timeout
   // de seguridad) antes de rearmar el disparo automático -- evita re-escanear
   // la misma hoja dos veces si el profe tarda en levantarla.
   if (phaseRef.current === "clearing") {
    const captured = capturedCornersRef.current;
    const quadArea = (q: [number, number][]) =>
     Math.abs((q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]));
    const capturedArea = captured ? quadArea(captured) : 0;
    const currentArea = corners ? quadArea(corners) : 0;
    const areaChanged = capturedArea > 0 && Math.abs(currentArea - capturedArea) / capturedArea > 0.4;
    const sheetGone = !corners || areaChanged;
    const timedOut = Date.now() - clearingStartRef.current > 6000;
    if (sheetGone || timedOut) resetForNextScan();
   }

   animId = requestAnimationFrame(loop);
  };

  loop();
  return () => cancelAnimationFrame(animId);
  // sensoryPrefs SÍ va en deps (a diferencia de phase/lastScan, que se leen de
  // refs): cambia raras veces -- solo al tocar el drawer de config -- así que
  // remontar el loop ahí es inofensivo, y evita que un toggle de sonido/ráfaga
  // quede "pegado" al valor de cuando se montó la cámara. fireSensory/runVotingScan/
  // cooldownMs quedan fuera a propósito (misma razón que phaseRef/lastScanRef):
  // incluirlas haría que el loop se remonte en cada render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [stream, config, sensoryPrefs]);

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
    <div className="flex items-center gap-1">
     {pendingReviewCount > 0 && (
      <Link
       href="/dashboard/papers"
       className="text-[10px] font-black px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40"
       title="Hojas con avisos del servidor pendientes de revisar (no bloquean el escaneo)"
      >
       {pendingReviewCount} por revisar
      </Link>
     )}
     <button onClick={() => setShowSettings(true)} className="text-[10px] text-zinc-400 font-bold px-2 py-1">
      ⚙️
     </button>
     <button onClick={() => setShowDebug(!showDebug)} className="text-[10px] text-zinc-400 font-bold px-2 py-1">
      {showDebug ? "Ocultar" : "Diagnostico"}
     </button>
    </div>
   </header>

   {/* Config del lector: DEBE coincidir con la hoja impresa (preg / opciones / columnas) */}
   <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-zinc-950/90 border-b border-zinc-900 text-[10px] z-20">
    <span className="text-zinc-500 uppercase tracking-wide">Hoja</span>
    <select value={scanCfg.numQuestions} onChange={(e) => { const n = +e.target.value; updateCfg({ numQuestions: n, numColumns: safeColumns(n, scanCfg.numColumns) }); }} className="bg-zinc-800 rounded px-1.5 py-0.5">
     {[10, 15, 20, 25, 30, 40, 50].map((n) => <option key={n} value={n}>{n} preg</option>)}
    </select>
    <select value={scanCfg.numOptions} onChange={(e) => updateCfg({ numOptions: +e.target.value })} className="bg-zinc-800 rounded px-1.5 py-0.5">
     {[3, 4, 5].map((n) => <option key={n} value={n}>{n} opc</option>)}
    </select>
    <select value={scanCfg.numColumns} onChange={(e) => updateCfg({ numColumns: +e.target.value })} className="bg-zinc-800 rounded px-1.5 py-0.5">
     {allowedColumns(scanCfg.numQuestions).map((n) => <option key={n} value={n}>{n} col</option>)}
    </select>
   </div>

   {/* Visor de Camara */}
   <div className="relative flex-1 bg-black">
    <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
    <canvas ref={overlayRef} className="absolute inset-0 w-full h-full object-cover z-10" />
    <canvas ref={hiddenCanvas} className="hidden" />

    {/* Status overlay */}
    <div className="absolute top-4 left-0 right-0 flex flex-col items-center gap-1.5 z-20 pointer-events-none">
     {/* Estado offline y trabajo sin subir: el profesor tiene que poder verlo
         ANTES de cerrar la app, no descubrirlo despues. */}
     {(!isOnline || queuedCount > 0) && (
      <div className={`px-3 py-1 rounded-full backdrop-blur-lg border flex items-center gap-2 ${isOnline ? "bg-sky-600/20 border-sky-500/50" : "bg-amber-600/20 border-amber-500/50"}`}>
       <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-sky-400" : "bg-amber-400 animate-pulse"}`} />
       <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-100">
        {!isOnline && "Sin conexión"}
        {!isOnline && queuedCount > 0 && " · "}
        {queuedCount > 0 && `${queuedCount} en cola`}
       </span>
      </div>
     )}
     {!hasAnswerKey && (
      <div className="px-3 py-1 rounded-full backdrop-blur-lg border bg-amber-600/20 border-amber-500/50">
       <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Sin pauta — no se calcula puntaje</span>
      </div>
     )}
     {/* Cambiar de ensayo sin salir de la camara: es la unica via cuando no hay
         red, porque la pantalla que los lista es de servidor. */}
     {library.length > 0 && (
      <button
       onClick={() => setShowLibrary((v) => !v)}
       className="pointer-events-auto px-3 py-1 rounded-full backdrop-blur-lg border bg-black/40 border-zinc-700/60 text-[10px] font-bold uppercase tracking-wider text-zinc-200 active:bg-black/60"
      >
       {activeQuizTitle ?? "Elegir ensayo"} · {library.length} descargados ▾
      </button>
     )}
     {showLibrary && (
      <div className="pointer-events-auto max-h-64 w-[88%] max-w-sm overflow-y-auto rounded-2xl border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-lg p-1.5 shadow-2xl">
       {library.map((q) => (
        <button
         key={q.quizId}
         onClick={() => selectCachedQuiz(q)}
         className={`block w-full rounded-xl px-3 py-2 text-left active:bg-zinc-800 ${q.quizId === activeQuizId ? "bg-zinc-800/80" : ""}`}
        >
         <span className="block truncate text-xs font-bold text-zinc-100">{q.title ?? "Ensayo"}</span>
         <span className="text-[10px] font-bold text-zinc-500">
          {q.cfg.numQuestions}p/{q.cfg.numOptions}o
          {q.answerKey.length === 0 && " · sin pauta"}
         </span>
        </button>
       ))}
      </div>
     )}
     <div className={`px-4 py-1.5 rounded-full backdrop-blur-lg border transition-all flex items-center gap-2 ${phase === "scanning" ? "bg-green-600/20 border-green-500/50" : "bg-black/40 border-zinc-800/50"}`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${phase === "scanning" ? "bg-green-400" : detected && inFocus ? "bg-green-500" : "bg-zinc-600"}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-200">
       {phase === "scanning" ? `Procesando${voteProgress > 0 ? ` ${voteProgress}/${VOTE_TARGET}` : "..."}`
        : phase === "clearing" ? "Retira la hoja..."
        : detected && inFocus ? "Detectado" : "Buscando hoja"}
      </span>
      {phase === "scanning" && (
       <span className="flex gap-0.5">
        {Array.from({ length: VOTE_TARGET }, (_, i) => (
         <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < voteProgress ? "bg-green-400" : "bg-zinc-700"}`} />
        ))}
       </span>
      )}
     </div>
     {detected && sharpDisplay > 0 && phase === "detecting" && (
      <div className="px-2 py-0.5 rounded-full bg-black/30 backdrop-blur text-[9px] font-bold text-zinc-400">
       nitidez {sharpDisplay}
      </div>
     )}
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
     {/* Flash / Torch */}
     {stream && (
      <button
       onClick={handleTorchToggle}
       className="absolute left-20 flex flex-col items-center gap-1 text-white/80 hover:text-white transition"
      >
       <span className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-xl ${torchOn ? "border-amber-400/60 bg-amber-500/20 text-amber-300" : "border-white/40 bg-black/40 backdrop-blur text-white/60"}`}>
        {torchOn ? "⚡" : "💡"}
       </span>
       <span className="text-[9px] font-bold uppercase tracking-wider">{torchOn ? "Apagar" : "Flash"}</span>
      </button>
     )}
     {/* Cámara NATIVA (APK): foto de alta resolución (espejo del "Subir foto") */}
     {native && (
      <button
       onClick={onNativeCapture}
       disabled={capturing}
       className="absolute left-8 flex flex-col items-center gap-1 text-white/80 hover:text-white disabled:opacity-40 transition"
      >
       <span className="w-12 h-12 rounded-2xl border border-white/40 bg-black/40 backdrop-blur flex items-center justify-center text-xl">📷</span>
       <span className="text-[9px] font-bold uppercase tracking-wider">Tomar foto</span>
      </button>
     )}
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
          {/* Grilla del RUT (cian): así se ve si el muestreo cae sobre las burbujas */}
          {Array.from({ length: RUT_COLS }, (_, c) =>
           Array.from({ length: c === RUT_COLS - 1 ? RUT_ROWS + 1 : RUT_ROWS }, (_, d) => (
            <circle key={`rut-${c}-${d}`} cx={rutColX(c)} cy={rutRowY(d)} r={RUT_R}
             fill="none" stroke="#06b6d4" strokeWidth="3" opacity="0.85" />
           ))
          )}
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

    {/* Result Modal (clásico, bloqueante) -- solo cuando el modo ráfaga está apagado */}
    {phase === "review" && (
     <div className="absolute inset-0 flex items-center justify-center p-6 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
      <div className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
       {(() => {
        const openCount = results.filter((r) => r.flag === "abierta").length;
        const correct = results.filter((r, i) => r.flag !== "abierta" && r.answer !== "-" && r.answer === answerKey[i]).length;
        const answered = results.filter(r => r.flag !== "abierta" && r.answer !== "-").length;
        return (
         <>
          <div className="flex justify-between items-start mb-4">
           <div>
            {hasAnswerKey ? (
             <h2 className="text-2xl font-black text-white">{correct}<span className="text-zinc-500 text-lg font-bold">/{config.numQuestions - openCount}</span></h2>
            ) : (
             /* Sin pauta cargada NO se inventa un puntaje: se informa la lectura. */
             <h2 className="text-lg font-black text-amber-400">{answered} respuestas leidas</h2>
            )}
            <p className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Escaneo #{scanCount} · {answered} resp · {config.numQuestions}p/{config.numOptions}o/{config.numColumns}c · {BUILD_TAG}</p>
            {!hasAnswerKey && <p className="mt-1 text-[10px] font-bold text-amber-400/90 normal-case tracking-normal">Sin pauta cargada — no se puede calcular el puntaje.</p>}
           </div>
           <div className="flex flex-col items-end gap-1">
            <div className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[10px] font-black border border-green-500/20">
             RUT: {studentId.join("") || "???"}
            </div>
            {studentName && <div className="text-[10px] font-bold text-zinc-300">{studentName}</div>}
            {courseNote && <div className="text-[10px] font-bold text-amber-400">⚠ {courseNote}</div>}
            <button onClick={() => setShowDebug(!showDebug)} className="text-[9px] text-zinc-600 underline font-bold">
             {showDebug ? "Ocultar Log" : "Ver Log"}
            </button>
           </div>
          </div>

          {sheetWarn && (
           <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-300">
            ⚠️ {sheetWarn}
           </div>
          )}

          {syncState !== "idle" && (
           <div className={`mb-4 rounded-2xl border px-3 py-2 text-[10px] font-bold ${syncState === "saved" ? "border-green-500/30 bg-green-500/10 text-green-300" : syncState === "partial" ? "border-blue-500/30 bg-blue-500/10 text-blue-200" : syncState === "review" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : syncState === "queued" ? "border-orange-500/30 bg-orange-500/10 text-orange-200" : syncState === "saving" ? "border-sky-500/30 bg-sky-500/10 text-sky-200" : "border-red-500/30 bg-red-500/10 text-red-200"}`}>
            {syncMessage}
           </div>
          )}
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
            const isOpen = r.flag === "abierta";
            const isCorrect = !isOpen && r.answer !== "-" && r.answer === expected;
            const isWrong = !isOpen && r.answer !== "-" && r.answer !== expected;
            return (
             <div key={r.question} className={`rounded-lg flex flex-col items-center justify-center py-1 text-[9px] font-bold gap-0.5
              ${isOpen ? "bg-sky-500/10 text-sky-300 border border-sky-500/30"
              : isCorrect ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : isWrong ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-zinc-800 text-zinc-600"}`}
              title={isOpen ? `Pregunta ${r.question}: desarrollo (se corrige a mano)` : undefined}>
              <span className="text-[10px]">{isOpen ? "✎" : r.answer !== "-" ? r.answer : "–"}</span>
              <span className="text-[8px] opacity-60">{isWrong ? expected : ""}</span>
             </div>
            );
           })}
          </div>
          <div className="flex gap-1 mb-6">
           <div className="flex items-center gap-1 text-[8px] text-green-500"><span className="w-2 h-2 rounded-sm bg-green-500/30 border border-green-500/40 inline-block"/>{results.filter((r,i)=>r.flag!=="abierta"&&r.answer!=="-"&&r.answer===answerKey[i]).length} correctas</div>
           <div className="flex items-center gap-1 text-[8px] text-red-400 ml-2"><span className="w-2 h-2 rounded-sm bg-red-500/30 border border-red-500/40 inline-block"/>{results.filter((r,i)=>r.flag!=="abierta"&&r.answer!=="-"&&r.answer!==answerKey[i]).length} incorrectas</div>
           {openCount > 0 && <div className="flex items-center gap-1 text-[8px] text-sky-300 ml-2"><span className="w-2 h-2 rounded-sm bg-sky-500/20 border border-sky-500/40 inline-block"/>{openCount} desarrollo</div>}
          </div>
         </>
        );
       })()}

       <button
        onClick={confirmRead}
        disabled={labeled}
        className={`w-full py-3 mb-2 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition ${labeled ? "bg-green-600/30 text-green-400 border border-green-500/40" : "bg-green-600 text-white"}`}
       >
        {labeled ? "✓ Lectura confirmada" : "✓ Confirmar lectura (correcta)"}
       </button>
       {/* Reverso: acceso MANUAL (el salto automático está tras la preferencia
           autoReverso, apagada por defecto — ver syncResult). */}
       {lastPaperId && scanCfg.openQuestions.length > 0 && (
        <Link
         href={reversoHref(lastPaperId)}
         className="block w-full py-3 mb-2 rounded-2xl bg-sky-600/20 text-sky-300 border border-sky-500/40 text-center font-black text-xs uppercase tracking-widest active:scale-95 transition"
        >
         ✎ Escanear reverso de este alumno
        </Link>
       )}
       <button onClick={nextScan} className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition">
        Siguiente
       </button>
      </div>
     </div>
    )}

    {/* HUD no bloqueante (modo ráfaga): reemplaza el modal para TODO caso --
        feliz o no -- y se cierra solo ("clearing" espera a que la hoja salga
        de cuadro). Deja la cámara visible para re-encuadrar la próxima hoja. */}
    {(phase === "hud" || phase === "clearing") && (() => {
     const openCount = results.filter((r) => r.flag === "abierta").length;
     const correct = results.filter((r, i) => r.flag !== "abierta" && r.answer !== "-" && r.answer === answerKey[i]).length;
     const tone = hudKind === "success" ? "border-green-500/50 bg-green-950/70 text-green-100"
      : hudKind === "warning" ? "border-amber-500/50 bg-amber-950/70 text-amber-100"
      : "border-red-500/50 bg-red-950/70 text-red-100";
     return (
      <div className="absolute bottom-28 left-4 right-4 z-30 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150">
       <div className={`rounded-2xl border backdrop-blur-md px-4 py-3 shadow-2xl ${tone}`}>
        <div className="flex items-center justify-between gap-3">
         <div className="min-w-0">
          {hudKind !== "error" && hasAnswerKey ? (
           <div className="text-lg font-black leading-tight">
            {correct}<span className="opacity-60 text-sm font-bold">/{config.numQuestions - openCount}</span>
           </div>
          ) : hudKind !== "error" ? (
           <div className="text-sm font-black leading-tight">Leída · sin pauta</div>
          ) : (
           <div className="text-xs font-black uppercase tracking-wide">Hoja no leída</div>
          )}
          <div className="text-[10px] font-bold truncate opacity-90">
           {hudKind !== "error" ? `RUT ${studentId.join("") || "???"}${studentName ? ` · ${studentName}` : ""}` : hudMessage}
          </div>
          {hudKind === "warning" && hudMessage && <div className="text-[9px] opacity-80 mt-0.5">{hudMessage}</div>}
          {hudKind !== "error" && courseNote && (
           <div className="mt-0.5 text-[9px] font-bold text-amber-300">⚠ {courseNote}</div>
          )}
          {hudKind !== "error" && syncState === "queued" && (
           <div className="text-[9px] opacity-80 mt-0.5">Sin conexión — {studentName ? "guardado" : "nombre disponible"} al sincronizar</div>
          )}
          {hudKind !== "error" && syncState === "error" && (
           <div className="text-[9px] opacity-80 mt-0.5">⚠ No se pudo sincronizar con el dashboard</div>
          )}
         </div>
         <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="text-[9px] font-bold uppercase tracking-widest opacity-70">
           {phase === "clearing" ? "Retira la hoja" : "Escaneo " + scanCount}
          </div>
          {/* El HUD entero es pointer-events-none (no debe bloquear el re-encuadre):
              este enlace reactiva los eventos solo en su propia caja. */}
          {hudKind !== "error" && lastPaperId && scanCfg.openQuestions.length > 0 && (
           <Link
            href={reversoHref(lastPaperId)}
            className="pointer-events-auto rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest opacity-90"
           >
            Reverso →
           </Link>
          )}
         </div>
        </div>
       </div>
      </div>
     );
    })()}

    {/* ─── Drawer de configuración: sonido / vibración / modo ráfaga ─── */}
    {showSettings && (
     <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end" onClick={() => setShowSettings(false)}>
      <div
       className="w-full bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200"
       onClick={(e) => e.stopPropagation()}
      >
       <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-black">Escaneo</span>
        <button onClick={() => setShowSettings(false)} className="text-xs text-zinc-500 font-bold">CERRAR</button>
       </div>
       {([
        { key: "burstMode" as const, label: "Modo ráfaga", hint: "Auto-avanza sin tocar la pantalla entre hojas" },
        { key: "autoReverso" as const, label: "Ir al reverso automáticamente", hint: "Apagado: escaneas los frentes de corrido y el reverso cuando quieras" },
        { key: "sound" as const, label: "Sonido", hint: "Tono al detectar, capturar y al terminar" },
        { key: "vibration" as const, label: "Vibración", hint: "No disponible en iOS (limitación del sistema)" },
       ]).map(({ key, label, hint }) => (
        <div key={key} className="flex items-center justify-between py-2.5 border-b border-zinc-800/60 last:border-0">
         <div>
          <div className="text-xs font-bold text-zinc-200">{label}</div>
          <div className="text-[9px] text-zinc-500">{hint}</div>
         </div>
         <button
          onClick={() => {
           const next = { ...sensoryPrefs, [key]: !sensoryPrefs[key] };
           setSensoryPrefs(next);
           saveSensoryPrefs(next);
          }}
          className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${sensoryPrefs[key] ? "bg-green-600" : "bg-zinc-700"}`}
         >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${sensoryPrefs[key] ? "translate-x-[22px]" : "translate-x-0.5"}`} />
         </button>
        </div>
       ))}
       {lastPaperId && scanCfg.openQuestions.length > 0 && (
        <Link href={reversoHref(lastPaperId)} className="mt-4 block rounded-2xl border border-sky-500/40 bg-sky-600/15 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-sky-300">
         ✎ Reverso del último alumno
        </Link>
       )}
       <Link href="/dashboard/papers" className="block text-center text-[10px] text-zinc-500 underline mt-4">
        Ver cola de revisión
       </Link>
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


