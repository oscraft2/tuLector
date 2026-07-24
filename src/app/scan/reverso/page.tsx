"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { detectReverso, cropOpenAnswerBox } from "@/lib/open_answer_capture";
import { chunkOpenQuestions } from "@/lib/sheet_generator";
import { parseOpenQuestions } from "@/lib/quiz_constraints";

/**
 * Escaneo del REVERSO de un alumno (Fase 1-3, docs/plan-correccion-ia-
 * abiertas.md). Pagina aparte y deliberadamente SIMPLE (una foto a la vez,
 * sin la logica de votacion/estabilidad de /scan/page.tsx) -- el reverso solo
 * necesita perspectiva plana para recortar recuadros grandes, no la precision
 * de burbuja del frente. Llega aca via redireccion automatica desde /scan
 * tras guardar el frente de un alumno con preguntas de desarrollo pendientes
 * -- el paper_id ya viene resuelto (identidad por flujo de escaneo, sin OCR
 * ni orden adivinado).
 */
type CropResult = {
  question: number; ok: boolean; transcripcion?: string; puntaje?: number;
  maxPoints?: number; confianza?: string; legible?: boolean; error?: string;
};

export default function ScanReversoPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [paperId, setPaperId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<number[][]>([]);
  const [chunkIndex, setChunkIndex] = useState(0); // 0-indexado, siguiente chunk a escanear
  const [status, setStatus] = useState<"idle" | "processing" | "done">("idle");
  const [results, setResults] = useState<CropResult[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("paper");
    const nq = Number(params.get("nq") || 0);
    const openQuestions = parseOpenQuestions(params.get("open") ?? "", nq || 9999);
    setPaperId(pid);
    setChunks(chunkOpenQuestions(openQuestions));
    if (!pid || openQuestions.length === 0) setError("Falta informacion del alumno o del ensayo (abre esta pagina desde /scan, no directo).");
  }, []);

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
        if (!cancelled) setError("Permite acceso a la camara en configuracion.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = async () => {
    if (!videoRef.current || !paperId || status === "processing") return;
    const chunk = chunks[chunkIndex];
    if (!chunk) return;
    setError("");

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const detection = detectReverso(frame);
    if (!detection) {
      setError("No se reconocio un reverso de tuLector en esta foto. Encuadra bien la hoja (las 4 esquinas negras deben verse completas).");
      return;
    }
    if (detection.detection.chunkIndex !== chunkIndex + 1) {
      setError(`Esta hoja parece ser la página de reverso ${detection.detection.chunkIndex}, pero esperaba la ${chunkIndex + 1}. Escanéalas en orden.`);
      return;
    }

    setStatus("processing");
    const crops = chunk
      .map((q, i) => {
        const cropped = cropOpenAnswerBox(detection.warp, i, chunk.length);
        if (!cropped) return null;
        const c = document.createElement("canvas");
        c.width = cropped.width;
        c.height = cropped.height;
        c.getContext("2d")!.putImageData(cropped, 0, 0);
        return { question: q, imageDataUrl: c.toDataURL("image/jpeg", 0.85) };
      })
      .filter((x): x is { question: number; imageDataUrl: string } => x !== null);

    try {
      const res = await fetch("/api/scan/open-answers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, crops }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "No se pudo procesar el reverso.");
      setResults((prev) => [...prev, ...((payload.results ?? []) as CropResult[])]);
      const next = chunkIndex + 1;
      if (next < chunks.length) {
        setChunkIndex(next);
        setStatus("idle");
      } else {
        setStatus("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar el reverso.");
      setStatus("idle");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-3 flex items-center justify-between bg-zinc-900">
        <span className="text-sm font-semibold">Escanear reverso {chunks.length > 1 ? `(${chunkIndex + 1}/${chunks.length})` : ""}</span>
        <Link href="/scan" className="text-xs text-zinc-400 underline">Volver</Link>
      </div>

      {status !== "done" ? (
        <>
          <div className="relative flex-1">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          </div>
          <div className="p-4 bg-zinc-900 space-y-2">
            {error && <p className="text-sm text-red-400">{error}</p>}
            <p className="text-xs text-zinc-400">
              Pregunta{chunks[chunkIndex]?.length === 1 ? "" : "s"} {chunks[chunkIndex]?.join(", ")} — encuadra la hoja de desarrollo completa.
            </p>
            <button
              onClick={capture}
              disabled={status === "processing"}
              className="w-full rounded-md bg-white text-black font-semibold py-3 disabled:opacity-50"
            >
              {status === "processing" ? "Procesando…" : "Capturar"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          <p className="text-sm font-semibold text-emerald-400">Listo — sugerencias de la IA (sin confirmar todavía):</p>
          {results.map((r) => (
            <div key={r.question} className="rounded-md border border-zinc-700 p-3 text-sm">
              <p className="font-semibold">Pregunta {r.question}</p>
              {r.ok ? (
                <>
                  <p className="text-zinc-300">Transcripción: {r.transcripcion || "(vacío)"}</p>
                  <p className="text-zinc-300">Puntaje sugerido: {r.puntaje}/{r.maxPoints} · confianza: {r.confianza}{r.legible === false ? " · ⚠ poco legible" : ""}</p>
                </>
              ) : (
                <p className="text-red-400">Error: {r.error}</p>
              )}
            </div>
          ))}
          <p className="text-xs text-zinc-500">
            Estas sugerencias quedan guardadas para revisión — todavía no se suman a la nota
            automáticamente (el profesor las confirma después).
          </p>
          <Link href="/scan" className="block text-center rounded-md bg-white text-black font-semibold py-3">
            Volver a escanear
          </Link>
        </div>
      )}
    </div>
  );
}
