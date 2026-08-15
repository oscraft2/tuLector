"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import * as C from "@/tulector/compact_layout";
import { detectCompactBlock } from "@/tulector/compact_block";
import {
  readCompactFrame, checkAgainstKey, tallyChecked, sameCompactGrid, describeCompactCfg,
  type CheckedAnswer,
} from "@/lib/compact_scan";
import {
  saveKey, deleteKey, newKeyId, writeActiveKeyId,
  subscribeKeys, keysSnapshot, emptyKeysSnapshot, activeKeyIdSnapshot, nullSnapshot,
  lettersFor, parseKeyString, missingAnswers, type OmrKey,
} from "@/lib/omr_keys";
import { CompactResultView } from "@/components/CompactResultView";

/**
 * CORRECCION RAPIDA (OMR pura, sin alumnos).
 *
 * El caso que resuelve: el profesor pega un bloque compacto en su propia prueba,
 * la fotocopia y quiere corregir el curso completo con el telefono, sin crear el
 * ensayo en TuLector y sin identificar a nadie. Dos pasos, en ese orden:
 *
 *   1. PAUTA — se ingresa una sola vez (escaneando una hoja marcada con las
 *      respuestas correctas, o escribiendola) y queda guardada EN EL DISPOSITIVO.
 *   2. ESCANEO EN SERIE — hoja tras hoja, resultado grande con buenas y malas y
 *      un boton permanente para pasar a la siguiente.
 *
 * Nada se guarda en el servidor: sin alumno no hay nota que registrar, y llenar
 * el panel de papers "Sin RUT" (consumiendo cuota de escaneo) por corregir en el
 * pasillo seria peor que no guardar. Para notas guardadas esta /scan/compacto.
 *
 * Pagina aparte de /scan y /scan/compacto por la misma razon que aquellas son
 * dos: cada una es un flujo completo distinto, y mezclarlas obligaria a tocar
 * lectores que ya estan en produccion.
 */

type Step = "pauta" | "editor" | "scan";
type EditorSource = "manual" | "scan";

const DETECT_EVERY_MS = 600;
const HUD_WIDTH = 640;

/** Config de respaldo para leer la hoja-pauta si su codigo no fuera legible. */
function fallbackCfg(): C.CompactConfig {
  try {
    const raw = localStorage.getItem("tulector_compact_config");
    if (raw) {
      const c = JSON.parse(raw) as Partial<C.CompactConfig>;
      return {
        numQuestions: Math.min(C.COMPACT_MAX_QUESTIONS, Math.max(1, Number(c.numQuestions) || 20)),
        numOptions: Math.min(5, Math.max(2, Number(c.numOptions) || 5)),
        ...(c.numColumns ? { numColumns: Number(c.numColumns) } : {}),
      };
    }
  } catch { /* sin storage */ }
  return C.DEFAULT_COMPACT;
}

// ─── Camara reutilizable ───────────────────────────────────────

