// Softmax regression over L2-normalised CLIP image embeddings: the scanner's trained head.
// Full-batch Adam, class-balanced, L2 weight decay. Used by scripts/retrain-scanner.mts; small enough to run on a laptop CPU.
export const DIM = 512;
export const SCALE = 30; // fixed logit temperature: embeddings are unit length, so raw dot products are small

export type Head = { types: string[]; scale: number; W: number[][]; b: number[]; unsure: number };

export function trainHead(X: Float32Array, y: Uint8Array, k: number, opts: { lam?: number; epochs?: number; weight?: Float32Array } = {}) {
  const { lam = 1e-3, epochs = 300 } = opts;
  const n = y.length;
  const counts = new Array(k).fill(0);
  y.forEach((c) => counts[c]++);
  // Class-balanced sample weights, times any per-row weight (e.g. user corrections count extra).
  const sw = Float32Array.from(y, (c, i) => (n / (k * Math.max(1, counts[c]))) * (opts.weight?.[i] ?? 1));
  const swSum = sw.reduce((a, b) => a + b, 0);
  const W = new Float32Array(DIM * k), b = new Float32Array(k);
  const mW = new Float32Array(DIM * k), vW = new Float32Array(DIM * k), mb = new Float32Array(k), vb = new Float32Array(k);
  const z = new Float32Array(k), gW = new Float32Array(DIM * k), gb = new Float32Array(k);
  for (let t = 1; t <= epochs; t++) {
    gW.fill(0); gb.fill(0);
    for (let i = 0; i < n; i++) {
      const x = X.subarray(i * DIM, (i + 1) * DIM);
      let max = -Infinity;
      for (let c = 0; c < k; c++) {
        let s = b[c];
        for (let d = 0; d < DIM; d++) s += SCALE * x[d] * W[d * k + c];
        z[c] = s; if (s > max) max = s;
      }
      let sum = 0;
      for (let c = 0; c < k; c++) { z[c] = Math.exp(z[c] - max); sum += z[c]; }
      for (let c = 0; c < k; c++) {
        const g = ((z[c] / sum) - (y[i] === c ? 1 : 0)) * sw[i] / swSum;
        gb[c] += g;
        for (let d = 0; d < DIM; d++) gW[d * k + c] += SCALE * x[d] * g;
      }
    }
    for (let j = 0; j < W.length; j++) gW[j] += lam * W[j];
    adam(W, gW, mW, vW, t); adam(b, gb, mb, vb, t);
  }
  // Row-major per class, the shape src/lib/clip.ts reads.
  return { W: Array.from({ length: k }, (_, c) => Array.from({ length: DIM }, (_, d) => W[d * k + c])), b: Array.from(b) };
}

function adam(p: Float32Array, g: Float32Array, m: Float32Array, v: Float32Array, t: number, lr = 0.005) {
  for (let j = 0; j < p.length; j++) {
    m[j] = 0.9 * m[j] + 0.1 * g[j];
    v[j] = 0.999 * v[j] + 0.001 * g[j] * g[j];
    p[j] -= (lr * (m[j] / (1 - 0.9 ** t))) / (Math.sqrt(v[j] / (1 - 0.999 ** t)) + 1e-8);
  }
}

export function predict(head: Pick<Head, "W" | "b" | "scale">, x: ArrayLike<number>) {
  const z = head.W.map((row, c) => head.b[c] + head.scale * row.reduce((s, w, d) => s + w * x[d], 0));
  const max = Math.max(...z);
  const e = z.map((v) => Math.exp(v - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}
