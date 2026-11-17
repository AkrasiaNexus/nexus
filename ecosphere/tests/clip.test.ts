import { describe, expect, it } from "vitest";
import labels from "@/lib/clipLabels.json";
import { classifyEmbedding } from "@/lib/clip";
import { PROMPT_LIST, bestType } from "@/lib/wasteLabels";

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
  it("scores a type by summing its phrases", () => {
    const r = bestType([{ label: "a plastic bottle", score: 0.3 }, { label: "a plastic bag", score: 0.3 }, { label: "a glass bottle", score: 0.4 }]);
    expect(r).toMatchObject({ wasteType: "PLASTIC", label: "plastic bottle" });
    expect(r.confidence).toBeCloseTo(0.6);
  });
});
