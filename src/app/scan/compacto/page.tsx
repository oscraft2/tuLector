"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as C from "@/tulector/compact_layout";
import { detectCompactBlock, warpCompactBlock, readCompactCode, gradeCompactBlock, scoreCompact } from "@/tulector/compact_block";

/**
 * Lector del BLOQUE OMR COMPACTO (Fase 3 de
 * docs/plan-bloque-omr-compacto-ejecucion.md).
 *
 * Pagina aparte de /scan a proposito, igual que /scan/reverso: el sub-motor
 * compacto localiza finder patterns DENTRO de una hoja ajena (la prueba que
 * armo el profesor), mientras que /scan busca las 12 anclas de la hoja
 * completa de TuLector. Son dos localizadores distintos sobre el mismo
 * clasificador de burbuja; mezclarlos en una sola pantalla obligaria a tocar
 * el lector en produccion, que es justo lo que este plan evita.
 *
 * Identificacion del alumno: el bloque NO la trae (es su gracia — cabe en
 * cualquier prueba). El profesor puede tipear el ID a mano; si no lo hace, el
 * resultado se guarda como "Sin RUT" y queda para asignar despues, camino que
 * la API ya soportaba antes de esta fase (api/scan/result/route.ts).
 */

type ActiveQuiz = {
  id: string;
  title: string;
  answerKey: string;
  numQuestions: number;
  numOptions: number;
  sheetCode: number | null;
  sheetMode: string;
};

type Outcome = {
  answers: { q: number; a: string; s?: number[] }[];
  correct: number;
  totalKey: number;
  warning: string | null;
  saved: null | { status: string; score: number; total: number; grade: number | null; studentName: string | null };
};

const DETECT_EVERY_MS = 600;
const HUD_WIDTH = 640;

