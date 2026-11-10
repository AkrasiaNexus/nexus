// Connection Scan Algorithm (Dibbelt, Pajor, Strasser & Wagner, 2013).
// A second, independent earliest-arrival algorithm. Majlis only uses it as a
// test oracle: RAPTOR must agree with it on every stop of every random network.
//
// Same journey rule as RAPTOR: walk once from the origin and once after each
// ride, so walks start only from vehicle drop-offs (bestRide), while boarding
// may use any arrival (best).
import { connections } from "./timetable.js";

export function connectionScan(timetable, sources, sorted = connections(timetable)) {
  const n = timetable.stops.length;
  const best = new Array(n).fill(Infinity);
  const bestRide = new Array(n).fill(Infinity);
  for (const { stop, time } of sources) best[stop] = Math.min(best[stop], time);
  const onTrip = new Set();

  for (const c of sorted) {
    if (!onTrip.has(c.trip) && best[c.from] > c.dep) continue;
    onTrip.add(c.trip);
    if (c.arr >= bestRide[c.to]) continue;
    bestRide[c.to] = c.arr;
    if (c.arr < best[c.to]) best[c.to] = c.arr;
    for (const { to, seconds } of timetable.transfers[c.to]) {
      if (c.arr + seconds < best[to]) best[to] = c.arr + seconds;
    }
  }
  return best;
}
