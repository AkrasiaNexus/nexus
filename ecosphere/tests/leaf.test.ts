import { describe, expect, it } from "vitest";
import { buildLeaf, halfWidth, veinFill } from "@/lib/leaf";

const { blade, veins } = buildLeaf();

describe("leaf geometry", () => {
  it("is a closed ovate blade: zero width at base and tip, widest in the lower half", () => {
    expect(blade.endsWith("Z")).toBe(true);
    expect(halfWidth(0)).toBe(0);
    expect(halfWidth(1)).toBe(0);
    const widest = [0.2, 0.3, 0.4, 0.5, 0.6, 0.8].reduce((a, b) => (halfWidth(b) > halfWidth(a) ? b : a));
    expect(widest).toBeLessThanOrEqual(0.5);
  });

  it("has petiole, midrib, 16 laterals with branches and two margin halves", () => {
    const count = (k: string) => veins.filter((v) => v.kind === k).length;
    expect([count("petiole"), count("midrib"), count("lateral"), count("margin")]).toEqual([1, 1, 16, 2]);
    expect(count("branch")).toBeGreaterThanOrEqual(16);
  });

  it("finishes every vein by 100% and lights them stalk-first", () => {
    for (const v of veins) expect(v.start + v.len).toBeLessThanOrEqual(1.0001);
    const laterals = veins.filter((v) => v.kind === "lateral");
    expect(laterals.map((v) => v.start)).toEqual([...laterals.map((v) => v.start)].sort((a, b) => a - b));
    expect(veins[0].kind).toBe("petiole");
  });
});

describe("veinFill", () => {
  it("is 0 before the sap arrives, partial while filling, 1 after", () => {
    const v = { start: 0.5, len: 0.2 };
    expect(veinFill(0.4, v)).toBe(0);
    expect(veinFill(0.6, v)).toBeCloseTo(0.5);
    expect(veinFill(0.9, v)).toBe(1);
  });
});
