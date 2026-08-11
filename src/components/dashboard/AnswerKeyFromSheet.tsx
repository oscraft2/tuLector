"use client";

import { useRef, useState } from "react";
import { findCorners, warpSheet, gradeBubbles, DEFAULT_CONFIG, type BubbleResult } from "@/lib/omr";
import { suggestColumns } from "@/lib/sheet_generator";
import { optionLabelsFor } from "@/lib/quiz_constraints";

/**
 * Carga la clave de respuestas ESCANEANDO una hoja TuLector ya rellenada con
 * las respuestas correctas, en vez de tipearla pregunta por pregunta.
 *
 * Corre entero en el cliente: el motor OMR (findCorners → warpSheet →
 * gradeBubbles) ya vive en el navegador, asi que no hace falta endpoint nuevo
 * ni subir la foto a ningun lado.
 *
 * La lectura NUNCA se aplica sola: siempre pasa por un paso de confirmacion.
 * Una clave mal leida y aceptada a ciegas corromperia la nota de todas las
 * hojas de ese ensayo, asi que el costo de un click extra es barato.
 */

type Props = {
  numQuestions: number;
  numOptions: number;
  /** Preguntas de desarrollo (1-indexadas): no tienen burbujas ni letra correcta. */
  openQuestions?: number[];
  /** Se llama solo cuando el profesor CONFIRMA la lectura. */
  onAccept: (letters: string) => void;
};

type ReadResult = {
  letters: string;
  total: number;
  read: number;
  doubtful: number[];   // preguntas 1-indexadas con lectura dudosa
  missing: number[];    // preguntas 1-indexadas sin marca detectada
};

export function AnswerKeyFromSheet({ numQuestions, numOptions, openQuestions = [], onAccept }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReadResult | null>(null);

  const labels = optionLabelsFor(numOptions);
  const openSet = new Set(openQuestions);

  /** Decodifica el archivo a ImageData sin pasar por el DOM visible. */
  async function toImageData(file: File): Promise<ImageData> {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const frame = await toImageData(file);

      // numColumns se deriva con la MISMA funcion que usa el servidor al crear
      // el ensayo (suggestColumns), asi que la grilla coincide con la hoja que
      // se imprimio para ese mismo nº de preguntas.
      const config = {
        ...DEFAULT_CONFIG,
        numQuestions,
        numOptions,
        numColumns: suggestColumns(numQuestions),
        optionLabels: labels,
        openQuestions,
      };

      const corners = findCorners(frame, config);
      if (!corners) {
        setError("No se detectaron las 4 marcas de esquina. Acerca la camara, evita sombras y que la hoja entre completa.");
        return;
      }

      const warped = warpSheet(frame, corners, config);
      const report = gradeBubbles(warped, config, corners);
      if (!report.valid) {
        setError(`No se pudo leer la hoja: ${report.reason ?? "lectura invalida"}.`);
        return;
      }

      setResult(summarize(report.results, numQuestions, openSet));
    } catch {
      setError("No se pudo procesar la imagen. Prueba con una foto mas nitida o en formato JPG/PNG.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-md border border-[#e6e8eb] bg-[#fafbfc] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#111827]">Escanear pauta desde una hoja</p>
          <p className="mt-0.5 text-[11px] text-[#5b6472]">
            Rellena una hoja TuLector con las respuestas correctas y fotografiala.
            Debe ser de <strong>{numQuestions} preguntas × {numOptions} opciones</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="shrink-0 rounded-md border border-[#07305f] px-3 py-1.5 text-xs font-semibold text-[#07305f] hover:bg-[#eef4ff] disabled:opacity-50"
        >
          {busy ? "Leyendo…" : "Escanear pauta"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      {error && <p className="mt-2 text-xs font-semibold text-[#b45309]">{error}</p>}

      {result && (
        <div className="mt-3 rounded-md border border-[#cfd6df] bg-white p-3">
          <p className="text-xs font-semibold text-[#111827]">
            Lectura: {result.read} de {result.total} preguntas
          </p>

          {/* Se muestran todas las letras para que el profesor las contraste con
              su hoja antes de aceptar: sin este paso, un error de lectura se
              propagaria a la nota de todas las hojas del ensayo. */}
          <div className="mt-2 flex flex-wrap gap-1">
            {result.letters.split("").map((letter, i) => {
              const q = i + 1;
              const isOpen = openSet.has(q);
              const isMissing = result.missing.includes(q);
              const isDoubtful = result.doubtful.includes(q);
              const tone = isOpen
                ? "border-dashed border-[#cfd6df] bg-white text-[#9aa2af]"
                : isMissing
                  ? "border-red-300 bg-red-50 text-red-700"
                  : isDoubtful
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-[#cfd6df] bg-white text-[#111827]";
              return (
                <span
                  key={q}
                  title={`Pregunta ${q}${isOpen ? " (desarrollo)" : isMissing ? " — sin marca detectada" : isDoubtful ? " — lectura dudosa" : ""}`}
                  className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded border px-1 text-[11px] font-bold ${tone}`}
                >
                  {letter === "-" ? "·" : letter}
                </span>
              );
            })}
          </div>

          {(result.missing.length > 0 || result.doubtful.length > 0) && (
            <p className="mt-2 text-[11px] text-[#b45309]">
              {result.missing.length > 0 && <>Sin marca: {result.missing.join(", ")}. </>}
              {result.doubtful.length > 0 && <>Dudosas: {result.doubtful.join(", ")}. </>}
              Revisa esas preguntas en la grilla despues de aplicar.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { onAccept(result.letters); setResult(null); }}
              className="rounded-md bg-[#07305f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#062447]"
            >
              Usar esta pauta
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold text-[#5b6472] hover:bg-[#f4f6f8]"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Convierte la salida del motor en la cadena de clave + el detalle a revisar. */
function summarize(results: BubbleResult[], numQuestions: number, openSet: Set<number>): ReadResult {
  const chars: string[] = [];
  const doubtful: number[] = [];
  const missing: number[] = [];
  let read = 0;

  for (let i = 0; i < numQuestions; i++) {
    const q = i + 1;
    const r = results[i];
    // Una pregunta de desarrollo no tiene letra correcta: su slot es "-" fijo,
    // igual que en el editor de clave.
    if (openSet.has(q)) { chars.push("-"); continue; }

    const answer = r?.answer ?? "-";
    // Solo una letra unica sirve como clave: "?" (glare), "-" (blanco) o varias
    // letras juntas no son una respuesta correcta valida.
    if (answer.length === 1 && answer >= "A" && answer <= "Z") {
      chars.push(answer);
      read++;
      if (r?.flag === "revisar") doubtful.push(q);
    } else {
      chars.push("-");
      missing.push(q);
    }
  }

  return {
    letters: chars.join(""),
    total: numQuestions - openSet.size,
    read,
    doubtful,
    missing,
  };
}
