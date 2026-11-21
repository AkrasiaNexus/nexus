// Re-run after editing src/lib/wasteLabels.ts:  npx tsx scripts/build-clip-labels.mts
import { writeFileSync } from "fs";
import { AutoTokenizer, CLIPTextModelWithProjection } from "@huggingface/transformers";
const L = await import("../src/lib/wasteLabels.ts");
const { PROMPT_LIST } = (L.PROMPT_LIST ? L : L.default) as typeof import("../src/lib/wasteLabels.ts");
const MODEL = "Xenova/clip-vit-base-patch32";
const prompts = PROMPT_LIST.map((p) => p.prompt);
const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
const model = await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: "fp32" });
const { text_embeds } = await model(tokenizer(prompts.map((p) => `a photo of ${p}`), { padding: true, truncation: true }));
const dim = text_embeds.dims[1];
const data = text_embeds.data as Float32Array;
const embeddings = prompts.map((_, i) => {
  const v = Array.from(data.slice(i * dim, (i + 1) * dim));
  const n = Math.hypot(...v);
  return v.map((x) => Math.round((x / n) * 1e4) / 1e4);
});
writeFileSync(new URL("../src/lib/clipLabels.json", import.meta.url), JSON.stringify({ model: MODEL, prompts, embeddings }));
console.log(`wrote ${prompts.length} label embeddings (${dim}-d)`);
