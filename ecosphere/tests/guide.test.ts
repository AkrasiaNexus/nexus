import { describe, expect, it } from "vitest";
import { TOPICS, searchGuide } from "@/lib/guide";

describe("guide search", () => {
  it("finds a topic by an example item and reports the match", () => {
    expect(searchGuide("charger")).toEqual([{ topic: "EWASTE", hit: "Chargers and cables" }]);
  });
  it("matches topic names case-insensitively, including guide-only food", () => {
    expect(searchGuide("FOOD").map((r) => r.topic)).toContain("FOOD");
  });
  it("returns nothing for blank queries", () => {
    expect(searchGuide("   ")).toEqual([]);
  });
  it("lists every topic once", () => {
    expect(new Set(TOPICS).size).toBe(TOPICS.length);
  });
});