function CameraPanel({
  label, busy, onFrame, onCancel,
}: {
  label: string;
  busy: boolean;
  onFrame: (frame: ImageData) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hudRef = useRef<HTMLCanvasElement | null>(null);
  const [detected, setDetected] = useState(false);
  const [camError, setCamError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { ms.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = ms;
        if (videoRef.current) { videoRef.current.srcObject = ms; await videoRef.current.play(); }
      } catch {
        if (!cancelled) setCamError("Permite el acceso a la cámara, o sube una foto del bloque.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Latido de deteccion SOLO para el HUD: cuadro reducido y cada DETECT_EVERY_MS.
  // La lectura de verdad usa el cuadro completo al capturar.
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const video = videoRef.current;
      if (video && video.videoWidth > 0 && !busy) {
        const scale = HUD_WIDTH / video.videoWidth;
        const canvas = hudRef.current ?? (hudRef.current = document.createElement("canvas"));
        canvas.width = HUD_WIDTH;
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            setDetected(!!detectCompactBlock(ctx.getImageData(0, 0, canvas.width, canvas.height)));
          } catch { setDetected(false); }
        }
      }
      setTimeout(tick, DETECT_EVERY_MS);
    };
    const id = setTimeout(tick, DETECT_EVERY_MS);
    return () => { alive = false; clearTimeout(id); };
  }, [busy]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || busy) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (!canvas.width) { setCamError("La cámara todavía no entrega imagen."); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    await onFrame(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        await onFrame(ctx.getImageData(0, 0, canvas.width, canvas.height));
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { setCamError("No se pudo abrir esa imagen."); URL.revokeObjectURL(url); };
    img.src = url;
  };

  return (
    <>
      <div className="relative flex-1 min-h-[40vh]">
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        <div className={`absolute inset-x-6 top-6 rounded-lg px-3 py-2 text-center text-sm font-semibold ${detected ? "bg-emerald-600/85" : "bg-black/60 text-zinc-300"}`}>
          {detected ? "Bloque detectado — captura ahora" : label}
        </div>
      </div>
      <div className="shrink-0 bg-zinc-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        {camError && <p className="text-sm text-red-400">{camError}</p>}
        <button onClick={capture} disabled={busy}
          className="w-full rounded-xl bg-white text-black text-lg font-bold py-4 disabled:opacity-50">
          {busy ? "Procesando…" : "Capturar"}
        </button>
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <label className="underline cursor-pointer">
            o sube una foto
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {onCancel && <button onClick={onCancel} className="underline">Cancelar</button>}
        </div>
      </div>
    </>
  );
}

// ─── Pagina ────────────────────────────────────────────────────

