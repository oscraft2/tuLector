import { ImageResponse } from "next/og";
import { articleContent } from "@/lib/recursos_content";

export const alt = "TuLector Recursos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug } = await params;
  const article = articleContent[slug];

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", background: "#111827", color: "#fff", width: "100%", height: "100%", padding: 60, justifyContent: "space-between", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#22d3ee" }}>TuLector · Recursos</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 50, fontWeight: 800, lineHeight: 1.15 }}>{article?.title ?? "Recurso TuLector"}</div>
          {article && (
            <div style={{ display: "flex", fontSize: 28, color: "#9ca3af", maxWidth: "85%" }}>{article.resumenEjecutivo.slice(0, 140)}…</div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#6b7280" }}>{article?.author ?? "Equipo TuLector"}</div>
      </div>
    ),
    { ...size }
  );
}
