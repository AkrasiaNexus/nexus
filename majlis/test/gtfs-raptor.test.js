import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { activeServices, loadGtfs, parseCsv, parseTime } from "../src/gtfs.js";
import { journeyTo, raptor } from "../src/raptor.js";

const TINY = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "tiny");
const WEDNESDAY = "20261111";
const NATIONAL_DAY = "20261202";
const at = (hms) => parseTime(hms);

function load(date = WEDNESDAY) {
  const tt = loadGtfs(TINY, date);
  const idx = (id) => tt.stops.findIndex((s) => s.id === id);
  return { tt, idx };
}

test("CSV parser handles quoted commas, escaped quotes and CRLF", () => {
  const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n');
  assert.deepEqual(rows, [{ a: "x, y", b: 'say "hi"' }]);
});

test("times past midnight are kept as seconds after the service day began", () => {
  assert.equal(parseTime("08:05:30"), 8 * 3600 + 5 * 60 + 30);
  assert.equal(parseTime("25:10:00"), 25 * 3600 + 600);
});

test("calendar exceptions switch services off and on", () => {
  const calendar = [{ service_id: "WK", monday: "1", tuesday: "1", wednesday: "1", thursday: "1", friday: "1", saturday: "0", sunday: "0", start_date: "20260101", end_date: "20261231" }];
  const exceptions = [{ service_id: "WK", date: NATIONAL_DAY, exception_type: "2" }, { service_id: "HOL", date: NATIONAL_DAY, exception_type: "1" }];
  assert.deepEqual([...activeServices(calendar, exceptions, WEDNESDAY)], ["WK"]);
  assert.deepEqual([...activeServices(calendar, exceptions, NATIONAL_DAY)], ["HOL"]);
  assert.deepEqual([...activeServices(calendar, exceptions, "20261114")], [], "Saturday");
});

test("loader skips parent stations and builds one pattern per stop sequence", () => {
  const { tt } = load();
  assert.equal(tt.stops.length, 6);
  assert.equal(tt.stops[0].name, "Bus Station, Al Wahda");
  assert.deepEqual(tt.patterns.map((p) => [p.routeName, p.trips.length]).sort(), [["54", 3], ["73", 3], ["N2", 2]]);
});

test("walking transfers connect only stops within walking distance", () => {
  const { tt, idx } = load();
  assert.deepEqual(tt.transfers[idx("C")].map((t) => tt.stops[t.to].id), ["E"]);
  assert.equal(tt.transfers[idx("C")][0].seconds, 211);
  assert.deepEqual(tt.transfers[idx("A")], []);
});

test("earliest arrivals match the hand-worked answers", () => {
  const { tt, idx } = load();
  const r = raptor(tt, [{ stop: idx("A"), time: at("08:05:00") }]);
  assert.equal(r.best[idx("B")], at("08:15:00"), "waits for the 08:10, missing the 08:00");
  assert.equal(r.best[idx("C")], at("08:20:00"));
  assert.equal(r.best[idx("D")], at("08:28:00"), "transfers to route 73 at 08:22");
  assert.equal(r.best[idx("E")], at("08:20:00") + 211, "walks from Charlie");
  assert.equal(r.best[idx("F")], at("08:29:00"), "misses the 08:15 N2, takes the 08:25");
});

test("journeys come back as ride, walk, ride legs", () => {
  const { tt, idx } = load();
  const r = raptor(tt, [{ stop: idx("A"), time: at("08:05:00") }]);
  const j = journeyTo(tt, r, idx("F"));
  const names = (i) => tt.stops[i].id;
  assert.equal(names(j.originStop), "A");
  assert.deepEqual(j.legs.map((l) => [l.type, l.route ?? "", names(l.from), names(l.to)]), [
    ["ride", "54", "A", "C"],
    ["walk", "", "C", "E"],
    ["ride", "N2", "E", "F"],
  ]);
});

test("the round limit caps the number of vehicles", () => {
  const { tt, idx } = load();
  const oneBus = raptor(tt, [{ stop: idx("A"), time: at("08:05:00") }], 1);
  assert.equal(oneBus.best[idx("C")], at("08:20:00"));
  assert.equal(oneBus.best[idx("D")], Infinity, "Delta needs a second bus");
});

test("on National Day only the holiday service runs", () => {
  const { tt, idx } = load(NATIONAL_DAY);
  const r = raptor(tt, [{ stop: idx("A"), time: at("08:05:00") }]);
  assert.equal(r.best[idx("C")], at("09:10:00"));
  assert.equal(r.best[idx("D")], Infinity);
});
