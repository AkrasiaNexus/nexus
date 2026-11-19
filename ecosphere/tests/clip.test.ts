import { describe, expect, it } from "vitest";
import labels from "@/lib/clipLabels.json";
import { classifyEmbedding } from "@/lib/clip";
import { PROMPT_LIST } from "@/lib/wasteLabels";
import head from "@/lib/scannerHead.json";

describe("on-device CLIP labels", () => {
  it("has one precomputed embedding per prompt, in the same order (rerun build-clip-labels if this fails)", () => {
    expect(labels.prompts).toEqual(PROMPT_LIST.map((p) => p.prompt));
    expect(labels.embeddings.every((e) => e.length === 512)).toBe(true);
  });
  it("maps an image that matches a phrase to that phrase's waste type", () => {
    const i = labels.prompts.indexOf("an aluminium drink can");
    const r = classifyEmbedding(labels.embeddings[i]);
    expect(r.wasteType).toBe("METAL");
    expect(r.label).toBe("aluminium drink can");
  });
  it("names the item with a phrase from the chosen bin and offers a different runner-up", () => {
    for (const e of labels.embeddings) {
      const r = classifyEmbedding(e);
      expect(PROMPT_LIST.some((p) => p.type === r.wasteType && p.prompt.replace(/^an? /, "") === r.label)).toBe(true);
      expect(r.runnerUp).not.toBe(r.wasteType);
      expect(r.unsure).toBe(r.confidence < head.unsure);
      expect(r.embedding).toHaveLength(512);
    }
  });
});
