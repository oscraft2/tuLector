"use client";

import { useEffect, useRef } from "react";
import * as C from "@/tulector/compact_layout";
import { drawCompactBlockSheet, BLOCK_MM, type CompactBlockOptions } from "@/lib/compact_block_generator";
import { type Ctx2D } from "@/tulector/sheet_render";

/**
 * Vista previa del bloque compacto CON REGLA EN MILIMETROS.
 *
 * La regla no es decoracion: el modo de falla mas frecuente del flujo
 * "generar → pegar en Word → imprimir" es que el bloque termine impreso a otro
 * tamaño. Mostrar solo pixeles no le dice nada al profesor sobre eso; mostrar
 * milimetros le permite medir la impresion con una regla de verdad y detectar
 * el problema ANTES de repartir la prueba.
 */

const RULER = 26;        // grosor de la banda de regla, en px de pantalla
const MM_PER_CM = 10;

export interface CompactBlockPreviewProps extends CompactBlockOptions {
  /** Ancho disponible en pantalla (px). El bloque se escala para caber. */
  maxWidth?: number;
  className?: string;
}

export function CompactBlockPreview({ maxWidth = 720, className, ...opts }: CompactBlockPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Escala de pantalla: cuantos px de pantalla vale 1 px canonico del bloque.
  const scale = Math.min(1, (maxWidth - RULER) / C.BLOCK_W);
  const viewW = Math.round(C.BLOCK_W * scale);
  const viewH = Math.round(C.BLOCK_H * scale);
  const pxPerMm = viewW / BLOCK_MM.w;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    drawCompactBlockSheet(ctx as unknown as Ctx2D, opts);
    // `opts` se desestructura arriba: sus campos son los que deben disparar el
    // redibujo, no la identidad del objeto (que cambia en cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewW, viewH, scale, opts.cfg.numQuestions, opts.cfg.numOptions, opts.cfg.numColumns,
      opts.label, opts.caption, opts.code?.sheetId, opts.marks?.filled]);

  // Marcas de la regla: una por cm, con subdivision cada 5 mm.
  const ticksX: { mm: number; major: boolean }[] = [];
  for (let mm = 0; mm <= Math.floor(BLOCK_MM.w); mm += 5) {
    ticksX.push({ mm, major: mm % MM_PER_CM === 0 });
  }
  const ticksY: { mm: number; major: boolean }[] = [];
  for (let mm = 0; mm <= Math.floor(BLOCK_MM.h); mm += 5) {
    ticksY.push({ mm, major: mm % MM_PER_CM === 0 });
  }

  return (
    <div className={className}>
      <div style={{ display: "grid", gridTemplateColumns: `${RULER}px ${viewW}px`, gridTemplateRows: `${RULER}px ${viewH}px` }}>
        {/* esquina vacia */}
        <div />

        {/* regla horizontal */}
        <div style={{ position: "relative", height: RULER, borderBottom: "1px solid #cbd5e1" }}>
          {ticksX.map(({ mm, major }) => (
            <div key={mm} style={{ position: "absolute", left: mm * pxPerMm, bottom: 0 }}>
              <div style={{ width: 1, height: major ? 9 : 5, background: "#94a3b8" }} />
              {major && (
                <span style={{ position: "absolute", left: 2, bottom: 10, fontSize: 9, color: "#64748b", whiteSpace: "nowrap" }}>
                  {mm}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* regla vertical */}
        <div style={{ position: "relative", width: RULER, borderRight: "1px solid #cbd5e1" }}>
          {ticksY.map(({ mm, major }) => (
            <div key={mm} style={{ position: "absolute", top: mm * pxPerMm, right: 0 }}>
              <div style={{ height: 1, width: major ? 9 : 5, background: "#94a3b8", marginLeft: "auto" }} />
              {major && (
                <span style={{ position: "absolute", right: 10, top: -5, fontSize: 9, color: "#64748b" }}>
                  {mm}
                </span>
              )}
            </div>
          ))}
        </div>

        <canvas
          ref={canvasRef}
          style={{ width: viewW, height: viewH, border: "1px solid #e2e8f0", display: "block" }}
        />
      </div>

      <p style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
        Tamano impreso: <strong>{BLOCK_MM.w.toFixed(0)} x {BLOCK_MM.h.toFixed(0)} mm</strong> a {C.BLOCK_DPI} DPI.
        Al pegarlo en Word no cambies su tamano: si lo estiras o lo achicas, el lector deja de reconocerlo.
        Puedes comprobarlo con una regla sobre la hoja impresa.
      </p>
    </div>
  );
}
