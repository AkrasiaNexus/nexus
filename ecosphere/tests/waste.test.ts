import { describe, expect, it } from "vitest";
import { classify, impact, mapLabel } from "@/lib/waste";

describe("mapLabel", () => {
  it.each([
    ["water bottle", "PLASTIC"],
    ["beer bottle", "GLASS"],
    ["wine bottle", "GLASS"],
    ["banana", "ORGANIC"],
    ["Granny Smith", "ORGANIC"],
    ["cellular telephone, cellphone, mobile phone", "EWASTE"],
    ["carton", "PAPER"],
    ["jersey, T-shirt, tee shirt", "TEXTILE"],
    ["tiger cat", "OTHER"],
  ])("maps %s to %s", (label, type) => expect(mapLabel(label)).toBe(type));

  it("does not match partial words", () => {
    expect(mapLabel("candle")).toBe("OTHER"); // contains "can"
    expect(mapLabel("pot, flowerpot")).toBe("OTHER");
  });
});

describe("classify", () => {
  it("skips unmapped top guesses for the best waste match", () => {
    const r = classify([{ className: "tiger cat", probability: 0.5 }, { className: "water bottle", probability: 0.3 }]);
    expect(r).toEqual({ wasteType: "PLASTIC", label: "water bottle", confidence: 0.3 });
  });

  it("ignores near-zero matches", () => {
    const r = classify([{ className: "tiger cat", probability: 0.9 }, { className: "iron", probability: 0.01 }]);
    expect(r.wasteType).toBe("OTHER");
  });

  it("falls back to OTHER with the top label", () => {
    expect(classify([{ className: "tiger cat, cat", probability: 0.9 }])).toMatchObject({ wasteType: "OTHER", label: "tiger cat" });
  });

  it("handles empty predictions", () => {
    expect(classify([]).wasteType).toBe("OTHER");
  });
});

describe("impact", () => {
  it("sums weight, CO2, water and recycling rate", () => {
    const r = impact([
      { wasteType: "PLASTIC", weightKg: 2 },
      { wasteType: "OTHER", weightKg: 2 },
    ]);
    expect(r).toMatchObject({ kg: 4, co2: 3, water: 34, recyclingRate: 50 });
  });

  it("returns zeros for no scans", () => {
    expect(impact([])).toEqual({ kg: 0, co2: 0, water: 0, trees: 0, recyclingRate: 0 });
  });
});

import { heatmapGrid } from "@/lib/charts";

describe("heatmapGrid", () => {
  it("buckets by week and weekday", () => {
    const now = new Date(2026, 10, 13, 12); // Friday
    const grid = heatmapGrid([
      { weightKg: 1, createdAt: new Date(2026, 10, 13, 9) }, // this Fri
      { weightKg: 2, createdAt: new Date(2026, 10, 9, 9) }, // this Mon
      { weightKg: 5, createdAt: new Date(2026, 9, 1) }, // too old
    ], 2, now);
    expect(grid).toEqual([[0, 0, 0, 0, 0, 0, 0], [2, 0, 0, 0, 1, 0, 0]]);
  });
});

import { periodRange, seriesFor } from "@/lib/charts";

describe("periods", () => {
  const now = new Date(2026, 10, 13, 12); // Fri 13 Nov 2026
  it("week starts Monday and shifts by offset", () => {
    expect(periodRange("week", 0, now).start).toEqual(new Date(2026, 10, 9));
    expect(periodRange("week", -1, now).start).toEqual(new Date(2026, 10, 2));
  });
  it("month and year ranges", () => {
    expect(periodRange("month", -1, now)).toEqual({ start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) });
    expect(periodRange("year", 0, now).end).toEqual(new Date(2027, 0, 1));
  });
  it("series sums per bucket", () => {
    const s = seriesFor("week", new Date(2026, 10, 9), [{ weightKg: 1.5, createdAt: new Date(2026, 10, 10, 9) }]);
    expect(s.map((x) => x.value)).toEqual([0, 1.5, 0, 0, 0, 0, 0]);
    expect(seriesFor("month", new Date(2026, 10, 1), [])).toHaveLength(5);
  });
  it("flags buckets after now as future so the line stops at today", () => {
    const s = seriesFor("week", new Date(2026, 10, 16), [], new Date(2026, 10, 18, 12));
    expect(s.map((x) => x.future)).toEqual([false, false, false, true, true, true, true]);
  });
});

import { changePct, seriesBetween } from "@/lib/charts";

describe("day period, custom ranges, comparisons", () => {
  const now = new Date(2026, 10, 13, 12);
  it("day range is midnight to midnight; series has 4-hour buckets", () => {
    expect(periodRange("day", -1, now)).toEqual({ start: new Date(2026, 10, 12), end: new Date(2026, 10, 13) });
    const s = seriesFor("day", new Date(2026, 10, 13), [{ weightKg: 2, createdAt: new Date(2026, 10, 13, 9) }]);
    expect(s.map((x) => x.value)).toEqual([0, 0, 2, 0, 0, 0]);
  });
  it("picks bucket size from the range length", () => {
    expect(seriesBetween(new Date(2026, 0, 1), new Date(2026, 0, 11), [])).toHaveLength(10);
    expect(seriesBetween(new Date(2026, 0, 1), new Date(2026, 3, 1), []).length).toBeLessThanOrEqual(13);
  });
  it("changePct handles no baseline", () => {
    expect(changePct(15, 10)).toBe(50);
    expect(changePct(5, 0)).toBeNull();
  });
});