export default function ScanCompactoPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hudRef = useRef<HTMLCanvasElement | null>(null);

  const [quiz, setQuiz] = useState<ActiveQuiz | null>(null);
  const [cfg, setCfg] = useState<C.CompactConfig>(C.DEFAULT_COMPACT);
  const [studentId, setStudentId] = useState("");
  const [status, setStatus] = useState<"idle" | "processing">("idle");
  const [error, setError] = useState("");
  const [detected, setDetected] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // Ensayo activo (cookie tulector_active_quiz, la pone "Abrir lector"). Sin
  // ensayo se puede leer igual, pero solo en pantalla: sin quizId no hay donde
  // guardar la nota.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/scan/active-quiz", { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const q = await res.json();
          const nq = Math.min(C.COMPACT_MAX_QUESTIONS, Math.max(1, Number(q.num_questions) || 20));
          const no = Math.min(5, Math.max(2, Number(q.options_per_question) || 5));
          setQuiz({
            id: String(q.id),
            title: String(q.title ?? ""),
            answerKey: String(q.answer_key ?? "").toUpperCase(),
            numQuestions: nq,
            numOptions: no,
            sheetCode: typeof q.sheet_code === "number" ? q.sheet_code : null,
            sheetMode: String(q.sheet_mode ?? "full"),
          });
          setCfg({ numQuestions: nq, numOptions: no });
          return;
        }
      } catch { /* sigue al modo libre */ }
      // Modo libre: la config que dejo /bloque al generar el bloque.
      try {
        const raw = localStorage.getItem("tulector_compact_config");
        if (raw) {
          const c = JSON.parse(raw) as Partial<C.CompactConfig>;
          setCfg({
            numQuestions: Math.min(C.COMPACT_MAX_QUESTIONS, Math.max(1, Number(c.numQuestions) || 20)),
            numOptions: Math.min(5, Math.max(2, Number(c.numOptions) || 5)),
            ...(c.numColumns ? { numColumns: Number(c.numColumns) } : {}),
          });
        }
      } catch { /* queda DEFAULT_COMPACT */ }
    })();
  }, []);

  // Camara
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
        if (!cancelled) setError("Permite el acceso a la cámara, o sube una foto del bloque.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Latido de deteccion para el HUD: corre sobre un cuadro REDUCIDO y cada
  // DETECT_EVERY_MS, no en cada frame — solo sirve para decirle al profesor
  // "ya se ve el bloque", la lectura de verdad usa el cuadro a resolucion
  // completa al capturar.
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const video = videoRef.current;
      if (video && video.videoWidth > 0 && status === "idle" && !outcome) {
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
  }, [status, outcome]);

  /** Lee un cuadro ya capturado (camara o archivo) y guarda el resultado. */
  const processFrame = async (frame: ImageData) => {
    setError("");
    setStatus("processing");
    try {
      const detection = detectCompactBlock(frame);
      if (!detection) {
        setError("No se encontró un bloque de TuLector en la foto. Acerca la cámara y cuida que las 4 marcas de las esquinas se vean completas.");
        return;
      }

      const warp = warpCompactBlock(frame, detection.corners);
      const report = gradeCompactBlock(warp, cfg);
      if (!report.valid) {
        setError(`No se pudo leer el bloque: ${report.reason ?? "lectura inválida"}. Repite la foto con mejor luz y sin sombras.`);
        return;
      }

      // Codigo del bloque: AVISO SUAVE, nunca bloquea (mismo criterio que la
      // hoja completa en /scan) -- una lectura buena con codigo ilegible sigue
      // siendo una lectura buena.
      const codeRead = readCompactCode(warp);
      let warning: string | null = null;
      if (quiz?.sheetCode != null && codeRead && codeRead.sheetId !== quiz.sheetCode) {
        warning = `El bloque dice ser del ensayo #${codeRead.sheetId} y el ensayo activo es el #${quiz.sheetCode}. Revisa que sea la prueba correcta.`;
      }

      const answers = report.results.map((r) => ({ q: r.question, a: r.answer, s: r.scores }));
      const key = quiz ? quiz.answerKey.split("") : [];
      const { correct, total: totalKey } = scoreCompact(report.results, key);

      let saved: Outcome["saved"] = null;
      if (quiz) {
        // Miniatura del bloque rectificado como evidencia (igual que el warp
        // que guarda /scan): JPEG chico para no pasarse del limite del endpoint.
        const c = document.createElement("canvas");
        c.width = warp.width; c.height = warp.height;
        c.getContext("2d")!.putImageData(warp, 0, 0);
        const warpUrl = c.toDataURL("image/jpeg", 0.6);

        const res = await fetch("/api/scan/result", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizId: quiz.id,
            rut: studentId.trim(),
            answers,
            source: "compact",
            photo: warpUrl,
            ...(codeRead ? { code: codeRead } : {}),
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "No se pudo guardar el resultado.");
        saved = {
          status: String(payload.status ?? "corrected"),
          score: Number(payload.score ?? correct),
          total: Number(payload.total ?? totalKey),
          grade: typeof payload.grade === "number" ? payload.grade : null,
          studentName: payload.studentName ?? null,
        };
      }

      setOutcome({ answers, correct, totalKey, warning, saved });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar el bloque.");
    } finally {
      setStatus("idle");
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || status === "processing") return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (!canvas.width) { setError("La cámara todavía no entrega imagen."); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    await processFrame(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  const onFile = async (file: File | undefined) => {
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
        await processFrame(ctx.getImageData(0, 0, canvas.width, canvas.height));
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { setError("No se pudo abrir esa imagen."); URL.revokeObjectURL(url); };
    img.src = url;
  };

  if (outcome) {
    const s = outcome.saved;
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="p-3 flex items-center justify-between bg-zinc-900">
          <span className="text-sm font-semibold">Resultado del bloque</span>
          <Link href="/dashboard" className="text-xs text-zinc-400 underline">Ir al panel</Link>
        </div>
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {outcome.warning && <p className="rounded-md border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">⚠ {outcome.warning}</p>}
          <div className="rounded-md border border-zinc-700 p-4">
            <p className="text-3xl font-bold">
              {quiz ? `${s ? s.score : outcome.correct} / ${s ? s.total : outcome.totalKey}` : `${outcome.answers.filter((a) => a.a !== "-" && a.a !== "?").length} respuestas leídas`}
            </p>
            {s && (
              <p className="mt-1 text-sm text-zinc-300">
                {s.grade != null && <>Nota <strong>{s.grade.toFixed(1)}</strong> · </>}
                {s.studentName ?? (studentId.trim() ? "Sin identificar" : "Sin identificación")}
                {s.status === "manual_review" && <span className="text-amber-300"> · queda en revisión manual</span>}
              </p>
            )}
            {!quiz && <p className="mt-1 text-sm text-amber-300">Sin ensayo activo: la lectura no se guardó. Abre el lector desde el ensayo para que se registre la nota.</p>}
          </div>

          <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
            {outcome.answers.map((a) => (
              <div key={a.q} className="rounded-md border border-zinc-700 py-1.5">
                <span className="block text-zinc-500">{a.q}</span>
                <span className="block text-base font-bold">{a.a}</span>
              </div>
            ))}
          </div>

          <button onClick={() => { setOutcome(null); setStudentId(""); }}
            className="w-full rounded-md bg-white text-black font-semibold py-3">
            Escanear otro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-3 flex items-center justify-between bg-zinc-900">
        <span className="text-sm font-semibold">
          Bloque compacto{quiz?.title ? ` · ${quiz.title}` : ""}
        </span>
        <Link href="/scan" className="text-xs text-zinc-400 underline">Lector de hoja</Link>
      </div>

      <div className="relative flex-1">
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        <div className={`absolute inset-x-6 top-6 rounded-md px-3 py-2 text-center text-xs font-semibold ${detected ? "bg-emerald-600/80" : "bg-black/60 text-zinc-300"}`}>
          {detected ? "Bloque detectado — captura ahora" : "Encuadra el bloque completo (las 4 marcas de esquina)"}
        </div>
      </div>

      <div className="p-4 bg-zinc-900 space-y-2">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {quiz && quiz.sheetMode !== "compact" && (
          <p className="text-xs text-amber-300">
            ⚠ El ensayo activo está guardado como hoja completa. Si escaneaste una hoja de TuLector, usa el{" "}
            <Link href="/scan" className="underline">lector de hoja</Link>.
          </p>
        )}
        <label className="block text-xs text-zinc-400">
          Identificación del alumno (opcional)
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="RUT o número de lista — el bloque no lo trae impreso"
            className="mt-1 w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
          />
        </label>
        <p className="text-[11px] text-zinc-500">
          {cfg.numQuestions} preguntas · {cfg.numOptions} opciones{quiz ? "" : " (config del último bloque generado)"}
        </p>
        <button
          onClick={capture}
          disabled={status === "processing"}
          className="w-full rounded-md bg-white text-black font-semibold py-3 disabled:opacity-50"
        >
          {status === "processing" ? "Procesando…" : "Capturar"}
        </button>
        <label className="block text-center text-xs text-zinc-400 underline cursor-pointer">
          o sube una foto del bloque
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}
