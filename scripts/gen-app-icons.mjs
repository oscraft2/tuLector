// Genera los archivos fuente en assets/ para @capacitor/assets con el branding
// oficial de tuLector: badge #111827 + "TL" blanco (mismo que TuLectorLogo.tsx).
// Las letras van como paths SVG (no <text>) para no depender de fuentes del SO.
// Luego correr: npx @capacitor/assets generate --android
import sharp from "sharp";
import { mkdirSync, rmSync } from "node:fs";

// Glifo "TL": bbox 640x400 centrado en un lienzo `size`, escalado por `scale`.
function tlGlyph(size, scale, withBackground) {
  const s = (1024 / size) / scale; // el viewBox se mantiene en coords 1024
  const view = 1024 * s;
  const off = (view - 1024) / 2;
  const bg = withBackground ? `<rect x="${-off}" y="${-off}" width="${view}" height="${view}" fill="#111827"/>` : "";
  return `
<svg width="${size}" height="${size}" viewBox="${-off} ${-off} ${view} ${view}" xmlns="http://www.w3.org/2000/svg">
  ${bg}
  <g fill="#ffffff">
    <rect x="190" y="312" width="280" height="92" rx="14"/>
    <rect x="284" y="312" width="92" height="400" rx="14"/>
    <rect x="560" y="312" width="92" height="400" rx="14"/>
    <rect x="560" y="620" width="272" height="92" rx="14"/>
  </g>
</svg>`;
}

rmSync("assets", { recursive: true, force: true });
mkdirSync("assets", { recursive: true });

// Ícono legacy: fondo oscuro + TL grande.
await sharp(Buffer.from(tlGlyph(1024, 0.72, true))).png().toFile("assets/icon.png");
// Adaptativo: foreground TL chico (zona segura = círculo central ~66%) + fondo sólido.
await sharp(Buffer.from(tlGlyph(1024, 0.42, false))).png().toFile("assets/icon-foreground.png");
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: "#111827" } })
  .png().toFile("assets/icon-background.png");
// Splash 2732x2732: fondo oscuro + TL al centro.
await sharp(Buffer.from(tlGlyph(2732, 0.28, true))).png().toFile("assets/splash.png");
await sharp(Buffer.from(tlGlyph(2732, 0.28, true))).png().toFile("assets/splash-dark.png");
console.log("assets/: icon, icon-foreground, icon-background, splash, splash-dark generados");
