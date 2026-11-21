import labels from "./clipLabels.json";
import head from "./scannerHead.json";
import { PROMPT_LIST } from "./wasteLabels";
import { predict } from "./headTrainer";
import type { WasteType } from "./types";

// CLIP zero-shot on-device: the label text was embedded ahead of time (scripts/build-clip-labels.mts),
// so the browser only runs the image half; a small trained head on top picks the bin.
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

// Zero-shot: softmax over every phrase. Only names the item now ("plastic bottle"); the trained head picks the bin.
function phraseScores(img: number[]) {
  const logits = labels.embeddings.map((t) => LOGIT_SCALE * t.reduce((s, x, i) => s + x * img[i], 0));
  const max = Math.max(...logits);
  const exp = logits.map((l) => Math.exp(l - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return labels.prompts.map((label, i) => ({ label, score: exp[i] / sum }));
}

export function classifyEmbedding(imageEmbed: ArrayLike<number>) {
  const img = norm(imageEmbed);
  const phrases = phraseScores(img);
  const typeOf = (label: string) => PROMPT_LIST.find((x) => x.prompt === label)!.type;
  // Blend in zero-shot so items missing from the training photos (books, phones, cables) still get a fair guess.
  const zs = head.types.map((t) => phrases.reduce((s, p) => (typeOf(p.label) === t ? s + p.score : s), 0));
  const probs = predict(head, img).map((p, k) => (1 - head.zeroShotMix) * p + head.zeroShotMix * zs[k]); // trained head: scripts/retrain-scanner.mts
  const [first, second] = probs.map((p, k) => ({ type: head.types[k] as WasteType, p })).sort((a, b) => b.p - a.p);
  // Name the item with the best phrase inside the chosen bin, so the label never contradicts the bin.
  const inBin = phrases.filter((p) => typeOf(p.label) === first.type).sort((a, b) => b.score - a.score);
  const label = (inBin[0]?.label ?? first.type.toLowerCase()).replace(/^an? /, "");
  return { wasteType: first.type, label, confidence: first.p, runnerUp: second.type, unsure: first.p < head.unsure, embedding: img };
}
