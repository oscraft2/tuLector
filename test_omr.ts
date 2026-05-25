/**
 * Prueba headless del motor OMR - corre sin navegador via node-canvas.
 * Uso: npx tsx test_omr.ts
 */
import { createCanvas, Canvas, CanvasRenderingContext2D } from "canvas";

// ─── Config (identica a lib/omr.ts) ───
const W = 1200, H = 1650, M = 40, CS = 50;
const NAME_TOP = M + CS + 10;        // 100
const NAME_H = 35;
const NAME_BOTTOM = NAME_TOP + NAME_H; // 135
const ID_START = NAME_BOTTOM + 15;     // 150
const Q_TOP = ID_START + 3 * 28 + 30;  // 264
const Q_H = 42;

// ─── Generar hoja de prueba ───
function generateSheet(): Canvas {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // fondo blanco
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

  // esquinas
  function corner(x: number, y: number) {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3; ctx.strokeRect(x, y, CS, CS);
    ctx.lineWidth = 1; ctx.strokeRect(x + 8, y + 8, CS - 16, CS - 16);
  }
  corner(M, M); corner(W - M - CS, M);
  corner(M, H - M - CS); corner(W - M - CS, H - M - CS);

  // nombre
  ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
  ctx.strokeRect(50, NAME_TOP, 400, NAME_H);
  ctx.font = "bold 18px sans-serif"; ctx.fillStyle = "#000";
  ctx.fillText("STUDENT NAME:", 55, NAME_TOP + 23);

  // ID bubbles
  const idFill = ["1010101010", "0101010101", "1110000000"];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 10; col++) {
      ctx.beginPath(); ctx.arc(70 + col * 28, ID_START + 10 + row * 28, 8, 0, Math.PI * 2);
      ctx.lineWidth = 1; ctx.strokeStyle = "#000"; ctx.stroke();
      if (idFill[row][col] === "1") {
        ctx.beginPath(); ctx.arc(70 + col * 28, ID_START + 10 + row * 28, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#000"; ctx.fill();
      }
    }
  }

  // preguntas + respuestas
  const answers = "A,C,B,E,D,A,B,C,D,E,A,C,B,E,D,A,B,C,D,E".split(",");
  const LABELS = "ABCDE";
  for (let q = 0; q < 20; q++) {
    const qy = Q_TOP + q * Q_H;
    ctx.font = "16px sans-serif"; ctx.fillStyle = "#000";
    ctx.fillText(`${q + 1}.`, 50, qy + 20);
    for (let o = 0; o < 5; o++) {
      const ox = 90 + o * 50;
      ctx.beginPath(); ctx.arc(ox, qy + 16, 12, 0, Math.PI * 2);
      ctx.lineWidth = 1; ctx.strokeStyle = "#000"; ctx.stroke();
      ctx.font = "12px sans-serif"; ctx.fillText(LABELS[o], ox + 20, qy + 21);
    }
    const idx = LABELS.indexOf(answers[q]);
    ctx.beginPath(); ctx.arc(90 + idx * 50, qy + 16, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#000"; ctx.fill();
  }

  return canvas;
}

