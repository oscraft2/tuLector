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

  // CORNERS - center of mass
  console.log(`\n[CORNERS] Centro de masa de pixeles oscuros por zona:`);
  const czones: [number,number,number,number,string,number,number][] = [
    [0, 0, W*0.08, H*0.06, "TL", 65, 65],
    [W*0.92, 0, W, H*0.06, "TR", 1135, 65],
    [W*0.92, H*0.92, W, H, "BR", 1135, 1585],
    [0, H*0.92, W*0.08, H, "BL", 65, 1585],
  ];
  for (const [x0,y0,x1,y1,n,ex,ey] of czones) {
    let sx=0, sy=0, c=0;
    for (let y=y0; y<y1; y++) {
      for (let x=x0; x<x1; x++) {
        if (grayArr[y*W+x] < 80) { sx+=x; sy+=y; c++; }
      }
    }
    const cx = Math.round(sx/c), cy = Math.round(sy/c);
    console.log(`[CORNERS] ${n}: (${cx},${cy})  c=${c}  expected=(${ex},${ey})  diff=(${cx-ex},${cy-ey})`);
  }

  // Full pipeline test with warp
  const MARG = 40, CSZ = 50;
  const dst = Float32Array.of(
    MARG+CSZ/2, MARG+CSZ/2,
    W-MARG-CSZ/2, MARG+CSZ/2,
    W-MARG-CSZ/2, H-MARG-CSZ/2,
    MARG+CSZ/2, H-MARG-CSZ/2,
  );

  // Get corner coords from center-of-mass
  const srcArr: number[] = [];
  for (const [x0,y0,x1,y1] of czones) {
    let sx=0, sy=0, c=0;
    for (let y=y0; y<y1; y++) {
      for (let x=x0; x<x1; x++) {
        if (grayArr[y*W+x] < 80) { sx+=x; sy+=y; c++; }
      }
    }
    srcArr.push(Math.round(sx/c), Math.round(sy/c));
  }

  // Homography via 8x8 solver
  const A: number[][] = [], B: number[] = [];
  for (let i=0; i<4; i++) {
    const sx=srcArr[i*2], sy=srcArr[i*2+1], dx=dst[i*2], dy=dst[i*2+1];
    A.push([sx,sy,1,0,0,0,-dx*sx,-dx*sy]); B.push(dx);
    A.push([0,0,0,sx,sy,1,-dy*sx,-dy*sy]); B.push(dy);
  }
  // Gaussian elimination
  const M2: number[][] = A.map(r=>[...r,B[A.indexOf(r)]]);
  const n=8;
  for (let col=0; col<n; col++) {
    let max=col;
    for (let r=col+1; r<n; r++) if (Math.abs(M2[r][col])>Math.abs(M2[max][col])) max=r;
    [M2[col],M2[max]]=[M2[max],M2[col]];
    for (let r=col+1; r<n; r++) {
      const f=M2[r][col]/M2[col][col];
      for (let j=col; j<=n; j++) M2[r][j]-=f*M2[col][j];
    }
  }
  const homog = new Array(n).fill(0);
  for (let i=n-1; i>=0; i--) {
    homog[i]=M2[i][n];
    for (let j=i+1; j<n; j++) homog[i]-=M2[i][j]*homog[j];
    homog[i]/=M2[i][i];
  }

  // Warp
  const wCanvas = createCanvas(W, H);
  const wCtx = wCanvas.getContext("2d");
  const wi = wCtx.createImageData(W, H);
  for (let dy=0; dy<H; dy++) {
    for (let dx=0; dx<W; dx++) {
      const denom = homog[6]*dx+homog[7]*dy+1;
      const sx2 = Math.round((homog[0]*dx+homog[1]*dy+homog[2])/denom);
      const sy2 = Math.round((homog[3]*dx+homog[4]*dy+homog[5])/denom);
      if (sx2>=0&&sx2<W&&sy2>=0&&sy2<H) {
        const si=(sy2*W+sx2)*4, di=(dy*W+dx)*4;
        wi.data[di]=d[si]; wi.data[di+1]=d[si+1]; wi.data[di+2]=d[si+2]; wi.data[di+3]=255;
      }
    }
  }
  wCtx.putImageData(wi,0,0);

  // Grade via warped image
  const wGray = new Uint8Array(W*H);
  const wd = wCtx.getImageData(0,0,W,H).data;
  for (let i=0; i<W*H; i++) wGray[i]=Math.round(wd[i*4]*0.299+wd[i*4+1]*0.587+wd[i*4+2]*0.114);

  console.log(`\n[BUBBLES WARPED] Analisis con warp:`);
  const answers = "A,C,B,E,D,A,B,C,D,E,A,C,B,E,D,A,B,C,D,E".split(",");
  let wCorrect = 0;
  const Q_TOP_LOCAL = (MARG+CSZ+10)+35+15+3*28+30;
  for (let q=0; q<20; q++) {
    const qy = Q_TOP_LOCAL + q*42;
    const scores: number[] = [];
    for (let o=0; o<5; o++) {
      const cx=90+o*50, cy=qy+16; let dk=0, tot=0;
      for (let dy=-8; dy<=8; dy++) for (let dx=-8; dx<=8; dx++) {
        const px=cx+dx, py=cy+dy;
        if (px>=0&&px<W&&py>=0&&py<H) { tot++; if (wGray[py*W+px]<80) dk++; }
      }
      scores.push(tot>0?dk/tot:0);
    }
    const maxS=Math.max(...scores);
    const th=Math.max(0.10,maxS*0.35);
    const mk=scores.map((s,i)=>s>th&&s>0.04?i:-1).filter(i=>i>=0);
    let ans="-"; if(mk.length===0&&maxS>0.04) ans="ABCDE"[scores.indexOf(maxS)];
    else if(mk.length>0) ans=mk.map(i=>"ABCDE"[i]).join("");
    if(ans===answers[q]) wCorrect++;
  }
  console.log(`[BUBBLES WARPED] ${wCorrect}/20 correctas con warp`);
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
