import { ImageResponse } from "next/og";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";

export const alt = "TuLector para Colegios";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", background: "#111827", color: "#fff", width: "100%", height: "100%", padding: 60, justifyContent: "space-between", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#22d3ee" }}>TuLector</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 24, color: "#22d3ee", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Para Colegios</div>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 800, lineHeight: 1.15 }}>{copy.paraColegios.h1}</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#6b7280" }}>{copy.countryName} · {copy.nationalExam}</div>
      </div>
    ),
    { ...size }
  );
}
