/**
 * Entrena el clasificador de burbuja (FASE 5) — regresión logística sobre los 4
 * features que `classifyBubble` ya calcula: [darkRatio, contrast, variance,
 * edgeDensity]. Aprende los pesos en vez de tunearlos a mano.
 *
 *   npx tsx scripts/train_classifier.ts dataset.json   (datos reales exportados)
 *   npx tsx scripts/train_classifier.ts --demo          (sintético, valida la cañería)
 *
 * Entrada: JSON array de { f: [4 numeros], y: 0|1 }  (y=1 → burbuja rellena).
 * Salida: imprime accuracy + la línea para pegar en src/tulector/classifier.ts.
 */
import { readFileSync } from "fs";

type Sample = { f: number[]; y: number };

function sigmoid(z: number): number { return 1 / (1 + Math.exp(-z)); }

/** Dataset sintético separable-con-ruido para validar el entrenamiento. */
function demoData(n = 4000): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const filled = Math.random() < 0.3;
    const noise = () => (Math.random() - 0.5) * 0.25;
    const f = filled
      ? [0.6 + noise(), 0.5 + noise(), 0.6 + noise(), 0.5 + noise()]
      : [0.12 + noise(), 0.1 + noise(), 0.15 + noise(), 0.1 + noise()];
    out.push({ f: f.map((v) => Math.max(0, v)), y: filled ? 1 : 0 });
  }
  return out;
}

function train(data: Sample[], dim: number, epochs = 300, lr = 0.5) {
  const mean = new Array(dim).fill(0), std = new Array(dim).fill(0);
  for (const s of data) for (let j = 0; j < dim; j++) mean[j] += s.f[j];
  for (let j = 0; j < dim; j++) mean[j] /= data.length;
  for (const s of data) for (let j = 0; j < dim; j++) std[j] += (s.f[j] - mean[j]) ** 2;
  for (let j = 0; j < dim; j++) std[j] = Math.sqrt(std[j] / data.length) || 1;

  const w = new Array(dim).fill(0); let b = 0;
  for (let e = 0; e < epochs; e++) {
    const gw = new Array(dim).fill(0); let gb = 0;
    for (const s of data) {
      const z = s.f.reduce((acc, v, j) => acc + w[j] * ((v - mean[j]) / std[j]), b);
      const err = sigmoid(z) - s.y;
      for (let j = 0; j < dim; j++) gw[j] += err * ((s.f[j] - mean[j]) / std[j]);
      gb += err;
    }
    for (let j = 0; j < dim; j++) w[j] -= (lr * gw[j]) / data.length;
    b -= (lr * gb) / data.length;
  }

  const W = w.map((wj, j) => wj / std[j]);
  const B = b - w.reduce((acc, wj, j) => acc + (wj * mean[j]) / std[j], 0);

  let correct = 0;
  for (const s of data) {
    const p = sigmoid(s.f.reduce((acc, v, j) => acc + W[j] * v, B));
    if ((p >= 0.5 ? 1 : 0) === s.y) correct++;
  }
  return { W, B, acc: correct / data.length };
}

const arg = process.argv[2];
const data: Sample[] = arg === "--demo" || !arg ? demoData() : JSON.parse(readFileSync(arg, "utf8"));
if (data.length < 50) { console.error(`Pocos datos (${data.length}). Acumula más 'Confirmar lectura'.`); process.exit(1); }

const dim = data[0].f.length;
const { W, B, acc } = train(data, dim);
console.log(`Entrenado con ${data.length} ejemplos · accuracy=${(acc * 100).toFixed(1)}%`);
console.log(`\nPega en src/tulector/classifier.ts:`);
console.log(`export const CLASSIFIER = { w: [${W.map((v) => +v.toFixed(4)).join(", ")}], b: ${+B.toFixed(4)} };`);
