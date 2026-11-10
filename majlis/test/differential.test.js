// RAPTOR and the Connection Scan Algorithm are independent algorithms for the
// same question. On hundreds of random networks they must agree on the earliest
// arrival at every single stop.
import test from "node:test";
import assert from "node:assert/strict";
import { journeyTo, raptor } from "../src/raptor.js";
import { connectionScan } from "../src/csa.js";
import { connections } from "../src/timetable.js";
import { randomNetwork } from "./random-network.js";

const SEEDS = 300;

test(`RAPTOR matches Connection Scan on ${SEEDS} random cities`, () => {
  let comparedStops = 0;
  let reachedStops = 0;
  let splitPatterns = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { timetable, rand } = randomNetwork(seed);
    const sorted = connections(timetable);
    const routeIds = new Set(timetable.patterns.map((p) => p.route));
    splitPatterns += timetable.patterns.length - routeIds.size;

    for (let q = 0; q < 3; q++) {
      const sources = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({
        stop: Math.floor(rand() * timetable.stops.length),
        time: 6 * 3600 + Math.floor(rand() * 4 * 3600),
      }));
      const expected = connectionScan(timetable, sources, sorted);
      const actual = raptor(timetable, sources, 64).best;
      assert.deepEqual(actual, expected, `seed ${seed}, query ${q}`);
      comparedStops += expected.length;
      reachedStops += expected.filter(Number.isFinite).length;
    }
  }
  assert.ok(reachedStops > comparedStops * 0.3, "queries reach a meaningful share of each city");
  assert.ok(splitPatterns > 0, "express trips forced at least one pattern split");
});

// Replays a reconstructed journey and checks a rider could actually take it.
function replay(timetable, sources, journey) {
  const source = sources.find((s) => s.stop === journey.originStop);
  assert.ok(source, "journey starts at a source stop");
  let clock = source.time;
  let stop = journey.originStop;
  let lastWasWalk = false;
  for (const leg of journey.legs) {
    assert.equal(leg.from, stop, "legs connect");
    if (leg.type === "walk") {
      assert.ok(!lastWasWalk, "never two walks in a row");
      assert.ok(timetable.transfers[leg.from].some((t) => t.to === leg.to && t.seconds === leg.seconds), "walk is a real footpath");
      clock += leg.seconds;
      lastWasWalk = true;
    } else {
      assert.ok(leg.dep >= clock, "board after arriving at the stop");
      assert.ok(leg.arr >= leg.dep, "ride takes non-negative time");
      clock = leg.arr;
      lastWasWalk = false;
    }
    stop = leg.to;
  }
  return { stop, clock };
}

test("every reconstructed journey is rideable and arrives when RAPTOR says", () => {
  let journeys = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const { timetable, rand } = randomNetwork(seed);
    const sources = [{ stop: Math.floor(rand() * timetable.stops.length), time: 7 * 3600 }];
    const result = raptor(timetable, sources, 64);
    result.best.forEach((arrival, target) => {
      if (!Number.isFinite(arrival)) return;
      const end = replay(timetable, sources, journeyTo(timetable, result, target));
      assert.equal(end.stop, target);
      assert.equal(end.clock, arrival, `seed ${seed}, stop ${target}`);
      journeys++;
    });
  }
  assert.ok(journeys > 1000);
});