export default function ScanRapidoPage() {
  const [step, setStep] = useState<Step>("pauta");
  // Las pautas viven en localStorage: se leen como sistema externo, no se copian
  // a estado en un efecto de montaje (esta pagina se prerenderiza).
  const keys = useSyncExternalStore(subscribeKeys, keysSnapshot, emptyKeysSnapshot);
  const lastActiveId = useSyncExternalStore(subscribeKeys, activeKeyIdSnapshot, nullSnapshot);
  const [active, setActive] = useState<OmrKey | null>(null);
  // La pauta usada la ultima vez: se ofrece para continuar, pero la primera
  // pantalla sigue siendo la de la pauta — es el orden que pidio el flujo.
  const lastUsed = lastActiveId ? keys.find((k) => k.id === lastActiveId) ?? null : null;

  // Editor de pauta
  const [editorSource, setEditorSource] = useState<EditorSource>("manual");
  const [draftName, setDraftName] = useState("");
  const [draftCfg, setDraftCfg] = useState<C.CompactConfig>(C.DEFAULT_COMPACT);
  const [draftKey, setDraftKey] = useState<string[]>([]);
  const [draftNote, setDraftNote] = useState("");
  const [capturingKey, setCapturingKey] = useState(false);

  // Escaneo en serie
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sheetCount, setSheetCount] = useState(0);
  const [outcome, setOutcome] = useState<{ checked: CheckedAnswer[]; correct: number; total: number; warnings: string[] } | null>(null);

  const startManual = () => {
    setEditorSource("manual");
    setDraftName("");
    setDraftCfg(C.DEFAULT_COMPACT);
    const ql = C.compactQuestionLayout(C.DEFAULT_COMPACT);
    setDraftKey(Array.from({ length: ql.numQuestions }, () => ""));
    setDraftNote("");
    setStep("editor");
  };

  const startScanKey = () => {
    setEditorSource("scan");
    setDraftName("");
    setDraftKey([]);
    setDraftNote("");
    setCapturingKey(true);
    setStep("editor");
  };

  /** Lee la hoja-pauta: la grilla sale del codigo impreso, no hay que preguntarla. */
  const captureKeySheet = async (frame: ImageData) => {
    setBusy(true);
    setError("");
    try {
      const res = readCompactFrame(frame, fallbackCfg());
      if (!res.ok) { setError(res.reason); return; }
      const key = res.results.map((r) => (r.answer.length === 1 && r.answer !== "-" && r.answer !== "?" ? r.answer : ""));
      const faltan = missingAnswers(key);
      setDraftCfg(res.cfg);
      setDraftKey(key);
      setDraftNote(
        [
          res.selfDescribed
            ? `Formato leído del propio bloque: ${describeCompactCfg(res.cfg)}.`
            : `⚠ El bloque no declara su formato (versión antigua): se asumió ${describeCompactCfg(res.cfg)}. Revisa que calce con lo impreso.`,
          faltan.length > 0
            ? `Faltan ${faltan.length} respuesta${faltan.length > 1 ? "s" : ""} (${faltan.join(", ")}): complétalas antes de guardar.`
            : "Todas las respuestas se leyeron. Revísalas y guarda.",
        ].join(" "),
      );
      setCapturingKey(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer la hoja-pauta.");
    } finally {
      setBusy(false);
    }
  };

  /** Cambia la letra de una pregunta: A → B → … → (vacía) → A. */
  const cycleAnswer = (index: number) => {
    const letters = lettersFor(draftCfg);
    setDraftKey((prev) => {
      const next = [...prev];
      const current = next[index] ?? "";
      const pos = letters.indexOf(current);
      next[index] = pos < 0 ? letters[0] : (pos + 1 >= letters.length ? "" : letters[pos + 1]);
      return next;
    });
  };

  const applyCfg = (patch: Partial<C.CompactConfig>) => {
    const merged = { ...draftCfg, ...patch };
    const ql = C.compactQuestionLayout(merged);
    setDraftCfg(merged);
    // La clave se re-dimensiona conservando lo ya escrito; una letra que deja de
    // existir al bajar las opciones se limpia (si no, quedaria una pauta que
    // pide marcar una burbuja que el bloque no dibuja).
    const letters = C.OPTION_LABELS.slice(0, ql.numOptions);
    setDraftKey((prev) => Array.from({ length: ql.numQuestions }, (_, i) => {
      const letter = prev[i] ?? "";
      return letters.includes(letter) ? letter : "";
    }));
  };

  const commitKey = () => {
    const faltan = missingAnswers(draftKey);
    if (faltan.length > 0) {
      setError(`La pauta tiene ${faltan.length} pregunta${faltan.length > 1 ? "s" : ""} sin respuesta (${faltan.slice(0, 6).join(", ")}${faltan.length > 6 ? "…" : ""}). Complétala para que las correcciones sean confiables.`);
      return;
    }
    const entry: OmrKey = {
      id: newKeyId(),
      name: draftName.trim() || `Pauta de ${draftKey.length} preguntas`,
      key: draftKey,
      cfg: draftCfg,
      createdAt: new Date().toISOString(),
    };
    saveKey(entry);
    writeActiveKeyId(entry.id);
    setActive(entry);
    setError("");
    setSheetCount(0);
    setOutcome(null);
    setStep("scan");
  };

  const activateKey = (k: OmrKey) => {
    writeActiveKeyId(k.id);
    setActive(k);
    setSheetCount(0);
    setOutcome(null);
    setError("");
    setStep("scan");
  };

  const removeKey = (id: string) => {
    deleteKey(id);
    if (active?.id === id) { setActive(null); setStep("pauta"); }
  };

  /** Corrige una hoja contra la pauta activa. No guarda nada en el servidor. */
  const scanSheet = useCallback(async (frame: ImageData) => {
    if (!active) return;
    setBusy(true);
    setError("");
    try {
      const res = readCompactFrame(frame, active.cfg);
      if (!res.ok) { setError(res.reason); return; }

      // El papel manda: si declara otra grilla que la de la pauta, no es esta
      // prueba. Corregir igual daria un puntaje inventado.
      if (res.selfDescribed && !sameCompactGrid(res.cfg, active.cfg)) {
        setError(`Este bloque es de ${describeCompactCfg(res.cfg)} y la pauta “${active.name}” es de ${describeCompactCfg(active.cfg)}. Cambia de pauta o escanea la prueba correcta.`);
        return;
      }

      const checked = checkAgainstKey(res.results, active.key);
      const { correct, total } = tallyChecked(checked);
      const warnings: string[] = [];
      if (!res.selfDescribed) {
        warnings.push("El bloque no declara su formato (versión antigua del bloque): se leyó con la grilla de la pauta. Si los resultados no calzan, regenera el bloque desde “Bloque compacto”.");
      }
      setOutcome({ checked, correct, total, warnings });
      setSheetCount((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar el bloque.");
    } finally {
      setBusy(false);
    }
  }, [active]);

  // ── Resultado de una hoja ────────────────────────────────────
  if (step === "scan" && outcome && active) {
    return (
      <CompactResultView
        checked={outcome.checked}
        correct={outcome.correct}
        total={outcome.total}
        title={`${active.name} · hoja ${sheetCount} de esta sesión`}
        subtitle={<span className="text-zinc-400">No se guarda: corrección en pantalla, sin alumno asociado.</span>}
        warnings={outcome.warnings}
        onNext={() => setOutcome(null)}
        secondary={{ label: "Cambiar de pauta", onClick: () => { setOutcome(null); setStep("pauta"); } }}
      />
    );
  }

  // ── Escaneo en serie ─────────────────────────────────────────
  if (step === "scan" && active) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="shrink-0 px-4 py-3 bg-zinc-900 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{active.name}</p>
            <p className="text-[11px] text-zinc-400">{describeCompactCfg(active.cfg)} · {sheetCount} hoja{sheetCount === 1 ? "" : "s"} en esta sesión</p>
          </div>
          <button onClick={() => setStep("pauta")} className="shrink-0 text-xs text-zinc-300 underline">Pautas</button>
        </div>
        {error && <p className="px-4 py-2 text-sm text-red-400 bg-red-950/40">{error}</p>}
        <CameraPanel label="Encuadra el bloque completo (las 4 marcas de esquina)" busy={busy} onFrame={scanSheet} />
      </div>
    );
  }

  // ── Editor de pauta ──────────────────────────────────────────
  if (step === "editor") {
    if (editorSource === "scan" && capturingKey) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col">
          <div className="shrink-0 px-4 py-3 bg-zinc-900">
            <p className="text-sm font-semibold">Escanea la hoja-pauta</p>
            <p className="text-[11px] text-zinc-400">Marca un bloque con las respuestas correctas y fotografíalo. El formato se lee del propio bloque.</p>
          </div>
          {error && <p className="px-4 py-2 text-sm text-red-400 bg-red-950/40">{error}</p>}
          <CameraPanel
            label="Encuadra el bloque de la pauta"
            busy={busy}
            onFrame={captureKeySheet}
            onCancel={() => { setCapturingKey(false); setStep("pauta"); }}
          />
        </div>
      );
    }

    const ql = C.compactQuestionLayout(draftCfg);
    const letters = lettersFor(draftCfg);
    const faltan = missingAnswers(draftKey);

    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="shrink-0 px-4 py-3 bg-zinc-900 flex items-center justify-between">
          <p className="text-sm font-semibold">Pauta {editorSource === "scan" ? "leída de la hoja" : "escrita a mano"}</p>
          <button onClick={() => setStep("pauta")} className="text-xs text-zinc-400 underline">Volver</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {draftNote && <p className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-300">{draftNote}</p>}
          {error && <p className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}

          <label className="block text-sm">
            <span className="text-zinc-400">Nombre de la pauta</span>
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={40}
              placeholder="Ej: Prueba 8°A Matemática"
              className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-white" />
          </label>

          {editorSource === "manual" && (
            <div className="grid grid-cols-3 gap-2 text-sm">
              <label className="block">
                <span className="text-zinc-400 text-xs">Preguntas</span>
                <input type="number" min={1} max={C.COMPACT_MAX_QUESTIONS} value={draftCfg.numQuestions}
                  onChange={(e) => applyCfg({ numQuestions: Math.min(C.COMPACT_MAX_QUESTIONS, Math.max(1, +e.target.value || 1)) })}
                  className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white" />
              </label>
              <label className="block">
                <span className="text-zinc-400 text-xs">Opciones</span>
                <select value={draftCfg.numOptions} onChange={(e) => applyCfg({ numOptions: +e.target.value })}
                  className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white">
                  {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-zinc-400 text-xs">Columnas</span>
                <select value={draftCfg.numColumns ?? ql.numColumns} onChange={(e) => applyCfg({ numColumns: +e.target.value })}
                  className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white">
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n} disabled={n < C.minColumnsFor(draftCfg.numQuestions)}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {editorSource === "manual" && (
            <label className="block text-sm">
              <span className="text-zinc-400">Pegar la clave de corrido (opcional)</span>
              <input
                onChange={(e) => setDraftKey(parseKeyString(e.target.value, draftCfg))}
                placeholder={`Ej: ${Array.from({ length: Math.min(8, ql.numQuestions) }, (_, i) => letters[i % letters.length]).join("")}…`}
                className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-white font-mono tracking-widest" />
            </label>
          )}

          <div>
            <p className="text-xs text-zinc-400 mb-2">
              Toca una pregunta para cambiar su respuesta{faltan.length > 0 && <span className="text-amber-300"> · faltan {faltan.length}</span>}
            </p>
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
              {draftKey.map((letter, i) => (
                <button key={i} onClick={() => cycleAnswer(i)}
                  className={`rounded-xl border py-2 text-center ${letter ? "border-emerald-600/60 bg-emerald-500/10" : "border-amber-600/60 bg-amber-500/10"}`}>
                  <span className="block text-[11px] text-zinc-400">{i + 1}</span>
                  <span className={`block text-xl font-black ${letter ? "text-emerald-300" : "text-amber-400"}`}>{letter || "·"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={commitKey}
            className="w-full rounded-xl bg-white text-black text-lg font-bold py-4">
            Guardar pauta y escanear
          </button>
        </div>
      </div>
    );
  }

  // ── Paso 1: elegir o crear la pauta ──────────────────────────
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="shrink-0 px-4 py-3 bg-zinc-900 flex items-center justify-between">
        <span className="text-sm font-semibold">Corrección rápida</span>
        <Link href="/dashboard" className="text-xs text-zinc-400 underline">Ir al panel</Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300 space-y-1.5">
          <p className="font-bold text-white">Primero la pauta, después escaneas</p>
          <p>Corrige cualquier prueba que lleve un <Link href="/bloque" className="underline">bloque compacto</Link> pegado, sin crear el ensayo y sin identificar alumnos.</p>
          <p className="text-xs text-zinc-500">Las pautas quedan en este dispositivo. Los resultados se muestran en pantalla y no se guardan en tu panel.</p>
        </div>

        {error && <p className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}

        {lastUsed && (
          <button onClick={() => activateKey(lastUsed)}
            className="w-full rounded-xl border border-emerald-700/60 bg-emerald-950/40 p-4 text-left">
            <span className="block text-[11px] uppercase tracking-wide text-emerald-400">Seguir corrigiendo</span>
            <span className="block text-lg font-bold truncate">{lastUsed.name}</span>
            <span className="block text-[11px] text-emerald-300/80">{describeCompactCfg(lastUsed.cfg)}</span>
          </button>
        )}

        <div className="grid gap-3">
          <button onClick={startScanKey}
            className="rounded-xl bg-white text-black text-base font-bold py-4">
            Escanear hoja-pauta
          </button>
          <button onClick={startManual}
            className="rounded-xl border border-zinc-700 bg-zinc-900 text-white text-base font-semibold py-4">
            Escribir la pauta
          </button>
        </div>

        {keys.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400 uppercase tracking-wide">Pautas guardadas</p>
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                <button onClick={() => activateKey(k)} className="flex-1 text-left min-w-0">
                  <span className="block font-semibold truncate">{k.name}</span>
                  <span className="block text-[11px] text-zinc-500">{describeCompactCfg(k.cfg)}</span>
                </button>
                <button onClick={() => activateKey(k)} className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold">Usar</button>
                <button onClick={() => removeKey(k.id)} className="shrink-0 text-xs text-zinc-500 underline">Borrar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
