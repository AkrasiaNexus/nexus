#!/usr/bin/env node
// majlis --gtfs ./feed --date 20261112 --time 17:00 --person "Ali@24.47,54.37" --person "Sara@24.43,54.44"
import { parseArgs } from "node:util";
import { loadGtfs, parseTime } from "../src/gtfs.js";
import { meetingPoints } from "../src/meet.js";
import { distanceMeters } from "../src/geo.js";

const HELP = `Find the fairest place for a group to meet by public transport.

Options:
  --gtfs DIR         unzipped GTFS feed folder
  --date YYYYMMDD    service date
  --time HH:MM       when everyone leaves
  --person NAME@LAT,LON   repeat for each person (2 or more)
  --place NAME@LAT,LON    candidate meeting place (repeatable; default: every stop)
  --objective fairest|fastest   minimise the longest trip (default) or the total
  --top N            how many places to list (default 3)`;

function point(spec, flag) {
  const m = /^(.+)@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(spec);
  if (!m) throw new Error(`${flag} must look like Name@lat,lon (got "${spec}")`);
  return { name: m[1].trim(), lat: +m[2], lon: +m[3] };
}

const clock = (s) => `${String(Math.floor(s / 3600) % 24).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;

export function run(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      gtfs: { type: "string" }, date: { type: "string" }, time: { type: "string" },
      person: { type: "string", multiple: true }, place: { type: "string", multiple: true },
      objective: { type: "string", default: "fairest" }, top: { type: "string", default: "3" },
      help: { type: "boolean" },
    },
  });
  if (values.help || !values.gtfs) return HELP;
  if (!/^\d{8}$/.test(values.date ?? "")) throw new Error("--date must be YYYYMMDD");
  if (!/^\d{1,2}:\d{2}$/.test(values.time ?? "")) throw new Error("--time must be HH:MM");
  if ((values.person ?? []).length < 2) throw new Error("give at least two --person entries");
  if (!["fairest", "fastest"].includes(values.objective)) throw new Error("--objective must be fairest or fastest");

  const depart = parseTime(`${values.time}:00`);
  const timetable = loadGtfs(values.gtfs, values.date);
  const people = values.person.map((p) => ({ ...point(p, "--person"), depart }));
  const candidates = values.place?.map((p) => point(p, "--place"));
  const results = meetingPoints(timetable, people, { candidates, objective: values.objective, top: +values.top });
  if (!results.length) return "No place is reachable for everyone at that time.";

  const name = (i) => timetable.stops[i].name;
  return results.map((r, rank) => {
    const lines = [`${rank + 1}. ${r.place.name}  (longest trip ${Math.round(r.longest / 60)} min, total ${Math.round(r.total / 60)} min)`];
    for (const p of r.people) {
      if (p.walkOnly) { lines.push(`   ${p.name}: ${p.minutes} min, walk the whole way`); continue; }
      const legs = p.journey.legs.map((l) => l.type === "walk"
        ? `walk to ${name(l.to)}`
        : `bus ${l.route} ${clock(l.dep)} ${name(l.from)} → ${name(l.to)} ${clock(l.arr)}`);
      const person = people.find((x) => x.name === p.name);
      const first = distanceMeters(person, timetable.stops[p.journey.originStop]) > 50 ? [`walk to ${name(p.journey.originStop)}`] : [];
      lines.push(`   ${p.name}: ${p.minutes} min, ${[...first, ...legs].join(", ")}${p.egressSeconds ? ", walk to the place" : ""}`);
    }
    return lines.join("\n");
  }).join("\n\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(run(process.argv.slice(2)));
  } catch (err) {
    console.error(`majlis: ${err.message}`);
    process.exit(1);
  }
}
