// RAPTOR: Round-bAsed Public Transit Optimized Router
// (Delling, Pajor & Werneck, "Round-Based Public Transit Routing", 2012).
//
// Round k finds the earliest arrival at every stop using at most k vehicles.
// Each round scans every pattern touched by a stop improved in the previous
// round, then relaxes walking transfers.
//
// Journey rule: you may walk once from your origin, and once after each ride.
// The paper assumes footpaths are transitively closed, which radius-based
// footpaths are not, so every stop keeps two times: when a vehicle can drop you
// there (walks start only from these) and when you can be there at all
// (boarding uses these). Without the split, walks chain or get missed.
const INF = Infinity;

/**
 * @param timetable from buildTimetable
 * @param sources   [{ stop, time }] stops reachable from the origin and when
 * @param maxRounds maximum number of vehicles in one journey
 * @returns { best, rounds, labels, rideLabels } best[stop] = earliest arrival (seconds)
 */
export function raptor(timetable, sources, maxRounds = 8) {
  const n = timetable.stops.length;
  const best = new Array(n).fill(INF);
  const bestRide = new Array(n).fill(INF);
  const rounds = [new Array(n).fill(INF)];
  const labels = [new Array(n).fill(null)];
  const rideLabels = [new Array(n).fill(null)];
  let marked = new Set();

  for (const { stop, time } of sources) {
    if (time < rounds[0][stop]) {
      rounds[0][stop] = time;
      best[stop] = time;
      labels[0][stop] = { type: "origin", time };
      marked.add(stop);
    }
  }

  for (let k = 1; k <= maxRounds && marked.size; k++) {
    const prev = rounds[k - 1];
    const cur = new Array(n).fill(INF);
    const lab = new Array(n).fill(null);
    const rideLab = new Array(n).fill(null);
    rounds.push(cur);
    labels.push(lab);
    rideLabels.push(rideLab);

    const queue = new Map();
    for (const stop of marked) {
      for (const [pi, pos] of timetable.stopPatterns[stop]) {
        if (!queue.has(pi) || pos < queue.get(pi)) queue.set(pi, pos);
      }
    }

    const nextMarked = new Set();
    const dropOffs = [];
    for (const [pi, start] of queue) {
      const pattern = timetable.patterns[pi];
      let trip = null;
      let boardPos = -1;
      for (let i = start; i < pattern.stops.length; i++) {
        const stop = pattern.stops[i];
        if (trip) {
          const arr = trip.arr[i];
          if (arr < bestRide[stop]) {
            const label = { type: "ride", pattern: pi, trip, boardPos, alightPos: i, boardStop: pattern.stops[boardPos] };
            bestRide[stop] = arr;
            rideLab[stop] = label;
            dropOffs.push([stop, arr]);
            if (arr < best[stop]) {
              best[stop] = arr;
              cur[stop] = arr;
              lab[stop] = label;
              nextMarked.add(stop);
            }
          }
        }
        if (prev[stop] < INF && (!trip || prev[stop] <= trip.dep[i])) {
          const t = earliestTrip(pattern, i, prev[stop]);
          if (t && t !== trip) {
            trip = t;
            boardPos = i;
          }
        }
      }
    }

    for (const [stop, rideArrival] of dropOffs) {
      if (rideArrival !== bestRide[stop]) continue; // a later pattern in this round dropped you here sooner
      for (const { to, seconds } of timetable.transfers[stop]) {
        const arr = rideArrival + seconds;
        if (arr < best[to]) {
          best[to] = arr;
          cur[to] = arr;
          lab[to] = { type: "walk", from: stop, seconds };
          nextMarked.add(to);
        }
      }
    }
    marked = nextMarked;
  }
  return { best, rounds, labels, rideLabels };
}

function earliestTrip(pattern, pos, time) {
  // Trips in a pattern are FIFO, so departures at any position are sorted.
  const trips = pattern.trips;
  let lo = 0;
  let hi = trips.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (trips[mid].dep[pos] < time) lo = mid + 1;
    else hi = mid;
  }
  return trips[lo] ?? null;
}

/** Rebuild the legs of the best journey to `target` from RAPTOR's labels. */
export function journeyTo(timetable, result, target) {
  if (result.best[target] === INF) return null;
  let k = result.rounds.findIndex((r) => r[target] === result.best[target]);
  const legs = [];
  let label = result.labels[k][target];
  let stop = target;
  while (label && label.type !== "origin") {
    if (label.type === "walk") {
      legs.push({ type: "walk", from: label.from, to: stop, seconds: label.seconds });
      stop = label.from;
      label = result.rideLabels[k][stop];
      continue;
    }
    const pattern = timetable.patterns[label.pattern];
    legs.push({
      type: "ride",
      route: pattern.routeName ?? pattern.route,
      from: label.boardStop,
      to: stop,
      dep: label.trip.dep[label.boardPos],
      arr: label.trip.arr[label.alightPos],
      tripId: label.trip.id,
    });
    stop = label.boardStop;
    k -= 1;
    label = result.labels[k][stop];
  }
  return { originStop: stop, legs: legs.reverse() };
}
