// node bench/bench.js — times RAPTOR against Connection Scan on a city-sized random network.
import os from "node:os";
import { performance } from "node:perf_hooks";
import { raptor } from "../src/raptor.js";
import { connectionScan } from "../src/csa.js";
import { connections } from "../src/timetable.js";
import { meetingPoints } from "../src/meet.js";
import { randomNetwork } from "../test/random-network.js";

const QUERIES = 200;
const t0 = performance.now();
const { timetable, trips, rand } = randomNetwork(42, { side: 45, routes: 220, tripsPerRoute: 70, minLen: 10, maxLen: 30 });
const sorted = connections(timetable);
const buildMs = performance.now() - t0;

const queries = Array.from({ length: QUERIES }, () => [{ stop: Math.floor(rand() * timetable.stops.length), time: 7 * 3600 + Math.floor(rand() * 3 * 3600) }]);

function time(fn) {
  const start = performance.now();
  for (const q of queries) fn(q);
  return (performance.now() - start) / QUERIES;
}

time((q) => raptor(timetable, q, 8)); // warm up the JIT
const raptorMs = time((q) => raptor(timetable, q, 8));
const csaMs = time((q) => connectionScan(timetable, q, sorted));

const people = Array.from({ length: 4 }, (_, i) => {
  const s = timetable.stops[Math.floor(rand() * timetable.stops.length)];
  return { name: `P${i}`, lat: s.lat, lon: s.lon, depart: 8 * 3600 };
});
const m0 = performance.now();
meetingPoints(timetable, people, { top: 5 });
const meetMs = performance.now() - m0;

const stopTimes = trips.reduce((n, t) => n + t.stops.length, 0);
console.log(`| Network | ${timetable.stops.length} stops, ${timetable.patterns.length} patterns, ${trips.length} trips, ${stopTimes.toLocaleString()} stop times, ${sorted.length.toLocaleString()} connections (built in ${buildMs.toFixed(0)} ms) |`);
console.log(`| RAPTOR, 8 rounds | ${raptorMs.toFixed(2)} ms per query (${QUERIES} queries) |`);
console.log(`| Connection Scan | ${csaMs.toFixed(2)} ms per query |`);
console.log(`| Meeting point, 4 people, every stop as a candidate | ${meetMs.toFixed(0)} ms |`);
console.log(`| Machine | Node ${process.version}, ${os.cpus()[0].model}, ${os.cpus().length} cores |`);
