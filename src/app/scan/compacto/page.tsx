"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as C from "@/tulector/compact_layout";
import { detectCompactBlock } from "@/tulector/compact_block";
import {
  readCompactFrame, checkAgainstKey, tallyChecked, sameCompactGrid, describeCompactCfg,
  type CheckedAnswer,
} from "@/lib/compact_scan";
import { CompactResultView } from "@/components/CompactResultView";
import { compactModeIssue } from "@/lib/sheet_mode";
import { parseOpenQuestions } from "@/lib/quiz_constraints";

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
  checked: CheckedAnswer[];
  correct: number;
  totalKey: number;
  warnings: string[];
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
  // El ensayo activo no cabe en un bloque compacto: se avisa y no se lee, en vez
  // de leer una grilla que no es la que esta impresa.
  const [blocked, setBlocked] = useState(false);

  // Ensayo activo (cookie tulector_active_quiz, la pone "Abrir lector"). Sin
  // ensayo se puede leer igual, pero solo en pantalla: sin quizId no hay donde
  // guardar la nota.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/scan/active-quiz", { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const q = await res.json();
          // Valores REALES del ensayo: recortarlos en silencio (como se hacia
          // antes con Math.min) hacia que un ensayo de 35 preguntas se leyera
          // como uno de 30, con la clave corrida y sin ningun aviso.
          const nq = Math.max(1, Number(q.num_questions) || 20);
          const no = Math.max(2, Number(q.options_per_question) || 5);
          const openCount = parseOpenQuestions(String(q.open_questions ?? ""), nq).length;
          const issue = compactModeIssue(nq, no, openCount);
          if (issue) {
            setError(`${issue} No se puede leer este ensayo como bloque compacto.`);
            setBlocked(true);
            return;
          }
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
      // El pipeline lee el codigo ANTES de calificar: si el bloque declara su
      // formato (codigo v3), esa grilla manda sobre la del ensayo activo.
      const read = readCompactFrame(frame, cfg);
      if (!read.ok) { setError(read.reason); return; }
      const { results, warp, code: codeRead, selfDescribed } = read;

      const warnings: string[] = [];
      // Codigo del bloque: AVISO SUAVE, nunca bloquea (mismo criterio que la
      // hoja completa en /scan) -- una lectura buena con codigo ilegible sigue
      // siendo una lectura buena.
      if (quiz?.sheetCode != null && codeRead && codeRead.sheetId > 0 && codeRead.sheetId !== quiz.sheetCode) {
        warnings.push(`El bloque dice ser del ensayo #${codeRead.sheetId} y el ensayo activo es el #${quiz.sheetCode}. Revisa que sea la prueba correcta.`);
      }
      // La grilla impresa NO es la del ensayo: eso ya no es un aviso suave, el
      // puntaje saldria de leer burbujas que no estan donde se cree.
      if (selfDescribed && !sameCompactGrid(read.cfg, cfg)) {
        setError(`El bloque impreso es de ${describeCompactCfg(read.cfg)} y el ensayo activo es de ${describeCompactCfg(cfg)}. Genera el bloque de este ensayo o cambia de ensayo activo.`);
        return;
      }
      if (!selfDescribed) {
        warnings.push("El bloque no declara su formato (versión antigua): se leyó con la grilla del ensayo activo. Si los resultados no calzan, vuelve a generar el bloque.");
      }

      const answers = results.map((r) => ({ q: r.question, a: r.answer, s: r.scores }));
      const key = quiz ? quiz.answerKey.split("") : [];
      const checked = checkAgainstKey(results, key);
      const { correct, total: totalKey } = tallyChecked(checked);

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
            // sheetId 0 = bloque libre (no pertenece a ningun ensayo): mandarlo
            // haria que el backend lo compare contra el sheet_code del ensayo y
            // mande la hoja a revision manual por un desajuste inventado.
            ...(codeRead && codeRead.sheetId > 0 ? { code: codeRead } : {}),
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

      setOutcome({ checked, correct, totalKey, warnings, saved });
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
      <CompactResultView
        checked={outcome.checked}
        // Con ensayo manda lo que quedo GUARDADO (el backend puede haber
        // re-enrutado la hoja a un ensayo hermano y recalculado el puntaje).
        correct={s ? s.score : outcome.correct}
        total={s ? s.total : outcome.totalKey}
        title={`Resultado del bloque${quiz?.title ? ` · ${quiz.title}` : ""}`}
        subtitle={
          s ? (
            <span>
              {s.grade != null && <>Nota <strong className="text-white">{s.grade.toFixed(1)}</strong> · </>}
              {s.studentName ?? (studentId.trim() ? "Sin identificar" : "Sin identificación")}
              {s.status === "manual_review" && <span className="text-amber-300"> · queda en revisión manual</span>}
            </span>
          ) : (
            <span className="text-amber-300">
              Sin ensayo activo: la lectura no se guardó. Abre el lector desde el ensayo para que se registre la nota.
            </span>
          )
        }
        warnings={outcome.warnings}
        nextLabel="Escanear siguiente"
        onNext={() => { setOutcome(null); setStudentId(""); }}
        secondary={{ label: "Ir al panel", onClick: () => { window.location.href = "/dashboard"; } }}
      />
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
          {describeCompactCfg(cfg)}{quiz ? "" : " (config del último bloque generado)"} — si el bloque trae su formato impreso, manda el papel.
        </p>
        <button
          onClick={capture}
          disabled={status === "processing" || blocked}
          className="w-full rounded-xl bg-white text-black text-lg font-bold py-4 disabled:opacity-50"
        >
          {status === "processing" ? "Procesando…" : "Capturar"}
        </button>
        <label className={`block text-center text-xs underline cursor-pointer ${blocked ? "text-zinc-600 pointer-events-none" : "text-zinc-400"}`}>
          o sube una foto del bloque
          <input type="file" accept="image/*" className="hidden" disabled={blocked} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <p className="text-center text-[11px] text-zinc-500">
          ¿Corregir sin alumnos, solo en pantalla?{" "}
          <Link href="/scan/rapido" className="underline">Corrección rápida</Link>
        </p>
      </div>
    </div>
  );
}
