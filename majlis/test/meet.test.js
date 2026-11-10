import test from "node:test";
import assert from "node:assert/strict";
import { buildTimetable } from "../src/timetable.js";
import { meetingPoints } from "../src/meet.js";

const HOP = 300;

// Seven stops ~2.2 km apart on one line (too far to walk between), with a bus
// both ways every 5 minutes, plus one stop no bus serves.
function lineCity() {
  const stops = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, name: `Stop ${i}`, lat: 24.45, lon: 54.30 + i * 0.022 }));
  stops.push({ id: "island", name: "Unserved island", lat: 24.60, lon: 54.60 });
  const trips = [];
  for (let t = 7 * 3600; t <= 9 * 3600 + 1800; t += 300) {
    const east = [0, 1, 2, 3, 4, 5, 6];
    const west = [6, 5, 4, 3, 2, 1, 0];
    for (const [name, seq] of [["east", east], ["west", west]]) {
      const times = seq.map((_, i) => t + i * HOP);
      trips.push({ id: `${name}-${t}`, route: name, routeName: name === "east" ? "E1" : "W1", stops: seq, arr: times, dep: times });
    }
  }
  return buildTimetable({ stops, trips });
}

const at = (city, i) => ({ lat: city.stops[i].lat, lon: city.stops[i].lon });
const EIGHT = 8 * 3600;

test("fairest meets in the middle; fastest overall strands one friend", () => {
  const city = lineCity();
  const people = [
    { name: "Ali", ...at(city, 0), depart: EIGHT },
    { name: "Sara", ...at(city, 1), depart: EIGHT },
    { name: "Omar", ...at(city, 6), depart: EIGHT },
  ];
  const fair = meetingPoints(city, people, { objective: "fairest" })[0];
  const fast = meetingPoints(city, people, { objective: "fastest" })[0];

  assert.equal(fair.place.name, "Stop 3");
  assert.equal(fast.place.name, "Stop 1");
  assert.ok(fair.longest < fast.longest, "fairest has the shorter worst trip");
  assert.ok(fast.total < fair.total, "fastest has the smaller total");
  assert.equal(fast.people.find((p) => p.name === "Omar").minutes, 25, "Omar rides 5 stops to reach the others");
});

test("each person gets a journey they can follow", () => {
  const city = lineCity();
  const people = [
    { name: "Ali", ...at(city, 0), depart: EIGHT },
    { name: "Omar", ...at(city, 6), depart: EIGHT },
  ];
  const best = meetingPoints(city, people)[0];
  const omar = best.people.find((p) => p.name === "Omar");
  assert.equal(omar.journey.legs[0].type, "ride");
  assert.equal(omar.journey.legs[0].route, "W1");
  assert.equal(city.stops[omar.journey.legs.at(-1).to].name, best.place.name);
});

test("places nobody can reach are left out", () => {
  const city = lineCity();
  const people = [{ name: "Ali", ...at(city, 0), depart: EIGHT }, { name: "Omar", ...at(city, 6), depart: EIGHT }];
  const all = meetingPoints(city, people, { top: 100 });
  assert.ok(!all.some((r) => r.place.name === "Unserved island"));
  assert.equal(all.length, 7);
});

test("custom candidate places score by their nearest stops plus the walk", () => {
  const city = lineCity();
  const people = [{ name: "Ali", ...at(city, 0), depart: EIGHT }, { name: "Omar", ...at(city, 6), depart: EIGHT }];
  const cafe = { name: "Cafe near stop 3", lat: 24.4525, lon: 54.366 };
  const [result] = meetingPoints(city, people, { candidates: [cafe] });
  assert.equal(result.place.name, "Cafe near stop 3");
  assert.ok(result.people.every((p) => p.egressSeconds > 0), "everyone walks the last bit");
});

test("short distances are walked instead of waiting for a bus", () => {
  const city = lineCity();
  const sara = { name: "Sara", lat: 24.4505, lon: 54.3225, depart: EIGHT };
  const ali = { name: "Ali", ...at(city, 1), depart: EIGHT };
  const [result] = meetingPoints(city, [sara, ali], { candidates: [{ name: "Stop 1", ...at(city, 1) }] });
  assert.ok(result.people.find((p) => p.name === "Sara").walkOnly);
});
