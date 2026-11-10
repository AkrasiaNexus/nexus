// The in-memory timetable RAPTOR works on.
//
// A "pattern" is a set of trips that visit exactly the same stops in the same
// order and never overtake each other, so the first trip you can catch at a
// stop is also the first to reach every later stop. That property is what lets
// RAPTOR scan a pattern once instead of every trip.
import { nearbyStops } from "./geo.js";

export function buildTimetable({ stops, trips, footpaths = null, walk }) {
  const byKey = new Map();
  for (const trip of trips) {
    const key = `${trip.route}|${trip.stops.join(",")}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(trip);
  }

  const patterns = [];
  for (const group of byKey.values()) {
    group.sort((a, b) => a.dep[0] - b.dep[0]);
    const buckets = [];
    for (const trip of group) {
      const bucket = buckets.find((b) => !overtakes(b[b.length - 1], trip));
      if (bucket) bucket.push(trip);
      else buckets.push([trip]);
    }
    for (const bucket of buckets) {
      patterns.push({ route: bucket[0].route, routeName: bucket[0].routeName, stops: bucket[0].stops, trips: bucket });
    }
  }

  const stopPatterns = stops.map(() => []);
  patterns.forEach((pattern, pi) => {
    const seen = new Set();
    pattern.stops.forEach((stop, pos) => {
      if (seen.has(stop)) return;
      seen.add(stop);
      stopPatterns[stop].push([pi, pos]);
    });
  });

  const transfers = footpaths ?? generateFootpaths(stops, walk);
  return { stops, patterns, stopPatterns, transfers };
}

function overtakes(earlier, later) {
  return later.dep.some((d, i) => d < earlier.dep[i]) || later.arr.some((a, i) => a < earlier.arr[i]);
}

export function generateFootpaths(stops, walk) {
  return stops.map((stop, i) =>
    nearbyStops(stop, stops, walk).filter((n) => n.stop !== i).map((n) => ({ to: n.stop, seconds: n.seconds })),
  );
}

export function connections(timetable) {
  const out = [];
  timetable.patterns.forEach((pattern) => {
    for (const trip of pattern.trips) {
      for (let i = 0; i + 1 < pattern.stops.length; i++) {
        out.push({ from: pattern.stops[i], to: pattern.stops[i + 1], dep: trip.dep[i], arr: trip.arr[i + 1], trip });
      }
    }
  });
  return out.sort((a, b) => a.dep - b.dep);
}
