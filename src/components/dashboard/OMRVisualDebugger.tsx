"use client";

import { useEffect, useRef, useState } from "react";

interface OMRVisualDebuggerProps {
  photo: string | null;
  warp: string | null;
  corners: [number, number][] | null;
  answers: { q: number; a: string; s: number[] }[];
  rut?: string;
}

export function OMRVisualDebugger({ photo, warp, corners, answers, rut }: OMRVisualDebuggerProps) {
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const warpCanvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState<"photo" | "warp">("photo");

  // 1. Draw Original Photo with Corners Overlay
  useEffect(() => {
    if (!photo || !photoCanvasRef.current) return;
    const canvas = photoCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = photo;
    img.onload = () => {
      // Set canvas size to match image dimensions
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw base image
      ctx.drawImage(img, 0, 0);

      // Draw corners if available
      if (corners && corners.length === 4) {
        ctx.strokeStyle = "#ef4444"; // red
        ctx.lineWidth = Math.max(3, Math.round(img.width / 150));
        ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
        
        ctx.beginPath();
        ctx.moveTo(corners[0][0], corners[0][1]); // Top-Left
        ctx.lineTo(corners[1][0], corners[1][1]); // Top-Right
        ctx.lineTo(corners[2][0], corners[2][1]); // Bottom-Right
        ctx.lineTo(corners[3][0], corners[3][1]); // Bottom-Left
        ctx.closePath();
        ctx.stroke();
        ctx.fill();

        // Draw corner points
        const pointColors = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6"]; // TL, TR, BR, BL
        corners.forEach(([x, y], i) => {
          ctx.fillStyle = pointColors[i];
          ctx.beginPath();
          ctx.arc(x, y, Math.max(6, Math.round(img.width / 80)), 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Draw label
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${Math.max(12, Math.round(img.width / 40))}px sans-serif`;
          ctx.fillText(["TL", "TR", "BR", "BL"][i], x + 10, y + 10);
        });
      }
    };
  }, [photo, corners, activeTab]);

  // 2. Draw Warped Sheet with Grid & Samples Overlays
  useEffect(() => {
    if (!warp || !warpCanvasRef.current) return;
    const canvas = warpCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = warp;
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw warped image
      ctx.drawImage(img, 0, 0);

      // Drawing scale
      const scaleX = img.width / 1200;
      const scaleY = img.height / 1650;

      // Draw answers bubble templates overlay
      answers.forEach((ans) => {
        const qIndex = ans.q - 1;
        const cy = (340 + qIndex * 60 + 14) * scaleY;
        const scoreList = ans.s || [];

        // Draw Row number
        ctx.fillStyle = "#07305f";
        ctx.font = `bold ${Math.round(18 * scaleX)}px sans-serif`;
        ctx.fillText(`Q${ans.q}`, 40 * scaleX, cy + 6 * scaleY);

        // Draw options A-E (0-4)
        for (let o = 0; o < 5; o++) {
          const cx = (200 + o * 64) * scaleX;
          const score = scoreList[o] ?? 0;
          const optLetter = "ABCDE"[o];

          // Draw sample bubble outline
          ctx.strokeStyle = score > 0.15 ? "#10b981" : "#cfd6df"; // Green if dark, light grey otherwise
          ctx.lineWidth = 2 * scaleX;
          ctx.beginPath();
          ctx.arc(cx, cy, 14 * scaleX, 0, 2 * Math.PI);
          ctx.stroke();

          // Highlight if marked or matches result
          if (ans.a === optLetter) {
            ctx.fillStyle = "rgba(16, 185, 129, 0.4)"; // translucent green
            ctx.beginPath();
            ctx.arc(cx, cy, 14 * scaleX, 0, 2 * Math.PI);
            ctx.fill();

            // Label option
            ctx.fillStyle = "#065f46";
            ctx.font = `bold ${Math.round(12 * scaleX)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(optLetter, cx, cy + 4 * scaleY);
          } else {
            // Draw raw darkness score
            ctx.fillStyle = "#6b7280";
            ctx.font = `${Math.round(9 * scaleX)}px monospace`;
            ctx.textAlign = "center";
            ctx.fillText(score.toFixed(2), cx, cy + 3 * scaleY);
          }
        }
      });

      // Draw RUT Grid template overlay if RUT is expected
      if (rut) {
        ctx.strokeStyle = "rgba(59, 130, 246, 0.5)"; // Blue overlay
        ctx.lineWidth = 1 * scaleX;
        
        // 9 columns: 8 digits + 1 DV
        for (let c = 0; c < 9; c++) {
          const cx = (640 + c * 40) * scaleX;
          
          for (let d = 0; d < 10; d++) {
            const cy = (252 + d * 27) * scaleY;
            ctx.beginPath();
            ctx.arc(cx, cy, 8 * scaleX, 0, 2 * Math.PI);
            ctx.stroke();
          }
        }
      }
    };
  }, [warp, answers, rut, activeTab]);

  return (
    <div className="space-y-4">
      {/* Control Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("photo")}
          className={`px-4 py-2 text-sm font-semibold rounded-md border transition-all ${
            activeTab === "photo"
              ? "bg-[#07305f] text-white border-[#07305f] shadow"
              : "bg-white text-[#4b5563] border-[#cfd6df] hover:bg-[#f9fafb]"
          }`}
        >
          Imagen Original (Esquinas OMR)
        </button>
        {warp && (
          <button
            onClick={() => setActiveTab("warp")}
            className={`px-4 py-2 text-sm font-semibold rounded-md border transition-all ${
              activeTab === "warp"
                ? "bg-[#07305f] text-white border-[#07305f] shadow"
                : "bg-white text-[#4b5563] border-[#cfd6df] hover:bg-[#f9fafb]"
            }`}
          >
            Plano Proyectado (Respuestas OMR)
          </button>
        )}
      </div>

      {/* Viewport Canvas container */}
      <div className="flex justify-center rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-4 min-h-[500px]">
        {activeTab === "photo" ? (
          <div className="relative max-w-full overflow-auto">
            {photo ? (
              <canvas ref={photoCanvasRef} className="max-w-full h-auto rounded border bg-white shadow-sm" />
            ) : (
              <div className="flex items-center justify-center h-96 text-sm text-[#9ca3af]">
                La foto original no fue adjuntada en este log de escaneo.
              </div>
            )}
          </div>
        ) : (
          <div className="relative max-w-full overflow-auto">
            {warp ? (
              <canvas ref={warpCanvasRef} className="max-w-full h-auto rounded border bg-white shadow-sm" />
            ) : (
              <div className="flex items-center justify-center h-96 text-sm text-[#9ca3af]">
                La imagen alineada (warp) no está disponible en este log.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
