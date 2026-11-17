import labels from "./clipLabels.json";
import { bestType } from "./wasteLabels";

// CLIP zero-shot on-device: the label text was embedded ahead of time (scripts/build-clip-labels.mts),
// so the browser only runs the image half and compares embeddings here.
export const CLIP_MODEL = "Xenova/clip-vit-base-patch32";
// Keep in step with the devDependency version (used by scripts/build-clip-labels.mts).
export const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js";
const LOGIT_SCALE = 100; // CLIP's learned temperature (exp(4.6052))

const norm = (v: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  return Array.from(v, (x) => x / n);
};

// Softmax over every phrase, then collapse to the best waste type.
export function classifyEmbedding(imageEmbed: ArrayLike<number>) {
  const img = norm(imageEmbed);
  const logits = labels.embeddings.map((t) => LOGIT_SCALE * t.reduce((s, x, i) => s + x * img[i], 0));
  const max = Math.max(...logits);
  const exp = logits.map((l) => Math.exp(l - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return bestType(labels.prompts.map((label, i) => ({ label, score: exp[i] / sum })));
}
