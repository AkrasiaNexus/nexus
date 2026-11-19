import { describe, expect, it } from "vitest";
import { DIM, predict, trainHead } from "@/lib/headTrainer";

// Three clusters on the unit sphere, like CLIP embeddings of three bins.
function cluster(seed: number, n: number) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  const centre = Array.from({ length: DIM }, rnd);
  return Array.from({ length: n }, () => {
    const v = centre.map((c) => c + rnd() * 0.6);
    const len = Math.hypot(...v);
    return v.map((x) => x / len);
  });
}

describe("scanner head trainer", () => {
  it("learns to separate bins it was shown", () => {
    // Arrange
    const groups = [cluster(1, 40), cluster(2, 40), cluster(3, 40)];
    const X = new Float32Array(groups.flat(2));
    const y = Uint8Array.from(groups.flatMap((g, k) => g.map(() => k)));
    // Act
    const head = { ...trainHead(X, y, 3, { epochs: 60 }), scale: 30 };
    // Assert
    const fresh = [cluster(1, 5), cluster(2, 5), cluster(3, 5)];
    fresh.forEach((g, k) => g.forEach((x) => { const p = predict(head, x); expect(p.indexOf(Math.max(...p))).toBe(k); }));
  });

  it("returns probabilities that sum to 1", () => {
    const p = predict({ W: [[1, 0], [0, 1]], b: [0, 0], scale: 30 }, [0.6, 0.8]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(p[1]).toBeGreaterThan(p[0]);
  });
});