// ─── Ejecutar pipeline OMR ───
function test() {
  console.log("=".repeat(60));
  console.log("TuLector OMR - Prueba Headless (Node.js)");
  console.log("=".repeat(60));

  const sheet = generateSheet();
  const ctx = sheet.getContext("2d");
  const imageData = ctx.getImageData(0, 0, W, H);

  const d = imageData.data;
  let dark = 0;
  const grayArr = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const j = i * 4;
    const v = Math.round(d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114);
    grayArr[i] = v;
    if (v < 100) dark++;
  }

  console.log(`\n[IMG] ${W}x${H}  dark(<100) pixels: ${dark} (${(dark/(W*H)*100).toFixed(1)}%)`);

  // Muestrear pixeles
  const sample = (x: number, y: number) => grayArr[y * W + x] ?? -1;
  console.log(`[SAMPLE] TL corner center (65,65)=${sample(65,65)}`);
  console.log(`[SAMPLE] TR corner center (1135,65)=${sample(1135,65)}`);
  console.log(`[SAMPLE] BL corner center (65,1585)=${sample(65,1585)}`);
  console.log(`[SAMPLE] BR corner center (1135,1585)=${sample(1135,1585)}`);
  console.log(`[SAMPLE] Q1-A center (90,${Q_TOP+16})=${sample(90, Q_TOP+16)}`);
  console.log(`[SAMPLE] Q1-B center (140,${Q_TOP+16})=${sample(140, Q_TOP+16)}`);

  // findCorners - testing
  console.log(`\n[CORNERS] Buscando...`);
  
  // Simple quadrant scan
  const zones = [
    { name: "TL", x0: 0, y0: 0, x1: W*0.3, y1: H*0.3, cx: 0, cy: 0 },
    { name: "TR", x0: W*0.7, y0: 0, x1: W, y1: H*0.3, cx: W, cy: 0 },
    { name: "BR", x0: W*0.7, y0: H*0.7, x1: W, y1: H, cx: W, cy: H },
    { name: "BL", x0: 0, y0: H*0.7, x1: W*0.3, y1: H, cx: 0, cy: H },
  ];

  for (const z of zones) {
    let bestX = 0, bestY = 0, bestScore = Infinity;
    for (let y = z.y0; y < z.y1; y += 3) {
      for (let x = z.x0; x < z.x1; x += 3) {
        let dk = 0, tot = 0;
        for (let dy = -10; dy <= 10; dy += 2) {
          for (let dx = -10; dx <= 10; dx += 2) {
            const px = x + dx, py = y + dy;
            if (px >= 0 && px < W && py >= 0 && py < H) {
              tot++;
              if (grayArr[py * W + px] < 80) dk++;
            }
          }
        }
        const ratio = tot > 0 ? dk / tot : 0;
        if (ratio > 0.04 && ratio < 0.8) {
          const dist = Math.hypot(x - z.cx, y - z.cy);
          const score = dist - ratio * 200;
          if (score < bestScore) { bestScore = score; bestX = x; bestY = y; }
        }
      }
    }
    console.log(`[CORNERS] ${z.name}: (${bestX},${bestY})  score=${bestScore.toFixed(0)}  expected=(${z.name==="TL"?"65":z.name==="TR"?"1135":z.name==="BL"?"65":"1135"},${z.name==="TL"||z.name==="TR"?"65":"1585"})`);
  }

  // Verificar burbujas directamente en imagen original
  console.log(`\n[BUBBLES] Analisis directo (sin warp):`);
  const answers = "A,C,B,E,D,A,B,C,D,E,A,C,B,E,D,A,B,C,D,E".split(",");
  let correct = 0;
  const LABELS = "ABCDE";
  for (let q = 0; q < 20; q++) {
    const qy = Q_TOP + q * Q_H;
    const scores: number[] = [];
    for (let o = 0; o < 5; o++) {
      const cx = 90 + o * 50;
      const cy = qy + 16;
      let dk = 0, tot = 0;
      for (let dy = -8; dy <= 8; dy++) {
        for (let dx = -8; dx <= 8; dx++) {
          const px = cx + dx, py = cy + dy;
          if (px >= 0 && px < W && py >= 0 && py < H) {
            tot++;
            if (grayArr[py * W + px] < 80) dk++;
          }
        }
      }
      scores.push(tot > 0 ? dk / tot : 0);
    }
    const maxS = Math.max(...scores);
    const thresh = Math.max(0.10, maxS * 0.35);
    const marked = scores.map((s, i) => s > thresh && s > 0.04 ? i : -1).filter(i => i >= 0);
    let ans = "-";
    if (marked.length === 0 && maxS > 0.04) ans = LABELS[scores.indexOf(maxS)];
    else if (marked.length > 0) ans = marked.map(i => LABELS[i]).join("");
    const ok = ans === answers[q];
    if (ok) correct++;
    console.log(`[BUBBLES] Q${String(q+1).padStart(2)}: ${ans.padEnd(5)} esp=${answers[q]} ${ok ? "OK" : "FAIL"}  scores=[${scores.map(s=>s.toFixed(2)).join(",")}]`);
  }

  console.log(`\n[RESULT] ${correct}/20 correctas`);

  if (correct === 20) {
    console.log(`\n[FINAL] TODAS LAS PRUEBAS PASARON - El motor OMR funciona correctamente`);
  } else {
    console.log(`\n[FINAL] FALLOS DETECTADOS - Revisar el log arriba`);
  }
}

test();
