// Seeded random transit networks for differential testing and benchmarks.
import { buildTimetable } from "../src/timetable.js";

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A city of `side` x `side` stops about 450 m apart (so some, not all, are walkable),
 * with routes that wander across the grid. Some trips are express services that
 * overtake slower ones, which forces the pattern splitter to do its job.
 */
export function randomNetwork(seed, { side = 8, routes = 10, tripsPerRoute = 12, minLen = 3, maxLen = 9 } = {}) {
  const rand = mulberry32(seed);
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const stops = [];
  for (let r = 0; r < side; r++) {
    for (let c = 0; c < side; c++) {
      stops.push({ id: `s${r}_${c}`, name: `Stop ${r}-${c}`, lat: 24.40 + r * 0.004 + rand() * 0.0005, lon: 54.30 + c * 0.0045 + rand() * 0.0005 });
    }
  }

  const trips = [];
  for (let ri = 0; ri < routes; ri++) {
    const len = int(minLen, maxLen);
    let r = int(0, side - 1), c = int(0, side - 1);
    const seq = [r * side + c];
    const seen = new Set(seq);
    for (let tries = 0; seq.length < len && tries < 50; tries++) {
      const [dr, dc] = [[1, 0], [-1, 0], [0, 1], [0, -1]][int(0, 3)];
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= side || nc >= side || seen.has(nr * side + nc)) continue;
      r = nr; c = nc;
      seq.push(r * side + c);
      seen.add(r * side + c);
    }
    if (seq.length < 2) continue;

    let start = 6 * 3600 + int(0, 1800);
    for (let t = 0; t < tripsPerRoute; t++) {
      const express = rand() < 0.15;
      const arr = [], dep = [];
      let clock = start;
      for (let i = 0; i < seq.length; i++) {
        if (i > 0) clock += express ? int(40, 90) : int(90, 300);
        arr.push(clock);
        clock += i < seq.length - 1 ? int(0, 30) : 0;
        dep.push(clock);
      }
      trips.push({ id: `r${ri}_t${t}`, route: `R${ri}`, routeName: `${ri}`, stops: seq, arr, dep });
      start += int(240, 1200);
    }
  }
  return { stops, trips, timetable: buildTimetable({ stops, trips }) , rand };
}
